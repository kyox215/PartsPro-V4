#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const MOBILAX_BASE_URL = "https://www.mobilax.com";
const MOBILAX_IMAGE_BASE_URL =
  "https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image";
const PROJECT_REF_PATH = "supabase/.temp/project-ref";
const PRODUCT_IMAGES_BUCKET = "product-images";
const NON_PHONE_MODEL_PATTERN = /(?:watch|tablet|tab|pad|buds|band|tv|router|laptop|scooter)/i;
const BRAND_CONFIGS = {
  apple: {
    brandLabel: "Apple",
    importLabel: "iPhone",
    pathSlug: "apple",
    storageFolder: "apple",
    seriesPaths: [
      "/spare-parts/mobile-phone/apple/series-17-16-15",
      "/spare-parts/mobile-phone/apple/series-14-13",
      "/spare-parts/mobile-phone/apple/series-12-11-x",
      "/spare-parts/mobile-phone/apple/series-se",
      "/spare-parts/mobile-phone/apple/series-8-7-6-5-4",
    ],
    modelFromUrl: appleModelFromUrl,
    extractModels: extractAppleModels,
    excludeModelPath: (path) => path.includes("ipod"),
  },
  samsung: {
    brandLabel: "Samsung",
    importLabel: "Samsung Galaxy",
    pathSlug: "samsung",
    storageFolder: "samsung",
    seriesPaths: [
      "/spare-parts/mobile-phone/samsung/galaxy-s",
      "/spare-parts/mobile-phone/samsung/galaxy-a",
      "/spare-parts/mobile-phone/samsung/galaxy-z",
      "/spare-parts/mobile-phone/samsung/galaxy-note",
      "/spare-parts/mobile-phone/samsung/galaxy-m",
      "/spare-parts/mobile-phone/samsung/galaxy-j",
      "/spare-parts/mobile-phone/samsung/galaxy-xcover",
      "/spare-parts/mobile-phone/samsung/galaxy-other",
    ],
    seriesLabels: {
      "galaxy-a": "Galaxy A",
      "galaxy-j": "Galaxy J",
      "galaxy-m": "Galaxy M",
      "galaxy-note": "Galaxy Note",
      "galaxy-other": "Galaxy Other",
      "galaxy-s": "Galaxy S",
      "galaxy-xcover": "Galaxy XCover",
      "galaxy-z": "Galaxy Z",
    },
    modelFromUrl: samsungModelFromUrl,
    extractModels: extractSamsungModels,
    excludeModelPath: (path) => /galaxy-(?:watch|tab)/i.test(path),
  },
  xiaomi: {
    brandLabel: "Xiaomi",
    importLabel: "Xiaomi",
    pathSlug: "xiaomi",
    storageFolder: "xiaomi",
    seriesPaths: [
      "/spare-parts/mobile-phone/xiaomi/mi-mix-max-series",
      "/spare-parts/mobile-phone/xiaomi/mi-series",
      "/spare-parts/mobile-phone/xiaomi/poco-shark-series",
      "/spare-parts/mobile-phone/xiaomi/redmi-note-series",
      "/spare-parts/mobile-phone/xiaomi/redmi-series",
      "/spare-parts/mobile-phone/xiaomi/xiaomi-series",
    ],
    seriesLabels: {
      "mi-mix-max-series": "Mi Mix / Max",
      "mi-series": "Mi",
      "poco-shark-series": "Poco/Shark",
      "redmi-note-series": "Redmi Note",
      "redmi-series": "Redmi",
      "xiaomi-series": "Xiaomi",
    },
    modelFromUrl: genericModelFromUrl,
    extractModels: extractGenericBrandModels,
    modelAliases: ["Xiaomi", "Redmi", "Poco", "Pocophone", "Black Shark"],
    excludeModelPath: genericNonPhoneModelPath,
  },
  honor: {
    brandLabel: "Honor",
    importLabel: "Honor",
    pathSlug: "honor",
    storageFolder: "honor",
    seriesPaths: [
      "/spare-parts/mobile-phone/honor/series-10-20-50",
      "/spare-parts/mobile-phone/honor/series-5-6-7-8-9",
      "/spare-parts/mobile-phone/honor/series-70-90-200-300-400-600",
      "/spare-parts/mobile-phone/honor/series-magic-play-view",
      "/spare-parts/mobile-phone/honor/series-play",
      "/spare-parts/mobile-phone/honor/series-x",
    ],
    seriesLabels: {
      "series-10-20-50": "Series 10/20/50",
      "series-5-6-7-8-9": "Series 5/6/7/8/9",
      "series-70-90-200-300-400": "Series 70/90/200/300/400",
      "series-70-90-200-300-400-600": "Series 70/90/200/300/400",
      "series-magic-play-view": "Series Magic / Play / View",
      "series-play": "Series Play",
      "series-x": "Series X",
    },
    modelFromUrl: genericModelFromUrl,
    extractModels: extractGenericBrandModels,
    modelAliases: ["Honor"],
    excludeModelPath: genericNonPhoneModelPath,
  },
  oppo: {
    brandLabel: "OPPO",
    importLabel: "OPPO",
    pathSlug: "oppo",
    storageFolder: "oppo",
    seriesPaths: [
      "/spare-parts/mobile-phone/oppo/a",
      "/spare-parts/mobile-phone/oppo/f",
      "/spare-parts/mobile-phone/oppo/find",
      "/spare-parts/mobile-phone/oppo/reno",
      "/spare-parts/mobile-phone/oppo/rx",
    ],
    seriesLabels: {
      a: "A",
      f: "F",
      find: "Find",
      reno: "Reno",
      rx: "RX",
    },
    modelFromUrl: genericModelFromUrl,
    extractModels: extractGenericBrandModels,
    modelAliases: ["OPPO", "Oppo"],
    excludeModelPath: genericNonPhoneModelPath,
  },
  realme: {
    brandLabel: "Realme",
    importLabel: "Realme",
    pathSlug: "realme",
    storageFolder: "realme",
    seriesPaths: [
      "/spare-parts/mobile-phone/realme/series-11-12-14-16",
      "/spare-parts/mobile-phone/realme/series-5-6-7",
      "/spare-parts/mobile-phone/realme/series-8-9-10",
      "/spare-parts/mobile-phone/realme/series-c-gt-x-p",
      "/spare-parts/mobile-phone/realme/series-narzo-note",
    ],
    seriesLabels: {
      "series-11-12-14": "Series 11/12/14/16",
      "series-11-12-14-16": "Series 11/12/14/16",
      "series-5-6-7": "Series 5/6/7",
      "series-8-9-10": "Series 8/9/10",
      "series-c-gt-x-p": "Series C/GT/X/P",
      "series-narzo-note": "Series narzo / Note",
    },
    modelFromUrl: genericModelFromUrl,
    extractModels: extractGenericBrandModels,
    modelAliases: ["Realme", "Narzo"],
    excludeModelPath: genericNonPhoneModelPath,
  },
  motorola: {
    brandLabel: "Motorola",
    importLabel: "Motorola",
    pathSlug: "motorola",
    storageFolder: "motorola",
    seriesPaths: [
      "/spare-parts/mobile-phone/motorola/edge",
      "/spare-parts/mobile-phone/motorola/moto-e",
      "/spare-parts/mobile-phone/motorola/moto-g",
      "/spare-parts/mobile-phone/motorola/moto-x-z",
      "/spare-parts/mobile-phone/motorola/razr",
      "/spare-parts/mobile-phone/motorola/series-one-c-defy",
    ],
    seriesLabels: {
      edge: "Edge",
      "moto-e": "Moto E",
      "moto-g": "Moto G",
      "moto-x-z": "Moto X/Z",
      razr: "Razr",
      "series-one-c-defy": "Series One/C/Defy",
    },
    modelFromUrl: genericModelFromUrl,
    extractModels: extractGenericBrandModels,
    modelAliases: ["Motorola", "Moto", "Razr", "Edge", "Defy"],
    excludeModelPath: genericNonPhoneModelPath,
  },
  vivo: {
    brandLabel: "Vivo",
    importLabel: "Vivo",
    pathSlug: "vivo",
    storageFolder: "vivo",
    seriesPaths: ["/spare-parts/mobile-phone/vivo/vivo"],
    modelFromUrl: genericModelFromUrl,
    extractModels: extractGenericBrandModels,
    modelAliases: ["Vivo"],
    excludeModelPath: genericNonPhoneModelPath,
  },
  tcl: {
    brandLabel: "TCL",
    importLabel: "TCL",
    pathSlug: "tcl",
    storageFolder: "tcl",
    seriesPaths: ["/spare-parts/mobile-phone/tcl/tcl"],
    modelFromUrl: genericModelFromUrl,
    extractModels: extractGenericBrandModels,
    modelAliases: ["TCL", "Tcl"],
    excludeModelPath: genericNonPhoneModelPath,
  },
};

const args = parseArgs(process.argv.slice(2));
const brandConfig = BRAND_CONFIGS[args.brand];
if (!brandConfig) {
  throw new Error(`Unsupported brand: ${args.brand}. Use one of: ${Object.keys(BRAND_CONFIGS).join(", ")}.`);
}
const STORAGE_PREFIX = `products/imported/${brandConfig.storageFolder}`;
loadEnv(".env.local");
loadEnv(".env");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const projectRef =
  process.env.SUPABASE_PROJECT_REF ??
  (existsSync(PROJECT_REF_PATH) ? readFileSync(PROJECT_REF_PATH, "utf8").trim() : "");

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
}

if (!projectRef && !args.dryRun) {
  throw new Error("Missing Supabase project ref. Link the project or set SUPABASE_PROJECT_REF.");
}

let supabaseStorageClient;
let canonicalModelNames = new Set();

const runStartedAt = new Date().toISOString();
const tempDir = mkdtempSync(join(tmpdir(), "partspro-mobilax-"));
const report = {
  modelPages: 0,
  skippedSeriesPages: 0,
  listPages: 0,
  scrapedProducts: 0,
  uniqueProducts: 0,
  duplicateReferences: 0,
  imageDownloads: 0,
  imageUploads: 0,
  imageFailures: 0,
  dbBatches: 0,
  skippedModelPages: 0,
};

try {
  console.log(`Mobilax ${brandConfig.importLabel} import started at ${runStartedAt}`);
  console.log(args.dryRun ? "Mode: dry-run" : "Mode: import");

  const modelUrls = await discoverModelUrls();
  report.modelPages = modelUrls.length;
  canonicalModelNames = new Set(modelUrls.map(modelFromUrl));
  console.log(`Discovered ${modelUrls.length} ${brandConfig.importLabel} model pages.`);

  const products = await scrapeProducts(modelUrls);
  report.uniqueProducts = products.length;
  console.log(
    `Scraped ${report.scrapedProducts} rows, ${products.length} unique products, ${report.duplicateReferences} duplicates merged.`
  );

  if (args.dryRun) {
    printSummary(products);
  } else {
    await runSql(storageSetupSql(), "storage setup and temporary upload policies");

    try {
      if (!args.skipImages) {
        await uploadProductImages(products);
      }

      if (!args.skipDb) {
        await upsertProducts(products);
        await runSql(validationSql(), "post-import validation");
      }
    } finally {
      await runSql(storageCleanupSql(), "temporary upload policy cleanup");
    }

    printSummary(products);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

function parseArgs(values) {
  const parsed = {
    brand: "apple",
    dryRun: false,
    skipImages: false,
    skipDb: false,
    limitModels: 0,
    limitProducts: 0,
    pageDelayMs: 180,
    imageConcurrency: 4,
    seriesSlugs: [],
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === "--dry-run") {
      parsed.dryRun = true;
    } else if (value === "--brand" && next) {
      parsed.brand = next.toLowerCase();
      index += 1;
    } else if ((value === "--series" || value === "--series-slug") && next) {
      parsed.seriesSlugs.push(
        ...next
          .split(",")
          .map((slug) => slug.trim().toLowerCase())
          .filter(Boolean)
      );
      index += 1;
    } else if (value === "--skip-images") {
      parsed.skipImages = true;
    } else if (value === "--skip-db") {
      parsed.skipDb = true;
    } else if (value === "--limit-models" && next) {
      parsed.limitModels = Number(next);
      index += 1;
    } else if (value === "--limit-products" && next) {
      parsed.limitProducts = Number(next);
      index += 1;
    } else if (value === "--page-delay-ms" && next) {
      parsed.pageDelayMs = Number(next);
      index += 1;
    } else if (value === "--image-concurrency" && next) {
      parsed.imageConcurrency = Math.max(1, Number(next));
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return parsed;
}

function selectedSeriesPaths() {
  if (args.seriesSlugs.length === 0) {
    return brandConfig.seriesPaths;
  }

  const available = new Map(
    brandConfig.seriesPaths.map((path) => [path.split("/").pop()?.toLowerCase(), path])
  );
  const paths = [];

  for (const slug of args.seriesSlugs) {
    const path = available.get(slug);

    if (!path) {
      throw new Error(
        `Unsupported series for ${args.brand}: ${slug}. Use one of: ${[...available.keys()].join(", ")}.`
      );
    }

    paths.push(path);
  }

  return uniqueStrings(paths);
}

function loadEnv(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);

    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

async function discoverModelUrls() {
  const urls = new Set();

  for (const seriesPath of selectedSeriesPaths()) {
    try {
      const html = await fetchText(new URL(seriesPath, MOBILAX_BASE_URL).href);
      const decoded = decodeNextFlight(html);
      collectModelUrls(html, urls);
      collectModelUrls(decoded, urls);
    } catch (error) {
      report.skippedSeriesPages += 1;
      console.warn(`Skipped series ${seriesPath}: ${error.message}`);
    }

    await delay(args.pageDelayMs);
  }

  const ordered = [...urls].sort(sortModelUrls);
  return args.limitModels > 0 ? ordered.slice(0, args.limitModels) : ordered;
}

function collectModelUrls(value, urls) {
  const seriesSlugs = selectedSeriesPaths().map((path) => path.split("/").pop()).filter(Boolean);
  const seriesPattern = seriesSlugs.map(escapeRegex).join("|");
  const linkPattern = new RegExp(
    `\\/?spare-parts/mobile-phone/${escapeRegex(brandConfig.pathSlug)}/(${seriesPattern})/([^"'<>\\\\?\\s/]+)`,
    "gi"
  );

  for (const match of value.matchAll(linkPattern)) {
    if (match[2].length < 4) {
      continue;
    }

    const path = `/spare-parts/mobile-phone/${brandConfig.pathSlug}/${match[1]}/${match[2]}`;

    if (!brandConfig.excludeModelPath(path)) {
      urls.add(path);
    }
  }
}

async function scrapeProducts(modelUrls) {
  const bySku = new Map();

  for (const [index, modelUrl] of modelUrls.entries()) {
    const model = modelFromUrl(modelUrl);
    let firstPayload;

    try {
      firstPayload = await scrapeProductPage(modelUrl, model);
    } catch (error) {
      report.skippedModelPages += 1;
      console.warn(`[${index + 1}/${modelUrls.length}] skipped ${model}: ${error.message}`);
      await delay(args.pageDelayMs);
      continue;
    }

    mergeProducts(bySku, firstPayload.products);
    report.listPages += 1;

    const totalPage = firstPayload.totalPage || 1;

    for (let page = 2; page <= totalPage; page += 1) {
      try {
        const payload = await scrapeProductPage(`${modelUrl}?page=${page}`, model);
        mergeProducts(bySku, payload.products);
        report.listPages += 1;
      } catch (error) {
        console.warn(`[${index + 1}/${modelUrls.length}] skipped ${model} page ${page}: ${error.message}`);
      }

      await delay(args.pageDelayMs);
    }

    console.log(
      `[${index + 1}/${modelUrls.length}] ${model}: ${firstPayload.total ?? bySku.size} listed, ${bySku.size} unique so far`
    );
    await delay(args.pageDelayMs);
  }

  const products = [...bySku.values()].sort((a, b) => a.sku_code.localeCompare(b.sku_code));
  return args.limitProducts > 0 ? products.slice(0, args.limitProducts) : products;
}

async function scrapeProductPage(path, model) {
  const html = await fetchText(new URL(path, MOBILAX_BASE_URL).href);
  const payload = parseMainProductPayload(html);
  const modelSeries = modelSeriesFromUrl(path, model);
  const products = (payload.products ?? [])
    .filter((product) => product?.id_mobilax_brand === 4)
    .map((product) => normalizeMobilaxProduct(product, model, modelSeries))
    .filter(Boolean);

  report.scrapedProducts += products.length;

  return {
    total: payload.total,
    totalPage: payload.totalPage,
    products,
  };
}

function parseMainProductPayload(html) {
  const decoded = decodeNextFlight(html);
  const blockIndex = decoded.indexOf("BlockRightListClient");
  const marker = '"products":{"currentPage"';
  const markerIndex = decoded.indexOf(marker, blockIndex >= 0 ? blockIndex : 0);

  if (markerIndex < 0) {
    return { products: [], total: 0, totalPage: 1 };
  }

  const objectStart = decoded.indexOf("{", markerIndex + '"products":'.length);
  const objectEnd = findBalancedEnd(decoded, objectStart, "{", "}");

  if (objectStart < 0 || objectEnd < 0) {
    return { products: [], total: 0, totalPage: 1 };
  }

  return JSON.parse(decoded.slice(objectStart, objectEnd + 1));
}

function decodeNextFlight(html) {
  const segments = [];
  const pattern = /self\.__next_f\.push\(\[1,("(?:(?:\\.)|[^"\\])*")\]\)<\/script>/g;

  for (const match of html.matchAll(pattern)) {
    segments.push(JSON.parse(match[1]));
  }

  return segments.join("");
}

function findBalancedEnd(value, start, open, close) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function normalizeMobilaxProduct(product, model, modelSeries) {
  const reference = String(product.ean13 ?? "").trim();
  const sourceId = String(product.id ?? "").trim();
  const sku_code = reference || sourceId;
  const name = String(product.name ?? product.title_name ?? product.short_name ?? "").trim();

  if (!name || (!reference && !sourceId)) {
    return null;
  }

  const compatibilityModels = uniqueStrings([model, ...brandConfig.extractModels(name)]).filter(
    isKnownModelName
  );
  const imageId = product.image_principal_id ? String(product.image_principal_id) : "";

  return {
    sku_code,
    name,
    brand: brandConfig.brandLabel,
    model,
    model_series: modelSeries,
    category: normalizeCategory(String(product.category_name ?? name)),
    quality_grade: "A",
    stock_status: "out_of_stock",
    moq: 1,
    cost_price: 0,
    retail_price: 0,
    b2b_price: 0,
    vat_mode: "IVA esclusa",
    warranty_days: 180,
    weight_gram: 0,
    stock_qty: 0,
    location: "Milano",
    batch_code: `${brandConfig.storageFolder.toUpperCase()}-${runStartedAt.slice(0, 10)}`,
    supplier: "External Supplier",
    is_battery: /battery|batteria/i.test(name),
    is_dangerous_goods: /battery|batteria/i.test(name),
    model_codes: [],
    compatibility_models: compatibilityModels,
    alternative_skus: [],
    add_on_skus: [],
    highlights: ["Import catalogo", "Stock 0"],
    status: "active",
    image_path: null,
    image_alt: name,
    gallery_image_paths: [],
    mobilax_reference: reference,
    source_url: new URL(`/${product.url ?? ""}`, MOBILAX_BASE_URL).href,
    image_source_url: imageId ? `${MOBILAX_IMAGE_BASE_URL}/${imageId}?size=bg` : "",
    image_id: imageId,
  };
}

function mergeProducts(bySku, products) {
  for (const product of products) {
    const existing = bySku.get(product.sku_code);

    if (!existing) {
      bySku.set(product.sku_code, product);
      continue;
    }

    report.duplicateReferences += 1;
    existing.compatibility_models = uniqueStrings([
      ...existing.compatibility_models,
      ...product.compatibility_models,
    ]);
  }
}

async function uploadProductImages(products) {
  const items = products.filter((product) => product.image_source_url);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const product = items[index];

      try {
        await uploadProductImage(product);
        report.imageUploads += 1;
      } catch (error) {
        report.imageFailures += 1;
        console.warn(`Image upload failed for ${product.sku_code}: ${error.message}`);
      }

      if ((index + 1) % 50 === 0 || index + 1 === items.length) {
        console.log(`Uploaded ${report.imageUploads}/${items.length} product images.`);
      }
    }
  }

  const workerCount = Math.min(args.imageConcurrency, items.length || 1);
  await Promise.all(Array.from({ length: workerCount }, worker));
}

async function uploadProductImage(product) {
  const response = await fetchWithRetry(product.image_source_url);
  const contentType = normalizeImageContentType(response.headers.get("content-type"));
  const extension = imageExtension(contentType);
  const buffer = Buffer.from(await response.arrayBuffer());
  const path = `${STORAGE_PREFIX}/${product.sku_code.toLowerCase()}-${product.image_id}.${extension}`;

  report.imageDownloads += 1;

  const { error } = await getSupabaseStorageClient().storage.from(PRODUCT_IMAGES_BUCKET).upload(path, buffer, {
    cacheControl: "31536000",
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  product.image_path = path;
  product.gallery_image_paths = [path];
}

function getSupabaseStorageClient() {
  class DisabledRealtimeWebSocket {
    constructor() {
      throw new Error("Realtime is disabled for the Mobilax import script.");
    }
  }

  supabaseStorageClient ??= createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: DisabledRealtimeWebSocket },
  });

  return supabaseStorageClient;
}

async function upsertProducts(products) {
  const batchSize = 180;

  for (let index = 0; index < products.length; index += batchSize) {
    const batch = products.slice(index, index + batchSize);
    await runSql(upsertSql(batch), `product batch ${index / batchSize + 1}`);
    report.dbBatches += 1;
  }
}

function storageSetupSql() {
  return `
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  '${PRODUCT_IMAGES_BUCKET}',
  '${PRODUCT_IMAGES_BUCKET}',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists partspro_mobilax_import_insert on storage.objects;
drop policy if exists partspro_mobilax_import_select on storage.objects;
drop policy if exists partspro_mobilax_import_update on storage.objects;

create policy partspro_mobilax_import_insert
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = '${PRODUCT_IMAGES_BUCKET}'
    and name like '${STORAGE_PREFIX}/%'
  );

create policy partspro_mobilax_import_select
  on storage.objects
  for select
  to anon
  using (
    bucket_id = '${PRODUCT_IMAGES_BUCKET}'
    and name like '${STORAGE_PREFIX}/%'
  );

create policy partspro_mobilax_import_update
  on storage.objects
  for update
  to anon
  using (
    bucket_id = '${PRODUCT_IMAGES_BUCKET}'
    and name like '${STORAGE_PREFIX}/%'
  )
  with check (
    bucket_id = '${PRODUCT_IMAGES_BUCKET}'
    and name like '${STORAGE_PREFIX}/%'
  );
`;
}

function storageCleanupSql() {
  return `
drop policy if exists partspro_mobilax_import_insert on storage.objects;
drop policy if exists partspro_mobilax_import_select on storage.objects;
drop policy if exists partspro_mobilax_import_update on storage.objects;
`;
}

function upsertSql(products) {
  const payload = products.map((product) => ({
    sku_code: product.sku_code,
    name: product.name,
    brand: product.brand,
    model: product.model,
    model_series: product.model_series,
    category: product.category,
    quality_grade: product.quality_grade,
    stock_status: product.stock_status,
    moq: product.moq,
    cost_price: product.cost_price,
    retail_price: product.retail_price,
    b2b_price: product.b2b_price,
    vat_mode: product.vat_mode,
    warranty_days: product.warranty_days,
    weight_gram: product.weight_gram,
    stock_qty: product.stock_qty,
    location: product.location,
    batch_code: product.batch_code,
    supplier: product.supplier,
    is_battery: product.is_battery,
    is_dangerous_goods: product.is_dangerous_goods,
    model_codes: product.model_codes,
    compatibility_models: product.compatibility_models,
    alternative_skus: product.alternative_skus,
    add_on_skus: product.add_on_skus,
    highlights: product.highlights,
    status: product.status,
    image_path: product.image_path,
    image_alt: product.image_alt,
    gallery_image_paths: product.gallery_image_paths,
  }));
  const json = JSON.stringify(payload);
  const tag = dollarTag(json);

  return `
with raw_payload as (
  select *
  from jsonb_to_recordset(${tag}${json}${tag}::jsonb) as x(
    sku_code text,
    name text,
    brand text,
    model text,
    model_series text,
    model_codes jsonb,
    category text,
    quality_grade text,
    stock_status text,
    moq integer,
    cost_price numeric,
    retail_price numeric,
    b2b_price numeric,
    vat_mode text,
    warranty_days integer,
    weight_gram integer,
    stock_qty integer,
    location text,
    batch_code text,
    supplier text,
    is_battery boolean,
    is_dangerous_goods boolean,
    compatibility_models jsonb,
    alternative_skus jsonb,
    add_on_skus jsonb,
    highlights jsonb,
    status text,
    image_path text,
    image_alt text,
    gallery_image_paths jsonb
  )
),
payload as (
  select
    sku_code,
    name,
    brand,
    model,
    nullif(btrim(model_series), '') as model_series,
    array(select distinct value from jsonb_array_elements_text(coalesce(model_codes, '[]'::jsonb))) as model_codes,
    category,
    quality_grade,
    stock_status,
    moq,
    cost_price,
    retail_price,
    b2b_price,
    vat_mode,
    warranty_days,
    weight_gram,
    stock_qty,
    location,
    batch_code,
    supplier,
    is_battery,
    is_dangerous_goods,
    array(select distinct value from jsonb_array_elements_text(coalesce(compatibility_models, '[]'::jsonb))) as compatibility_models,
    array(select distinct value from jsonb_array_elements_text(coalesce(alternative_skus, '[]'::jsonb))) as alternative_skus,
    array(select distinct value from jsonb_array_elements_text(coalesce(add_on_skus, '[]'::jsonb))) as add_on_skus,
    array(select distinct value from jsonb_array_elements_text(coalesce(highlights, '[]'::jsonb))) as highlights,
    status,
    image_path,
    image_alt,
    array(select distinct value from jsonb_array_elements_text(coalesce(gallery_image_paths, '[]'::jsonb))) as gallery_image_paths
  from raw_payload
),
upserted_products as (
  insert into public.products (
    sku_code,
    name,
    brand,
    model,
    model_series,
    model_codes,
    category,
    quality_grade,
    stock_status,
    moq,
    cost_price,
    retail_price,
    b2b_price,
    vat_mode,
    warranty_days,
    weight_gram,
    stock_qty,
    location,
    batch_code,
    supplier,
    is_battery,
    is_dangerous_goods,
    compatibility,
    compatibility_models,
    alternative_skus,
    add_on_skus,
    highlights,
    status,
    image_path,
    image_alt,
    gallery_image_paths
  )
  select
    sku_code,
    name,
    brand,
    model,
    model_series,
    model_codes,
    category,
    quality_grade,
    stock_status,
    moq,
    cost_price,
    retail_price,
    b2b_price,
    vat_mode,
    warranty_days,
    weight_gram,
    0,
    location,
    batch_code,
    supplier,
    is_battery,
    is_dangerous_goods,
    jsonb_build_array(jsonb_build_object('brand', brand, 'model', model, 'source', supplier)),
    compatibility_models,
    alternative_skus,
    add_on_skus,
    highlights,
    status,
    image_path,
    image_alt,
    gallery_image_paths
  from payload
  on conflict (sku_code) do update
  set
    name = excluded.name,
    brand = excluded.brand,
    model = excluded.model,
    model_series = excluded.model_series,
    model_codes = excluded.model_codes,
    category = excluded.category,
    quality_grade = excluded.quality_grade,
    stock_status = 'out_of_stock',
    moq = excluded.moq,
    cost_price = 0,
    retail_price = 0,
    b2b_price = 0,
    vat_mode = excluded.vat_mode,
    warranty_days = excluded.warranty_days,
    weight_gram = excluded.weight_gram,
    stock_qty = 0,
    location = excluded.location,
    batch_code = excluded.batch_code,
    supplier = excluded.supplier,
    is_battery = excluded.is_battery,
    is_dangerous_goods = excluded.is_dangerous_goods,
    compatibility = excluded.compatibility,
    compatibility_models = excluded.compatibility_models,
    alternative_skus = excluded.alternative_skus,
    add_on_skus = excluded.add_on_skus,
    highlights = excluded.highlights,
    status = 'active',
    image_path = coalesce(excluded.image_path, public.products.image_path),
    image_alt = excluded.image_alt,
    gallery_image_paths = case
      when array_length(excluded.gallery_image_paths, 1) is null then public.products.gallery_image_paths
      else excluded.gallery_image_paths
    end,
    updated_at = now()
  returning sku_code
),
updated_inventory as (
  update public.inventory_items as item
  set
    product_name = payload.name,
    brand = payload.brand,
    model = payload.model,
    quality_grade = payload.quality_grade,
    batch_code = payload.batch_code,
    location = payload.location,
    actual_qty = 0,
    locked_qty = 0,
    available_qty = 0,
    incoming_qty = 0,
    qc_qty = 0,
    rma_qty = 0,
    defective_qty = 0,
    supplier = payload.supplier,
    last_movement_at = now()
  from payload
  where item.sku_code = payload.sku_code
  returning item.sku_code
)
insert into public.inventory_items (
  sku_code,
  product_name,
  brand,
  model,
  quality_grade,
  batch_code,
  location,
  actual_qty,
  locked_qty,
  available_qty,
  incoming_qty,
  qc_qty,
  rma_qty,
  defective_qty,
  supplier
)
select
  payload.sku_code,
  payload.name,
  payload.brand,
  payload.model,
  payload.quality_grade,
  payload.batch_code,
  payload.location,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  payload.supplier
from payload
where not exists (
  select 1
  from public.inventory_items as item
  where item.sku_code = payload.sku_code
);
`;
}

function validationSql() {
  return `
select
  count(*) filter (where supplier = 'External Supplier' and brand = '${sqlString(brandConfig.brandLabel)}') as imported_products,
  count(*) filter (where supplier = 'External Supplier' and brand = '${sqlString(brandConfig.brandLabel)}' and stock_qty = 0 and stock_status = 'out_of_stock' and status = 'active') as zero_active_out_of_stock,
  count(*) filter (where supplier = 'External Supplier' and brand = '${sqlString(brandConfig.brandLabel)}' and image_path like '${STORAGE_PREFIX}/%') as own_storage_images
from public.products;

select
  count(*) as imported_inventory_rows,
  count(*) filter (
    where item.actual_qty = 0
      and item.available_qty = 0
      and item.incoming_qty = 0
      and item.qc_qty = 0
      and item.rma_qty = 0
      and item.defective_qty = 0
  ) as zero_quantity_rows
from public.inventory_items as item
join public.products as product on product.sku_code = item.sku_code
where product.supplier = 'External Supplier'
  and product.brand = '${sqlString(brandConfig.brandLabel)}';
`;
}

async function runSql(sql, label) {
  const file = join(tempDir, `${Date.now()}-${label.replace(/[^a-z0-9]+/gi, "-")}.sql`);
  writeFileSync(file, sql);
  console.log(`Running SQL: ${label}`);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const output = execFileSync(
        "supabase",
        ["db", "query", "--linked", "--file", file, "--output", "json"],
        { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 }
      );

      if (output.trim()) {
        console.log(output.trim());
      }

      return;
    } catch (error) {
      const stderr = error.stderr?.toString().trim();
      const stdout = error.stdout?.toString().trim();
      const message = stderr || stdout || error.message;

      if (attempt < 3 && isTransientSqlError(message)) {
        console.warn(`SQL retry ${attempt + 1}/3 for ${label}: ${message}`);
        await delay(1500 * attempt);
        continue;
      }

      throw new Error(`SQL failed for ${label}: ${message}`);
    }
  }
}

function isTransientSqlError(value) {
  return /connection reset|timeout|temporarily unavailable|econnreset|network|socket|fetch failed/i.test(
    value
  );
}

async function fetchText(url) {
  const response = await fetchWithRetry(url);
  return response.text();
}

async function fetchWithRetry(url, attempts = 5) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/*,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.8",
          "user-agent": "PartsPro catalog importer (+https://partspro.local)",
        },
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await delay(500 * attempt);
      }
    }
  }

  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCategory(value) {
  const normalized = value.toLowerCase();

  if (normalized.includes("screen") || normalized.includes("display") || normalized.includes("lcd") || normalized.includes("oled")) {
    return "Schermi";
  }

  if (normalized.includes("battery")) {
    return "Batterie";
  }

  if (normalized.includes("back") || normalized.includes("cover") || normalized.includes("housing")) {
    return "Back Cover";
  }

  if (normalized.includes("charging") || normalized.includes("dock") || normalized.includes("port") || normalized.includes("connector")) {
    return "Connettori";
  }

  if (normalized.includes("camera") || normalized.includes("lens")) {
    return "Fotocamere";
  }

  if (normalized.includes("flex") || normalized.includes("flat")) {
    return "Flat Cable";
  }

  if (normalized.includes("speaker") || normalized.includes("earpiece") || normalized.includes("buzzer")) {
    return "Speaker";
  }

  if (normalized.includes("frame") || normalized.includes("chassis")) {
    return "Frame";
  }

  return "Flat Cable";
}

function modelFromUrl(path) {
  return brandConfig.modelFromUrl(path);
}

function modelSeriesFromUrl(path, model) {
  if (args.brand === "apple") {
    return null;
  }

  const segments = path.split("/").filter(Boolean);
  const seriesSlug = segments[segments.length - 2] ?? "";
  const configuredLabel = brandConfig.seriesLabels?.[seriesSlug];

  if (configuredLabel) {
    return configuredLabel;
  }

  return inferDeviceSeries(brandConfig.brandLabel, model);
}

function inferDeviceSeries(brand, model) {
  const brandKey = String(brand ?? "").trim().toLowerCase();
  const value = String(model ?? "").replace(/\s+/g, " ").trim();

  if (!brandKey || !value || brandKey === "apple") {
    return null;
  }

  if (brandKey === "samsung") {
    if (/\bgalaxy\s+(?:z|fold)\b/i.test(value)) return "Galaxy Z";
    if (/\bgalaxy\s+note\b/i.test(value)) return "Galaxy Note";
    if (/\bgalaxy\s+xcover\b/i.test(value)) return "Galaxy Xcover";
    const match = value.match(/\bgalaxy\s+([samj])\s*\d/i);
    return match ? `Galaxy ${match[1].toUpperCase()}` : "Galaxy Other";
  }

  if (brandKey === "xiaomi") {
    if (/^mix\b/i.test(value)) return "Mi Mix / Max";
    if (/^redmi\s+note\b/i.test(value)) return "Redmi Note";
    if (/^redmi\b/i.test(value)) return "Redmi";
    if (/^(poco|pocophone)\b/i.test(value) || /^black\s+shark\b/i.test(value)) return "Poco/Shark";
    if (/^mi\s+(mix|max)\b/i.test(value)) return "Mi Mix / Max";
    if (/^mi\b/i.test(value)) return "Mi";
    return "Xiaomi";
  }

  if (brandKey === "honor") {
    if (matchesNumberSeries(value, /^(?:honor\s+)?/i, ["5", "6", "7", "8", "9"])) return "Series 5/6/7/8/9";
    if (matchesNumberSeries(value, /^(?:honor\s+)?/i, ["10", "20", "50"])) return "Series 10/20/50";
    if (matchesNumberSeries(value, /^(?:honor\s+)?/i, ["70", "90", "200", "300", "400", "600"])) return "Series 70/90/200/300/400";
    if (/\b(magic|view)\b/i.test(value) || /^(?:honor\s+)?play$/i.test(value)) return "Series Magic / Play / View";
    if (/\bplay\b/i.test(value)) return "Series Play";
    if (/\bx\s*\d/i.test(value)) return "Series X";
    return "Honor Other";
  }

  if (brandKey === "oppo") {
    if (/\bfind\b/i.test(value)) return "Find";
    if (/\breno(?:\b|\s*\d)/i.test(value)) return "Reno";
    const match = value.match(/\b(a|f|rx)\s*\d/i);
    return match ? match[1].toUpperCase() : "OPPO Other";
  }

  if (brandKey === "realme") {
    if (matchesNumberSeries(value, /^(?:realme\s+)?/i, ["5", "6", "7"])) return "Series 5/6/7";
    if (matchesNumberSeries(value, /^(?:realme\s+)?/i, ["8", "9", "10"])) return "Series 8/9/10";
    if (matchesNumberSeries(value, /^(?:realme\s+)?/i, ["11", "12", "14", "16"])) return "Series 11/12/14/16";
    if (/\b(narzo|note)\b/i.test(value)) return "Series narzo / Note";
    if (/\b(?:c\s*\d|gt(?:\s*\d|\b)|x\s*\d|p\s*\d)/i.test(value)) return "Series C/GT/X/P";
    return "Realme Other";
  }

  if (brandKey === "motorola") {
    if (/\bedge\b/i.test(value)) return "Edge";
    if (/\brazr\b/i.test(value)) return "Razr";
    if (/\bmoto\s+g(?:\b|\d)/i.test(value) || /^g\s*\d/i.test(value)) return "Moto G";
    if (/\bmoto\s+e(?:\b|\d)/i.test(value) || /^e\s*\d/i.test(value)) return "Moto E";
    if (/\bmoto\s+[xz](?:\b|\d)/i.test(value) || /^[xz]\s*\d/i.test(value)) return "Moto X/Z";
    if (/\b(one|defy|thinkphone|moto\s+c(?:\b|\d))\b/i.test(value) || /^c\s*\d/i.test(value)) return "Series One/C/Defy";
    return "Motorola Other";
  }

  if (brandKey === "vivo") {
    return "Vivo";
  }

  if (brandKey === "tcl") {
    return "TCL";
  }

  return `${brand.charAt(0).toUpperCase()}${brand.slice(1).toLowerCase()} Other`;
}

function matchesNumberSeries(model, brandPrefix, prefixes) {
  const value = model.replace(brandPrefix, "");
  return prefixes.some((prefix) => new RegExp(`^${prefix}(?:\\b|[a-z])`, "i").test(value));
}

function appleModelFromUrl(path) {
  const slug = path.split("/").pop() ?? "";
  const tokens = slug.split("-").filter(Boolean);

  if (slug === "iphone-air") {
    return "iPhone Air";
  }

  if (slug.startsWith("iphone-se")) {
    if (slug.includes("1er")) return "iPhone SE 1st Gen";
    if (slug.includes("2nd")) return "iPhone SE 2nd Gen";
    if (slug.includes("3e")) return "iPhone SE 3rd Gen";
    return "iPhone SE";
  }

  const parts = tokens.slice(1).map((token) => {
    if (/^\d+[a-z]?$/i.test(token)) return token.toUpperCase();
    if (token === "x" || token === "xr" || token === "xs") return token.toUpperCase();
    return token.charAt(0).toUpperCase() + token.slice(1);
  });

  return `iPhone ${parts.join(" ")}`.replace(/\bPro Max\b/i, "Pro Max");
}

function samsungModelFromUrl(path) {
  const slug = path.split("/").pop() ?? "";
  const tokens = slug.split("-").filter(Boolean).map(formatSamsungToken);

  return tokens.join(" ").replace(/^Galaxy\s+/i, "Galaxy ").trim();
}

function genericModelFromUrl(path) {
  const slug = path.split("/").pop() ?? "";
  return formatGenericModelSlug(slug);
}

function extractAppleModels(value) {
  const models = [];
  const pattern =
    /iPhone\s+(?:SE(?:\s+\d+(?:st|nd|rd|e|er)\s+Gen)?|Air|XS\s+Max|XS|XR|X|\d{1,2}[a-z]?(?:\s+(?:Pro\s+Max|Pro|Plus|Mini|Max))?)/gi;

  for (const match of value.matchAll(pattern)) {
    models.push(normalizeModelName(match[0]));
  }

  return models;
}

function extractSamsungModels(value) {
  const models = [];
  const pattern =
    /(?:Samsung\s+)?Galaxy\s+(?:S\d{1,2}(?:\s+(?:Ultra|Plus|Edge|FE|Lite|Mini))?(?:\s+(?:4G|5G))?(?:\s+[A-Z]\d{3,4}[A-Z]?)?|A\d{1,2}(?:s)?(?:\s+(?:4G|5G))?(?:\s+[A-Z]\d{3,4}[A-Z]?)?|Z\s+(?:Fold|Flip)\d*(?:\s+[A-Z]\d{3,4}[A-Z]?)?|Note\d{1,2}(?:\s+(?:Ultra|Plus|Lite))?(?:\s+(?:4G|5G))?(?:\s+[A-Z]\d{3,4}[A-Z]?)?|M\d{1,2}(?:s)?(?:\s+(?:4G|5G))?(?:\s+[A-Z]\d{3,4}[A-Z]?)?|J\d{1,2}(?:\s+[A-Z]\d{3,4}[A-Z]?)?|XCover\s*\d*(?:\s+Pro)?(?:\s+[A-Z]\d{3,4}[A-Z]?)?)/gi;

  for (const match of value.matchAll(pattern)) {
    models.push(normalizeSamsungModelName(match[0]));
  }

  return models;
}

function extractGenericBrandModels(value) {
  if (canonicalModelNames.size > 0) {
    return extractKnownModelNames(value);
  }

  const models = [];
  const aliases = brandConfig.modelAliases ?? [brandConfig.brandLabel];
  const aliasPattern = aliases.map(escapeRegex).join("|");
  const stopWords =
    "black|white|blue|green|gold|silver|grey|gray|purple|pink|red|orange|yellow|midnight|glowing|dazzling|mint|peach|graphite|phantom|aurora|crystal|starry|lunar|arctic|emerald|battery|back|cover|display|touchscreen|camera|dock|connector|flex|speaker|earpiece|lens|sim|tray|reader|frame|housing|chassis|original|premium|oem|refurb|pulled";
  const pattern = new RegExp(
    `\\b(?:${aliasPattern})\\s+([A-Za-z0-9][A-Za-z0-9+()./-]*(?:\\s+[A-Za-z0-9][A-Za-z0-9+()./-]*){0,7})`,
    "gi"
  );

  for (const match of value.matchAll(pattern)) {
    const raw = match[1]
      .split(new RegExp(`\\s+(?:${stopWords})\\b`, "i"))[0]
      .replace(/[(),]+$/g, "")
      .trim();

    if (raw) {
      models.push(formatGenericModelName(raw));
    }
  }

  return models;
}

function extractKnownModelNames(value) {
  const matches = [];
  const candidates = [...canonicalModelNames].sort((left, right) => right.length - left.length);

  for (const model of candidates) {
    const pattern = new RegExp(
      `(^|[^A-Za-z0-9])${modelNamePattern(model)}(?=$|[^A-Za-z0-9])`,
      "i"
    );

    if (pattern.test(value)) {
      matches.push(model);
    }
  }

  return matches;
}

function normalizeModelName(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/^iphone/i, "iPhone")
    .replace(/\bmini\b/i, "Mini")
    .replace(/\bplus\b/i, "Plus")
    .replace(/\bpro max\b/i, "Pro Max")
    .replace(/\bpro\b/i, "Pro")
    .replace(/\bair\b/i, "Air")
    .trim();
}

function normalizeSamsungModelName(value) {
  return value
    .replace(/\bSamsung\s+/i, "")
    .replace(/\s+/g, " ")
    .split(" ")
    .map(formatSamsungToken)
    .join(" ")
    .replace(/^Galaxy\s+/i, "Galaxy ")
    .trim();
}

function formatSamsungToken(token) {
  const normalized = token.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) return "";
  if (lower === "galaxy") return "Galaxy";
  if (lower === "ultra") return "Ultra";
  if (lower === "plus") return "Plus";
  if (lower === "edge") return "Edge";
  if (lower === "lite") return "Lite";
  if (lower === "mini") return "Mini";
  if (lower === "fold") return "Fold";
  if (lower === "flip") return "Flip";
  if (lower === "note") return "Note";
  if (lower === "xcover") return "XCover";
  if (lower === "pro") return "Pro";
  if (lower === "fe") return "FE";
  if (/^\d+g$/i.test(normalized)) return normalized.toUpperCase();
  if (/^note\d+[a-z]?$/i.test(normalized)) {
    return normalized.replace(/^note/i, "Note").toUpperCase().replace(/^NOTE/, "Note");
  }
  if (/^[a-z]+\d+[a-z]?$/i.test(normalized)) return normalized.toUpperCase();

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatGenericModelSlug(value) {
  return formatGenericModelName(value.replace(/-/g, " "));
}

function formatGenericModelName(value) {
  return value
    .replace(/[()]/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .split(" ")
    .map(formatGenericToken)
    .join(" ")
    .replace(/\bNxtpaper\b/g, "NXTPAPER")
    .replace(/\bRazr\b/g, "Razr")
    .replace(/\bMoto\b/g, "Moto")
    .trim();
}

function formatGenericToken(token) {
  const normalized = token.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) return "";
  if (/^\d+g$/i.test(normalized)) return normalized.toUpperCase();
  if (/^\d+[a-z]+$/i.test(normalized)) return normalized.toUpperCase();
  if (/^(?:gt|ne|nfc|nx|rx)$/i.test(normalized)) return normalized.toUpperCase();
  if (/^pro\+$/i.test(normalized)) return "Pro+";
  if (/^reno\d*/i.test(normalized)) return normalized.replace(/^reno/i, "Reno");
  if (/^[a-z]{1,5}\d+[a-z0-9]*$/i.test(normalized)) return normalized.toUpperCase();
  if (/^[a-z]+\d+[a-z0-9]*\/[a-z0-9/]+$/i.test(normalized)) return normalized.toUpperCase();
  if (/^(?:pro|max|plus|mini|lite|ultra|neo|note|smart|power|play|view|magic|edge|razr|defy|fusion|nord|se|fe)$/i.test(normalized)) {
    if (lower === "se" || lower === "fe") return normalized.toUpperCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  }
  if (/^(?:oppo|tcl)$/i.test(normalized)) return normalized.toUpperCase();
  if (/^(?:xiaomi|redmi|poco|pocophone|honor|realme|motorola|moto|vivo)$/i.test(normalized)) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function sortModelUrls(a, b) {
  return modelFromUrl(a).localeCompare(modelFromUrl(b), "en", { numeric: true });
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function isKnownModelName(value) {
  return canonicalModelNames.size === 0 || canonicalModelNames.has(value);
}

function modelNamePattern(value) {
  return escapeRegex(value).replace(/\s+/g, "[\\s/-]+");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function genericNonPhoneModelPath(path) {
  return NON_PHONE_MODEL_PATTERN.test(path);
}

function sqlString(value) {
  return String(value).replace(/'/g, "''");
}

function normalizeImageContentType(value) {
  const contentType = value?.split(";")[0]?.trim().toLowerCase();

  if (contentType === "image/png" || contentType === "image/webp" || contentType === "image/gif") {
    return contentType;
  }

  return "image/jpeg";
}

function imageExtension(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

function dollarTag(value) {
  let tag = "$partspro_mobilax_json$";
  let index = 0;

  while (value.includes(tag)) {
    index += 1;
    tag = `$partspro_mobilax_json_${index}$`;
  }

  return tag;
}

function printSummary(products) {
  console.log("Import summary:");
  console.log(JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      products.slice(0, 5).map((product) => ({
        sku: product.sku_code,
        name: product.name,
        model: product.model,
        category: product.category,
        imagePath: product.image_path,
      })),
      null,
      2
    )
  );
}
