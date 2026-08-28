import type { z } from "zod";

export type SupplierBatchChargePreviewInput = {
  allocationMethod: "goods_value" | "received_qty" | "weight" | "manual";
  amountNet: number;
  capitalizedAmount: number;
  carrierName?: string | null;
  chargeId?: string;
  chargeType: "transport" | "insurance" | "customs" | "handling" | "other";
  currency: "EUR";
  evidenceUrl?: string | null;
  idempotencyKey?: string;
  manualAllocations?: Array<{ amount: number; batchLineId: string }>;
  notes?: string | null;
  occurredAt?: string | null;
  reference?: string | null;
  vatAmount: number;
  vatTreatment: "recoverable" | "non_recoverable" | "unknown";
  zeroCostReason?: string | null;
};
export type SupplierBatchChargeEstimateInput = SupplierBatchChargePreviewInput & {
  idempotencyKey: string;
};
export type SupplierBatchChargeConfirmInput = SupplierBatchChargePreviewInput & {
  idempotencyKey: string;
  revision: string;
};

export type SupplierBatchCurrency = "EUR" | "USD" | "CNY";
export type SupplierBatchChargeV2PreviewInput = Omit<
  SupplierBatchChargePreviewInput,
  "currency"
> & {
  currency: SupplierBatchCurrency;
  fxRateToEur?: number;
  fxRateDate?: string;
  fxRateSource?: string;
  fxEvidenceUrl?: string;
  batchGoodsValueFxRateToEur?: number;
  batchGoodsValueFxDate?: string;
  batchGoodsValueFxSource?: string;
  batchGoodsValueFxEvidenceUrl?: string;
};
export type SupplierBatchChargeV2EstimateInput = SupplierBatchChargeV2PreviewInput & {
  idempotencyKey: string;
};
export type SupplierBatchChargeV2ConfirmInput = SupplierBatchChargeV2PreviewInput & {
  idempotencyKey: string;
  revision: string;
  previewFingerprint: string;
};
export type SupplierBatchChargeV2CancelInput = {
  chargeId: string;
  reason: string;
  idempotencyKey: string;
};
export type SupplierBatchChargeV2CorrectInput = SupplierBatchChargeV2PreviewInput & {
  chargeId: string;
  correctionReason: string;
  idempotencyKey: string;
  revision: string;
  previewFingerprint: string;
};

export declare const supplierBatchChargePreviewSchema: z.ZodType<SupplierBatchChargePreviewInput>;
export declare const supplierBatchChargeEstimateSchema: z.ZodType<SupplierBatchChargeEstimateInput>;
export declare const supplierBatchChargeConfirmSchema: z.ZodType<SupplierBatchChargeConfirmInput>;
export declare const supplierBatchChargeV2PreviewSchema: z.ZodType<SupplierBatchChargeV2PreviewInput>;
export declare const supplierBatchChargeV2EstimateSchema: z.ZodType<SupplierBatchChargeV2EstimateInput>;
export declare const supplierBatchChargeV2ConfirmSchema: z.ZodType<SupplierBatchChargeV2ConfirmInput>;
export declare const supplierBatchChargeV2CancelSchema: z.ZodType<SupplierBatchChargeV2CancelInput>;
export declare const supplierBatchChargeV2CorrectSchema: z.ZodType<SupplierBatchChargeV2CorrectInput>;
