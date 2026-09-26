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
const migrationSource = readFileSync(
  path.join(
    repoRoot,
    "supabase/migrations/20260916205954_exempt_protective_films_from_discounts.sql"
  ),
  "utf8"
);

test("only the canonical protective-film category is discount-exempt", () => {
  const source = extractFunction(pricingSource, "isDiscountExemptCategory")
    .replace("export ", "")
    .replace(/category: string \| null \| undefined/, "category")
    .replace(/\): boolean/, ")");
  const context = {};

  vm.runInNewContext(
    `${source}\nglobalThis.result = isDiscountExemptCategory;`,
    context
  );

  assert.equal(context.result("Pellicole Protettive"), true);
  assert.equal(context.result("  PELLICOLE PROTETTIVE  "), true);
  assert.equal(context.result("Schermi"), false);
  assert.equal(context.result("Back Cover"), false);
  assert.equal(context.result(null), false);
});

test("category-aware tier pricing leaves films unchanged and keeps other discounts", () => {
  const exemptionSource = extractFunction(pricingSource, "isDiscountExemptCategory")
    .replace("export ", "")
    .replace(/category: string \| null \| undefined/, "category")
    .replace(/\): boolean/, ")");
  const brandExemptionSource = extractFunction(pricingSource, "isDiscountExemptBrand")
    .replace("export ", "")
    .replace(/brand: string \| null \| undefined/, "brand")
    .replace(/\): boolean/, ")");
  const productExemptionSource = extractFunction(pricingSource, "isDiscountExemptProduct")
    .replace("export ", "")
    .replace(/category: string \| null \| undefined/, "category")
    .replace(/brand: string \| null \| undefined/, "brand")
    .replace(/\): boolean/, ")");
  const calculatorSource = extractFunction(pricingSource, "calculateProductTierPrice")
    .replace("export ", "")
    .replace(/basePrice: number/, "basePrice")
    .replace(/tier: CompanyProfile\["priceList"\]/, "tier")
    .replace(/category: string \| null \| undefined/, "category")
    .replace(/brand\?: string \| null/, "brand")
    .replace(/\): number/, ")");
  const context = {
    calculateTierPrice: (basePrice) => basePrice - 1.5,
    roundCurrency: (value) => Math.round(value * 100) / 100,
  };

  vm.runInNewContext(
    `${exemptionSource}\n${brandExemptionSource}\n${productExemptionSource}\n${calculatorSource}\nglobalThis.result = calculateProductTierPrice;`,
    context
  );

  assert.equal(context.result(1.5, "king", "Pellicole Protettive"), 1.5);
  assert.equal(context.result(1.6, "king", "Pellicole Protettive"), 1.6);
  assert.equal(context.result(20, "king", "Accessori", "REMAX"), 20);
  assert.equal(context.result(20, "king", "Schermi"), 18.5);
});

test("local pricing fallback preserves the original price for protective films", () => {
  const exemptionCheck = accountSource.indexOf(
    "const discountExempt = isDiscountExemptProduct(product.category, product.brand);"
  );
  const finalPrice = accountSource.indexOf(
    "const finalPrice = calculateProductTierPrice(",
    exemptionCheck
  );
  const zeroDiscount = accountSource.indexOf(
    "const levelDiscountAmount = discountExempt ? 0",
    finalPrice
  );
  const exemptSource = accountSource.indexOf(
    '"local_b2b_price_discount_exempt"',
    zeroDiscount
  );

  assert.ok(exemptionCheck >= 0);
  assert.ok(finalPrice > exemptionCheck);
  assert.ok(zeroDiscount > finalPrice);
  assert.ok(exemptSource > zeroDiscount);
});

test("database pricing bypasses every discount path for protective films", () => {
  const categoryRule = migrationSource.indexOf(
    "lower(btrim(coalesce(v_product.category, ''))) = 'pellicole protettive'"
  );
  const exemptionBranch = migrationSource.indexOf(
    "if v_discount_exempt then",
    categoryRule
  );
  const originalPrice = migrationSource.indexOf(
    "v_raw_unit_price := v_base_unit_price;",
    exemptionBranch
  );
  const customerPriceLookup = migrationSource.indexOf(
    "from public.customer_product_prices as cpp",
    exemptionBranch
  );
  const levelDiscount = migrationSource.indexOf(
    "private.customer_level_discount_amount(v_level)",
    exemptionBranch
  );
  const groupDiscount = migrationSource.indexOf(
    "from public.price_groups as pg",
    exemptionBranch
  );

  assert.ok(categoryRule >= 0);
  assert.ok(exemptionBranch > categoryRule);
  assert.ok(originalPrice > exemptionBranch);
  assert.ok(customerPriceLookup > originalPrice);
  assert.ok(levelDiscount > customerPriceLookup);
  assert.ok(groupDiscount > levelDiscount);
  assert.doesNotMatch(migrationSource, /0\.15|15\s*%/);
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
