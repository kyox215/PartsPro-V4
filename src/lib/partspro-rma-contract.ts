import { z } from "zod";
import {
  calculateRmaLineRefundCap as calculateRmaLineRefundCapRule,
  isCommercialOutcomeAvailable as isCommercialOutcomeAvailableRule,
  isRmaActionAvailable as isRmaActionAvailableRule,
  reasonRequiresImage as reasonRequiresImageRule,
} from "@/lib/partspro-rma-rules.mjs";
import {
  rmaAttachmentContentTypes as sharedRmaAttachmentContentTypes,
  rmaMaxAttachments as sharedRmaMaxAttachments,
  rmaMaxAttachmentBytes as sharedRmaMaxAttachmentBytes,
} from "@/lib/partspro-rma-upload-client.mjs";

/**
 * Public RMA contract. Keep this file free of repository/database fields so it
 * can be shared by route handlers and a future mobile client without exposing
 * staff notes, storage paths, or inventory internals.
 */
export const rmaReasonCodes = [
  "quality_defect",
  "shipping_damage",
  "not_as_described",
  "wrong_item",
  "missing_or_quantity_error",
  "withdrawal_no_longer_needed",
] as const;

export type RmaReasonCode = (typeof rmaReasonCodes)[number];

export const rmaPolicyScopeCodes = [
  "legacy_unverified",
  "statutory_b2c_withdrawal",
  // Keep the historical spelling readable while policy data migrates.
  "b2c_statutory_withdrawal",
  "b2c_warranty",
  "b2b_commercial",
] as const;

export type RmaPolicyScope = (typeof rmaPolicyScopeCodes)[number];
export const rmaCanonicalPolicyScope = "b2b_commercial" as const;
export const rmaCanonicalPolicyVersion = "partspro-b2b-v1" as const;

export const rmaResolutionCodes = [
  "replacement",
  "refund",
  "wallet_credit",
] as const;

export type RmaResolutionCode = (typeof rmaResolutionCodes)[number];

export const rmaAttachmentContentTypes = sharedRmaAttachmentContentTypes;

export type RmaAttachmentContentType = (typeof rmaAttachmentContentTypes)[number];

export const rmaCustomerStageCodes = [
  "submitted",
  "under_review",
  "return_in_transit",
  "resolution",
  "completed",
] as const;

export type RmaCustomerStage = (typeof rmaCustomerStageCodes)[number];

// Shared upload policy remains: rmaMaxAttachments = 6; rmaMaxAttachmentBytes = 4 * 1024 * 1024.
export const rmaMaxAttachments = sharedRmaMaxAttachments;
export const rmaMaxAttachmentBytes = sharedRmaMaxAttachmentBytes;

const uuid = z.string().uuid();

export const rmaDraftCreateSchema = z
  .object({
    orderLineId: uuid,
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict();

export const rmaUploadTicketSchema = z
  .object({
    originalName: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .refine((value) => !/[\\/]/.test(value), "File name cannot contain a path."),
    contentType: z.enum(rmaAttachmentContentTypes),
    sizeBytes: z.number().int().positive().max(rmaMaxAttachmentBytes),
  })
  .strict();

export const rmaCompleteAttachmentSchema = z
  .object({
    sha256: z.string().trim().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();

/**
 * New submissions accept only opaque IDs. Order ID, SKU, bucket, path and
 * signed URLs are deliberately absent from this schema.
 */
export const rmaCustomerSubmitSchema = z
  .object({
    orderLineId: uuid,
    quantity: z.number().int().min(1).max(100000),
    // A statutory B2C withdrawal can be submitted without a reason. The
    // server resolves policy_scope from the draft and rejects empty reasons
    // for legacy/warranty/B2B requests.
    reasonCode: z.enum(rmaReasonCodes).optional(),
    requestedResolution: z.enum(rmaResolutionCodes),
    note: z.string().trim().max(2000).optional(),
    attachmentIds: z
      .array(uuid)
      .max(rmaMaxAttachments)
      .refine((values) => new Set(values).size === values.length, "Attachment IDs must be unique."),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    draftId: uuid,
  })
  .strict();

export type RmaCustomerSubmitInput = z.infer<typeof rmaCustomerSubmitSchema>;
export const rmaCustomerShippedSchema = z
  .object({
    carrier: z.string().trim().max(120).optional(),
    tracking: z.string().trim().max(160).optional(),
  })
  .strict();

export type RmaCustomerShippedInput = z.infer<typeof rmaCustomerShippedSchema>;
export type RmaDraftCreateInput = z.infer<typeof rmaDraftCreateSchema>;
export type RmaUploadTicketInput = z.infer<typeof rmaUploadTicketSchema>;
export type RmaCompleteAttachmentInput = z.infer<typeof rmaCompleteAttachmentSchema>;

export const adminRmaActionSchema = z
  .object({
    action: z.enum([
      "start_review",
      "approve",
      "reject",
      "assign",
      "request_wallet_refund",
      "mark_received",
      "record_qc",
      "restock_return",
      "mark_scrapped",
      "supplier_return",
      "mark_replacement_sent",
      "close",
    ]),
    assignedTo: uuid.nullable().optional(),
    batchCode: z.string().trim().max(120).optional(),
    customerVisibleNote: z.string().trim().max(1000).optional(),
    internalNote: z.string().trim().max(1000).optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    location: z.string().trim().max(120).optional(),
    quantity: z.number().int().min(1).max(100000).optional(),
    qcNote: z.string().trim().max(1000).optional(),
    qcStatus: z.enum(["passed", "failed", "not_required"]).optional(),
    reason: z.string().trim().max(1000).optional(),
    refundAmount: z.number().positive().max(999999).optional(),
    replacementOrderId: uuid.optional(),
    supplier: z.string().trim().max(160).optional(),
    warehouse: z.literal("Milano").optional(),
  })
  .strict();

export type AdminRmaActionInput = z.infer<typeof adminRmaActionSchema>;

export type RmaUploadTicketDto = {
  attachmentId: string;
  expiresAt: string;
  uploadUrl: string;
};

export type RmaDraftDto = {
  attachmentCount: number;
  createdAt: string;
  id: string;
  orderLineId: string;
  policyScope: RmaPolicyScope;
  status: "open" | "submitted" | "abandoned" | "expired";
};

export type CustomerRmaAttachmentDto = {
  attachmentId: string;
  contentType: RmaAttachmentContentType;
  name: string;
  sizeBytes: number;
  uploadedAt: string | null;
  verifiedAt: string | null;
  signedUrl?: string;
};

export type CustomerRmaDto = {
  attachments: CustomerRmaAttachmentDto[];
  createdAt: string;
  customerShippedAt: string | null;
  customerStage: RmaCustomerStage;
  description: string;
  eligibleUntil: string | null;
  events: Array<{
    createdAt: string;
    eventType: string;
    id: string;
    note?: string;
    toStatus?: string | null;
  }>;
  id: string;
  orderId: string | null;
  /** Customer-visible order number; never use the internal order UUID in UI. */
  orderNumber: string | null;
  policyScope: string;
  productName: string;
  quantity: number;
  /** Legacy storefront alias; safe customer-visible reason code only. */
  reason: string;
  reasonCode: string;
  rmaNo: string | null;
  resolution: string;
  requestedResolution: string;
  sku: string;
  status: string;
  updatedAt: string | null;
  carrier?: string;
  tracking?: string;
  canMarkShipped: boolean;
  customerVisibleNote?: string;
};

export function reasonRequiresImage(
  reasonCode: RmaReasonCode | null | undefined,
  policyScope: RmaPolicyScope = "legacy_unverified"
) {
  return reasonRequiresImageRule(reasonCode, policyScope);
}

export type RmaCommercialOutcome = "refund_wallet" | "replacement";
export type RmaQcStatus = "pending" | "passed" | "failed" | "not_required";

export type RmaActionAvailabilityInput = {
  action: string;
  inventoryDisposition?: string | null;
  qcStatus?: RmaQcStatus | string | null;
  requestedResolution?: string | null;
  resolutionAction?: string | null;
  walletRequestStatus?: string | null;
  replacementOrderId?: string | null;
  status: string;
  quantity?: number | null;
  receivedQuantity?: number | null;
  resolutionQuantity?: number | null;
  inventoryDispositionQuantity?: number | null;
  receivedAt?: string | null;
};

/** Pure action guard shared by contract tests and future queue clients. */
export function isRmaActionAvailable({
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
}: RmaActionAvailabilityInput) {
  return isRmaActionAvailableRule({
    action,
    quantity,
    receivedQuantity,
    resolutionQuantity,
    inventoryDispositionQuantity,
    inventoryDisposition,
    qcStatus,
    requestedResolution,
    resolutionAction,
    walletRequestStatus,
    replacementOrderId,
    status,
    receivedAt,
  });
}

export function isCommercialOutcomeAvailable(input: {
  action: string;
  resolutionAction?: string | null;
  walletRequestStatus?: string | null;
  replacementOrderId?: string | null;
  status: string;
}) {
  return isCommercialOutcomeAvailableRule(input);
}

/**
 * Refund cap is deliberately line-scoped: the immutable unit-price snapshot
 * times the approved quantity, less already-refunded RMA amounts, then the
 * order-level wallet balance. No tax/shipping is inferred here.
 */
export function calculateRmaLineRefundCap({
  existingRmaRefunds,
  orderRefundableBalance,
  approvedQuantity,
  orderLineEligibleQuantity,
  unitPriceSnapshot,
}: {
  existingRmaRefunds: number;
  orderRefundableBalance: number;
  approvedQuantity: number;
  orderLineEligibleQuantity: number;
  unitPriceSnapshot: number;
}) {
  return calculateRmaLineRefundCapRule({
    existingRmaRefunds,
    orderRefundableBalance,
    approvedQuantity,
    orderLineEligibleQuantity,
    unitPriceSnapshot,
  });
}

export function customerStageForRmaStatus(status: string): RmaCustomerStage {
  switch (status) {
    case "return_in_transit":
      return "return_in_transit";
    case "under_review":
    case "approved":
      return "under_review";
    case "received":
      return "resolution";
    case "replacement_sent":
    case "replaced":
    case "refunded":
    case "closed":
      return "completed";
    default:
      return "submitted";
  }
}

export function isLegacyRmaPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const keys = Object.keys(value);
  return [
    "orderId",
    "sku",
    "reason",
    "description",
    "attachments",
    "hasPhysicalDamage",
    "installed",
    "testedBeforeInstall",
  ].some((key) => keys.includes(key));
}
