import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProductImportHeader,
  normalizeProductImportSku,
  parseProductImportDelimited,
  shouldSkipProductImportUpdate,
  splitProductImportList,
} from "../src/lib/partspro-product-import-core.mjs";

test("normalizes pasted headers and explicit SKU values", () => {
  assert.equal(normalizeProductImportHeader(" Catalog Department "), "catalog_department");
  assert.equal(normalizeProductImportHeader("商品 名称"), "商品_名称");
  assert.equal(normalizeProductImportSku(" abc-001 "), "ABC-001");
  assert.equal(normalizeProductImportSku("mobilax-abc-001"), "ABC-001");
  assert.equal(normalizeProductImportSku("MOBILAX  ABC-001"), "ABC-001");
});

test("normalizes supplier aliases to the same product SKU", () => {
  const skus = ["ABC-001", "mobilax ABC-001", "MOBILAX-ABC-001"]
    .map(normalizeProductImportSku);
  assert.deepEqual([...new Set(skus)], ["ABC-001"]);
});

test("only skips a no-op update when validation has no issues", () => {
  assert.equal(shouldSkipProductImportUpdate("update", 0, 0), true);
  assert.equal(shouldSkipProductImportUpdate("update", 0, 1), false);
  assert.equal(shouldSkipProductImportUpdate("update", 1, 0), false);
  assert.equal(shouldSkipProductImportUpdate("create", 0, 0), false);
});

test("parses Excel-style TSV clipboard data", () => {
  assert.deepEqual(
    parseProductImportDelimited("sku\tname\tb2b_price\nABC-1\tDisplay A54\t12,50"),
    [["sku", "name", "b2b_price"], ["ABC-1", "Display A54", "12,50"]]
  );
});

test("parses quoted CSV fields and CRLF", () => {
  assert.deepEqual(
    parseProductImportDelimited('sku,name,tags\r\nABC-1,"Display, OLED","OLED;nero"\r\n'),
    [["sku", "name", "tags"], ["ABC-1", "Display, OLED", "OLED;nero"]]
  );
});

test("deduplicates semicolon lists without losing order", () => {
  assert.deepEqual(splitProductImportList("A54; A55;A54\nA56"), ["A54", "A55", "A56"]);
});
