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

export declare const supplierBatchChargePreviewSchema: z.ZodType<SupplierBatchChargePreviewInput>;
export declare const supplierBatchChargeEstimateSchema: z.ZodType<SupplierBatchChargeEstimateInput>;
export declare const supplierBatchChargeConfirmSchema: z.ZodType<SupplierBatchChargeConfirmInput>;
