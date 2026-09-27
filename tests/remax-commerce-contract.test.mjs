import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pricingSource = readFileSync(
  path.join(repoRoot, "src/lib/partspro-pricing.ts"),
  "utf8"
);
const accountSource = readFileSync(
  path.join(repoRoot, "src/lib/partspro-account-context.ts"),
  "utf8"
);
const preorderSource = readFileSync(
  path.join(repoRoot, "src/lib/partspro-preorder-contract.ts"),
  "utf8"
);
const migrationSource = readFileSync(
  path.join(
    repoRoot,
    "supabase/migrations/20260925131412_exempt_remax_discounts_and_sync_arrival_state.sql"
  ),
  "utf8"
);

test("REMAX and protective films are discount-exempt products", () => {
  const categorySource = extractFunction(pricingSource, "isDiscountExemptCategory")
    .replace("export ", "")
    .replace(/category: string \| null \| undefined/, "category")
    .replace(/\): boolean/, ")");
  const brandSource = extractFunction(pricingSource, "isDiscountExemptBrand")
    .replace("export ", "")
    .replace(/brand: string \| null \| undefined/, "brand")
    .replace(/\): boolean/, ")");
  const productSource = extractFunction(pricingSource, "isDiscountExemptProduct")
    .replace("export ", "")
    .replace(/category: string \| null \| undefined/, "category")
    .replace(/brand: string \| null \| undefined/, "brand")
    .replace(/\): boolean/, ")");
  const context = {};

  vm.runInNewContext(
    `${categorySource}\n${brandSource}\n${productSource}\nglobalThis.result = isDiscountExemptProduct;`,
    context
  );

  assert.equal(context.result("Accessori", " REMAX "), true);
  assert.equal(context.result("Pellicole Protettive", "Weelaam"), true);
  assert.equal(context.result("Schermi", "Samsung"), false);
});

test("storefront accepts only authoritative REMAX quotes and never calculates a local fallback", () => {
  assert.match(
    accountSource,
    /product\.priceResolved && product\.priceVersion && product\.quoteStatus !== "unavailable"/
  );
  assert.match(accountSource, /priceSource: "unavailable"/);
  assert.match(accountSource, /quoteStatus: "unavailable"/);
  assert.doesNotMatch(accountSource, /calculateProductTierPrice\(/);
  assert.doesNotMatch(accountSource, /isDiscountExemptProduct\(product\.category/);
});

test("stock remains the first purchase mode before preorder", () => {
  const stockCheck = preorderSource.indexOf("product.stock >= minimumQuantity");
  const preorderCheck = preorderSource.indexOf("isOpenPreorder(product.preorder", stockCheck);

  assert.ok(stockCheck >= 0);
  assert.ok(preorderCheck > stockCheck);
});

test("database pricing and the confirmed batch enforce the REMAX contract", () => {
  assert.match(
    migrationSource,
    /upper\(btrim\(coalesce\(v_product\.brand, ''\)\)\) = 'REMAX'/
  );
  assert.match(migrationSource, /if v_discount_exempt then/);
  assert.match(migrationSource, /sb\.batch_code = 'REMAX-SONG-2026-07-A'/);
  assert.match(migrationSource, /sbl\.qty_received > 0/);
  assert.match(migrationSource, /preorder_enabled = false/);
  assert.doesNotMatch(
    migrationSource,
    /update public\.products[\s\S]*sbl\.qty_received = 0/
  );
});

function extractFunction(source, name) {
  const start = source.indexOf(`export function ${name}(`);
  assert.notEqual(start, -1, `${name} helper was not found`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }

  throw new Error(`${name} helper is incomplete`);
}
