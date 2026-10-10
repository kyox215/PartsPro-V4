import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function compile(relativePath, globals = {}) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8").replace(/^import .*;\s*$/gm, "");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, URL, ...globals });
  return exports;
}
function tracking() { return compile("src/lib/partspro-analytics-tracking.ts"); }

test("only the homepage, catalog and one product segment are public tracking paths", () => {
  const { isPublicAnalyticsPath } = tracking();
  for (const path of ["/", "/catalogo", "/catalogo/", "/prodotto/SKU-1", "/prodotto/SKU-1/"]) assert.equal(isPublicAnalyticsPath(path), true, path);
  for (const path of [null, "", "/admin", "/admin/catalogo", "/login", "/account", "/checkout", "/carrello", "/rma", "/professionale", "/api/admin/analytics", "/catalogo/private", "/prodotto", "/prodotto/", "/prodotto/A/B", "//catalogo"]) assert.equal(isPublicAnalyticsPath(path), false, String(path));
});

test("public pageviews retain the allowed host/path and strip all query/hash without mutating input", () => {
  const { sanitizePublicAnalyticsEvent } = tracking();
  for (const url of ["https://partspro.app/?email=synthetic%40example.invalid#private", "https://www.partspro.app/catalogo/?q=search&customerId=synthetic#details", "https://partspro.app/prodotto/SKU-1?orderId=synthetic#note"]) {
    const event = Object.freeze({ type: "pageview", url });
    const actual = sanitizePublicAnalyticsEvent(event);
    const cleanUrl = new URL(url);
    assert.equal(actual.url, `${cleanUrl.origin}${cleanUrl.pathname}`);
    assert.equal(actual.type, "pageview"); assert.notEqual(actual, event); assert.equal(event.url, url);
    assert.equal(new URL(actual.url).search, ""); assert.equal(new URL(actual.url).hash, "");
  }
});

test("custom events, preview/external hosts, userinfo and non-HTTPS origins are denied", () => {
  const { sanitizePublicAnalyticsEvent } = tracking();
  assert.equal(sanitizePublicAnalyticsEvent({ type: "event", url: "https://partspro.app/", name: "private-action" }), null);
  for (const url of ["http://partspro.app/", "ftp://partspro.app/catalogo", "https://preview.vercel.app/catalogo", "https://partspro.app.evil.invalid/", "https://evil.invalid/prodotto/SKU-1", "https://user@partspro.app/", "https://user:password@www.partspro.app/catalogo", "https://:password@partspro.app/", "https://partspro.app:8443/"]) assert.equal(sanitizePublicAnalyticsEvent({ type: "pageview", url }), null, url);
});

test("private and malformed URLs are rejected by the event callback", () => {
  const { sanitizePublicAnalyticsEvent } = tracking();
  for (const url of ["https://partspro.app/admin?orderId=synthetic", "https://partspro.app/account", "https://partspro.app/login", "https://partspro.app/checkout", "https://partspro.app/carrello", "https://partspro.app/rma", "https://partspro.app/api/admin/analytics", "https://partspro.app/prodotto/A/B", "", "not a URL", "/catalogo", "https://", "https://partspro.app:bad/catalogo", "https://[bad]/catalogo"]) assert.equal(sanitizePublicAnalyticsEvent({ type: "pageview", url }), null, url);
});

test("actual client stops mounting on private navigation and retained SDK callback rejects private URLs", () => {
  const helper = tracking();
  let pathname = "/catalogo";
  const Analytics = () => null;
  const { PublicSiteAnalytics } = compile("src/components/partspro/public-site-analytics.tsx", {
    ...helper, Analytics, usePathname: () => pathname, React: { createElement: (type, props) => ({ type, props }) },
  });
  const publicElement = PublicSiteAnalytics();
  assert.equal(publicElement.type, Analytics); assert.equal(publicElement.props.debug, false);
  const retainedCallback = publicElement.props.beforeSend;
  assert.equal(retainedCallback({ type: "pageview", url: "https://partspro.app/catalogo?q=synthetic" }).url, "https://partspro.app/catalogo");
  pathname = "/admin";
  assert.equal(PublicSiteAnalytics(), null);
  assert.equal(retainedCallback({ type: "pageview", url: "https://partspro.app/admin?orderId=synthetic#private" }), null);
  pathname = "/prodotto/SKU-1";
  assert.equal(PublicSiteAnalytics().props.beforeSend({ type: "pageview", url: "https://partspro.app/prodotto/SKU-1?customer=synthetic" }).url, "https://partspro.app/prodotto/SKU-1");
});
