import { z } from "zod";

const MAX_MONEY_EUR = 1_000_000_000;
const chargeTypeSchema = z.enum(["transport", "insurance", "customs", "handling", "other"]);
const vatTreatmentSchema = z.enum(["recoverable", "non_recoverable", "unknown"]);
const allocationMethodSchema = z.enum(["goods_value", "received_qty", "weight", "manual"]);
const nullableTextSchema = (max) => z.string().trim().max(max).nullable().optional();
const evidenceUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^(?:https?):\/\/\S+$/i.test(value), {
    message: "EVIDENCE_URL_HTTP_REQUIRED",
  })
  .url();
const canonicalUuidSchema = z
  .string()
  .trim()
  .uuid()
  .refine((value) => value === value.toLowerCase(), {
    message: "UUID must use canonical lowercase form.",
  });
const moneySchema = z
  .number()
  .finite()
  .nonnegative()
  .max(MAX_MONEY_EUR)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    message: "Money values must have at most two decimal places.",
  });
const manualAllocationSchema = z
  .object({ amount: moneySchema, batchLineId: canonicalUuidSchema })
  .strict();

function refineBaseCharge(value, context) {
  const gross = value.amountNet + value.vatAmount;
  if (value.capitalizedAmount > gross + 1e-8) {
    context.addIssue({ code: "custom", path: ["capitalizedAmount"], message: "CAPITALIZED_AMOUNT_EXCEEDS_GROSS" });
  }
  if (value.capitalizedAmount === 0 && !value.zeroCostReason?.trim()) {
    context.addIssue({ code: "custom", path: ["zeroCostReason"], message: "ZERO_COST_REASON_REQUIRED" });
  }

  const rows = value.manualAllocations;
  if (value.allocationMethod !== "manual") {
    if (rows !== undefined) {
      context.addIssue({ code: "custom", path: ["manualAllocations"], message: "MANUAL_ALLOCATIONS_ONLY_FOR_MANUAL" });
    }
    return;
  }
  if (rows === undefined) {
    if (!value.chargeId) {
      context.addIssue({ code: "custom", path: ["manualAllocations"], message: "MANUAL_ALLOCATIONS_REQUIRED" });
    }
    return;
  }

  const ids = new Set();
  let totalCents = 0;
  for (const row of rows) {
    const id = row.batchLineId.toLowerCase();
    if (ids.has(id)) {
      context.addIssue({ code: "custom", path: ["manualAllocations"], message: "MANUAL_ALLOCATIONS_IDS_MUST_BE_UNIQUE" });
    }
    ids.add(id);
    totalCents += Math.round(row.amount * 100);
  }
  if (totalCents !== Math.round(value.capitalizedAmount * 100)) {
    context.addIssue({ code: "custom", path: ["manualAllocations"], message: "MANUAL_ALLOCATIONS_SUM_MUST_EQUAL_CAPITALIZED" });
  }
}

function baseChargeObject() {
  return z
    .object({
      allocationMethod: allocationMethodSchema,
      amountNet: moneySchema,
      capitalizedAmount: moneySchema,
      carrierName: nullableTextSchema(200),
      chargeId: canonicalUuidSchema.optional(),
      chargeType: chargeTypeSchema,
      currency: z.literal("EUR"),
      evidenceUrl: evidenceUrlSchema.nullable().optional(),
      idempotencyKey: z.string().trim().min(8).max(200).optional(),
      manualAllocations: z.array(manualAllocationSchema).max(500).optional(),
      notes: nullableTextSchema(2000),
      occurredAt: z.string().trim().max(80).datetime().nullable().optional(),
      reference: nullableTextSchema(200),
      vatAmount: moneySchema,
      vatTreatment: vatTreatmentSchema,
      zeroCostReason: nullableTextSchema(500),
    })
    .strict()
    .superRefine(refineBaseCharge);
}

export const supplierBatchChargePreviewSchema = baseChargeObject();
export const supplierBatchChargeEstimateSchema = baseChargeObject().and(
  z.object({ idempotencyKey: z.string().trim().min(8).max(200) }).strict()
);
export const supplierBatchChargeConfirmSchema = baseChargeObject()
  .and(
    z.object({
      idempotencyKey: z.string().trim().min(8).max(200),
      revision: z.string().trim().min(1).max(256),
    }).strict()
  )
  .superRefine((value, context) => {
    if (value.vatTreatment === "unknown") {
      context.addIssue({ code: "custom", path: ["vatTreatment"], message: "UNKNOWN_VAT_NOT_ALLOWED_ON_CONFIRM" });
    }
  });

// V2 keeps the legacy EUR schema above intact for old callers while exposing
// an explicit original-currency/immutable-FX contract for new API routes.
const supplierBatchCurrencySchema = z.enum(["EUR", "USD", "CNY"]);
const fxRateSchema = z
  .number()
  .finite()
  .min(0.000001)
  .max(1_000_000)
  .refine((value) => {
    const text = String(value);
    if (/[eE]/.test(text)) {
      return false;
    }
    return (text.split(".")[1] ?? "").length <= 12;
  }, {
    message: "FX rates must have at most twelve decimal places.",
  });
const fxDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const fxSourceSchema = z.string().trim().min(1).max(200);
const optionalFxEvidenceUrlSchema = evidenceUrlSchema.optional();

function refineV2FxContract(value, context) {
  const hasRate = value.fxRateToEur !== undefined;
  const hasDate = value.fxRateDate !== undefined;
  const hasSource = value.fxRateSource !== undefined;
  const hasEvidence = value.fxEvidenceUrl !== undefined;
  if (value.currency === "EUR") {
    if ((hasRate || hasDate || hasSource || hasEvidence) && (!hasRate || !hasDate || !hasSource)) {
      context.addIssue({
        code: "custom",
        path: ["fxRateToEur"],
        message: "EUR_FX_SNAPSHOT_INCOMPLETE",
      });
    }
    if (hasRate && Math.abs(value.fxRateToEur - 1) > 1e-12) {
      context.addIssue({ code: "custom", path: ["fxRateToEur"], message: "EUR_FX_RATE_MUST_BE_ONE" });
    }
    return;
  }
  if (!hasRate || !hasDate || !hasSource) {
    context.addIssue({ code: "custom", path: ["fxRateToEur"], message: "NON_EUR_FX_SNAPSHOT_REQUIRED" });
  }
  if (hasEvidence && value.fxEvidenceUrl === null) {
    context.addIssue({ code: "custom", path: ["fxEvidenceUrl"], message: "FX_EVIDENCE_URL_REQUIRED_OR_OMIT" });
  }
}

function refineV2BatchValuationFx(value, context) {
  const hasRate = value.batchGoodsValueFxRateToEur !== undefined;
  const hasDate = value.batchGoodsValueFxDate !== undefined;
  const hasSource = value.batchGoodsValueFxSource !== undefined;
  const hasEvidence = value.batchGoodsValueFxEvidenceUrl !== undefined;
  if ((hasRate || hasDate || hasSource || hasEvidence) && (!hasRate || !hasDate || !hasSource)) {
    context.addIssue({ code: "custom", path: ["batchGoodsValueFxRateToEur"], message: "BATCH_FX_SNAPSHOT_INCOMPLETE" });
  }
  if (value.batchGoodsValueFxEvidenceUrl === null) {
    context.addIssue({ code: "custom", path: ["batchGoodsValueFxEvidenceUrl"], message: "BATCH_FX_EVIDENCE_URL_REQUIRED_OR_OMIT" });
  }
}

function baseV2ChargeObject() {
  return z
    .object({
      allocationMethod: allocationMethodSchema,
      amountNet: moneySchema,
      capitalizedAmount: moneySchema,
      carrierName: nullableTextSchema(200),
      chargeId: canonicalUuidSchema.optional(),
      chargeType: chargeTypeSchema,
      currency: supplierBatchCurrencySchema,
      evidenceUrl: evidenceUrlSchema.nullable().optional(),
      fxEvidenceUrl: optionalFxEvidenceUrlSchema,
      fxRateDate: fxDateSchema.optional(),
      fxRateSource: fxSourceSchema.optional(),
      fxRateToEur: fxRateSchema.optional(),
      idempotencyKey: z.string().trim().min(8).max(200).optional(),
      manualAllocations: z.array(manualAllocationSchema).max(500).optional(),
      notes: nullableTextSchema(2000),
      occurredAt: z.string().trim().max(80).datetime().nullable().optional(),
      reference: nullableTextSchema(200),
      vatAmount: moneySchema,
      vatTreatment: vatTreatmentSchema,
      zeroCostReason: nullableTextSchema(500),
      batchGoodsValueFxRateToEur: fxRateSchema.optional(),
      batchGoodsValueFxDate: fxDateSchema.optional(),
      batchGoodsValueFxSource: fxSourceSchema.optional(),
      batchGoodsValueFxEvidenceUrl: optionalFxEvidenceUrlSchema,
    })
    .strict()
    .superRefine((value, context) => {
      refineBaseCharge(value, context);
      refineV2FxContract(value, context);
      refineV2BatchValuationFx(value, context);
    });
}

export const supplierBatchChargeV2PreviewSchema = baseV2ChargeObject();
export const supplierBatchChargeV2EstimateSchema = baseV2ChargeObject().and(
  z.object({ idempotencyKey: z.string().trim().min(8).max(200) }).strict()
);
export const supplierBatchChargeV2ConfirmSchema = baseV2ChargeObject()
  .and(
    z.object({
      idempotencyKey: z.string().trim().min(8).max(200),
      revision: z.string().trim().min(1).max(256),
      previewFingerprint: z.string().trim().min(16).max(256),
    }).strict()
  )
  .superRefine((value, context) => {
    if (value.vatTreatment === "unknown") {
      context.addIssue({ code: "custom", path: ["vatTreatment"], message: "UNKNOWN_VAT_NOT_ALLOWED_ON_CONFIRM" });
    }
  });
export const supplierBatchChargeV2CancelSchema = z.object({
  chargeId: canonicalUuidSchema,
  reason: z.string().trim().min(1).max(1000),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();
export const supplierBatchChargeV2CorrectSchema = baseV2ChargeObject()
  .and(
    z.object({
      chargeId: canonicalUuidSchema,
      correctionReason: z.string().trim().min(1).max(1000),
      idempotencyKey: z.string().trim().min(8).max(200),
      revision: z.string().trim().min(1).max(256),
      previewFingerprint: z.string().trim().min(16).max(256),
    }).strict()
  );
