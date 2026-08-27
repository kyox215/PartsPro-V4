import { centsToNumber } from "@/lib/partspro-api";
import {
  type AdminSupplierBatch,
  type AdminSupplierBatchCharge,
  type AdminSupplierBatchChargeAllocation,
  type AdminSupplierBatchCostRpcResult,
  type AdminSupplierBatchCostSummary,
  type AdminSupplierBatchDetail,
  type AdminSupplierBatchLine,
  type AdminSupplierBatchLineProduct,
  type AdminSupplierBatchLineProjection,
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
    confirmedLandedTotal: centsToNumber(summary.confirmedLandedTotalCents),
    projectedLandedTotal: centsToNumber(summary.projectedLandedTotalCents),
    confirmationBlocked: summary.confirmationBlocked,
    reviewCodes: summary.reviewCodes,
    costStatus: summary.costStatus,
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
    metadata: charge.metadata,
    createdBy: charge.createdBy,
    updatedBy: charge.updatedBy,
    confirmedBy: charge.confirmedBy,
    confirmedAt: charge.confirmedAt,
    createdAt: charge.createdAt,
    updatedAt: charge.updatedAt,
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
  };
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
    costSummary: batch.costSummary
      ? toSupplierBatchCostSummaryDto(batch.costSummary)
      : null,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

export function toSupplierBatchDetailDto(detail: AdminSupplierBatchDetail) {
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
    costPrice: product.costPrice,
    retailPrice: product.retailPrice,
    b2bPrice: product.b2bPrice,
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
    currentAllocation: centsToNumber(projection.currentAllocationCents),
    candidateAllocation: centsToNumber(projection.candidateAllocationCents),
    existingInbound: centsToNumber(projection.existingInboundCents),
    inboundAfterCandidate: centsToNumber(projection.inboundAfterCandidateCents),
    currentLandedLineCost: centsToNumber(projection.currentLandedLineCostCents),
    projectedLandedLineCost: centsToNumber(projection.projectedLandedLineCostCents),
    currentLandedUnitCost: projection.currentLandedUnitCost,
    projectedLandedUnitCost: projection.projectedLandedUnitCost,
  };
}

function toSupplierBatchAllocationDto(
  allocation: AdminSupplierBatchChargeAllocation | RpcAllocation
) {
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
    lineNo: allocation.lineNo,
    skuCode: allocation.skuCode,
    qtyReceivedSnapshot: allocation.qtyReceivedSnapshot,
    goodsCostSnapshot: centsToNumber(allocation.goodsCostSnapshotCents),
    weightGramSnapshot: allocation.weightGramSnapshot,
    metadata: allocation.metadata,
    allocatedAmount: centsToNumber(allocation.allocatedAmountCents),
    allocatedUnitAmount: allocation.allocatedUnitAmount,
    basisValue: allocation.basisValue,
    shareRatio: allocation.shareRatio,
    landedLineCost: centsToNullableNumber(allocation.landedLineCostCents),
    landedUnitCost: allocation.landedUnitCost,
    roundingAdjustment: centsToNumber(allocation.roundingAdjustmentCents),
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
    context.currency !== "EUR"
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

  return context as SupplierBatchCostRpcRequestContext;
}

function assertNullableContextText(value: unknown, fieldName: string) {
  if (value !== undefined && value !== null && typeof value !== "string") {
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

function centsToNullableNumber(value: number | null) {
  return value === null ? null : centsToNumber(value);
}

type RpcAllocation = AdminSupplierBatchCostRpcResult["candidateAllocations"][number];

type AdminSupplierBatchChargeWithAllocations = AdminSupplierBatchCharge & {
  allocations?: AdminSupplierBatchChargeAllocation[];
};

type AdminSupplierBatchDetailWithAllocations = AdminSupplierBatchDetail & {
  allocations?: AdminSupplierBatchChargeAllocation[];
};
