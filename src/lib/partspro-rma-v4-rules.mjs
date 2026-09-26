import { projectAdminRmaWorkflow } from './partspro-rma-workflow-rules.mjs';

/** Negotiation and quantity partitions do not bypass receipt, money or stock gates. */
export function projectRmaV4Workflow(input, capabilities) {
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
  return { ...result, availableActions: [...actions] };
}
