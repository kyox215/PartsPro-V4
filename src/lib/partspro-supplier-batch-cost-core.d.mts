export type SupplierBatchCostStatus =
  | "unrecorded"
  | "estimated"
  | "confirmed_zero"
  | "confirmed"
  | "needs_review";

export type SupplierBatchChargeStatus = "estimated" | "confirmed" | "cancelled";
export type SupplierBatchCostRpcStatus = "preview" | SupplierBatchChargeStatus;
export type SupplierBatchCorrectionReceiptStatus =
  | "corrected"
  | "pending_finance_adjustment";
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

export type SupplierBatchCurrency = "EUR" | "USD" | "CNY";

export type SupplierBatchReviewCode =
  | "NON_EUR_BATCH"
  | "MIXED_CURRENCY"
  | "PRODUCT_MAPPING_REQUIRED"
  | "WEIGHT_REQUIRED_FOR_ESTIMATE"
  | "FINANCIAL_ADJUSTMENT_REQUIRED"
  | "FINANCE_ADJUSTMENT_REQUIRED"
  | "BATCH_FX_RATE_REQUIRED";

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
  goodsCostSnapshotEurCents?: number | null;
  weightGramSnapshot: number;
  metadata: Record<string, unknown>;
  allocatedAmountCents: number;
  allocatedAmountEurCents?: number | null;
  allocatedUnitAmount: number;
  allocatedUnitAmountEur?: number | null;
  basisValue: number;
  shareRatio: number;
  landedLineCostCents: number | null;
  landedLineCost: number | null;
  landedLineCostEurCents?: number | null;
  landedUnitCost: number | null;
  landedUnitCostEur?: number | null;
  originalCurrencyComparable?: boolean;
  roundingAdjustmentCents: number;
  roundingAdjustmentEurCents?: number | null;
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
  landedLineCostCents: number | null;
  landedLineCost: number | null;
  landedUnitCost: number | null;
};

export type SupplierBatchCostSummary = {
  batchId: string;
  batchCode: string;
  currency: SupplierBatchCurrency;
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
  confirmedLandedTotalCents: number | null;
  projectedLandedTotalCents: number | null;
  confirmationBlocked: boolean;
  reviewCodes: SupplierBatchReviewCode[];
  costStatus: SupplierBatchCostStatus;
  originalTotalsComparable?: boolean;
  baseCurrency?: "EUR";
  baseFxAvailable?: boolean;
  goodsValueEurCents?: number | null;
  estimatedNetEurCents?: number | null;
  estimatedVatEurCents?: number | null;
  estimatedGrossEurCents?: number | null;
  estimatedCapitalizedEurCents?: number | null;
  confirmedNetEurCents?: number | null;
  confirmedVatEurCents?: number | null;
  confirmedGrossEurCents?: number | null;
  confirmedCapitalizedEurCents?: number | null;
  confirmedLandedTotalEurCents?: number | null;
  projectedLandedTotalEurCents?: number | null;
  goodsValueFxRateToEur?: number | null;
  goodsValueFxDate?: string | null;
  goodsValueFxSource?: string | null;
  goodsValueFxEvidenceUrl?: string | null;
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
  currency: SupplierBatchCurrency;
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
  baseCurrency?: "EUR";
  fxRateToEur?: number | null;
  fxRateDate?: string | null;
  fxRateSource?: string | null;
  fxEvidenceUrl?: string | null;
  amountNetEurCents?: number | null;
  vatAmountEurCents?: number | null;
  amountGrossEurCents?: number | null;
  capitalizedAmountEurCents?: number | null;
};

export type SupplierBatchLineProjection = {
  batchLineId: string;
  lineNo: number;
  skuCode: string | null;
  qtyReceived: number;
  weightGram: number | null;
  goodsCostCents: number;
  goodsUnitCost: number | null;
  currentAllocationCents: number | null;
  candidateAllocationCents: number | null;
  existingInboundCents: number | null;
  inboundAfterCandidateCents: number | null;
  currentLandedLineCostCents: number | null;
  projectedLandedLineCostCents: number | null;
  currentLandedUnitCost: number | null;
  projectedLandedUnitCost: number | null;
  originalCurrencyComparable: boolean;
  goodsCostEurCents: number | null;
  currentAllocationEurCents: number | null;
  candidateAllocationEurCents: number | null;
  existingInboundEurCents: number | null;
  inboundAfterCandidateEurCents: number | null;
  currentLandedLineCostEurCents: number | null;
  projectedLandedLineCostEurCents: number | null;
  currentLandedUnitCostEur: number | null;
  projectedLandedUnitCostEur: number | null;
};

/** EUR-only correction preview totals; delta is signed (after - before). */
export type SupplierBatchCorrectionPreviewTotals = {
  otherEffectiveCostEurCents: number;
  originalChargeEurCents: number;
  replacementChargeEurCents: number;
  beforeTotalEurCents: number;
  afterTotalEurCents: number;
  costDeltaEurCents: number;
};

type SupplierBatchCostRpcResultBase = {
  batchId: string;
  batchCode: string;
  revision: string;
  currency: SupplierBatchCurrency;
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
  confirmationBlockCode:
    | "FINANCIAL_ADJUSTMENT_REQUIRED"
    | "FINANCE_ADJUSTMENT_REQUIRED"
    | "BATCH_FX_RATE_REQUIRED"
    | null;
  confirmationBlockReason: string | null;
  manualAllocationsSnapshot: SupplierBatchManualAllocation[];
  payloadFingerprint: string;
  baseCurrency?: "EUR";
  fxRateToEur?: number | null;
  fxRateDate?: string | null;
  fxRateSource?: string | null;
  fxEvidenceUrl?: string | null;
  amountNetEurCents?: number | null;
  vatAmountEurCents?: number | null;
  amountGrossEurCents?: number | null;
  capitalizedAmountEurCents?: number | null;
  correctionPreview?: boolean;
  correctionTotals?: SupplierBatchCorrectionPreviewTotals;
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

export type SupplierBatchCorrectionResult = {
  status: SupplierBatchCorrectionReceiptStatus;
  correctionId: string;
  originalChargeId: string;
  replacementChargeId: string | null;
  batchCode: string;
  idempotencyKey: string;
  previewFingerprint: string;
  revision: string;
  financeAdjustmentRequired: boolean;
  replacement: SupplierBatchCostRpcPersistedResult | null;
};

export type SupplierBatchLineCost = {
  batchLineId: string;
  goodsCostCents: number;
  confirmedInboundCents: number | null;
  landedLineCostCents: number | null;
  goodsUnitCost: number;
  landedUnitCost: number | null;
  originalCurrencyComparable: boolean;
};

export const SUPPLIER_BATCH_COST_STATUSES: readonly SupplierBatchCostStatus[];
export const SUPPLIER_BATCH_CHARGE_STATUSES: readonly SupplierBatchChargeStatus[];
export const SUPPLIER_BATCH_CORRECTION_RECEIPT_STATUSES: readonly SupplierBatchCorrectionReceiptStatus[];
export const SUPPLIER_BATCH_CHARGE_TYPES: readonly SupplierBatchChargeType[];
export const SUPPLIER_BATCH_VAT_TREATMENTS: readonly SupplierBatchVatTreatment[];
export const SUPPLIER_BATCH_ALLOCATION_METHODS: readonly SupplierBatchAllocationMethod[];
export const SUPPLIER_BATCH_REVIEW_CODES: readonly SupplierBatchReviewCode[];
export const SUPPLIER_BATCH_CURRENCIES: readonly SupplierBatchCurrency[];
export const SUPPLIER_BATCH_BASE_CURRENCY: "EUR";

export function normalizeSupplierBatchCurrency(value: unknown): SupplierBatchCurrency | null;
export function normalizeSupplierBatchFxRate(value: unknown): number | null;
export function supplierBatchFxAmountToEurCents(amountCents: number, rate: unknown): number | null;
export function supplierBatchFxChargeAmountsToEurCents(input: {
  amountNetCents: number;
  vatAmountCents: number;
  amountGrossCents: number;
  capitalizedAmountCents: number;
  rate: unknown;
}): {
  amountNetEurCents: number;
  vatAmountEurCents: number;
  amountGrossEurCents: number;
  capitalizedAmountEurCents: number;
} | null;

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
export function normalizeSupplierBatchCorrectionResult(
  value: unknown
): SupplierBatchCorrectionResult | null;
export function normalizeSupplierBatchCorrectionReceipt(
  value: unknown
): SupplierBatchCorrectionResult | null;
export function resolveSupplierBatchEffectiveChargeIds(
  charges: unknown[],
  corrections: unknown[]
): string[] | null;
export function summarizeSupplierBatchLineCosts(
  lines: unknown[],
  allocations: unknown[]
): SupplierBatchLineCost[] | null;
