import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeProductCompatibilityReview,
  normalizeProductImportHeader,
  normalizeProductImportSku,
  parseProductImportDelimited,
  shouldSkipProductImportUpdate,
  splitProductImportList,
} from "../src/lib/partspro-product-import-core.mjs";

const review = (overrides = {}) => analyzeProductCompatibilityReview({
  name: "OEM Display Touchscreen Xiaomi Poco C65/Redmi 13C Black",
  brand: "Xiaomi",
  model: "Poco C65",
  compatibilityModels: [],
  modelCodes: [],
  compatibilityManaged: false,
  ...overrides,
});

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

test("flags a title with Poco C65 and Redmi 13C when structured compatibility is missing", () => {
  const result = review();
  assert.equal(result.required, true);
  assert.deepEqual(result.reasonCodes, ["MULTI_MODEL_TITLE", "STRUCTURED_MODELS_INCOMPLETE"]);
  assert.equal(result.structuredModelCount, 1);
  assert.ok(result.signals.every((signal) => typeof signal === "string"));
});

test("legacy completeness still requires review until the product is managed", () => {
  const result = review({
    compatibilityModels: ["Poco C65", "Redmi 13C"],
    compatibilityManaged: false,
  });
  assert.equal(result.required, true);
  assert.deepEqual(result.reasonCodes, ["MULTI_MODEL_TITLE"]);
});

test("a managed product with complete structured coverage does not require review", () => {
  const result = review({
    compatibilityModels: ["Poco C65", "Redmi 13C"],
    compatibilityManaged: true,
  });
  assert.equal(result.required, false);
  assert.deepEqual(result.reasonCodes, ["MULTI_MODEL_TITLE"]);
});

test("keeps 13C and 13C 5G distinct when managed coverage is incomplete", () => {
  const result = analyzeProductCompatibilityReview({
    name: "OEM Display Touchscreen Xiaomi Poco C65/Redmi 13C/Redmi 13C 5G Black",
    brand: "Xiaomi",
    model: "Poco C65",
    compatibilityModels: ["Poco C65", "Redmi 13C"],
    modelCodes: [],
    compatibilityManaged: true,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasonCodes.includes("STRUCTURED_MODELS_INCOMPLETE"));
  const modelSignal = result.signals.find((signal) => signal.startsWith("title models:"));
  assert.ok(modelSignal?.includes("13C"));
  assert.ok(modelSignal?.includes("13C 5G"));
  assert.equal(result.structuredModelCount, 2);
});

test("managed coverage of Poco C65, Redmi 13C, and Redmi 13C 5G is complete", () => {
  const result = analyzeProductCompatibilityReview({
    name: "OEM Display Touchscreen Xiaomi Poco C65/Redmi 13C/Redmi 13C 5G Black",
    brand: "Xiaomi",
    model: "Poco C65",
    compatibilityModels: ["Poco C65", "Redmi 13C", "Redmi 13C 5G"],
    modelCodes: [],
    compatibilityManaged: true,
  });
  assert.equal(result.required, false);
  assert.equal(result.structuredModelCount, 3);
  assert.ok(!result.reasonCodes.includes("STRUCTURED_MODELS_INCOMPLETE"));
});

test("detects adjacent OnePlus and OPPO model evidence without a slash", () => {
  const result = analyzeProductCompatibilityReview({
    name: "OEM Display Touchscreen OnePlus Nord CE 3 Lite 5G OPPO A98 5G (CPH2529) Black",
    brand: "OPPO",
    model: "A98 5G CPH2529",
    compatibilityModels: [],
    modelCodes: [],
    compatibilityManaged: false,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasonCodes.includes("MULTI_BRAND_TITLE"));
  assert.ok(result.reasonCodes.includes("MULTI_MODEL_TITLE"));
});

test("does not let a wrong Nord 2 5G structured model cover Nord CE 3 Lite 5G", () => {
  const result = analyzeProductCompatibilityReview({
    name: "OEM Display Touchscreen OnePlus Nord CE 3 Lite 5G OPPO A98 5G (CPH2529) Black",
    brand: "OPPO",
    model: "A98 5G CPH2529",
    compatibilityModels: ["A98 5G", "Nord 2 5G"],
    modelCodes: [],
    compatibilityManaged: true,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasonCodes.includes("STRUCTURED_MODELS_INCOMPLETE"));
});

test("strips embedded CPH codes without counting them as another A98 model", () => {
  const result = analyzeProductCompatibilityReview({
    name: "OEM Display Touchscreen OnePlus Nord CE 3 Lite 5G OPPO A98 5G (CPH2529) Black",
    brand: "OPPO",
    model: "A98 5G CPH2529",
    compatibilityModels: ["A98 5G", "Nord CE 3 Lite 5G"],
    modelCodes: [],
    compatibilityManaged: true,
  });
  assert.equal(result.required, false);
  assert.equal(result.structuredModelCount, 2);
});

test("detects OPPO and Realme as distinct brands", () => {
  const result = analyzeProductCompatibilityReview({
    name: "Premium Battery OPPO A77 5G Realme C51 Black",
    brand: "OPPO",
    model: "A77 5G",
    compatibilityModels: [],
    modelCodes: [],
    compatibilityManaged: false,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasonCodes.includes("MULTI_BRAND_TITLE"));
  assert.ok(result.reasonCodes.includes("MULTI_MODEL_TITLE"));
});

test("detects three Honor marketing models", () => {
  const result = analyzeProductCompatibilityReview({
    name: "Original LCD Display Honor X8B / Honor 200 Lite / Honor X8C",
    brand: "Honor",
    model: "X8B",
    compatibilityModels: [],
    modelCodes: [],
    compatibilityManaged: false,
  });
  assert.equal(result.required, true);
  assert.ok(result.reasonCodes.includes("MULTI_MODEL_TITLE"));
  assert.ok(result.signals.some((signal) => signal.includes("X8B") && signal.includes("200 Lite") && signal.includes("X8C")));
});

test("does not split Realme model-code aliases into multiple devices", () => {
  const result = analyzeProductCompatibilityReview({
    name: "Display Touchscreen Realme C21-Y RMX3261 / RMX3263 Black",
    brand: "Realme",
    model: "C21 Y",
    compatibilityModels: ["C21 Y"],
    modelCodes: ["RMX3261", "RMX3263"],
    compatibilityManaged: false,
  });
  assert.equal(result.required, false);
  assert.deepEqual(result.reasonCodes, []);
});

test("does not split Samsung A14 model-code aliases into multiple devices", () => {
  const result = analyzeProductCompatibilityReview({
    name: "OEM Display Touchscreen Samsung Galaxy A14 4G A145R/Galaxy A14 4G A145P Yellow Flex",
    brand: "Samsung",
    model: "Galaxy A14 4G A145P",
    compatibilityModels: ["Galaxy A14 4G A145P"],
    modelCodes: ["A145R", "A145P"],
    compatibilityManaged: false,
  });
  assert.equal(result.required, false);
  assert.deepEqual(result.reasonCodes, []);
});

test("ignores a single model, empty title, color, network, and year tokens", () => {
  for (const input of [
    { name: "OEM Display iPhone 13 Black", brand: "Apple", model: "iPhone 13" },
    { name: "", brand: "", model: "", compatibilityModels: [], modelCodes: [] },
    { name: "Display Samsung Galaxy S23 Ultra Blue", brand: "Samsung", model: "Galaxy S23 Ultra" },
    { name: "Display Redmi Note 12 5G", brand: "Redmi", model: "Note 12 5G" },
    { name: "Display Honor 90 Lite 2023", brand: "Honor", model: "90 Lite" },
  ]) {
    const result = analyzeProductCompatibilityReview(input);
    assert.equal(result.required, false);
    assert.deepEqual(result.reasonCodes, []);
  }
});

test("fingerprints only normalized analyzer fields deterministically", () => {
  const first = review({ extra: "ignored" });
  const second = review({
    name: " OEM   Display Touchscreen Xiaomi Poco C65/Redmi 13C Black ",
    compatibilityModels: [],
    modelCodes: [],
  });
  assert.equal(first.fingerprint, second.fingerprint);
  assert.match(first.fingerprint, /^compat-[0-9a-f]{8}$/);
});
