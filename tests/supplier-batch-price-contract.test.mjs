import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifierSource = readFileSync(
  path.join(repoRoot, "scripts/verify-supplier-batch-integrity.mjs"),
  "utf8"
);
const repositorySource = readFileSync(
  path.join(repoRoot, "src/lib/partspro-repository.ts"),
  "utf8"
);
const supplierBatchMigrationSource = readFileSync(
  path.join(
    repoRoot,
    "supabase/migrations/20260827183609_supplier_arrival_cost_v2_currency_fx_permissions.sql"
  ),
  "utf8"
);
const verifierPrices = loadVerifierPriceHelper();
const repositoryProductSummary = loadRepositoryProductSummary();

test("CLI keeps the explicit-price fallback used by integrity verification", () => {
  assert.deepEqual(
    { ...verifierPrices(explicitPrices(1.5, 1.6), 0.7) },
    { retailPrice: 1.5, b2bPrice: 1.6 }
  );
  assert.deepEqual(
    { ...verifierPrices({ price_policy: "explicit_user_price", expected_retail_price: 1.5 }, 0.7) },
    { retailPrice: 6, b2bPrice: 6 }
  );
  assert.deepEqual({ ...verifierPrices(explicitPrices(0, 1.6), 1.25) }, {
    retailPrice: 7,
    b2bPrice: 7,
  });
  assert.deepEqual({ ...verifierPrices(explicitPrices(1.5, -1), 1.25) }, {
    retailPrice: 7,
    b2bPrice: 7,
  });
  assert.deepEqual({ ...verifierPrices({}, 1.25) }, {
    retailPrice: 7,
    b2bPrice: 7,
  });
  assert.deepEqual(
    { ...verifierPrices({ expected_retail_price: 1.5, expected_b2b_price: 1.6 }, 0.7) },
    { retailPrice: 6, b2bPrice: 6 }
  );
});

test("v2 projection computes price_rule_ok and repository maps the real RPC field", () => {
  const projection = extractSqlSection(
    supplierBatchMigrationSource,
    "create or replace function private.admin_get_supplier_batch_products_v2(",
    "create or replace function public.admin_get_supplier_batch_products_v2("
  );

  assert.match(
    projection,
    /\(product\.retail_price > 0\s+and\s+product\.b2b_price > 0\s+and\s+product\.retail_price >= product\.b2b_price\)\s+as price_rule_ok/
  );
  assert.match(projection, /'price_rule_ok',\s*price_rule_ok/);
  assert.match(
    repositorySource,
    /client\.rpc\("admin_get_supplier_batch_products_v2",\s*\{\s*p_sku_codes:/s
  );
  assert.match(
    repositorySource,
    /priceRuleOk: product\.price_rule_ok === true \|\| product\.priceRuleOk === true/
  );
  assert.match(repositorySource, /if \(!productSummary\.priceRuleOk\)/);

  const product = {
    sku_code: "FILM-001",
    name: "Privacy Glass",
    brand: "PartsPro",
    model: "iPhone 15",
    status: "active",
    stock_qty: 2,
    price_rule_ok: true,
  };

  assert.equal(repositoryProductSummary(product).priceRuleOk, true);
  assert.equal(
    repositoryProductSummary({ ...product, price_rule_ok: false }).priceRuleOk,
    false
  );
  assert.equal(
    repositoryProductSummary({ ...product, price_rule_ok: "true" }).priceRuleOk,
    false,
    "the mapper must not trust a non-boolean RPC value"
  );
});

test("category fallback recognizes protective-film names", () => {
  const { inferCategory, normalizeCategory } = loadRepositoryCategoryHelpers();

  for (const name of ["Privacy Glass", "Screen Protector", "Pellicola 3D"]) {
    assert.equal(inferCategory(name), "Pellicole Protettive");
  }

  for (const name of ["Protective Film", "Protective Films", "tempered-glass"]) {
    assert.equal(normalizeCategory(name), "Pellicole Protettive");
  }
});

test("back glass fallback remains Back Cover", () => {
  const { inferCategory, normalizeCategory } = loadRepositoryCategoryHelpers();

  assert.equal(inferCategory("Back Glass iPhone 15"), "Back Cover");
  assert.equal(normalizeCategory("Back Glass iPhone 15"), "Back Cover");
});

test("inventory contract accepts later sales while enforcing current ledger identities", () => {
  const readInventoryContractIssues = loadVerifierInventoryHelper();
  const product = {
    sku_code: "FILM-001",
    name: "Privacy Glass",
    brand: "PartsPro",
    model: "iPhone 15",
    quality_grade: "A",
    stock_qty: 1,
  };
  const inventory = {
    actual_qty: 1,
    available_qty: 1,
    locked_qty: 0,
    identities: [
      {
        sku_code: "FILM-001",
        product_name: "Privacy Glass",
        brand: "PartsPro",
        model: "iPhone 15",
        quality_grade: "A",
      },
    ],
  };

  assert.deepEqual([...readInventoryContractIssues(product, inventory)], []);
  assert.match(
    readInventoryContractIssues(product, { ...inventory, available_qty: 0 })[0],
    /available_qty/
  );
  assert.match(
    readInventoryContractIssues(product, {
      ...inventory,
      identities: [{ ...inventory.identities[0], product_name: "Wrong product" }],
    }).at(-1),
    /identity/
  );
});

function explicitPrices(retailPrice, b2bPrice) {
  return {
    price_policy: "explicit_user_price",
    expected_retail_price: retailPrice,
    expected_b2b_price: b2bPrice,
  };
}

function loadVerifierPriceHelper() {
  return loadFunctions(
    verifierSource,
    ["readExpectedPrices", "metadataNumber", "isRecord", "roundMoney"],
    "readExpectedPrices"
  );
}

function loadRepositoryProductSummary() {
  const source = [
    extractFunction(repositorySource, "readSupplierBatchLineProductSummary"),
    extractFunction(repositorySource, "readNullableNonNegativeNumber"),
    extractFunction(repositorySource, "normalizeCatalogStatusValue"),
    extractFunction(repositorySource, "hasSupplierBatchModelPrefixIssue"),
    extractFunction(repositorySource, "pickString"),
    extractFunction(repositorySource, "pickNumber"),
    extractFunction(repositorySource, "readStringArray"),
    extractFunction(repositorySource, "sanitizeSupplierStringArray"),
    extractFunction(repositorySource, "normalizeStockStatus"),
  ]
    .join("\n")
    .replace(
      "function readSupplierBatchLineProductSummary(\n  product: DbRow,\n  inventory?: SupplierBatchInventorySummary | null\n): AdminSupplierBatchLineProduct {",
      "function readSupplierBatchLineProductSummary(\n  product,\n  inventory = null\n) {"
    )
    .replace(
      "function readNullableNonNegativeNumber(row: DbRow, keys: string[]) {",
      "function readNullableNonNegativeNumber(row, keys) {"
    )
    .replace(
      "function normalizeCatalogStatusValue(value: string | null): AdminCatalogStatus {",
      "function normalizeCatalogStatusValue(value) {"
    )
    .replace(
      "function hasSupplierBatchModelPrefixIssue(\n  brand: string,\n  values: Array<string | null | undefined>\n) {",
      "function hasSupplierBatchModelPrefixIssue(\n  brand,\n  values\n) {"
    )
    .replace(
      "function pickString(row: DbRow | null | undefined, keys: string[]) {",
      "function pickString(row, keys) {"
    )
    .replace(
      "function pickNumber(row: DbRow | null | undefined, keys: string[]) {",
      "function pickNumber(row, keys) {"
    )
    .replace(
      "function readStringArray(row: DbRow, keys: string[]) {",
      "function readStringArray(row, keys) {"
    )
    .replace(
      "function sanitizeSupplierStringArray(values: string[]) {",
      "function sanitizeSupplierStringArray(values) {"
    )
    .replace(
      "function normalizeStockStatus(value: string | null, stock: number): StockStatus {",
      "function normalizeStockStatus(value, stock) {"
    )
    .replace("const values: string[] = [];", "const values = [];");
  const context = {
    sanitizeSupplierText(value) {
      return typeof value === "string" ? value.trim() : "";
    },
  };

  vm.runInNewContext(
    `${source}\nglobalThis.result = readSupplierBatchLineProductSummary;`,
    context
  );
  return context.result;
}

function extractSqlSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} SQL section was not found`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `${endMarker} SQL section boundary was not found`);
  return source.slice(start, end);
}

function loadRepositoryCategoryHelpers() {
  const source = [
    extractFunction(repositorySource, "normalizeVisual"),
    extractFunction(repositorySource, "inferCategory"),
    extractFunction(repositorySource, "normalizeCategory"),
  ]
    .join("\n")
    .replace(
      "function normalizeVisual(value: string): PartVisual",
      "function normalizeVisual(value)"
    )
    .replace("function inferCategory(value: string)", "function inferCategory(value)")
    .replace("function normalizeCategory(value: string)", "function normalizeCategory(value)")
    .replace("const labels: Record<PartVisual, string> =", "const labels =");
  const context = {};

  vm.runInNewContext(
    `${source}\nglobalThis.result = { inferCategory, normalizeCategory };`,
    context
  );
  return context.result;
}

function loadVerifierInventoryHelper() {
  return loadFunctions(
    verifierSource,
    ["readInventoryContractIssues", "normalizeInventoryIdentityValue", "numberValue"],
    "readInventoryContractIssues"
  );
}

function loadFunctions(source, names, resultName) {
  const context = {};
  const functions = names.map((name) => extractFunction(source, name)).join("\n");
  vm.runInNewContext(`${functions}\nglobalThis.result = ${resultName};`, context);
  return context.result;
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} helper was not found`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  assert.fail(`${name} helper boundary was not found`);
}
