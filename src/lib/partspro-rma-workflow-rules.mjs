import { isRmaActionAvailable } from "./partspro-rma-rules.mjs";

/**
 * Server-side projection for the admin RMA workbench.
 *
 * This module only decides which queue and which guarded actions should be
 * presented for a current snapshot. It does not authorize an RPC by itself:
 * every receiving, QC, commercial, inventory, and close action is delegated
 * to the shared `isRmaActionAvailable` invariant before it is exposed.
 */

const queueCodes = [
  "review",
  "awaiting_return",
  "receiving",
  "qc",
  "resolution",
  "inventory_close",
  "archive",
];

const actionCodes = [
  "start_review",
  "approve",
  "reject",
  "assign",
  "mark_received",
  "record_qc",
  "request_wallet_refund",
  "mark_replacement_sent",
  "restock_return",
  "mark_scrapped",
  "supplier_return",
  "close",
];

const recommendationCodes = [...actionCodes, "choose_inventory_disposition"];

export const rmaWorkflowQueueCodes = Object.freeze(queueCodes);
export const rmaWorkflowQueues = rmaWorkflowQueueCodes;
export const rmaWorkflowActionCodes = Object.freeze(actionCodes);
export const rmaWorkflowActions = rmaWorkflowActionCodes;
export const rmaWorkflowRecommendationCodes = Object.freeze(recommendationCodes);

export const rmaWorkflowBlockedReasons = Object.freeze([
  "waiting_customer_return",
  "waiting_wallet_approval",
  "waiting_qc",
  "missing_requested_resolution",
  "missing_received_at",
  "missing_received_quantity",
  "partial_received_quantity",
  "missing_qc_status",
  "missing_resolution_quantity",
  "partial_resolution_quantity",
  "missing_inventory_disposition",
  "missing_inventory_quantity",
  "partial_inventory_disposition_quantity",
  "missing_replacement_order",
  "permission_denied",
  "invalid_state",
]);

const reviewStatuses = new Set(["submitted", "requested", "under_review"]);
const archiveStatuses = new Set(["closed", "rejected"]);
const commercialTerminalStatuses = new Set(["refunded", "replacement_sent", "replaced"]);
const inventoryTerminalDispositions = new Set(["restock", "scrap", "supplier_return"]);
const validQcStatuses = new Set(["pending", "passed", "failed", "not_required"]);
const completedQcStatuses = new Set(["passed", "failed", "not_required"]);
const validInventoryDispositions = new Set([
  "pending",
  "quarantine",
  ...inventoryTerminalDispositions,
]);
const knownStatuses = new Set([
  ...reviewStatuses,
  "approved",
  "received",
  "return_in_transit",
  ...commercialTerminalStatuses,
  ...archiveStatuses,
]);

/**
 * @typedef {"review"|"awaiting_return"|"receiving"|"qc"|"resolution"|"inventory_close"|"archive"} RmaWorkflowQueue
 * @typedef {"start_review"|"approve"|"reject"|"assign"|"mark_received"|"record_qc"|"request_wallet_refund"|"mark_replacement_sent"|"restock_return"|"mark_scrapped"|"supplier_return"|"close"} RmaWorkflowAction
 * @typedef {RmaWorkflowAction|"choose_inventory_disposition"} RmaWorkflowRecommendation
 * @typedef {{manage?: boolean, inventory?: boolean, refund?: boolean, adjustStock?: boolean, canManage?: boolean, canInventory?: boolean, canRefund?: boolean, canAdjustStock?: boolean}} RmaAdminCapabilities
 * @typedef {Object} RmaAdminWorkflowInput
 * @property {string} [status]
 * @property {number|null} [quantity]
 * @property {number|null} [receivedQuantity]
 * @property {number|null} [resolutionQuantity]
 * @property {number|null} [inventoryDispositionQuantity]
 * @property {string|null} [receivedAt]
 * @property {string|null} [customerShippedAt]
 * @property {string|null} [qcStatus]
 * @property {string|null} [requestedResolution]
 * @property {string|null} [resolutionAction]
 * @property {string|null} [inventoryDisposition]
 * @property {string|null} [walletRequestStatus]
 * @property {string|null} [walletRefundStatus]
 * @property {string|null} [replacementOrderId]
 * @property {string|null} [assignedTo]
 * @property {RmaAdminCapabilities} [capabilities]
 * @property {string} [received_at]
 * @property {string} [customer_shipped_at]
 * @property {number|null} [received_quantity]
 * @property {number|null} [resolution_quantity]
 * @property {number|null} [inventory_disposition_quantity]
 * @property {string|null} [qc_status]
 * @property {string|null} [requested_resolution]
 * @property {string|null} [resolution_action]
 * @property {string|null} [inventory_disposition]
 * @property {string|null} [wallet_refund_status]
 * @property {string|null} [replacement_order_id]
 * @property {string|null} [assigned_to]
 */

/**
 * @typedef {Object} RmaAdminWorkflowResult
 * @property {RmaWorkflowQueue} workflowQueue
 * @property {RmaWorkflowAction[]} availableActions
 * @property {RmaWorkflowRecommendation|null} recommendedAction
 * @property {string|null} blockedReason
 */

/**
 * Project one RMA snapshot into the server-owned admin work queue.
 * Missing or contradictory historical fields fail closed: downstream money,
 * QC, inventory, and close actions are hidden until an operator repairs the
 * record through its safe queue.
 *
 * @param {RmaAdminWorkflowInput|Record<string, unknown>|null|undefined} input
 * @param {RmaAdminCapabilities|Record<string, unknown>|null|undefined} [capabilities]
 * @returns {RmaAdminWorkflowResult}
 */
export function projectAdminRmaWorkflow(input, capabilities) {
  const state = normalizeWorkflowInput(input, capabilities);
  const safetyIssue = detectWorkflowSafetyIssue(state);
  const workflowQueue = deriveWorkflowQueue(state, safetyIssue);
  const availableActions = safetyIssue
    ? []
    : actionCodes.filter((action) => isWorkflowActionAvailable(action, state, workflowQueue));

  let recommendedAction = recommendAction(state, workflowQueue, availableActions);
  let blockedReason = blockedReasonFor(state, workflowQueue, safetyIssue, availableActions);

  // A recommendation must always be executable and assign is deliberately a
  // manual helper, never a recommendation. The final check also protects
  // future edits from accidentally surfacing a pseudo-action as an RPC action.
  if (
    recommendedAction &&
    recommendedAction !== "choose_inventory_disposition" &&
    !availableActions.includes(recommendedAction)
  ) {
    recommendedAction = null;
  }
  if (recommendedAction) blockedReason = null;

  return {
    workflowQueue,
    availableActions,
    recommendedAction,
    blockedReason,
  };
}

/**
 * Compatibility alias for callers that use a shorter projection name.
 */
export const deriveRmaWorkflow = projectAdminRmaWorkflow;
export const getRmaWorkflow = projectAdminRmaWorkflow;

/**
 * Return the queue only. This is intentionally backed by the same safety
 * projection as `projectAdminRmaWorkflow`.
 *
 * @param {RmaAdminWorkflowInput|Record<string, unknown>|null|undefined} input
 * @returns {RmaWorkflowQueue}
 */
export function deriveRmaQueue(input) {
  const state = normalizeWorkflowInput(input, undefined);
  return deriveWorkflowQueue(state, detectWorkflowSafetyIssue(state));
}

export const getRmaQueue = deriveRmaQueue;

/**
 * Return guarded actions for a snapshot. The optional capability argument is
 * accepted for direct callers; normal callers should use the full projection.
 *
 * @param {RmaAdminWorkflowInput|Record<string, unknown>|null|undefined} input
 * @param {RmaAdminCapabilities|Record<string, unknown>|null|undefined} [capabilities]
 * @returns {RmaWorkflowAction[]}
 */
export function availableRmaActions(input, capabilities) {
  const state = normalizeWorkflowInput(input, capabilities);
  const safetyIssue = detectWorkflowSafetyIssue(state);
  const queue = deriveWorkflowQueue(state, safetyIssue);
  if (safetyIssue) return [];
  return actionCodes.filter((action) => isWorkflowActionAvailable(action, state, queue));
}

export const getAvailableRmaActions = availableRmaActions;

/**
 * Single-action helper retained for action menus and focused tests.
 * Supports both `(action, input, capabilities)` and
 * `({ action, ...input }, capabilities)` call shapes.
 */
export function isRmaWorkflowActionAvailable(actionOrInput, inputOrCapabilities, maybeCapabilities) {
  const objectForm = isRecord(actionOrInput);
  const action = objectForm ? readEnum(actionOrInput.action) : readEnum(actionOrInput);
  const input = objectForm ? actionOrInput : inputOrCapabilities;
  const capabilities = objectForm ? inputOrCapabilities : maybeCapabilities;
  const state = normalizeWorkflowInput(input, capabilities);
  const safetyIssue = detectWorkflowSafetyIssue(state);
  if (safetyIssue || !action || !actionCodes.includes(action)) return false;
  const queue = deriveWorkflowQueue(state, safetyIssue);
  return isWorkflowActionAvailable(action, state, queue);
}

/**
 * Normalize flat repository DTOs and the explicit four-capability contract.
 * Snake-case aliases are read-only compatibility support; no capability is
 * inferred from another capability.
 *
 * @param {RmaAdminWorkflowInput|Record<string, unknown>|null|undefined} input
 * @param {RmaAdminCapabilities|Record<string, unknown>|null|undefined} [capabilities]
 */
export function normalizeRmaWorkflowInput(input, capabilities) {
  return normalizeWorkflowInput(input, capabilities);
}

function normalizeWorkflowInput(input, capabilities) {
  const source = isRecord(input) ? input : {};
  const capabilitySource =
    capabilities === undefined
      ? isRecord(source.capabilities)
        ? source.capabilities
        : source
      : capabilities;

  const quantityRaw = firstDefined(source.quantity);
  const receivedQuantityRaw = firstDefined(
    source.receivedQuantity,
    source.received_quantity,
    nestedValue(source.received, "quantity")
  );
  const resolutionQuantityRaw = firstDefined(
    source.resolutionQuantity,
    source.resolution_quantity,
    source.refundApprovedQuantity,
    source.refund_approved_quantity,
    nestedValue(source.resolution, "quantity")
  );
  const inventoryDispositionQuantityRaw = firstDefined(
    source.inventoryDispositionQuantity,
    source.inventory_disposition_quantity,
    nestedValue(source.inventory, "quantity")
  );
  const receivedAtRaw = firstDefined(source.receivedAt, source.received_at);
  const customerShippedAtRaw = firstDefined(
    source.customerShippedAt,
    source.customer_shipped_at,
    source.shippedAt,
    source.shipped_at
  );
  const qcStatusRaw = firstDefined(
    source.qcStatus,
    source.qc_status,
    nestedValue(source.qc, "status")
  );
  const requestedResolutionRaw = firstDefined(
    source.requestedResolution,
    source.requested_resolution,
    typeof source.resolution === "string" ? source.resolution : undefined
  );
  const resolutionActionRaw = firstDefined(
    source.resolutionAction,
    source.resolution_action,
    nestedValue(source.resolution, "action"),
    nestedValue(source.resolution, "resolutionAction")
  );
  const inventoryDispositionRaw = firstDefined(
    source.inventoryDisposition,
    source.inventory_disposition,
    nestedValue(source.inventory, "disposition")
  );
  const walletRequestStatusRaw = firstDefined(
    source.walletRequestStatus,
    source.walletRefundStatus,
    source.wallet_refund_status,
    nestedValue(source.wallet, "status"),
    nestedValue(source.wallet, "requestStatus")
  );
  const replacementOrderIdRaw = firstDefined(
    source.replacementOrderId,
    source.replacement_order_id,
    nestedValue(source.replacement, "orderId"),
    nestedValue(source.replacement, "id")
  );
  const assignedToRaw = firstDefined(source.assignedTo, source.assigned_to);

  return {
    status: readEnum(source.status),
    quantity: readInteger(quantityRaw),
    receivedQuantity: readInteger(receivedQuantityRaw),
    resolutionQuantity: readInteger(resolutionQuantityRaw),
    inventoryDispositionQuantity: readInteger(inventoryDispositionQuantityRaw),
    receivedAt: readTimestamp(receivedAtRaw),
    customerShippedAt: readTimestamp(customerShippedAtRaw),
    qcStatus: readEnum(qcStatusRaw),
    requestedResolution: readEnum(requestedResolutionRaw),
    resolutionAction: readEnum(resolutionActionRaw),
    inventoryDisposition: readEnum(inventoryDispositionRaw),
    walletRequestStatus: readEnum(walletRequestStatusRaw),
    replacementOrderId: readIdentifier(replacementOrderIdRaw),
    assignedTo: readIdentifier(assignedToRaw),
    capabilities: normalizeCapabilities(capabilitySource),
    hasQuantity: isProvided(quantityRaw),
    hasReceivedQuantity: isProvided(receivedQuantityRaw),
    hasResolutionQuantity: isProvided(resolutionQuantityRaw),
    hasInventoryDispositionQuantity: isProvided(inventoryDispositionQuantityRaw),
    hasReceivedAt: isProvided(receivedAtRaw),
    hasCustomerShippedAt: isProvided(customerShippedAtRaw),
    hasQcStatus: isProvided(qcStatusRaw),
    hasRequestedResolution: isProvided(requestedResolutionRaw),
    hasResolutionAction: isProvided(resolutionActionRaw),
    hasInventoryDisposition: isProvided(inventoryDispositionRaw),
    hasWalletRequestStatus: isProvided(walletRequestStatusRaw),
    hasReplacementOrderId: isProvided(replacementOrderIdRaw),
    hasAssignedTo: isProvided(assignedToRaw),
    invalidReceivedAt: isProvided(receivedAtRaw) && !readTimestamp(receivedAtRaw),
    invalidCustomerShippedAt:
      isProvided(customerShippedAtRaw) && !readTimestamp(customerShippedAtRaw),
    invalidQuantity: isProvided(quantityRaw) && !Number.isInteger(quantityRaw),
    invalidReceivedQuantity:
      isProvided(receivedQuantityRaw) && !Number.isInteger(receivedQuantityRaw),
    invalidResolutionQuantity:
      isProvided(resolutionQuantityRaw) && !Number.isInteger(resolutionQuantityRaw),
    invalidInventoryDispositionQuantity:
      isProvided(inventoryDispositionQuantityRaw) &&
      !Number.isInteger(inventoryDispositionQuantityRaw),
    invalidQcStatus: isProvided(qcStatusRaw) && !validQcStatuses.has(readEnum(qcStatusRaw)),
    invalidInventoryDisposition:
      isProvided(inventoryDispositionRaw) &&
      !validInventoryDispositions.has(readEnum(inventoryDispositionRaw)),
  };
}

function normalizeCapabilities(value) {
  const source = isRecord(value) ? value : {};
  return {
    manage: readBoolean(source, "manage", "canManage"),
    inventory: readBoolean(source, "inventory", "canInventory"),
    refund: readBoolean(source, "refund", "canRefund"),
    adjustStock: readBoolean(source, "adjustStock", "canAdjustStock", "adjust_stock"),
  };
}

function deriveWorkflowQueue(state, safetyIssue) {
  if (state.status === "closed") return "archive";
  if (state.status === "rejected") {
    return hasRejectedReceiptEvidence(state) ? "review" : "archive";
  }
  if (!knownStatuses.has(state.status)) return "review";

  // These are the first safe queues for historical records that have already
  // moved beyond receipt but lack the evidence needed for QC.
  if (
    (state.status === "received" || commercialTerminalStatuses.has(state.status)) &&
    (safetyIssue === "missing_qc_status" || safetyIssue === "waiting_qc")
  ) {
    return "qc";
  }
  if (safetyIssue) return "review";

  if (reviewStatuses.has(state.status)) return "review";
  if (state.status === "approved") {
    return state.customerShippedAt ? "receiving" : "awaiting_return";
  }
  if (state.status === "received") {
    return state.qcStatus === "pending" ? "qc" : "resolution";
  }
  if (state.status === "return_in_transit") {
    return state.customerShippedAt ? "receiving" : "awaiting_return";
  }
  if (commercialTerminalStatuses.has(state.status)) return "inventory_close";
  return "review";
}

function detectWorkflowSafetyIssue(state) {
  if (!knownStatuses.has(state.status)) return "invalid_state";
  if (state.status === "closed") return null;
  if (state.status === "rejected") {
    if (state.invalidReceivedAt || hasRejectedReceiptEvidence(state)) return "invalid_state";
    return null;
  }

  if (
    state.invalidCustomerShippedAt ||
    state.invalidReceivedAt ||
    state.invalidQuantity ||
    state.invalidReceivedQuantity ||
    state.invalidResolutionQuantity ||
    state.invalidInventoryDispositionQuantity ||
    state.invalidQcStatus ||
    state.invalidInventoryDisposition
  ) {
    return "invalid_state";
  }
  if (state.quantity === null || state.quantity < 1) return "invalid_state";

  for (const value of [
    state.receivedQuantity,
    state.resolutionQuantity,
    state.inventoryDispositionQuantity,
  ]) {
    if (value !== null && (value < 0 || value > state.quantity)) return "invalid_state";
  }

  if (state.status === "approved") {
    if (state.receivedAt || state.receivedQuantity !== null) return "invalid_state";
    return null;
  }

  if (state.status === "received" || commercialTerminalStatuses.has(state.status)) {
    if (!state.receivedAt) return "missing_received_at";
    if (state.receivedQuantity === null) return "missing_received_quantity";
    if (state.receivedQuantity !== state.quantity) return "partial_received_quantity";
  }

  if (state.status === "received") {
    if (!state.hasQcStatus) return "missing_qc_status";
    if (state.qcStatus === "pending" || completedQcStatuses.has(state.qcStatus)) return null;
    return "invalid_state";
  }

  if (commercialTerminalStatuses.has(state.status)) {
    if (!state.hasQcStatus) return "missing_qc_status";
    if (state.qcStatus === "pending") return "waiting_qc";
    if (!completedQcStatuses.has(state.qcStatus)) return "invalid_state";

    if (state.status === "refunded") {
      if (
        state.resolutionAction !== "refund_wallet" ||
        state.walletRequestStatus !== "approved" ||
        state.replacementOrderId
      ) {
        return "invalid_state";
      }
    } else if (
      state.resolutionAction !== "replacement" ||
      !state.replacementOrderId ||
      state.walletRequestStatus
    ) {
      return "missing_replacement_order";
    }

    if (state.resolutionQuantity === null) return "missing_resolution_quantity";
    if (state.resolutionQuantity !== state.quantity) return "partial_resolution_quantity";

    if (
      inventoryTerminalDispositions.has(state.inventoryDisposition ?? "") &&
      state.inventoryDispositionQuantity === null
    ) {
      return "missing_inventory_quantity";
    }
    if (
      inventoryTerminalDispositions.has(state.inventoryDisposition ?? "") &&
      state.inventoryDispositionQuantity !== state.quantity
    ) {
      return "partial_inventory_disposition_quantity";
    }
  }

  return null;
}

/**
 * Public compatibility helper for callers that need the stable blocked code.
 *
 * @param {RmaAdminWorkflowInput|Record<string, unknown>|null|undefined} input
 * @returns {string|null}
 */
export function detectRmaWorkflowAnomaly(input) {
  const state = normalizeWorkflowInput(input, undefined);
  return detectWorkflowSafetyIssue(state);
}

function isWorkflowActionAvailable(action, state, queue) {
  const { capabilities } = state;

  if (action === "assign") {
    return (
      !archiveStatuses.has(state.status) &&
      !state.hasAssignedTo &&
      capabilities.manage &&
      sharedActionGuard(action, state)
    );
  }

  if (action === "start_review") {
    return state.status === "submitted" && capabilities.manage;
  }
  if (action === "approve" || action === "reject") {
    return state.status === "under_review" && capabilities.manage;
  }

  switch (action) {
    case "mark_received":
      return (
        queue === "receiving" &&
        state.status === "approved" &&
        Boolean(state.customerShippedAt) &&
        capabilities.inventory &&
        sharedActionGuard(action, state)
      );
    case "record_qc":
      return (
        queue === "qc" &&
        state.qcStatus === "pending" &&
        (capabilities.manage || capabilities.inventory) &&
        sharedActionGuard(action, state)
      );
    case "request_wallet_refund":
      return (
        queue === "resolution" &&
        refundWasRequested(state.requestedResolution) &&
        capabilities.refund &&
        state.walletRequestStatus !== "pending" &&
        sharedActionGuard(action, state)
      );
    case "mark_replacement_sent":
      return (
        queue === "resolution" &&
        state.requestedResolution === "replacement" &&
        capabilities.manage &&
        !state.replacementOrderId &&
        !state.walletRequestStatus &&
        sharedActionGuard(action, state)
      );
    case "restock_return":
      return (
        queue === "inventory_close" &&
        state.inventoryDisposition === "quarantine" &&
        capabilities.inventory &&
        capabilities.adjustStock &&
        sharedActionGuard(action, state)
      );
    case "mark_scrapped":
    case "supplier_return":
      return (
        queue === "inventory_close" &&
        state.inventoryDisposition === "quarantine" &&
        capabilities.inventory &&
        sharedActionGuard(action, state)
      );
    case "close":
      return (
        (queue === "inventory_close" ||
          (queue === "archive" && state.status === "rejected")) &&
        capabilities.manage &&
        sharedActionGuard(action, state)
      );
    default:
      return false;
  }
}

function sharedActionGuard(action, state) {
  return isRmaActionAvailable({
    action,
    quantity: state.quantity,
    receivedQuantity: state.receivedQuantity,
    resolutionQuantity: state.resolutionQuantity,
    inventoryDispositionQuantity: state.inventoryDispositionQuantity,
    inventoryDisposition: state.inventoryDisposition ?? "pending",
    qcStatus: state.qcStatus ?? "pending",
    requestedResolution: state.requestedResolution,
    resolutionAction: state.resolutionAction,
    walletRequestStatus: state.walletRequestStatus,
    replacementOrderId: state.replacementOrderId,
    status: state.status,
    receivedAt: state.receivedAt,
  });
}

function recommendAction(state, queue, availableActions) {
  if (queue === "review" || queue === "archive") {
    if (state.status === "submitted" && availableActions.includes("start_review")) {
      return "start_review";
    }
    if (state.status === "under_review" && availableActions.includes("approve")) {
      return "approve";
    }
    if (state.status === "rejected" && availableActions.includes("close")) {
      return "close";
    }
    return null;
  }
  if (queue === "receiving" && availableActions.includes("mark_received")) {
    return "mark_received";
  }
  if (queue === "qc" && availableActions.includes("record_qc")) {
    return "record_qc";
  }
  if (queue === "resolution") {
    if (state.walletRequestStatus === "pending") return null;
    if (availableActions.includes("mark_replacement_sent")) return "mark_replacement_sent";
    if (availableActions.includes("request_wallet_refund")) return "request_wallet_refund";
    return null;
  }
  if (queue === "inventory_close") {
    if (
      state.capabilities.inventory &&
      (state.inventoryDisposition === "quarantine" ||
        state.inventoryDisposition === "pending" ||
        state.inventoryDisposition === null)
    ) {
      return "choose_inventory_disposition";
    }
    if (availableActions.includes("close")) return "close";
  }
  return null;
}

function blockedReasonFor(state, queue, safetyIssue, availableActions) {
  if (safetyIssue) return safetyIssue;
  if (queue === "archive") {
    return state.status === "rejected" && !availableActions.includes("close")
      ? "permission_denied"
      : null;
  }
  if (queue === "awaiting_return") return "waiting_customer_return";
  if (queue === "receiving" && !availableActions.includes("mark_received")) {
    return "permission_denied";
  }
  if (queue === "qc" && !availableActions.includes("record_qc")) {
    return state.qcStatus === "pending" ? "permission_denied" : "waiting_qc";
  }
  if (queue === "resolution") {
    if (state.walletRequestStatus === "pending") return "waiting_wallet_approval";
    if (!state.requestedResolution) return "missing_requested_resolution";
    if (!availableActions.includes("request_wallet_refund") &&
        !availableActions.includes("mark_replacement_sent")) {
      return "permission_denied";
    }
  }
  if (queue === "inventory_close") {
    if (
      state.inventoryDisposition === "quarantine" ||
      state.inventoryDisposition === "pending" ||
      state.inventoryDisposition === null
    ) {
      return state.capabilities.inventory
        ? null
        : "permission_denied";
    }
    if (!availableActions.includes("close")) {
      return state.inventoryDispositionQuantity === null
        ? "missing_inventory_quantity"
        : state.inventoryDispositionQuantity !== state.quantity
          ? "partial_inventory_disposition_quantity"
          : "permission_denied";
    }
  }
  if (queue === "review" && availableActions.length === 0) return "permission_denied";
  return null;
}

function refundWasRequested(value) {
  return value === "refund" || value === "wallet_credit" || value === "refund_wallet";
}

function hasRejectedReceiptEvidence(state) {
  return Boolean(state.receivedAt) ||
    (Number.isInteger(state.receivedQuantity) && state.receivedQuantity > 0);
}

function nestedValue(value, key) {
  return isRecord(value) ? value[key] : undefined;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isProvided(value) {
  return value !== undefined && value !== null &&
    (typeof value !== "string" || value.trim() !== "");
}

function readEnum(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function readIdentifier(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function readInteger(value) {
  return Number.isInteger(value) ? value : null;
}

function readTimestamp(value) {
  const text = readIdentifier(value);
  if (!text || Number.isNaN(Date.parse(text))) return null;
  return text;
}

function readBoolean(source, ...keys) {
  for (const key of keys) {
    if (typeof source[key] === "boolean") return source[key];
  }
  return false;
}
