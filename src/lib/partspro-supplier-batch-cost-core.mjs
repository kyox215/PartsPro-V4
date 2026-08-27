const MAX_MONEY_CENTS = 1_000_000_000_000;
const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNED_MONEY_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

export const SUPPLIER_BATCH_COST_STATUSES = Object.freeze([
  "unrecorded",
  "estimated",
  "confirmed_zero",
  "confirmed",
  "needs_review",
]);

export const SUPPLIER_BATCH_CHARGE_STATUSES = Object.freeze([
  "estimated",
  "confirmed",
  "cancelled",
]);

export const SUPPLIER_BATCH_CHARGE_TYPES = Object.freeze([
  "transport",
  "insurance",
  "customs",
  "handling",
  "other",
]);

export const SUPPLIER_BATCH_VAT_TREATMENTS = Object.freeze([
  "recoverable",
  "non_recoverable",
  "unknown",
]);

export const SUPPLIER_BATCH_ALLOCATION_METHODS = Object.freeze([
  "goods_value",
  "received_qty",
  "weight",
  "manual",
]);

export const SUPPLIER_BATCH_REVIEW_CODES = Object.freeze([
  "NON_EUR_BATCH",
  "PRODUCT_MAPPING_REQUIRED",
  "WEIGHT_REQUIRED_FOR_ESTIMATE",
  "FINANCIAL_ADJUSTMENT_REQUIRED",
]);

const SUPPLIER_BATCH_RPC_STATUSES = new Set([
  "preview",
  ...SUPPLIER_BATCH_CHARGE_STATUSES,
]);

export function supplierBatchMoneyToCents(value, fieldName = "amount") {
  void fieldName;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }

    const cents = Math.round(value * 100);
    if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) {
      return null;
    }

    if (Math.abs(value - cents / 100) > 1e-8) {
      return null;
    }

    return cents;
  }

  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  if (!MONEY_PATTERN.test(text)) {
    return null;
  }

  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) {
    return null;
  }

  return cents;
}

export function supplierBatchMoneyCentsToNumber(cents) {
  return Number.isSafeInteger(cents) && cents >= 0
    ? Number((cents / 100).toFixed(2))
    : null;
}

export function supplierBatchSumMoneyCents(values) {
  if (!Array.isArray(values)) {
    return null;
  }

  let total = 0;
  for (const value of values) {
    const cents = supplierBatchMoneyToCents(value);
    if (cents === null || total > MAX_MONEY_CENTS - cents) {
      return null;
    }
    total += cents;
  }

  return total;
}

export function supplierBatchExportRowCount(scope, batches, details) {
  if (!Array.isArray(batches) || !Array.isArray(details)) {
    return null;
  }
  if (scope === "batches") {
    return batches.length;
  }
  if (scope === "lines" || scope === "charges") {
    let total = 0;
    for (const detail of details) {
      if (!isRecord(detail)) {
        return null;
      }
      const rows = detail[scope];
      if (!Array.isArray(rows)) {
        return null;
      }
      total += rows.length;
    }
    return total;
  }
  return null;
}

export function normalizeSupplierBatchCostStatus(value) {
  return typeof value === "string" && SUPPLIER_BATCH_COST_STATUSES.includes(value)
    ? value
    : null;
}

export function normalizeSupplierBatchChargeStatus(value) {
  return typeof value === "string" && SUPPLIER_BATCH_CHARGE_STATUSES.includes(value)
    ? value
    : null;
}

export function normalizeSupplierBatchCostSummary(value) {
  if (!isRecord(value)) {
    return null;
  }

  const batchId = readIdentifier(value, "batchId", "batch_id");
  const batchCode = readString(value, "batchCode", "batch_code");
  const currency = readString(value, "currency");
  const goodsValueCents = readMoney(value, "goodsValue", "goods_value");
  const costStatus = normalizeSupplierBatchCostStatus(value.costStatus ?? value.cost_status);
  const confirmationBlocked = value.confirmationBlocked ?? value.confirmation_blocked;
  const reviewCodes = normalizeReviewCodes(value.reviewCodes ?? value.review_codes);

  if (
    !batchId ||
    !batchCode ||
    !currency ||
    goodsValueCents === null ||
    !costStatus ||
    typeof confirmationBlocked !== "boolean" ||
    reviewCodes === null
  ) {
    return null;
  }

  const estimatedCount = readCount(value, "estimatedCount", "estimated_count");
  const confirmedCount = readCount(value, "confirmedCount", "confirmed_count");
  const cancelledCount = readCount(value, "cancelledCount", "cancelled_count");
  const estimatedNetCents = readMoney(value, "estimatedNet", "estimated_net");
  const estimatedVatCents = readMoney(value, "estimatedVat", "estimated_vat");
  const estimatedGrossCents = readMoney(value, "estimatedGross", "estimated_gross");
  const estimatedCapitalizedCents = readMoney(
    value,
    "estimatedCapitalized",
    "estimated_capitalized"
  );
  const confirmedNetCents = readMoney(value, "confirmedNet", "confirmed_net");
  const confirmedVatCents = readMoney(value, "confirmedVat", "confirmed_vat");
  const confirmedGrossCents = readMoney(value, "confirmedGross", "confirmed_gross");
  const confirmedCapitalizedCents = readMoney(
    value,
    "confirmedCapitalized",
    "confirmed_capitalized"
  );
  const confirmedLandedTotalCents = readMoney(
    value,
    "confirmedLandedTotal",
    "confirmed_landed_total"
  );
  const projectedLandedTotalCents = readMoney(
    value,
    "projectedLandedTotal",
    "projected_landed_total"
  );

  if (
    [
      estimatedCount,
      confirmedCount,
      cancelledCount,
      estimatedNetCents,
      estimatedVatCents,
      estimatedGrossCents,
      estimatedCapitalizedCents,
      confirmedNetCents,
      confirmedVatCents,
      confirmedGrossCents,
      confirmedCapitalizedCents,
      confirmedLandedTotalCents,
      projectedLandedTotalCents,
    ].some((item) => item === null)
  ) {
    return null;
  }

  if (
    estimatedGrossCents !== estimatedNetCents + estimatedVatCents ||
    confirmedGrossCents !== confirmedNetCents + confirmedVatCents ||
    estimatedCapitalizedCents > estimatedGrossCents ||
    confirmedCapitalizedCents > confirmedGrossCents ||
    confirmedLandedTotalCents !== goodsValueCents + confirmedCapitalizedCents ||
    projectedLandedTotalCents !==
      confirmedLandedTotalCents + estimatedCapitalizedCents ||
    (estimatedCount === 0 &&
      (estimatedNetCents !== 0 ||
        estimatedVatCents !== 0 ||
        estimatedGrossCents !== 0 ||
        estimatedCapitalizedCents !== 0)) ||
    (confirmedCount === 0 &&
      (confirmedNetCents !== 0 ||
        confirmedVatCents !== 0 ||
        confirmedGrossCents !== 0 ||
        confirmedCapitalizedCents !== 0)) ||
    confirmationBlocked !== (reviewCodes.length > 0)
  ) {
    return null;
  }

  const expectedStatus = reviewCodes.length > 0
    ? "needs_review"
    : estimatedCount > 0
      ? "estimated"
      : confirmedCount > 0 && confirmedCapitalizedCents === 0
        ? "confirmed_zero"
        : confirmedCount > 0
          ? "confirmed"
          : "unrecorded";

  if (costStatus !== expectedStatus) {
    return null;
  }

  return {
    batchId,
    batchCode,
    currency,
    goodsValueCents,
    estimatedCount,
    confirmedCount,
    cancelledCount,
    estimatedNetCents,
    estimatedVatCents,
    estimatedGrossCents,
    estimatedCapitalizedCents,
    confirmedNetCents,
    confirmedVatCents,
    confirmedGrossCents,
    confirmedCapitalizedCents,
    confirmedLandedTotalCents,
    projectedLandedTotalCents,
    confirmationBlocked,
    reviewCodes,
    costStatus,
  };
}

export function normalizeSupplierBatchCharge(value) {
  return normalizeChargeSnapshot(value, true);
}

export function normalizeSupplierBatchLineProjection(value) {
  if (!isRecord(value)) {
    return null;
  }

  const batchLineId = readIdentifier(value, "batchLineId", "batch_line_id");
  const lineNo = readCount(value, "lineNo", "line_no");
  const qtyReceived = readCount(value, "qtyReceived", "qty_received");
  const weightGramField = readStrictNullableDecimal(value, "weightGram", "weight_gram");
  const skuCode = readNullableString(value, "skuCode", "sku_code");
  const goodsCostCents = readMoney(value, "goodsCost", "goods_cost");
  const goodsUnitCostField = readStrictNullableDecimal(
    value,
    "goodsUnitCost",
    "goods_unit_cost",
    4
  );
  const currentAllocationCents = readMoney(value, "currentAllocation", "current_allocation");
  const candidateAllocationCents = readMoney(
    value,
    "candidateAllocation",
    "candidate_allocation"
  );
  const existingInboundCents = readMoney(value, "existingInbound", "existing_inbound");
  const inboundAfterCandidateCents = readMoney(
    value,
    "inboundAfterCandidate",
    "inbound_after_candidate"
  );
  const currentLandedLineCostCents = readMoney(
    value,
    "currentLandedLineCost",
    "current_landed_line_cost"
  );
  const projectedLandedLineCostCents = readMoney(
    value,
    "projectedLandedLineCost",
    "projected_landed_line_cost"
  );
  const currentLandedUnitCostField = readStrictNullableDecimal(
    value,
    "currentLandedUnitCost",
    "current_landed_unit_cost",
    4
  );
  const projectedLandedUnitCostField = readStrictNullableDecimal(
    value,
    "projectedLandedUnitCost",
    "projected_landed_unit_cost",
    4
  );

  const weightGram = weightGramField.value;
  const goodsUnitCost = goodsUnitCostField.value;
  const currentLandedUnitCost = currentLandedUnitCostField.value;
  const projectedLandedUnitCost = projectedLandedUnitCostField.value;

  if (
    !batchLineId ||
    lineNo === null ||
    qtyReceived === null ||
    !weightGramField.present ||
    weightGramField.invalid ||
    goodsCostCents === null ||
    !goodsUnitCostField.present ||
    goodsUnitCostField.invalid ||
    currentAllocationCents === null ||
    candidateAllocationCents === null ||
    existingInboundCents === null ||
    inboundAfterCandidateCents === null ||
    currentLandedLineCostCents === null ||
    projectedLandedLineCostCents === null ||
    !currentLandedUnitCostField.present ||
    currentLandedUnitCostField.invalid ||
    !projectedLandedUnitCostField.present ||
    projectedLandedUnitCostField.invalid
  ) {
    return null;
  }

  if (qtyReceived === 0 && (currentLandedUnitCost !== null || projectedLandedUnitCost !== null)) {
    return null;
  }

  if (
    goodsUnitCost === null ||
    goodsCostCents !== roundProductGoodsCostToCents(qtyReceived, goodsUnitCost)
  ) {
    return null;
  }

  if (
    inboundAfterCandidateCents !==
      currentAllocationCents + candidateAllocationCents ||
    currentAllocationCents !== existingInboundCents ||
    currentLandedLineCostCents !== goodsCostCents + existingInboundCents ||
    projectedLandedLineCostCents !== goodsCostCents + inboundAfterCandidateCents
  ) {
    return null;
  }

  if (qtyReceived > 0) {
    const expectedCurrentUnit = roundDecimal(
      currentLandedLineCostCents / 100 / qtyReceived,
      4
    );
    const expectedProjectedUnit = roundDecimal(
      projectedLandedLineCostCents / 100 / qtyReceived,
      4
    );

    if (
      currentLandedUnitCost === null ||
      projectedLandedUnitCost === null ||
      currentLandedUnitCost !== expectedCurrentUnit ||
      projectedLandedUnitCost !== expectedProjectedUnit
    ) {
      return null;
    }
  }

  return {
    batchLineId,
    lineNo,
    skuCode,
    qtyReceived,
    weightGram,
    goodsCostCents,
    goodsUnitCost,
    currentAllocationCents,
    candidateAllocationCents,
    existingInboundCents,
    inboundAfterCandidateCents,
    currentLandedLineCostCents,
    projectedLandedLineCostCents,
    currentLandedUnitCost,
    projectedLandedUnitCost,
  };
}

export function normalizeSupplierBatchCostRpcResult(value) {
  if (!isRecord(value)) {
    return null;
  }

  const status = readString(value, "status");
  const batchId = readIdentifier(value, "batchId", "batch_id");
  const batchCode = readString(value, "batchCode", "batch_code");
  const revision = readString(value, "revision");
  const currency = readString(value, "currency");
  const amountNetCents = readMoney(value, "amountNet", "amount_net");
  const vatAmountCents = readMoney(value, "vatAmount", "vat_amount");
  const amountGrossCents = readMoney(value, "amountGross", "amount_gross");
  const capitalizedAmountCents = readMoney(
    value,
    "capitalizedAmount",
    "capitalized_amount"
  );
  const candidateAllocationTotalCents = readMoney(
    value,
    "candidateAllocationTotal",
    "candidate_allocation_total"
  );
  const confirmedAllocationTotalCents = readMoney(
    value,
    "confirmedAllocationTotal",
    "confirmed_allocation_total"
  );
  const allocationTotalCents = readMoney(value, "allocationTotal", "allocation_total");
  const candidateAllocations = normalizeAllocations(value.candidateAllocations, "rpc");
  const confirmedAllocations = normalizeAllocations(value.confirmedAllocations, "rpc");
  const allocations = normalizeAllocations(value.allocations, "rpc");
  const lineProjections = normalizeLineProjections(value.lineProjections);
  const confirmationBlocked = value.confirmationBlocked;
  const confirmationBlockCode = readNullableString(
    value,
    "confirmationBlockCode",
    "confirmation_block_code"
  );
  const confirmationBlockReason = readNullableString(
    value,
    "confirmationBlockReason",
    "confirmation_block_reason"
  );
  const manualAllocationsSnapshot = normalizeManualSnapshot(
    value.manualAllocationsSnapshot
  );
  const payloadFingerprint = readNullableString(
    value,
    "payloadFingerprint",
    "payload_fingerprint"
  );
  const metadataProvided = "metadata" in value;
  const metadata = metadataProvided ? normalizeMetadata(value.metadata) : null;
  const charge = status === "preview" ? null : normalizeChargeSnapshot(value, true);

  if (
    !status ||
    !SUPPLIER_BATCH_RPC_STATUSES.has(status) ||
    !batchId ||
    !batchCode ||
    !revision ||
    currency !== "EUR" ||
    amountNetCents === null ||
    vatAmountCents === null ||
    amountGrossCents === null ||
    capitalizedAmountCents === null ||
    candidateAllocationTotalCents === null ||
    confirmedAllocationTotalCents === null ||
    allocationTotalCents === null ||
    candidateAllocations === null ||
    confirmedAllocations === null ||
    allocations === null ||
    lineProjections === null ||
    (status === "preview" &&
      !normalizeRpcPreviewChargeEnvelope(
        value,
        batchId,
        batchCode,
        amountNetCents,
        vatAmountCents,
        amountGrossCents,
        capitalizedAmountCents,
        manualAllocationsSnapshot,
        payloadFingerprint,
        metadata,
        metadataProvided
      )) ||
    (status !== "preview" && charge === null) ||
    (confirmationBlocked !== undefined && typeof confirmationBlocked !== "boolean") ||
    amountGrossCents !== amountNetCents + vatAmountCents ||
    capitalizedAmountCents > amountGrossCents ||
    (confirmationBlocked === true &&
      confirmationBlockCode !== "FINANCIAL_ADJUSTMENT_REQUIRED") ||
    (confirmationBlocked !== true && confirmationBlockCode !== null)
  ) {
    return null;
  }

  if (
    charge &&
    (charge.batchId !== batchId ||
      charge.batchCode !== batchCode ||
      charge.currency !== currency ||
      charge.status !== status ||
      charge.amountNetCents !== amountNetCents ||
      charge.vatAmountCents !== vatAmountCents ||
      charge.amountGrossCents !== amountGrossCents ||
      charge.capitalizedAmountCents !== capitalizedAmountCents ||
      charge.chargeType !==
        normalizeEnum(value.chargeType ?? value.charge_type, SUPPLIER_BATCH_CHARGE_TYPES) ||
      charge.vatTreatment !==
        normalizeEnum(value.vatTreatment ?? value.vat_treatment, SUPPLIER_BATCH_VAT_TREATMENTS) ||
      charge.allocationMethod !==
        normalizeEnum(value.allocationMethod ?? value.allocation_method, SUPPLIER_BATCH_ALLOCATION_METHODS) ||
      charge.carrierName !== readNullableString(value, "carrierName", "carrier_name") ||
      charge.reference !== readNullableString(value, "reference") ||
      charge.occurredAt !== readNullableString(value, "occurredAt", "occurred_at") ||
      charge.evidenceUrl !== readNullableString(value, "evidenceUrl", "evidence_url") ||
      charge.notes !== readNullableString(value, "notes") ||
      charge.zeroCostReason !== readNullableString(value, "zeroCostReason", "zero_cost_reason") ||
      charge.manualAllocationsSnapshot.length !== manualAllocationsSnapshot?.length ||
      !manualSnapshotsEqual(charge.manualAllocationsSnapshot, manualAllocationsSnapshot) ||
      charge.payloadFingerprint !== payloadFingerprint ||
      !metadataEqual(charge.metadata, metadata))
  ) {
    return null;
  }

  const candidateAllocationSum = sumNormalizedAllocationCents(candidateAllocations);
  const confirmedAllocationSum = sumNormalizedAllocationCents(confirmedAllocations);
  const effectiveAllocationSum = sumNormalizedAllocationCents(allocations);

  if (
    candidateAllocationSum === null ||
    confirmedAllocationSum === null ||
    effectiveAllocationSum === null ||
    candidateAllocationSum !== candidateAllocationTotalCents ||
    confirmedAllocationSum !== confirmedAllocationTotalCents ||
    effectiveAllocationSum !== allocationTotalCents ||
    (status === "preview" &&
      (candidateAllocationTotalCents !== capitalizedAmountCents ||
        confirmedAllocationTotalCents !== 0 ||
        allocationTotalCents !== capitalizedAmountCents)) ||
    (status === "estimated" &&
      (candidateAllocationTotalCents !== capitalizedAmountCents ||
        confirmedAllocationTotalCents !== 0 ||
        allocationTotalCents !== capitalizedAmountCents)) ||
    (status === "confirmed" &&
      (candidateAllocationTotalCents !== 0 ||
        confirmedAllocationTotalCents !== capitalizedAmountCents ||
        allocationTotalCents !== capitalizedAmountCents)) ||
    (status === "cancelled" &&
      (candidateAllocationTotalCents !== 0 ||
        confirmedAllocationTotalCents !== 0 ||
        allocationTotalCents !== 0)) ||
    !allocationArraysEqual(
      allocations,
      status === "confirmed" ? confirmedAllocations : candidateAllocations
    ) ||
    (status === "confirmed" && candidateAllocations.length !== 0) ||
    (status !== "confirmed" && confirmedAllocations.length !== 0) ||
    (status === "cancelled" && allocations.length !== 0) ||
    !lineProjectionAllocationsMatch(lineProjections, allocations)
  ) {
    return null;
  }

  return {
    status,
    charge,
    batchId,
    batchCode,
    revision,
    currency,
    amountNetCents,
    vatAmountCents,
    amountGrossCents,
    capitalizedAmountCents,
    candidateAllocationTotalCents,
    candidateAllocations,
    confirmedAllocationTotalCents,
    confirmedAllocations,
    allocationTotalCents,
    allocations,
    lineProjections,
    confirmationBlocked: confirmationBlocked ?? null,
    confirmationBlockCode: confirmationBlockCode ?? null,
    confirmationBlockReason: confirmationBlockReason ?? null,
    manualAllocationsSnapshot,
    payloadFingerprint,
    metadata,
  };
}

export function summarizeSupplierBatchLineCosts(lines, allocations) {
  if (!Array.isArray(lines) || !Array.isArray(allocations)) {
    return null;
  }

  const inboundByLine = new Map();
  for (const allocation of allocations) {
    const normalized = normalizeSupplierBatchPersistedAllocation(allocation);
    if (!normalized) {
      return null;
    }

    inboundByLine.set(
      normalized.batchLineId,
      (inboundByLine.get(normalized.batchLineId) ?? 0) + normalized.allocatedAmountCents
    );
  }

  const result = [];
  for (const line of lines) {
    if (!isRecord(line)) {
      return null;
    }

    const batchLineId = readString(line, "id", "batchLineId", "batch_line_id");
    const qtyReceived = readCount(line, "qtyReceived", "qty_received");
    const unitCost = readNullableDecimal(line, "unitCost", "unit_cost");
    const lineTotalCents = readMoney(line, "lineTotal", "line_total");

    if (!batchLineId || qtyReceived === null || unitCost === undefined || lineTotalCents === null) {
      return null;
    }

    if (unitCost === null) {
      return null;
    }

    const goodsCostCents = roundProductGoodsCostToCents(qtyReceived, unitCost);
    if (goodsCostCents === null) {
      return null;
    }

    const confirmedInboundCents = inboundByLine.get(batchLineId) ?? 0;
    const landedLineCostCents = goodsCostCents + confirmedInboundCents;
    const landedUnitCost =
      qtyReceived > 0 ? roundDecimal(landedLineCostCents / 100 / qtyReceived, 4) : null;

    result.push({
      batchLineId,
      goodsCostCents,
      confirmedInboundCents,
      landedLineCostCents,
      goodsUnitCost: unitCost,
      landedUnitCost,
    });
  }

  return result;
}

export function normalizeSupplierBatchChargeAllocation(value) {
  return normalizeSupplierBatchPersistedAllocation(value);
}

export function normalizeSupplierBatchRpcAllocation(value) {
  return normalizeAllocation(value, "rpc");
}

export function normalizeSupplierBatchPersistedAllocation(value) {
  return normalizeAllocation(value, "persisted");
}

function normalizeChargeSnapshot(value, requireId) {
  if (!isRecord(value)) {
    return null;
  }

  const chargeId = readNullableIdentifier(value, "chargeId", "charge_id");
  const batchId = readIdentifier(value, "batchId", "batch_id");
  const batchCode = readString(value, "batchCode", "batch_code");
  const status = normalizeSupplierBatchChargeStatus(value.status);
  const chargeType = normalizeEnum(
    value.chargeType ?? value.charge_type,
    SUPPLIER_BATCH_CHARGE_TYPES
  );
  const currency = readString(value, "currency");
  const vatTreatment = normalizeEnum(
    value.vatTreatment ?? value.vat_treatment,
    SUPPLIER_BATCH_VAT_TREATMENTS
  );
  const allocationMethod = normalizeEnum(
    value.allocationMethod ?? value.allocation_method,
    SUPPLIER_BATCH_ALLOCATION_METHODS
  );
  const amountNetCents = readMoney(value, "amountNet", "amount_net");
  const vatAmountCents = readMoney(value, "vatAmount", "vat_amount");
  const amountGrossCents = readMoney(value, "amountGross", "amount_gross");
  const capitalizedAmountCents = readMoney(
    value,
    "capitalizedAmount",
    "capitalized_amount"
  );
  const manualAllocationsSnapshot = normalizeManualSnapshot(
    value.manualAllocationsSnapshot ?? value.manual_allocations_snapshot
  );
  const metadata = normalizeMetadata(value.metadata);
  const zeroCostReason = readNullableString(value, "zeroCostReason", "zero_cost_reason");
  const idempotencyKey = readNullableString(value, "idempotencyKey", "idempotency_key");
  const payloadFingerprint = readNullableString(
    value,
    "payloadFingerprint",
    "payload_fingerprint"
  );
  const confirmedBy = readNullableIdentifier(value, "confirmedBy", "confirmed_by");
  const confirmedByProvided = "confirmedBy" in value || "confirmed_by" in value;
  const confirmedAt = readNullableString(value, "confirmedAt", "confirmed_at");
  const confirmedAtProvided = "confirmedAt" in value || "confirmed_at" in value;

  if (
    (requireId && !chargeId) ||
    (requireId && (!idempotencyKey || !payloadFingerprint)) ||
    (confirmedByProvided && value.confirmedBy !== null && value.confirmed_by !== null && !confirmedBy) ||
    (confirmedAtProvided && value.confirmedAt !== null && value.confirmed_at !== null && !confirmedAt) ||
    (status === "confirmed" && (!confirmedBy || !confirmedAt)) ||
    !batchId ||
    !batchCode ||
    !status ||
    !chargeType ||
    currency !== "EUR" ||
    !vatTreatment ||
    !allocationMethod ||
    amountNetCents === null ||
    vatAmountCents === null ||
    amountGrossCents === null ||
    capitalizedAmountCents === null ||
    manualAllocationsSnapshot === null ||
    metadata === null ||
    amountGrossCents !== amountNetCents + vatAmountCents ||
    capitalizedAmountCents > amountGrossCents ||
    (capitalizedAmountCents === 0 && !zeroCostReason) ||
    (status === "confirmed" && vatTreatment === "unknown")
  ) {
    return null;
  }

  return {
    chargeId,
    batchId,
    batchCode,
    status,
    chargeType,
    amountNetCents,
    vatAmountCents,
    amountGrossCents,
    capitalizedAmountCents,
    currency,
    vatTreatment,
    allocationMethod,
    carrierName: readNullableString(value, "carrierName", "carrier_name"),
    reference: readNullableString(value, "reference"),
    occurredAt: readNullableString(value, "occurredAt", "occurred_at"),
    evidenceUrl: readNullableString(value, "evidenceUrl", "evidence_url"),
    notes: readNullableString(value, "notes"),
    zeroCostReason,
    idempotencyKey,
    payloadFingerprint,
    manualAllocationsSnapshot,
    metadata,
    createdBy: readNullableString(value, "createdBy", "created_by"),
    updatedBy: readNullableString(value, "updatedBy", "updated_by"),
    confirmedBy,
    confirmedAt,
    createdAt: readNullableString(value, "createdAt", "created_at"),
    updatedAt: readNullableString(value, "updatedAt", "updated_at"),
  };
}

function normalizeRpcPreviewChargeEnvelope(
  value,
  batchId,
  batchCode,
  amountNetCents,
  vatAmountCents,
  amountGrossCents,
  capitalizedAmountCents,
  manualAllocationsSnapshot,
  payloadFingerprint,
  metadata,
  metadataProvided
) {
  return (
    readString(value, "batchId", "batch_id") === batchId &&
    readString(value, "batchCode", "batch_code") === batchCode &&
    normalizeEnum(value.chargeType ?? value.charge_type, SUPPLIER_BATCH_CHARGE_TYPES) !==
      null &&
    normalizeEnum(value.vatTreatment ?? value.vat_treatment, SUPPLIER_BATCH_VAT_TREATMENTS) !==
      null &&
    normalizeEnum(value.allocationMethod ?? value.allocation_method, SUPPLIER_BATCH_ALLOCATION_METHODS) !==
      null &&
    readString(value, "currency") === "EUR" &&
    amountNetCents !== null &&
    vatAmountCents !== null &&
    amountGrossCents === amountNetCents + vatAmountCents &&
    capitalizedAmountCents !== null &&
    capitalizedAmountCents <= amountGrossCents &&
    (capitalizedAmountCents > 0 ||
      Boolean(readNullableString(value, "zeroCostReason", "zero_cost_reason"))) &&
    manualAllocationsSnapshot !== null &&
    Boolean(payloadFingerprint) &&
    (!metadataProvided || metadata !== null)
  );
}

function allocationArraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  const leftByLine = new Map(left.map((item) => [item.batchLineId, item]));
  const rightByLine = new Map(right.map((item) => [item.batchLineId, item]));
  if (leftByLine.size !== left.length || rightByLine.size !== right.length) {
    return false;
  }

  for (const [batchLineId, item] of leftByLine) {
    const counterpart = rightByLine.get(batchLineId);
    if (!counterpart || !allocationFinancialFieldsEqual(item, counterpart)) {
      return false;
    }
  }

  return true;
}

function allocationFinancialFieldsEqual(left, right) {
  return (
    left.batchLineId === right.batchLineId &&
    left.lineNo === right.lineNo &&
    left.skuCode === right.skuCode &&
    left.qtyReceivedSnapshot === right.qtyReceivedSnapshot &&
    left.goodsCostSnapshotCents === right.goodsCostSnapshotCents &&
    left.weightGramSnapshot === right.weightGramSnapshot &&
    left.basisValue === right.basisValue &&
    left.shareRatio === right.shareRatio &&
    left.allocatedAmountCents === right.allocatedAmountCents &&
    left.allocatedUnitAmount === right.allocatedUnitAmount &&
    left.landedLineCostCents === right.landedLineCostCents &&
    left.landedUnitCost === right.landedUnitCost &&
    left.roundingAdjustmentCents === right.roundingAdjustmentCents &&
    metadataEqual(left.metadata, right.metadata)
  );
}

function lineProjectionAllocationsMatch(projections, allocations) {
  const projectionIds = new Set();
  const allocationByLine = new Map();

  for (const allocation of allocations) {
    if (allocationByLine.has(allocation.batchLineId)) {
      return false;
    }
    allocationByLine.set(allocation.batchLineId, allocation);
  }

  for (const projection of projections) {
    if (projectionIds.has(projection.batchLineId)) {
      return false;
    }
    projectionIds.add(projection.batchLineId);
    const allocation = allocationByLine.get(projection.batchLineId);
    const expected = allocation?.allocatedAmountCents ?? 0;
    if (projection.candidateAllocationCents !== expected) {
      return false;
    }
  }

  for (const batchLineId of allocationByLine.keys()) {
    if (!projectionIds.has(batchLineId)) {
      return false;
    }
  }

  return true;
}

function manualSnapshotsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const counterpart = right[index];
    return (
      item.batchLineId === counterpart.batchLineId &&
      item.amountCents === counterpart.amountCents
    );
  });
}

function metadataEqual(left, right) {
  return stableJson(left) === stableJson(right);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeAllocations(value, mode = "rpc") {
  if (!Array.isArray(value)) {
    return null;
  }

  const result = [];
  for (const item of value) {
    const normalized = normalizeAllocation(item, mode);
    if (!normalized) {
      return null;
    }
    result.push(normalized);
  }
  return result;
}

function normalizeAllocation(value, mode = "rpc") {
  if (!isRecord(value)) {
    return null;
  }

  const batchLineId = readIdentifier(value, "batchLineId", "batch_line_id");
  const allocatedAmountCents = readMoneyOrCents(
    value,
    "allocatedAmount",
    "allocated_amount",
    "allocatedAmountCents"
  );
  const qtyReceivedSnapshot = readCountOrNullable(
    value,
    "qtyReceivedSnapshot",
    "qty_received_snapshot"
  );
  const goodsCostSnapshotCents = readMoneyOrCents(
    value,
    "goodsCostSnapshot",
    "goods_cost_snapshot",
    "goodsCostSnapshotCents"
  );
  const weightGramSnapshotField = readStrictNullableCount(
    value,
    "weightGramSnapshot",
    "weight_gram_snapshot"
  );
  const weightGramSnapshot = weightGramSnapshotField.value;
  const roundingAdjustmentCents = readSignedMoneyOrCents(
    value,
    "roundingAdjustment",
    "rounding_adjustment",
    "roundingAdjustmentCents"
  );
  const allocationId = readNullableIdentifier(value, "allocationId", "id");
  const batchId = readNullableIdentifier(value, "batchId", "batch_id");
  const chargeId = readNullableIdentifier(value, "chargeId", "charge_id");
  const hasAllocationId = "allocationId" in value || "id" in value;
  const hasBatchId = "batchId" in value || "batch_id" in value;
  const hasChargeId = "chargeId" in value || "charge_id" in value;
  const landedLineCostCents = readMoneyOrCents(
    value,
    "landedLineCost",
    "landed_line_cost",
    "landedLineCostCents"
  );
  const landedLineCostProvided =
    "landedLineCost" in value || "landed_line_cost" in value || "landedLineCostCents" in value;
  const landedUnitCostField = readStrictNullableDecimal(
    value,
    "landedUnitCost",
    "landed_unit_cost",
    4
  );
  const allocatedUnitAmountField = readStrictNullableDecimal(
    value,
    "allocatedUnitAmount",
    "allocated_unit_amount",
    4
  );
  const basisValueField = readStrictNullableDecimal(value, "basisValue", "basis_value", 8);
  const shareRatioField = readStrictNullableDecimal(value, "shareRatio", "share_ratio", 12);
  const metadataProvided = "metadata" in value;
  const metadata = metadataProvided ? normalizeMetadata(value.metadata) : mode === "rpc" ? {} : null;
  const lineNoField = readStrictNullableCount(value, "lineNo", "line_no");
  const lineNo = lineNoField.value;
  const skuCodeProvided = "skuCode" in value || "sku_code" in value;
  const skuCodeRaw = value.skuCode ?? value.sku_code;
  const skuCode =
    !skuCodeProvided || skuCodeRaw === null || skuCodeRaw === undefined
      ? null
      : typeof skuCodeRaw === "string" && skuCodeRaw.trim()
        ? skuCodeRaw.trim()
        : null;
  const landedLineCostRaw = value.landedLineCost ?? value.landed_line_cost;
  const allocatedUnitAmount = allocatedUnitAmountField.value;
  const basisValue = basisValueField.value;
  const shareRatio = shareRatioField.value;
  const landedUnitCost = landedUnitCostField.present ? landedUnitCostField.value : null;

  if (
    !batchLineId ||
    (mode === "persisted" && (!allocationId || !batchId || !chargeId)) ||
    (mode !== "persisted" && hasAllocationId && !allocationId) ||
    (mode !== "persisted" && hasBatchId && !batchId) ||
    (mode !== "persisted" && hasChargeId && !chargeId) ||
    allocatedAmountCents === null ||
    qtyReceivedSnapshot === null ||
    goodsCostSnapshotCents === null ||
    !weightGramSnapshotField.present ||
    weightGramSnapshotField.invalid ||
    (mode === "rpc" && weightGramSnapshot === null) ||
    (mode === "persisted" && weightGramSnapshot === null) ||
    (mode === "rpc" && qtyReceivedSnapshot <= 0) ||
    !allocatedUnitAmountField.present ||
    allocatedUnitAmountField.invalid ||
    allocatedUnitAmount === null ||
    !basisValueField.present ||
    basisValueField.invalid ||
    basisValue === null ||
    !shareRatioField.present ||
    shareRatioField.invalid ||
    shareRatio === null ||
    roundingAdjustmentCents === null ||
    (mode === "persisted" && !metadataProvided) ||
    metadata === null ||
    (lineNoField.invalid ||
      (mode === "rpc" && (!lineNoField.present || lineNo === null)) ||
      (skuCodeProvided && skuCode === null)) ||
    (landedLineCostProvided && landedLineCostCents === null) ||
    (mode === "rpc" && (!landedLineCostProvided || landedLineCostCents === null)) ||
    (landedUnitCostField.invalid) ||
    (mode === "rpc" && (!landedUnitCostField.present || landedUnitCost === null)) ||
    (landedLineCostRaw !== null && landedLineCostRaw !== undefined && landedLineCostCents === null) ||
    roundingAdjustmentCents < -1 ||
    roundingAdjustmentCents > 1 ||
    allocatedUnitAmount < 0 ||
    basisValue < 0 ||
    shareRatio < 0 ||
    shareRatio > 1 ||
    (landedLineCostProvided &&
      landedLineCostCents !== goodsCostSnapshotCents + allocatedAmountCents) ||
    (landedUnitCostField.present &&
      ((qtyReceivedSnapshot === 0 && landedUnitCost !== null) ||
        (qtyReceivedSnapshot > 0 &&
          (landedUnitCost === null ||
            landedLineCostCents === null ||
            landedUnitCost !==
              roundDecimal(landedLineCostCents / 100 / qtyReceivedSnapshot, 4)))))
  ) {
    return null;
  }

  return {
    batchLineId,
    allocationId,
    batchId,
    chargeId,
    lineNo,
    skuCode,
    qtyReceivedSnapshot,
    goodsCostSnapshotCents,
    goodsCostSnapshot: supplierBatchMoneyCentsToNumber(goodsCostSnapshotCents),
    weightGramSnapshot,
    allocatedAmountCents,
    allocatedUnitAmount,
    basisValue,
    shareRatio,
    landedLineCostCents,
    landedLineCost: supplierBatchMoneyCentsToNumber(landedLineCostCents),
    landedUnitCost,
    roundingAdjustmentCents,
    metadata,
    createdAt: readNullableString(value, "createdAt", "created_at"),
    updatedAt: readNullableString(value, "updatedAt", "updated_at"),
  };
}

function normalizeLineProjections(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const result = [];
  for (const item of value) {
    const normalized = normalizeSupplierBatchLineProjection(item);
    if (!normalized) {
      return null;
    }
    result.push(normalized);
  }
  return result;
}

function normalizeReviewCodes(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const codes = [];
  for (const code of value) {
    if (typeof code !== "string" || !SUPPLIER_BATCH_REVIEW_CODES.includes(code)) {
      return null;
    }
    if (codes.includes(code)) {
      return null;
    }
    codes.push(code);
  }
  return codes;
}

function normalizeManualSnapshot(value) {
  if (!Array.isArray(value)) {
    return null;
  }
  const ids = new Set();
  const result = value.map((item) => {
    if (!isRecord(item)) {
      return null;
    }
    const batchLineId = readIdentifier(item, "batchLineId", "batch_line_id");
    const amountCents = readMoney(item, "amount");
    if (!batchLineId || amountCents === null || ids.has(batchLineId)) {
      return null;
    }
    ids.add(batchLineId);
    return { batchLineId, amountCents };
  });

  return result.every(Boolean) ? result : null;
}

function sumNormalizedAllocationCents(values) {
  let total = 0;

  for (const value of values) {
    if (total > MAX_MONEY_CENTS - value.allocatedAmountCents) {
      return null;
    }
    total += value.allocatedAmountCents;
  }

  return total;
}

function normalizeMetadata(value) {
  return isRecord(value) ? value : null;
}

function roundProductGoodsCostToCents(qtyReceived, unitCost) {
  const value = qtyReceived * unitCost;
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  const cents = Math.round((value + Number.EPSILON) * 100);
  return Number.isSafeInteger(cents) && cents <= MAX_MONEY_CENTS ? cents : null;
}

function readMoneyOrCents(value, camelKey, snakeKey, centsKey) {
  if (centsKey in value) {
    const raw = value[centsKey];
    return Number.isSafeInteger(raw) && raw >= 0 && raw <= MAX_MONEY_CENTS ? raw : null;
  }
  return readMoney(value, camelKey, snakeKey);
}

function readSignedMoneyOrCents(value, camelKey, snakeKey, centsKey) {
  if (centsKey in value) {
    const raw = value[centsKey];
    return Number.isSafeInteger(raw) && Math.abs(raw) <= 1 ? raw : null;
  }

  const raw = value[camelKey] ?? value[snakeKey];
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      return null;
    }
    const cents = Math.round(raw * 100);
    return Math.abs(raw - cents / 100) <= 1e-8 && Math.abs(cents) <= 1 ? cents : null;
  }
  if (typeof raw !== "string" || !SIGNED_MONEY_PATTERN.test(raw.trim())) {
    return null;
  }

  const text = raw.trim();
  const sign = text.startsWith("-") ? -1 : 1;
  const unsigned = sign < 0 ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
  return Number.isSafeInteger(cents) && Math.abs(cents) <= 1 ? cents : null;
}

function readMoney(value, camelKey, snakeKey) {
  return supplierBatchMoneyToCents(value[camelKey] ?? value[snakeKey], camelKey);
}

function readIdentifier(value, camelKey, snakeKey) {
  const raw = value[camelKey] ?? value[snakeKey];
  return typeof raw === "string" && UUID_PATTERN.test(raw.trim())
    ? raw.trim().toLowerCase()
    : null;
}

function readNullableIdentifier(value, camelKey, snakeKey) {
  const hasValue = camelKey in value || snakeKey in value;
  if (!hasValue || value[camelKey] === null || value[snakeKey] === null) {
    return null;
  }
  return readIdentifier(value, camelKey, snakeKey);
}

function normalizeEnum(value, allowedValues) {
  return typeof value === "string" && allowedValues.includes(value) ? value : null;
}

function readCount(value, camelKey, snakeKey) {
  const raw = value[camelKey] ?? value[snakeKey];
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function readCountOrNullable(value, camelKey, snakeKey) {
  if (!(camelKey in value) && !(snakeKey in value)) {
    return null;
  }
  const raw = value[camelKey] ?? value[snakeKey];
  if (raw === null || raw === undefined) {
    return null;
  }
  return readCount(value, camelKey, snakeKey);
}

function readStrictNullableCount(value, camelKey, snakeKey) {
  const present = camelKey in value || snakeKey in value;
  if (!present) {
    return { present: false, invalid: false, value: null };
  }

  const raw = value[camelKey] ?? value[snakeKey];
  if (raw === null || raw === undefined) {
    return { present: true, invalid: false, value: null };
  }

  const parsed = readCount(value, camelKey, snakeKey);
  return { present: true, invalid: parsed === null, value: parsed };
}

function readDecimal(raw) {
  return readDecimalWithScale(raw, 12);
}

function readDecimalWithScale(raw, places) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) {
      return null;
    }
    const rounded = roundDecimal(raw, places);
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(raw)) * 8;
    return Math.abs(raw - rounded) <= tolerance ? rounded : null;
  }
  const pattern = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${places}})?$`);
  if (typeof raw === "string" && pattern.test(raw.trim())) {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readNullableDecimal(value, camelKey, snakeKey) {
  if (!(camelKey in value) && !(snakeKey in value)) {
    return undefined;
  }

  const raw = value[camelKey] ?? value[snakeKey];
  if (raw === null || raw === undefined) {
    return null;
  }
  return readDecimal(raw);
}

function readStrictNullableDecimal(value, camelKey, snakeKey, places = 12) {
  const present = camelKey in value || snakeKey in value;
  if (!present) {
    return { present: false, invalid: false, value: undefined };
  }

  const raw = value[camelKey] ?? value[snakeKey];
  if (raw === null || raw === undefined) {
    return { present: true, invalid: false, value: null };
  }

  const parsed = readDecimalWithScale(raw, places);
  return { present: true, invalid: parsed === null, value: parsed };
}

function readString(value, camelKey, snakeKey) {
  const raw = value[camelKey] ?? value[snakeKey];
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readNullableString(value, camelKey, snakeKey) {
  const raw = value[camelKey] ?? value[snakeKey];
  if (raw === null || raw === undefined) {
    return null;
  }
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function roundDecimal(value, places) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
