import { projectAdminRmaWorkflow } from './partspro-rma-workflow-rules.mjs';

/** Negotiation and quantity partitions do not bypass receipt, money or stock gates. */
export function projectRmaV4Workflow(input, capabilities) {
  if (["submitted", "under_review"].includes(input.status)) return {
    workflowQueue: "review", availableActions: capabilities.manage ? ["approve", "reject", "assign"] : [],
    recommendedAction: capabilities.manage ? "approve" : null, blockedReason: capabilities.manage ? null : "permission_denied",
  };
  const settled = input.refundCompletedAt || input.walletRefundStatus === "approved" && input.walletCreditedAmount > 0 && input.resolutionAction === "refund_wallet";
  if (settled && input.status !== "closed") {
    const actions = [];
    const received = Boolean(input.receivedAt) && input.receivedQuantity === input.quantity;
    const disposed = ["restock", "scrap", "supplier_return"].includes(input.inventoryDisposition) && input.inventoryDispositionQuantity === input.quantity;
    if (!received && !input.returnWaivedAt) {
      if (capabilities.inventory) actions.push("mark_received");
      if (!input.customerShippedAt && (capabilities.waiveReturn ?? capabilities.manage)) actions.push("waive_return");
    } else if (input.returnWaivedAt || disposed) {
      if (capabilities.manage) actions.push("close");
    } else if (input.qcStatus === "pending") {
      if (capabilities.qc) actions.push("record_qc");
    } else {
      if (capabilities.adjustStock && input.qcStatus === "passed") actions.push("restock_return");
      if (capabilities.inventory) actions.push("mark_scrapped", "supplier_return");
    }
    return { workflowQueue: "inventory_close", availableActions: actions, recommendedAction: actions[0] ?? null, blockedReason: actions.length ? null : "permission_denied" };
  }
  const simpleRefund = ["approved", "received"].includes(input.status) && !input.refundCompletedAt &&
    !input.replacementOrderId && !input.replacementReservedOrderId &&
    (!input.resolutionAction || input.resolutionAction === "refund_wallet") &&
    !["approved", "cancelled"].includes(input.walletRefundStatus) && input.negotiationStatus !== "pending" &&
    (!(input.negotiationStatus === "agreed") || input.negotiationOutcome === "refund_wallet");
  const result = projectAdminRmaWorkflow(input, capabilities);
  const actions = new Set(result.availableActions);
  const noSettlement = !input.walletRefundRequestId && !input.walletRefundStatus &&
    !input.replacementOrderId && !input.replacementReservedOrderId && !input.resolutionAction;
  const received = input.status === 'received' && Boolean(input.receivedAt) &&
    Number.isInteger(input.quantity) && input.quantity > 0 && input.receivedQuantity === input.quantity;
  const quarantined = input.inventoryDisposition === 'quarantine';
  const qcComplete = ['passed', 'failed', 'not_required'].includes(input.qcStatus);
  const negotiation = input.negotiationStatus ?? 'none';
  const agreedException = negotiation === 'agreed' &&
    ['return_to_customer', 'scrap_without_refund'].includes(input.negotiationOutcome);
  const receiptPending = input.status === 'approved' && !input.receivedAt && !input.receivedQuantity;

  if (capabilities.manage && noSettlement && negotiation === 'none' && Number.isInteger(input.quantity) && input.quantity > 1 &&
      (receiptPending || (received && quarantined && input.qcStatus === 'pending'))) {
    actions.add('split_request');
  }
  if (receiptPending && noSettlement && capabilities.manage) actions.add('cancel_unreceived');
  if (received && noSettlement && capabilities.manage && capabilities.refund && input.refundPricingVerified === false) actions.add('verify_refund_snapshot');
  if (received && quarantined && noSettlement && qcComplete && capabilities.manage && negotiation !== 'pending') {
    actions.add('start_negotiation');
  }
  if (received && negotiation === 'pending' && noSettlement) {
    return {
      workflowQueue: 'resolution',
      availableActions: capabilities.manage ? ['resolve_negotiation'] : [],
      recommendedAction: capabilities.manage ? 'resolve_negotiation' : null,
      blockedReason: capabilities.manage ? null : 'waiting_customer_agreement',
    };
  }
  if (received && agreedException) {
    actions.clear();
    const returned = input.negotiationOutcome === 'return_to_customer';
    if (quarantined && capabilities.inventory) actions.add(returned ? 'return_to_customer' : 'mark_scrapped');
    const disposed = input.inventoryDisposition === (returned ? 'returned_to_customer' : 'scrap') &&
      input.inventoryDispositionQuantity === input.quantity;
    if (disposed && capabilities.manage) actions.add('close');
    return {
      workflowQueue: 'resolution',
      availableActions: [...actions],
      recommendedAction: actions.has('close') ? 'close' : actions.values().next().value ?? null,
      blockedReason: actions.size ? null : 'permission_denied',
    };
  }
  if (received && input.replacementReservedOrderId && !input.replacementOrderId && !input.walletRefundRequestId && capabilities.manage && capabilities.createReplacement) actions.add('release_cancelled_replacement');
  if (received && qcComplete && input.requestedResolution === 'replacement' &&
      noSettlement && capabilities.manage && !input.replacementReservedOrderId) {
    if (capabilities.createReplacement) {
      actions.add('bind_replacement_order');
      actions.add('create_replacement_order');
    }
  }
  if (input.refundPricingVerified === false && !input.walletRefundRequestId) {
    actions.delete('request_wallet_refund');
    if (actions.has('verify_refund_snapshot')) result.recommendedAction = 'verify_refund_snapshot';
    else if (result.recommendedAction === 'request_wallet_refund') result.recommendedAction = null;
  }
  const canPrepare = capabilities.prepareRefund === true && noSettlement && received && qcComplete
    && ['replacement', 'refund', 'wallet_credit', 'credit_note'].includes(input.requestedResolution)
    && (negotiation === 'none' || (negotiation === 'agreed' && input.negotiationOutcome === 'refund_wallet'))
    && (quarantined || (['restock', 'scrap', 'supplier_return'].includes(input.inventoryDisposition)
      && input.inventoryDispositionQuantity === input.quantity));
  if (canPrepare && (input.requestedResolution === 'replacement' || input.refundPricingVerified === false)) {
    actions.add('prepare_wallet_refund');
  }
  if (input.refundPricingVerified === false && input.unitPriceSnapshot === null) {
    actions.delete('verify_refund_snapshot');
    if (result.recommendedAction === 'verify_refund_snapshot') {
      result.recommendedAction = actions.has('prepare_wallet_refund') ? 'prepare_wallet_refund' : null;
      result.blockedReason = actions.has('prepare_wallet_refund') ? null : 'missing_unit_price_snapshot';
    }
  }
  if (simpleRefund) {
    for (const legacy of ["prepare_wallet_refund", "verify_refund_snapshot", "request_wallet_refund"]) actions.delete(legacy);
    if (input.returnWaivedAt) {
      for (const physical of ["mark_received", "split_request", "cancel_unreceived"]) actions.delete(physical);
    } else if (!input.customerShippedAt && !input.receivedAt && !input.receivedQuantity &&
      input.inventoryDisposition === "pending" && (capabilities.waiveReturn ?? capabilities.manage)) {
      actions.add("waive_return");
    }
    if (capabilities.approveRefund) actions.add("execute_refund");
    return { ...result, workflowQueue: "resolution", availableActions: [...actions],
      recommendedAction: capabilities.approveRefund ? "execute_refund" : null,
      blockedReason: capabilities.approveRefund ? null : "permission_denied" };
  }
  return { ...result, availableActions: [...actions] };
}
