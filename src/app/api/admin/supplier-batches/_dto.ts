import { centsToNumber } from "@/lib/partspro-api";
import {
  type AdminSupplierBatch,
  type AdminSupplierBatchCharge,
  type AdminSupplierBatchChargeAllocation,
  type AdminSupplierBatchCorrectionResult,
  type AdminSupplierBatchCostRpcResult,
  type AdminSupplierBatchCostSummary,
  type AdminSupplierBatchDetail,
  type AdminSupplierBatchLine,
  type AdminSupplierBatchLineProduct,
  type AdminSupplierBatchLineProjection,
  type AdminSupplierBatchCostHistoryEntry,
  type AdminSupplierBatchCorrectionPreviewTotals,
} from "@/lib/partspro-repository";

/**
 * Parsed charge fields that are not retained at the root of the normalized RPC
 * result.  Routes should pass their already schema-validated body as this
 * context when serializing an RPC result.
 */
export type SupplierBatchCostRpcRequestContext = {
  batchCode: string;
  chargeType: AdminSupplierBatchCharge["chargeType"];
  vatTreatment: AdminSupplierBatchCharge["vatTreatment"];
  allocationMethod: AdminSupplierBatchCharge["allocationMethod"];
  currency: AdminSupplierBatchCharge["currency"];
  carrierName?: string | null;
  reference?: string | null;
  occurredAt?: string | null;
  evidenceUrl?: string | null;
  notes?: string | null;
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

export function toSupplierBatchCostSummaryDto(summary: AdminSupplierBatchCostSummary) {
  return {
    batchId: summary.batchId,
    batchCode: summary.batchCode,
    currency: summary.currency,
    goodsValue: centsToNumber(summary.goodsValueCents),
    estimatedCount: summary.estimatedCount,
    confirmedCount: summary.confirmedCount,
    cancelledCount: summary.cancelledCount,
    estimatedNet: centsToNumber(summary.estimatedNetCents),
    estimatedVat: centsToNumber(summary.estimatedVatCents),
    estimatedGross: centsToNumber(summary.estimatedGrossCents),
    estimatedCapitalized: centsToNumber(summary.estimatedCapitalizedCents),
    confirmedNet: centsToNumber(summary.confirmedNetCents),
    confirmedVat: centsToNumber(summary.confirmedVatCents),
    confirmedGross: centsToNumber(summary.confirmedGrossCents),
    confirmedCapitalized: centsToNumber(summary.confirmedCapitalizedCents),
    confirmedLandedTotal: centsToNullableNumber(summary.confirmedLandedTotalCents),
    projectedLandedTotal: centsToNullableNumber(summary.projectedLandedTotalCents),
    confirmationBlocked: summary.confirmationBlocked,
    reviewCodes: summary.reviewCodes,
    costStatus: summary.costStatus,
    ...(summary.originalTotalsComparable === undefined
      ? {}
      : { originalTotalsComparable: summary.originalTotalsComparable }),
    ...toSupplierBatchSummaryFxFields(summary),
  };
}

export function toSupplierBatchChargeDto(charge: AdminSupplierBatchCharge) {
  const chargeWithAllocations = charge as AdminSupplierBatchChargeWithAllocations;

  return {
    chargeId: charge.chargeId,
    batchId: charge.batchId,
    batchCode: charge.batchCode,
    status: charge.status,
    chargeType: charge.chargeType,
    amountNet: centsToNumber(charge.amountNetCents),
    vatAmount: centsToNumber(charge.vatAmountCents),
    amountGross: centsToNumber(charge.amountGrossCents),
    capitalizedAmount: centsToNumber(charge.capitalizedAmountCents),
    currency: charge.currency,
    vatTreatment: charge.vatTreatment,
    allocationMethod: charge.allocationMethod,
    carrierName: charge.carrierName,
    reference: charge.reference,
    occurredAt: charge.occurredAt,
    evidenceUrl: charge.evidenceUrl,
    notes: charge.notes,
    zeroCostReason: charge.zeroCostReason,
    idempotencyKey: charge.idempotencyKey,
    payloadFingerprint: charge.payloadFingerprint,
    manualAllocationsSnapshot: charge.manualAllocationsSnapshot.map(
      toSupplierBatchManualAllocationDto
    ),
    metadata: toSupplierBatchSafeMetadata(charge.metadata),
    createdBy: charge.createdBy,
    updatedBy: charge.updatedBy,
    confirmedBy: charge.confirmedBy,
    confirmedAt: charge.confirmedAt,
    createdAt: charge.createdAt,
    updatedAt: charge.updatedAt,
    ...(charge.effective === undefined ? {} : { effective: charge.effective }),
    ...(charge.superseded === undefined ? {} : { superseded: charge.superseded }),
    ...(charge.correction === undefined ? {} : { correction: charge.correction }),
    ...toSupplierBatchChargeFxFields(charge),
    ...(chargeWithAllocations.allocations === undefined
      ? {}
      : {
          allocations: chargeWithAllocations.allocations.map(
            toSupplierBatchAllocationDto
          ),
        }),
  };
}

export function toSupplierBatchCostRpcResultDto(
  result: AdminSupplierBatchCostRpcResult,
  context: SupplierBatchCostRpcRequestContext
) {
  if (result.status !== "preview") {
    throw new TypeError(
      "Supplier batch cost RPC full DTO serialization only supports preview results."
    );
  }

  const verifiedContext = requireSupplierBatchCostRpcRequestContext(context);
  if (
    verifiedContext.currency !== result.currency ||
    verifiedContext.batchCode !== result.batchCode
  ) {
    throw new TypeError(
      "Supplier batch cost RPC request context identity does not match result."
    );
  }

  return {
    status: result.status,
    charge: null,
    batchId: result.batchId,
    batchCode: result.batchCode,
    revision: result.revision,
    currency: result.currency,
    amountNet: centsToNumber(result.amountNetCents),
    vatAmount: centsToNumber(result.vatAmountCents),
    amountGross: centsToNumber(result.amountGrossCents),
    capitalizedAmount: centsToNumber(result.capitalizedAmountCents),
    candidateAllocationTotal: centsToNumber(result.candidateAllocationTotalCents),
    candidateAllocations: result.candidateAllocations.map(toSupplierBatchAllocationDto),
    confirmedAllocationTotal: centsToNumber(result.confirmedAllocationTotalCents),
    confirmedAllocations: result.confirmedAllocations.map(toSupplierBatchAllocationDto),
    allocationTotal: centsToNumber(result.allocationTotalCents),
    allocations: result.allocations.map(toSupplierBatchAllocationDto),
    lineProjections: result.lineProjections.map(toSupplierBatchLineProjectionDto),
    ...(result.correctionPreview === undefined
      ? {}
      : { correctionPreview: result.correctionPreview }),
    ...(result.correctionTotals === undefined
      ? {}
      : { correctionTotals: toSupplierBatchCorrectionPreviewTotalsDto(result.correctionTotals) }),
    ...(result.status === "preview"
      ? {
          confirmationBlocked: result.confirmationBlocked,
          confirmationBlockCode: result.confirmationBlockCode,
          confirmationBlockReason: result.confirmationBlockReason,
        }
      : {}),
    manualAllocationsSnapshot: result.manualAllocationsSnapshot.map(
      toSupplierBatchManualAllocationDto
    ),
    payloadFingerprint: result.payloadFingerprint,
    ...toSupplierBatchRpcChargeFields(verifiedContext),
    ...toSupplierBatchRpcFxFields(result),
    ...toSupplierBatchRpcGoodsFxFields(result, verifiedContext),
  };
}

/**
 * Serialize a persisted V2 result without routing it through the preview-only
 * DTO.  Correction receipts embed one canonical confirmed replacement result;
 * keeping this serializer separate prevents a successful write from being
 * rejected because the preview serializer intentionally has no charge.
 */
export function toSupplierBatchPersistedCostRpcResultDto(
  result: NonNullable<AdminSupplierBatchCorrectionResult["replacement"]>,
  context?: SupplierBatchCostRpcRequestContext
) {
  if (!result.charge) {
    throw new TypeError(
      "Supplier batch persisted cost RPC DTO requires a persisted charge result."
    );
  }

  const charge = result.charge;
  if (
    charge.batchId !== result.batchId ||
    charge.batchCode !== result.batchCode ||
    charge.currency !== result.currency ||
    charge.status !== result.status
  ) {
    throw new TypeError(
      "Supplier batch persisted cost RPC result identity does not match its charge."
    );
  }

  const fallbackContext: SupplierBatchCostRpcRequestContext = {
    batchCode: result.batchCode,
    chargeType: charge.chargeType,
    vatTreatment: charge.vatTreatment,
    allocationMethod: charge.allocationMethod,
    currency: charge.currency,
    carrierName: charge.carrierName,
    reference: charge.reference,
    occurredAt: charge.occurredAt,
    evidenceUrl: charge.evidenceUrl,
    notes: charge.notes,
    zeroCostReason: charge.zeroCostReason,
    ...(charge.fxRateToEur === undefined || charge.fxRateToEur === null
      ? {}
      : {
          fxRateToEur: charge.fxRateToEur,
          fxRateDate: charge.fxRateDate ?? undefined,
          fxRateSource: charge.fxRateSource ?? undefined,
          fxEvidenceUrl: charge.fxEvidenceUrl ?? undefined,
        }),
  };
  const verifiedContext = requireSupplierBatchCostRpcRequestContext(
    context ?? fallbackContext
  );

  if (
    verifiedContext.batchCode !== result.batchCode ||
    verifiedContext.currency !== result.currency
  ) {
    throw new TypeError(
      "Supplier batch persisted cost request context identity does not match result."
    );
  }

  return {
    status: result.status,
    charge: toSupplierBatchChargeDto(charge),
    batchId: result.batchId,
    batchCode: result.batchCode,
    revision: result.revision,
    currency: result.currency,
    chargeType: charge.chargeType,
    vatTreatment: charge.vatTreatment,
    allocationMethod: charge.allocationMethod,
    carrierName: charge.carrierName,
    reference: charge.reference,
    occurredAt: charge.occurredAt,
    evidenceUrl: charge.evidenceUrl,
    notes: charge.notes,
    zeroCostReason: charge.zeroCostReason,
    amountNet: centsToNumber(result.amountNetCents),
    vatAmount: centsToNumber(result.vatAmountCents),
    amountGross: centsToNumber(result.amountGrossCents),
    capitalizedAmount: centsToNumber(result.capitalizedAmountCents),
    candidateAllocationTotal: centsToNumber(result.candidateAllocationTotalCents),
    candidateAllocations: result.candidateAllocations.map(toSupplierBatchAllocationDto),
    confirmedAllocationTotal: centsToNumber(result.confirmedAllocationTotalCents),
    confirmedAllocations: result.confirmedAllocations.map(toSupplierBatchAllocationDto),
    allocationTotal: centsToNumber(result.allocationTotalCents),
    allocations: result.allocations.map(toSupplierBatchAllocationDto),
    lineProjections: result.lineProjections.map(toSupplierBatchLineProjectionDto),
    confirmationBlocked: result.confirmationBlocked,
    confirmationBlockCode: result.confirmationBlockCode,
    confirmationBlockReason: result.confirmationBlockReason,
    manualAllocationsSnapshot: result.manualAllocationsSnapshot.map(
      toSupplierBatchManualAllocationDto
    ),
    payloadFingerprint: result.payloadFingerprint,
    metadata: toSupplierBatchSafeMetadata(result.metadata),
    ...(result.correctionPreview === undefined
      ? {}
      : { correctionPreview: result.correctionPreview }),
    ...(result.correctionTotals === undefined
      ? {}
      : { correctionTotals: toSupplierBatchCorrectionPreviewTotalsDto(result.correctionTotals) }),
    ...toSupplierBatchRpcFxFields(result),
    ...toSupplierBatchRpcGoodsFxFields(result, verifiedContext),
  };
}

export function toSupplierBatchCorrectionReceiptDto(
  result: AdminSupplierBatchCorrectionResult,
  context?: SupplierBatchCostRpcRequestContext
) {
  return {
    status: result.status,
    correctionId: result.correctionId,
    originalChargeId: result.originalChargeId,
    replacementChargeId: result.replacementChargeId,
    batchCode: result.batchCode,
    idempotencyKey: result.idempotencyKey,
    previewFingerprint: result.previewFingerprint,
    revision: result.revision,
    financeAdjustmentRequired: result.financeAdjustmentRequired,
    replacement: result.replacement
      ? toSupplierBatchPersistedCostRpcResultDto(result.replacement, context)
      : null,
  };
}

function toSupplierBatchSummaryFxFields(summary: AdminSupplierBatchCostSummary) {
  if (
    !("baseCurrency" in summary) &&
    !("baseFxAvailable" in summary) &&
    !("goodsValueEurCents" in summary)
  ) {
    return {};
  }
  return {
    baseCurrency: summary.baseCurrency ?? "EUR",
    baseFxAvailable: summary.baseFxAvailable ?? summary.currency === "EUR",
    goodsValueEur: centsToNullableNumber(summary.goodsValueEurCents ?? null),
    estimatedNetEur: centsToNullableNumber(summary.estimatedNetEurCents ?? null),
    estimatedVatEur: centsToNullableNumber(summary.estimatedVatEurCents ?? null),
    estimatedGrossEur: centsToNullableNumber(summary.estimatedGrossEurCents ?? null),
    estimatedCapitalizedEur: centsToNullableNumber(summary.estimatedCapitalizedEurCents ?? null),
    confirmedNetEur: centsToNullableNumber(summary.confirmedNetEurCents ?? null),
    confirmedVatEur: centsToNullableNumber(summary.confirmedVatEurCents ?? null),
    confirmedGrossEur: centsToNullableNumber(summary.confirmedGrossEurCents ?? null),
    confirmedCapitalizedEur: centsToNullableNumber(summary.confirmedCapitalizedEurCents ?? null),
    confirmedLandedTotalEur: centsToNullableNumber(summary.confirmedLandedTotalEurCents ?? null),
    projectedLandedTotalEur: centsToNullableNumber(summary.projectedLandedTotalEurCents ?? null),
    ...(summary.goodsValueFxRateToEur === undefined
      ? {}
      : { goodsValueFxRateToEur: summary.goodsValueFxRateToEur }),
    ...(summary.goodsValueFxDate === undefined
      ? {}
      : { goodsValueFxDate: summary.goodsValueFxDate }),
    ...(summary.goodsValueFxSource === undefined
      ? {}
      : { goodsValueFxSource: summary.goodsValueFxSource }),
    ...(summary.goodsValueFxEvidenceUrl === undefined
      ? {}
      : { goodsValueFxEvidenceUrl: summary.goodsValueFxEvidenceUrl }),
  };
}

function toSupplierBatchChargeFxFields(charge: AdminSupplierBatchCharge) {
  if (!("baseCurrency" in charge) && !("amountNetEurCents" in charge)) {
    return {};
  }
  return {
    baseCurrency: charge.baseCurrency ?? "EUR",
    fxRateToEur: charge.fxRateToEur ?? null,
    fxRateDate: charge.fxRateDate ?? null,
    fxRateSource: charge.fxRateSource ?? null,
    fxEvidenceUrl: charge.fxEvidenceUrl ?? null,
    amountNetEur: centsToNullableNumber(charge.amountNetEurCents ?? null),
    vatAmountEur: centsToNullableNumber(charge.vatAmountEurCents ?? null),
    amountGrossEur: centsToNullableNumber(charge.amountGrossEurCents ?? null),
    capitalizedAmountEur: centsToNullableNumber(charge.capitalizedAmountEurCents ?? null),
  };
}

function toSupplierBatchRpcFxFields(result: AdminSupplierBatchCostRpcResult) {
  if (!("baseCurrency" in result) && !("amountNetEurCents" in result)) {
    return {};
  }
  return {
    baseCurrency: result.baseCurrency ?? "EUR",
    fxRateToEur: result.fxRateToEur ?? null,
    fxRateDate: result.fxRateDate ?? null,
    fxRateSource: result.fxRateSource ?? null,
    fxEvidenceUrl: result.fxEvidenceUrl ?? null,
    amountNetEur: centsToNullableNumber(result.amountNetEurCents ?? null),
    vatAmountEur: centsToNullableNumber(result.vatAmountEurCents ?? null),
    amountGrossEur: centsToNullableNumber(result.amountGrossEurCents ?? null),
    capitalizedAmountEur: centsToNullableNumber(result.capitalizedAmountEurCents ?? null),
  };
}

function toSupplierBatchRpcGoodsFxFields(
  result: AdminSupplierBatchCostRpcResult,
  context: SupplierBatchCostRpcRequestContext
) {
  const record = result as unknown as Record<string, unknown>;
  const rate = readOptionalNumber(record, [
    "goodsValueFxRateToEur",
    "goods_value_fx_rate_to_eur",
  ]) ?? context.batchGoodsValueFxRateToEur;
  const date = readOptionalString(record, [
    "goodsValueFxDate",
    "goods_value_fx_date",
  ]) ?? context.batchGoodsValueFxDate;
  const source = readOptionalString(record, [
    "goodsValueFxSource",
    "goods_value_fx_source",
  ]) ?? context.batchGoodsValueFxSource;
  const evidenceUrl = readOptionalString(record, [
    "goodsValueFxEvidenceUrl",
    "goods_value_fx_evidence_url",
  ]) ?? context.batchGoodsValueFxEvidenceUrl;
  if (rate === undefined && date === undefined && source === undefined && evidenceUrl === undefined) {
    return {};
  }
  return {
    goodsValueFxRateToEur: rate ?? null,
    goodsValueFxDate: date ?? null,
    goodsValueFxSource: source ?? null,
    goodsValueFxEvidenceUrl: evidenceUrl ?? null,
  };
}

function readOptionalNumber(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    if (typeof record[key] === "number" && Number.isFinite(record[key])) {
      return record[key] as number;
    }
  }
  return undefined;
}

function readOptionalString(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key].trim() !== "") {
      return record[key] as string;
    }
  }
  return undefined;
}

export function assertSupplierBatchCostRpcRequestContext(
  context: unknown
): asserts context is SupplierBatchCostRpcRequestContext {
  requireSupplierBatchCostRpcRequestContext(context);
}

export function toSupplierBatchRowDto(batch: AdminSupplierBatch) {
  return {
    id: batch.id,
    batchCode: batch.batchCode,
    supplierId: batch.supplierId,
    supplierCode: batch.supplierCode,
    supplierName: batch.supplierName,
    invoiceNo: batch.invoiceNo,
    orderNo: batch.orderNo,
    invoiceDate: batch.invoiceDate,
    receivedAt: batch.receivedAt,
    totalQty: batch.totalQty,
    totalCost: batch.totalCost,
    currency: batch.currency,
    vatMode: batch.vatMode,
    tags: batch.tags,
    sourceFileName: batch.sourceFileName,
    metadata: batch.metadata,
    orderedQty: batch.orderedQty,
    shortQty: batch.shortQty,
    lineQtyTotal: batch.lineQtyTotal,
    lineCostTotal: batch.lineCostTotal,
    lineCount: batch.lineCount,
    activeProductCount: batch.activeProductCount,
    draftProductCount: batch.draftProductCount,
    missingImageCount: batch.missingImageCount,
    productMissingCount: batch.productMissingCount,
    activeMissingImageCount: batch.activeMissingImageCount,
    priceViolationCount: batch.priceViolationCount,
    modelPrefixIssueCount: batch.modelPrefixIssueCount,
    verification: batch.verification,
    goodsValueEur: batch.goodsValueEur ?? null,
    goodsValueFxRateToEur: batch.goodsValueFxRateToEur ?? null,
    goodsValueFxDate: batch.goodsValueFxDate ?? null,
    goodsValueFxSource: batch.goodsValueFxSource ?? null,
    goodsValueFxEvidenceUrl: batch.goodsValueFxEvidenceUrl ?? null,
    costSummary: batch.costSummary
      ? toSupplierBatchCostSummaryDto(batch.costSummary)
      : null,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

export type SupplierBatchDetailDtoOptions = {
  /** Actor/audit payloads are only emitted to an explicitly authorized audit reader. */
  includeSensitiveAudit?: boolean;
};

export function toSupplierBatchCostHistoryDto(
  entry: AdminSupplierBatchCostHistoryEntry,
  options: SupplierBatchDetailDtoOptions = {}
) {
  return {
    eventId: entry.eventId,
    batchId: entry.batchId,
    batchCode: entry.batchCode,
    chargeId: entry.chargeId,
    correctionId: entry.correctionId,
    linkedChargeId: entry.linkedChargeId,
    links: entry.links,
    eventType: entry.eventType,
    status: entry.status,
    financeAdjustmentRequired: entry.financeAdjustmentRequired,
    reason: entry.reason,
    actorId: entry.actorId,
    idempotencyKey: entry.idempotencyKey,
    revision: entry.revision,
    payloadFingerprint: entry.payloadFingerprint,
    ...(entry.effective === undefined ? {} : { effective: entry.effective }),
    ...(entry.superseded === undefined ? {} : { superseded: entry.superseded }),
    createdAt: entry.createdAt,
    metadata: toSupplierBatchSafeMetadata(entry.metadata),
    ...(options.includeSensitiveAudit
      ? {
          actorEmail: entry.actorEmail,
          actorRole: entry.actorRole,
          before: entry.before,
          after: entry.after,
        }
      : {}),
  };
}

export function toSupplierBatchDetailDto(
  detail: AdminSupplierBatchDetail,
  options: SupplierBatchDetailDtoOptions = {}
) {
  const detailWithAllocations = detail as AdminSupplierBatchDetailWithAllocations;

  return {
    batch: toSupplierBatchRowDto(detail.batch),
    lines: detail.lines.map(toSupplierBatchLineDto),
    charges: detail.charges.map(toSupplierBatchChargeDto),
    verification: detail.verification,
    ...(detailWithAllocations.allocations === undefined
      ? {}
      : {
          allocations: detailWithAllocations.allocations.map(
            toSupplierBatchAllocationDto
          ),
        }),
    ...(detail.history === undefined
      ? {}
      : {
          history: detail.history.map((entry) =>
            toSupplierBatchCostHistoryDto(entry, options)
          ),
        }),
  };
}

function toSupplierBatchLineDto(line: AdminSupplierBatchLine) {
  return {
    id: line.id,
    lineNo: line.lineNo,
    ean: line.ean,
    supplierSku: line.supplierSku,
    skuCode: line.skuCode,
    name: line.name,
    qtyReceived: line.qtyReceived,
    qtyOrdered: line.qtyOrdered,
    qtyShort: line.qtyShort,
    unitCost: line.unitCost,
    lineTotal: line.lineTotal,
    imageStatus: line.imageStatus,
    productStatus: line.productStatus,
    metadata: line.metadata,
    product: line.product ? toSupplierBatchLineProductDto(line.product) : null,
    // Line costs are intentionally kept in the repository's internal cents shape.
    costs: line.costs,
    createdAt: line.createdAt,
    updatedAt: line.updatedAt,
  };
}

function toSupplierBatchLineProductDto(product: AdminSupplierBatchLineProduct) {
  return {
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    model: product.model,
    category: product.category,
    grade: product.grade,
    catalogStatus: product.catalogStatus,
    stockStatus: product.stockStatus,
    stockQty: product.stockQty,
    actualQty: product.actualQty,
    availableQty: product.availableQty,
    lockedQty: product.lockedQty,
    weightGram: product.weightGram,
    imagePath: product.imagePath,
    modelCodes: product.modelCodes,
    compatibilityModels: product.compatibilityModels,
    priceRuleOk: product.priceRuleOk,
    activeMissingImage: product.activeMissingImage,
    modelPrefixIssue: product.modelPrefixIssue,
  };
}

function toSupplierBatchLineProjectionDto(projection: AdminSupplierBatchLineProjection) {
  return {
    batchLineId: projection.batchLineId,
    lineNo: projection.lineNo,
    skuCode: projection.skuCode,
    qtyReceived: projection.qtyReceived,
    weightGram: projection.weightGram,
    goodsCost: centsToNumber(projection.goodsCostCents),
    goodsUnitCost: projection.goodsUnitCost,
    currentAllocation: centsToNullableNumber(projection.currentAllocationCents),
    candidateAllocation: centsToNullableNumber(projection.candidateAllocationCents),
    existingInbound: centsToNullableNumber(projection.existingInboundCents),
    inboundAfterCandidate: centsToNullableNumber(projection.inboundAfterCandidateCents),
    currentLandedLineCost: centsToNullableNumber(projection.currentLandedLineCostCents),
    projectedLandedLineCost: centsToNullableNumber(projection.projectedLandedLineCostCents),
    currentLandedUnitCost: projection.currentLandedUnitCost,
    projectedLandedUnitCost: projection.projectedLandedUnitCost,
    originalCurrencyComparable: projection.originalCurrencyComparable,
    goodsCostEur: centsToNullableNumber(projection.goodsCostEurCents),
    currentAllocationEur: centsToNullableNumber(projection.currentAllocationEurCents),
    candidateAllocationEur: centsToNullableNumber(projection.candidateAllocationEurCents),
    existingInboundEur: centsToNullableNumber(projection.existingInboundEurCents),
    inboundAfterCandidateEur: centsToNullableNumber(projection.inboundAfterCandidateEurCents),
    currentLandedLineCostEur: centsToNullableNumber(projection.currentLandedLineCostEurCents),
    projectedLandedLineCostEur: centsToNullableNumber(projection.projectedLandedLineCostEurCents),
    currentLandedUnitCostEur: projection.currentLandedUnitCostEur,
    projectedLandedUnitCostEur: projection.projectedLandedUnitCostEur,
  };
}

function centsToNullableNumber(cents: number | null | undefined) {
  return cents === null || cents === undefined ? null : centsToNumber(cents);
}

function toSupplierBatchAllocationDto(
  allocation: AdminSupplierBatchChargeAllocation | RpcAllocation
) {
  const contextualAllocation = allocation as AdminSupplierBatchChargeAllocation & {
    currency?: string | null;
    originalCurrencyComparable?: boolean | null;
  };
  const hasEurFields =
    "goodsCostSnapshotEurCents" in allocation ||
    "allocatedAmountEurCents" in allocation ||
    "allocatedUnitAmountEur" in allocation ||
    "landedLineCostEurCents" in allocation ||
    "landedUnitCostEur" in allocation ||
    "roundingAdjustmentEurCents" in allocation;

  return {
    ...(allocation.allocationId === null || allocation.allocationId === undefined
      ? {}
      : { allocationId: allocation.allocationId }),
    ...(allocation.batchId === null || allocation.batchId === undefined
      ? {}
      : { batchId: allocation.batchId }),
    ...(allocation.chargeId === null || allocation.chargeId === undefined
      ? {}
      : { chargeId: allocation.chargeId }),
    batchLineId: allocation.batchLineId,
    ...(contextualAllocation.currency === undefined
      ? {}
      : { currency: contextualAllocation.currency }),
    ...(contextualAllocation.originalCurrencyComparable === undefined
      ? {}
      : { originalCurrencyComparable: contextualAllocation.originalCurrencyComparable }),
    lineNo: allocation.lineNo,
    skuCode: allocation.skuCode,
    qtyReceivedSnapshot: allocation.qtyReceivedSnapshot,
    goodsCostSnapshot: centsToNumber(allocation.goodsCostSnapshotCents),
    weightGramSnapshot: allocation.weightGramSnapshot,
    metadata: toSupplierBatchSafeMetadata(allocation.metadata),
    allocatedAmount: centsToNumber(allocation.allocatedAmountCents),
    allocatedUnitAmount: allocation.allocatedUnitAmount,
    basisValue: allocation.basisValue,
    shareRatio: allocation.shareRatio,
    landedLineCost: centsToNullableNumber(allocation.landedLineCostCents),
    landedUnitCost: allocation.landedUnitCost,
    roundingAdjustment: centsToNumber(allocation.roundingAdjustmentCents),
    ...(hasEurFields
      ? {
          goodsCostSnapshotEur: centsToNullableNumber(
            allocation.goodsCostSnapshotEurCents
          ),
          allocatedAmountEur: centsToNullableNumber(
            allocation.allocatedAmountEurCents
          ),
          allocatedUnitAmountEur: allocation.allocatedUnitAmountEur ?? null,
          landedLineCostEur: centsToNullableNumber(
            allocation.landedLineCostEurCents
          ),
          landedUnitCostEur: allocation.landedUnitCostEur ?? null,
          roundingAdjustmentEur: centsToNullableNumber(
            allocation.roundingAdjustmentEurCents
          ),
        }
      : {}),
    createdAt: allocation.createdAt,
    updatedAt: allocation.updatedAt,
  };
}

function toSupplierBatchManualAllocationDto(
  allocation: AdminSupplierBatchCostRpcResult["manualAllocationsSnapshot"][number]
) {
  return {
    batchLineId: allocation.batchLineId,
    amount: centsToNumber(allocation.amountCents),
  };
}

function toSupplierBatchCorrectionPreviewTotalsDto(
  totals: AdminSupplierBatchCorrectionPreviewTotals
) {
  return {
    otherEffectiveCostEur: centsToNumber(totals.otherEffectiveCostEurCents),
    originalChargeEur: centsToNumber(totals.originalChargeEurCents),
    replacementChargeEur: centsToNumber(totals.replacementChargeEurCents),
    beforeTotalEur: centsToNumber(totals.beforeTotalEurCents),
    afterTotalEur: centsToNumber(totals.afterTotalEurCents),
    costDeltaEur: centsToNumber(totals.costDeltaEurCents),
  };
}

const SUPPLIER_BATCH_SAFE_METADATA_KEYS = new Set([
  "source",
  "cancelReason",
  "cancelledAt",
  "allocationMethod",
  "lineNo",
  "skuCode",
]);

function toSupplierBatchSafeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!SUPPLIER_BATCH_SAFE_METADATA_KEYS.has(key)) {
      continue;
    }
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "boolean" ||
      (typeof item === "number" && Number.isFinite(item))
    ) {
      result[key] = item;
    }
  }
  return result;
}

function toSupplierBatchRpcChargeFields(
  context: SupplierBatchCostRpcRequestContext
) {
  return {
    chargeType: context.chargeType,
    vatTreatment: context.vatTreatment,
    allocationMethod: context.allocationMethod,
    carrierName: context.carrierName,
    reference: context.reference,
    occurredAt: context.occurredAt,
    evidenceUrl: context.evidenceUrl,
    notes: context.notes,
    zeroCostReason: context.zeroCostReason,
    ...(context.fxRateToEur === undefined
      ? {}
      : {
          fxRateToEur: context.fxRateToEur,
          fxRateDate: context.fxRateDate,
          fxRateSource: context.fxRateSource,
          fxEvidenceUrl: context.fxEvidenceUrl,
        }),
    ...(context.batchGoodsValueFxRateToEur === undefined
      ? {}
      : {
          batchGoodsValueFxRateToEur: context.batchGoodsValueFxRateToEur,
          batchGoodsValueFxDate: context.batchGoodsValueFxDate,
          batchGoodsValueFxSource: context.batchGoodsValueFxSource,
          batchGoodsValueFxEvidenceUrl: context.batchGoodsValueFxEvidenceUrl,
        }),
  };
}

function requireSupplierBatchCostRpcRequestContext(
  context: unknown
): SupplierBatchCostRpcRequestContext {
  if (!isRecord(context)) {
    throw new TypeError("Supplier batch cost RPC request context is required.");
  }

  if (
    typeof context.batchCode !== "string" ||
    context.batchCode.trim() === "" ||
    !isSupplierBatchChargeType(context.chargeType) ||
    !isSupplierBatchVatTreatment(context.vatTreatment) ||
    !isSupplierBatchAllocationMethod(context.allocationMethod) ||
    (context.currency !== "EUR" &&
      context.currency !== "USD" &&
      context.currency !== "CNY")
  ) {
    throw new TypeError(
      "Supplier batch cost RPC request context is missing validated charge fields."
    );
  }

  assertNullableContextText(context.carrierName, "carrierName");
  assertNullableContextText(context.reference, "reference");
  assertNullableContextText(context.occurredAt, "occurredAt");
  assertNullableContextText(context.evidenceUrl, "evidenceUrl");
  assertNullableContextText(context.notes, "notes");
  assertNullableContextText(context.zeroCostReason, "zeroCostReason");
  assertOptionalContextNumber(context.fxRateToEur, "fxRateToEur");
  assertOptionalContextText(context.fxRateDate, "fxRateDate");
  assertOptionalContextText(context.fxRateSource, "fxRateSource");
  assertOptionalContextText(context.fxEvidenceUrl, "fxEvidenceUrl");
  assertOptionalContextNumber(
    context.batchGoodsValueFxRateToEur,
    "batchGoodsValueFxRateToEur"
  );
  assertOptionalContextText(context.batchGoodsValueFxDate, "batchGoodsValueFxDate");
  assertOptionalContextText(
    context.batchGoodsValueFxSource,
    "batchGoodsValueFxSource"
  );
  assertOptionalContextText(
    context.batchGoodsValueFxEvidenceUrl,
    "batchGoodsValueFxEvidenceUrl"
  );

  return context as SupplierBatchCostRpcRequestContext;
}

function assertNullableContextText(value: unknown, fieldName: string) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new TypeError(
      `Supplier batch cost RPC request context ${fieldName} is invalid.`
    );
  }
}

function assertOptionalContextText(value: unknown, fieldName: string) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new TypeError(
      `Supplier batch cost RPC request context ${fieldName} is invalid.`
    );
  }
}

function assertOptionalContextNumber(value: unknown, fieldName: string) {
  if (
    value !== undefined &&
    (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
  ) {
    throw new TypeError(
      `Supplier batch cost RPC request context ${fieldName} is invalid.`
    );
  }
}

function isSupplierBatchChargeType(value: unknown): value is AdminSupplierBatchCharge["chargeType"] {
  return (
    value === "transport" ||
    value === "insurance" ||
    value === "customs" ||
    value === "handling" ||
    value === "other"
  );
}

function isSupplierBatchVatTreatment(
  value: unknown
): value is AdminSupplierBatchCharge["vatTreatment"] {
  return value === "recoverable" || value === "non_recoverable" || value === "unknown";
}

function isSupplierBatchAllocationMethod(
  value: unknown
): value is AdminSupplierBatchCharge["allocationMethod"] {
  return (
    value === "goods_value" ||
    value === "received_qty" ||
    value === "weight" ||
    value === "manual"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RpcAllocation = AdminSupplierBatchCostRpcResult["candidateAllocations"][number];

type AdminSupplierBatchChargeWithAllocations = AdminSupplierBatchCharge & {
  allocations?: AdminSupplierBatchChargeAllocation[];
};

type AdminSupplierBatchDetailWithAllocations = AdminSupplierBatchDetail & {
  allocations?: AdminSupplierBatchChargeAllocation[];
};
