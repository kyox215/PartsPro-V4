#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const REST_CHUNK_SIZE = 100;
const MONEY_TOLERANCE = 0.01;

const args = process.argv.slice(2);
const options = {
  json: args.includes("--json"),
};
const batchCodes = args.filter((arg) => !arg.startsWith("--"));

loadLocalEnv();

const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  fail(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Supplier batch verification requires server credentials."
  );
}

if (batchCodes.length === 0) {
  fail("Usage: npm run verify:supplier-batch -- <BATCH_CODE> [more-batch-codes] [--json]");
}

const restBaseUrl = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1`;
const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  Accept: "application/json",
};

const results = [];

for (const batchCode of batchCodes) {
  results.push(await verifyBatch(batchCode));
}

if (options.json) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const result of results) {
    printHumanResult(result);
  }
}

const failed = results.some((result) => result.errors.length > 0);
process.exit(failed ? 1 : 0);

async function verifyBatch(batchCode) {
  const batches = await restGet("supplier_batches", {
    select: "id,batch_code,total_qty,total_cost,currency,created_at,invoice_no,order_no",
    batch_code: `eq.${batchCode}`,
    limit: "1",
  });
  const batch = batches[0] ?? null;

  if (!batch) {
    return {
      batchCode,
      errors: [`Batch not found: ${batchCode}`],
      warnings: [],
      summary: {},
    };
  }

  const lines = await restGet("supplier_batch_lines", {
    select:
      "id,line_no,ean,supplier_sku,sku_code,name,qty_received,unit_cost,line_total,image_status,product_status,metadata",
    batch_id: `eq.${batch.id}`,
    order: "line_no.asc",
  });

  const candidates = uniqueStrings(
    lines.flatMap((line) => [line.sku_code, line.ean]).map(normalizeSku)
  );
  const products = await readBySkuChunks("products", candidates, [
    "sku_code",
    "name",
    "brand",
    "model",
    "compatibility_models",
    "cost_price",
    "retail_price",
    "b2b_price",
    "stock_qty",
    "status",
    "image_path",
  ]);
  const inventory = await readBySkuChunks("inventory_items", candidates, [
    "sku_code",
    "actual_qty",
    "available_qty",
    "locked_qty",
  ]);
  const productsBySku = makeSkuMap(products);
  const inventoryBySku = makeAggregatedInventoryMap(inventory);
  const errors = [];
  const warnings = [];
  const qtyReceivedTotal = sum(lines, (line) => numberValue(line.qty_received));
  const lineCostTotal = roundMoney(sum(lines, (line) => numberValue(line.line_total)));
  const expectedTotalQty = numberValue(batch.total_qty);
  const expectedTotalCost = roundMoney(numberValue(batch.total_cost));

  if (qtyReceivedTotal !== expectedTotalQty) {
    errors.push(
      `Quantity mismatch: supplier_batch_lines=${qtyReceivedTotal}, supplier_batches=${expectedTotalQty}`
    );
  }

  if (Math.abs(lineCostTotal - expectedTotalCost) > MONEY_TOLERANCE) {
    errors.push(
      `Cost mismatch: supplier_batch_lines=${lineCostTotal.toFixed(2)}, supplier_batches=${expectedTotalCost.toFixed(2)}`
    );
  }

  for (const line of lines) {
    const lineNo = numberValue(line.line_no);
    const qtyReceived = numberValue(line.qty_received);
    const lineCandidates = uniqueStrings([line.sku_code, line.ean].map(normalizeSku));
    const product = firstMapped(lineCandidates, productsBySku);
    const inventoryItem = firstMapped(lineCandidates, inventoryBySku);
    const label = `line ${lineNo} ${line.sku_code || line.ean || line.supplier_sku || line.name}`;

    if (qtyReceived <= 0) {
      continue;
    }

    if (!product) {
      errors.push(`${label}: product missing`);
      continue;
    }

    if (!inventoryItem) {
      errors.push(`${label}: inventory item missing`);
    }

    if (String(line.product_status ?? "").toLowerCase() === "active" && product.status !== "active") {
      errors.push(`${label}: batch line is active but product status is ${product.status || "empty"}`);
    }

    if (String(line.image_status ?? "").toLowerCase() === "uploaded" && !product.image_path) {
      errors.push(`${label}: batch line image is uploaded but product image_path is empty`);
    }

    if (product.status === "active" && !product.image_path) {
      errors.push(`${label}: active product missing image_path`);
    }

    const expectedPrice = Math.ceil(numberValue(product.cost_price) + 5);
    if (
      numberValue(product.retail_price) !== expectedPrice ||
      numberValue(product.b2b_price) !== expectedPrice
    ) {
      errors.push(`${label}: price rule failed, expected ${expectedPrice}`);
    }

    if (hasBrandPrefixIssue(product)) {
      errors.push(`${label}: model or compatibility_models contains duplicate brand prefix`);
    }

    if (inventoryItem && numberValue(inventoryItem.actual_qty) < qtyReceived) {
      warnings.push(
        `${label}: current actual_qty ${numberValue(inventoryItem.actual_qty)} is below received qty ${qtyReceived}`
      );
    }
  }

  return {
    batchCode,
    errors,
    warnings,
    summary: {
      lineCount: lines.length,
      qtyReceivedTotal,
      expectedTotalQty,
      lineCostTotal,
      expectedTotalCost,
      productMatches: products.length,
      inventoryMatches: inventory.length,
      invoiceNo: batch.invoice_no ?? null,
      orderNo: batch.order_no ?? null,
    },
  };
}

async function readBySkuChunks(table, skuCodes, columns) {
  if (skuCodes.length === 0) {
    return [];
  }

  const rows = [];

  for (let index = 0; index < skuCodes.length; index += REST_CHUNK_SIZE) {
    const chunk = skuCodes.slice(index, index + REST_CHUNK_SIZE);
    rows.push(
      ...(await restGet(table, {
        select: columns.join(","),
        sku_code: `in.(${chunk.join(",")})`,
      }))
    );
  }

  return rows;
}

async function restGet(table, params) {
  const url = new URL(`${restBaseUrl}/${table}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { headers });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase REST ${table} failed ${response.status}: ${text}`);
  }

  const data = text ? JSON.parse(text) : [];

  if (!Array.isArray(data)) {
    throw new Error(`Supabase REST ${table} returned a non-array payload.`);
  }

  return data;
}

function makeSkuMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const sku = normalizeSku(row.sku_code);

    if (sku) {
      map.set(sku, row);
    }
  }

  return map;
}

function makeAggregatedInventoryMap(rows) {
  const map = new Map();

  for (const row of rows) {
    const sku = normalizeSku(row.sku_code);

    if (!sku) {
      continue;
    }

    const current = map.get(sku) ?? {
      sku_code: sku,
      actual_qty: 0,
      available_qty: 0,
      locked_qty: 0,
    };

    current.actual_qty += numberValue(row.actual_qty);
    current.available_qty += numberValue(row.available_qty);
    current.locked_qty += numberValue(row.locked_qty);
    map.set(sku, current);
  }

  return map;
}

function firstMapped(keys, map) {
  for (const key of keys) {
    const value = map.get(key);

    if (value) {
      return value;
    }
  }

  return null;
}

function hasBrandPrefixIssue(product) {
  const brand = String(product.brand ?? "").trim();

  if (!brand) {
    return false;
  }

  const prefix = `${brand.toLowerCase()} `;
  const values = [
    product.model,
    ...(Array.isArray(product.compatibility_models) ? product.compatibility_models : []),
  ];

  return values.some((value) => String(value ?? "").trim().toLowerCase().startsWith(prefix));
}

function printHumanResult(result) {
  const status = result.errors.length > 0 ? "FAIL" : "OK";

  console.log(`${status} ${result.batchCode}`);
  console.log(
    `  lines=${result.summary.lineCount ?? 0}, qty=${result.summary.qtyReceivedTotal ?? 0}/${result.summary.expectedTotalQty ?? 0}, cost=${formatMoney(result.summary.lineCostTotal)}/${formatMoney(result.summary.expectedTotalCost)}, products=${result.summary.productMatches ?? 0}, inventory=${result.summary.inventoryMatches ?? 0}`
  );

  for (const warning of result.warnings) {
    console.log(`  WARNING ${warning}`);
  }

  for (const error of result.errors) {
    console.log(`  ERROR ${error}`);
  }
}

function loadLocalEnv() {
  const envPath = ".env.local";

  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = stripQuotes(match[2]);
  }
}

function stripQuotes(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function readEnv(name) {
  return process.env[name]?.trim() || "";
}

function normalizeSku(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function sum(values, read) {
  return values.reduce((total, value) => total + read(value), 0);
}

function formatMoney(value) {
  return typeof value === "number" ? value.toFixed(2) : "0.00";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
