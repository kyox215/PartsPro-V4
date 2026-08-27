export type SupplierBatchCostStatus =
  | "unrecorded"
  | "estimated"
  | "confirmed_zero"
  | "confirmed"
  | "needs_review";

export type SupplierBatchChargeStatus = "estimated" | "confirmed" | "cancelled";
export type SupplierBatchCostRpcStatus = "preview" | SupplierBatchChargeStatus;
export type SupplierBatchChargeType =
  | "transport"
  | "insurance"
  | "customs"
  | "handling"
  | "other";
export type SupplierBatchVatTreatment =
  | "recoverable"
  | "non_recoverable"
  | "unknown";
export type SupplierBatchAllocationMethod =
  | "goods_value"
  | "received_qty"
  | "weight"
  | "manual";

export type SupplierBatchReviewCode =
  | "NON_EUR_BATCH"
  | "PRODUCT_MAPPING_REQUIRED"
  | "WEIGHT_REQUIRED_FOR_ESTIMATE"
  | "FINANCIAL_ADJUSTMENT_REQUIRED";

export type SupplierBatchManualAllocation = {
  batchLineId: string;
  amountCents: number;
};

export type SupplierBatchChargeAllocation = {
  allocationId: string;
  batchId: string;
  chargeId: string;
  batchLineId: string;
  lineNo: number | null;
  skuCode: string | null;
  qtyReceivedSnapshot: number;
  goodsCostSnapshotCents: number;
  goodsCostSnapshot: number;
  weightGramSnapshot: number;
  metadata: Record<string, unknown>;
  allocatedAmountCents: number;
  allocatedUnitAmount: number;
  basisValue: number;
  shareRatio: number;
  landedLineCostCents: number | null;
  landedLineCost: number | null;
  landedUnitCost: number | null;
  roundingAdjustmentCents: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SupplierBatchRpcAllocation = Omit<
  SupplierBatchChargeAllocation,
  "allocationId"
  | "batchId"
  | "chargeId"
  | "lineNo"
  | "weightGramSnapshot"
  | "landedLineCostCents"
  | "landedLineCost"
  | "landedUnitCost"
> & {
  allocationId: string | null;
  batchId: string | null;
  chargeId: string | null;
  lineNo: number;
  weightGramSnapshot: number;
  landedLineCostCents: number;
  landedLineCost: number;
  landedUnitCost: number;
};

export type SupplierBatchCostSummary = {
  batchId: string;
  batchCode: string;
  currency: string;
  goodsValueCents: number;
  estimatedCount: number;
  confirmedCount: number;
  cancelledCount: number;
  estimatedNetCents: number;
  estimatedVatCents: number;
  estimatedGrossCents: number;
  estimatedCapitalizedCents: number;
  confirmedNetCents: number;
  confirmedVatCents: number;
  confirmedGrossCents: number;
  confirmedCapitalizedCents: number;
  confirmedLandedTotalCents: number;
  projectedLandedTotalCents: number;
  confirmationBlocked: boolean;
  reviewCodes: SupplierBatchReviewCode[];
  costStatus: SupplierBatchCostStatus;
};

export type SupplierBatchCharge = {
  chargeId: string;
  batchId: string;
  batchCode: string;
  status: SupplierBatchChargeStatus;
  chargeType: SupplierBatchChargeType;
  amountNetCents: number;
  vatAmountCents: number;
  amountGrossCents: number;
  capitalizedAmountCents: number;
  currency: "EUR";
  vatTreatment: SupplierBatchVatTreatment;
  allocationMethod: SupplierBatchAllocationMethod;
  carrierName: string | null;
  reference: string | null;
  occurredAt: string | null;
  evidenceUrl: string | null;
  notes: string | null;
  zeroCostReason: string | null;
  idempotencyKey: string;
  payloadFingerprint: string;
  manualAllocationsSnapshot: SupplierBatchManualAllocation[];
  metadata: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SupplierBatchLineProjection = {
  batchLineId: string;
  lineNo: number;
  skuCode: string | null;
  qtyReceived: number;
  weightGram: number | null;
  goodsCostCents: number;
  goodsUnitCost: number | null;
  currentAllocationCents: number;
  candidateAllocationCents: number;
  existingInboundCents: number;
  inboundAfterCandidateCents: number;
  currentLandedLineCostCents: number;
  projectedLandedLineCostCents: number;
  currentLandedUnitCost: number | null;
  projectedLandedUnitCost: number | null;
};

type SupplierBatchCostRpcResultBase = {
  batchId: string;
  batchCode: string;
  revision: string;
  currency: "EUR";
  amountNetCents: number;
  vatAmountCents: number;
  amountGrossCents: number;
  capitalizedAmountCents: number;
  candidateAllocationTotalCents: number;
  candidateAllocations: SupplierBatchRpcAllocation[];
  confirmedAllocationTotalCents: number;
  confirmedAllocations: SupplierBatchRpcAllocation[];
  allocationTotalCents: number;
  allocations: SupplierBatchRpcAllocation[];
  lineProjections: SupplierBatchLineProjection[];
  confirmationBlocked: boolean | null;
  confirmationBlockCode: "FINANCIAL_ADJUSTMENT_REQUIRED" | null;
  confirmationBlockReason: string | null;
  manualAllocationsSnapshot: SupplierBatchManualAllocation[];
  payloadFingerprint: string;
};

export type SupplierBatchCostRpcPreviewResult = SupplierBatchCostRpcResultBase & {
  status: "preview";
  charge: null;
  metadata: null;
};

export type SupplierBatchCostRpcPersistedResult = SupplierBatchCostRpcResultBase & {
  status: "estimated" | "confirmed" | "cancelled";
  charge: SupplierBatchCharge;
  metadata: Record<string, unknown>;
};

export type SupplierBatchCostRpcResult =
  | SupplierBatchCostRpcPreviewResult
  | SupplierBatchCostRpcPersistedResult;

export type SupplierBatchLineCost = {
  batchLineId: string;
  goodsCostCents: number;
  confirmedInboundCents: number;
  landedLineCostCents: number;
  goodsUnitCost: number;
  landedUnitCost: number | null;
};

export const SUPPLIER_BATCH_COST_STATUSES: readonly SupplierBatchCostStatus[];
export const SUPPLIER_BATCH_CHARGE_STATUSES: readonly SupplierBatchChargeStatus[];
export const SUPPLIER_BATCH_CHARGE_TYPES: readonly SupplierBatchChargeType[];
export const SUPPLIER_BATCH_VAT_TREATMENTS: readonly SupplierBatchVatTreatment[];
export const SUPPLIER_BATCH_ALLOCATION_METHODS: readonly SupplierBatchAllocationMethod[];
export const SUPPLIER_BATCH_REVIEW_CODES: readonly SupplierBatchReviewCode[];

export function supplierBatchMoneyToCents(value: unknown, fieldName?: string): number | null;
export function supplierBatchMoneyCentsToNumber(cents: number): number | null;
export function supplierBatchSumMoneyCents(values: unknown[]): number | null;
export function supplierBatchExportRowCount(
  scope: "batches" | "lines" | "charges",
  batches: unknown[],
  details: unknown[]
): number | null;
export function normalizeSupplierBatchCostStatus(value: unknown): SupplierBatchCostStatus | null;
export function normalizeSupplierBatchChargeStatus(value: unknown): SupplierBatchChargeStatus | null;
export function normalizeSupplierBatchCostSummary(value: unknown): SupplierBatchCostSummary | null;
export function normalizeSupplierBatchCharge(value: unknown): SupplierBatchCharge | null;
export function normalizeSupplierBatchChargeAllocation(
  value: unknown
): SupplierBatchChargeAllocation | null;
export function normalizeSupplierBatchRpcAllocation(
  value: unknown
): SupplierBatchRpcAllocation | null;
export function normalizeSupplierBatchPersistedAllocation(
  value: unknown
): SupplierBatchChargeAllocation | null;
export function normalizeSupplierBatchLineProjection(value: unknown): SupplierBatchLineProjection | null;
export function normalizeSupplierBatchCostRpcResult(value: unknown): SupplierBatchCostRpcResult | null;
export function summarizeSupplierBatchLineCosts(
  lines: unknown[],
  allocations: unknown[]
): SupplierBatchLineCost[] | null;
