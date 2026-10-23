import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as ts from "typescript";
import { runOrderWriteAndRefresh, orderQueryParams, combinePackingSlipDocuments } from "../src/lib/admin-orders-operation.mjs";

const source = readFileSync(new URL("../src/components/partspro/admin-orders-panel.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("orders.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function evaluate(body, globals) {
  const code = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Number, ...globals });
  return exports.handler;
}
function componentFunction(component, name, globals) {
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === component);
  let selected;
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) selected = node; ts.forEachChild(node, visit); }
  visit(fn.body);
  return evaluate(selected.getText(ast) + `\nexport const handler = ${name};`, globals);
}
function componentArrow(component, name, globals) {
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === component);
  let selected;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) selected = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(fn.body);
  return evaluate(`export const handler = ${selected.getText(ast)};`, globals);
}

test("400, 403 and timeout leave writes unacknowledged and do not trigger a read or retry", async () => {
  for (const message of ["HTTP 400", "HTTP 403", "Timeout"]) {
    let writes = 0, reads = 0, saved = 0;
    const result = await runOrderWriteAndRefresh(async () => { writes += 1; throw Error(message); }, async () => { reads += 1; }, () => { saved += 1; });
    assert.equal(result.ok, false); assert.equal(result.error, message);
    assert.equal(writes, 1); assert.equal(reads, 0); assert.equal(saved, 0);
  }
});

test("successful write plus failed read remains saved and never replays the write", async () => {
  let writes = 0, saved;
  const record = { id: "order", paymentStatus: "paid" };
  const result = await runOrderWriteAndRefresh(async () => { writes += 1; return record; }, async () => { throw Error("Detail unavailable"); }, value => { saved = value; });
  assert.equal(result.ok, true); assert.equal(result.refreshError, "Detail unavailable"); assert.equal(saved, record); assert.equal(writes, 1);
});

test("payment editor preserves dialog and amount draft after rejected save, closes only on committed save", async () => {
  for (const outcome of [{ ok: false, error: "HTTP 400" }, { ok: false, error: "HTTP 403" }, { ok: false, error: "Timeout" }, { ok: true, refreshError: "GET failed" }]) {
    let closed = false, error = "", submitted;
    const handler = componentFunction("OrderPaymentMethodCard", "handleReconciliationSubmit", {
      canSaveReconciliation: true, order: { id: "order" }, reconciliationMethodDraft: "cash", statusDraft: "paid", amountValue: 12.5,
      receivedAtDraft: "2026-10-10T12:30", referenceDraft: "REF", noteDraft: "note",
      setFormError: value => { error = value; }, setDialogOpen: value => { closed = !value; },
      onUpdatePayment: async (_order, body) => { submitted = body; return outcome; },
    });
    await handler({ preventDefault() {} });
    assert.equal(submitted.receivedAmount, 12.5); assert.equal(submitted.reference, "REF");
    assert.equal(closed, outcome.ok); assert.equal(error, outcome.ok ? "" : outcome.error);
  }
});

test("shipping editor keeps reason and dialog after rejected save", async () => {
  let closed = false, error = "", submitted;
  const handler = componentArrow("OrderLogisticsCard", "handleShippingAdjustmentSubmit", {
    canSaveShippingAdjustment: true, shippingAmountValue: 8, shippingReasonDraft: "Carrier invoice", shippingNoteDraft: "note", order: { id: "order" },
    setFormError: value => { error = value; }, setShippingDialogOpen: value => { closed = !value; },
    onAdjustShipping: async (_order, body) => { submitted = body; return { ok: false, error: "HTTP 403" }; },
  });
  await handler({ preventDefault() {} });
  assert.equal(closed, false); assert.equal(error, "HTTP 403"); assert.equal(submitted.reason, "Carrier invoice"); assert.equal(submitted.shippingAmount, 8);
});

test("shortage editor keeps the selected line and reason on timeout", async () => {
  let cleared = false, error = "", submitted;
  const handler = componentArrow("OrderLines", "submitEditor", {
    editingLine: { id: "line", quantity: 5 }, order: { id: "order" }, actualQuantity: "3", reason: "Missing stock",
    normalizeActualLineQuantity: value => Number(value), setEditingLine: value => { cleared = value === null; }, setFormError: value => { error = value; },
    onUpdateLineFulfillment: async (_order, _line, body) => { submitted = body; return { ok: false, error: "Timeout" }; },
  });
  await handler(); assert.equal(cleared, false); assert.equal(error, "Timeout"); assert.equal(submitted.actualQuantity, 3); assert.equal(submitted.reason, "Missing stock");
});

test("search, exact customer, date and chosen sort are preserved when paging", () => {
  const params = orderQueryParams({ q: " ORDER-051 ", customerId: "customer", dateFrom: "2026-10-01", dateTo: "2026-10-10", sort: "date_asc", status: "all" }, 3, 20);
  assert.equal(params.get("offset"), "40"); assert.equal(params.get("q"), "ORDER-051"); assert.equal(params.get("customerId"), "customer"); assert.equal(params.get("dateFrom"), "2026-10-01"); assert.equal(params.get("sort"), "date_asc"); assert.equal(params.has("status"), false);
});

test("five order documents produce one preview with five complete page sections", () => {
  const html = combinePackingSlipDocuments(Array.from({ length: 5 }, (_, index) => `<html><head><style>.sheet{color:black}</style></head><body><main class="sheet">ORDER-${index + 1}</main></body></html>`));
  assert.equal((html.match(/class="print-page"/g) ?? []).length, 5);
  for (let index = 1; index <= 5; index += 1) assert.ok(html.includes(`ORDER-${index}`));
  assert.match(html, /break-after: page/); assert.throws(() => combinePackingSlipDocuments(["<html>invalid</html>"]), /could not be prepared/);
});

test("read-only list actions open details without requesting a write", async () => {
  let opened = "", writes = 0;
  const quick = componentArrow("AdminOrdersPanel", "handleQuickTransition", {
    canManageOrders: false, handleOpenOrder: id => { opened = id; }, handleTransition: () => { writes += 1; }, getOrderTransition: () => { throw Error("Read-only cannot derive a write action"); }, text: {},
  });
  await quick({ id: "read-only-order" }); assert.equal(opened, "read-only-order"); assert.equal(writes, 0);
  const transition = componentArrow("AdminOrdersPanel", "handleTransition", { canManageOrders: false, patchOrder: () => { writes += 1; }, labels: { status: {} } });
  await transition({ id: "read-only-order" }, "accepted", "saved"); assert.equal(writes, 0);
});

test("explicit linked stage and customer override restored filters before the first list request", async () => {
  const { orderDeepLinkFilters } = await import("../src/lib/admin-orders-operation.mjs");
  const linked = orderDeepLinkFilters({ status: "submitted", paymentStatus: "open", stockRisk: "blocked", reservation: "overdue", view: "payments", q: "old search", dateFrom: "2026-01-01", dateTo: "2026-01-03", sort: "total_desc" }, { focusStatus: "completed", customerId: "exact-customer", focusOrderId: "exact-order" });
  const params = orderQueryParams(linked, 1, 20);
  assert.equal(params.get("status"), "completed"); assert.equal(params.get("customerId"), "exact-customer"); assert.equal(params.get("sort"), "date_desc");
  for (const key of ["paymentStatus", "stockRisk", "reservation", "view", "q", "dateFrom", "dateTo"]) assert.equal(params.has(key), false, key);
});

test("shared detail tabs keep the active section while an order mutation is pending", () => {
  let changes = 0;
  const select = componentArrow("OrderDetailsPanel", "handleMobileSectionChange", {
    orderId: "order", pendingActionKey: "order:payment", presentation: { unsaved: "Discard?" },
    document: { querySelector: () => null }, window: { confirm: () => { throw Error("Must not prompt during a write"); } },
    setMobileSectionState: () => { changes += 1; },
  });
  select("lines");
  assert.equal(changes, 0);
});

test("shared detail tabs preserve unsaved form drafts unless the user discards them", () => {
  for (const accepted of [false, true]) {
    let section = null, prompts = 0;
    const select = componentArrow("OrderDetailsPanel", "handleMobileSectionChange", {
      orderId: "order", pendingActionKey: null, presentation: { unsaved: "Discard?" },
      document: { querySelector: () => ({}) }, window: { confirm: () => { prompts += 1; return accepted; } },
      setMobileSectionState: value => { section = value; },
    });
    select("history");
    assert.equal(prompts, 1);
    assert.equal(section?.section ?? null, accepted ? "history" : null);
  }
});

test("shared detail tabs switch without prompting when there is no unsaved draft", () => {
  let section;
  const select = componentArrow("OrderDetailsPanel", "handleMobileSectionChange", {
    orderId: "order", pendingActionKey: null, presentation: { unsaved: "Discard?" },
    document: { querySelector: () => null }, window: { confirm: () => { throw Error("No draft"); } },
    setMobileSectionState: value => { section = value; },
  });
  select("payment");
  assert.equal(section.orderId, "order");
  assert.equal(section.section, "payment");
});
