import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const preorderModule = { exports: {} };
vm.runInNewContext(compile(read("src/lib/partspro-preorder-contract.ts")), { exports: preorderModule.exports });
const feedbackModule = { exports: {} };
vm.runInNewContext(compile(read("src/components/partspro/commerce-feedback.ts")), {
  exports: feedbackModule.exports,
  require: (name) => {
    assert.equal(name, "@/lib/partspro-preorder-contract");
    return preorderModule.exports;
  },
});

test("cart rejection explains purchase-kind conflicts without calling unknown snapshots a conflict", () => {
  const stock = { sku: "STOCK", status: "In Stock", stock: 10, moq: 1, price: 10 };
  const preorder = { sku: "PREORDER", status: "Out of Stock", stock: 0, moq: 1, price: 10, preorder: { enabled: true, status: "open", remainingQty: 10 } };
  const unavailable = { ...stock, sku: "GONE", stock: 0, status: "Out of Stock" };
  const conflict = feedbackModule.exports.cartHasPurchaseKindConflict;
  assert.equal(conflict(stock, [{ sku: preorder.sku, quantity: 1, snapshot: preorder }]), true);
  assert.equal(conflict(preorder, [{ sku: stock.sku, quantity: 1, snapshot: stock }]), true);
  assert.equal(conflict(stock, [{ sku: stock.sku, quantity: 1, snapshot: stock }]), false);
  assert.equal(conflict(stock, [{ sku: "UNKNOWN", quantity: 1 }]), false);
  assert.equal(conflict(stock, [{ sku: unavailable.sku, quantity: 1, snapshot: unavailable }]), false);
  assert.equal(conflict(unavailable, [{ sku: preorder.sku, quantity: 1, snapshot: preorder }]), false);
  // The current add guard permits a matching kind in an already mixed legacy cart.
  // If storage then fails, do not incorrectly attribute it to the purchase-kind guard.
  assert.equal(conflict(stock, [{ sku: preorder.sku, quantity: 1, snapshot: preorder }, { sku: stock.sku, quantity: 1, snapshot: stock }]), false);
});

function rmaSelection({ accepted, locked = false } = {}) {
  const source = read("src/components/partspro/rma-page.tsx");
  const handlers = source.slice(source.indexOf("  function confirmSelectionChange()"), source.indexOf("  function addImageFiles("));
  assert.ok(handlers.includes("function updateOrderLine"));
  const initialForm = { reasonCode: "quality_defect", requestedResolution: "wallet_credit", note: "" };
  const context = {
    locale: "it-IT", initialForm,
    form: { ...initialForm, orderId: "ORDER-A", orderLineId: "LINE-A", quantity: "2", note: "Photo of product A" },
    imagesRef: { current: [{ id: "PHOTO-A", previewUrl: "blob:photo-a" }] },
    orderOptions: [{ id: "ORDER-B", lines: [{ id: "LINE-B" }] }],
    images: ["PHOTO-A"], revoked: [], confirmCalls: 0, resets: 0,
    areRmaControlsLocked: () => locked,
  };
  context.window = { confirm: () => { context.confirmCalls++; return accepted; } };
  context.URL = { revokeObjectURL: (url) => context.revoked.push(url) };
  context.setForm = (next) => { context.form = typeof next === "function" ? next(context.form) : next; };
  context.setImages = (next) => { context.images = next; };
  context.setImageError = (next) => { context.imageError = next; };
  context.resetSubmitForChange = () => { context.resets++; };
  vm.createContext(context);
  vm.runInContext(compile(`${handlers}\nglobalThis.handlers = {updateOrder, updateOrderLine, clearOrder};`), context);
  return context;
}

test("cancelled RMA selection preserves the original product, note and photos", () => {
  const context = rmaSelection({ accepted: false });
  context.handlers.updateOrder("ORDER-B");
  assert.equal(context.form.orderId, "ORDER-A");
  assert.equal(context.form.note, "Photo of product A");
  assert.equal(context.images.length, 1);
  assert.equal(context.revoked.length, 0);
  assert.equal(context.resets, 0);
});

test("confirmed RMA selection clears old evidence before applying the new product", () => {
  for (const change of ["order", "line", "clear"]) {
    const context = rmaSelection({ accepted: true });
    if (change === "order") context.handlers.updateOrder("ORDER-B");
    else if (change === "line") context.handlers.updateOrderLine("LINE-B");
    else context.handlers.clearOrder();
    assert.equal(context.form.note, "");
    assert.equal(context.images.length, 0);
    assert.equal(context.imagesRef.current.length, 0);
    assert.equal(context.revoked.join(","), "blob:photo-a");
    assert.equal(context.form.quantity, "1");
    assert.equal(context.resets, 1);
  }
});

test("RMA checkpoint locks still prevent selection changes or cleanup", () => {
  const context = rmaSelection({ accepted: true, locked: true });
  context.handlers.updateOrder("ORDER-B");
  context.handlers.updateOrderLine("LINE-B");
  context.handlers.clearOrder();
  assert.equal(context.confirmCalls, 0);
  assert.equal(context.form.orderId, "ORDER-A");
  assert.equal(context.images.length, 1);
  assert.equal(context.revoked.length, 0);
});

test("RMA selection treats a changed reason or resolution as a draft and resets it only after consent", () => {
  const context = rmaSelection({ accepted: true });
  context.form.note = "";
  context.form.reasonCode = "wrong_item";
  context.form.requestedResolution = "replacement";
  context.imagesRef.current = [];
  context.images = [];
  context.handlers.updateOrderLine("LINE-B");
  assert.equal(context.confirmCalls, 1);
  assert.equal(context.form.reasonCode, "quality_defect");
  assert.equal(context.form.requestedResolution, "wallet_credit");
});

function supportScenario(response) {
  const source = read("src/components/partspro/support-chat-panel.tsx");
  const start = source.indexOf("  async function handleSend(");
  const end = source.indexOf("  React.useEffect(", start);
  const expression = source.match(/const canUseComposer = ([^;]+);/)[1];
  const context = {
    draft: "Please help with this order", sending: false, accessError: null,
    sendFailed: false, error: null, loaded: true, messages: [], conversation: null,
    copy: { unavailable: "Unavailable" },
    fetch: async () => { if (response instanceof Error) throw response; return response; },
    readJsonResponse: async (value) => value.payload,
    readSupportApiError: (payload, status) => ({ status, message: payload?.error?.message || "Unavailable" }),
    readCurrentSupportPayload: (payload) => payload.data,
  };
  for (const name of ["Sending", "Error", "SendFailed", "AccessError", "Conversation", "Messages", "Loaded"]) {
    const key = name[0].toLowerCase() + name.slice(1);
    context[`set${name}`] = (value) => { context[key] = value; };
  }
  context.onDraftChange = (value) => { context.draft = value; };
  vm.createContext(context);
  vm.runInContext(compile(`${source.slice(start, end)}\nglobalThis.handleSend=handleSend; globalThis.canCompose=()=>(${expression});`), context);
  return context;
}

test("first support send failure leaves the original draft and composer available", async () => {
  const context = supportScenario(new Error("Connection lost"));
  await context.handleSend({ preventDefault() {} });
  assert.equal(context.draft, "Please help with this order");
  assert.equal(context.sendFailed, true);
  assert.equal(context.sending, false);
  assert.equal(context.canCompose(), true);
});

test("support authentication denial still disables the composer", async () => {
  const context = supportScenario({ ok: false, status: 403, payload: { error: { message: "Customer account required" } } });
  await context.handleSend({ preventDefault() {} });
  assert.equal(context.canCompose(), false);
  assert.equal(context.draft, "Please help with this order");
});


test("preorder validation uses the active storefront language for arrival dates", () => {
  const source = read("src/components/partspro/product-detail-purchase-panel.tsx");
  const start = source.indexOf("function getPurchaseValidationMessage(");
  assert.ok(start >= 0);
  const context = {
    preorderEtaLabel: preorderModule.exports.preorderEtaLabel,
    tx: (_t, _key, fallback) => fallback,
    txFormat: (_t, _key, fallback, values) => fallback.replace(/\{(\w+)\}/g, (_match, key) => values[key]),
  };
  vm.runInNewContext(compile(source.slice(start) + "\nglobalThis.validate = getPurchaseValidationMessage;"), context);
  const preorder = { etaStart: "2026-10-01", etaEnd: "2026-12-01" };
  for (const locale of ["zh-CN", "it-IT", "en-US"]) {
    const message = context.validate({ t: () => "", locale, canOrder: true, stockAvailable: true, purchaseKind: "preorder", safeQuantity: 2, product: { preorder } });
    assert.ok(message.includes(preorderModule.exports.preorderEtaLabel(preorder, locale)), locale);
  }
  const invalid = { etaStart: "invalid", etaEnd: "2026-12-01" };
  assert.equal(preorderModule.exports.preorderEtaLabel(invalid, "zh-CN"), "");
});
