import { z } from "zod";

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

export const rmaResolutionCodes = [
  "replacement",
  "refund",
  "wallet_credit",
] as const;

export type RmaResolutionCode = (typeof rmaResolutionCodes)[number];

export const rmaAttachmentContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type RmaAttachmentContentType = (typeof rmaAttachmentContentTypes)[number];

export const rmaCustomerStageCodes = [
  "submitted",
  "under_review",
  "return_in_transit",
  "resolution",
  "completed",
] as const;

export type RmaCustomerStage = (typeof rmaCustomerStageCodes)[number];

export const rmaMaxAttachments = 6;
export const rmaMaxAttachmentBytes = 4 * 1024 * 1024;

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
    reasonCode: z.enum(rmaReasonCodes),
    requestedResolution: z.enum(rmaResolutionCodes),
    note: z.string().trim().max(2000).optional(),
    attachmentIds: z
      .array(uuid)
      .max(rmaMaxAttachments)
      .refine((values) => new Set(values).size === values.length, "Attachment IDs must be unique."),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
    draftId: uuid.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.draftId || value.idempotencyKey), {
    path: ["draftId"],
    message: "draftId or idempotencyKey is required.",
  });

export type RmaCustomerSubmitInput = z.infer<typeof rmaCustomerSubmitSchema>;
export type RmaDraftCreateInput = z.infer<typeof rmaDraftCreateSchema>;
export type RmaUploadTicketInput = z.infer<typeof rmaUploadTicketSchema>;
export type RmaCompleteAttachmentInput = z.infer<typeof rmaCompleteAttachmentSchema>;

export const adminRmaActionSchema = z
  .object({
    action: z.enum([
      "assign",
      "request_wallet_refund",
      "mark_received",
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
    quantity: z.number().int().min(1).max(100000).optional(),
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
  policyScope: "legacy_unverified";
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
  orderLineId: string | null;
  policyScope: string;
  productName: string;
  quantity: number;
  reasonCode: string;
  rmaNo: string | null;
  resolution: string;
  requestedResolution: string;
  sku: string;
  status: string;
  updatedAt: string | null;
  customerVisibleNote?: string;
  labResult?: string;
  refundAmount?: number;
  resolutionNote?: string;
};

export function reasonRequiresImage(reasonCode: RmaReasonCode) {
  return reasonCode !== "withdrawal_no_longer_needed";
}

export function customerStageForRmaStatus(status: string): RmaCustomerStage {
  switch (status) {
    case "under_review":
    case "approved":
      return "under_review";
    case "received":
      return "resolution";
    case "replacement_sent":
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
