/**
 * Runtime-safe RMA invariants shared by server code and contract tests.
 * Keep policy and state decisions here so a route or SQL contract cannot
 * silently drift from the executable rule used by clients/tests.
 */

/** @type {string} */
const statutoryWithdrawalScope = "statutory_b2c_withdrawal";

/**
 * B2C withdrawal is the only scope where a reason and evidence may both be
 * omitted. B2B, legacy and warranty flows always retain an evidence record.
 *
 * @param {string|null|undefined} reasonCode
 * @param {string} policyScope
 */
export function reasonRequiresImage(reasonCode, policyScope = "legacy_unverified") {
  return !(
    policyScope === statutoryWithdrawalScope &&
    (reasonCode === null || reasonCode === undefined || reasonCode === "withdrawal_no_longer_needed")
  );
}

/**
 * @typedef {{
 *   action: string,
 *   quantity?: number|null,
 *   receivedQuantity?: number|null,
 *   resolutionQuantity?: number|null,
 *   inventoryDispositionQuantity?: number|null,
 *   inventoryDisposition?: string|null,
 *   qcStatus?: string|null,
 *   requestedResolution?: string|null,
 *   resolutionAction?: string|null,
 *   walletRequestStatus?: string|null,
 *   replacementOrderId?: string|null,
 *   status: string,
 *   receivedAt?: string|null
 * }} RmaActionAvailabilityInput
 */

/**
 * True when an action is legal on the current two-axis RMA state.
 *
 * @param {RmaActionAvailabilityInput} input
 */
export function isRmaActionAvailable(input) {
  const {
    action,
    quantity = null,
    receivedQuantity = null,
    resolutionQuantity = null,
    inventoryDispositionQuantity = null,
    inventoryDisposition = "pending",
    qcStatus = "pending",
    requestedResolution,
    resolutionAction = null,
    walletRequestStatus = null,
    replacementOrderId = null,
    status,
    receivedAt = null,
  } = input;

  const totalQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : null;
  const hasCompleteQuantity = (value) => totalQuantity !== null && value === totalQuantity;
  const receivedComplete = hasCompleteQuantity(receivedQuantity);
  const resolutionComplete = hasCompleteQuantity(resolutionQuantity);
  const inventoryComplete = hasCompleteQuantity(inventoryDispositionQuantity);

  if (action === "mark_received") return status === "approved";
  if (action === "record_qc") {
    return (
      ["received", "refunded", "replacement_sent", "replaced"].includes(status) &&
      receivedComplete &&
      Boolean(receivedAt) &&
      qcStatus === "pending"
    );
  }

  const received = receivedComplete && Boolean(receivedAt);
  const inspectionComplete =
    received && ["passed", "failed", "not_required"].includes(qcStatus ?? "");

  if (action === "request_wallet_refund") {
    return (
      status === "received" &&
      inspectionComplete &&
      ["refund", "wallet_credit", "credit_note"].includes(requestedResolution) &&
      (resolutionAction === null || resolutionAction === "refund_wallet") &&
      isCommercialOutcomeAvailable({
        action,
        resolutionAction,
        walletRequestStatus,
        replacementOrderId,
        status,
      })
    );
  }

  if (action === "mark_replacement_sent") {
    return (
      status === "received" &&
      inspectionComplete &&
      requestedResolution === "replacement" &&
      resolutionAction !== "refund_wallet" &&
      isCommercialOutcomeAvailable({
        action,
        resolutionAction,
        walletRequestStatus,
        replacementOrderId,
        status,
      })
    );
  }

  if (["restock_return", "mark_scrapped", "supplier_return"].includes(action)) {
    return (
      ["received", "refunded", "replacement_sent", "replaced"].includes(status) &&
      receivedComplete &&
      inspectionComplete &&
      inventoryDisposition === "quarantine"
    );
  }

  if (action === "close") {
    if (status === "closed") return true;
    if (
      status === "rejected" &&
      !receivedAt &&
      (!Number.isInteger(receivedQuantity) || receivedQuantity === 0)
    ) return true;

    const refundComplete =
      status === "refunded" &&
      resolutionAction === "refund_wallet" &&
      resolutionComplete &&
      replacementOrderId === null &&
      walletRequestStatus === "approved";
    const replacementComplete =
      ["replacement_sent", "replaced"].includes(status) &&
      resolutionAction === "replacement" &&
      resolutionComplete &&
      Boolean(replacementOrderId) &&
      walletRequestStatus === null;
    const commercialComplete = refundComplete || replacementComplete;
    const inventoryTerminal = ["restock", "scrap", "supplier_return"].includes(
      inventoryDisposition ?? ""
    );
    return (
      received &&
      inspectionComplete &&
      commercialComplete &&
      inventoryTerminal &&
      inventoryComplete
    );
  }

  if (action === "assign") return !["closed", "rejected"].includes(status);
  return Boolean(requestedResolution);
}

/**
 * A single RMA can settle commercially only once. A pending/approved wallet
 * request is already a reservation and blocks a replacement race; a rejected
 * wallet attempt is retained for audit but may be retried with a new key.
 *
 * @param {{action:string,resolutionAction?:string|null,walletRequestStatus?:string|null,replacementOrderId?:string|null,status:string}} input
 */
export function isCommercialOutcomeAvailable({
  action,
  resolutionAction = null,
  walletRequestStatus = null,
  replacementOrderId = null,
  status,
}) {
  const hasActiveWalletRequest = ["pending", "approved"].includes(walletRequestStatus ?? "");
  const hasWalletOutcome =
    hasActiveWalletRequest ||
    (resolutionAction === "refund_wallet" && walletRequestStatus !== "rejected") ||
    status === "refunded";
  const hasReplacementOutcome =
    Boolean(replacementOrderId) ||
    resolutionAction === "replacement" ||
    ["replacement_sent", "replaced"].includes(status);

  if (action === "request_wallet_refund") {
    return (
      !hasReplacementOutcome &&
      !hasWalletOutcome &&
      (walletRequestStatus === null || walletRequestStatus === "rejected") &&
      (resolutionAction === null ||
        (resolutionAction === "refund_wallet" && walletRequestStatus === "rejected"))
    );
  }
  // A rejected wallet attempt remains a commercial decision for this RMA.
  // V1 recovery may retry the same wallet action with a new key, but it must
  // never silently switch that RMA to a replacement outcome.
  if (action === "mark_replacement_sent") {
    return !hasReplacementOutcome && !hasWalletOutcome && walletRequestStatus === null;
  }
  return true;
}

/**
 * Refund cap is line-scoped: immutable unit price x approved quantity, less
 * prior RMA refunds, then limited by the order wallet balance.
 *
 * @param {{existingRmaRefunds:number,orderRefundableBalance:number,approvedQuantity:number,orderLineEligibleQuantity:number,unitPriceSnapshot:number}} input
 */
export function calculateRmaLineRefundCap({
  existingRmaRefunds,
  orderRefundableBalance,
  approvedQuantity,
  orderLineEligibleQuantity,
  unitPriceSnapshot,
}) {
  const unitPrice = Math.max(0, unitPriceSnapshot);
  const rmaGross = unitPrice * Math.max(0, Math.floor(approvedQuantity));
  const orderLineGross = unitPrice * Math.max(0, Math.floor(orderLineEligibleQuantity));
  const lineRemaining = Math.max(0, orderLineGross - Math.max(0, existingRmaRefunds));
  return Math.max(
    0,
    Math.min(
      roundCents(rmaGross),
      roundCents(lineRemaining),
      roundCents(Math.max(0, orderRefundableBalance))
    )
  );
}

function roundCents(value) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
