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
const verifierPrices = loadVerifierPriceHelper();
const repositoryPrices = loadRepositoryPriceHelper();

for (const [label, readExpectedPrices] of [
  ["CLI", verifierPrices],
  ["repository", repositoryPrices],
]) {
  test(`${label} honors complete positive explicit user prices`, () => {
    assert.deepEqual(
      { ...readExpectedPrices(explicitPrices(1.5, 1.6), 0.7) },
      { retailPrice: 1.5, b2bPrice: 1.6 }
    );
  });

  test(`${label} falls back when an explicit price field is missing`, () => {
    assert.deepEqual(
      {
        ...readExpectedPrices(
          { price_policy: "explicit_user_price", expected_retail_price: 1.5 },
          0.7
        ),
      },
      { retailPrice: 6, b2bPrice: 6 }
    );
  });

  test(`${label} rejects zero and negative explicit prices`, () => {
    assert.deepEqual(
      { ...readExpectedPrices(explicitPrices(0, 1.6), 1.25) },
      { retailPrice: 7, b2bPrice: 7 }
    );
    assert.deepEqual(
      { ...readExpectedPrices(explicitPrices(1.5, -1), 1.25) },
      { retailPrice: 7, b2bPrice: 7 }
    );
  });

  test(`${label} keeps ceil(cost + 5) without a valid explicit policy`, () => {
    assert.deepEqual({ ...readExpectedPrices({}, 1.25) }, {
      retailPrice: 7,
      b2bPrice: 7,
    });
    assert.deepEqual(
      {
        ...readExpectedPrices(
          { expected_retail_price: 1.5, expected_b2b_price: 1.6 },
          0.7
        ),
      },
      { retailPrice: 6, b2bPrice: 6 }
    );
  });
}

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

function loadRepositoryPriceHelper() {
  const source = [
    extractFunction(repositorySource, "readSupplierBatchExpectedPrices"),
    extractFunction(repositorySource, "readUnknownNumber"),
    extractFunction(repositorySource, "roundMoney"),
  ]
    .join("\n")
    .replace(
      /metadata: Record<string, unknown>,\s*costPrice: number/,
      "metadata, costPrice"
    )
    .replace("function readUnknownNumber(value: unknown)", "function readUnknownNumber(value)")
    .replace("function roundMoney(value: number)", "function roundMoney(value)");
  const context = {};

  vm.runInNewContext(
    `${source}\nglobalThis.result = readSupplierBatchExpectedPrices;`,
    context
  );
  return context.result;
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
