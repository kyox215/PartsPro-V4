// finance_cost_layers.total_cost_net and its inbound/goods breakdown use
// numeric(12,2); keep the JS boundary at that column's exact largest value
// (9,999,999,999.99), rather than the wider V2 charge snapshot columns.
const MAX_MONEY_CENTS = 999_999_999_999;
const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNED_MONEY_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const FX_RATE_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/;
const MIN_FX_RATE = 0.000001;
const MAX_FX_RATE = 1_000_000;
// finance_cost_layers.unit_cost_net and its goods/unit breakdown are
// numeric(12,4): eight integer digits plus four decimal places.
const MAX_FINANCE_UNIT_VALUE = 99_999_999.9999;

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

export const SUPPLIER_BATCH_CORRECTION_RECEIPT_STATUSES = Object.freeze([
  "corrected",
  "pending_finance_adjustment",
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
  "MIXED_CURRENCY",
  "PRODUCT_MAPPING_REQUIRED",
  "WEIGHT_REQUIRED_FOR_ESTIMATE",
  "FINANCIAL_ADJUSTMENT_REQUIRED",
  "FINANCE_ADJUSTMENT_REQUIRED",
  "BATCH_FX_RATE_REQUIRED",
]);

export const SUPPLIER_BATCH_CURRENCIES = Object.freeze(["EUR", "USD", "CNY"]);
export const SUPPLIER_BATCH_BASE_CURRENCY = "EUR";

export function normalizeSupplierBatchCurrency(value) {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : "";
  return SUPPLIER_BATCH_CURRENCIES.includes(currency) ? currency : null;
}

export function normalizeSupplierBatchFxRate(value) {
  const raw = typeof value === "string" ? value.trim() : value;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < MIN_FX_RATE || raw > MAX_FX_RATE) {
      return null;
    }
    const rounded = roundDecimal(raw, 12);
    return Math.abs(raw - rounded) <= Number.EPSILON * Math.max(1, Math.abs(raw)) * 8
      ? rounded
      : null;
  }
  if (typeof raw !== "string" || !FX_RATE_PATTERN.test(raw) || raw === "0") {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= MIN_FX_RATE && parsed <= MAX_FX_RATE
    ? parsed
    : null;
}

/**
 * Convert a non-negative amount in original-currency cents to EUR cents.
 * The rate is represented as a decimal string/number and rounded half-up
 * using integer arithmetic so preview and confirmation share one result.
 */
export function supplierBatchFxAmountToEurCents(amountCents, rate) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > MAX_MONEY_CENTS) {
    return null;
  }

  const rawRate = typeof rate === "string" ? rate.trim() : String(rate ?? "");
  const normalizedRate = normalizeSupplierBatchFxRate(rawRate);
  if (normalizedRate === null || !FX_RATE_PATTERN.test(rawRate)) {
    return null;
  }

  const [whole, fraction = ""] = rawRate.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const rateUnits = BigInt(whole) * scale + BigInt(fraction || "0");
  const numerator = BigInt(amountCents) * rateUnits;
  const rounded = (numerator + scale / 2n) / scale;
  const result = Number(rounded);
  return Number.isSafeInteger(result) && result >= 0 && result <= MAX_MONEY_CENTS
    ? result
    : null;
}

/**
 * Convert the four charge amounts with the one canonical V2 rounding rule.
 *
 * Net and VAT are rounded independently, gross is their rounded sum (never a
 * separately converted gross), and capitalized follows the gross special case
 * required by the finance contract.  Keeping this helper next to the integer
 * FX converter gives callers one deterministic implementation for preview,
 * persistence, and read-back validation.
 */
export function supplierBatchFxChargeAmountsToEurCents({
  amountNetCents,
  vatAmountCents,
  amountGrossCents,
  capitalizedAmountCents,
  rate,
}) {
  const netEurCents = supplierBatchFxAmountToEurCents(amountNetCents, rate);
  const vatEurCents = supplierBatchFxAmountToEurCents(vatAmountCents, rate);
  const grossEurCents =
    netEurCents === null || vatEurCents === null
      ? null
      : safeAddMoneyCents(netEurCents, vatEurCents);
  const capitalizedEurCents =
    grossEurCents === null ||
    !Number.isSafeInteger(amountGrossCents) ||
    !Number.isSafeInteger(capitalizedAmountCents) ||
    amountGrossCents < 0 ||
    capitalizedAmountCents < 0 ||
    capitalizedAmountCents > amountGrossCents
      ? null
      : capitalizedAmountCents === amountGrossCents
        ? grossEurCents
        : Math.min(
            supplierBatchFxAmountToEurCents(capitalizedAmountCents, rate) ??
              Number.MAX_SAFE_INTEGER,
            grossEurCents
          );

  if (
    netEurCents === null ||
    vatEurCents === null ||
    grossEurCents === null ||
    capitalizedEurCents === null ||
    capitalizedEurCents === Number.MAX_SAFE_INTEGER
  ) {
    return null;
  }

  return {
    amountNetEurCents: netEurCents,
    vatAmountEurCents: vatEurCents,
    amountGrossEurCents: grossEurCents,
    capitalizedAmountEurCents: capitalizedEurCents,
  };
}

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
  const currency = normalizeSupplierBatchCurrency(readString(value, "currency"));
  const goodsValueCents = readMoneyOrCents(value, "goodsValue", "goods_value", "goodsValueCents");
  const costStatus = normalizeSupplierBatchCostStatus(value.costStatus ?? value.cost_status);
  const originalTotalsComparableRaw =
    value.originalTotalsComparable ?? value.original_totals_comparable;
  const originalTotalsComparable =
    originalTotalsComparableRaw === undefined
      ? true
      : typeof originalTotalsComparableRaw === "boolean"
        ? originalTotalsComparableRaw
        : null;
  const confirmationBlocked = value.confirmationBlocked ?? value.confirmation_blocked;
  const reviewCodes = normalizeReviewCodes(value.reviewCodes ?? value.review_codes);

  if (
    !batchId ||
    !batchCode ||
    !currency ||
    goodsValueCents === null ||
    !costStatus ||
    originalTotalsComparable === null ||
    typeof confirmationBlocked !== "boolean" ||
    reviewCodes === null
  ) {
    return null;
  }

  const estimatedCount = readCount(value, "estimatedCount", "estimated_count");
  const confirmedCount = readCount(value, "confirmedCount", "confirmed_count");
  const cancelledCount = readCount(value, "cancelledCount", "cancelled_count");
  const estimatedNetCents = readMoneyOrCents(value, "estimatedNet", "estimated_net", "estimatedNetCents");
  const estimatedVatCents = readMoneyOrCents(value, "estimatedVat", "estimated_vat", "estimatedVatCents");
  const estimatedGrossCents = readMoneyOrCents(value, "estimatedGross", "estimated_gross", "estimatedGrossCents");
  const estimatedCapitalizedCents = readMoneyOrCents(
    value,
    "estimatedCapitalized",
    "estimated_capitalized",
    "estimatedCapitalizedCents"
  );
  const confirmedNetCents = readMoneyOrCents(value, "confirmedNet", "confirmed_net", "confirmedNetCents");
  const confirmedVatCents = readMoneyOrCents(value, "confirmedVat", "confirmed_vat", "confirmedVatCents");
  const confirmedGrossCents = readMoneyOrCents(value, "confirmedGross", "confirmed_gross", "confirmedGrossCents");
  const confirmedCapitalizedCents = readMoneyOrCents(
    value,
    "confirmedCapitalized",
    "confirmed_capitalized",
    "confirmedCapitalizedCents"
  );
  const confirmedLandedTotalCents = readNullableMoneyOrCents(
    value,
    "confirmedLandedTotal",
    "confirmed_landed_total",
    "confirmedLandedTotalCents"
  );
  const projectedLandedTotalCents = readNullableMoneyOrCents(
    value,
    "projectedLandedTotal",
    "projected_landed_total",
    "projectedLandedTotalCents"
  );
  const baseCurrency = readString(value, "baseCurrency", "base_currency") ?? "EUR";
  const baseFxAvailable = value.baseFxAvailable ?? value.base_fx_available;
  const goodsValueEurCents = readNullableMoneyOrCents(
    value,
    "goodsValueEur",
    "goods_value_eur",
    "goodsValueEurCents"
  );
  const estimatedNetEurCents = readNullableMoneyOrCents(value, "estimatedNetEur", "estimated_net_eur", "estimatedNetEurCents");
  const estimatedVatEurCents = readNullableMoneyOrCents(value, "estimatedVatEur", "estimated_vat_eur", "estimatedVatEurCents");
  const estimatedGrossEurCents = readNullableMoneyOrCents(value, "estimatedGrossEur", "estimated_gross_eur", "estimatedGrossEurCents");
  const estimatedCapitalizedEurCents = readNullableMoneyOrCents(value, "estimatedCapitalizedEur", "estimated_capitalized_eur", "estimatedCapitalizedEurCents");
  const confirmedNetEurCents = readNullableMoneyOrCents(value, "confirmedNetEur", "confirmed_net_eur", "confirmedNetEurCents");
  const confirmedVatEurCents = readNullableMoneyOrCents(value, "confirmedVatEur", "confirmed_vat_eur", "confirmedVatEurCents");
  const confirmedGrossEurCents = readNullableMoneyOrCents(value, "confirmedGrossEur", "confirmed_gross_eur", "confirmedGrossEurCents");
  const confirmedCapitalizedEurCents = readNullableMoneyOrCents(value, "confirmedCapitalizedEur", "confirmed_capitalized_eur", "confirmedCapitalizedEurCents");
  const confirmedLandedTotalEurCents = readNullableMoneyOrCents(value, "confirmedLandedTotalEur", "confirmed_landed_total_eur", "confirmedLandedTotalEurCents");
  const projectedLandedTotalEurCents = readNullableMoneyOrCents(value, "projectedLandedTotalEur", "projected_landed_total_eur", "projectedLandedTotalEurCents");
  const goodsValueFxRateToEur = readNullableDecimal(
    value,
    "goodsValueFxRateToEur",
    "goods_value_fx_rate_to_eur",
    12
  );
  const goodsValueFxDate = readNullableString(
    value,
    "goodsValueFxDate",
    "goods_value_fx_date"
  );
  const goodsValueFxSource = readNullableString(
    value,
    "goodsValueFxSource",
    "goods_value_fx_source"
  );
  const goodsValueFxEvidenceUrl = readNullableString(
    value,
    "goodsValueFxEvidenceUrl",
    "goods_value_fx_evidence_url"
  );
  const extendedFieldsProvided = hasAnyField(value, [
    "baseCurrency",
    "base_currency",
    "baseFxAvailable",
    "base_fx_available",
    "goodsValueEur",
    "goods_value_eur",
    "goodsValueEurCents",
    "goods_value_eur_cents",
    "estimatedNetEur",
    "estimated_net_eur",
    "estimatedNetEurCents",
    "estimated_net_eur_cents",
    "estimatedVatEur",
    "estimated_vat_eur",
    "estimatedVatEurCents",
    "estimated_vat_eur_cents",
    "estimatedGrossEur",
    "estimated_gross_eur",
    "estimatedGrossEurCents",
    "estimated_gross_eur_cents",
    "estimatedCapitalizedEur",
    "estimated_capitalized_eur",
    "estimatedCapitalizedEurCents",
    "estimated_capitalized_eur_cents",
    "confirmedNetEur",
    "confirmed_net_eur",
    "confirmedNetEurCents",
    "confirmed_net_eur_cents",
    "confirmedVatEur",
    "confirmed_vat_eur",
    "confirmedVatEurCents",
    "confirmed_vat_eur_cents",
    "confirmedGrossEur",
    "confirmed_gross_eur",
    "confirmedGrossEurCents",
    "confirmed_gross_eur_cents",
    "confirmedCapitalizedEur",
    "confirmed_capitalized_eur",
    "confirmedCapitalizedEurCents",
    "confirmed_capitalized_eur_cents",
    "confirmedLandedTotalEur",
    "confirmed_landed_total_eur",
    "confirmedLandedTotalEurCents",
    "confirmed_landed_total_eur_cents",
    "projectedLandedTotalEur",
    "projected_landed_total_eur",
    "projectedLandedTotalEurCents",
    "projected_landed_total_eur_cents",
    "goodsValueFxRateToEur",
    "goods_value_fx_rate_to_eur",
    "goodsValueFxDate",
    "goods_value_fx_date",
    "goodsValueFxSource",
    "goods_value_fx_source",
    "goodsValueFxEvidenceUrl",
    "goods_value_fx_evidence_url",
  ]);

  if (
    baseCurrency !== SUPPLIER_BATCH_BASE_CURRENCY ||
    (baseFxAvailable !== undefined && typeof baseFxAvailable !== "boolean") ||
    (goodsValueFxRateToEur !== undefined && goodsValueFxRateToEur !== null && normalizeSupplierBatchFxRate(goodsValueFxRateToEur) === null) ||
    (currency !== "EUR" && !extendedFieldsProvided)
  ) {
    return null;
  }

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
    ].some((item) => item === null)
  ) {
    return null;
  }

  // MIXED_CURRENCY is descriptive only: original-currency totals are hidden,
  // while EUR base totals remain authoritative.  It must not by itself turn
  // an otherwise healthy summary into needs_review.
  const actionableReview = reviewCodes.some((code) => code !== "MIXED_CURRENCY");

  const estimatedGrossExpectedCents = safeAddMoneyCents(
    estimatedNetCents,
    estimatedVatCents
  );
  const confirmedGrossExpectedCents = safeAddMoneyCents(
    confirmedNetCents,
    confirmedVatCents
  );
  const confirmedLandedExpectedCents = safeAddMoneyCents(
    goodsValueCents,
    confirmedCapitalizedCents
  );
  const projectedLandedExpectedCents =
    confirmedLandedExpectedCents === null
      ? null
      : safeAddMoneyCents(confirmedLandedExpectedCents, estimatedCapitalizedCents);
  const eurChargeValues = [
    estimatedNetEurCents,
    estimatedVatEurCents,
    estimatedGrossEurCents,
    estimatedCapitalizedEurCents,
    confirmedNetEurCents,
    confirmedVatEurCents,
    confirmedGrossEurCents,
    confirmedCapitalizedEurCents,
  ];
  const eurChargeValuesPresent = eurChargeValues.some((item) => item !== null);
  const eurChargeValuesComplete = eurChargeValues.every((item) => item !== null);
  const estimatedGrossEurExpectedCents =
    eurChargeValuesComplete
      ? safeAddMoneyCents(estimatedNetEurCents, estimatedVatEurCents)
      : null;
  const confirmedGrossEurExpectedCents =
    eurChargeValuesComplete
      ? safeAddMoneyCents(confirmedNetEurCents, confirmedVatEurCents)
      : null;
  const confirmedLandedEurExpectedCents =
    goodsValueEurCents !== null && confirmedCapitalizedEurCents !== null
      ? safeAddMoneyCents(goodsValueEurCents, confirmedCapitalizedEurCents)
      : null;
  const projectedLandedEurExpectedCents =
    confirmedLandedEurExpectedCents !== null && estimatedCapitalizedEurCents !== null
      ? safeAddMoneyCents(confirmedLandedEurExpectedCents, estimatedCapitalizedEurCents)
      : null;
  const statusCapitalizedCents = originalTotalsComparable
    ? confirmedCapitalizedCents
    : confirmedCapitalizedEurCents;

  if (
    estimatedGrossExpectedCents === null ||
    confirmedGrossExpectedCents === null ||
    estimatedGrossCents !== estimatedGrossExpectedCents ||
    confirmedGrossCents !== confirmedGrossExpectedCents ||
    estimatedCapitalizedCents > estimatedGrossCents ||
    confirmedCapitalizedCents > confirmedGrossCents ||
    (eurChargeValuesPresent && !eurChargeValuesComplete) ||
    (!originalTotalsComparable &&
      (estimatedCount > 0 || confirmedCount > 0) &&
      !eurChargeValuesComplete) ||
    (currency !== "EUR" &&
      (estimatedCount > 0 || confirmedCount > 0) &&
      !eurChargeValuesComplete) ||
    (eurChargeValuesComplete && (
      estimatedGrossEurExpectedCents === null ||
      confirmedGrossEurExpectedCents === null ||
      estimatedGrossEurCents !== estimatedGrossEurExpectedCents ||
      confirmedGrossEurCents !== confirmedGrossEurExpectedCents ||
      estimatedCapitalizedEurCents > estimatedGrossEurCents ||
      confirmedCapitalizedEurCents > confirmedGrossEurCents
    )) ||
    (originalTotalsComparable && (
      confirmedLandedTotalCents === null || projectedLandedTotalCents === null
    )) ||
    (!originalTotalsComparable && (
      confirmedLandedTotalCents !== null || projectedLandedTotalCents !== null
    )) ||
    (originalTotalsComparable && (
      confirmedLandedExpectedCents === null ||
      projectedLandedExpectedCents === null ||
      confirmedLandedTotalCents !== confirmedLandedExpectedCents ||
      projectedLandedTotalCents !== projectedLandedExpectedCents
    )) ||
    (eurChargeValuesComplete && goodsValueEurCents !== null && (
      confirmedLandedTotalEurCents === null ||
      projectedLandedTotalEurCents === null ||
      confirmedLandedEurExpectedCents === null ||
      projectedLandedEurExpectedCents === null ||
      confirmedLandedTotalEurCents !== confirmedLandedEurExpectedCents ||
      projectedLandedTotalEurCents !== projectedLandedEurExpectedCents
    )) ||
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
    (!originalTotalsComparable &&
      [
        estimatedNetCents,
        estimatedVatCents,
        estimatedGrossCents,
        estimatedCapitalizedCents,
        confirmedNetCents,
        confirmedVatCents,
        confirmedGrossCents,
        confirmedCapitalizedCents,
      ].some((item) => item !== 0)) ||
    confirmationBlocked !== actionableReview
  ) {
    return null;
  }

  const expectedStatus = actionableReview
    ? "needs_review"
    : estimatedCount > 0
      ? "estimated"
      : confirmedCount > 0 && statusCapitalizedCents === 0
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
    originalTotalsComparable,
    ...(extendedFieldsProvided
      ? {
          baseCurrency,
          baseFxAvailable: baseFxAvailable ?? currency === "EUR",
          goodsValueEurCents,
          estimatedNetEurCents,
          estimatedVatEurCents,
          estimatedGrossEurCents,
          estimatedCapitalizedEurCents,
          confirmedNetEurCents,
          confirmedVatEurCents,
          confirmedGrossEurCents,
          confirmedCapitalizedEurCents,
          confirmedLandedTotalEurCents,
          projectedLandedTotalEurCents,
          ...(goodsValueFxRateToEur === undefined
            ? {}
            : { goodsValueFxRateToEur: goodsValueFxRateToEur === null ? null : normalizeSupplierBatchFxRate(goodsValueFxRateToEur) }),
          ...(hasAnyField(value, ["goodsValueFxDate", "goods_value_fx_date"])
            ? { goodsValueFxDate }
            : {}),
          ...(hasAnyField(value, ["goodsValueFxSource", "goods_value_fx_source"])
            ? { goodsValueFxSource }
            : {}),
          ...(hasAnyField(value, ["goodsValueFxEvidenceUrl", "goods_value_fx_evidence_url"])
            ? { goodsValueFxEvidenceUrl }
            : {}),
        }
      : {}),
  };
}

export function normalizeSupplierBatchCharge(value) {
  return normalizeChargeSnapshot(value, true);
}

export function normalizeSupplierBatchLineProjection(value) {
  if (!isRecord(value)) {
    return null;
  }

  const originalCurrencyComparableRaw = value.originalCurrencyComparable ?? value.original_currency_comparable;
  const originalCurrencyComparable =
    originalCurrencyComparableRaw === undefined
      ? true
      : typeof originalCurrencyComparableRaw === "boolean"
        ? originalCurrencyComparableRaw
        : null;
  const batchLineId = readIdentifier(value, "batchLineId", "batch_line_id");
  const lineNo = readCount(value, "lineNo", "line_no");
  const qtyReceived = readCount(value, "qtyReceived", "qty_received");
  const weightGramField = readStrictNullableDecimal(value, "weightGram", "weight_gram");
  const skuCode = readNullableString(value, "skuCode", "sku_code");
  const goodsCostCents = readNullableMoneyOrCents(value, "goodsCost", "goods_cost", "goodsCostCents");
  const goodsUnitCostField = readStrictNullableDecimal(
    value,
    "goodsUnitCost",
    "goods_unit_cost",
    4,
    MAX_FINANCE_UNIT_VALUE
  );
  const currentAllocationCents = readNullableMoneyOrCents(value, "currentAllocation", "current_allocation", "currentAllocationCents");
  const candidateAllocationCents = readNullableMoneyOrCents(
    value,
    "candidateAllocation",
    "candidate_allocation",
    "candidateAllocationCents"
  );
  const existingInboundCents = readNullableMoneyOrCents(value, "existingInbound", "existing_inbound", "existingInboundCents");
  const inboundAfterCandidateCents = readNullableMoneyOrCents(
    value,
    "inboundAfterCandidate",
    "inbound_after_candidate",
    "inboundAfterCandidateCents"
  );
  const currentLandedLineCostCents = readNullableMoneyOrCents(
    value,
    "currentLandedLineCost",
    "current_landed_line_cost",
    "currentLandedLineCostCents"
  );
  const projectedLandedLineCostCents = readNullableMoneyOrCents(
    value,
    "projectedLandedLineCost",
    "projected_landed_line_cost",
    "projectedLandedLineCostCents"
  );
  const currentLandedUnitCostField = readStrictNullableDecimal(
    value,
    "currentLandedUnitCost",
    "current_landed_unit_cost",
    4,
    MAX_FINANCE_UNIT_VALUE
  );
  const projectedLandedUnitCostField = readStrictNullableDecimal(
    value,
    "projectedLandedUnitCost",
    "projected_landed_unit_cost",
    4,
    MAX_FINANCE_UNIT_VALUE
  );

  const weightGram = weightGramField.value;
  const goodsUnitCost = goodsUnitCostField.value;
  const currentLandedUnitCost = currentLandedUnitCostField.value;
  const projectedLandedUnitCost = projectedLandedUnitCostField.value;
  const goodsCostEurCents = readNullableMoneyOrCents(
    value,
    "goodsCostEur",
    "goods_cost_eur",
    "goodsCostEurCents"
  );
  const currentAllocationEurCents = readNullableMoneyOrCents(
    value,
    "currentAllocationEur",
    "current_allocation_eur",
    "currentAllocationEurCents"
  );
  const candidateAllocationEurCents = readNullableMoneyOrCents(
    value,
    "candidateAllocationEur",
    "candidate_allocation_eur",
    "candidateAllocationEurCents"
  );
  const existingInboundEurCents = readNullableMoneyOrCents(
    value,
    "existingInboundEur",
    "existing_inbound_eur",
    "existingInboundEurCents"
  );
  const inboundAfterCandidateEurCents = readNullableMoneyOrCents(
    value,
    "inboundAfterCandidateEur",
    "inbound_after_candidate_eur",
    "inboundAfterCandidateEurCents"
  );
  const currentLandedLineCostEurCents = readNullableMoneyOrCents(
    value,
    "currentLandedLineCostEur",
    "current_landed_line_cost_eur",
    "currentLandedLineCostEurCents"
  );
  const projectedLandedLineCostEurCents = readNullableMoneyOrCents(
    value,
    "projectedLandedLineCostEur",
    "projected_landed_line_cost_eur",
    "projectedLandedLineCostEurCents"
  );
  const currentLandedUnitCostEurField = readStrictNullableDecimal(
    value,
    "currentLandedUnitCostEur",
    "current_landed_unit_cost_eur",
    4,
    MAX_FINANCE_UNIT_VALUE
  );
  const projectedLandedUnitCostEurField = readStrictNullableDecimal(
    value,
    "projectedLandedUnitCostEur",
    "projected_landed_unit_cost_eur",
    4,
    MAX_FINANCE_UNIT_VALUE
  );
  const currentLandedUnitCostEur = currentLandedUnitCostEurField.value;
  const projectedLandedUnitCostEur = projectedLandedUnitCostEurField.value;
  const eurProjectionProvided = hasAnyField(value, [
    "goodsCostEur", "goods_cost_eur", "goodsCostEurCents",
    "currentAllocationEur", "current_allocation_eur", "currentAllocationEurCents",
    "candidateAllocationEur", "candidate_allocation_eur", "candidateAllocationEurCents",
    "existingInboundEur", "existing_inbound_eur", "existingInboundEurCents",
    "inboundAfterCandidateEur", "inbound_after_candidate_eur", "inboundAfterCandidateEurCents",
    "currentLandedLineCostEur", "current_landed_line_cost_eur", "currentLandedLineCostEurCents",
    "projectedLandedLineCostEur", "projected_landed_line_cost_eur", "projectedLandedLineCostEurCents",
    "currentLandedUnitCostEur", "current_landed_unit_cost_eur",
    "projectedLandedUnitCostEur", "projected_landed_unit_cost_eur",
  ]);

  if (
    !batchLineId ||
    lineNo === null ||
    qtyReceived === null ||
    !weightGramField.present ||
    weightGramField.invalid ||
    originalCurrencyComparable === null ||
    goodsCostCents === null ||
    !goodsUnitCostField.present ||
    goodsUnitCostField.invalid ||
    (originalCurrencyComparable && (
      currentAllocationCents === null ||
      candidateAllocationCents === null ||
      existingInboundCents === null ||
      inboundAfterCandidateCents === null ||
      currentLandedLineCostCents === null ||
      projectedLandedLineCostCents === null
    )) ||
    !currentLandedUnitCostField.present ||
    currentLandedUnitCostField.invalid ||
    !projectedLandedUnitCostField.present ||
    projectedLandedUnitCostField.invalid ||
    (originalCurrencyComparable && qtyReceived > 0 && (
      !currentLandedUnitCostField.present ||
      currentLandedUnitCost === null ||
      !projectedLandedUnitCostField.present ||
      projectedLandedUnitCost === null
    )) ||
    (!originalCurrencyComparable && (
      !eurProjectionProvided ||
      currentAllocationEurCents === null ||
      candidateAllocationEurCents === null ||
      existingInboundEurCents === null ||
      inboundAfterCandidateEurCents === null ||
      currentLandedUnitCostEurField.invalid ||
      projectedLandedUnitCostEurField.invalid ||
      (goodsCostEurCents !== null && (
        currentLandedLineCostEurCents === null ||
        projectedLandedLineCostEurCents === null ||
        (qtyReceived > 0 && (
          !currentLandedUnitCostEurField.present ||
          currentLandedUnitCostEur === null ||
          !projectedLandedUnitCostEurField.present ||
          projectedLandedUnitCostEur === null
        ))
      )) ||
      (goodsCostEurCents === null && (
        !currentLandedUnitCostEurField.present ||
        !projectedLandedUnitCostEurField.present ||
        currentLandedUnitCostEur !== null ||
        projectedLandedUnitCostEur !== null
      ))
    ))
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

  const expectedInboundAfterCents = safeAddMoneyCents(
    currentAllocationCents,
    candidateAllocationCents
  );
  const expectedCurrentLandedCents = safeAddMoneyCents(
    goodsCostCents,
    existingInboundCents
  );
  const expectedProjectedLandedCents = safeAddMoneyCents(
    goodsCostCents,
    inboundAfterCandidateCents
  );
  const expectedInboundAfterEurCents = safeAddMoneyCents(
    currentAllocationEurCents,
    candidateAllocationEurCents
  );
  const expectedCurrentLandedEurCents = safeAddMoneyCents(
    goodsCostEurCents,
    existingInboundEurCents
  );
  const expectedProjectedLandedEurCents = safeAddMoneyCents(
    goodsCostEurCents,
    inboundAfterCandidateEurCents
  );

  if (originalCurrencyComparable && (
    expectedInboundAfterCents === null ||
    expectedCurrentLandedCents === null ||
    expectedProjectedLandedCents === null ||
    inboundAfterCandidateCents !== expectedInboundAfterCents ||
    currentAllocationCents !== existingInboundCents ||
    currentLandedLineCostCents !== expectedCurrentLandedCents ||
    projectedLandedLineCostCents !== expectedProjectedLandedCents
  )) {
    return null;
  }

  if (!originalCurrencyComparable && (
    expectedInboundAfterEurCents === null ||
    inboundAfterCandidateEurCents !== expectedInboundAfterEurCents ||
    currentAllocationEurCents !== existingInboundEurCents ||
    (goodsCostEurCents !== null && (
      expectedCurrentLandedEurCents === null ||
      expectedProjectedLandedEurCents === null ||
      currentLandedLineCostEurCents !== expectedCurrentLandedEurCents ||
      projectedLandedLineCostEurCents !== expectedProjectedLandedEurCents
    ))
  )) {
    return null;
  }

  if (originalCurrencyComparable && qtyReceived > 0) {
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
    originalCurrencyComparable,
    goodsCostEurCents,
    currentAllocationEurCents,
    candidateAllocationEurCents,
    existingInboundEurCents,
    inboundAfterCandidateEurCents,
    currentLandedLineCostEurCents,
    projectedLandedLineCostEurCents,
    currentLandedUnitCostEur,
    projectedLandedUnitCostEur,
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
  const currency = normalizeSupplierBatchCurrency(readString(value, "currency"));
  const amountNetCents = readMoneyOrCents(value, "amountNet", "amount_net", "amountNetCents");
  const vatAmountCents = readMoneyOrCents(value, "vatAmount", "vat_amount", "vatAmountCents");
  const amountGrossCents = readMoneyOrCents(value, "amountGross", "amount_gross", "amountGrossCents");
  const capitalizedAmountCents = readMoneyOrCents(
    value,
    "capitalizedAmount",
    "capitalized_amount",
    "capitalizedAmountCents"
  );
  const currencyHasFx = hasAnyField(value, [
    "fxRateToEur",
    "fx_rate_to_eur",
    "fxRateDate",
    "fx_rate_date",
    "fxRateSource",
    "fx_rate_source",
    "fxEvidenceUrl",
    "fx_evidence_url",
    "amountNetEur",
    "amount_net_eur",
    "amountNetEurCents",
    "amount_net_eur_cents",
    "vatAmountEur",
    "vat_amount_eur",
    "vatAmountEurCents",
    "vat_amount_eur_cents",
    "amountGrossEur",
    "amount_gross_eur",
    "amountGrossEurCents",
    "amount_gross_eur_cents",
    "capitalizedAmountEur",
    "capitalized_amount_eur",
    "capitalizedAmountEurCents",
    "capitalized_amount_eur_cents",
  ]);
  const baseCurrency = readString(value, "baseCurrency", "base_currency") ?? "EUR";
  const fxRateToEur = readNullableDecimal(value, "fxRateToEur", "fx_rate_to_eur", 12);
  const fxRateDate = readNullableString(value, "fxRateDate", "fx_rate_date");
  const fxRateSource = readNullableString(value, "fxRateSource", "fx_rate_source");
  const fxEvidenceUrl = readNullableString(value, "fxEvidenceUrl", "fx_evidence_url");
  const amountNetEurCents = readNullableMoneyOrCents(value, "amountNetEur", "amount_net_eur", "amountNetEurCents");
  const vatAmountEurCents = readNullableMoneyOrCents(value, "vatAmountEur", "vat_amount_eur", "vatAmountEurCents");
  const amountGrossEurCents = readNullableMoneyOrCents(value, "amountGrossEur", "amount_gross_eur", "amountGrossEurCents");
  const capitalizedAmountEurCents = readNullableMoneyOrCents(value, "capitalizedAmountEur", "capitalized_amount_eur", "capitalizedAmountEurCents");
  const candidateAllocationTotalCents = readMoneyOrCents(
    value,
    "candidateAllocationTotal",
    "candidate_allocation_total",
    "candidateAllocationTotalCents"
  );
  const confirmedAllocationTotalCents = readMoneyOrCents(
    value,
    "confirmedAllocationTotal",
    "confirmed_allocation_total",
    "confirmedAllocationTotalCents"
  );
  const allocationTotalCents = readMoneyOrCents(
    value,
    "allocationTotal",
    "allocation_total",
    "allocationTotalCents"
  );
  const candidateAllocations = normalizeAllocations(value.candidateAllocations, "rpc");
  const confirmedAllocations = normalizeAllocations(value.confirmedAllocations, "rpc");
  const allocations = normalizeAllocations(value.allocations, "rpc");
  const lineProjections = normalizeLineProjections(value.lineProjections);
  const correctionPreviewRaw = value.correctionPreview ?? value.correction_preview;
  const correctionPreview = correctionPreviewRaw === undefined
    ? undefined
    : typeof correctionPreviewRaw === "boolean"
      ? correctionPreviewRaw
      : null;
  const correctionTotalsProvided = hasAnyField(value, ["correctionTotals", "correction_totals"]);
  const correctionTotalsRaw = value.correctionTotals ?? value.correction_totals;
  const correctionTotals = correctionTotalsRaw === null || correctionTotalsRaw === undefined
    ? null
    : normalizeSupplierBatchCorrectionPreviewTotals(correctionTotalsRaw);
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
  const expectedAmountGrossCents = safeAddMoneyCents(amountNetCents, vatAmountCents);

  if (
    !status ||
    !SUPPLIER_BATCH_RPC_STATUSES.has(status) ||
    !batchId ||
    !batchCode ||
    !revision ||
    !currency ||
    baseCurrency !== SUPPLIER_BATCH_BASE_CURRENCY ||
    (currency !== "EUR" && !currencyHasFx) ||
    (fxRateToEur !== undefined && fxRateToEur !== null && normalizeSupplierBatchFxRate(fxRateToEur) === null) ||
    !isCompleteChargeFxSnapshot({
      currency,
      currencyHasFx,
      baseCurrency,
      fxRateToEur,
      fxRateDate,
      fxRateSource,
      amountNetCents,
      vatAmountCents,
      amountGrossCents,
      capitalizedAmountCents,
      amountNetEurCents,
      vatAmountEurCents,
      amountGrossEurCents,
      capitalizedAmountEurCents,
    }) ||
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
    correctionPreview === null ||
    (correctionTotalsProvided && correctionTotalsRaw !== null && correctionTotals === null) ||
    (correctionPreview === true && correctionTotals === null) ||
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
    expectedAmountGrossCents === null ||
    amountGrossCents !== expectedAmountGrossCents ||
    capitalizedAmountCents > amountGrossCents ||
    (confirmationBlocked === true &&
      ![
        "FINANCIAL_ADJUSTMENT_REQUIRED",
        "FINANCE_ADJUSTMENT_REQUIRED",
        "BATCH_FX_RATE_REQUIRED",
      ].includes(
        confirmationBlockCode
      )) ||
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
      !metadataEqual(charge.metadata, metadata) ||
      (charge.baseCurrency ?? "EUR") !== baseCurrency ||
      (charge.fxRateToEur ?? null) !==
        (fxRateToEur === undefined || fxRateToEur === null
          ? null
          : normalizeSupplierBatchFxRate(fxRateToEur)) ||
      (charge.fxEvidenceUrl ?? null) !== (fxEvidenceUrl ?? null) ||
      (charge.amountNetEurCents ?? null) !== amountNetEurCents ||
      (charge.vatAmountEurCents ?? null) !== vatAmountEurCents ||
      (charge.amountGrossEurCents ?? null) !== amountGrossEurCents ||
      (charge.capitalizedAmountEurCents ?? null) !== capitalizedAmountEurCents)
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
    ...(correctionPreview === undefined ? {} : { correctionPreview }),
    ...(correctionTotals === null ? {} : { correctionTotals }),
    ...(currencyHasFx
      ? {
          baseCurrency,
          fxRateToEur: fxRateToEur === undefined || fxRateToEur === null
            ? fxRateToEur ?? null
            : normalizeSupplierBatchFxRate(fxRateToEur),
          fxRateDate,
          fxRateSource,
          amountNetEurCents,
          vatAmountEurCents,
          amountGrossEurCents,
          capitalizedAmountEurCents,
        }
      : {}),
  };
}

/**
 * Validate the dedicated correction receipt at the RPC boundary.
 *
 * A correction receipt is intentionally not treated as a charge result: the
 * pending branch has no replacement charge and must remain a finance-work
 * item, while the applied branch carries exactly one canonical confirmed
 * replacement result.  Keeping this envelope separate prevents callers from
 * accidentally interpreting a pending correction as a confirmed charge.
 */
export function normalizeSupplierBatchCorrectionResult(value) {
  if (!isRecord(value)) {
    return null;
  }

  const status = readString(value, "status");
  const correctionId = readIdentifier(value, "correctionId", "correction_id");
  const originalChargeId = readIdentifier(value, "originalChargeId", "original_charge_id");
  const replacementChargeId = readNullableIdentifier(
    value,
    "replacementChargeId",
    "replacement_charge_id"
  );
  const batchCode = readString(value, "batchCode", "batch_code");
  const idempotencyKey = readString(value, "idempotencyKey", "idempotency_key");
  const previewFingerprint = readString(
    value,
    "previewFingerprint",
    "preview_fingerprint"
  );
  const revision = readString(value, "revision");
  const financeAdjustmentRequired = value.financeAdjustmentRequired ?? value.finance_adjustment_required;
  const replacementProvided = "replacement" in value;
  const replacement =
    replacementProvided && value.replacement !== null && value.replacement !== undefined
      ? normalizeSupplierBatchCostRpcResult(value.replacement)
      : null;

  if (
    !SUPPLIER_BATCH_CORRECTION_RECEIPT_STATUSES.includes(status) ||
    !correctionId ||
    !originalChargeId ||
    !batchCode ||
    !idempotencyKey ||
    !previewFingerprint ||
    !revision ||
    typeof financeAdjustmentRequired !== "boolean" ||
    !replacementProvided
  ) {
    return null;
  }

  if (status === "corrected") {
    if (
      financeAdjustmentRequired !== false ||
      !replacementChargeId ||
      !replacement ||
      replacement.status !== "confirmed" ||
      replacement.batchCode !== batchCode ||
      replacement.charge?.chargeId !== replacementChargeId
    ) {
      return null;
    }
  } else if (
    financeAdjustmentRequired !== true ||
    replacementChargeId !== null ||
    replacement !== null ||
    value.replacement !== null
  ) {
    return null;
  }

  return {
    status,
    correctionId,
    originalChargeId,
    replacementChargeId,
    batchCode,
    idempotencyKey,
    previewFingerprint,
    revision,
    financeAdjustmentRequired,
    replacement,
  };
}

// Receipt is the wire name used by API/repository callers. Keep the explicit
// alias so both domain terminology and the RPC result terminology share one
// strict implementation.
export function normalizeSupplierBatchCorrectionReceipt(value) {
  return normalizeSupplierBatchCorrectionResult(value);
}

/**
 * Return the confirmed charge ids in their effective version.
 *
 * Applied corrections remove the immutable original and retain the confirmed
 * replacement. Pending/rejected/candidate rows do not change the effective
 * set. The helper deliberately returns null for malformed joins because an
 * incomplete effective set is safer than silently double-counting finance.
 */
export function resolveSupplierBatchEffectiveChargeIds(charges, corrections) {
  if (!Array.isArray(charges) || !Array.isArray(corrections)) {
    return null;
  }

  const confirmedIds = [];
  const confirmedSet = new Set();
  for (const charge of charges) {
    if (!isRecord(charge)) {
      return null;
    }
    const chargeId = readIdentifier(charge, "chargeId", "id");
    const status = readString(charge, "status");
    if (!chargeId || !status || !SUPPLIER_BATCH_CHARGE_STATUSES.includes(status)) {
      return null;
    }
    if (status === "confirmed") {
      if (confirmedSet.has(chargeId)) {
        return null;
      }
      confirmedSet.add(chargeId);
      confirmedIds.push(chargeId);
    }
  }

  const replacedOriginals = new Set();
  const replacements = [];
  for (const correction of corrections) {
    if (!isRecord(correction)) {
      return null;
    }
    const status = readString(correction, "status");
    if (
      !status ||
      ![
        "candidate_ready",
        "pending_finance_adjustment",
        "applied",
        "rejected",
        "corrected",
      ].includes(status)
    ) {
      return null;
    }
    if (status !== "applied" && status !== "corrected") {
      continue;
    }

    const originalChargeId = readIdentifier(
      correction,
      "originalChargeId",
      "original_charge_id"
    );
    const replacementChargeId = readIdentifier(
      correction,
      "replacementChargeId",
      "replacement_charge_id"
    );
    if (
      !originalChargeId ||
      !replacementChargeId ||
      originalChargeId === replacementChargeId ||
      replacedOriginals.has(originalChargeId) ||
      !confirmedSet.has(originalChargeId) ||
      !confirmedSet.has(replacementChargeId)
    ) {
      return null;
    }
    replacedOriginals.add(originalChargeId);
    replacements.push(replacementChargeId);
  }

  const effectiveIds = confirmedIds.filter((chargeId) => !replacedOriginals.has(chargeId));
  for (const replacementChargeId of replacements) {
    if (!effectiveIds.includes(replacementChargeId)) {
      effectiveIds.push(replacementChargeId);
    }
  }
  return effectiveIds;
}

export function summarizeSupplierBatchLineCosts(lines, allocations) {
  if (!Array.isArray(lines) || !Array.isArray(allocations)) {
    return null;
  }

  // A persisted allocation is comparable in the original currency only when
  // the repository injected an explicit true after resolving its charge and
  // batch currencies.  Unknown/mixed context is deliberately false: never
  // add USD/CNY cents to a batch-currency total. EUR/base fields are attached
  // by the repository adapter and remain the only authority in that case.
  const originalCurrencyComparable = allocations.every((allocation) => {
    const normalized = normalizeSupplierBatchPersistedAllocation(allocation);
    return normalized !== null && normalized.originalCurrencyComparable === true;
  });

  const inboundByLine = new Map();
  for (const allocation of allocations) {
    const normalized = normalizeSupplierBatchPersistedAllocation(allocation);
    if (!normalized) {
      return null;
    }

    const inboundTotal = safeAddMoneyCents(
      inboundByLine.get(normalized.batchLineId) ?? 0,
      normalized.allocatedAmountCents
    );
    if (inboundTotal === null) {
      return null;
    }
    inboundByLine.set(normalized.batchLineId, inboundTotal);
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

    const confirmedInboundCents = originalCurrencyComparable
      ? inboundByLine.get(batchLineId) ?? 0
      : null;
    const landedLineCostCents = originalCurrencyComparable
      ? safeAddMoneyCents(goodsCostCents, confirmedInboundCents)
      : null;
    if (originalCurrencyComparable && landedLineCostCents === null) {
      return null;
    }
    const landedUnitCost =
      originalCurrencyComparable && qtyReceived > 0
        ? roundDecimal(landedLineCostCents / 100 / qtyReceived, 4)
        : null;

    result.push({
      batchLineId,
      goodsCostCents,
      confirmedInboundCents,
      landedLineCostCents,
      goodsUnitCost: unitCost,
      landedUnitCost,
      originalCurrencyComparable,
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
  const currency = normalizeSupplierBatchCurrency(readString(value, "currency"));
  const vatTreatment = normalizeEnum(
    value.vatTreatment ?? value.vat_treatment,
    SUPPLIER_BATCH_VAT_TREATMENTS
  );
  const allocationMethod = normalizeEnum(
    value.allocationMethod ?? value.allocation_method,
    SUPPLIER_BATCH_ALLOCATION_METHODS
  );
  const amountNetCents = readMoneyOrCents(value, "amountNet", "amount_net", "amountNetCents");
  const vatAmountCents = readMoneyOrCents(value, "vatAmount", "vat_amount", "vatAmountCents");
  const amountGrossCents = readMoneyOrCents(value, "amountGross", "amount_gross", "amountGrossCents");
  const capitalizedAmountCents = readMoneyOrCents(
    value,
    "capitalizedAmount",
    "capitalized_amount",
    "capitalizedAmountCents"
  );
  const currencyHasFx = hasAnyField(value, [
    "fxRateToEur",
    "fx_rate_to_eur",
    "fxRateDate",
    "fx_rate_date",
    "fxRateSource",
    "fx_rate_source",
    "fxEvidenceUrl",
    "fx_evidence_url",
    "amountNetEur",
    "amount_net_eur",
    "amountNetEurCents",
    "amount_net_eur_cents",
    "vatAmountEur",
    "vat_amount_eur",
    "vatAmountEurCents",
    "vat_amount_eur_cents",
    "amountGrossEur",
    "amount_gross_eur",
    "amountGrossEurCents",
    "amount_gross_eur_cents",
    "capitalizedAmountEur",
    "capitalized_amount_eur",
    "capitalizedAmountEurCents",
    "capitalized_amount_eur_cents",
  ]);
  const baseCurrency = readString(value, "baseCurrency", "base_currency") ?? "EUR";
  const fxRateToEur = readNullableDecimal(value, "fxRateToEur", "fx_rate_to_eur", 12);
  const fxRateDate = readNullableString(value, "fxRateDate", "fx_rate_date");
  const fxRateSource = readNullableString(value, "fxRateSource", "fx_rate_source");
  const fxEvidenceUrl = readNullableString(value, "fxEvidenceUrl", "fx_evidence_url");
  const amountNetEurCents = readNullableMoneyOrCents(value, "amountNetEur", "amount_net_eur", "amountNetEurCents");
  const vatAmountEurCents = readNullableMoneyOrCents(value, "vatAmountEur", "vat_amount_eur", "vatAmountEurCents");
  const amountGrossEurCents = readNullableMoneyOrCents(value, "amountGrossEur", "amount_gross_eur", "amountGrossEurCents");
  const capitalizedAmountEurCents = readNullableMoneyOrCents(value, "capitalizedAmountEur", "capitalized_amount_eur", "capitalizedAmountEurCents");
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
  const expectedAmountGrossCents = safeAddMoneyCents(amountNetCents, vatAmountCents);

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
    !currency ||
    baseCurrency !== SUPPLIER_BATCH_BASE_CURRENCY ||
    (currency !== "EUR" && !currencyHasFx) ||
    (fxRateToEur !== undefined && fxRateToEur !== null && normalizeSupplierBatchFxRate(fxRateToEur) === null) ||
    !isCompleteChargeFxSnapshot({
      currency,
      currencyHasFx,
      baseCurrency,
      fxRateToEur,
      fxRateDate,
      fxRateSource,
      amountNetCents,
      vatAmountCents,
      amountGrossCents,
      capitalizedAmountCents,
      amountNetEurCents,
      vatAmountEurCents,
      amountGrossEurCents,
      capitalizedAmountEurCents,
    }) ||
    !vatTreatment ||
    !allocationMethod ||
    amountNetCents === null ||
    vatAmountCents === null ||
    amountGrossCents === null ||
    capitalizedAmountCents === null ||
    manualAllocationsSnapshot === null ||
    metadata === null ||
    expectedAmountGrossCents === null ||
    amountGrossCents !== expectedAmountGrossCents ||
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
    ...(currencyHasFx
      ? {
          baseCurrency,
          fxRateToEur: fxRateToEur === undefined || fxRateToEur === null
            ? fxRateToEur ?? null
            : normalizeSupplierBatchFxRate(fxRateToEur),
          fxRateDate,
          fxRateSource,
          fxEvidenceUrl,
          amountNetEurCents,
          vatAmountEurCents,
          amountGrossEurCents,
          capitalizedAmountEurCents,
        }
      : {}),
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
    normalizeSupplierBatchCurrency(readString(value, "currency")) !== null &&
    (normalizeSupplierBatchCurrency(readString(value, "currency")) === "EUR" ||
      hasAnyField(value, ["fxRateToEur", "fx_rate_to_eur", "amountNetEur", "amount_net_eur"])) &&
    amountNetCents !== null &&
    vatAmountCents !== null &&
    safeAddMoneyCents(amountNetCents, vatAmountCents) === amountGrossCents &&
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
    (left.goodsCostSnapshotEurCents ?? null) === (right.goodsCostSnapshotEurCents ?? null) &&
    left.weightGramSnapshot === right.weightGramSnapshot &&
    left.basisValue === right.basisValue &&
    left.shareRatio === right.shareRatio &&
    left.allocatedAmountCents === right.allocatedAmountCents &&
    (left.allocatedAmountEurCents ?? null) === (right.allocatedAmountEurCents ?? null) &&
    left.allocatedUnitAmount === right.allocatedUnitAmount &&
    (left.allocatedUnitAmountEur ?? null) === (right.allocatedUnitAmountEur ?? null) &&
    left.landedLineCostCents === right.landedLineCostCents &&
    (left.landedLineCostEurCents ?? null) === (right.landedLineCostEurCents ?? null) &&
    left.landedUnitCost === right.landedUnitCost &&
    (left.landedUnitCostEur ?? null) === (right.landedUnitCostEur ?? null) &&
    left.roundingAdjustmentCents === right.roundingAdjustmentCents &&
    (left.roundingAdjustmentEurCents ?? null) === (right.roundingAdjustmentEurCents ?? null) &&
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
    const expectedEur = allocation?.allocatedAmountEurCents ?? 0;
    if (
      projection.originalCurrencyComparable === false
        ? projection.candidateAllocationEurCents !== expectedEur
        : projection.candidateAllocationCents !== expected
    ) {
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
  const allocatedAmountEurCents = readNullableMoneyOrCents(
    value,
    "allocatedAmountEur",
    "allocated_amount_eur",
    "allocatedAmountEurCents"
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
  const goodsCostSnapshotEurCents = readNullableMoneyOrCents(
    value,
    "goodsCostSnapshotEur",
    "goods_cost_snapshot_eur",
    "goodsCostSnapshotEurCents"
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
  const roundingAdjustmentEurCents = readSignedMoneyOrCents(
    value,
    "roundingAdjustmentEur",
    "rounding_adjustment_eur",
    "roundingAdjustmentEurCents"
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
  const landedLineCostEurCents = readNullableMoneyOrCents(
    value,
    "landedLineCostEur",
    "landed_line_cost_eur",
    "landedLineCostEurCents"
  );
  const landedLineCostProvided =
    "landedLineCost" in value ||
    "landed_line_cost" in value ||
    "landedLineCostCents" in value ||
    "landed_line_cost_cents" in value;
  const originalCurrencyComparableRaw =
    value.originalCurrencyComparable ?? value.original_currency_comparable;
  const originalCurrencyComparable =
    originalCurrencyComparableRaw === undefined
      ? false
      : typeof originalCurrencyComparableRaw === "boolean"
        ? originalCurrencyComparableRaw
        : null;
  const landedUnitCostField = readStrictNullableDecimal(
    value,
    "landedUnitCost",
    "landed_unit_cost",
    4,
    MAX_FINANCE_UNIT_VALUE
  );
  const allocatedUnitAmountField = readStrictNullableDecimal(
    value,
    "allocatedUnitAmount",
    "allocated_unit_amount",
    4,
    MAX_FINANCE_UNIT_VALUE
  );
  const allocatedUnitAmountEurField = readStrictNullableDecimal(
    value,
    "allocatedUnitAmountEur",
    "allocated_unit_amount_eur",
    4,
    MAX_FINANCE_UNIT_VALUE
  );
  const landedUnitCostEurField = readStrictNullableDecimal(
    value,
    "landedUnitCostEur",
    "landed_unit_cost_eur",
    4,
    MAX_FINANCE_UNIT_VALUE
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
  const landedLineCostRaw =
    "landedLineCost" in value
      ? value.landedLineCost
      : "landed_line_cost" in value
        ? value.landed_line_cost
        : "landedLineCostCents" in value
          ? value.landedLineCostCents
          : value.landed_line_cost_cents;
  const allocatedUnitAmount = allocatedUnitAmountField.value;
  const basisValue = basisValueField.value;
  const shareRatio = shareRatioField.value;
  const landedUnitCost = landedUnitCostField.present ? landedUnitCostField.value : null;
  const allocatedUnitAmountEur = allocatedUnitAmountEurField.present
    ? allocatedUnitAmountEurField.value
    : null;
  const landedUnitCostEur = landedUnitCostEurField.present
    ? landedUnitCostEurField.value
    : null;
  const eurAllocationFieldsProvided = hasAnyField(value, [
    "goodsCostSnapshotEur",
    "goods_cost_snapshot_eur",
    "goodsCostSnapshotEurCents",
    "goods_cost_snapshot_eur_cents",
    "allocatedAmountEur",
    "allocated_amount_eur",
    "allocatedAmountEurCents",
    "allocated_amount_eur_cents",
    "allocatedUnitAmountEur",
    "allocated_unit_amount_eur",
    "landedLineCostEur",
    "landed_line_cost_eur",
    "landedLineCostEurCents",
    "landed_line_cost_eur_cents",
    "landedUnitCostEur",
    "landed_unit_cost_eur",
    "roundingAdjustmentEur",
    "rounding_adjustment_eur",
    "roundingAdjustmentEurCents",
    "rounding_adjustment_eur_cents",
  ]);
  const eurAllocationValuesProvided = [
    goodsCostSnapshotEurCents,
    allocatedAmountEurCents,
    landedLineCostEurCents,
    allocatedUnitAmountEur,
    landedUnitCostEur,
    roundingAdjustmentEurCents,
  ].some((item) => item !== null);

  const expectedOriginalLandedLineCostCents = safeAddMoneyCents(
    goodsCostSnapshotCents,
    allocatedAmountCents
  );
  const expectedEurLandedLineCostCents = safeAddMoneyCents(
    goodsCostSnapshotEurCents,
    allocatedAmountEurCents
  );

  // V1 persisted allocations did not store the original-currency landed
  // fields.  Resolve that legacy shape deterministically from the immutable
  // goods and allocated snapshots instead of treating it as malformed.  RPC
  // payloads still require the explicit fields so a new write can never omit
  // the canonical values.
  const legacyOriginalLineMissing =
    mode === "persisted" &&
    originalCurrencyComparable &&
    (!landedLineCostProvided || landedLineCostRaw === null || landedLineCostRaw === undefined);
  const legacyOriginalUnitMissing =
    mode === "persisted" &&
    originalCurrencyComparable &&
    (!landedUnitCostField.present || landedUnitCost === null);
  const resolvedLandedLineCostCents =
    !originalCurrencyComparable
      ? null
      : legacyOriginalLineMissing
      ? expectedOriginalLandedLineCostCents
      : landedLineCostCents;
  const resolvedLandedUnitCost =
    !originalCurrencyComparable
      ? null
      : legacyOriginalUnitMissing
      ? qtyReceivedSnapshot > 0
        ? roundDecimal(resolvedLandedLineCostCents / 100 / qtyReceivedSnapshot, 4)
        : null
      : landedUnitCost;

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
    originalCurrencyComparable === null ||
    (landedLineCostProvided && originalCurrencyComparable &&
      landedLineCostRaw !== null && landedLineCostRaw !== undefined &&
      landedLineCostCents === null) ||
    (landedUnitCostField.invalid) ||
    (mode === "rpc" && (!landedLineCostProvided || (originalCurrencyComparable && landedLineCostCents === null))) ||
    (mode === "rpc" && (!landedUnitCostField.present || (originalCurrencyComparable && landedUnitCost === null))) ||
    allocatedUnitAmountEurField.invalid ||
    landedUnitCostEurField.invalid ||
    (eurAllocationFieldsProvided && eurAllocationValuesProvided &&
      (goodsCostSnapshotEurCents === null ||
        allocatedAmountEurCents === null ||
        landedLineCostEurCents === null ||
        !allocatedUnitAmountEurField.present ||
        allocatedUnitAmountEur === null ||
        !landedUnitCostEurField.present ||
        landedUnitCostEur === null)) ||
    (landedLineCostRaw !== null && landedLineCostRaw !== undefined && landedLineCostCents === null) ||
    roundingAdjustmentCents < -1 ||
    roundingAdjustmentCents > 1 ||
    (roundingAdjustmentEurCents !== null &&
      (roundingAdjustmentEurCents < -1 || roundingAdjustmentEurCents > 1)) ||
    allocatedUnitAmount < 0 ||
    basisValue < 0 ||
    shareRatio < 0 ||
    shareRatio > 1 ||
    (originalCurrencyComparable &&
      expectedOriginalLandedLineCostCents === null) ||
    (originalCurrencyComparable && landedLineCostProvided &&
      resolvedLandedLineCostCents !== expectedOriginalLandedLineCostCents) ||
    (originalCurrencyComparable && (landedUnitCostField.present || legacyOriginalUnitMissing) &&
      ((qtyReceivedSnapshot === 0 && resolvedLandedUnitCost !== null) ||
        (qtyReceivedSnapshot > 0 &&
          (resolvedLandedUnitCost === null ||
            resolvedLandedLineCostCents === null ||
            resolvedLandedUnitCost !==
              roundDecimal(resolvedLandedLineCostCents / 100 / qtyReceivedSnapshot, 4))))) ||
    (eurAllocationValuesProvided &&
      (expectedEurLandedLineCostCents === null ||
        landedLineCostEurCents !== expectedEurLandedLineCostCents)) ||
    (eurAllocationValuesProvided && qtyReceivedSnapshot === 0 &&
      (allocatedUnitAmountEur !== null || landedUnitCostEur !== null)) ||
    (eurAllocationValuesProvided && qtyReceivedSnapshot > 0 &&
      (allocatedUnitAmountEur !== roundDecimal(allocatedAmountEurCents / 100 / qtyReceivedSnapshot, 4) ||
        landedUnitCostEur !== roundDecimal(landedLineCostEurCents / 100 / qtyReceivedSnapshot, 4)))
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
    landedLineCostCents: resolvedLandedLineCostCents,
    landedLineCost: supplierBatchMoneyCentsToNumber(resolvedLandedLineCostCents),
    landedUnitCost: resolvedLandedUnitCost,
    originalCurrencyComparable,
    roundingAdjustmentCents,
    metadata,
    createdAt: readNullableString(value, "createdAt", "created_at"),
    updatedAt: readNullableString(value, "updatedAt", "updated_at"),
    ...(eurAllocationFieldsProvided
      ? {
          goodsCostSnapshotEurCents,
          allocatedAmountEurCents,
          allocatedUnitAmountEur,
          landedLineCostEurCents,
          landedUnitCostEur,
          roundingAdjustmentEurCents,
        }
      : {}),
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
    const amountCents = readMoneyOrCents(item, "amount", "amount", "amountCents");
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
    total = safeAddMoneyCents(total, value.allocatedAmountCents);
    if (total === null) {
      return null;
    }
  }

  return total;
}

function safeAddMoneyCents(left, right) {
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    left < 0 ||
    right < 0 ||
    left > MAX_MONEY_CENTS ||
    right > MAX_MONEY_CENTS ||
    left > MAX_MONEY_CENTS - right
  ) {
    return null;
  }
  return left + right;
}

function safeSubtractMoneyCents(left, right) {
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    left < 0 ||
    right < 0 ||
    left > MAX_MONEY_CENTS ||
    right > MAX_MONEY_CENTS
  ) {
    return null;
  }
  const difference = left - right;
  return Number.isSafeInteger(difference) && Math.abs(difference) <= MAX_MONEY_CENTS
    ? difference
    : null;
}

function normalizeSupplierBatchCorrectionPreviewTotals(value) {
  if (!isRecord(value)) {
    return null;
  }

  const otherEffectiveCostEurCents = readMoneyOrCents(
    value,
    "otherEffectiveCostEur",
    "other_effective_cost_eur",
    "otherEffectiveCostEurCents"
  );
  const originalChargeEurCents = readMoneyOrCents(
    value,
    "originalChargeEur",
    "original_charge_eur",
    "originalChargeEurCents"
  );
  const replacementChargeEurCents = readMoneyOrCents(
    value,
    "replacementChargeEur",
    "replacement_charge_eur",
    "replacementChargeEurCents"
  );
  const beforeTotalEurCents = readMoneyOrCents(
    value,
    "beforeTotalEur",
    "before_total_eur",
    "beforeTotalEurCents"
  );
  const afterTotalEurCents = readMoneyOrCents(
    value,
    "afterTotalEur",
    "after_total_eur",
    "afterTotalEurCents"
  );
  const costDeltaEurCents = readSignedMoneyOrCentsWide(
    value,
    "costDeltaEur",
    "cost_delta_eur",
    "costDeltaEurCents"
  );
  const expectedBeforeTotalEurCents = safeAddMoneyCents(
    otherEffectiveCostEurCents,
    originalChargeEurCents
  );
  const expectedAfterTotalEurCents = safeAddMoneyCents(
    otherEffectiveCostEurCents,
    replacementChargeEurCents
  );
  const expectedCostDeltaEurCents =
    expectedAfterTotalEurCents === null || expectedBeforeTotalEurCents === null
      ? null
      : safeSubtractMoneyCents(expectedAfterTotalEurCents, expectedBeforeTotalEurCents);

  if (
    otherEffectiveCostEurCents === null ||
    originalChargeEurCents === null ||
    replacementChargeEurCents === null ||
    beforeTotalEurCents === null ||
    afterTotalEurCents === null ||
    costDeltaEurCents === null ||
    expectedBeforeTotalEurCents === null ||
    expectedAfterTotalEurCents === null ||
    expectedCostDeltaEurCents === null ||
    beforeTotalEurCents !== expectedBeforeTotalEurCents ||
    afterTotalEurCents !== expectedAfterTotalEurCents ||
    costDeltaEurCents !== expectedCostDeltaEurCents
  ) {
    return null;
  }

  return {
    otherEffectiveCostEurCents,
    originalChargeEurCents,
    replacementChargeEurCents,
    beforeTotalEurCents,
    afterTotalEurCents,
    costDeltaEurCents,
  };
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

function readMoneyOrCents(value, camelKey, snakeKey, centsKey = `${camelKey}Cents`) {
  const snakeCentsKey = snakeKey ? `${snakeKey}_cents` : null;
  const rawKey = centsKey in value ? centsKey : snakeCentsKey && snakeCentsKey in value ? snakeCentsKey : null;
  if (rawKey) {
    const raw = value[rawKey];
    return Number.isSafeInteger(raw) && raw >= 0 && raw <= MAX_MONEY_CENTS ? raw : null;
  }
  return readMoney(value, camelKey, snakeKey);
}

function readNullableMoneyOrCents(value, camelKey, snakeKey, centsKey = `${camelKey}Cents`) {
  if (
    !hasAnyField(value, [camelKey, snakeKey, centsKey, snakeKey ? `${snakeKey}_cents` : ""])
  ) {
    return null;
  }
  const raw = value[camelKey] ?? value[snakeKey] ?? value[centsKey] ?? (snakeKey ? value[`${snakeKey}_cents`] : undefined);
  if (raw === null || raw === undefined) {
    return null;
  }
  return readMoneyOrCents(value, camelKey, snakeKey, centsKey);
}

function isCompleteChargeFxSnapshot({
  currency,
  currencyHasFx,
  baseCurrency,
  fxRateToEur,
  fxRateDate,
  fxRateSource,
  amountNetCents,
  vatAmountCents,
  amountGrossCents,
  capitalizedAmountCents,
  amountNetEurCents,
  vatAmountEurCents,
  amountGrossEurCents,
  capitalizedAmountEurCents,
}) {
  // Legacy EUR rows predate the V2 snapshot columns and intentionally remain
  // valid when every snapshot field is absent. Once any V2 field is present,
  // the rate/date/source and all four EUR amounts are an indivisible record.
  if (!currencyHasFx) {
    return currency === "EUR";
  }
  if (
    baseCurrency !== SUPPLIER_BATCH_BASE_CURRENCY ||
    fxRateToEur === undefined ||
    fxRateToEur === null ||
    fxRateDate === null ||
    fxRateSource === null ||
    amountNetEurCents === null ||
    vatAmountEurCents === null ||
    amountGrossEurCents === null ||
    capitalizedAmountEurCents === null ||
    normalizeSupplierBatchFxRate(fxRateToEur) === null
  ) {
    return false;
  }
  if (currency === "EUR" && fxRateToEur !== 1) {
    return false;
  }

  const converted = supplierBatchFxChargeAmountsToEurCents({
    amountNetCents,
    vatAmountCents,
    amountGrossCents,
    capitalizedAmountCents,
    rate: fxRateToEur,
  });
  return (
    converted !== null &&
    converted.amountNetEurCents === amountNetEurCents &&
    converted.vatAmountEurCents === vatAmountEurCents &&
    converted.amountGrossEurCents === amountGrossEurCents &&
    converted.capitalizedAmountEurCents === capitalizedAmountEurCents
  );
}

function readSignedMoneyOrCents(value, camelKey, snakeKey, centsKey) {
  return readSignedMoneyOrCentsWithLimit(value, camelKey, snakeKey, centsKey, 1);
}

function readSignedMoneyOrCentsWide(value, camelKey, snakeKey, centsKey) {
  return readSignedMoneyOrCentsWithLimit(
    value,
    camelKey,
    snakeKey,
    centsKey,
    MAX_MONEY_CENTS
  );
}

function readSignedMoneyOrCentsWithLimit(value, camelKey, snakeKey, centsKey, limit) {
  const snakeCentsKey = snakeKey ? `${snakeKey}_cents` : null;
  const rawKey = centsKey in value ? centsKey : snakeCentsKey && snakeCentsKey in value ? snakeCentsKey : null;
  if (rawKey) {
    const raw = value[rawKey];
    return Number.isSafeInteger(raw) && Math.abs(raw) <= limit ? raw : null;
  }

  const raw = value[camelKey] ?? value[snakeKey];
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      return null;
    }
    const cents = Math.round(raw * 100);
    return Math.abs(raw - cents / 100) <= 1e-8 && Math.abs(cents) <= limit ? cents : null;
  }
  if (typeof raw !== "string" || !SIGNED_MONEY_PATTERN.test(raw.trim())) {
    return null;
  }

  const text = raw.trim();
  const sign = text.startsWith("-") ? -1 : 1;
  const unsigned = sign < 0 ? text.slice(1) : text;
  const [whole, fraction = ""] = unsigned.split(".");
  const cents = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
  return Number.isSafeInteger(cents) && Math.abs(cents) <= limit ? cents : null;
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

function readDecimalWithScale(raw, places, maxValue = Number.POSITIVE_INFINITY) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) {
      return null;
    }
    const rounded = roundDecimal(raw, places);
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(raw)) * 8;
    return Math.abs(raw - rounded) <= tolerance && rounded <= maxValue ? rounded : null;
  }
  const pattern = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.\\d{1,${places}})?$`);
  if (typeof raw === "string" && pattern.test(raw.trim())) {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) && parsed <= maxValue ? parsed : null;
  }
  return null;
}

function readNullableDecimal(value, camelKey, snakeKey, places = 12) {
  if (!(camelKey in value) && !(snakeKey in value)) {
    return undefined;
  }

  const raw = value[camelKey] ?? value[snakeKey];
  if (raw === null || raw === undefined) {
    return null;
  }
  return readDecimalWithScale(raw, places);
}

function readStrictNullableDecimal(
  value,
  camelKey,
  snakeKey,
  places = 12,
  maxValue = Number.POSITIVE_INFINITY
) {
  const present = camelKey in value || snakeKey in value;
  if (!present) {
    return { present: false, invalid: false, value: undefined };
  }

  const raw = value[camelKey] ?? value[snakeKey];
  if (raw === null || raw === undefined) {
    return { present: true, invalid: false, value: null };
  }

  const parsed = readDecimalWithScale(raw, places, maxValue);
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

function hasAnyField(value, keys) {
  return keys.some((key) => Boolean(key) && key in value);
}
