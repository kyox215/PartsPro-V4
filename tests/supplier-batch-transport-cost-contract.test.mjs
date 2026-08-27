import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  normalizeSupplierBatchCostRpcResult,
  normalizeSupplierBatchCostSummary,
  normalizeSupplierBatchChargeAllocation,
  normalizeSupplierBatchCharge,
  normalizeSupplierBatchLineProjection,
  summarizeSupplierBatchLineCosts,
  supplierBatchExportRowCount,
  supplierBatchMoneyToCents,
  supplierBatchSumMoneyCents,
} from "../src/lib/partspro-supplier-batch-cost-core.mjs";
import {
  supplierBatchChargeConfirmSchema,
  supplierBatchChargeEstimateSchema,
  supplierBatchChargePreviewSchema,
} from "../src/lib/partspro-supplier-batch-cost-input-schema.mjs";
import { toPublicSkuCore } from "../src/lib/partspro-sku-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(path.join(repoRoot, relativePath), "utf8");
const repositorySource = read("src/lib/partspro-repository.ts");
const filesSource = read("src/lib/partspro-supplier-batch-files.ts");
const clientSchemaSource = read("src/lib/partspro-supplier-batch-cost-input-schema.mjs");
const supplierBatchListRouteSource = read("src/app/api/admin/supplier-batches/route.ts");
const supplierBatchDetailRouteSource = read(
  "src/app/api/admin/supplier-batches/[batchCode]/route.ts"
);
const supplierBatchPreviewRouteSource = read(
  "src/app/api/admin/supplier-batches/[batchCode]/charges/preview/route.ts"
);
const supplierBatchEstimateRouteSource = read(
  "src/app/api/admin/supplier-batches/[batchCode]/charges/estimate/route.ts"
);
const supplierBatchConfirmRouteSource = read(
  "src/app/api/admin/supplier-batches/[batchCode]/charges/confirm/route.ts"
);
const exportRouteSource = read("src/app/api/admin/supplier-batches/export/route.ts");
const transportMigrationSource = read(
  "supabase/migrations/20260825202035_supplier_batch_transport_costs.sql"
);
const permissionMigrationSource = read(
  "supabase/migrations/20260825202034_revoke_supplier_batch_truncate_privileges.sql"
);
const supplierBatchProductsMigrationSource = read(
  "supabase/migrations/20260827121835_admin_get_supplier_batch_products.sql"
);
const supplierBatchProductsStart = repositorySource.indexOf(
  "async function readSupplierBatchProducts("
);
const supplierBatchProductsEnd = repositorySource.indexOf(
  "\nasync function readSupplierBatchInventory(",
  supplierBatchProductsStart
);
const supplierBatchProductsSource = repositorySource.slice(
  supplierBatchProductsStart,
  supplierBatchProductsEnd
);
const adminProductRowStart = repositorySource.indexOf(
  "async function readAdminProductRow("
);
const adminProductRowEnd = repositorySource.indexOf(
  "\nasync function readAdminProduct(",
  adminProductRowStart
);
const adminProductRowSource = repositorySource.slice(adminProductRowStart, adminProductRowEnd);

const supplierBatchLookupRpcChunkSize = 500;
const supplierBatchLookupInputLimit = 1000;

// This executable oracle deliberately uses the existing shared JS normalizer.
// The SQL RPC mirrors this candidate order locally so the shared helper stays
// untouched while the contract test still covers edge-case aliases.
function referenceCatalogLookupCandidates(value) {
  const trimmed = value.trim();
  const publicSku = toPublicSkuCore(trimmed);
  const candidates = [trimmed, trimmed.toUpperCase(), publicSku];

  if (!/^MOBILAX[-_\s]/i.test(trimmed)) {
    candidates.push(`MOBILAX-${publicSku}`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function referenceSupplierBatchLookupKey(value) {
  return toPublicSkuCore(value).toUpperCase();
}

function referenceDedupeLookupCodes(values) {
  const codesByKey = new Map();

  for (const value of values) {
    const key = referenceSupplierBatchLookupKey(value);

    if (key && !codesByKey.has(key)) {
      codesByKey.set(key, value);
    }
  }

  return Array.from(codesByKey.values());
}

function referenceValidateLookupCodes(values) {
  if (!Array.isArray(values)) {
    throw new Error("lookup codes must be an array");
  }

  if (values.length > supplierBatchLookupInputLimit) {
    throw new Error("at most 1000 lookup codes");
  }

  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("lookup codes must be non-empty");
    }

    if (value.trim().length > 128) {
      throw new Error("lookup codes must be at most 128 characters");
    }
  }

  return values.map((value) => value.trim());
}

function referenceMapSupplierBatchResponse(data, requestedCodes) {
  if (!Array.isArray(data)) {
    throw new Error("invalid response");
  }

  const requestedKeys = new Set(requestedCodes.map(referenceSupplierBatchLookupKey));
  const returnedLookupKeys = new Set();
  const productsBySku = new Map();

  for (const row of data) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("invalid row");
    }

    const lookupCode = typeof row.lookup_code === "string" ? row.lookup_code.trim() : "";
    const skuCode = typeof row.sku_code === "string" ? row.sku_code.trim() : "";

    if (!lookupCode || !skuCode) {
      throw new Error("missing lookup or sku code");
    }

    const lookupKey = referenceSupplierBatchLookupKey(lookupCode);
    const skuKey = referenceSupplierBatchLookupKey(skuCode);

    if (!requestedKeys.has(lookupKey)) {
      throw new Error("unexpected lookup code");
    }

    if (returnedLookupKeys.has(lookupKey)) {
      throw new Error("duplicate lookup code");
    }

    returnedLookupKeys.add(lookupKey);
    productsBySku.set(lookupKey, row);
    productsBySku.set(skuKey, row);
  }

  return productsBySku;
}

const rpcBatchId = "11111111-1111-4111-8111-111111111111";
const rpcLineId = "22222222-2222-4222-8222-222222222222";
const rpcLineIdTwo = "33333333-3333-4333-8333-333333333333";

function rpcAllocation({
  batchLineId = rpcLineId,
  lineNo = 1,
  amount = 10,
  goodsCost = 6,
  qty = 2,
  weight = 100,
  metadata,
} = {}) {
  return {
    batchLineId,
    lineNo,
    skuCode: `SKU-${lineNo}`,
    qtyReceivedSnapshot: qty,
    goodsCostSnapshot: goodsCost,
    weightGramSnapshot: weight,
    basisValue: goodsCost,
    shareRatio: 1,
    allocatedAmount: amount,
    allocatedUnitAmount: amount / qty,
    landedLineCost: goodsCost + amount,
    landedUnitCost: (goodsCost + amount) / qty,
    roundingAdjustment: 0,
    ...(metadata === undefined ? {} : { metadata }),
  };
}

function rpcProjection({
  batchLineId = rpcLineId,
  lineNo = 1,
  candidateAllocation = 10,
  goodsCost = 6,
  qty = 2,
} = {}) {
  return {
    batchLineId,
    lineNo,
    skuCode: `SKU-${lineNo}`,
    qtyReceived: qty,
    weightGram: 100,
    goodsCost,
    goodsUnitCost: goodsCost / qty,
    currentAllocation: 0,
    candidateAllocation,
    existingInbound: 0,
    inboundAfterCandidate: candidateAllocation,
    currentLandedLineCost: goodsCost,
    projectedLandedLineCost: goodsCost + candidateAllocation,
    currentLandedUnitCost: goodsCost / qty,
    projectedLandedUnitCost: (goodsCost + candidateAllocation) / qty,
  };
}

function rpcResult(status, overrides = {}) {
  const allocation = rpcAllocation({ metadata: status === "preview" ? undefined : {} });
  const projection = rpcProjection();
  const result = {
    status,
    batchId: rpcBatchId,
    batchCode: "BATCH-RPC",
    revision: "revision-1",
    chargeType: "transport",
    amountNet: 10,
    vatAmount: 0,
    amountGross: 10,
    capitalizedAmount: 10,
    currency: "EUR",
    vatTreatment: "recoverable",
    allocationMethod: "goods_value",
    carrierName: "Carrier",
    reference: "REF-1",
    occurredAt: "2026-08-25T12:00:00.000Z",
    evidenceUrl: null,
    notes: null,
    zeroCostReason: null,
    manualAllocationsSnapshot: [],
    payloadFingerprint: "fingerprint-1",
    ...(status === "preview"
      ? {}
      : { metadata: { source: "admin_supplier_batch_cost_api" } }),
    candidateAllocationTotal: status === "confirmed" || status === "cancelled" ? 0 : 10,
    candidateAllocations: status === "confirmed" || status === "cancelled" ? [] : [allocation],
    confirmedAllocationTotal: status === "confirmed" ? 10 : 0,
    confirmedAllocations: status === "confirmed" ? [{ ...allocation, metadata: {} }] : [],
    allocationTotal: status === "cancelled" ? 0 : 10,
    allocations: status === "cancelled" ? [] : [{ ...allocation, metadata: {} }],
    lineProjections: status === "cancelled" ? [] : [projection],
    confirmationBlocked: status === "preview" ? false : undefined,
    confirmationBlockCode: status === "preview" ? null : undefined,
    confirmationBlockReason: status === "preview" ? null : undefined,
  };

  if (status !== "preview") {
    Object.assign(result, {
      chargeId: "44444444-4444-4444-8444-444444444444",
      idempotencyKey: "idempotency-1",
      confirmedBy: status === "confirmed" ? "55555555-5555-4555-8555-555555555555" : null,
      confirmedAt: status === "confirmed" ? "2026-08-25T12:00:00.000Z" : null,
    });
  }

  return { ...result, ...overrides };
}

test("cost summary status preserves unrecorded, zero, estimated, confirmed and review states", () => {
  for (const costStatus of [
    "unrecorded",
    "estimated",
    "confirmed_zero",
    "confirmed",
    "needs_review",
  ]) {
    const summary = normalizeSupplierBatchCostSummary({
      batchId: "11111111-1111-4111-8111-111111111111",
      batchCode: "BATCH-1",
      currency: "EUR",
      goodsValue: 100,
      estimatedCount: costStatus === "estimated" ? 1 : 0,
      confirmedCount: ["confirmed", "confirmed_zero"].includes(costStatus) ? 1 : 0,
      cancelledCount: 0,
      estimatedNet: 0,
      estimatedVat: 0,
      estimatedGross: 0,
      estimatedCapitalized: 0,
      confirmedNet: costStatus === "confirmed" ? 1 : 0,
      confirmedVat: 0,
      confirmedGross: costStatus === "confirmed" ? 1 : 0,
      confirmedCapitalized: costStatus === "confirmed" ? 1 : 0,
      confirmedLandedTotal: costStatus === "confirmed" ? 101 : 100,
      projectedLandedTotal: costStatus === "confirmed" ? 101 : 100,
      confirmationBlocked: costStatus === "needs_review",
      reviewCodes: costStatus === "needs_review" ? ["FINANCIAL_ADJUSTMENT_REQUIRED"] : [],
      costStatus,
    });

    assert.ok(summary);
    assert.equal(summary.costStatus, costStatus);
  }
});

test("malformed summaries and RPC results are unavailable rather than zero", () => {
  assert.equal(normalizeSupplierBatchCostSummary({ costStatus: "unrecorded" }), null);
  assert.equal(normalizeSupplierBatchCostRpcResult({ status: "preview" }), null);
});

test("RPC preview, estimate, confirmed and cancelled fixtures preserve allocation identity", () => {
  for (const status of ["preview", "estimated", "confirmed", "cancelled"]) {
    const normalized = normalizeSupplierBatchCostRpcResult(rpcResult(status));
    assert.ok(normalized, status);
    assert.equal(normalized?.status, status);
  }

  const preview = normalizeSupplierBatchCostRpcResult(rpcResult("preview"));
  assert.ok(preview);
  assert.equal(preview?.charge, null);
  assert.equal(preview?.metadata, null);
  assert.deepEqual(preview?.candidateAllocations[0]?.metadata, {});
  assert.equal(preview?.candidateAllocations[0]?.lineNo, 1);
  assert.equal(preview?.candidateAllocations[0]?.weightGramSnapshot, 100);
  assert.equal(preview?.candidateAllocations[0]?.landedLineCostCents, 1600);
  assert.equal(preview?.candidateAllocations[0]?.landedUnitCost, 8);
  assert.equal(Object.hasOwn(rpcResult("preview"), "metadata"), false);
  assert.equal(
    normalizeSupplierBatchCostRpcResult(rpcResult("preview", { metadata: "not-an-object" })),
    null
  );

  const estimate = normalizeSupplierBatchCostRpcResult(rpcResult("estimated"));
  assert.ok(estimate?.charge);
  assert.equal(estimate?.metadata?.source, "admin_supplier_batch_cost_api");

  const confirmed = normalizeSupplierBatchCostRpcResult(rpcResult("confirmed"));
  assert.ok(confirmed?.charge);
  assert.equal(confirmed?.charge?.status, "confirmed");
  assert.equal(confirmed?.metadata?.source, "admin_supplier_batch_cost_api");

  const swappedProjection = rpcResult("preview", {
    candidateAllocations: [
      rpcAllocation({ batchLineId: rpcLineId, lineNo: 1, amount: 4, goodsCost: 6 }),
      rpcAllocation({ batchLineId: rpcLineIdTwo, lineNo: 2, amount: 6, goodsCost: 4 }),
    ],
    allocations: [
      rpcAllocation({ batchLineId: rpcLineId, lineNo: 1, amount: 4, goodsCost: 6 }),
      rpcAllocation({ batchLineId: rpcLineIdTwo, lineNo: 2, amount: 6, goodsCost: 4 }),
    ],
    candidateAllocationTotal: 10,
    allocationTotal: 10,
    lineProjections: [
      rpcProjection({ batchLineId: rpcLineId, lineNo: 1, candidateAllocation: 6, goodsCost: 6 }),
      rpcProjection({ batchLineId: rpcLineIdTwo, lineNo: 2, candidateAllocation: 4, goodsCost: 4 }),
    ],
  });
  assert.equal(normalizeSupplierBatchCostRpcResult(swappedProjection), null);

  const duplicateLine = rpcResult("preview", {
    candidateAllocations: [
      rpcAllocation({ batchLineId: rpcLineId, lineNo: 1, amount: 5 }),
      rpcAllocation({ batchLineId: rpcLineId, lineNo: 1, amount: 5 }),
    ],
    allocations: [
      rpcAllocation({ batchLineId: rpcLineId, lineNo: 1, amount: 5 }),
      rpcAllocation({ batchLineId: rpcLineId, lineNo: 1, amount: 5 }),
    ],
    candidateAllocationTotal: 10,
    allocationTotal: 10,
  });
  assert.equal(normalizeSupplierBatchCostRpcResult(duplicateLine), null);

  const malformedPreviewMetadata = rpcResult("preview", {
    candidateAllocations: [rpcAllocation({ metadata: "not-an-object" })],
    allocations: [rpcAllocation({ metadata: "not-an-object" })],
  });
  assert.equal(normalizeSupplierBatchCostRpcResult(malformedPreviewMetadata), null);

  for (const field of ["lineNo", "weightGramSnapshot", "landedLineCost", "landedUnitCost"]) {
    const allocation = rpcAllocation();
    delete allocation[field];
    assert.equal(
      normalizeSupplierBatchCostRpcResult(
        rpcResult("preview", {
          candidateAllocations: [allocation],
          allocations: [allocation],
        })
      ),
      null,
      `RPC allocation must include ${field}`
    );
  }
});

test("money values are accumulated in integer cents", () => {
  assert.equal(supplierBatchMoneyToCents(10.1), 1010);
  assert.equal(supplierBatchMoneyToCents("0.09"), 9);
  assert.equal(supplierBatchSumMoneyCents(["10.10", 0.2, "0"]), 1030);
  assert.equal(supplierBatchMoneyToCents(1.001), null);
});

test("zero-quantity line projections expose null unit costs", () => {
  const projection = normalizeSupplierBatchLineProjection({
    batchLineId: "22222222-2222-4222-8222-222222222222",
    lineNo: 1,
    skuCode: null,
    qtyReceived: 0,
    weightGram: null,
    goodsCost: 0,
    goodsUnitCost: 4,
    currentAllocation: 0,
    candidateAllocation: 0,
    existingInbound: 0,
    inboundAfterCandidate: 0,
    currentLandedLineCost: 0,
    projectedLandedLineCost: 0,
    currentLandedUnitCost: null,
    projectedLandedUnitCost: null,
  });

  assert.ok(projection);
  assert.equal(projection.currentLandedUnitCost, null);
  assert.equal(projection.projectedLandedUnitCost, null);
});

test("multiple confirmed allocations are cumulatively reflected per line", () => {
  const lineId = "33333333-3333-4333-8333-333333333333";
  const batchId = "44444444-4444-4444-8444-444444444444";
  const costs = summarizeSupplierBatchLineCosts(
    [
      { id: lineId, qty_received: 2, unit_cost: 3, line_total: 6 },
      { id: "66666666-6666-4666-8666-666666666666", qty_received: 0, unit_cost: 4, line_total: 0 },
    ],
    [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        batch_id: batchId,
        charge_id: "55555555-5555-4555-8555-555555555555",
        batch_line_id: lineId,
        qty_received_snapshot: 2,
        goods_cost_snapshot: 6,
        weight_gram_snapshot: 0,
        basis_value: 6,
        share_ratio: 0.1,
        allocated_amount: 0.5,
        allocated_unit_amount: 0.25,
        rounding_adjustment: 0,
        metadata: {},
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        batch_id: batchId,
        charge_id: "77777777-7777-4777-8777-777777777777",
        batch_line_id: lineId,
        qty_received_snapshot: 2,
        goods_cost_snapshot: 6,
        weight_gram_snapshot: 0,
        basis_value: 6,
        share_ratio: 0.1,
        allocated_amount: 0.25,
        allocated_unit_amount: 0.125,
        rounding_adjustment: -0.01,
        metadata: {},
      },
    ]
  );

  assert.deepEqual(costs, [
    {
      batchLineId: lineId,
      goodsCostCents: 600,
      confirmedInboundCents: 75,
      landedLineCostCents: 675,
      goodsUnitCost: 3,
      landedUnitCost: 3.375,
    },
    {
      batchLineId: "66666666-6666-4666-8666-666666666666",
      goodsCostCents: 0,
      confirmedInboundCents: 0,
      landedLineCostCents: 0,
      goodsUnitCost: 4,
      landedUnitCost: null,
    },
  ]);
});

test("backend contract keeps fee reads caller-scoped, paginated and RPC-only for writes", () => {
  assert.match(repositorySource, /admin_list_supplier_batch_cost_summaries/);
  assert.match(repositorySource, /client\.rpc\(functionName, rpcArgs\)/);
  assert.match(repositorySource, /metadata: \{ source: "admin_supplier_batch_cost_api" \}/);
  assert.match(repositorySource, /FINANCIAL_ADJUSTMENT_REQUIRED/);
  assert.match(repositorySource, /IDEMPOTENCY_CONFLICT/);
  assert.match(repositorySource, /Supplier batch cost \$\{operation\} could not be completed/);
  assert.doesNotMatch(repositorySource, /rawText\.includes/);
  assert.match(repositorySource, /ADMIN_SUPPLIER_BATCH_EXPORT_TOO_LARGE/);
  assert.match(repositorySource, /exportScope/);
  assert.match(repositorySource, /readAdminSupplierBatchChargeDetails/);
  assert.match(repositorySource, /supplierBatchExportRowCount/);
  assert.match(repositorySource, /needsBatchListHydration/);
  assert.match(repositorySource, /page\.fetchedCount < exportPageSize/);
  assert.match(repositorySource, /for \(let index = 0; index < uniqueBatchIds\.length; index \+= 100\)/);
  assert.match(repositorySource, /\.range\(offset, offset \+ 999\)/);
  assert.match(repositorySource, /weight_gram/);
  assert.doesNotMatch(repositorySource, /createSupplierBatchLookupClient/);
});

test("supplier batch hydration uses the bounded permission-checked batch RPC", () => {
  assert.ok(supplierBatchProductsStart >= 0);
  assert.ok(supplierBatchProductsEnd > supplierBatchProductsStart);
  assert.ok(adminProductRowStart >= 0);
  assert.ok(adminProductRowEnd > adminProductRowStart);
  assert.doesNotMatch(supplierBatchProductsSource, /\.from\(["']products["']\)/);
  assert.doesNotMatch(supplierBatchProductsSource, /readMatchingRows/);
  assert.match(supplierBatchProductsSource, /const lookupCodesByKey = new Map<string, string>\(\)/);
  assert.match(supplierBatchProductsSource, /supplierBatchProductLookupRpcChunkSize/);
  assert.match(
    supplierBatchProductsSource,
    /client\.rpc\("admin_get_supplier_batch_products", \{\s*p_sku_codes: chunk/s
  );
  assert.match(
    supplierBatchProductsSource,
    /const requestedKeys = new Set\(chunk\.map\(toSupplierBatchSkuKey\)\)/
  );
  assert.match(
    supplierBatchProductsSource,
    /ADMIN_SUPPLIER_BATCH_PRODUCTS_READ_UNAVAILABLE/
  );
  assert.match(
    supplierBatchProductsSource,
    /productsBySku\.set\(lookupKey, value\)/
  );
  assert.match(
    supplierBatchProductsSource,
    /productsBySku\.set\(skuKey, value\)/
  );
  assert.match(supplierBatchProductsSource, /missing_lookup_or_sku_code/);
  assert.match(supplierBatchProductsSource, /unexpected_lookup_code/);
  assert.match(supplierBatchProductsSource, /duplicate_lookup_code/);
  assert.doesNotMatch(supplierBatchProductsSource, /readAdminProductRow\(client/);
  assert.doesNotMatch(supplierBatchProductsSource, /supplierBatchProductLookupConcurrency/);
  assert.match(adminProductRowSource, /catalogLookupCandidates\(sku\)/);
  assert.match(adminProductRowSource, /client\.rpc\("admin_get_product"/);
  assert.match(adminProductRowSource, /data === null \|\| data === undefined/);
  assert.match(adminProductRowSource, /if \(!isDbRow\(data\)\)/);
  assert.match(adminProductRowSource, /supabaseErrorDetails\(error\)/);

  assert.match(
    supplierBatchProductsMigrationSource,
    /create or replace function private\.admin_get_supplier_batch_products\(\s*p_sku_codes text\[\]\s*\)/s
  );
  assert.match(supplierBatchProductsMigrationSource, /security definer/);
  assert.match(supplierBatchProductsMigrationSource, /set search_path = ''/);
  assert.match(
    supplierBatchProductsMigrationSource,
    /perform private\.partspro_assert_admin_product_read\(\)/
  );
  assert.match(supplierBatchProductsMigrationSource, /v_input_count > 1000/);
  assert.match(
    supplierBatchProductsMigrationSource,
    /Supplier batch product lookup codes must be non-empty/
  );
  assert.match(
    supplierBatchProductsMigrationSource,
    /char_length\(btrim\(input\.code\)\) > 128/
  );
  assert.match(supplierBatchProductsMigrationSource, /normalized_requested as/);
  assert.ok(
    supplierBatchProductsMigrationSource.includes("'\\mMOBILAX\\M[[:space:]_-]*'")
  );
  assert.ok(supplierBatchProductsMigrationSource.includes("'[[:space:]]{2,}'"));
  assert.doesNotMatch(supplierBatchProductsMigrationSource, /private\.partspro_admin_public_sku/);
  assert.match(supplierBatchProductsMigrationSource, /MOBILAX/);
  assert.match(
    supplierBatchProductsMigrationSource,
    /join public\.products as p on p\.sku_code = c\.value/
  );
  for (const field of [
    "lookup_code",
    "sku_code",
    "cost_price",
    "retail_price",
    "b2b_price",
    "weight_gram",
    "stock_qty",
    "stock_status",
  ]) {
    assert.match(supplierBatchProductsMigrationSource, new RegExp(`'${field}'`));
  }
  assert.match(
    supplierBatchProductsMigrationSource,
    /revoke all on function private\.admin_get_supplier_batch_products\(text\[\]\)\s+from public, anon, authenticated, service_role;/
  );
  assert.match(
    supplierBatchProductsMigrationSource,
    /grant execute on function private\.admin_get_supplier_batch_products\(text\[\]\)\s+to authenticated, service_role;/
  );
  assert.match(
    supplierBatchProductsMigrationSource,
    /revoke all on function public\.admin_get_supplier_batch_products\(text\[\]\)\s+from public, anon, authenticated, service_role;/
  );
  assert.match(
    supplierBatchProductsMigrationSource,
    /grant execute on function public\.admin_get_supplier_batch_products\(text\[\]\)\s+to authenticated, service_role;/
  );
  assert.doesNotMatch(supplierBatchProductsMigrationSource, /grant .* on table public\.products/);
});

test("supplier batch lookup candidates preserve priority and edge-case normalization", () => {
  assert.deepEqual(referenceCatalogLookupCandidates("  abc   def  "), [
    "abc   def",
    "ABC   DEF",
    "ABC DEF",
    "MOBILAX-ABC DEF",
  ]);
  assert.equal(toPublicSkuCore("  abc   def  "), "ABC DEF");

  assert.deepEqual(referenceCatalogLookupCandidates("MOBILAX   abc"), [
    "MOBILAX   abc",
    "MOBILAX   ABC",
    "ABC",
  ]);
  assert.deepEqual(referenceCatalogLookupCandidates("MOBILAX.ABC"), [
    "MOBILAX.ABC",
    ".ABC",
    "MOBILAX-.ABC",
  ]);
  assert.deepEqual(referenceCatalogLookupCandidates("MOBILAX+ABC"), [
    "MOBILAX+ABC",
    "+ABC",
    "MOBILAX-+ABC",
  ]);
  assert.deepEqual(referenceCatalogLookupCandidates("MOBILAX_ABC"), [
    "MOBILAX_ABC",
  ]);
});

test("supplier batch lookup bounds, dedupe and response mapping fail closed", () => {
  assert.deepEqual(
    referenceDedupeLookupCodes(["ABC", "abc", "MOBILAX ABC", "EAN-1", "EAN-1"]),
    ["ABC", "EAN-1"]
  );
  assert.equal(referenceValidateLookupCodes([]).length, 0);
  assert.equal(referenceValidateLookupCodes(new Array(1000).fill("SKU")).length, 1000);
  assert.throws(
    () => referenceValidateLookupCodes(new Array(1001).fill("SKU")),
    /at most 1000/
  );
  assert.throws(() => referenceValidateLookupCodes(["  "]), /non-empty/);
  assert.throws(() => referenceValidateLookupCodes(["x".repeat(129)]), /at most 128/);

  assert.equal(referenceMapSupplierBatchResponse([], ["ABC"]).size, 0);
  assert.throws(() => referenceMapSupplierBatchResponse(null, ["ABC"]), /invalid response/);
  assert.throws(() => referenceMapSupplierBatchResponse([{}], ["ABC"]), /missing/);
  assert.throws(
    () => referenceMapSupplierBatchResponse([{ lookup_code: "OTHER", sku_code: "SKU-1" }], ["ABC"]),
    /unexpected/
  );
  assert.throws(
    () =>
      referenceMapSupplierBatchResponse(
        [
          { lookup_code: "ABC", sku_code: "SKU-1" },
          { lookup_code: " abc ", sku_code: "SKU-1" },
        ],
        ["ABC"]
      ),
    /duplicate/
  );

  const product = { lookup_code: "EAN-1", sku_code: "SKU-1", cost_price: 4.2 };
  const productsBySku = referenceMapSupplierBatchResponse([product], ["EAN-1"]);
  assert.strictEqual(productsBySku.get("EAN-1"), product);
  assert.strictEqual(productsBySku.get("SKU-1"), product);
  assert.equal(Math.ceil(581 / supplierBatchLookupRpcChunkSize), 2);
});

test("routes and schemas freeze permission, strict numeric and stable RPC contracts", () => {
  for (const route of ["preview", "estimate", "confirm"]) {
    const source = read(
      `src/app/api/admin/supplier-batches/[batchCode]/charges/${route}/route.ts`
    );
    assert.match(source, /force-dynamic/);
    assert.match(source, /supplier_batch\.manage_costs/);
    assert.match(source, /parseAdminJsonBody/);
    assert.match(source, /hasSupplierBatchReadPermission/);
  }

  assert.match(clientSchemaSource, /\.strict\(\)/);
  assert.match(clientSchemaSource, /\.number\(\)/);
  assert.doesNotMatch(clientSchemaSource, /z\.coerce/);
  assert.match(clientSchemaSource, /\.max\(500\)/);
  assert.match(clientSchemaSource, /capitalizedAmount/);
  assert.match(clientSchemaSource, /unknown/);
});

test("supplier batch transport routes keep DTO reads separate from raw mutation acknowledgements", () => {
  assert.match(supplierBatchListRouteSource, /toSupplierBatchRowDto/);
  assert.match(supplierBatchListRouteSource, /batches\.map\(toSupplierBatchRowDto\)/);
  assert.match(supplierBatchDetailRouteSource, /toSupplierBatchDetailDto/);
  assert.match(supplierBatchDetailRouteSource, /data: detail/);

  assert.match(supplierBatchPreviewRouteSource, /assertSupplierBatchCostRpcRequestContext/);
  assert.match(supplierBatchPreviewRouteSource, /toSupplierBatchCostRpcResultDto/);
  assert.match(
    supplierBatchPreviewRouteSource,
    /requestContext[\s\S]{0,600}previewAdminSupplierBatchCharge\(decodedBatchCode/
  );
  assert.match(supplierBatchPreviewRouteSource, /data,\s*meta: \{ source: result\.source \}/);

  for (const [name, source, repositoryFunction] of [
    ["estimate", supplierBatchEstimateRouteSource, "saveAdminSupplierBatchChargeEstimate"],
    ["confirm", supplierBatchConfirmRouteSource, "confirmAdminSupplierBatchCharge"],
  ]) {
    assert.doesNotMatch(source, /_dto/);
    assert.doesNotMatch(source, /toSupplierBatchCostRpc/);
    assert.match(source, /data: result\.data/);
    assert.equal(
      (source.match(new RegExp(`${repositoryFunction}\\(`, "g")) ?? []).length,
      1,
      `${name} must invoke its mutation repository exactly once`
    );
    assert.doesNotMatch(source, /occurredAt/);
  }

  assert.doesNotMatch(exportRouteSource, /supplier-batches\/_dto|toSupplierBatch.*Dto/);
});

test("transport migrations preserve P1 ordering and relation-qualified trigger guards", () => {
  const targetMigrationNames = readdirSync(path.join(repoRoot, "supabase/migrations"))
    .filter((name) => /^(20260825202034|20260825202035)_.*\.sql$/.test(name))
    .sort();

  assert.deepEqual(targetMigrationNames, [
    "20260825202034_revoke_supplier_batch_truncate_privileges.sql",
    "20260825202035_supplier_batch_transport_costs.sql",
  ]);
  assert.equal(
    existsSync(
      path.join(
        repoRoot,
        "supabase/migrations/20260827071053_revoke_supplier_batch_truncate_privileges.sql"
      )
    ),
    false
  );
  assert.match(
    permissionMigrationSource,
    /revoke truncate on table public\.supplier_batches from anon, authenticated;/
  );
  assert.match(
    permissionMigrationSource,
    /revoke truncate on table public\.finance_cost_layers from authenticated;/
  );
  assert.match(
    transportMigrationSource,
    /where tgrelid = 'public\.finance_cost_layers'::regclass\s+and tgname = 'finance_cost_layers_supplier_batch_compat'/
  );
  assert.match(
    transportMigrationSource,
    /where tgrelid = 'public\.supplier_batch_charges'::regclass\s+and tgname = 'supplier_batch_charges_set_updated_at'/
  );
  assert.match(
    transportMigrationSource,
    /where tgrelid = 'public\.supplier_batch_charge_allocations'::regclass\s+and tgname = 'supplier_batch_charge_allocations_set_updated_at'/
  );
});

test("export keeps unrecorded amounts blank, confirmed zero as zero, and avoids detail N+1", () => {
  assert.match(filesSource, /"batches" \| "lines" \| "charges"/);
  assert.match(filesSource, /costStatus !== "unrecorded"/);
  assert.match(filesSource, /centsToExportValue/);
  assert.match(filesSource, /detail\.charges\.map/);
  assert.match(filesSource, /weightGram/);
  assert.match(filesSource, /cost_status/);
  assert.match(exportRouteSource, /getAdminSupplierBatchExportData/);
  assert.doesNotMatch(exportRouteSource, /Promise\.all\(\s*batches\.map/);
});

test("client-safe schema rejects unsafe enums, non-EUR, missing IDs and bad manual rows", () => {
  const base = {
    allocationMethod: "goods_value",
    amountNet: 10,
    capitalizedAmount: 10,
    chargeType: "transport",
    currency: "EUR",
    vatAmount: 0,
    vatTreatment: "recoverable",
    zeroCostReason: null,
  };
  assert.equal(supplierBatchChargePreviewSchema.safeParse({ ...base, currency: "USD" }).success, false);
  assert.equal(supplierBatchChargePreviewSchema.safeParse({ ...base, chargeType: "freight" }).success, false);
  assert.equal(supplierBatchChargeEstimateSchema.safeParse(base).success, false);
  assert.equal(
    supplierBatchChargePreviewSchema.safeParse({ ...base, allocationMethod: "manual" }).success,
    false
  );
  assert.equal(
    supplierBatchChargePreviewSchema.safeParse({
      ...base,
      allocationMethod: "manual",
      chargeId: "88888888-8888-4888-8888-888888888888",
      manualAllocations: [
        { batchLineId: "99999999-9999-4999-8999-999999999999", amount: 10 },
      ],
    }).success,
    true
  );
  assert.equal(
    supplierBatchChargePreviewSchema.safeParse({ ...base, manualAllocations: [] }).success,
    false
  );
  assert.equal(
    supplierBatchChargeConfirmSchema.safeParse({
      ...base,
      idempotencyKey: "confirm-123",
      revision: "rev-1",
      vatTreatment: "unknown",
    }).success,
    false
  );
});

test("all charge schemas enforce the shared HTTP(S) evidence URL contract", () => {
  const base = {
    allocationMethod: "goods_value",
    amountNet: 10,
    capitalizedAmount: 10,
    chargeType: "transport",
    currency: "EUR",
    vatAmount: 0,
    vatTreatment: "recoverable",
    zeroCostReason: null,
  };
  const schemas = [
    ["preview", supplierBatchChargePreviewSchema, base],
    ["estimate", supplierBatchChargeEstimateSchema, { ...base, idempotencyKey: "idempotency-1" }],
    [
      "confirm",
      supplierBatchChargeConfirmSchema,
      { ...base, idempotencyKey: "idempotency-1", revision: "revision-1" },
    ],
  ];
  const validUrls = ["http://example.com/receipt.pdf", "https://example.com/receipt.pdf"];
  const invalidUrls = ["javascript:alert(1)", "ftp://example.com/receipt.pdf", "data:text/plain,receipt"];

  for (const [name, schema, payload] of schemas) {
    assert.equal(schema.safeParse(payload).success, true, `${name} should allow an omitted URL`);
    assert.equal(schema.safeParse({ ...payload, evidenceUrl: null }).success, true, `${name} should allow null URL`);
    for (const evidenceUrl of validUrls) {
      assert.equal(schema.safeParse({ ...payload, evidenceUrl }).success, true, `${name} should allow ${evidenceUrl}`);
    }
    for (const evidenceUrl of invalidUrls) {
      const parsed = schema.safeParse({ ...payload, evidenceUrl });
      assert.equal(parsed.success, false, `${name} should reject ${evidenceUrl}`);
      assert.ok(
        parsed.error.issues.some((issue) => issue.message === "EVIDENCE_URL_HTTP_REQUIRED"),
        `${name} should expose the stable evidence URL issue code`
      );
    }
  }
});

test("core is fail-closed for malformed charges, contradictory summaries and signed rounding", () => {
  assert.equal(
    normalizeSupplierBatchCostSummary({
      batchId: "11111111-1111-4111-8111-111111111111",
      batchCode: "BATCH-1",
      currency: "EUR",
      goodsValue: 100,
      estimatedCount: 0,
      confirmedCount: 1,
      cancelledCount: 1,
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
    }),
    null
  );
  assert.equal(
    normalizeSupplierBatchChargeAllocation({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      batch_id: "44444444-4444-4444-8444-444444444444",
      charge_id: "55555555-5555-4555-8555-555555555555",
      batch_line_id: "33333333-3333-4333-8333-333333333333",
      qty_received_snapshot: 1,
      goods_cost_snapshot: 1,
      weight_gram_snapshot: 0,
      basis_value: 1,
      share_ratio: 1,
      allocated_amount: 1,
      allocated_unit_amount: 1,
      rounding_adjustment: -0.01,
      metadata: {},
    })?.roundingAdjustmentCents,
    -1
  );
  const charge = {
    chargeId: "55555555-5555-4555-8555-555555555555",
    batchId: "44444444-4444-4444-8444-444444444444",
    batchCode: "BATCH-1",
    status: "confirmed",
    chargeType: "transport",
    amountNet: 1,
    vatAmount: 0,
    amountGross: 1,
    capitalizedAmount: 1,
    currency: "EUR",
    vatTreatment: "recoverable",
    allocationMethod: "goods_value",
    manualAllocationsSnapshot: [],
    idempotencyKey: "confirm-1",
    payloadFingerprint: "fp-1",
    confirmedBy: "99999999-9999-4999-8999-999999999999",
    confirmedAt: "2026-08-25T12:00:00.000Z",
    metadata: {},
  };
  assert.ok(normalizeSupplierBatchCharge(charge));
  assert.equal(normalizeSupplierBatchCharge({ ...charge, chargeId: undefined }), null);
  assert.equal(normalizeSupplierBatchCharge({ ...charge, chargeType: "freight" }), null);
  assert.equal(normalizeSupplierBatchCharge({ ...charge, currency: "USD" }), null);

  assert.equal(
    normalizeSupplierBatchCharge({ ...charge, idempotencyKey: "" }),
    null
  );
  assert.equal(
    normalizeSupplierBatchCharge({ ...charge, payloadFingerprint: 123 }),
    null
  );
  assert.equal(
    normalizeSupplierBatchCharge({ ...charge, confirmedBy: "not-a-uuid" }),
    null
  );

  const persistedAllocation = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    batch_id: "44444444-4444-4444-8444-444444444444",
    charge_id: "55555555-5555-4555-8555-555555555555",
    batch_line_id: "33333333-3333-4333-8333-333333333333",
    qty_received_snapshot: 1,
    goods_cost_snapshot: 1,
    weight_gram_snapshot: 0,
    basis_value: 1,
    share_ratio: 1,
    allocated_amount: 1,
    allocated_unit_amount: 1,
    rounding_adjustment: -0.01,
    metadata: {},
  };
  assert.ok(normalizeSupplierBatchChargeAllocation(persistedAllocation));
  assert.equal(
    normalizeSupplierBatchChargeAllocation({
      ...persistedAllocation,
      allocated_unit_amount: "not-a-number",
    }),
    null
  );
  assert.equal(
    normalizeSupplierBatchChargeAllocation({ ...persistedAllocation, basis_value: -1 }),
    null
  );
  assert.equal(
    normalizeSupplierBatchChargeAllocation({ ...persistedAllocation, share_ratio: 1.1 }),
    null
  );
  assert.equal(
    normalizeSupplierBatchChargeAllocation({ ...persistedAllocation, rounding_adjustment: 0.02 }),
    null
  );
  assert.equal(
    normalizeSupplierBatchChargeAllocation({ ...persistedAllocation, metadata: [] }),
    null
  );
});

test("summary invariants reject contradictory landed totals and nonzero zero-count buckets", () => {
  const base = {
    batchId: rpcBatchId,
    batchCode: "BATCH-SUMMARY",
    currency: "EUR",
    goodsValue: 100,
    estimatedCount: 0,
    confirmedCount: 1,
    cancelledCount: 0,
    estimatedNet: 0,
    estimatedVat: 0,
    estimatedGross: 0,
    estimatedCapitalized: 0,
    confirmedNet: 1,
    confirmedVat: 0,
    confirmedGross: 1,
    confirmedCapitalized: 1,
    confirmedLandedTotal: 101,
    projectedLandedTotal: 101,
    confirmationBlocked: false,
    reviewCodes: [],
    costStatus: "confirmed",
  };
  assert.ok(normalizeSupplierBatchCostSummary(base));
  assert.equal(
    normalizeSupplierBatchCostSummary({ ...base, confirmedLandedTotal: 100 }),
    null
  );
  assert.equal(
    normalizeSupplierBatchCostSummary({
      ...base,
      estimatedCount: 0,
      estimatedNet: 1,
      estimatedGross: 1,
      estimatedCapitalized: 1,
      projectedLandedTotal: 102,
    }),
    null
  );
  assert.ok(
    normalizeSupplierBatchCostSummary({
      ...base,
      confirmedCount: 0,
      confirmedNet: 0,
      confirmedGross: 0,
      confirmedCapitalized: 0,
      confirmedLandedTotal: 100,
      projectedLandedTotal: 100,
      costStatus: "unrecorded",
      cancelledCount: 1,
    })
  );
});

test("export row helper applies the 5000 limit to final scope rows", () => {
  const batches = [{ id: "batch-1" }, { id: "batch-2" }];
  const details = [
    { lines: [{ id: 1 }, { id: 2 }], charges: [{ id: 1 }] },
    { lines: [{ id: 3 }], charges: [{ id: 2 }, { id: 3 }] },
  ];
  assert.equal(supplierBatchExportRowCount("batches", batches, []), 2);
  assert.equal(supplierBatchExportRowCount("lines", batches, details), 3);
  assert.equal(supplierBatchExportRowCount("charges", batches, details), 3);
  assert.equal(supplierBatchExportRowCount("lines", batches, [{ lines: null }]), null);
  assert.equal(
    supplierBatchExportRowCount(
      "lines",
      batches,
      [{ lines: Array.from({ length: 5001 }, (_, index) => ({ id: index })) }]
    ),
    5001
  );
  assert.equal(
    supplierBatchExportRowCount(
      "charges",
      batches,
      [{ charges: Array.from({ length: 5001 }, (_, index) => ({ id: index })) }]
    ),
    5001
  );
});

test("goods cost follows rounded qty times unit cost, independent of line_total", () => {
  const costs = summarizeSupplierBatchLineCosts(
    [{
      id: "33333333-3333-4333-8333-333333333333",
      qty_received: 3,
      unit_cost: 0.333,
      line_total: 99,
    }],
    []
  );
  assert.equal(costs?.[0]?.goodsCostCents, 100);
  assert.equal(costs?.[0]?.landedLineCostCents, 100);
});
