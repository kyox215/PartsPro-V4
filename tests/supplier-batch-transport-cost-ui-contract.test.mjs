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
  supplierBatchChargeV2ConfirmSchema,
  supplierBatchChargeV2CorrectSchema,
  supplierBatchChargeV2PreviewSchema,
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
const supportSource = readFileSync(
  path.join(repoRoot, "src/components/partspro/support-widget.tsx"),
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
    "readNullableNonNegativeInteger",
    "readNonNegativeFinite",
    "readNumber",
    "readBoolean",
    "readString",
    "isRecord",
  ],
  "normalizeSupplierBatchLineCost",
  `
function readSupplierBatchMoneyCents(value, centsKeys, decimalKeys = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value;
  const readNumber = (candidate) => {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string" && candidate.trim() !== "") {
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  for (const key of centsKeys) {
    const cents = readNumber(record[key]);
    if (cents !== null && Number.isSafeInteger(cents)) return cents;
  }
  for (const key of decimalKeys) {
    const decimal = readNumber(record[key]);
    if (decimal !== null) {
      const rounded = Math.round((decimal + Number.EPSILON) * 100);
      if (Number.isSafeInteger(rounded)) return rounded;
    }
  }
  return null;
}`
);
const parseMoney = loadSourceFunction(
  dialogSource,
  ["parseSupplierBatchMoneyInput"],
  "parseSupplierBatchMoneyInput"
);
const dateTimeToIso = loadSourceFunction(
  dialogSource,
  [
    "supplierBatchRomeOffsetMilliseconds",
    "supplierBatchRomeDateTimeMatches",
    "supplierBatchDateTimeLocalToIso",
  ],
  "supplierBatchDateTimeLocalToIso"
);
const dateTimeFromIso = loadSourceFunction(
  dialogSource,
  ["supplierBatchDateTimeLocalFromIso"],
  "supplierBatchDateTimeLocalFromIso"
);
const evidenceUrlAllowed = loadSourceFunction(
  dialogSource,
  ["isSupplierBatchEvidenceUrl"],
  "isSupplierBatchEvidenceUrl"
);
const formatUnitCost = loadSourceFunction(
  cardSource,
  ["formatSupplierBatchUnitCost"],
  "formatSupplierBatchUnitCost",
  `
function formatSupplierBatchUnitMoney(value, currency, locale) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}`
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
const canCorrectCharge = loadSourceFunction(
  dialogSource,
  ["canCorrectSupplierBatchCharge"],
  "canCorrectSupplierBatchCharge"
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
const mutationReceiptPrefix = `
const SUPPLIER_BATCH_MUTATION_RECEIPT_KEYS = [
  "action",
  "status",
  "batchId",
  "batchCode",
  "chargeId",
  "idempotencyKey",
  "payloadFingerprint",
];`;
const isMutationReceipt = loadSourceFunction(
  dialogSource,
  ["isRecord", "hasExactKeys", "isNonEmptyReceiptString", "isSupplierBatchMutationReceipt"],
  "isSupplierBatchMutationReceipt",
  mutationReceiptPrefix
);
const isMutationReceiptForCurrent = loadSourceFunction(
  dialogSource,
  [
    "isRecord",
    "hasExactKeys",
    "isNonEmptyReceiptString",
    "isSupplierBatchMutationReceipt",
    "isSupplierBatchMutationReceiptForCurrent",
  ],
  "isSupplierBatchMutationReceiptForCurrent",
  mutationReceiptPrefix
);
const isMutationReceiptEnvelope = loadSourceFunction(
  dialogSource,
  [
    "isRecord",
    "hasExactKeys",
    "isNonEmptyReceiptString",
    "isSupplierBatchMutationReceipt",
    "isSupplierBatchMutationReceiptEnvelope",
  ],
  "isSupplierBatchMutationReceiptEnvelope",
  mutationReceiptPrefix
);
const extractCanonicalMutationReceipt = loadSourceFunction(
  dialogSource,
  ["isRecord", "isNonEmptyReceiptString", "extractSupplierBatchMutationReceiptFromCanonicalResult"],
  "extractSupplierBatchMutationReceiptFromCanonicalResult"
);
const classifyMutationReadback = loadSourceFunction(
  dialogSource,
  ["classifySupplierBatchMutationReadback"],
  "classifySupplierBatchMutationReadback"
);
const isCorrectionReceipt = loadSourceFunction(
  dialogSource,
  ["isRecord", "isNonEmptyReceiptString", "isSupplierBatchCorrectionReceipt"],
  "isSupplierBatchCorrectionReceipt"
);
const isCorrectionReceiptForCurrent = loadSourceFunction(
  dialogSource,
  ["isRecord", "isNonEmptyReceiptString", "isSupplierBatchCorrectionReceipt", "isSupplierBatchCorrectionReceiptForCurrent"],
  "isSupplierBatchCorrectionReceiptForCurrent"
);
const classifyCorrectionReadback = loadSourceFunction(
  dialogSource,
  ["isRecord", "isNonEmptyReceiptString", "isSupplierBatchCorrectionReceipt", "dedupeSupplierBatchHistory", "readSupplierBatchChargeCorrectionLinks", "classifySupplierBatchCorrectionReadback"],
  "classifySupplierBatchCorrectionReadback"
);
const classifyCorrectionReadbackByContext = loadSourceFunction(
  dialogSource,
  ["isRecord", "dedupeSupplierBatchHistory", "readSupplierBatchChargeCorrectionLinks", "classifySupplierBatchCorrectionReadbackByContext"],
  "classifySupplierBatchCorrectionReadbackByContext"
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
    "parseSupplierBatchFxRateInput",
    "supplierBatchDateTimeLocalToIso",
    "isSupplierBatchEvidenceUrl",
    "getSupplierBatchManualLines",
    "summarizeSupplierBatchManualAllocations",
    "buildSupplierBatchChargePayload",
  ],
  "buildSupplierBatchChargePayload",
  `
const MAX_MANUAL_ROWS = 500;
function normalizeSupplierBatchCurrency(value) {
  return value === "USD" || value === "CNY" ? value : "EUR";
}`
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

test("ownership and permission helpers reject cross-batch data and enforce the five capability matrix", () => {
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

  assertPermissionState([], true, {
    canRead: false,
    canEstimate: false,
    canConfirm: false,
    canCorrect: false,
    canExport: false,
    canManage: false,
  });
  assertPermissionState(["supplier_batch.manage_costs"], true, {
    canRead: false,
    canEstimate: false,
    canConfirm: false,
    canCorrect: false,
    canExport: false,
    canManage: false,
  });
  for (const readPermission of [
    "products.read_admin",
    "product.read_admin",
  ]) {
    assertPermissionState([readPermission], true, {
      canRead: true,
      canEstimate: false,
      canConfirm: false,
      canCorrect: false,
      canExport: false,
      canManage: false,
    });
  }
  assertPermissionState(["supplier_batch.read"], true, {
    canRead: false,
    canReadHistory: true,
    canEstimate: false,
    canConfirm: false,
    canCorrect: false,
    canExport: false,
    canManage: false,
  });
  for (const unrelatedPermission of ["finance.read", "finance.cost_reconcile", "finance.export"]) {
    assertPermissionState([unrelatedPermission], true, {
      canRead: false,
      canEstimate: false,
      canConfirm: false,
      canCorrect: false,
      canExport: false,
      canManage: false,
    });
  }
  assertPermissionState(["products.read_admin", "supplier_batch.estimate"], true, {
    canRead: true,
    canEstimate: true,
    canConfirm: false,
    canCorrect: false,
    canExport: false,
    canManage: true,
  });
  assertPermissionState(["products.read_admin", "supplier_batch.manage_costs"], true, {
    canRead: true,
    canEstimate: true,
    canConfirm: false,
    canCorrect: false,
    canExport: false,
    canManage: true,
  });
  assertPermissionState(["products.read_admin", "supplier_batch.confirm", "supplier_batch.correct"], true, {
    canRead: true,
    canEstimate: false,
    canConfirm: true,
    canCorrect: true,
    canExport: false,
    canManage: false,
  });
  assertPermissionState(["products.read_admin", "supplier_batch.export"], true, {
    canRead: true,
    canEstimate: false,
    canConfirm: false,
    canCorrect: false,
    canExport: true,
    canManage: false,
  });
  assertPermissionState([
    "products.read_admin",
    "supplier_batch.manage_costs",
    "supplier_batch.confirm",
    "supplier_batch.correct",
    "supplier_batch.export",
  ], true, {
    canRead: true,
    canEstimate: true,
    canConfirm: true,
    canCorrect: true,
    canExport: true,
    canManage: true,
  });
  assertPermissionState([
    "products.read_admin",
    "supplier_batch.estimate",
    "supplier_batch.confirm",
    "supplier_batch.correct",
    "supplier_batch.export",
  ], false, {
    canRead: false,
    canEstimate: false,
    canConfirm: false,
    canCorrect: false,
    canExport: false,
    canManage: false,
  });
});

test("line cost parser enforces the current quantity and landed arithmetic", () => {
  const valid = {
    batchLineId: "line-a",
    originalCurrencyComparable: true,
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
  assert.equal(dateTimeToIso("2026-08-25T12:00").value, "2026-08-25T10:00:00.000Z");
  assert.equal(dateTimeToIso("2026-03-29T02:30").error, "invalid");
  assert.equal(dateTimeFromIso("2026-08-25T10:00:00.000Z"), "2026-08-25T12:00");
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
    currency: "EUR",
    fxRateToEur: "1",
    fxRateDate: "2026-08-25",
    fxRateSource: "EUR base",
    correctionReason: "",
  };
  const blank = buildPayload(form, {}, lines, "create", "idempotency-1");
  assert.equal(blank.payload, null);
  assert.equal(blank.fieldErrors.amountNet, undefined);
  assert.equal(blank.fieldErrors.zeroCostReason, "required");

  const valid = buildPayload({ ...form, zeroCostReason: "free shipment" }, {}, lines, "create", "idempotency-1");
  assert.ok(valid.payload);
  assert.equal(supplierBatchChargePreviewSchema.safeParse(valid.payload).success, true);
  assert.equal(supplierBatchChargeV2PreviewSchema.safeParse(valid.payload).success, true);
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
  assert.equal(supplierBatchChargeV2ConfirmSchema.safeParse(confirm.payload).success, false);
  const v2Confirm = buildPayload(
    mutationForm,
    {},
    lines,
    "create",
    "idempotency-1",
    "revision-1",
    undefined,
    "preview-fingerprint-123456"
  );
  assert.ok(v2Confirm.payload);
  assert.equal(supplierBatchChargeV2ConfirmSchema.safeParse(v2Confirm.payload).success, true);

  const usdMissingFx = buildPayload(
    {
      ...form,
      currency: "USD",
      fxRateToEur: "",
      fxRateDate: "",
      fxRateSource: "",
      zeroCostReason: "free shipment",
    },
    {},
    lines,
    "create",
    "idempotency-usd"
  );
  assert.equal(usdMissingFx.payload, null);
  assert.equal(usdMissingFx.fieldErrors.fxRateToEur, "required");
  assert.equal(usdMissingFx.fieldErrors.fxRateDate, "invalid");
  assert.equal(usdMissingFx.fieldErrors.fxRateSource, "required");

  const usd = buildPayload(
    {
      ...form,
      currency: "USD",
      fxRateToEur: "0.92",
      fxRateDate: "2026-08-25",
      fxRateSource: "ECB snapshot",
      zeroCostReason: "free shipment",
    },
    {},
    lines,
    "create",
    "idempotency-usd"
  );
  assert.ok(usd.payload);
  assert.equal(usd.payload.currency, "USD");
  assert.equal(usd.payload.fxRateToEur, 0.92);
  assert.equal(supplierBatchChargeV2PreviewSchema.safeParse(usd.payload).success, true);

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

  const correction = buildPayload(
    {
      ...mutationForm,
      correctionReason: "Invoice correction",
    },
    {},
    lines,
    "correction",
    "idempotency-correction",
    "revision-2",
    "44444444-4444-4444-8444-444444444444",
    "preview-fingerprint-123456",
    true
  );
  assert.ok(correction.payload);
  assert.equal(correction.payload.chargeId, "44444444-4444-4444-8444-444444444444");
  assert.equal(correction.payload.correctionReason, "Invoice correction");
  assert.equal(supplierBatchChargeV2CorrectSchema.safeParse(correction.payload).success, true);
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
  assert.match(mapCostError("ADMIN_SUPPLIER_BATCH_COST_V2_RPC_INVALID_RESPONSE", "zh"), /未写入成本/);
  assert.match(mapCostError("ADMIN_SUPPLIER_BATCH_COST_V2_RPC_INVALID_RESPONSE", "it"), /nessun costo è stato scritto/);
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
  assert.equal(canCorrectCharge(true, "recoverable", true, "FINANCE_ADJUSTMENT_REQUIRED"), true);
  assert.equal(canCorrectCharge(true, "recoverable", true, "BATCH_FX_RATE_REQUIRED"), false);
  assert.equal(canCorrectCharge(true, "unknown", true, "FINANCE_ADJUSTMENT_REQUIRED"), false);
});

test("dedicated correction receipts distinguish applied replacement from pending finance adjustment", () => {
  const batchId = "batch-id";
  const batchCode = "BATCH-UI";
  const originalChargeId = "44444444-4444-4444-8444-444444444444";
  const replacementChargeId = "55555555-5555-4555-8555-555555555555";
  const correctionId = "66666666-6666-4666-8666-666666666666";
  const idempotencyKey = "correction-key";
  const previewFingerprint = "correction-fingerprint";
  const payloadFingerprint = "replacement-payload-fingerprint";
  const revision = "revision-1";
  const applied = {
    status: "corrected",
    correctionId,
    originalChargeId,
    replacementChargeId,
    batchCode,
    idempotencyKey,
    previewFingerprint,
    revision,
    financeAdjustmentRequired: false,
    replacement: {
      status: "confirmed",
      batchCode,
      charge: { chargeId: replacementChargeId },
    },
  };
  const pending = {
    status: "pending_finance_adjustment",
    correctionId,
    originalChargeId,
    replacementChargeId: null,
    batchCode,
    idempotencyKey,
    previewFingerprint,
    revision,
    financeAdjustmentRequired: true,
    replacement: null,
  };

  assert.equal(isCorrectionReceipt(applied), true);
  assert.equal(isCorrectionReceipt(pending), true);
  assert.equal(isCorrectionReceipt({ ...pending, replacementChargeId: replacementChargeId }), false);
  assert.equal(
    isCorrectionReceiptForCurrent(applied, batchCode, originalChargeId, idempotencyKey, previewFingerprint, revision),
    true
  );
  assert.equal(
    isCorrectionReceiptForCurrent({ ...applied, revision: "stale" }, batchCode, originalChargeId, idempotencyKey, previewFingerprint, revision),
    false
  );

  const appliedDetail = {
    batch: { id: batchId, batchCode },
    charges: [{
      batchId,
      batchCode,
      chargeId: replacementChargeId,
      status: "confirmed",
      idempotencyKey,
      payloadFingerprint: previewFingerprint,
      metadata: {
        correctionOriginalChargeId: originalChargeId,
        correctionId,
      },
      correction: {
        originalChargeId,
        replacementChargeId,
        correctionId,
        status: "applied",
        financeAdjustmentRequired: false,
      },
    }],
    history: [],
  };
  assert.equal(classifyCorrectionReadback(appliedDetail, applied), "matched");
  assert.equal(
    classifyCorrectionReadback(
      { ...appliedDetail, charges: [] },
      applied
    ),
    "not_found"
  );

  const pendingDetail = {
    batch: { id: batchId, batchCode },
    charges: [{ batchId, batchCode, chargeId: originalChargeId, status: "confirmed" }],
    history: [{
      batchId,
      batchCode,
      status: "pending_finance_adjustment",
      correctionId,
    links: { originalChargeId, replacementChargeId: null, correctionId },
    idempotencyKey,
    payloadFingerprint: previewFingerprint,
  }],
  };
  assert.equal(classifyCorrectionReadback(pendingDetail, pending), "correction_pending");
  assert.equal(
    classifyCorrectionReadback(
      { ...pendingDetail, history: [] },
      pending
    ),
    "not_found"
  );

  const uncertainContext = {
    batch: { id: "batch-id", batchCode },
    charges: [{
      batchId: "batch-id",
      batchCode,
      chargeId: replacementChargeId,
      status: "confirmed",
      idempotencyKey,
      payloadFingerprint,
      metadata: {
        correctionOriginalChargeId: originalChargeId,
        correctionId,
      },
    }],
    history: [],
  };
  assert.equal(
    classifyCorrectionReadbackByContext(
      uncertainContext,
      batchCode,
      originalChargeId,
      idempotencyKey,
      payloadFingerprint
    ),
    "not_found"
  );
  assert.equal(
    classifyCorrectionReadbackByContext(
      {
        ...uncertainContext,
        charges: [],
        history: [{
          batchId: "batch-id",
          batchCode,
          status: "pending_finance_adjustment",
          correctionOfChargeId: originalChargeId,
          correctionId,
          idempotencyKey,
          payloadFingerprint,
        }],
      },
      batchCode,
      originalChargeId,
      idempotencyKey,
      payloadFingerprint
    ),
    "correction_pending"
  );
  assert.equal(
    classifyCorrectionReadbackByContext(
      uncertainContext,
      batchCode,
      originalChargeId,
      idempotencyKey,
      "different-fingerprint"
    ),
    "not_found"
  );
});

test("persisted mutation receipts are exact and bind to the original draft", () => {
  const batchId = "11111111-1111-4111-8111-111111111111";
  const otherBatchId = "22222222-2222-4222-8222-222222222222";
  const batchCode = "BATCH-UI";
  const chargeId = "44444444-4444-4444-8444-444444444444";
  const otherChargeId = "55555555-5555-4555-8555-555555555555";
  const idempotencyKey = "idempotency-1";
  const payloadFingerprint = "fingerprint-1";
  const estimateReceipt = {
    action: "estimate",
    status: "estimated",
    batchId,
    batchCode,
    chargeId,
    idempotencyKey,
    payloadFingerprint,
  };
  const confirmReceipt = { ...estimateReceipt, action: "confirm", status: "confirmed" };
  const estimateEnvelope = {
    outcome: "persisted_readback_required",
    receipt: estimateReceipt,
  };
  const confirmEnvelope = {
    outcome: "persisted_readback_required",
    receipt: confirmReceipt,
  };

  assert.equal(isMutationReceipt(estimateReceipt), true);
  assert.equal(isMutationReceipt(confirmReceipt), true);
  assert.equal(isMutationReceiptEnvelope(estimateEnvelope), true);
  assert.equal(isMutationReceiptEnvelope(confirmEnvelope), true);
  assert.equal(isMutationReceiptEnvelope({ ...estimateEnvelope, extra: true }), false);
  assert.equal(isMutationReceiptEnvelope({ outcome: estimateEnvelope.outcome }), false);
  assert.equal(isMutationReceiptEnvelope({ ...estimateEnvelope, outcome: "success" }), false);
  assert.equal(isMutationReceiptEnvelope({ ...estimateEnvelope, receipt: { ...estimateReceipt, extra: true } }), false);
  assert.equal(isMutationReceipt({ ...estimateReceipt, extra: true }), false);
  for (const field of [
    "action",
    "status",
    "batchId",
    "batchCode",
    "chargeId",
    "idempotencyKey",
    "payloadFingerprint",
  ]) {
    const missing = { ...estimateReceipt };
    delete missing[field];
    assert.equal(isMutationReceipt(missing), false, `missing ${field}`);
  }
  assert.equal(isMutationReceipt({ ...estimateReceipt, action: "save" }), false);
  assert.equal(isMutationReceipt({ ...estimateReceipt, status: "preview" }), false);
  assert.equal(isMutationReceipt({ ...estimateReceipt, chargeId: "" }), false);

  assert.equal(
    isMutationReceiptForCurrent(
      estimateReceipt,
      "estimate",
      batchId,
      batchCode,
      idempotencyKey,
      payloadFingerprint,
      null
    ),
    true
  );
  assert.equal(
    isMutationReceiptForCurrent(
      confirmReceipt,
      "confirm",
      batchId,
      batchCode,
      idempotencyKey,
      payloadFingerprint,
      chargeId
    ),
    true
  );
  assert.equal(
    isMutationReceiptForCurrent(
      { ...estimateReceipt, action: "confirm", status: "confirmed" },
      "estimate",
      batchId,
      batchCode,
      idempotencyKey,
      payloadFingerprint,
      null
    ),
    false,
    "action/status mismatch"
  );

  const mismatches = [
    ["batchId", { ...estimateReceipt, batchId: otherBatchId }],
    ["batchCode", { ...estimateReceipt, batchCode: "OTHER" }],
    ["idempotencyKey", { ...estimateReceipt, idempotencyKey: "other-key" }],
    ["payloadFingerprint", { ...estimateReceipt, payloadFingerprint: "other-fingerprint" }],
    ["chargeId", { ...estimateReceipt, chargeId: otherChargeId }],
  ];
  for (const [field, candidate] of mismatches) {
    assert.equal(
      isMutationReceiptForCurrent(
        candidate,
        "estimate",
        batchId,
        batchCode,
        idempotencyKey,
        payloadFingerprint,
        chargeId
      ),
      false,
      `${field} mismatch`
    );
  }
  assert.equal(
    isMutationReceiptForCurrent(
      { ...confirmReceipt, chargeId: otherChargeId },
      "confirm",
      batchId,
      batchCode,
      idempotencyKey,
      payloadFingerprint,
      chargeId
    ),
    false,
    "confirm chargeId mismatch"
  );
  assert.equal(
    isMutationReceiptForCurrent(
      { ...confirmReceipt, status: "estimated" },
      "confirm",
      batchId,
      batchCode,
      idempotencyKey,
      payloadFingerprint,
      chargeId
    ),
    false,
    "confirm expected status mismatch"
  );
});

test("canonical persisted estimate and confirm results adapt by identity only", () => {
  const batchId = "11111111-1111-4111-8111-111111111111";
  const batchCode = "BATCH-UI";
  const chargeId = "44444444-4444-4444-8444-444444444444";
  const idempotencyKey = "idempotency-1";
  const payloadFingerprint = "fingerprint-1";

  const canonical = (action, chargeIdentity = "chargeId") => {
    const status = action === "confirm" ? "confirmed" : "estimated";
    const charge = {
      batchId,
      batchCode,
      status,
      idempotencyKey,
      payloadFingerprint,
      amountNetCents: "not-a-money-value",
      amountGrossCents: -1,
      ...(chargeIdentity === "id" ? { id: chargeId } : { chargeId }),
    };
    return {
      status,
      batchId,
      batchCode,
      charge,
      revision: "revision-1",
      currency: "EUR",
      amountNetCents: "ignored",
      amountGrossCents: "ignored",
      candidateAllocationTotalCents: "ignored",
      lineProjections: "ignored",
    };
  };

  const estimate = extractCanonicalMutationReceipt(canonical("estimate"), "estimate");
  const confirm = extractCanonicalMutationReceipt(canonical("confirm", "id"), "confirm");
  const minimalConfirm = extractCanonicalMutationReceipt(
    {
      status: "confirmed",
      batchId,
      batchCode,
      charge: { id: chargeId, idempotencyKey, payloadFingerprint },
    },
    "confirm"
  );
  assert.deepEqual(JSON.parse(JSON.stringify(estimate)), {
    action: "estimate",
    status: "estimated",
    batchId,
    batchCode,
    chargeId,
    idempotencyKey,
    payloadFingerprint,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(confirm)), {
    action: "confirm",
    status: "confirmed",
    batchId,
    batchCode,
    chargeId,
    idempotencyKey,
    payloadFingerprint,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(minimalConfirm)), {
    action: "confirm",
    status: "confirmed",
    batchId,
    batchCode,
    chargeId,
    idempotencyKey,
    payloadFingerprint,
  });
  assert.equal(
    isMutationReceiptForCurrent(
      estimate,
      "estimate",
      batchId,
      batchCode,
      idempotencyKey,
      payloadFingerprint,
      null
    ),
    true
  );
  assert.equal(
    isMutationReceiptForCurrent(
      confirm,
      "confirm",
      batchId,
      batchCode,
      idempotencyKey,
      payloadFingerprint,
      chargeId
    ),
    true
  );

  assert.equal(extractCanonicalMutationReceipt(canonical("estimate"), "confirm"), null);
  assert.equal(extractCanonicalMutationReceipt({ ...canonical("estimate"), batchId: undefined }, "estimate"), null);
  assert.equal(extractCanonicalMutationReceipt({ ...canonical("estimate"), batchCode: undefined }, "estimate"), null);
  assert.equal(extractCanonicalMutationReceipt({ ...canonical("estimate"), status: "confirmed" }, "estimate"), null);
  assert.equal(extractCanonicalMutationReceipt({ ...canonical("estimate"), charge: null }, "estimate"), null);
  assert.equal(
    extractCanonicalMutationReceipt(
      { ...canonical("estimate"), charge: { ...canonical("estimate").charge, batchCode: "OTHER" } },
      "estimate"
    ),
    null
  );
  assert.equal(
    extractCanonicalMutationReceipt(
      { ...canonical("estimate"), charge: { ...canonical("estimate").charge, status: "confirmed" } },
      "estimate"
    ),
    null
  );
  assert.equal(
    extractCanonicalMutationReceipt(
      { ...canonical("estimate"), charge: { ...canonical("estimate").charge, idempotencyKey: "" } },
      "estimate"
    ),
    null
  );
  assert.equal(
    extractCanonicalMutationReceipt(
      { ...canonical("estimate"), charge: { ...canonical("estimate").charge, payloadFingerprint: undefined } },
      "estimate"
    ),
    null
  );
  assert.equal(
    extractCanonicalMutationReceipt(
      { ...canonical("estimate"), charge: { ...canonical("estimate").charge, chargeId: "", id: chargeId } },
      "estimate"
    ),
    null
  );
});

test("mutation error and readback helpers fail closed on uncertain writes and mismatches", () => {
  assert.equal(classifyMutationError(500, "ADMIN_SUPPLIER_BATCH_COST_CONFIRM_UNAVAILABLE"), "unknown_write");
  assert.equal(classifyMutationError(502, null), "unknown_write");
  assert.equal(classifyMutationError(400, null), "unknown_write");
  assert.equal(classifyMutationError(400, "ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE"), "unknown_write");
  assert.equal(classifyMutationError(400, "ADMIN_SUPPLIER_BATCH_COST_V2_RPC_INVALID_RESPONSE"), "unknown_write");
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
  assert.match(panelSource, /formatSupplierBatchLineLandedCost/);
  assert.match(panelSource, /originalComparable \? costs\.landedLineCostCents : costs\.landedLineCostEurCents/);
  assert.match(panelSource, /originalComparable \? batchCurrency : "EUR"/);
  assert.match(panelSource, /rawWeight[\s\S]{0,260}weightGram === null/);
});

test("permission and charges-export contract stays explicit in the panel", () => {
  assert.match(panelSource, /resolveSupplierBatchCostPermissions\(\s*permissions,\s*permissionsLoaded\s*\)/);
  assert.match(panelSource, /const canManageSupplierBatchCosts = supplierBatchCostPermissions\.canManage/);
  assert.match(panelSource, /canRead|supplier_batch\.read/);
  assert.match(panelSource, /canEstimateCosts/);
  assert.match(panelSource, /canConfirmCosts/);
  assert.match(panelSource, /canCorrectCosts/);
  assert.match(panelSource, /canExportCosts/);
  assert.match(panelSource, /supplier_batch\.manage_costs/);
  assert.match(panelSource, /type SupplierBatchExportScope = "batches" \| "lines" \| "charges"/);
  assert.match(panelSource, /onDownload\("charges",/);
  assert.match(panelSource, /onAddCharge=\{(?:canManageSupplierBatchCosts|canEstimateSupplierBatchCosts)\s*\?/);
  assert.match(panelSource, /canCancelCosts/);
  assert.match(panelSource, /charges\/cancel/);
  assert.match(panelSource, /onCorrectCharge/);
  assert.match(panelSource, /SupplierBatchTransportCostCard/);
  assert.match(panelSource, /onExportCharges=/);
  assert.match(panelSource, /onCostChanged=\{refreshSupplierBatchCost\}/);
  assert.match(panelSource, /const canEstimateSupplierBatchCosts = supplierBatchCostPermissions\.canEstimate/);
  assert.match(panelSource, /const canConfirmSupplierBatchCosts = supplierBatchCostPermissions\.canConfirm/);
  assert.match(panelSource, /const canCorrectSupplierBatchCosts = supplierBatchCostPermissions\.canCorrect/);
  assert.match(panelSource, /const canExportSupplierBatchCosts = supplierBatchCostPermissions\.canExport/);
  assert.match(panelSource, /const canCancelSupplierBatchCosts = canEstimateSupplierBatchCosts/);
  assert.match(panelSource, /canEstimateCosts=\{canEstimateSupplierBatchCosts\}/);
  assert.match(panelSource, /canCancelCosts=\{canCancelSupplierBatchCosts\}/);
  assert.match(panelSource, /canConfirmCosts=\{canConfirmSupplierBatchCosts\}/);
  assert.match(panelSource, /canCorrectCosts=\{canCorrectSupplierBatchCosts\}/);
  assert.match(panelSource, /canExportCosts=\{canExportSupplierBatchCosts\}/);
  assert.match(panelSource, /const refreshSupplierBatchCost = React\.useCallback\([\s\S]{0,700}Promise<AdminSupplierBatchDetail>[\s\S]{0,200}Promise\.all\([\s\S]{0,240}fetchAdminSupplierBatchDetail\(batchCode, canReadSupplierBatchHistory, signal\)[\s\S]{0,240}refreshSupplierBatches\(signal, \{ clearNotice: false \}\)/);
  assert.match(panelSource, /async function fetchAdminSupplierBatchDetail\(\s*batchCode: string,\s*canReadHistory = false,\s*signal\?: AbortSignal\s*\)/);
  assert.match(panelSource, /fetch\([\s\S]{0,260}signal,\s*\}\s*\)/);
  assert.match(panelSource, /return nextDetail/);
  assert.match(panelSource, /if \(options\.clearNotice === false\) \{\s*throw error;/);
  assert.match(panelSource, /canExportCosts && canReadHistory \? \(format\) => void onDownload\(batch, "charges", format\)/);
  assert.doesNotMatch(panelSource, /charges\/(?:preview|estimate|confirm)/);
});

test("supplier batch filters use namespaced URL state and strict API keys", () => {
  for (const key of [
    "batchQ",
    "batchSupplier",
    "batchCurrency",
    "batchCostStatus",
    "batchChargeType",
    "batchVatTreatment",
    "batchHasTransport",
    "batchSort",
  ]) {
    assert.match(panelSource, new RegExp(`searchParams\\.get\\("${key}"\\)`));
    assert.match(panelSource, new RegExp(`setOrDelete\\("${key}"`));
  }

  const searchParamsStart = panelSource.indexOf("function supplierBatchSearchParams(");
  assert.notEqual(searchParamsStart, -1);
  const searchParamsSource = panelSource.slice(searchParamsStart, panelSource.indexOf("\n}\n\nasync function downloadResponseBlob", searchParamsStart));
  for (const key of [
    'params.set("q", filters.q.trim())',
    'params.set("supplier", filters.supplier.trim())',
    'params.set("currency", filters.currency)',
    'params.set("costStatus", filters.costStatus)',
    'params.set("chargeType", filters.chargeType)',
    'params.set("vatTreatment", filters.vatTreatment)',
    'params.set("hasTransport", filters.hasTransport)',
    'params.set("sort", filters.sort)',
  ]) {
    assert.match(searchParamsSource, new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(searchParamsSource, /batchQ|batchSupplier|batchCurrency|batchCostStatus|batchChargeType|batchVatTreatment|batchHasTransport|batchSort/);
});

test("supplier batch mobile UI keeps advanced filters in an applied Sheet", () => {
  assert.match(panelSource, /group-data-horizontal\/tabs:h-auto[\s\S]{0,180}grid-cols-2[\s\S]{0,180}sm:grid-cols-4/);
  assert.match(panelSource, /className="hidden flex-wrap gap-2 sm:flex"/);
  assert.match(panelSource, /className="flex w-full gap-2 sm:hidden"/);
  assert.match(panelSource, /<BatchMobileExportMenu[\s\S]{0,420}onDownloadTemplate={onDownloadTemplate}/);
  assert.match(panelSource, /className="h-11 w-full bg-white text-base"/);
  assert.match(panelSource, /formatAdminMessage\(copy\.filterCount, \{ count: activeFilterCount \}\)/);
  assert.match(panelSource, /<SupplierBatchMobileFiltersSheet/);
  assert.match(panelSource, /onApply={onChange}/);
  assert.match(panelSource, /function SupplierBatchMobileFiltersSheet\(/);
  assert.match(panelSource, /showCloseButton={false}/);
  assert.match(panelSource, /side="bottom"/);
  assert.match(panelSource, /min-h-11[^\n]*text-base/);
  assert.match(panelSource, /\{copy\.dateFrom\}[\s\S]{0,180}id="supplier-batch-mobile-date-from"/);
  assert.match(panelSource, /\{copy\.dateTo\}[\s\S]{0,180}id="supplier-batch-mobile-date-to"/);
  assert.match(panelSource, /setDraftFilters\(defaultSupplierBatchFilters\(\)\)/);
  assert.match(panelSource, /onApply\(draftFilters\);\s*onOpenChange\(false\)/);
  assert.match(panelSource, /copy\.clearFilters/);
  assert.match(panelSource, /line-clamp-2 break-words[^\n]*\[overflow-wrap:anywhere\]/);
  assert.match(panelSource, /label=\{copy\.costStatus\}[\s\S]{0,260}copy\.costStatusLabels\[batch\.costSummary\.costStatus\]/);
});

test("support widget fails closed on admin client navigations", () => {
  assert.match(supportSource, /import { usePathname } from "next\/navigation"/);
  assert.match(supportSource, /const pathname = usePathname\(\)/);
  assert.match(supportSource, /pathname === "\/admin" \|\| pathname\.startsWith\("\/admin\/"\)/);
  assert.match(supportSource, /const shouldRender = scope === "storefront" && !isAdminPath/);
  assert.match(supportSource, /useSupportActionBarOffset\(shouldRender\)/);
  assert.match(supportSource, /if \(!shouldRender\) \{\s*return null/);
});

test("transport cost dialog is lazy and mounts only while open", () => {
  assert.doesNotMatch(
    panelSource,
    /import\s+\{\s*SupplierBatchTransportCostDialog\s*\}\s+from\s+["']\.\/supplier-batch-transport-cost-dialog["']/
  );

  const dynamicStart = panelSource.indexOf(
    "const SupplierBatchTransportCostDialog = dynamic("
  );
  assert.notEqual(dynamicStart, -1);
  const dynamicSource = panelSource.slice(
    dynamicStart,
    panelSource.indexOf("const adminProductsEndpoint", dynamicStart)
  );
  assert.match(dynamicSource, /import\("\.\/supplier-batch-transport-cost-dialog"\)/);
  assert.match(
    dynamicSource,
    /module\)\s*=>\s*module\.SupplierBatchTransportCostDialog/
  );
  assert.match(
    dynamicSource,
    /loading:\s*\(\)\s*=>\s*<SupplierBatchTransportCostDialogLoading\s*\/>/
  );
  assert.match(dynamicSource, /ssr:\s*false/);
  assert.match(dynamicSource, /role="status"/);

  const mountStart = panelSource.indexOf(
    "{detail && isCostDialogOpen ? (\n        <SupplierBatchTransportCostDialog"
  );
  assert.notEqual(mountStart, -1);
  const mountEnd = panelSource.indexOf("      ) : null}", mountStart);
  assert.notEqual(mountEnd, -1);
  const mountSource = panelSource.slice(mountStart, mountEnd);
  assert.match(mountSource, /open=\{isCostDialogOpen\}/);
  assert.match(mountSource, /onOpenChange=\{\(nextOpen\) => \{/);
  assert.match(mountSource, /setIsCostDialogOpen\(nextOpen\)/);
  assert.match(mountSource, /if \(!nextOpen\) setEditingCharge\(null\)/);
  assert.doesNotMatch(
    panelSource,
    /\{detail \? \(\s*<SupplierBatchTransportCostDialog/
  );
});

test("transport cost dialog keeps intentional responsive widths and the simplified three-step flow", () => {
  const dialogContentClasses = [...dialogSource.matchAll(
    /<DialogContent aria-modal=\{true\} className="([^"]+)">/g
  )].map((match) => match[1]);
  assert.equal(dialogContentClasses.length, 3);

  const [mainDialogClass, confirmDialogClass, closeGuardClass] = dialogContentClasses;
  assert.match(mainDialogClass, /w-\[calc\(100vw-1rem\)\]/);
  assert.match(mainDialogClass, /sm:w-\[calc\(100vw-2rem\)\]/);
  assert.match(mainDialogClass, /sm:max-w-6xl/);
  assert.doesNotMatch(mainDialogClass, /sm:max-w-sm/);
  assert.match(mainDialogClass, /max-h-\[94dvh\]/);
  assert.match(mainDialogClass, /overflow-hidden/);
  assert.match(confirmDialogClass, /sm:max-w-lg/);
  assert.match(closeGuardClass, /sm:max-w-md/);
  assert.match(dialogSource, /<section className="rounded-lg border border-slate-200\/80 bg-slate-50\/50 p-3 sm:p-4" aria-labelledby="supplier-cost-step-1">/);
  assert.match(dialogSource, /<div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">/);
  assert.match(dialogSource, /<section className="mt-4 rounded-lg border border-slate-200\/80 bg-white p-3 sm:p-4" aria-labelledby="supplier-cost-step-2">/);
  assert.match(dialogSource, /<div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-3">/);
  assert.match(dialogSource, /<details[\s\S]{0,180}open=\{advancedOpen \|\| hasAdvancedFieldErrors\}[\s\S]{0,180}onToggle=\{\(event\) => setAdvancedOpen\(event\.currentTarget\.open\)\}/);
  assert.match(dialogSource, /<summary className="cursor-pointer list-none/);
  assert.match(dialogSource, /id="supplier-cost-step-1"[\s\S]{0,180}\{text\.step1Title\}/);
  assert.match(dialogSource, /id="supplier-cost-step-2"[\s\S]{0,180}\{text\.step2Title\}/);
  assert.match(dialogSource, /\{text\.step3Title\}/);
  assert.match(dialogSource, /step1Title: "1\. 填写账单"/);
  assert.match(dialogSource, /step2Title: "2\. 确认计入商品成本"/);
  assert.match(dialogSource, /step3Title: "3\. 补充凭证（选填）"/);
  assert.match(dialogSource, /step1Title: "1\. Inserisci la fattura"/);
  assert.match(dialogSource, /step2Title: "2\. Conferma il costo della merce"/);
  assert.match(dialogSource, /step3Title: "3\. Dati aggiuntivi \(facoltativi\)"/);
  assert.match(dialogSource, /amountNet: "未税金额"/);
  assert.match(dialogSource, /gross: "含税总额（自动）"/);
  assert.match(dialogSource, /capitalizedAmount: "计入商品成本"/);
  assert.match(dialogSource, /vatTreatment: "税额能否抵扣"/);
  assert.match(dialogSource, /allocationMethod: "怎么分到商品"/);
  assert.match(dialogSource, /amountNet: "Importo netto"/);
  assert.match(dialogSource, /gross: "Totale lordo \(automatico\)"/);
  assert.match(dialogSource, /capitalizedAmount: "Costo incluso nella merce"/);
  assert.match(dialogSource, /vatTreatment: "IVA recuperabile\?"/);
  assert.match(dialogSource, /allocationMethod: "Come ripartire sui prodotti"/);
  assert.match(dialogSource, /\{text\.useNetAmount\}/);
  assert.match(dialogSource, /\{text\.useGrossAmount\}/);
  assert.match(dialogSource, /if \(parsedAmountNet\.cents !== null\) updateField\("capitalizedAmount", formatCentsForInput\(parsedAmountNet\.cents\)\)/);
  assert.match(dialogSource, /if \(grossCents !== null\) updateField\("capitalizedAmount", formatCentsForInput\(grossCents\)\)/);
  assert.match(dialogSource, /disabled=\{actionDisabled \|\| !canUseNetAmount\}/);
  assert.match(dialogSource, /disabled=\{actionDisabled \|\| !canUseGrossAmount\}/);
  assert.match(dialogSource, /const showZeroCostReason = parsedCapitalizedAmount\.cents === 0 \|\| Boolean\(fieldErrors\.zeroCostReason\)/);
  assert.match(dialogSource, /\{showZeroCostReason \? \(/);
  assert.match(dialogSource, /const \[advancedOpen, setAdvancedOpen\] = React\.useState\(false\)/);
  assert.match(dialogSource, /const hasAdvancedFieldErrors = \["carrierName", "reference", "occurredAt", "evidenceUrl", "notes"\]/);
  assert.match(dialogSource, /isCorrectionMode \|\|[\s\S]{0,160}next\.form\.carrierName\.trim\(\)/);
  assert.match(dialogSource, /\["carrierName", "reference", "occurredAt", "evidenceUrl", "notes"\]/);
  assert.match(dialogSource, /\{text\.capitalizedHelp\}/);
  assert.match(dialogSource, /不改变售价和库存/);
  assert.match(dialogSource, /non-EUR/);
  assert.match(dialogSource, /id="carrier-name"/);
  assert.match(dialogSource, /id="reference"/);
  assert.match(dialogSource, /id="occurred-at"/);
  assert.match(dialogSource, /id="evidence-url"/);
  assert.match(dialogSource, /id="notes"/);
  assert.match(dialogSource, /\{text\.nextStep\}/);
  assert.match(dialogSource, /nextStep: "下一步：查看分摊结果"/);
  assert.match(dialogSource, /nextStep: "Avanti: verifica ripartizione"/);
  assert.match(dialogSource, /<DialogFooter className="m-0 rounded-none border-t/);
  assert.match(dialogSource, /className="bg-slate-100 text-slate-700" value=\{grossCents/);
  assert.match(dialogSource, /text-xs font-semibold leading-5 text-slate-700/);
  assert.match(dialogSource, /text-\[11px\] leading-4 text-slate-500/);
  assert.match(dialogSource, /text-\[11px\] font-semibold leading-4 text-red-700/);
});

test("card exposes compact display components and status-only charge semantics", () => {
  assert.match(cardSource, /export function SupplierBatchCostSummaryCompact/);
  assert.match(cardSource, /export function SupplierBatchLineCostCompact/);
  assert.match(cardSource, /export function SupplierBatchTransportCostCard/);
  assert.match(cardSource, /charge\.status === "estimated"[\s\S]{0,140}canEstimate[\s\S]{0,120}copy\.editableCharge[\s\S]{0,100}copy\.estimatedCharge/);
  assert.match(cardSource, /SupplierBatchCostExportMenu/);
  assert.match(cardSource, /onExport\("csv"\)/);
  assert.match(cardSource, /onExport\("xlsx"\)/);
  assert.match(cardSource, /copy\.carrier/);
  assert.match(cardSource, /copy\.reference/);
  assert.match(cardSource, /copy\.date/);
  assert.doesNotMatch(cardSource, /supplier_batch\.manage_costs/);
  assert.match(cardSource, /onAddCharge/);
  assert.match(cardSource, /onEditCharge/);
  assert.match(cardSource, /charge\.status === "estimated" && canEstimateCosts/);
  assert.match(cardSource, /onCancelCharge/);
  assert.match(cardSource, /onCorrectCharge/);
  assert.match(cardSource, /isSupplierBatchCorrectionReplacement/);
  assert.match(cardSource, /correctionApplied/);
  assert.match(cardSource, /correctionPending/);
  assert.match(cardSource, /entry\.links\?\.originalChargeId/);
  assert.match(cardSource, /entry\.links\?\.replacementChargeId/);
  assert.match(cardSource, /copy\.correctionLink/);
  assert.match(cardSource, /canExportCosts/);
  assert.match(cardSource, /export function formatSupplierBatchUnitCost/);
  assert.match(cardSource, /formatSupplierBatchUnitMoney\(costs\.landedUnitCost, display\.currency/);
  assert.match(dialogSource, /formatPreviewLineUnit\(line, line\.currentLandedUnitCost, line\.currentLandedUnitCostEur, language, previewCurrency\)/);
  assert.doesNotMatch(dialogSource, /export function formatSupplierBatchUnitCost/);

  const compactSource = cardSource.slice(
    cardSource.indexOf("export function SupplierBatchCostSummaryCompact"),
    cardSource.indexOf("export function SupplierBatchLineCostCompact")
  );
  assert.doesNotMatch(compactSource, /goodsValue/);
  assert.match(cardSource, /\{canReadCosts \? \(/);
});

test("dialog B2 contract gates mutations on current preview and server readback", () => {
  assert.match(dialogSource, /supplierBatchChargePreviewSchemaV2\.safeParse\(payload\)/);
  assert.match(dialogSource, /supplierBatchChargeEstimateSchemaV2\.safeParse\(payload\)/);
  assert.match(dialogSource, /supplierBatchChargeConfirmSchemaV2\.safeParse\(payload\)/);
  assert.match(dialogSource, /supplierBatchChargeCorrectSchemaV2\.safeParse\(payload\)/);
  assert.match(dialogSource, /charges\/preview/);
  assert.match(dialogSource, /charges\/estimate/);
  assert.match(dialogSource, /charges\/confirm/);
  assert.match(dialogSource, /charges\/correct/);
  assert.match(dialogSource, /mode=correction/);
  assert.match(dialogSource, /normalizeSupplierBatchCorrectionReceipt/);
  assert.match(dialogSource, /kind: "correction_receipt"/);
  assert.match(dialogSource, /isSupplierBatchCorrectionReceiptForCurrent/);
  assert.match(dialogSource, /classifySupplierBatchCorrectionReadback/);
  assert.match(dialogSource, /classifySupplierBatchCorrectionReadbackByContext/);
  assert.match(dialogSource, /correction_pending/);
  assert.match(dialogSource, /canCorrectSupplierBatchCharge/);
  assert.match(dialogSource, /replacementChargeId/);
  assert.match(dialogSource, /correctionPending/);
  assert.match(dialogSource, /correctionCurrentAllocation/);
  assert.match(dialogSource, /correctionCandidateAllocation/);
  assert.match(dialogSource, /correctionCurrentLandedLine/);
  assert.match(dialogSource, /correctionProjectedLandedLine/);
  assert.match(dialogSource, /correctionOtherTotal/);
  assert.match(dialogSource, /correctionBeforeTotal/);
  assert.match(dialogSource, /correctionAfterTotal/);
  assert.match(dialogSource, /correctionCostDelta/);
  assert.match(dialogSource, /formatCorrectionPreviewEurCents/);
  assert.match(dialogSource, /formatCorrectionPreviewLineCents/);
  assert.match(dialogSource, /formatPreviewLineCents/);
  assert.match(dialogSource, /formatPreviewLineUnit/);
  assert.match(dialogSource, /line\.originalCurrencyComparable === false/);
  assert.match(dialogSource, /formatSupplierBatchCents\(eurCents, "EUR"/);
  assert.doesNotMatch(dialogSource, /已排除原费用/);
  assert.doesNotMatch(dialogSource, /costo originale escluso/);
  assert.match(dialogSource, /normalizeSupplierBatchCostRpcResult\(data\)/);
  assert.match(dialogSource, /isSupplierBatchMutationReceiptEnvelope\(data\)/);
  assert.match(dialogSource, /data\.outcome === "persisted_readback_required"/);
  assert.match(dialogSource, /extractSupplierBatchMutationReceiptFromCanonicalResult\(data, action\)/);
  assert.match(dialogSource, /looksLikeSupplierBatchCanonicalMutationResult\(data\)/);
  assert.match(dialogSource, /kind: "invalid_receipt"/);
  assert.match(dialogSource, /isSupplierBatchMutationReceiptForCurrent/);
  assert.match(dialogSource, /readbackChargeId/);
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
  assert.match(dialogSource, /setPersistedKnownSuccess\(persistedContext\);[\s\S]{0,180}setPending\("refresh"\)/);
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
  assert.match(dialogSource, /pending === "estimate" \|\| pending === "confirm" \|\| pending === "correct" \|\| pending === "refresh"/);
  assert.match(dialogSource, /persistedKnownSuccess !== null \|\| uncertainMutation !== null/);
  assert.match(dialogSource, /setFieldErrors\(\{\}\)/);
  assert.match(dialogSource, /formatSupplierBatchCostLineLabel/);
  assert.match(dialogSource, /manual-allocations-error/);
  assert.match(dialogSource, /isSupplierBatchEvidenceUrl/);
  assert.match(dialogSource, /buildSupplierBatchFieldAriaDescribedBy/);
  assert.match(dialogSource, /chargeIsReadOnly/);
  assert.match(dialogSource, /charge\.status !== "estimated"/);
  assert.match(dialogSource, /mode === "correction"/);
  assert.match(dialogSource, /correctionReason/);
  assert.match(dialogSource, /canCorrectCosts/);
  assert.match(dialogSource, /aria-modal=\{true\}/);
  assert.match(dialogSource, /draftGuard/);
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
  assert.match(dialogSource, /runMutation\("correct"\)/);
  assert.match(dialogSource, /if \(openRef\.current\) onOpenChange\(false\)/);
  assert.match(dialogSource, /if \(mutationResponse\.kind === "receipt"\)/);
  assert.match(dialogSource, /if \(mutationResponse\.kind === "correction_receipt"\)/);
  assert.match(dialogSource, /mutationResponse\.receipt\.chargeId/);
  const postMutationParser = dialogSource.slice(
    dialogSource.indexOf("async function postMutation"),
    dialogSource.indexOf("  type SupplierBatchReadbackFailure")
  );
  assert.ok(
    postMutationParser.indexOf("extractSupplierBatchMutationReceiptFromCanonicalResult(data, action)") <
      postMutationParser.indexOf("normalizeSupplierBatchCostRpcResult(data)"),
    "canonical identity adapter must run before the full result normalizer"
  );
  const canonicalAdapter = dialogSource.slice(
    dialogSource.indexOf("export function extractSupplierBatchMutationReceiptFromCanonicalResult"),
    dialogSource.indexOf("function looksLikeSupplierBatchCanonicalMutationResult")
  );
  assert.doesNotMatch(canonicalAdapter, /Cents/);
  const mutationFunction = dialogSource.slice(
    dialogSource.indexOf("async function runMutation"),
    dialogSource.indexOf("async function retryRefresh")
  );
  assert.doesNotMatch(mutationFunction, /runMutation\("confirm"\)/);

  const knownSuccessReadback = dialogSource.slice(
    dialogSource.indexOf("// The mutation response is authoritative enough"),
    dialogSource.indexOf("    } catch (cause) {", dialogSource.indexOf("// The mutation response is authoritative enough"))
  );
  assert.match(knownSuccessReadback, /setPersistedKnownSuccess\(persistedContext\)/);
  assert.match(knownSuccessReadback, /readback\.outcome === "matched" \|\| readback\.outcome === "correction_pending"[\s\S]{0,220}reset\(\)/);
  assert.match(knownSuccessReadback, /READBACK_IDEMPOTENCY_CONFLICT/);
  assert.match(knownSuccessReadback, /READBACK_NOT_FOUND/);
  assert.doesNotMatch(knownSuccessReadback, /setUncertainMutation/);

  const receiptReadback = dialogSource.slice(
    dialogSource.indexOf('if (mutationResponse.kind === "receipt")'),
    dialogSource.indexOf("      // The mutation response is authoritative enough")
  );
  assert.match(receiptReadback, /isSupplierBatchMutationReceiptForCurrent/);
  assert.match(receiptReadback, /readbackChargeId: mutationResponse\.receipt\.chargeId/);
  assert.doesNotMatch(receiptReadback, /postMutation\(/);
  assert.doesNotMatch(receiptReadback, /runMutation\(/);

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
  assert.match(refreshRetryFunction, /readback\.outcome === "matched" \|\| readback\.outcome === "correction_pending"[\s\S]{0,180}reset\(\)/);
  assert.doesNotMatch(refreshRetryFunction, /postMutation\(/);
  assert.doesNotMatch(refreshRetryFunction, /runMutation\(/);
  assert.match(refreshRetryFunction, /READBACK_IDEMPOTENCY_CONFLICT/);
  assert.match(refreshRetryFunction, /READBACK_INVALID/);
  assert.match(refreshRetryFunction, /READBACK_NOT_FOUND/);
  assert.doesNotMatch(refreshRetryFunction, /setUncertainMutation/);
  assert.match(dialogSource, /persistedKnownSuccess !== null \|\| uncertainMutation !== null/);
  assert.match(dialogSource, /if \(!nextOpen && \(mutationActiveRef\.current \|\| mutationPending \|\| persistedKnownSuccess !== null \|\| uncertainMutation !== null\)\)/);
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

function assertPermissionState(permissions, permissionsLoaded, expected) {
  const actual = resolvePermissions(permissions, permissionsLoaded);
  for (const [capability, value] of Object.entries(expected)) {
    assert.equal(actual[capability], value, `${capability} should match for ${permissions.join(", ") || "no permissions"}`);
  }
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
