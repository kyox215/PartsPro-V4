import {
  supplierBatchChargeConfirmSchema,
  supplierBatchChargeEstimateSchema,
  supplierBatchChargePreviewSchema,
} from "@/lib/partspro-supplier-batch-cost-input-schema.mjs";

export {
  supplierBatchChargeConfirmSchema,
  supplierBatchChargeEstimateSchema,
  supplierBatchChargePreviewSchema,
};

type SupplierBatchChargeInput = {
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

export type SupplierBatchChargePreviewInput = SupplierBatchChargeInput;
export type SupplierBatchChargeEstimateInput = SupplierBatchChargeInput & {
  idempotencyKey: string;
};
export type SupplierBatchChargeConfirmInput = SupplierBatchChargeInput & {
  idempotencyKey: string;
  revision: string;
};
