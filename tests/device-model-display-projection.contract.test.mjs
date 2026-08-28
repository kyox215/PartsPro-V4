import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase/migrations/20260828105427_catalog_model_display_projection.sql"
);
const rollbackPath = path.join(
  root,
  "supabase/rollbacks/20260828105427_catalog_model_display_projection_rollback.sql"
);
const smokePath = path.join(
  root,
  "supabase/tests/device-model-display-projection.sql"
);
const csvPath = path.join(
  root,
  "docs/audits/device-model-normalization/2026-08-28/device-model-normalization-review.csv"
);

const migration = fs.readFileSync(migrationPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const smoke = fs.readFileSync(smokePath, "utf8");
const csv = fs.readFileSync(csvPath, "utf8");

function withoutComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--.*$/gm, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const [header, ...data] = rows;
  return data
    .filter((entry) => entry.some((cell) => cell.length > 0))
    .map((entry) => Object.fromEntries(header.map((key, index) => [key, entry[index] ?? ""])));
}

function parseWhitelist(sql) {
  const values = sql.match(
    /with display_whitelist\([^)]*\) as \(\s*values([\s\S]*?)\n\)\s*select/i
  )?.[1];

  assert.ok(values, "display whitelist CTE must be present");
  const entries = [...values.matchAll(
    /\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/g
  )].map((match) => ({
    brand: match[1],
    raw_model: match[2],
    canonical_name: match[3],
    display_model: match[4],
    map_kind: match[5],
  }));

  return entries;
}

function normalizedKey(value) {
  return value.toLowerCase().replace(/[\s_.-]+/g, "");
}

function key(entry) {
  return `${entry.brand}:${entry.raw_model}`;
}

function expectedWhitelist() {
  return parseCsv(csv)
    .filter((row) => row.decision === "approved")
    .map((row) => {
      const prefix = row.match_type === "brand_prefix_pollution";
      const displayModel = prefix
        ? row.candidate_canonical_name.replace(new RegExp(`^${row.current_brand}\\s+`, "i"), "")
        : row.candidate_canonical_name;

      return {
        brand: row.current_brand,
        raw_model: row.raw_model,
        canonical_name: row.candidate_canonical_name,
        display_model: displayModel,
        map_kind: prefix ? "brand_prefix" : "legacy",
      };
    });
}

const whitelist = parseWhitelist(migration);
const expected = expectedWhitelist();

test("all three catalog views remain security-invoker and keep the public contract", () => {
  assert.equal(
    (migration.match(/create or replace view public\./g) ?? []).length,
    3
  );
  assert.equal(
    (migration.match(/with \(security_invoker = on\)/g) ?? []).length,
    3
  );
  for (const view of [
    "catalog_product_device_models",
    "catalog_model_options",
    "catalog_public_summary",
  ]) {
    assert.match(migration, new RegExp(`create or replace view public\\.${view}`));
  }
  assert.match(migration, /null::bigint as device_model_id/);
  assert.match(migration, /null::text as normalized_key/);
});

test("the frozen 48-row whitelist exactly matches approved CSV rows", () => {
  assert.equal(whitelist.length, 48);
  assert.equal(expected.length, 48);
  assert.equal(whitelist.filter((row) => row.map_kind === "legacy").length, 45);
  assert.equal(
    whitelist.filter((row) => row.map_kind === "brand_prefix").length,
    3
  );

  const actualByKey = new Map(whitelist.map((row) => [key(row), row]));
  const expectedByKey = new Map(expected.map((row) => [key(row), row]));
  assert.equal(actualByKey.size, 48, "raw brand/model keys must be unique");
  assert.deepEqual([...actualByKey.keys()].sort(), [...expectedByKey.keys()].sort());

  for (const expectedRow of expected) {
    assert.deepEqual(actualByKey.get(key(expectedRow)), expectedRow);
  }

  const lowerNormalizedKeys = whitelist.map(
    (row) => `${normalizedKey(row.brand)}:${normalizedKey(row.raw_model)}`
  );
  assert.equal(
    new Set(lowerNormalizedKeys).size,
    48,
    "lower-normalized whitelist keys must be unique"
  );
});

test("legacy display mapping is exact-only and never materializes an approved device link", () => {
  const executable = withoutComments(migration);
  assert.doesNotMatch(executable, /regexp_replace|device_models\s+as\s+candidate/i);
  assert.doesNotMatch(executable, /mapped\.candidate_count|mapped\.device_model_id/i);
  assert.match(executable, /display\.brand = product\.brand/);
  assert.match(executable, /display\.raw_model = legacy\.model/);
  assert.match(executable, /array\[legacy\.model\]::text\[\] as aliases/);
  assert.match(executable, /coalesce\(product\.model_codes, '\{\}'::text\[\]\)/);
  assert.match(executable, /display\.map_kind = 'legacy'/);
  assert.match(executable, /display\.map_kind = 'brand_prefix'/);
  assert.match(executable, /device\.canonical_name/);
});

test("normalized PDC rows inherit approved raw aliases through one-row preaggregation", () => {
  const executable = withoutComments(migration);
  assert.match(
    executable,
    /approved_legacy_aliases\(brand, canonical_name, aliases\)/
  );
  assert.match(
    executable,
    /array_agg\(raw_model order by raw_model\)::text\[\] as aliases/
  );
  assert.match(executable, /group by brand, canonical_name/);
  assert.match(executable, /left join approved_legacy_aliases as legacy_aliases/);
  assert.match(executable, /legacy_aliases\.brand = device\.brand/);
  assert.match(
    executable,
    /legacy_aliases\.canonical_name = device\.canonical_name/
  );
  assert.match(executable, /coalesce\(legacy_aliases\.aliases, '\{\}'::text\[\]\)/);
  assert.match(executable, /from unnest\([\s\S]*legacy_aliases\.aliases/);
  assert.match(executable, /array_agg\(distinct alias_value\.value order by alias_value\.value\)/);

  for (const [brand, canonical, raw] of [
    ["OPPO", "A57s 4G", "A57S 4G"],
    ["Vivo", "Y28s 5G", "Y28S 5G"],
    ["Vivo", "Y29s 5G", "Y29S 5G"],
  ]) {
    assert.ok(
      expected.some(
        (row) =>
          row.brand === brand &&
          row.canonical_name === canonical &&
          row.raw_model === raw &&
          row.map_kind === "legacy"
      ),
      `${brand} ${raw} must be an aggregated legacy alias`
    );
  }
});

test("Samsung radio variants, case regressions, and Wiko prefix cases are explicit", () => {
  const actualByKey = new Map(whitelist.map((row) => [key(row), row]));
  for (const [raw, canonical] of [
    ["Galaxy A16 4G A165", "Galaxy A16 4G"],
    ["Galaxy A16 5G A166", "Galaxy A16 5G"],
    ["Galaxy A17 4G A175", "Galaxy A17 4G"],
    ["Galaxy A17 5G A176", "Galaxy A17 5G"],
  ]) {
    const row = actualByKey.get(`Samsung:${raw}`);
    assert.equal(row?.canonical_name, canonical);
    assert.equal(row?.display_model, canonical);
    assert.equal(row?.map_kind, "legacy");
  }

  for (const [brand, raw, canonical] of [
    ["OPPO", "A57S 4G", "A57s 4G"],
    ["Vivo", "Y28S 5G", "Y28s 5G"],
    ["Vivo", "Y29S 5G", "Y29s 5G"],
  ]) {
    assert.equal(actualByKey.get(`${brand}:${raw}`)?.display_model, canonical);
  }

  for (const [raw, display] of [
    ["Wiko Power U10", "Power U10"],
    ["Wiko Power U20", "Power U20"],
    ["Wiko Power U30", "Power U30"],
  ]) {
    const row = actualByKey.get(`Wiko:${raw}`);
    assert.equal(row?.map_kind, "brand_prefix");
    assert.equal(row?.display_model, display);
  }
  assert.match(smoke, /expected_menu_count\s+integer/);
  assert.match(smoke, /<> 417/);
  assert.match(smoke, /expected_projection_count\s+integer/);
  assert.match(smoke, /<> 885/);
});

test("rollback restores the exact pre-migration view family without data or privilege DML", () => {
  const executable = withoutComments(rollback);
  assert.equal(
    (rollback.match(/create or replace view public\./g) ?? []).length,
    3
  );
  assert.equal(
    (rollback.match(/with \(security_invoker = on\)/g) ?? []).length,
    3
  );
  assert.doesNotMatch(
    executable,
    /\b(insert\s+into|update\s+|delete\s+from|truncate|drop\s+table|grant|revoke)\b/i
  );
  assert.match(executable, /device\.canonical_name as model/);
  assert.match(executable, /'\{\}'::text\[\] as aliases/);
  assert.match(executable, /legacy\.model/);
  for (const view of [
    "catalog_product_device_models",
    "catalog_model_options",
    "catalog_public_summary",
  ]) {
    assert.match(rollback, new RegExp(`create or replace view public\\.${view}`));
  }
});

test("read-only smoke SQL fails closed on counts, aliases, variants, unmatched values, and invariants", () => {
  const executable = withoutComments(smoke);
  assert.match(smoke, /do \$\$/i);
  assert.match(smoke, /raise exception/i);
  assert.match(smoke, /expected_menu_count/i);
  assert.match(smoke, /projection_row_count/i);
  assert.match(smoke, /same_product_set/i);
  assert.match(smoke, /device_model_id is null/i);
  assert.match(smoke, /normalized_key is null/i);
  assert.match(smoke, /unmatched_not_mapped/i);
  assert.match(smoke, /duplicate_identity_count/);
  assert.match(smoke, /normalized_aliases\(brand, canonical_model, raw_model\)/);
  assert.match(smoke, /inventory_available_qty/);
  assert.match(smoke, /inventory_locked_qty/);
  assert.match(smoke, /inventory_actual_qty/);
  assert.doesNotMatch(
    executable,
    /\b(insert\s+into|update\s+|delete\s+from|truncate|drop\s+table|grant|revoke)\b/i
  );
});
