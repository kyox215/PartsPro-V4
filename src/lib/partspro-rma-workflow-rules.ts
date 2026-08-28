import {
  projectAdminRmaWorkflow as projectAdminRmaWorkflowRule,
} from "./partspro-rma-workflow-rules.mjs";

export const rmaWorkflowQueueCodes = [
  "review",
  "awaiting_return",
  "receiving",
  "qc",
  "resolution",
  "inventory_close",
  "archive",
] as const;

export const rmaWorkflowQueues = rmaWorkflowQueueCodes;

export type RmaWorkflowQueue = (typeof rmaWorkflowQueueCodes)[number];

export const rmaWorkflowActionCodes = [
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
] as const;

export const rmaWorkflowActions = rmaWorkflowActionCodes;

export type RmaWorkflowAction = (typeof rmaWorkflowActionCodes)[number];
export type RmaWorkflowRecommendation =
  | RmaWorkflowAction
  | "choose_inventory_disposition";

export type RmaWorkflowBlockedReason =
  | "waiting_customer_return"
  | "waiting_wallet_approval"
  | "waiting_qc"
  | "missing_requested_resolution"
  | "missing_received_at"
  | "missing_received_quantity"
  | "partial_received_quantity"
  | "missing_qc_status"
  | "missing_resolution_quantity"
  | "partial_resolution_quantity"
  | "missing_inventory_disposition"
  | "missing_inventory_quantity"
  | "partial_inventory_disposition_quantity"
  | "missing_replacement_order"
  | "permission_denied"
  | "invalid_state";

export type RmaAdminCapabilities = {
  manage: boolean;
  inventory: boolean;
  refund: boolean;
  adjustStock: boolean;
};

export type RmaAdminWorkflowInput = {
  status: string;
  quantity?: number | null;
  receivedQuantity?: number | null;
  resolutionQuantity?: number | null;
  inventoryDispositionQuantity?: number | null;
  receivedAt?: string | null;
  customerShippedAt?: string | null;
  qcStatus?: string | null;
  requestedResolution?: string | null;
  resolutionAction?: string | null;
  inventoryDisposition?: string | null;
  walletRequestStatus?: string | null;
  walletRefundStatus?: string | null;
  replacementOrderId?: string | null;
  assignedTo?: string | null;
  capabilities?: RmaAdminCapabilities;
  received_at?: string | null;
  customer_shipped_at?: string | null;
  received_quantity?: number | null;
  resolution_quantity?: number | null;
  inventory_disposition_quantity?: number | null;
  qc_status?: string | null;
  requested_resolution?: string | null;
  resolution_action?: string | null;
  inventory_disposition?: string | null;
  wallet_refund_status?: string | null;
  replacement_order_id?: string | null;
  assigned_to?: string | null;
};

export type RmaAdminWorkflowResult = {
  workflowQueue: RmaWorkflowQueue;
  availableActions: RmaWorkflowAction[];
  recommendedAction: RmaWorkflowRecommendation | null;
  blockedReason: RmaWorkflowBlockedReason | null;
};

/** Strict TypeScript boundary; queue/action decisions stay in the MJS rule. */
export function projectAdminRmaWorkflow(
  input: RmaAdminWorkflowInput,
  capabilities: RmaAdminCapabilities
): RmaAdminWorkflowResult {
  return projectAdminRmaWorkflowRule(input, capabilities) as RmaAdminWorkflowResult;
}
