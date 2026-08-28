import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  normalizeSupplierBatchCostSummary,
  normalizeSupplierBatchCostRpcResult,
  normalizeSupplierBatchCorrectionResult,
  normalizeSupplierBatchCorrectionReceipt,
  normalizeSupplierBatchFxRate,
  normalizeSupplierBatchLineProjection,
  resolveSupplierBatchEffectiveChargeIds,
  supplierBatchFxAmountToEurCents,
  supplierBatchFxChargeAmountsToEurCents,
  normalizeSupplierBatchPersistedAllocation,
  supplierBatchMoneyToCents,
} from "../src/lib/partspro-supplier-batch-cost-core.mjs";
import {
  supplierBatchChargeV2CancelSchema,
  supplierBatchChargeV2ConfirmSchema,
  supplierBatchChargeV2CorrectSchema,
  supplierBatchChargeV2EstimateSchema,
  supplierBatchChargeV2PreviewSchema,
} from "../src/lib/partspro-supplier-batch-cost-input-schema.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8");
const ids = {
  batch: "11111111-1111-4111-8111-111111111111",
  charge: "22222222-2222-4222-8222-222222222222",
  replacement: "44444444-4444-4444-8444-444444444444",
  otherCharge: "55555555-5555-4555-8555-555555555555",
  correction: "66666666-6666-4666-8666-666666666666",
  actor: "77777777-7777-4777-8777-777777777777",
  line: "33333333-3333-4333-8333-333333333333",
};

const migrationSource = read(
  "supabase/migrations/20260827183609_supplier_arrival_cost_v2_currency_fx_permissions.sql"
);
const sharedSource = read("src/app/api/admin/_shared.ts");
const listRouteSource = read("src/app/api/admin/supplier-batches/route.ts");
const exportRouteSource = read("src/app/api/admin/supplier-batches/export/route.ts");
const confirmRouteSource = read(
  "src/app/api/admin/supplier-batches/[batchCode]/charges/confirm/route.ts"
);
const correctRouteSource = read(
  "src/app/api/admin/supplier-batches/[batchCode]/charges/correct/route.ts"
);
const cancelRouteSource = read(
  "src/app/api/admin/supplier-batches/[batchCode]/charges/cancel/route.ts"
);
const historyRouteSource = read(
  "src/app/api/admin/supplier-batches/[batchCode]/charges/history/route.ts"
);

function baseCharge(overrides = {}) {
  return {
    allocationMethod: "goods_value",
    amountNet: 1.23,
    capitalizedAmount: 1.23,
    carrierName: null,
    chargeType: "transport",
    currency: "EUR",
    evidenceUrl: null,
    notes: null,
    occurredAt: null,
    reference: null,
    vatAmount: 0,
    vatTreatment: "recoverable",
    zeroCostReason: null,
    ...overrides,
  };
}

function validSummary(overrides = {}) {
  return {
    batchId: ids.batch,
    batchCode: "V2-CONTRACT",
    currency: "EUR",
    goodsValue: 100,
    estimatedCount: 0,
    confirmedCount: 0,
    cancelledCount: 0,
    estimatedNet: 0,
    estimatedVat: 0,
    estimatedGross: 0,
    estimatedCapitalized: 0,
    confirmedNet: 0,
    confirmedVat: 0,
    confirmedGross: 0,
    confirmedCapitalized: 0,
    confirmedLandedTotal: 100,
    projectedLandedTotal: 100,
    confirmationBlocked: false,
    reviewCodes: [],
    costStatus: "unrecorded",
    ...overrides,
  };
}

function validConfirmedRpcResult(overrides = {}) {
  const chargeId = overrides.chargeId ?? ids.replacement;
  return {
    status: "confirmed",
    chargeId,
    batchId: ids.batch,
    batchCode: "V2-CONTRACT",
    revision: "revision-2",
    chargeType: "transport",
    amountNet: 0,
    vatAmount: 0,
    amountGross: 0,
    capitalizedAmount: 0,
    currency: "EUR",
    vatTreatment: "recoverable",
    allocationMethod: "goods_value",
    carrierName: null,
    reference: null,
    occurredAt: null,
    evidenceUrl: null,
    notes: null,
    zeroCostReason: "not capitalized",
    idempotencyKey: `replacement-${chargeId.slice(0, 8)}`,
    payloadFingerprint: "payload-fingerprint-123456",
    manualAllocationsSnapshot: [],
    metadata: {},
    createdBy: ids.actor,
    updatedBy: ids.actor,
    confirmedBy: ids.actor,
    confirmedAt: "2026-08-27T00:00:00.000Z",
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    candidateAllocationTotal: 0,
    candidateAllocations: [],
    confirmedAllocationTotal: 0,
    confirmedAllocations: [],
    allocationTotal: 0,
    allocations: [],
    lineProjections: [],
    confirmationBlocked: false,
    confirmationBlockCode: null,
    confirmationBlockReason: null,
    ...overrides,
  };
}

test("FX conversion uses deterministic half-up cents and rejects unsafe rates", () => {
  assert.equal(normalizeSupplierBatchFxRate(0.92), 0.92);
  assert.equal(normalizeSupplierBatchFxRate(0.000001), 0.000001);
  assert.equal(normalizeSupplierBatchFxRate(1_000_000), 1_000_000);
  assert.equal(normalizeSupplierBatchFxRate(0.0000009), null);
  assert.equal(normalizeSupplierBatchFxRate(1_000_000.000001), null);
  assert.equal(normalizeSupplierBatchFxRate("0.123456789012"), 0.123456789012);
  assert.equal(normalizeSupplierBatchFxRate("0.1234567890123"), null);
  assert.equal(normalizeSupplierBatchFxRate("1e-7"), null);
  assert.equal(normalizeSupplierBatchFxRate(1e-13), null);
  assert.equal(supplierBatchFxAmountToEurCents(123, "0.92"), 113);
  assert.equal(supplierBatchFxAmountToEurCents(1, "0.5"), 1);
  assert.equal(supplierBatchFxAmountToEurCents(1, "0.49"), 0);
  assert.equal(supplierBatchFxAmountToEurCents(100, "0.123456789012"), 12);
});

test("FX charge amounts use net/VAT independent rounding and gross/capitalized caps", () => {
  assert.deepEqual(
    supplierBatchFxChargeAmountsToEurCents({
      amountNetCents: 1,
      vatAmountCents: 1,
      amountGrossCents: 2,
      capitalizedAmountCents: 2,
      rate: "0.5",
    }),
    {
      amountNetEurCents: 1,
      vatAmountEurCents: 1,
      amountGrossEurCents: 2,
      capitalizedAmountEurCents: 2,
    }
  );
  // 1 cent residual: gross is netBase + vatBase, not a separately converted
  // gross; a partial capitalized amount is independently converted and capped.
  assert.deepEqual(
    supplierBatchFxChargeAmountsToEurCents({
      amountNetCents: 1,
      vatAmountCents: 2,
      amountGrossCents: 3,
      capitalizedAmountCents: 1,
      rate: "0.49",
    }),
    {
      amountNetEurCents: 0,
      vatAmountEurCents: 1,
      amountGrossEurCents: 1,
      capitalizedAmountEurCents: 0,
    }
  );
});

test("persisted V1 allocations derive missing original landed fields only when comparable", () => {
  const allocation = normalizeSupplierBatchPersistedAllocation({
    id: ids.charge,
    batchId: ids.batch,
    chargeId: ids.charge,
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: "SKU-1",
    qtyReceivedSnapshot: 2,
    goodsCostSnapshot: 10,
    weightGramSnapshot: 1,
    allocatedAmount: 1.23,
    allocatedUnitAmount: 0.615,
    originalCurrencyComparable: true,
    basisValue: 10,
    shareRatio: 1,
    roundingAdjustment: 0,
    metadata: {},
  });
  assert.ok(allocation);
  assert.equal(allocation.landedLineCostCents, 1123);
  assert.equal(allocation.landedUnitCost, 5.615);

  const explicitNull = normalizeSupplierBatchPersistedAllocation({
    id: ids.charge,
    batchId: ids.batch,
    chargeId: ids.charge,
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: "SKU-1",
    qtyReceivedSnapshot: 2,
    goodsCostSnapshot: 10,
    weightGramSnapshot: 1,
    allocatedAmount: 1.23,
    allocatedUnitAmount: 0.615,
    originalCurrencyComparable: true,
    basisValue: 10,
    shareRatio: 1,
    landedLineCost: null,
    landedUnitCost: null,
    roundingAdjustment: 0,
    metadata: {},
  });
  assert.ok(explicitNull);
  assert.equal(explicitNull.landedLineCostCents, 1123);
  assert.equal(explicitNull.landedUnitCost, 5.615);

  const unknownComparable = normalizeSupplierBatchPersistedAllocation({
    id: ids.charge,
    batchId: ids.batch,
    chargeId: ids.charge,
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: "SKU-1",
    qtyReceivedSnapshot: 2,
    goodsCostSnapshot: 10,
    weightGramSnapshot: 1,
    allocatedAmount: 1.23,
    allocatedUnitAmount: 0.615,
    basisValue: 10,
    shareRatio: 1,
    roundingAdjustment: 0,
    metadata: {},
  });
  assert.ok(unknownComparable);
  assert.equal(unknownComparable.originalCurrencyComparable, false);
  assert.equal(unknownComparable.landedLineCostCents, null);
  assert.equal(unknownComparable.landedUnitCost, null);

  const unknownWithPersistedLanded = normalizeSupplierBatchPersistedAllocation({
    id: ids.charge,
    batchId: ids.batch,
    chargeId: ids.charge,
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: "SKU-1",
    qtyReceivedSnapshot: 2,
    goodsCostSnapshot: 10,
    weightGramSnapshot: 1,
    allocatedAmount: 1.23,
    allocatedUnitAmount: 0.615,
    basisValue: 10,
    shareRatio: 1,
    landedLineCost: 11.23,
    landedUnitCost: 5.615,
    roundingAdjustment: 0,
    metadata: {},
  });
  assert.ok(unknownWithPersistedLanded);
  assert.equal(unknownWithPersistedLanded.originalCurrencyComparable, false);
  assert.equal(unknownWithPersistedLanded.landedLineCostCents, null);
  assert.equal(unknownWithPersistedLanded.landedUnitCost, null);
});

test("legacy EUR summaries and canonical cents summaries are both idempotent", () => {
  const legacy = normalizeSupplierBatchCostSummary(validSummary());
  assert.ok(legacy);
  assert.equal(legacy.goodsValueCents, 10000);

  const canonical = normalizeSupplierBatchCostSummary({
    ...validSummary(),
    goodsValue: undefined,
    goodsValueCents: 10000,
    confirmedLandedTotal: undefined,
    projectedLandedTotal: undefined,
    confirmedLandedTotalCents: 10000,
    projectedLandedTotalCents: 10000,
    baseCurrency: "EUR",
    baseFxAvailable: true,
    goodsValueEurCents: 10000,
    confirmedLandedTotalEurCents: 10000,
    projectedLandedTotalEurCents: 10000,
  });
  assert.ok(canonical);
  assert.deepEqual(normalizeSupplierBatchCostSummary(canonical), canonical);
});

test("mixed-currency projections never expose an original-currency landed sum", () => {
  const projection = normalizeSupplierBatchLineProjection({
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: "SKU-1",
    qtyReceived: 2,
    weightGram: 10,
    goodsCost: 100,
    goodsUnitCost: 50,
    currentAllocation: null,
    candidateAllocation: null,
    existingInbound: null,
    inboundAfterCandidate: null,
    currentLandedLineCost: null,
    projectedLandedLineCost: null,
    currentLandedUnitCost: null,
    projectedLandedUnitCost: null,
    originalCurrencyComparable: false,
    goodsCostEurCents: 9200,
    currentAllocationEurCents: 0,
    candidateAllocationEurCents: 113,
    existingInboundEurCents: 0,
    inboundAfterCandidateEurCents: 113,
    currentLandedLineCostEurCents: 9200,
    projectedLandedLineCostEurCents: 9313,
    currentLandedUnitCostEur: 46,
    projectedLandedUnitCostEur: 46.565,
  });
  assert.ok(projection);
  assert.equal(projection.currentLandedLineCostCents, null);
  assert.equal(projection.projectedLandedLineCostCents, null);
  assert.equal(projection.projectedLandedLineCostEurCents, 9313);
});

test("mixed-currency summaries keep MIXED_CURRENCY informational", () => {
  const summary = normalizeSupplierBatchCostSummary({
    ...validSummary({
      currency: "USD",
      originalTotalsComparable: false,
      confirmedLandedTotal: null,
      projectedLandedTotal: null,
      reviewCodes: ["MIXED_CURRENCY"],
      confirmationBlocked: false,
      baseCurrency: "EUR",
      baseFxAvailable: true,
      goodsValueEurCents: 9200,
      confirmedLandedTotalEurCents: 9200,
      projectedLandedTotalEurCents: 9200,
    }),
  });
  assert.ok(summary);
  assert.equal(summary.costStatus, "unrecorded");
  assert.equal(summary.confirmationBlocked, false);
  assert.equal(
    normalizeSupplierBatchCostSummary({
      ...summary,
      confirmedCount: 1,
      confirmedNetCents: 1,
      confirmedGrossCents: 1,
      confirmedCapitalizedCents: 1,
      costStatus: "confirmed",
    }),
    null
  );
});

test("mixed-currency summary status uses confirmed EUR capitalized amount", () => {
  const summary = normalizeSupplierBatchCostSummary({
    ...validSummary({
      currency: "USD",
      originalTotalsComparable: false,
      confirmedCount: 1,
      confirmedNet: 0,
      confirmedVat: 0,
      confirmedGross: 0,
      confirmedCapitalized: 0,
      confirmedLandedTotal: null,
      projectedLandedTotal: null,
      reviewCodes: ["MIXED_CURRENCY"],
      confirmationBlocked: false,
      costStatus: "confirmed",
      baseCurrency: "EUR",
      baseFxAvailable: true,
      goodsValueEur: 100,
      estimatedNetEur: 0,
      estimatedVatEur: 0,
      estimatedGrossEur: 0,
      estimatedCapitalizedEur: 0,
      confirmedNetEur: 12.34,
      confirmedVatEur: 0,
      confirmedGrossEur: 12.34,
      confirmedCapitalizedEur: 12.34,
      confirmedLandedTotalEur: 112.34,
      projectedLandedTotalEur: 112.34,
    }),
  });
  assert.ok(summary);
  assert.equal(summary.costStatus, "confirmed");

  const zeroSummary = normalizeSupplierBatchCostSummary({
    ...summary,
    confirmedNetEurCents: 0,
    confirmedVatEurCents: 0,
    confirmedGrossEurCents: 0,
    confirmedCapitalizedEurCents: 0,
    confirmedLandedTotalEurCents: 10000,
    projectedLandedTotalEurCents: 10000,
    costStatus: "confirmed_zero",
  });
  assert.ok(zeroSummary);
  assert.equal(zeroSummary.costStatus, "confirmed_zero");
});

test("core amount and FX overflow fails closed without numeric overflow", () => {
  assert.equal(supplierBatchMoneyToCents("9999999999.99"), 999_999_999_999);
  assert.equal(supplierBatchMoneyToCents("10000000000.00"), null);
  assert.equal(supplierBatchFxAmountToEurCents(999_999_999_999, "1"), 999_999_999_999);
  assert.equal(
    supplierBatchFxAmountToEurCents(1_000_000_000_000, "1000000"),
    null
  );
  assert.equal(
    supplierBatchFxChargeAmountsToEurCents({
      amountNetCents: 1_000_000_000_000,
      vatAmountCents: 1_000_000_000_000,
      amountGrossCents: 2_000_000_000_000,
      capitalizedAmountCents: 2_000_000_000_000,
      rate: "1",
    }),
    null
  );
  assert.doesNotThrow(() => normalizeSupplierBatchCostRpcResult({
    ...validConfirmedRpcResult(),
    amountNetCents: Number.MAX_SAFE_INTEGER,
    vatAmountCents: 1,
    amountGrossCents: Number.MAX_SAFE_INTEGER,
    capitalizedAmountCents: 0,
  }));
  assert.equal(
    normalizeSupplierBatchCostRpcResult({
      ...validConfirmedRpcResult(),
      amountNetCents: Number.MAX_SAFE_INTEGER,
      vatAmountCents: 1,
      amountGrossCents: Number.MAX_SAFE_INTEGER,
      capitalizedAmountCents: 0,
    }),
    null
  );

  const maxUnitLine = {
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: null,
    qtyReceived: 100,
    weightGram: null,
    goodsCost: 9999999999.99,
    goodsUnitCost: "99999999.9999",
    currentAllocation: 0,
    candidateAllocation: 0,
    existingInbound: 0,
    inboundAfterCandidate: 0,
    currentLandedLineCost: 9999999999.99,
    projectedLandedLineCost: 9999999999.99,
    currentLandedUnitCost: "99999999.9999",
    projectedLandedUnitCost: "99999999.9999",
  };
  assert.equal(
    normalizeSupplierBatchLineProjection(maxUnitLine)?.goodsUnitCost,
    99999999.9999
  );
  assert.equal(
    normalizeSupplierBatchLineProjection({
      ...maxUnitLine,
      goodsUnitCost: "100000000",
    }),
    null
  );
  assert.equal(
    normalizeSupplierBatchLineProjection({
      ...maxUnitLine,
      currentLandedUnitCost: 100000000,
      projectedLandedUnitCost: 100000000,
    }),
    null
  );
  assert.equal(
    normalizeSupplierBatchLineProjection({
      ...maxUnitLine,
      goodsCost: 10000000000,
      currentLandedLineCost: 10000000000,
      projectedLandedLineCost: 10000000000,
    }),
    null
  );
});

test("RPC read accepts the canonical FINANCE_ADJUSTMENT_REQUIRED code", () => {
  const result = normalizeSupplierBatchCostRpcResult({
    status: "preview",
    batchId: ids.batch,
    batchCode: "V2-CONTRACT",
    revision: "revision-1",
    chargeType: "transport",
    amountNet: 0,
    vatAmount: 0,
    amountGross: 0,
    capitalizedAmount: 0,
    currency: "EUR",
    vatTreatment: "recoverable",
    allocationMethod: "goods_value",
    zeroCostReason: "not capitalized",
    manualAllocationsSnapshot: [],
    payloadFingerprint: "fingerprint-123456",
    candidateAllocationTotal: 0,
    confirmedAllocationTotal: 0,
    allocationTotal: 0,
    candidateAllocations: [],
    confirmedAllocations: [],
    allocations: [],
    lineProjections: [],
    confirmationBlocked: true,
    confirmationBlockCode: "FINANCE_ADJUSTMENT_REQUIRED",
    confirmationBlockReason: "An affected finance layer requires adjustment.",
    metadata: {},
  });
  assert.ok(result);
  assert.equal(result.confirmationBlockCode, "FINANCE_ADJUSTMENT_REQUIRED");
});

test("correction preview totals expose real before/after totals and signed delta", () => {
  const previewInput = {
    status: "preview",
    batchId: ids.batch,
    batchCode: "V2-CONTRACT",
    revision: "revision-1",
    chargeType: "transport",
    amountNet: 4,
    vatAmount: 0,
    amountGross: 4,
    capitalizedAmount: 0,
    currency: "EUR",
    vatTreatment: "recoverable",
    allocationMethod: "goods_value",
    zeroCostReason: "correction preview test",
    manualAllocationsSnapshot: [],
    payloadFingerprint: "fingerprint-123456",
    candidateAllocationTotal: 0,
    confirmedAllocationTotal: 0,
    allocationTotal: 0,
    candidateAllocations: [],
    confirmedAllocations: [],
    allocations: [],
    lineProjections: [],
    confirmationBlocked: false,
    confirmationBlockCode: null,
    confirmationBlockReason: null,
    metadata: {},
    correctionPreview: true,
    correctionTotals: {
      otherEffectiveCostEur: 10,
      originalChargeEur: 2.5,
      replacementChargeEur: 4,
      beforeTotalEur: 12.5,
      afterTotalEur: 14,
      costDeltaEur: 1.5,
    },
  };
  const result = normalizeSupplierBatchCostRpcResult(previewInput);
  assert.ok(result);
  assert.equal(result.correctionPreview, true);
  assert.deepEqual(result.correctionTotals, {
    otherEffectiveCostEurCents: 1000,
    originalChargeEurCents: 250,
    replacementChargeEurCents: 400,
    beforeTotalEurCents: 1250,
    afterTotalEurCents: 1400,
    costDeltaEurCents: 150,
  });

  const negativeDelta = normalizeSupplierBatchCostRpcResult({
    ...previewInput,
    correctionTotals: {
      otherEffectiveCostEur: 10,
      originalChargeEur: 4,
      replacementChargeEur: 2.5,
      beforeTotalEur: 14,
      afterTotalEur: 12.5,
      costDeltaEur: -1.5,
    },
  });
  assert.ok(negativeDelta);
  assert.equal(negativeDelta.correctionTotals.costDeltaEurCents, -150);

  assert.equal(
    normalizeSupplierBatchCostRpcResult({
      ...previewInput,
      correctionTotals: {
        otherEffectiveCostEur: 10,
        originalChargeEur: 2.5,
        replacementChargeEur: 4,
        beforeTotalEur: 10,
        afterTotalEur: 14,
        costDeltaEur: 4,
      },
    }),
    null
  );
});

test("correction receipts keep applied and pending states fail-closed", () => {
  const corrected = {
    status: "corrected",
    correctionId: ids.correction,
    originalChargeId: ids.charge,
    replacementChargeId: ids.replacement,
    batchCode: "V2-CONTRACT",
    idempotencyKey: "correction-key-1",
    previewFingerprint: "preview-fingerprint-123456",
    revision: "revision-2",
    financeAdjustmentRequired: false,
    replacement: validConfirmedRpcResult(),
  };
  const normalizedCorrected = normalizeSupplierBatchCorrectionResult(corrected);
  assert.ok(normalizedCorrected);
  assert.equal(normalizedCorrected.status, "corrected");
  assert.equal(normalizedCorrected.replacement?.status, "confirmed");
  assert.equal(normalizedCorrected.replacement?.charge?.chargeId, ids.replacement);
  assert.deepEqual(normalizeSupplierBatchCorrectionReceipt(corrected), normalizedCorrected);

  const pending = {
    ...corrected,
    status: "pending_finance_adjustment",
    replacementChargeId: null,
    financeAdjustmentRequired: true,
    replacement: null,
  };
  const normalizedPending = normalizeSupplierBatchCorrectionResult(pending);
  assert.ok(normalizedPending);
  assert.equal(normalizedPending.replacementChargeId, null);
  assert.equal(normalizedPending.replacement, null);

  assert.equal(
    normalizeSupplierBatchCorrectionResult({
      ...corrected,
      financeAdjustmentRequired: true,
    }),
    null
  );
  assert.equal(
    normalizeSupplierBatchCorrectionResult({
      ...pending,
      replacementChargeId: ids.replacement,
    }),
    null
  );
  assert.equal(
    normalizeSupplierBatchCorrectionResult({
      ...corrected,
      replacement: validConfirmedRpcResult({ batchCode: "OTHER-BATCH" }),
    }),
    null
  );
});

test("effective confirmed ids replace an original once without double counting", () => {
  const charges = [
    { id: ids.charge, status: "confirmed" },
    { id: ids.otherCharge, status: "confirmed" },
    { id: ids.replacement, status: "confirmed" },
    { id: "88888888-8888-4888-8888-888888888888", status: "estimated" },
  ];
  assert.deepEqual(
    resolveSupplierBatchEffectiveChargeIds(charges, [
      {
        originalChargeId: ids.charge,
        replacementChargeId: ids.replacement,
        status: "applied",
      },
    ]),
    [ids.otherCharge, ids.replacement]
  );
  assert.deepEqual(
    resolveSupplierBatchEffectiveChargeIds(charges, [
      {
        originalChargeId: ids.charge,
        replacementChargeId: null,
        status: "pending_finance_adjustment",
      },
    ]),
    [ids.charge, ids.otherCharge, ids.replacement]
  );
  assert.equal(
    resolveSupplierBatchEffectiveChargeIds(charges, [
      {
        originalChargeId: ids.charge,
        replacementChargeId: ids.replacement,
        status: "applied",
      },
      {
        originalChargeId: ids.charge,
        replacementChargeId: ids.otherCharge,
        status: "applied",
      },
    ]),
    null
  );
  assert.equal(
    resolveSupplierBatchEffectiveChargeIds(
      [{ id: ids.charge, status: "unexpected" }],
      []
    ),
    null
  );
});

test("V2 input schemas enforce currencies, snapshots, stale gates and correction reasons", () => {
  assert.equal(supplierBatchChargeV2PreviewSchema.safeParse(baseCharge()).success, true);
  assert.equal(
    supplierBatchChargeV2PreviewSchema.safeParse(
      baseCharge({ currency: "USD", fxRateToEur: 0.92, fxRateDate: "2026-08-27", fxRateSource: "manual" })
    ).success,
    true
  );
  assert.equal(
    supplierBatchChargeV2PreviewSchema.safeParse(
      baseCharge({ currency: "USD", fxRateToEur: 0.92, fxRateDate: "2026-08-27" })
    ).success,
    false
  );
  assert.equal(
    supplierBatchChargeV2PreviewSchema.safeParse(baseCharge({ fxRateDate: "2026-08-27" })).success,
    false
  );
  assert.equal(
    supplierBatchChargeV2PreviewSchema.safeParse(
      baseCharge({ currency: "USD", fxRateToEur: 1e-13, fxRateDate: "2026-08-27", fxRateSource: "manual" })
    ).success,
    false
  );

  const estimate = supplierBatchChargeV2EstimateSchema.safeParse(
    baseCharge({ idempotencyKey: "estimate-v2-key" })
  );
  assert.equal(estimate.success, true);

  const confirm = supplierBatchChargeV2ConfirmSchema.safeParse(
    baseCharge({
      idempotencyKey: "confirm-v2-key",
      revision: "revision-1",
      previewFingerprint: "fingerprint-123456",
    })
  );
  assert.equal(confirm.success, true);
  assert.equal(
    supplierBatchChargeV2ConfirmSchema.safeParse(
      baseCharge({ idempotencyKey: "confirm-v2-key", revision: "revision-1" })
    ).success,
    false
  );
  assert.equal(
    supplierBatchChargeV2CancelSchema.safeParse({
      chargeId: ids.charge,
      reason: "replace with corrected invoice",
      idempotencyKey: "cancel-v2-key",
    }).success,
    true
  );
  assert.equal(
    supplierBatchChargeV2CorrectSchema.safeParse(
      baseCharge({
        chargeId: ids.charge,
        correctionReason: "supplier corrected invoice",
        idempotencyKey: "correct-v2-key",
        revision: "revision-1",
        previewFingerprint: "fingerprint-123456",
      })
    ).success,
    true
  );
});

test("V2 permissions and routes keep read/estimate/export separate from confirmation", () => {
  assert.match(sharedSource, /supplierBatchCostPermissions\.read/);
  assert.match(sharedSource, /supplierBatchCostPermissions\.estimate/);
  assert.match(sharedSource, /supplierBatchCostPermissions\[operation\]/);
  assert.match(confirmRouteSource, /hasSupplierBatchCostPermission\(admin\.authState, "confirm"\)/);
  assert.doesNotMatch(confirmRouteSource, /legacyManage/);
  assert.match(correctRouteSource, /hasSupplierBatchCostPermission\(admin\.authState, "correct"\)/);
  assert.doesNotMatch(correctRouteSource, /legacyManage/);
  assert.match(cancelRouteSource, /hasSupplierBatchCostCostPermission|hasSupplierBatchCostPermission/);
  assert.match(historyRouteSource, /listAdminSupplierBatchCostHistoryV2/);
  assert.match(migrationSource, /p_allow_legacy_estimate/);
  assert.match(migrationSource, /supplier_batch\.manage_costs/);
  assert.match(exportRouteSource, /scope(?:s*===s*|.*enum\(\[)[^\n]*charges/);
  assert.match(exportRouteSource, /hasSupplierBatchCostPermission\(admin\.authState, "export"\)/);
  assert.match(exportRouteSource, /scope === "charges"/);
  assert.match(exportRouteSource, /hasSupplierBatchHistoryPermission\(admin\.authState\)/);
});

test("preview wrappers share one calculator and keep correction permission separate", () => {
  const coreStart = migrationSource.indexOf(
    "create or replace function private.admin_preview_supplier_batch_charge_v2_core"
  );
  const ordinaryStart = migrationSource.indexOf(
    "create or replace function public.admin_preview_supplier_batch_charge_v2"
  );
  const correctionStart = migrationSource.indexOf(
    "create or replace function public.admin_preview_supplier_batch_charge_correction_v2"
  );
  assert.ok(coreStart >= 0);
  assert.ok(ordinaryStart > coreStart);
  assert.ok(correctionStart > ordinaryStart);
  const wrapperSource = migrationSource.slice(ordinaryStart, correctionStart + 700);
  assert.match(wrapperSource, /admin_preview_supplier_batch_charge_v2_core/);
  assert.match(wrapperSource, /'supplier_batch\.estimate', true/);
  assert.match(wrapperSource, /admin_preview_supplier_batch_charge_correction_v2/);
  assert.match(wrapperSource, /'supplier_batch\.correct', false/);
  const coreSource = migrationSource.slice(coreStart, ordinaryStart);
  assert.match(coreSource, /p_required_permission/);
  assert.match(coreSource, /p_allow_legacy_estimate/);
  assert.match(coreSource, /supplier_batch_v2_has_permission\(\s*p_required_permission/);
  assert.match(coreSource, /p_required_permission = 'supplier_batch\.correct'/);
  assert.match(coreSource, /v_terms\.charge_id is null[\s\S]{0,260}CHARGE_NOT_FOUND/);
  assert.match(coreSource, /v_existing\.status <> 'confirmed'[\s\S]{0,180}CORRECTION_NOT_ALLOWED/);
  assert.match(coreSource, /status in \('candidate_ready', 'pending_finance_adjustment', 'applied'\)/);
  assert.match(coreSource, /p_required_permission = 'supplier_batch\.correct' then v_terms\.charge_id/);
  assert.match(migrationSource, /p_exclude_charge_id is null or charge\.id <> p_exclude_charge_id/);
});

test("V2 SQL is additive, permission-checked and protects cross-currency accounting", () => {
  for (const fn of [
    "admin_list_supplier_batch_cost_summaries_v2",
    "admin_preview_supplier_batch_charge_v2",
    "admin_save_supplier_batch_charge_estimate_v2",
    "admin_confirm_supplier_batch_charge_v2",
    "admin_cancel_supplier_batch_charge_v2",
    "admin_correct_supplier_batch_charge_v2",
    "admin_list_supplier_batch_cost_history_v2",
  ]) {
    assert.match(migrationSource, new RegExp(`create or replace function public\\.${fn}`));
    assert.match(migrationSource, new RegExp(`grant execute on function public\\.${fn}`));
    assert.match(migrationSource, new RegExp(`revoke all on function public\\.${fn}`));
  }
  assert.match(migrationSource, /set search_path = ''/);
  assert.match(migrationSource, /supplier_batch_charge_corrections_original_charge_batch_fk/);
  assert.match(migrationSource, /supplier_batch_charge_corrections_replacement_charge_batch_fk/);
  assert.match(migrationSource, /foreign key \(original_charge_id, batch_id\)/);
  assert.match(migrationSource, /foreign key \(replacement_charge_id, batch_id\)/);
  assert.doesNotMatch(migrationSource, /supplier_batch_charge_allocations_eur_idx/);
  assert.match(migrationSource, /select charge\.\*\s*into v_charge/);
  assert.doesNotMatch(migrationSource, /adjusted\.goods_cost_snapshot_eur/);
  assert.match(migrationSource, /BATCH_FX_RATE_REQUIRED/);
  assert.match(migrationSource, /FINANCE_ADJUSTMENT_REQUIRED/);
  assert.match(migrationSource, /landed_line_cost numeric\(14, 2\)/);
  assert.match(migrationSource, /landed_unit_cost numeric\(14, 4\)/);
  assert.match(migrationSource, /supplier_batch_charge_allocations_original_landed_complete/);
  assert.match(migrationSource, /supplier_batch_charge_corrections_state_shape/);
  assert.match(migrationSource, /supplier_batch_charge_corrections_one_active_idx/);
  assert.match(
    migrationSource,
    /status in \('candidate_ready', 'pending_finance_adjustment', 'applied'\)/
  );
  assert.match(migrationSource, /correction_pending_finance_adjustment_v2/);
  assert.match(migrationSource, /correction_applied_v2/);
  assert.match(migrationSource, /'replacementChargeId', null/);
  assert.match(migrationSource, /'financeAdjustmentRequired', true/);
  assert.match(migrationSource, /correctionFingerprint/);
  assert.match(migrationSource, /CORRECTION_REPLACEMENT_MANAGED/);
  assert.match(migrationSource, /CORRECTION_ALREADY_EXISTS/);
  assert.match(migrationSource, /v_effective_replacement_id/);
  assert.match(
    migrationSource,
    /return private\.supplier_batch_charge_result_v2\(v_effective_replacement_id\)/
  );
  assert.match(migrationSource, /Correction idempotency key belongs to another charge/);
  const historyStart = migrationSource.indexOf(
    "create or replace function public.admin_list_supplier_batch_cost_history_v2"
  );
  const historyEnd = migrationSource.indexOf("\ndo $$", historyStart);
  assert.ok(historyStart >= 0 && historyEnd > historyStart);
  const historySource = migrationSource.slice(historyStart, historyEnd);
  assert.doesNotMatch(historySource, /'actorEmail'|'actorRole'|'before'|'after'|'correctionMetadata'/);
  assert.match(historySource, /idempotencyKey/);
  assert.match(historySource, /originalChargeId/);
  assert.match(historySource, /replacementChargeId/);
  assert.match(migrationSource, /'links', jsonb_build_object/);
  const pendingBranchStart = migrationSource.indexOf("if v_finance_adjustment_required then");
  const appliedBranchStart = migrationSource.indexOf("-- The unconsumed branch creates a confirmed replacement directly.");
  assert.ok(pendingBranchStart >= 0 && appliedBranchStart > pendingBranchStart);
  const pendingBranch = migrationSource.slice(pendingBranchStart, appliedBranchStart);
  assert.doesNotMatch(pendingBranch, /insert into public\.supplier_batch_charges/);
  assert.doesNotMatch(pendingBranch, /insert into public\.supplier_batch_charge_allocations/);
  assert.doesNotMatch(pendingBranch, /finance_cost_layers/);
  assert.match(migrationSource, /supplier_batch_charges_gross_matches_net_vat/);
  assert.doesNotMatch(
    migrationSource,
    /revoke all on function public\.admin_confirm_supplier_batch_charge\(text, jsonb, text, text\)/
  );
  assert.match(migrationSource, /between 0\.000001 and 1000000/);
  assert.match(migrationSource, /goods_value_eur = round\(total_cost \* goods_value_fx_rate_to_eur, 2\)/);
  assert.match(migrationSource, /new\.goods_value_eur <> round\(new\.total_cost \* new\.goods_value_fx_rate_to_eur, 2\)/);
  assert.match(migrationSource, /create trigger supplier_batches_v2_fx_guard/);
  assert.match(
    migrationSource,
    /create or replace function private\.supplier_batch_lines_v2_confirmed_freeze\(\)/
  );
  assert.match(migrationSource, /new\.batch_id is distinct from old\.batch_id/);
  assert.match(migrationSource, /new\.sku_code is distinct from old\.sku_code/);
  assert.match(migrationSource, /new\.qty_received is distinct from old\.qty_received/);
  assert.match(migrationSource, /new\.unit_cost is distinct from old\.unit_cost/);
  assert.match(migrationSource, /new\.line_total is distinct from old\.line_total/);
  assert.match(migrationSource, /SUPPLIER_BATCH_LINE_CONFIRMED_IMMUTABLE/);
  assert.match(migrationSource, /create trigger supplier_batch_lines_v2_confirmed_freeze/);
  assert.match(
    migrationSource,
    /revoke all on function private\.supplier_batch_lines_v2_confirmed_freeze\(\)/
  );
  assert.match(migrationSource, /jsonb_array_length\(coalesce\(p_payload -> 'manualAllocations'/);
  assert.match(migrationSource, /> 500/);
  assert.match(migrationSource, /supplier_batch_v2_goods_value_eur[\s\S]*batch\.total_cost/);
  assert.match(migrationSource, /array_remove\(review_codes, 'MIXED_CURRENCY'\)/);
  assert.match(migrationSource, /different cancellation reason/);
  assert.match(
    migrationSource,
    /amount_gross_eur = round\(amount_net \* fx_rate_to_eur, 2\)\s*\n\s*\+ round\(vat_amount \* fx_rate_to_eur, 2\)/
  );
  assert.match(
    migrationSource,
    /when v_charge\.status = 'estimated' then coalesce\(v_result -> 'candidateAllocations'/
  );
  assert.doesNotMatch(
    migrationSource,
    /when v_charge\.status = 'confirmed' then coalesce\(v_result -> 'allocations'/
  );
  assert.match(migrationSource, /status = 'cancelled'/);
  assert.match(migrationSource, /status <> 'estimated'/);
  assert.match(migrationSource, /charge\.status in \('estimated', 'confirmed'\)/);
  assert.doesNotMatch(migrationSource, /grant select on table public\.products/);
  assert.match(migrationSource, /admin_get_supplier_batch_products_v2/);
  assert.match(migrationSource, /admin_list_supplier_batch_charge_effective_flags_v2/);
  assert.match(
    migrationSource,
    /admin_list_supplier_batch_charge_effective_flags_v2[\s\S]{0,2200}partspro_has_permission\('product\.read_admin'\)/
  );
  assert.match(migrationSource, /PRODUCT_LOOKUP_LIMIT_EXCEEDED/);
  assert.match(migrationSource, /'price_rule_ok'/);
  assert.doesNotMatch(
    migrationSource.slice(
      migrationSource.indexOf("create or replace function private.admin_get_supplier_batch_products_v2"),
      migrationSource.indexOf("-- Bounded, stable history", migrationSource.indexOf("create or replace function private.admin_get_supplier_batch_products_v2"))
    ),
    /'cost_price'|'retail_price'|'b2b_price'/
  );
  assert.match(migrationSource, /supplier_batch_v2_assert_eur_product/);
  assert.match(migrationSource, /SUPPLIER_BATCH_COST_OVERFLOW/);
  assert.match(migrationSource, /p_amount > 9999999999\.99/);
  assert.match(migrationSource, /p_amount \* p_fx_rate > 9999999999\.99/);
  assert.match(migrationSource, /supplier_batch_v2_assert_finance_totals/);
  const enrichmentStart = migrationSource.indexOf(
    "create or replace function private.supplier_batch_v2_enrich_allocations"
  );
  const enrichmentEnd = migrationSource.indexOf(
    "-- The V1 line projection adds original-currency goods and inbound amounts.",
    enrichmentStart
  );
  assert.ok(enrichmentStart >= 0 && enrichmentEnd > enrichmentStart);
  const enrichmentSource = migrationSource.slice(enrichmentStart, enrichmentEnd);
  assert.match(migrationSource, /create or replace function private\.supplier_batch_v2_guard_cents/);
  assert.match(migrationSource, /create or replace function private\.supplier_batch_v2_guard_unit/);
  assert.match(enrichmentSource, /supplier_batch_v2_guard_cents/);
  assert.match(enrichmentSource, /supplier_batch_v2_guard_unit/);
  assert.match(enrichmentSource, /round\(scaled\.goods_raw_cents, 0\), scaled\.qty_received/);
  assert.doesNotMatch(enrichmentSource, /goods_raw_cents[\s\S]{0,80}::bigint/);
  assert.doesNotMatch(enrichmentSource, /::bigint/);
  assert.match(
    migrationSource,
    /supplier_batch_v2_guard_cents\([\s\S]{0,900}SUPPLIER_BATCH_COST_OVERFLOW/
  );
  assert.match(migrationSource, /99999999\.9999/);
  assert.match(migrationSource, /round\(abs\(v_total\) \* 100, 0\) > 9223372036854775807/);
  assert.match(
    migrationSource,
    /case when original_totals_comparable[\s\S]{0,180}confirmed_capitalized_eur/
  );
  assert.match(migrationSource, /new\.currency is distinct from old\.currency/);
  assert.match(migrationSource, /new\.total_cost is distinct from old\.total_cost/);
  assert.match(migrationSource, /new\.line_no is distinct from old\.line_no/);
  assert.match(migrationSource, /candidate_ready', 'rejected'\)\s+and replacement_charge_id is null/);
  assert.match(migrationSource, /revoke all on table public\.supplier_batch_charge_corrections from public, anon, authenticated, service_role/);
  assert.match(migrationSource, /drop policy if exists partspro_supplier_batch_charge_corrections_staff_read/);
  assert.match(migrationSource, /revoke all on function private\.supplier_batch_cost_audit_projection_v2\(jsonb\)/);
  assert.match(migrationSource, /v_terms\.batch_goods_fx_evidence_url is distinct from v_batch\.goods_value_fx_evidence_url/);
  assert.match(migrationSource, /beforeTotalEur[\s\S]{0,180}afterTotalEur[\s\S]{0,180}costDeltaEur/);
  const correctionInsertStart = migrationSource.indexOf(
    "insert into public.supplier_batch_charges (",
    migrationSource.indexOf("create or replace function public.admin_correct_supplier_batch_charge_v2")
  );
  const correctionInsertEnd = migrationSource.indexOf(
    "returning * into v_replacement",
    correctionInsertStart
  );
  assert.ok(correctionInsertStart >= 0 && correctionInsertEnd > correctionInsertStart);
  assert.doesNotMatch(
    migrationSource.slice(correctionInsertStart, correctionInsertEnd),
    /correctionId|originalChargeId|replacementChargeId|correctionStatus|correctionFingerprint|payloadFingerprint/
  );
  assert.match(migrationSource, /jsonb_build_object\('source', 'supplier_batch_cost_v2'\)/);
  assert.match(migrationSource, /admin_get_supplier_batch_products_v2[\s\S]{0,1800}partspro_has_permission\('product\.read_admin'\)/);
});

test("list route accepts the UI filter vocabulary and transport alias", () => {
  for (const key of ["q", "currency", "costStatus", "chargeType", "vatTreatment", "hasTransport", "hasTransportCost", "sort"]) {
    assert.match(listRouteSource, new RegExp(`${key}`));
  }
});
