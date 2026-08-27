import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { normalizeSupplierBatchCostSummary } from "../src/lib/partspro-supplier-batch-cost-core.mjs";
import {
  supplierBatchChargeConfirmSchema,
  supplierBatchChargeEstimateSchema,
  supplierBatchChargePreviewSchema,
} from "../src/lib/partspro-supplier-batch-cost-input-schema.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cardSource = readFileSync(
  path.join(repoRoot, "src/components/partspro/supplier-batch-transport-cost-card.tsx"),
  "utf8"
);
const panelSource = readFileSync(
  path.join(repoRoot, "src/components/partspro/admin-products-panel.tsx"),
  "utf8"
);
const dialogSource = readFileSync(
  path.join(repoRoot, "src/components/partspro/supplier-batch-transport-cost-dialog.tsx"),
  "utf8"
);
const displaySummary = loadSourceFunction(
  cardSource,
  ["getSupplierBatchCostSummaryDisplay"],
  "getSupplierBatchCostSummaryDisplay"
);
const resolvePermissions = loadSourceFunction(
  panelSource,
  ["resolveSupplierBatchCostPermissions"],
  "resolveSupplierBatchCostPermissions"
);
const summaryBelongsToBatch = loadSourceFunction(
  panelSource,
  ["isSupplierBatchCostSummaryForBatch"],
  "isSupplierBatchCostSummaryForBatch"
);
const chargeBelongsToBatch = loadSourceFunction(
  panelSource,
  ["isSupplierBatchChargeForBatch"],
  "isSupplierBatchChargeForBatch"
);
const normalizeLineCost = loadSourceFunction(
  panelSource,
  [
    "normalizeSupplierBatchLineCost",
    "roundSupplierBatchGoodsCostToCents",
    "roundSupplierBatchUnitCost",
    "readNonNegativeInteger",
    "readNonNegativeFinite",
    "readString",
    "isRecord",
  ],
  "normalizeSupplierBatchLineCost"
);
const parseMoney = loadSourceFunction(
  dialogSource,
  ["parseSupplierBatchMoneyInput"],
  "parseSupplierBatchMoneyInput"
);
const dateTimeToIso = loadSourceFunction(
  dialogSource,
  ["supplierBatchDateTimeLocalToIso"],
  "supplierBatchDateTimeLocalToIso"
);
const evidenceUrlAllowed = loadSourceFunction(
  dialogSource,
  ["isSupplierBatchEvidenceUrl"],
  "isSupplierBatchEvidenceUrl"
);
const formatUnitCost = loadSourceFunction(
  cardSource,
  ["formatSupplierBatchUnitCost"],
  "formatSupplierBatchUnitCost"
);
const formatLineLabel = loadSourceFunction(
  dialogSource,
  ["formatSupplierBatchCostLineLabel"],
  "formatSupplierBatchCostLineLabel"
);
const isChargeFormEditable = loadSourceFunction(
  dialogSource,
  ["isSupplierBatchChargeFormEditable"],
  "isSupplierBatchChargeFormEditable"
);
const canConfirmCharge = loadSourceFunction(
  dialogSource,
  ["canConfirmSupplierBatchCharge"],
  "canConfirmSupplierBatchCharge"
);
const previewIsCurrent = loadSourceFunction(
  dialogSource,
  ["isSupplierBatchPreviewCurrent"],
  "isSupplierBatchPreviewCurrent"
);
const mutationResultBelongsToCurrent = loadSourceFunction(
  dialogSource,
  ["isSupplierBatchMutationResultForCurrent"],
  "isSupplierBatchMutationResultForCurrent"
);
const classifyMutationReadback = loadSourceFunction(
  dialogSource,
  ["classifySupplierBatchMutationReadback"],
  "classifySupplierBatchMutationReadback"
);
const isTrustedMutationErrorCode = loadSourceFunction(
  dialogSource,
  ["isSupplierBatchMutationErrorCodeTrusted"],
  "isSupplierBatchMutationErrorCodeTrusted"
);
const classifyMutationError = loadSourceFunction(
  dialogSource,
  ["isSupplierBatchMutationErrorCodeTrusted", "classifySupplierBatchMutationError"],
  "classifySupplierBatchMutationError"
);
const invalidatePreviewForMutationError = loadSourceFunction(
  dialogSource,
  ["shouldInvalidateSupplierBatchPreviewForMutationError"],
  "shouldInvalidateSupplierBatchPreviewForMutationError"
);
const fieldAriaDescribedBy = loadSourceFunction(
  dialogSource,
  ["buildSupplierBatchFieldAriaDescribedBy"],
  "buildSupplierBatchFieldAriaDescribedBy"
);
const manualLines = loadSourceFunction(
  dialogSource,
  ["getSupplierBatchManualLines"],
  "getSupplierBatchManualLines"
);
const manualSummary = loadSourceFunction(
  dialogSource,
  ["parseSupplierBatchMoneyInput", "getSupplierBatchManualLines", "summarizeSupplierBatchManualAllocations"],
  "summarizeSupplierBatchManualAllocations"
);
const formFingerprint = loadSourceFunction(
  dialogSource,
  ["supplierBatchChargeFormFingerprint"],
  "supplierBatchChargeFormFingerprint"
);
const buildPayload = loadSourceFunction(
  dialogSource,
  [
    "parseSupplierBatchMoneyInput",
    "supplierBatchDateTimeLocalToIso",
    "isSupplierBatchEvidenceUrl",
    "getSupplierBatchManualLines",
    "summarizeSupplierBatchManualAllocations",
    "buildSupplierBatchChargePayload",
  ],
  "buildSupplierBatchChargePayload",
  "const MAX_MANUAL_ROWS = 500;"
);
const mapCostError = loadSourceFunction(
  dialogSource,
  ["mapSupplierBatchCostErrorCode"],
  "mapSupplierBatchCostErrorCode"
);
const mapSchemaIssues = loadSourceFunction(
  dialogSource,
  ["mapSupplierBatchSchemaIssues"],
  "mapSupplierBatchSchemaIssues"
);

test("display helper keeps unavailable and unrecorded transport values blank", () => {
  const unavailable = displaySummary(null);
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.confirmedTransportCents, null);
  assert.equal(unavailable.estimatedTransportCents, null);
  assert.equal(unavailable.confirmedLandedCents, null);
  assert.equal(unavailable.projectedLandedCents, null);

  const unrecorded = displaySummary(summaryFixture("unrecorded"));
  assert.equal(unrecorded.status, "unrecorded");
  assert.equal(unrecorded.confirmedTransportCents, null);
  assert.equal(unrecorded.estimatedTransportCents, null);
  assert.equal(unrecorded.confirmedLandedCents, null);
  assert.equal(unrecorded.projectedLandedCents, null);
});

test("display helper preserves confirmed zero as zero and goods-value landing", () => {
  const display = displaySummary(summaryFixture("confirmed_zero"));

  assert.equal(display.status, "confirmed_zero");
  assert.equal(display.confirmedTransportCents, 0);
  assert.equal(display.confirmedLandedCents, 10000);
  assert.equal(display.projectedLandedCents, 10000);
  assert.equal(display.hasConfirmed, true);
});

test("display helper labels estimated projected landing separately from confirmed facts", () => {
  const estimated = displaySummary(summaryFixture("estimated"));

  assert.equal(estimated.status, "estimated");
  assert.equal(estimated.confirmedTransportCents, null);
  assert.equal(estimated.confirmedLandedCents, null);
  assert.equal(estimated.estimatedTransportCents, 500);
  assert.equal(estimated.projectedLandedCents, 10500);
  assert.equal(estimated.hasEstimate, true);

  const mixed = displaySummary(summaryFixture("estimated", {
    confirmedCount: 1,
    confirmedNet: 4,
    confirmedGross: 4,
    confirmedCapitalized: 4,
    confirmedLandedTotal: 104,
    projectedLandedTotal: 109,
  }));

  assert.equal(mixed.confirmedTransportCents, 400);
  assert.equal(mixed.confirmedLandedCents, 10400);
  assert.equal(mixed.estimatedTransportCents, 500);
  assert.equal(mixed.projectedLandedCents, 10900);
});

test("ownership and permission helpers reject cross-batch data and manage-only access", () => {
  const batchId = "11111111-1111-4111-8111-111111111111";
  const batchCode = "BATCH-UI";
  const summary = { batchId, batchCode };
  const charge = { batchId, batchCode };

  assert.equal(summaryBelongsToBatch(summary, batchId, batchCode), true);
  assert.equal(summaryBelongsToBatch({ ...summary, batchCode: "OTHER" }, batchId, batchCode), false);
  assert.equal(summaryBelongsToBatch({ ...summary, batchId: "22222222-2222-4222-8222-222222222222" }, batchId, batchCode), false);
  assert.equal(chargeBelongsToBatch(charge, batchId, batchCode), true);
  assert.equal(chargeBelongsToBatch({ ...charge, batchCode: "OTHER" }, batchId, batchCode), false);
  assert.equal(chargeBelongsToBatch({ ...charge, batchId: "22222222-2222-4222-8222-222222222222" }, batchId, batchCode), false);

  assertPermissionState([], true, false, false);
  assertPermissionState(["supplier_batch.manage_costs"], true, false, false);
  assertPermissionState(["products.read_admin"], true, true, false);
  assertPermissionState(["products.read_admin", "supplier_batch.manage_costs"], true, true, true);
  assertPermissionState(["products.read_admin", "supplier_batch.manage_costs"], false, false, false);
});

test("line cost parser enforces the current quantity and landed arithmetic", () => {
  const valid = {
    batchLineId: "line-a",
    goodsCostCents: 300,
    confirmedInboundCents: 25,
    landedLineCostCents: 325,
    goodsUnitCost: 1.5,
    landedUnitCost: 1.625,
  };

  assert.ok(normalizeLineCost(valid, "line-a", 2));
  assert.ok(normalizeLineCost({
    ...valid,
    goodsCostCents: 450,
    confirmedInboundCents: 1,
    landedLineCostCents: 451,
    landedUnitCost: 1.5033,
  }, "line-a", 3));
  assert.equal(normalizeLineCost(valid, "line-other", 2), null);
  assert.equal(normalizeLineCost({ ...valid, goodsCostCents: 301, landedLineCostCents: 326 }, "line-a", 2), null);
  assert.equal(normalizeLineCost({ ...valid, landedLineCostCents: 324 }, "line-a", 2), null);
  assert.equal(normalizeLineCost({ ...valid, landedUnitCost: null }, "line-a", 2), null);
  assert.ok(normalizeLineCost({
    ...valid,
    goodsCostCents: 0,
    confirmedInboundCents: 0,
    landedLineCostCents: 0,
    goodsUnitCost: 0,
    landedUnitCost: null,
  }, "line-a", 0));
  assert.equal(normalizeLineCost({ ...valid, landedUnitCost: 0 }, "line-a", 0), null);
});

test("form helpers keep blank money distinct from zero and enforce decimal input", () => {
  assert.equal(parseMoney("").cents, null);
  assert.equal(parseMoney("").error, "required");
  assert.equal(parseMoney("").value, null);
  assert.equal(parseMoney("0").cents, 0);
  assert.equal(parseMoney("0").error, null);
  assert.equal(parseMoney("0").value, 0);
  assert.equal(parseMoney("1.25").cents, 125);
  assert.equal(parseMoney("1,25").cents, 125);
  assert.equal(parseMoney(".5").cents, 50);
  assert.equal(parseMoney("1.001").error, "format");
  assert.equal(parseMoney("-1").error, "format");
  assert.equal(dateTimeToIso("").value, null);
  assert.equal(dateTimeToIso("not-a-date").error, "invalid");
  assert.match(dateTimeToIso("2026-08-25T12:00").value, /^\d{4}-\d{2}-\d{2}T/);
});

test("evidence URL protocol and derived unit formatting are fail-closed and precise", () => {
  assert.equal(evidenceUrlAllowed(""), true);
  assert.equal(evidenceUrlAllowed("https://example.com/receipt.pdf"), true);
  assert.equal(evidenceUrlAllowed("HTTP://example.com"), true);
  assert.equal(evidenceUrlAllowed("javascript:alert(1)"), false);
  assert.equal(evidenceUrlAllowed("ftp://example.com/receipt.pdf"), false);
  assert.equal(evidenceUrlAllowed("data:text/plain,receipt"), false);
  assert.equal(formatUnitCost(null, "zh"), "—");
  assert.match(formatUnitCost(0, "zh"), /0\.0000/);
  assert.match(formatUnitCost(0.0033, "zh"), /0\.0033/);
  assert.match(formatUnitCost(0.0033, "it"), /0,0033/);
  assert.equal(formatLineLabel({ lineNo: 7, skuCode: "SKU-7" }, "zh"), "手工分摊 行 7 SKU SKU-7");
  assert.equal(formatLineLabel({ lineNo: 7, skuCode: null }, "it"), "Ripartizione manuale Riga 7 SKU —");
  assert.equal(isChargeFormEditable(null, true, true), true);
  assert.equal(isChargeFormEditable({ status: "estimated" }, true, true), true);
  assert.equal(isChargeFormEditable({ status: "confirmed" }, true, true), false);
  assert.equal(isChargeFormEditable({ status: "cancelled" }, true, true), false);
  assert.equal(isChargeFormEditable(null, true, false), false);
  assert.equal(fieldAriaDescribedBy("evidence-url", true), "evidence-url-error");
  assert.equal(fieldAriaDescribedBy("zero-cost-reason", true, true), "zero-cost-reason-description zero-cost-reason-error");
  assert.equal(fieldAriaDescribedBy("notes", false), undefined);
});

test("manual helper deduplicates received lines and exposes exact total/difference", () => {
  const lines = [
    { id: "line-a", lineNo: 1, skuCode: "SKU-A", name: "A", qtyReceived: 2, product: { weightGram: 10 } },
    { id: "line-a", lineNo: 2, skuCode: "SKU-DUP", name: "duplicate", qtyReceived: 4, product: { weightGram: 10 } },
    { id: "line-zero", lineNo: 3, skuCode: "SKU-ZERO", name: "Zero", qtyReceived: 0, product: { weightGram: 10 } },
    { id: "line-b", lineNo: 4, skuCode: null, name: "B", qtyReceived: 1, product: null },
  ];
  assert.equal(Array.from(manualLines(lines), (line) => line.id).join(","), "line-a,line-b");
  const summary = manualSummary(lines, { "line-a": "1.25", "line-b": "0.75" }, "2");
  assert.equal(summary.invalidCount, 0);
  assert.equal(summary.totalCents, 200);
  assert.equal(summary.capitalizedCents, 200);
  assert.equal(summary.differenceCents, 0);
  assert.equal(Array.from(summary.rows, (row) => row.batchLineId).join(","), "line-a,line-b");
  assert.equal(manualSummary(lines, { "line-a": "1" }, "2").invalidCount, 1);
  assert.equal(manualSummary(lines, { "line-a": "1.25", "line-b": "0.70" }, "2").differenceCents, -5);
});

test("payload helper preserves zero reason, manual sums, edit identity and actual schema boundaries", () => {
  const lines = [
    { id: "line-a", lineNo: 1, skuCode: "SKU-A", name: "A", qtyReceived: 1, product: { weightGram: 10 } },
  ];
  const form = {
    allocationMethod: "goods_value",
    amountNet: "1.25",
    capitalizedAmount: "0",
    carrierName: "",
    chargeType: "transport",
    evidenceUrl: "",
    notes: "",
    occurredAt: "",
    reference: "",
    vatAmount: "0",
    vatTreatment: "unknown",
    zeroCostReason: "",
  };
  const blank = buildPayload(form, {}, lines, "create", "idempotency-1");
  assert.equal(blank.payload, null);
  assert.equal(blank.fieldErrors.amountNet, undefined);
  assert.equal(blank.fieldErrors.zeroCostReason, "required");

  const valid = buildPayload({ ...form, zeroCostReason: "free shipment" }, {}, lines, "create", "idempotency-1");
  assert.ok(valid.payload);
  assert.equal(supplierBatchChargePreviewSchema.safeParse(valid.payload).success, true);
  assert.equal(valid.payload.amountNet, 1.25);
  assert.equal(valid.payload.vatAmount, 0);
  assert.equal(valid.payload.currency, "EUR");

  const invalidProtocol = buildPayload({ ...form, evidenceUrl: "ftp://example.com/receipt.pdf", zeroCostReason: "free shipment" }, {}, lines, "create", "idempotency-1");
  assert.equal(invalidProtocol.payload, null);
  assert.equal(invalidProtocol.fieldErrors.evidenceUrl, "protocol");

  const validProtocol = buildPayload({ ...form, evidenceUrl: "https://example.com/receipt.pdf", zeroCostReason: "free shipment" }, {}, lines, "create", "idempotency-1");
  assert.equal(supplierBatchChargePreviewSchema.safeParse(validProtocol.payload).success, true);

  const mutationForm = {
    ...form,
    capitalizedAmount: "1",
    vatTreatment: "recoverable",
    zeroCostReason: "",
  };
  const estimate = buildPayload(mutationForm, {}, lines, "create", "idempotency-1");
  assert.ok(estimate.payload);
  assert.equal(supplierBatchChargeEstimateSchema.safeParse(estimate.payload).success, true);
  assert.equal(Object.hasOwn(estimate.payload, "revision"), false);
  const confirm = buildPayload(mutationForm, {}, lines, "create", "idempotency-1", "revision-1");
  assert.ok(confirm.payload);
  assert.equal(supplierBatchChargeConfirmSchema.safeParse(confirm.payload).success, true);
  assert.equal(confirm.payload.revision, "revision-1");
  assert.equal(supplierBatchChargeEstimateSchema.safeParse(confirm.payload).success, false);

  const manual = buildPayload(
    { ...form, allocationMethod: "manual", capitalizedAmount: "2", zeroCostReason: "" },
    { "line-a": "1" },
    lines,
    "create",
    "idempotency-1"
  );
  assert.equal(manual.payload, null);
  assert.equal(manual.fieldErrors.manualAllocations, "sum");
  const manualOk = buildPayload(
    { ...form, allocationMethod: "manual", capitalizedAmount: "1", zeroCostReason: "" },
    { "line-a": "1" },
    lines,
    "edit",
    "idempotency-1",
    "revision-1",
    "44444444-4444-4444-8444-444444444444"
  );
  assert.ok(manualOk.payload);
  assert.equal(manualOk.payload.chargeId, "44444444-4444-4444-8444-444444444444");
  assert.equal(manualOk.payload.revision, "revision-1");
  assert.equal(supplierBatchChargeEstimateSchema.safeParse(manualOk.payload).success, false);
  assert.equal(supplierBatchChargeConfirmSchema.safeParse(manualOk.payload).success, false);
});

test("form fingerprint and stable error mapping support preview invalidation without leaking raw errors", () => {
  const form = {
    allocationMethod: "goods_value",
    amountNet: "1",
    capitalizedAmount: "1",
    carrierName: "",
    chargeType: "transport",
    evidenceUrl: "",
    notes: "",
    occurredAt: "",
    reference: "",
    vatAmount: "0",
    vatTreatment: "recoverable",
    zeroCostReason: "",
  };
  const first = formFingerprint(form, { a: "1" }, "charge-a", "idempotency-1");
  assert.equal(first, formFingerprint(form, { a: "1" }, "charge-a", "idempotency-1"));
  assert.equal(previewIsCurrent(first, first), true);
  assert.equal(previewIsCurrent(null, first), false);
  assert.equal(previewIsCurrent(`${first}-stale`, first), false);
  assert.notEqual(first, formFingerprint({ ...form, amountNet: "2" }, { a: "1" }, "charge-a", "idempotency-1"));
  assert.notEqual(first, formFingerprint(form, { a: "2" }, "charge-a", "idempotency-1"));
  assert.notEqual(first, formFingerprint(form, { a: "1" }, "charge-b", "idempotency-1"));
  assert.match(mapCostError("STALE_REVISION", "zh"), /重新预览/);
  assert.match(mapCostError("WEIGHT_REQUIRED_FOR_ESTIMATE", "it"), /peso positivo/);
  assert.match(mapCostError("PERMISSION_DENIED", "zh"), /权限/);
  assert.match(mapCostError("ADMIN_FORBIDDEN", "zh"), /无权/);
  assert.match(mapCostError("ADMIN_FORBIDDEN", "it"), /autorizzato/);
  assert.match(mapCostError("AUTHENTICATION_REQUIRED", "it"), /sessione/);
  assert.match(mapCostError("ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE", "zh"), /无法通过校验/);
  assert.doesNotMatch(mapCostError("UNSAFE_RAW_DB_STRING", "zh"), /UNSAFE_RAW_DB_STRING/);
});

test("mutation guards require a current preview and matching persisted identity", () => {
  const batchId = "11111111-1111-4111-8111-111111111111";
  const batchCode = "BATCH-UI";
  const chargeId = "44444444-4444-4444-8444-444444444444";
  const idempotencyKey = "idempotency-1";
  const payloadFingerprint = "fingerprint-1";
  const result = {
    status: "estimated",
    batchId,
    batchCode,
    payloadFingerprint,
    charge: {
      status: "estimated",
      batchId,
      batchCode,
      chargeId,
      idempotencyKey,
      payloadFingerprint,
    },
  };

  assert.equal(mutationResultBelongsToCurrent(result, "estimated", batchId, batchCode, idempotencyKey, payloadFingerprint, chargeId), true);
  assert.equal(mutationResultBelongsToCurrent({ ...result, status: "confirmed" }, "estimated", batchId, batchCode, idempotencyKey, payloadFingerprint, chargeId), false);
  assert.equal(mutationResultBelongsToCurrent({ ...result, batchCode: "OTHER" }, "estimated", batchId, batchCode, idempotencyKey, payloadFingerprint, chargeId), false);
  assert.equal(mutationResultBelongsToCurrent({ ...result, charge: null }, "estimated", batchId, batchCode, idempotencyKey, payloadFingerprint, chargeId), false);
  assert.equal(mutationResultBelongsToCurrent({ ...result, payloadFingerprint: "other-fingerprint" }, "estimated", batchId, batchCode, idempotencyKey, payloadFingerprint, chargeId), false);
  assert.equal(mutationResultBelongsToCurrent({ ...result, charge: { ...result.charge, payloadFingerprint: "other-fingerprint" } }, "estimated", batchId, batchCode, idempotencyKey, payloadFingerprint, chargeId), false);
  assert.equal(mutationResultBelongsToCurrent({ ...result, charge: { ...result.charge, idempotencyKey: "other-key" } }, "estimated", batchId, batchCode, idempotencyKey, payloadFingerprint, chargeId), false);
  assert.equal(mutationResultBelongsToCurrent({ ...result, charge: { ...result.charge, chargeId: "55555555-5555-4555-8555-555555555555" } }, "estimated", batchId, batchCode, idempotencyKey, payloadFingerprint, chargeId), false);
  assert.equal(canConfirmCharge(true, "recoverable", false), true);
  assert.equal(canConfirmCharge(true, "non_recoverable", null), true);
  assert.equal(canConfirmCharge(false, "recoverable", false), false);
  assert.equal(canConfirmCharge(true, "unknown", false), false);
  assert.equal(canConfirmCharge(true, "recoverable", true), false);
});

test("mutation error and readback helpers fail closed on uncertain writes and mismatches", () => {
  assert.equal(classifyMutationError(500, "ADMIN_SUPPLIER_BATCH_COST_CONFIRM_UNAVAILABLE"), "unknown_write");
  assert.equal(classifyMutationError(502, null), "unknown_write");
  assert.equal(classifyMutationError(400, null), "unknown_write");
  assert.equal(classifyMutationError(400, "ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE"), "unknown_write");
  assert.equal(classifyMutationError(400, "INVALID_BODY"), "known_rejection");
  assert.equal(classifyMutationError(400, "BATCH_IDS_LIMIT_EXCEEDED"), "known_rejection");
  assert.equal(classifyMutationError(409, "STALE_REVISION"), "known_rejection");
  assert.equal(classifyMutationError(403, "ADMIN_FORBIDDEN"), "known_rejection");
  assert.equal(classifyMutationError(403, null), "unknown_write");
  assert.equal(isTrustedMutationErrorCode("STALE_REVISION"), true);
  assert.equal(isTrustedMutationErrorCode("ADMIN_FORBIDDEN"), true);
  assert.equal(isTrustedMutationErrorCode("UNSAFE_RAW_DB_ERROR"), false);

  for (const code of [
    "STALE_REVISION",
    "FINANCIAL_ADJUSTMENT_REQUIRED",
    "IDEMPOTENCY_CONFLICT",
    "CHARGE_IMMUTABLE",
    "CHARGE_CANCELLED",
    "CHARGE_NOT_FOUND",
    "BATCH_NOT_FOUND",
  ]) {
    assert.equal(invalidatePreviewForMutationError(code), true, code);
  }
  assert.equal(invalidatePreviewForMutationError("NETWORK_ERROR"), false);

  const batchId = "11111111-1111-4111-8111-111111111111";
  const batchCode = "BATCH-UI";
  const chargeId = "44444444-4444-4444-8444-444444444444";
  const key = "idempotency-1";
  const fingerprint = "fingerprint-1";
  const detail = {
    batch: { id: batchId, batchCode },
    charges: [{
      batchId,
      batchCode,
      chargeId,
      status: "estimated",
      idempotencyKey: key,
      payloadFingerprint: fingerprint,
    }],
  };

  assert.equal(classifyMutationReadback(detail, "estimated", batchId, batchCode, key, fingerprint, chargeId), "matched");
  assert.equal(classifyMutationReadback({ ...detail, charges: [{ ...detail.charges[0], status: "confirmed" }] }, "estimated", batchId, batchCode, key, fingerprint, chargeId), "matched");
  assert.equal(classifyMutationReadback(detail, "confirmed", batchId, batchCode, key, fingerprint, chargeId), "not_found");
  assert.equal(classifyMutationReadback({ ...detail, charges: [{ ...detail.charges[0], status: "confirmed" }] }, "confirmed", batchId, batchCode, key, fingerprint, chargeId), "matched");
  assert.equal(classifyMutationReadback({ ...detail, charges: [{ ...detail.charges[0], idempotencyKey: "other-key" }] }, "estimated", batchId, batchCode, key, fingerprint, chargeId), "not_found");
  assert.equal(classifyMutationReadback({ ...detail, charges: [{ ...detail.charges[0], payloadFingerprint: "other-fingerprint" }] }, "estimated", batchId, batchCode, key, fingerprint, chargeId), "idempotency_conflict");
  assert.equal(classifyMutationReadback({ ...detail, charges: [{ ...detail.charges[0], chargeId: "55555555-5555-4555-8555-555555555555" }] }, "estimated", batchId, batchCode, key, fingerprint, chargeId), "not_found");
  assert.equal(classifyMutationReadback(detail, "estimated", batchId, batchCode, key, fingerprint, null), "matched");
  assert.equal(classifyMutationReadback({ ...detail, batch: { id: batchId, batchCode: "OTHER" } }, "estimated", batchId, batchCode, key, fingerprint, chargeId), "invalid");
  assert.equal(classifyMutationReadback(null, "estimated", batchId, batchCode, key, fingerprint, chargeId), "invalid");
});

test("schema issue mapper returns safe field codes instead of raw Zod messages", () => {
  const mapped = mapSchemaIssues([
    { code: "too_big", path: ["manualAllocations"], message: "Array must contain at most 500 element(s)" },
    { code: "too_big", path: ["carrierName"], message: "String must contain at most 200 character(s)" },
    { code: "custom", path: ["manualAllocations"], message: "MANUAL_ALLOCATIONS_SUM_MUST_EQUAL_CAPITALIZED" },
    { code: "custom", path: ["zeroCostReason"], message: "ZERO_COST_REASON_REQUIRED" },
    { code: "invalid_string", path: ["evidenceUrl"], message: "Invalid url" },
  ]);
  assert.equal(mapped.manualAllocations, "limit");
  assert.equal(mapped.carrierName, "invalid");
  assert.equal(mapped.zeroCostReason, "required");
  assert.equal(mapped.evidenceUrl, "invalid");
  assert.doesNotMatch(JSON.stringify(mapped), /Array must contain|MANUAL_ALLOCATIONS|Invalid url/);
});

test("client DTO contract is fail-closed for cost summary, charges, line costs and weight", () => {
  assert.match(panelSource, /normalizeSupplierBatchCostSummary/);
  assert.match(panelSource, /rawCostSummary[\s\S]{0,260}costSummary/);
  assert.match(panelSource, /isSupplierBatchCostSummaryForBatch\(costSummary, id, batchCode\)/);
  assert.match(panelSource, /normalizeSupplierBatchChargeForBatch/);
  assert.match(panelSource, /isSupplierBatchChargeForBatch\(charge, batch\.id, batch\.batchCode\)/);
  assert.match(panelSource, /normalizedCharges\.some\(\(charge\) => charge === null\)/);
  assert.match(panelSource, /normalizeSupplierBatchLineCost/);
  assert.match(panelSource, /rawCosts[\s\S]{0,180}costs/);
  assert.match(panelSource, /normalizeSupplierBatchLineCost\(rawCosts, id, qtyReceived\)/);
  assert.match(panelSource, /batchLineId !== expectedBatchLineId/);
  assert.match(panelSource, /landedLineCostCents !== goodsCostCents \+ confirmedInboundCents/);
  assert.match(panelSource, /roundSupplierBatchGoodsCostToCents\(expectedQtyReceived, goodsUnitCost\)/);
  assert.match(panelSource, /expectedQtyReceived === 0/);
  assert.match(panelSource, /landedUnitCost === expectedLandedUnitCost/);
  assert.match(panelSource, /weightGram/);
  assert.match(panelSource, /rawWeight[\s\S]{0,260}weightGram === null/);
});

test("permission and charges-export contract stays read-only in the panel", () => {
  assert.match(panelSource, /resolveSupplierBatchCostPermissions\(\s*permissions,\s*permissionsLoaded\s*\)/);
  assert.match(panelSource, /const canManageSupplierBatchCosts = supplierBatchCostPermissions\.canManage/);
  assert.match(panelSource, /canManage: canRead && permissions\.includes\("supplier_batch\.manage_costs"\)/);
  assert.match(panelSource, /type SupplierBatchExportScope = "batches" \| "lines" \| "charges"/);
  assert.match(panelSource, /onDownload\("charges",/);
  assert.match(panelSource, /canManageCosts \? \(/);
  assert.match(panelSource, /SupplierBatchTransportCostCard/);
  assert.match(panelSource, /onExportCharges=/);
  assert.match(panelSource, /onCostChanged=\{refreshSupplierBatchCost\}/);
  assert.match(panelSource, /const refreshSupplierBatchCost = React\.useCallback\([\s\S]{0,700}Promise<AdminSupplierBatchDetail>[\s\S]{0,200}Promise\.all\([\s\S]{0,240}fetchAdminSupplierBatchDetail\(batchCode, signal\)[\s\S]{0,240}refreshSupplierBatches\(signal, \{ clearNotice: false \}\)/);
  assert.match(panelSource, /async function fetchAdminSupplierBatchDetail\(batchCode: string, signal\?: AbortSignal\)/);
  assert.match(panelSource, /fetch\([\s\S]{0,260}signal,\s*\}\s*\)/);
  assert.match(panelSource, /return nextDetail/);
  assert.match(panelSource, /if \(options\.clearNotice === false\) \{\s*throw error;/);
  assert.match(panelSource, /canManageSupplierBatchCosts \? \(format\) => void onDownload\(batch, "charges", format\)/);
  assert.doesNotMatch(panelSource, /charges\/(?:preview|estimate|confirm)/);
});

test("card exposes compact display components and status-only charge semantics", () => {
  assert.match(cardSource, /export function SupplierBatchCostSummaryCompact/);
  assert.match(cardSource, /export function SupplierBatchLineCostCompact/);
  assert.match(cardSource, /export function SupplierBatchTransportCostCard/);
  assert.match(cardSource, /charge\.status === "estimated"[\s\S]{0,100}canManage[\s\S]{0,100}copy\.editableCharge[\s\S]{0,100}copy\.estimatedCharge/);
  assert.match(cardSource, /SupplierBatchCostExportMenu/);
  assert.match(cardSource, /onExport\("csv"\)/);
  assert.match(cardSource, /onExport\("xlsx"\)/);
  assert.match(cardSource, /copy\.carrier/);
  assert.match(cardSource, /copy\.reference/);
  assert.match(cardSource, /copy\.date/);
  assert.doesNotMatch(cardSource, /supplier_batch\.manage_costs/);
  assert.match(cardSource, /onAddCharge/);
  assert.match(cardSource, /onEditCharge/);
  assert.match(cardSource, /charge\.status === "estimated" && canManage/);
  assert.match(cardSource, /export function formatSupplierBatchUnitCost/);
  assert.match(cardSource, /formatSupplierBatchUnitCost\(costs\.landedUnitCost, language\)/);
  assert.match(dialogSource, /formatSupplierBatchUnitCost\(line\.currentLandedUnitCost, language\)/);
  assert.doesNotMatch(dialogSource, /export function formatSupplierBatchUnitCost/);

  const compactSource = cardSource.slice(
    cardSource.indexOf("export function SupplierBatchCostSummaryCompact"),
    cardSource.indexOf("export function SupplierBatchLineCostCompact")
  );
  assert.doesNotMatch(compactSource, /goodsValue/);
  assert.match(cardSource, /\{canReadCosts \? \(/);
});

test("dialog B2 contract gates mutations on current preview and server readback", () => {
  assert.match(dialogSource, /supplierBatchChargePreviewSchema\.safeParse/);
  assert.match(dialogSource, /supplierBatchChargeEstimateSchema\.safeParse\(payload\)/);
  assert.match(dialogSource, /supplierBatchChargeConfirmSchema\.safeParse\(payload\)/);
  assert.match(dialogSource, /charges\/preview/);
  assert.match(dialogSource, /charges\/estimate/);
  assert.match(dialogSource, /charges\/confirm/);
  assert.match(dialogSource, /normalizeSupplierBatchCostRpcResult\(data\)/);
  assert.match(dialogSource, /result\.batchId !== detail\.batch\.id/);
  assert.match(dialogSource, /result\.batchCode !== detail\.batch\.batchCode/);
  assert.match(dialogSource, /result\.status !== "preview"/);
  assert.match(dialogSource, /await onCostChanged\(detail\.batch\.batchCode, controller\.signal\)/);
  assert.match(dialogSource, /isSupplierBatchPreviewCurrent/);
  assert.match(dialogSource, /canConfirmSupplierBatchCharge/);
  assert.match(dialogSource, /isSupplierBatchMutationResultForCurrent/);
  assert.match(dialogSource, /SupplierBatchMutationContext/);
  assert.match(dialogSource, /persistedKnownSuccess/);
  assert.doesNotMatch(dialogSource, /persistedAwaitingRefresh/);
  assert.match(dialogSource, /retryRefresh/);
  assert.match(dialogSource, /setPending\("refresh"\)/);
  assert.match(dialogSource, /setUncertainMutation/);
  assert.match(dialogSource, /uncertainMutation\.action/);
  assert.match(dialogSource, /payloadFingerprint/);
  assert.match(dialogSource, /classifySupplierBatchMutationReadback/);
  assert.match(dialogSource, /verifyMutationReadback/);
  assert.match(dialogSource, /classifySupplierBatchMutationError/);
  assert.match(dialogSource, /unknownWrite: classifySupplierBatchMutationError/);
  assert.match(dialogSource, /shouldInvalidateSupplierBatchPreviewForMutationError/);
  assert.match(dialogSource, /ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE/);
  assert.match(dialogSource, /result\.payloadFingerprint !== payloadFingerprint/);
  assert.match(dialogSource, /setPersistedKnownSuccess\(mutationContext\);[\s\S]{0,180}setPending\("refresh"\)/);
  assert.match(dialogSource, /if \(mutationActiveRef\.current \|\| persistedKnownSuccess !== null \|\| uncertainMutation !== null\) \{\s*return;/);
  assert.match(dialogSource, /READBACK_IDEMPOTENCY_CONFLICT/);
  assert.match(dialogSource, /READBACK_NOT_FOUND/);
  assert.match(dialogSource, /setUncertainMutation\(mutationContext\)/);
  assert.match(dialogSource, /globalThis\.crypto\?\.randomUUID/);
  assert.match(dialogSource, /previewRequestIdRef\.current/);
  assert.match(dialogSource, /AbortController/);
  assert.match(dialogSource, /controller\.abort\(\)/);
  assert.match(dialogSource, /mutationActiveRef\.current/);
  assert.match(dialogSource, /mutationAbortRef\.current\?\.abort\(\)/);
  assert.match(dialogSource, /signal/);
  assert.match(dialogSource, /25_000/);
  assert.match(dialogSource, /window\.clearTimeout\(timeoutId\)/);
  assert.match(dialogSource, /pending === "estimate" \|\| pending === "confirm" \|\| pending === "refresh"/);
  assert.match(dialogSource, /persistedKnownSuccess !== null \|\| uncertainMutation !== null/);
  assert.match(dialogSource, /setFieldErrors\(\{\}\)/);
  assert.match(dialogSource, /formatSupplierBatchCostLineLabel/);
  assert.match(dialogSource, /manual-allocations-error/);
  assert.match(dialogSource, /isSupplierBatchEvidenceUrl/);
  assert.match(dialogSource, /buildSupplierBatchFieldAriaDescribedBy/);
  assert.match(dialogSource, /chargeIsReadOnly/);
  assert.match(dialogSource, /charge\.status !== "estimated"/);
  assert.match(dialogSource, /line\.lineNo/);
  assert.match(dialogSource, /line\.skuCode/);
  assert.doesNotMatch(dialogSource, /line\.id\.slice/);
  assert.match(dialogSource, /mapSupplierBatchSchemaIssues/);
  assert.match(dialogSource, /onCostChanged,/);
  assert.match(dialogSource, /previewState\.result\.confirmationBlocked/);
  assert.match(dialogSource, /MANUAL_ALLOCATIONS_REQUIRED/);
  assert.match(dialogSource, /STALE_REVISION/);
  assert.match(dialogSource, /WEIGHT_REQUIRED_FOR_ESTIMATE/);
  assert.match(dialogSource, /runMutation\("estimate"\)/);
  assert.match(dialogSource, /runMutation\("confirm"\)/);
  assert.match(dialogSource, /if \(openRef\.current\) onOpenChange\(false\)/);
  const mutationFunction = dialogSource.slice(
    dialogSource.indexOf("async function runMutation"),
    dialogSource.indexOf("async function retryRefresh")
  );
  assert.doesNotMatch(mutationFunction, /runMutation\("confirm"\)/);

  const knownSuccessReadback = dialogSource.slice(
    dialogSource.indexOf("// The mutation response is authoritative enough"),
    dialogSource.indexOf("    } catch (cause) {", dialogSource.indexOf("// The mutation response is authoritative enough"))
  );
  assert.match(knownSuccessReadback, /setPersistedKnownSuccess\(mutationContext\)/);
  assert.match(knownSuccessReadback, /readback\.outcome === "matched"[\s\S]{0,220}reset\(\)/);
  assert.match(knownSuccessReadback, /READBACK_IDEMPOTENCY_CONFLICT/);
  assert.match(knownSuccessReadback, /READBACK_NOT_FOUND/);
  assert.doesNotMatch(knownSuccessReadback, /setUncertainMutation/);

  const readbackFunction = dialogSource.slice(
    dialogSource.indexOf("async function verifyMutationReadback"),
    dialogSource.indexOf("async function retryRefresh")
  );
  assert.match(readbackFunction, /performMutationReadback\(requestId, context\)/);
  assert.doesNotMatch(readbackFunction, /postMutation\(/);

  const refreshRetryFunction = dialogSource.slice(
    dialogSource.indexOf("async function retryRefresh"),
    dialogSource.indexOf("function handleOpenChange")
  );
  assert.match(refreshRetryFunction, /performMutationReadback\(requestId, context\)/);
  assert.match(refreshRetryFunction, /readback\.outcome === "matched"[\s\S]{0,180}reset\(\)/);
  assert.doesNotMatch(refreshRetryFunction, /postMutation\(/);
  assert.doesNotMatch(refreshRetryFunction, /runMutation\(/);
  assert.match(dialogSource, /ADMIN_FORBIDDEN/);
  for (const code of [
    "STALE_REVISION",
    "FINANCIAL_ADJUSTMENT_REQUIRED",
    "IDEMPOTENCY_CONFLICT",
    "CHARGE_IMMUTABLE",
    "CHARGE_CANCELLED",
    "CHARGE_NOT_FOUND",
    "BATCH_NOT_FOUND",
  ]) {
    assert.match(dialogSource, new RegExp(`"${code}"`));
  }
});

function summaryFixture(status, overrides = {}) {
  const values = {
    batchId: "11111111-1111-4111-8111-111111111111",
    batchCode: "BATCH-UI",
    currency: "EUR",
    goodsValue: 100,
    estimatedCount: status === "estimated" ? 1 : 0,
    confirmedCount: ["confirmed", "confirmed_zero"].includes(status) ? 1 : 0,
    cancelledCount: 0,
    estimatedNet: status === "estimated" ? 5 : 0,
    estimatedVat: 0,
    estimatedGross: status === "estimated" ? 5 : 0,
    estimatedCapitalized: status === "estimated" ? 5 : 0,
    confirmedNet: status === "confirmed" ? 1 : 0,
    confirmedVat: 0,
    confirmedGross: status === "confirmed" ? 1 : 0,
    confirmedCapitalized: status === "confirmed" ? 1 : 0,
    confirmedLandedTotal: status === "confirmed" ? 101 : 100,
    projectedLandedTotal: status === "estimated" ? 105 : status === "confirmed" ? 101 : 100,
    confirmationBlocked: false,
    reviewCodes: [],
    costStatus: status,
    ...overrides,
  };

  const summary = normalizeSupplierBatchCostSummary(values);
  assert.ok(summary, `fixture should normalize: ${status}`);
  return summary;
}

function loadSourceFunction(source, names, entryPoint, prefix = "") {
  const helpers = names.map((name) => extractFunction(source, name)).join("\n");
  const javascript = transpileModule(
    `${prefix}\n${helpers}\nglobalThis.result = ${entryPoint};`,
    {
      compilerOptions: {
        module: ModuleKind.CommonJS,
        target: ScriptTarget.ES2020,
      },
    }
  ).outputText;
  const context = {};
  vm.runInNewContext(javascript, context);
  assert.equal(typeof context.result, "function");
  return context.result;
}

function assertPermissionState(permissions, permissionsLoaded, canRead, canManage) {
  const actual = resolvePermissions(permissions, permissionsLoaded);
  assert.equal(actual.canRead, canRead);
  assert.equal(actual.canManage, canManage);
}

function extractFunction(source, name) {
  const exportedStart = source.indexOf(`export function ${name}(`);
  const start = exportedStart >= 0 ? exportedStart : source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} helper was not found`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1).replace(/^export /, "");
      }
    }
  }

  assert.fail(`${name} helper boundary was not found`);
}
