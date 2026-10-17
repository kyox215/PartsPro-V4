import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (name) => readFileSync(new URL(`../src/components/partspro/${name}.tsx`, import.meta.url), "utf8");
const sources = { cart: read("cart-page"), checkout: read("checkout-client") };
const asts = Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, ts.createSourceFile(`${key}.tsx`, value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)]));
function find(key, predicate) {
  let found;
  function walk(node) { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, walk); }
  walk(asts[key]);
  assert.ok(found, `source node exists in ${key}`);
  return found;
}
const fn = (key, name) => find(key, (node) => ts.isFunctionDeclaration(node) && node.name?.text === name).getText(asts[key]);
const expression = (key, name) => find(key, (node) => ts.isVariableDeclaration(node) && node.name.getText(asts[key]) === name).initializer.getText(asts[key]);
function execute(source, context = {}) {
  context.exports ??= {};
  vm.createContext(context);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  vm.runInContext(code, context);
  return context;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const oldProduct = { sku: "SKU-OLD", name: "Display originale", imageUrl: "/old-image.webp", price: 19, stock: 5, moq: 1 };
function cartLoader(fetch, items = [{ sku: "SKU-OLD", quantity: 2 }]) {
  const context = {
    products: [oldProduct], catalogLoadState: "ready", catalogRejections: {},
    items, assistedCompanyId: "customer-A", cartQuoteSignature: JSON.stringify(items),
    pricingSession: { refreshVersion: 4 }, active: true, controller: new AbortController(),
    timeout: 1, window: { clearTimeout() {} }, URLSearchParams, fetch,
    resolvedRefreshVersion: 3, resolvedSignature: "previous", productWrites: 0,
  };
  context.onCatalogProductsLoaded = (products) => { context.products = products; context.productWrites++; };
  for (const [setter, key] of [["setCatalogLoadState", "catalogLoadState"], ["setCatalogRejections", "catalogRejections"], ["setResolvedSignature", "resolvedSignature"], ["setResolvedRefreshVersion", "resolvedRefreshVersion"], ["setPriceCheckedAt", "priceCheckedAt"]]) context[setter] = (value) => { context[key] = value; };
  return execute(`${fn("cart", "loadCartCatalogProducts")}\nglobalThis.run=loadCartCatalogProducts;`, context);
}

test("same-account cart recheck retains product metadata through delay and failure", async () => {
  const request = deferred();
  const context = cartLoader(() => request.promise);
  const original = context.products;
  const running = context.run();
  assert.equal(context.catalogLoadState, "loading");
  assert.equal(context.products, original);
  assert.equal(context.products[0].imageUrl, "/old-image.webp");
  request.reject(new Error("offline"));
  await running;
  assert.equal(context.catalogLoadState, "error");
  assert.equal(context.products, original);
  assert.equal(context.productWrites, 0);
  assert.equal(context.resolvedRefreshVersion, 3);
});

test("cart replaces products only after a successful quote and still batches fifty SKUs", async () => {
  const requests = [];
  const items = Array.from({ length: 51 }, (_, index) => ({ sku: `SKU-${index}`, quantity: 2 }));
  const context = cartLoader(async (url) => {
    const query = new URL(url, "https://fixture.invalid").searchParams;
    const skus = query.get("skus").split(",");
    requests.push(skus);
    assert.equal(query.get("companyId"), "customer-A");
    return { ok: true, json: async () => ({ data: skus.map((sku) => ({ ...oldProduct, sku, price: 20 })), meta: { rejected: [] } }) };
  }, items);
  await context.run();
  assert.deepEqual(requests.map((request) => request.length), [50, 1]);
  assert.equal(context.products.length, 51);
  assert.equal(context.productWrites, 1);
  assert.equal(context.catalogLoadState, "ready");
  assert.equal(context.resolvedRefreshVersion, 4);
});

test("cancelled old-customer cart response cannot replace the current display", async () => {
  const request = deferred();
  const context = cartLoader(() => request.promise);
  const running = context.run();
  context.active = false;
  context.controller.abort();
  request.resolve({ ok: true, json: async () => ({ data: [{ ...oldProduct, name: "Old customer result" }] }) });
  await running;
  assert.equal(context.products[0], oldProduct);
  assert.equal(context.productWrites, 0);
});

test("quoted cart rows keep the same product object while refreshing or failed", () => {
  for (const state of ["loading", "error"]) {
    const line = { sku: oldProduct.sku, quantity: 2, product: oldProduct, lineTotal: 38 };
    const context = { React: { useMemo: (create) => create() }, cart: { items: [{ sku: oldProduct.sku, quantity: 2 }] }, cartLineBySku: new Map([[oldProduct.sku, line]]), catalogLoadState: state, catalogProductBySku: new Map([[oldProduct.sku, oldProduct]]), catalogRejections: {}, isCatalogResolving: state === "loading" };
    execute(`globalThis.rows=${expression("cart", "displayRows")};`, context);
    assert.equal(context.rows[0].kind, "available");
    assert.equal(context.rows[0].line, line);
    assert.equal(context.rows[0].line.quantity, 2);
  }
});

test("stored product names remain available when an initial quote fails", () => {
  const snapshot = { ...oldProduct };
  const context = { React: { useMemo: (create) => create() }, cart: { items: [{ sku: oldProduct.sku, quantity: 2, snapshot }] }, cartLineBySku: new Map(), catalogLoadState: "error", catalogProductBySku: new Map(), catalogRejections: {} };
  execute(`globalThis.rows=${expression("cart", "displayRows")};`, context);
  assert.equal(context.rows[0].kind, "snapshot");
  assert.equal(context.rows[0].snapshot, snapshot);
});

function previewLoader(fetch) {
  const totals = { total: { amount: "38.00", cents: 3800, currency: "EUR" } };
  const form = { notes: "Keep this note", deliveryMethod: "pickup", paymentMethod: "cash", useWallet: true };
  const context = {
    active: true, requestTimedOut: false, requestTimeout: null, previewRequestTimeoutMs: 15000,
    previewKey: "quote-v4", previewCompanyId: "customer-A", previewItems: [{ sku: oldProduct.sku, quantity: 2 }],
    checkoutMode: "customer_self", form, products: [oldProduct], productWrites: 0,
    preview: { status: "ready", canSubmit: true, issues: [], lines: [{ sku: oldProduct.sku }], totals, orderKind: "stock", wallet: { availableAmount: 12 } },
    catalogLoadState: "ready", catalogRejections: {}, confirmed: true, timers: [], controller: new AbortController(), fetch,
    tx: (_t, _key, fallback) => fallback, t: (key) => key, friendlyCheckoutError: () => "Quote unavailable",
  };
  context.window = { setTimeout: (callback) => { context.timers.push(callback); return context.timers.length; }, clearTimeout() {} };
  context.onCatalogProductsLoaded = (products) => { context.products = products; context.productWrites++; };
  for (const [setter, key] of [["setPreview", "preview"], ["setForm", "form"], ["setCatalogRejections", "catalogRejections"], ["setCatalogLoadState", "catalogLoadState"], ["setConfirmed", "confirmed"], ["setResolvedPreviewKey", "resolvedPreviewKey"], ["setPriceCheckedAt", "priceCheckedAt"]]) context[setter] = (value) => { context[key] = typeof value === "function" ? value(context[key]) : value; };
  return execute(`${fn("checkout", "loadPreview")}\nglobalThis.run=loadPreview;`, context);
}

test("checkout recheck keeps old summary structure, products and non-price draft on failure", async () => {
  const request = deferred();
  const context = previewLoader(() => request.promise);
  const originalTotals = context.preview.totals;
  const originalForm = context.form;
  const running = context.run();
  assert.equal(context.preview.status, "loading");
  assert.equal(context.preview.canSubmit, false);
  assert.equal(context.preview.totals, originalTotals);
  assert.equal(context.products[0], oldProduct);
  assert.equal(context.confirmed, false);
  request.reject(new Error("offline"));
  await running;
  assert.equal(context.preview.status, "error");
  assert.equal(context.preview.totals, originalTotals);
  assert.equal(context.productWrites, 0);
  assert.equal(context.form, originalForm);
});

test("checkout preview stops after fifteen seconds and exposes retryable local error", async () => {
  let calls = 0;
  const context = previewLoader((_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
  });
  const running = context.run();
  context.timers[0]();
  await running;
  assert.equal(context.preview.status, "error");
  assert.match(context.preview.message, /tempo|Riprova/);
  assert.equal(context.products[0], oldProduct);
  assert.equal(calls, 1);
});

test("new refresh version invalidates checkout consent without removing displayed summary", () => {
  const oldPreview = { status: "ready", canSubmit: true, issues: [], totals: { total: 38 }, orderKind: "preorder", wallet: { availableAmount: 12 } };
  const context = { React: { useMemo: (create) => create() }, preview: oldPreview, shouldLoadPreview: true, resolvedPreviewKey: "version-3", previewKey: "version-4", pricingSession: { refreshing: false, completedVersion: 4, refreshVersion: 4, pricesInvalid: false, error: null } };
  execute(`globalThis.current=${expression("checkout", "previewForUi")};`, context);
  assert.equal(context.current.status, "idle");
  assert.equal(context.current.canSubmit, false);
  assert.equal(context.current.totals, oldPreview.totals);
  assert.equal(context.current.orderKind, "preorder");
  context.previewForUi = context.current;
  execute(`globalThis.ready=${expression("checkout", "previewReadyForSubmit")};`, context);
  assert.equal(context.ready, false);
});

test("central timeout is stale rather than an endless refresh spinner", () => {
  const pricingSession = { refreshing: false, completedVersion: 3, refreshVersion: 4, pricesInvalid: true, error: "Retry refresh" };
  const context = { pricingSession, catalogPricesExpired: false, isLoginRequired: false, resolvedRefreshVersion: 4, catalogLoadState: "ready" };
  execute(`globalThis.pending=${expression("cart", "pricingRefreshPending")};globalThis.blocked=${expression("cart", "pricingRefreshBlocked")};`, context);
  assert.equal(context.pending, false);
  assert.equal(context.blocked, true);
  execute(`globalThis.pending=${expression("checkout", "pricingRefreshPending")};`, context);
  assert.equal(context.pending, false);
});

test("checkout cannot submit an otherwise ready quote until central refresh completes", () => {
  const context = { pricingSession: { refreshing: true, completedVersion: 3, refreshVersion: 4, pricesInvalid: false, error: null }, catalogPricesExpired: false, submissionRestored: true, blockers: [], checkoutSyncState: null, formDisabledReason: undefined, previewReadyForSubmit: true, submitState: { status: "idle" } };
  execute(`const pricingRefreshPending=${expression("checkout", "pricingRefreshPending")};const pricingRefreshBlocked=${expression("checkout", "pricingRefreshBlocked")};globalThis.allowed=${expression("checkout", "canSubmit")};`, context);
  assert.equal(context.allowed, false);
});

test("an already expired catalog price stays blocked even after central refresh completes", () => {
  const context = { catalogProducts: [{ ...oldProduct, priceValidUntil: "2000-01-01T00:00:00Z" }], priceCheckedAt: Date.now(), pricingRefreshPending: false, pricingSession: { pricesInvalid: false, error: null } };
  execute(`const catalogPricesExpired=${expression("checkout", "catalogPricesExpired")};globalThis.blocked=${expression("checkout", "pricingRefreshBlocked")};`, context);
  assert.equal(context.blocked, true);
});

test("identity mismatch renders the public loading shell without old private props", () => {
  const Loading = () => null;
  const context = { React: { createElement: (type, props) => ({ type, props }) }, StorefrontLoading: Loading, usePricingSession: () => ({ ready: false }), useSearchParams: () => ({}), readAssistedCompanyIdFromSearchParams: () => null };
  execute(`${fn("cart", "CartPage")}\n${fn("checkout", "CheckoutClient")}\nglobalThis.pages=[CartPage({initialAccountAccess:{userId:"old-private-user"}}),CheckoutClient({initialAccountAccess:{userId:"old-private-user"}})];`, context);
  for (const page of context.pages) {
    assert.equal(page.type, Loading);
    assert.deepEqual(Object.keys(page.props), ["variant"]);
    assert.ok(["cart", "checkout"].includes(page.props.variant));
  }
});

test("same-account refresh versions do not replace scoped cart or checkout components", () => {
  const session = { ready: true, key: "customer-A", refreshVersion: 3 };
  const context = { React: { createElement: (type, props) => ({ type, props }) }, CartPageScoped: () => null, CheckoutClientScoped: () => null, usePricingSession: () => session, useSearchParams: () => ({}), readAssistedCompanyIdFromSearchParams: () => "delegated-A" };
  execute(`${fn("cart", "CartPage")}\n${fn("checkout", "CheckoutClient")}\nglobalThis.cart=CartPage;globalThis.checkout=CheckoutClient;`, context);
  const props = { initialAccountAccess: { userId: "customer-A" }, company: { id: "company-A" } };
  const cartKey = context.cart(props).props.key;
  const checkoutKey = context.checkout(props).props.key;
  session.refreshVersion = 4;
  assert.equal(context.cart(props).props.key, cartKey);
  assert.equal(context.checkout(props).props.key, checkoutKey);
});
