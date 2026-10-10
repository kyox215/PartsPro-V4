import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/partspro-admin-bulk-hide.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { hideAdminProductsSequentially } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("successful hides await each write and preserve request order", async () => {
  const calls = [];
  let active = 0;
  const result = await hideAdminProductsSequentially(["A", "B", "C"], async (sku) => {
    active += 1;
    assert.equal(active, 1, "bulk writes must not run concurrently");
    calls.push(sku);
    await Promise.resolve();
    active -= 1;
    return { sku, catalogStatus: "hidden" };
  });
  assert.deepEqual(calls, ["A", "B", "C"]);
  assert.deepEqual(result, {
    products: calls.map((sku) => ({ sku, catalogStatus: "hidden" })),
    succeededSkus: calls, failedSku: null, unattemptedSkus: [], error: null,
  });
});

test("a middle failure retains committed results and stops before remaining SKUs", async () => {
  const calls = [];
  const failure = new Error("Permission changed");
  const product = { sku: "A", catalogStatus: "hidden" };
  const result = await hideAdminProductsSequentially(["A", "B", "C", "D"], async (sku) => {
    calls.push(sku);
    if (sku === "B") throw failure;
    return product;
  });
  assert.deepEqual(calls, ["A", "B"]);
  assert.deepEqual(result.products, [product]);
  assert.deepEqual(result.succeededSkus, ["A"]);
  assert.equal(result.failedSku, "B");
  assert.deepEqual(result.unattemptedSkus, ["C", "D"]);
  assert.equal(result.error, failure);
});

test("first failure reports zero successes without retrying", async () => {
  const calls = [];
  const result = await hideAdminProductsSequentially(["A", "B"], async (sku) => {
    calls.push(sku);
    throw new Error("Unavailable");
  });
  assert.deepEqual(calls, ["A"]);
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.succeededSkus, []);
  assert.equal(result.failedSku, "A");
  assert.deepEqual(result.unattemptedSkus, ["B"]);
});

test("last failure reports all earlier successes and no unattempted SKUs", async () => {
  const result = await hideAdminProductsSequentially(["A", "B"], async (sku) => {
    if (sku === "B") throw new Error("Rejected");
    return { sku };
  });
  assert.deepEqual(result.succeededSkus, ["A"]);
  assert.equal(result.failedSku, "B");
  assert.deepEqual(result.unattemptedSkus, []);
});

test("empty input performs no writes", async () => {
  const result = await hideAdminProductsSequentially([], async () => assert.fail("unexpected write"));
  assert.deepEqual(result, { products: [], succeededSkus: [], failedSku: null, unattemptedSkus: [], error: null });
});

test("remaining work is stable when caller mutates its array during a write", async () => {
  const requested = ["A", "B", "C"];
  const calls = [];
  const result = await hideAdminProductsSequentially(requested, async (sku) => {
    calls.push(sku);
    if (sku === "A") requested.splice(0, requested.length, "OTHER");
    if (sku === "B") throw new Error("Rejected");
    return { sku };
  });
  assert.deepEqual(calls, ["A", "B"]);
  assert.deepEqual(result.unattemptedSkus, ["C"]);
});
