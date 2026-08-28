import {
  supplierBatchChargeConfirmSchema,
  supplierBatchChargeEstimateSchema,
  supplierBatchChargePreviewSchema,
  supplierBatchChargeV2CancelSchema,
  supplierBatchChargeV2ConfirmSchema,
  supplierBatchChargeV2CorrectSchema,
  supplierBatchChargeV2EstimateSchema,
  supplierBatchChargeV2PreviewSchema,
} from "@/lib/partspro-supplier-batch-cost-input-schema.mjs";

export {
  supplierBatchChargeConfirmSchema,
  supplierBatchChargeEstimateSchema,
  supplierBatchChargePreviewSchema,
  supplierBatchChargeV2CancelSchema,
  supplierBatchChargeV2ConfirmSchema,
  supplierBatchChargeV2CorrectSchema,
  supplierBatchChargeV2EstimateSchema,
  supplierBatchChargeV2PreviewSchema,
};

type SupplierBatchChargeInput = {
  allocationMethod: "goods_value" | "received_qty" | "weight" | "manual";
  amountNet: number;
  capitalizedAmount: number;
  carrierName?: string | null;
  chargeId?: string;
  chargeType: "transport" | "insurance" | "customs" | "handling" | "other";
  currency: "EUR" | "USD" | "CNY";
  evidenceUrl?: string | null;
  idempotencyKey?: string;
  manualAllocations?: Array<{ amount: number; batchLineId: string }>;
  notes?: string | null;
  occurredAt?: string | null;
  reference?: string | null;
  vatAmount: number;
  vatTreatment: "recoverable" | "non_recoverable" | "unknown";
  zeroCostReason?: string | null;
  fxRateToEur?: number;
  fxRateDate?: string;
  fxRateSource?: string;
  fxEvidenceUrl?: string;
  batchGoodsValueFxRateToEur?: number;
  batchGoodsValueFxDate?: string;
  batchGoodsValueFxSource?: string;
  batchGoodsValueFxEvidenceUrl?: string;
};

export type SupplierBatchChargePreviewInput = SupplierBatchChargeInput;
export type SupplierBatchChargeEstimateInput = SupplierBatchChargeInput & {
  idempotencyKey: string;
};
export type SupplierBatchChargeConfirmInput = SupplierBatchChargeInput & {
  idempotencyKey: string;
  revision: string;
  previewFingerprint: string;
};
