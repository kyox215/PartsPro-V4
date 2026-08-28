import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  normalizeSupplierBatchCharge,
  normalizeSupplierBatchCostRpcResult,
  normalizeSupplierBatchCostSummary,
  normalizeSupplierBatchLineProjection,
  normalizeSupplierBatchRpcAllocation,
} from "../src/lib/partspro-supplier-batch-cost-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromRepo = createRequire(path.join(repoRoot, "package.json"));
const {
  ModuleKind,
  ScriptTarget,
  transpileModule,
} = requireFromRepo("typescript");

const dto = loadDtoModule();
const ids = {
  allocation: "66666666-6666-4666-8666-666666666666",
  batch: "11111111-1111-4111-8111-111111111111",
  charge: "55555555-5555-4555-8555-555555555555",
  confirmedBy: "77777777-7777-4777-8777-777777777777",
  line: "22222222-2222-4222-8222-222222222222",
};

const batchCode = "BATCH-DTO";

test("summary, charge, allocation and projection DTOs round-trip integer cents", () => {
  const summary = makeSummary();
  const charge = makeCharge("estimated");
  const rpcResult = makeRpcResult("preview");
  const context = makeRpcContext();
  const summaryDto = dto.toSupplierBatchCostSummaryDto(summary);
  const chargeDto = dto.toSupplierBatchChargeDto(charge);
  const rpcDto = dto.toSupplierBatchCostRpcResultDto(rpcResult, context);
  const allocationDto = rpcDto.candidateAllocations[0];
  const projectionDto = rpcDto.lineProjections[0];

  assert.equal(summaryDto.goodsValue, 100);
  assert.equal(normalizeSupplierBatchCostSummary(summaryDto)?.goodsValueCents, 10000);
  assert.deepEqual(
    JSON.parse(JSON.stringify(normalizeSupplierBatchCharge(chargeDto))),
    JSON.parse(JSON.stringify(charge))
  );
  assert.equal(normalizeSupplierBatchRpcAllocation(allocationDto)?.allocatedAmountCents, 10000);
  assert.equal(
    normalizeSupplierBatchRpcAllocation(rpcDto.allocations[0])?.allocatedAmountCents,
    10000
  );
  assert.equal(normalizeSupplierBatchLineProjection(projectionDto)?.goodsCostCents, 10000);
  assertNoCentsKeys({ summaryDto, chargeDto, rpcDto });
});

test("list and detail serializers preserve summaries, charges, allocations and internal line costs", () => {
  const summary = makeSummary();
  const charge = makeCharge("estimated");
  const allocation = makeAllocation({ persisted: true });
  const lineCosts = {
    batchLineId: ids.line,
    goodsCostCents: 10000,
    confirmedInboundCents: 10000,
    landedLineCostCents: 20000,
    goodsUnitCost: 50,
    landedUnitCost: 100,
  };
  const batch = makeBatch(summary);
  const line = makeLine(lineCosts);
  const rowDto = dto.toSupplierBatchRowDto(batch);
  const detailDto = dto.toSupplierBatchDetailDto({
    batch,
    lines: [line],
    charges: [charge],
    verification: batch.verification,
    allocations: [allocation],
  });

  assert.equal(rowDto.costSummary?.goodsValue, 100);
  assert.equal(detailDto.batch.costSummary?.goodsValue, 100);
  assert.deepEqual(detailDto.charges[0], dto.toSupplierBatchChargeDto(charge));
  assert.deepEqual(JSON.parse(JSON.stringify(detailDto.allocations?.[0])), {
    allocationId: ids.allocation,
    batchId: ids.batch,
    chargeId: ids.charge,
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: "SKU-1",
    qtyReceivedSnapshot: 2,
    goodsCostSnapshot: 100,
    weightGramSnapshot: 100,
    metadata: {},
    allocatedAmount: 100,
    allocatedUnitAmount: 50,
    basisValue: 100,
    shareRatio: 1,
    landedLineCost: 200,
    landedUnitCost: 100,
    roundingAdjustment: 0,
    createdAt: null,
    updatedAt: null,
  });
  assert.deepEqual(detailDto.lines[0].costs, lineCosts);
  assert.equal(detailDto.lines[0].costs?.goodsCostCents, 10000);
  assertNoCentsKeys(rowDto);
  assertNoCentsKeys(detailDto, "", new Set(["costs"]));
});

test("preview RPC DTO remains compatible with the client normalizer", () => {
  const wire = JSON.parse(
    JSON.stringify(
      dto.toSupplierBatchCostRpcResultDto(makeRpcResult("preview"), makeRpcContext())
    )
  );
  const normalized = normalizeSupplierBatchCostRpcResult(wire);
  assert.ok(normalized);
  assert.equal(normalized?.status, "preview");
  assert.equal(normalized?.amountNetCents, 10000);
  assert.equal(normalized?.lineProjections[0]?.goodsCostCents, 10000);
  assert.equal(normalized?.allocations[0]?.allocatedAmountCents, 10000);
  assert.equal(Object.hasOwn(wire, "metadata"), false);
  assertNoCentsKeys(wire);
  assert.throws(
    () => dto.toSupplierBatchCostRpcResultDto(makeRpcResult("estimated"), makeRpcContext()),
    /only supports preview/
  );
});

test("RPC DTO requires verified request context and fails closed without it", () => {
  assert.throws(
    () => dto.toSupplierBatchCostRpcResultDto(makeRpcResult("preview")),
    /request context is required/
  );
  assert.throws(
    () =>
      dto.toSupplierBatchCostRpcResultDto(makeRpcResult("preview"), {
        currency: "EUR",
        vatTreatment: "recoverable",
        allocationMethod: "goods_value",
      }),
    /missing validated charge fields/
  );
  assert.throws(
    () =>
      dto.toSupplierBatchCostRpcResultDto(makeRpcResult("preview"), {
        ...makeRpcContext(),
        batchCode: "OTHER-BATCH",
      }),
    /request context identity does not match result/
  );
});

test("DTOs do not leak mixed internal money keys while line costs remain the explicit exception", () => {
  const result = makeRpcResult("preview");
  result.candidateAllocations[0].goodsCostSnapshot = 999;
  result.candidateAllocations[0].landedLineCost = 999;
  result.candidateAllocations[0].allocatedAmount = 999;

  const wire = dto.toSupplierBatchCostRpcResultDto(result, makeRpcContext());
  const allocation = wire.candidateAllocations[0];

  assert.equal(allocation.goodsCostSnapshot, 100);
  assert.equal(allocation.landedLineCost, 200);
  assert.equal(allocation.allocatedAmount, 100);
  assert.equal(Object.hasOwn(allocation, "goodsCostSnapshotCents"), false);
  assert.equal(Object.hasOwn(allocation, "landedLineCostCents"), false);
  assert.equal(Object.hasOwn(allocation, "allocatedAmountCents"), false);
  assertNoCentsKeys(wire);
});

test("charge DTO strips correction state and relationship metadata", () => {
  const charge = makeCharge("confirmed");
  charge.metadata = {
    source: "test",
    correctionStatus: "applied",
    correctionFingerprint: "secret-correction-fingerprint",
    originalChargeId: ids.charge,
    replacementChargeId: ids.charge,
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(dto.toSupplierBatchChargeDto(charge).metadata)),
    { source: "test" }
  );
});

function loadDtoModule() {
  const source = readFileSync(
    path.join(repoRoot, "src/app/api/admin/supplier-batches/_dto.ts"),
    "utf8"
  );
  const output = transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
    fileName: "supplier-batches/_dto.ts",
  }).outputText;
  const dtoModule = { exports: {} };
  const context = vm.createContext({
    exports: dtoModule.exports,
    module: dtoModule,
    require(specifier) {
      if (specifier === "@/lib/partspro-api") {
        return {
          centsToNumber(cents) {
            return Number((cents / 100).toFixed(2));
          },
        };
      }

      throw new Error(`Unexpected DTO dependency: ${specifier}`);
    },
  });

  new vm.Script(output, { filename: "src/app/api/admin/supplier-batches/_dto.ts" }).runInContext(
    context
  );
  return dtoModule.exports;
}

function makeSummary() {
  return {
    batchId: ids.batch,
    batchCode,
    currency: "EUR",
    goodsValueCents: 10000,
    estimatedCount: 1,
    confirmedCount: 1,
    cancelledCount: 0,
    estimatedNetCents: 10000,
    estimatedVatCents: 0,
    estimatedGrossCents: 10000,
    estimatedCapitalizedCents: 10000,
    confirmedNetCents: 10000,
    confirmedVatCents: 0,
    confirmedGrossCents: 10000,
    confirmedCapitalizedCents: 10000,
    confirmedLandedTotalCents: 20000,
    projectedLandedTotalCents: 30000,
    confirmationBlocked: false,
    reviewCodes: [],
    costStatus: "estimated",
  };
}

function makeCharge(status) {
  const confirmed = status === "confirmed";
  return {
    chargeId: ids.charge,
    batchId: ids.batch,
    batchCode,
    status,
    chargeType: "transport",
    amountNetCents: 10000,
    vatAmountCents: 0,
    amountGrossCents: 10000,
    capitalizedAmountCents: 10000,
    currency: "EUR",
    vatTreatment: "recoverable",
    allocationMethod: "goods_value",
    carrierName: "Carrier",
    reference: "REF-1",
    occurredAt: "2026-08-27T12:00:00.000Z",
    evidenceUrl: null,
    notes: null,
    zeroCostReason: null,
    idempotencyKey: "idempotency-1",
    payloadFingerprint: "fingerprint-1",
    manualAllocationsSnapshot: [],
    metadata: { source: "test" },
    createdBy: null,
    updatedBy: null,
    confirmedBy: confirmed ? ids.confirmedBy : null,
    confirmedAt: confirmed ? "2026-08-27T12:00:00.000Z" : null,
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:00:00.000Z",
  };
}

function makeAllocation({ persisted = false } = {}) {
  return {
    allocationId: persisted ? ids.allocation : null,
    batchId: persisted ? ids.batch : null,
    chargeId: persisted ? ids.charge : null,
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: "SKU-1",
    qtyReceivedSnapshot: 2,
    goodsCostSnapshotCents: 10000,
    goodsCostSnapshot: 100,
    weightGramSnapshot: 100,
    metadata: {},
    allocatedAmountCents: 10000,
    allocatedUnitAmount: 50,
    basisValue: 100,
    shareRatio: 1,
    landedLineCostCents: 20000,
    landedLineCost: 200,
    landedUnitCost: 100,
    roundingAdjustmentCents: 0,
    createdAt: null,
    updatedAt: null,
  };
}

function makeProjection() {
  return {
    batchLineId: ids.line,
    lineNo: 1,
    skuCode: "SKU-1",
    qtyReceived: 2,
    weightGram: 100,
    goodsCostCents: 10000,
    goodsUnitCost: 50,
    currentAllocationCents: 0,
    candidateAllocationCents: 10000,
    existingInboundCents: 0,
    inboundAfterCandidateCents: 10000,
    currentLandedLineCostCents: 10000,
    projectedLandedLineCostCents: 20000,
    currentLandedUnitCost: 50,
    projectedLandedUnitCost: 100,
  };
}

function makeRpcResult(status) {
  const preview = status === "preview";
  const confirmed = status === "confirmed";
  const allocation = makeAllocation({ persisted: !preview });
  const charge = preview ? null : makeCharge(status);
  const result = {
    status,
    charge,
    batchId: ids.batch,
    batchCode,
    revision: "revision-1",
    currency: "EUR",
    amountNetCents: 10000,
    vatAmountCents: 0,
    amountGrossCents: 10000,
    capitalizedAmountCents: 10000,
    candidateAllocationTotalCents: confirmed ? 0 : 10000,
    candidateAllocations: confirmed ? [] : [allocation],
    confirmedAllocationTotalCents: confirmed ? 10000 : 0,
    confirmedAllocations: confirmed ? [allocation] : [],
    allocationTotalCents: 10000,
    allocations: [allocation],
    lineProjections: [makeProjection()],
    confirmationBlocked: preview ? false : null,
    confirmationBlockCode: null,
    confirmationBlockReason: null,
    manualAllocationsSnapshot: [],
    payloadFingerprint: "fingerprint-1",
    ...(preview
      ? {
          chargeType: "transport",
          vatTreatment: "recoverable",
          allocationMethod: "goods_value",
          carrierName: "Carrier",
          reference: "REF-1",
          occurredAt: "2026-08-27T12:00:00.000Z",
          evidenceUrl: null,
          notes: null,
          zeroCostReason: null,
        }
      : { metadata: { source: "test" } }),
  };

  return result;
}

function makeRpcContext() {
  return {
    batchCode,
    chargeType: "transport",
    vatTreatment: "recoverable",
    allocationMethod: "goods_value",
    currency: "EUR",
    carrierName: "Carrier",
    reference: "REF-1",
    occurredAt: "2026-08-27T12:00:00.000Z",
    evidenceUrl: null,
    notes: null,
    zeroCostReason: null,
  };
}

function makeBatch(costSummary) {
  return {
    id: ids.batch,
    batchCode,
    supplierId: "33333333-3333-4333-8333-333333333333",
    supplierCode: "SUP-1",
    supplierName: "Supplier",
    invoiceNo: "INV-1",
    orderNo: "ORD-1",
    invoiceDate: "2026-08-27",
    receivedAt: "2026-08-27T12:00:00.000Z",
    totalQty: 2,
    totalCost: 100,
    currency: "EUR",
    vatMode: "IVA esclusa",
    tags: ["transport"],
    sourceFileName: "invoice.pdf",
    metadata: { source: "test" },
    orderedQty: 2,
    shortQty: 0,
    lineQtyTotal: 2,
    lineCostTotal: 100,
    lineCount: 1,
    activeProductCount: 1,
    draftProductCount: 0,
    missingImageCount: 0,
    productMissingCount: 0,
    activeMissingImageCount: 0,
    priceViolationCount: 0,
    modelPrefixIssueCount: 0,
    verification: {
      status: "ok",
      issues: [],
      quantityMatches: true,
      costMatches: true,
    },
    costSummary,
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:00:00.000Z",
  };
}

function makeLine(costs) {
  return {
    id: ids.line,
    lineNo: 1,
    ean: "1234567890123",
    supplierSku: "SUP-SKU-1",
    skuCode: "SKU-1",
    name: "Display",
    qtyReceived: 2,
    qtyOrdered: 2,
    qtyShort: 0,
    unitCost: 50,
    lineTotal: 100,
    imageStatus: "ready",
    productStatus: "active",
    metadata: { source: "test" },
    product: null,
    costs,
    createdAt: "2026-08-27T12:00:00.000Z",
    updatedAt: "2026-08-27T12:00:00.000Z",
  };
}

function assertNoCentsKeys(value, currentPath = "", allowedKeys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoCentsKeys(item, `${currentPath}[${index}]`, allowedKeys)
    );
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith("Cents") || key.endsWith("Bps")) {
      assert.ok(
        allowedKeys.has(key) || currentPath.endsWith(".costs"),
        `wire DTO leaked ${currentPath}.${key}`
      );
    }
    assertNoCentsKeys(child, `${currentPath}.${key}`, allowedKeys);
  }
}
