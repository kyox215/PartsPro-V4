import { toPublicSkuCore } from "./partspro-sku-core.mjs";

export function normalizeProductImportHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeProductImportSku(value) {
  return toPublicSkuCore(String(value ?? ""));
}

export function splitProductImportList(value) {
  return [...new Set(String(value ?? "").split(/[;\n]/).map((item) => item.trim()).filter(Boolean))];
}

export function shouldSkipProductImportUpdate(operation, changeCount, issueCount) {
  return operation === "update" && changeCount === 0 && issueCount === 0;
}

export function parseProductImportDelimited(input) {
  const text = String(input ?? "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

/**
 * Return a deterministic, client-safe compatibility completeness review.
 *
 * This is intentionally a candidate detector only.  It records evidence from
 * a product title and compares it with the legacy structured fields; it never
 * infers or writes a compatibility relation.
 */
export function analyzeProductCompatibilityReview(input = {}) {
  const value = isRecord(input) ? input : {};
  const normalized = normalizeCompatibilityInput(value);
  const title = [normalized.name, normalized.brand, normalized.model]
    .filter(Boolean)
    .join(" ");
  const titleSignals = detectCompatibilitySignals(title, normalized.brand);
  const structuredModels = collectStructuredModels(
    normalized.compatibilityModels,
    normalized.modelCodes,
    normalized.model,
    normalized.brand
  );
  const structuredModelCount = structuredModels.length;
  const titleModelCount = titleSignals.models.length;
  const hasMultiModelSignal = titleModelCount > 1;
  const hasMultiBrandSignal = titleSignals.brands.length > 1;
  const multiDeviceSignal = hasMultiModelSignal || hasMultiBrandSignal;
  const coverageIncomplete = multiDeviceSignal && !hasSufficientCoverage(titleSignals, structuredModels);
  const reasonCodes = [];
  if (hasMultiBrandSignal) reasonCodes.push("MULTI_BRAND_TITLE");
  if (hasMultiModelSignal) reasonCodes.push("MULTI_MODEL_TITLE");
  if (coverageIncomplete) reasonCodes.push("STRUCTURED_MODELS_INCOMPLETE");

  const signals = [];
  if (hasMultiBrandSignal) {
    signals.push(`title brands: ${titleSignals.brands.join(", ")}`);
  }
  if (hasMultiModelSignal) {
    signals.push(`title models: ${titleSignals.models.join(", ")}`);
  }
  if (coverageIncomplete) {
    signals.push(`structured models: ${structuredModels.length ? structuredModels.join(", ") : "none"}`);
  }

  return {
    required: multiDeviceSignal && (normalized.compatibilityManaged !== true || coverageIncomplete),
    reasonCodes,
    signalCount: signals.length,
    structuredModelCount,
    signals,
    fingerprint: compatibilityFingerprint(normalized),
  };
}

const compatibilityBrandPatterns = [
  ["OnePlus", /\bone\s*plus\b/i],
  ["OPPO", /\boppo\b/i],
  ["Realme", /\brealme\b/i],
  ["Xiaomi", /\bxiaomi\b/i],
  ["Redmi", /\bredmi\b/i],
  ["POCO", /\bpoco\b/i],
  ["Huawei", /\bhuawei\b/i],
  ["Honor", /\bhonor\b/i],
  ["Samsung", /\bsamsung\b/i],
  ["Apple", /\bapple\b/i],
  ["iPhone", /\biphone\b/i],
  ["Vivo", /\bvivo\b/i],
  ["Nokia", /\bnokia\b/i],
  ["Motorola", /\bmotorola\b/i],
  ["Google", /\bgoogle\b/i],
  ["Sony", /\bsony\b/i],
  ["Asus", /\basus\b/i],
  ["ZTE", /\bzte\b/i],
  ["Lenovo", /\blenovo\b/i],
];

const compatibilityNoiseWords = new Set([
  "black", "blue", "green", "grey", "gray", "gold", "pink", "purple", "red",
  "white", "yellow", "orange", "silver", "midnight", "ocean", "schwarz", "nero",
  "bianco", "blu", "verde", "giallo", "rosa", "display", "screen", "touchscreen",
  "lcd", "oled", "amoled", "original", "premium", "oem", "replacement", "battery",
  "batterie", "batteria", "flex", "cable", "connector", "speaker", "camera", "sensor",
  "digitizer", "housing", "cover", "glass", "assembly", "for", "with", "and", "the",
  "phone", "smartphone", "tablet", "mobile", "4g", "5g", "lte", "dual", "single",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeCompatibilityInput(input) {
  return {
    name: normalizeText(input.name),
    brand: normalizeText(input.brand),
    model: normalizeText(input.model),
    compatibilityModels: normalizeList(input.compatibilityModels),
    modelCodes: normalizeList(input.modelCodes),
    compatibilityManaged: input.compatibilityManaged === true,
  };
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeList(value) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? "").split(/[;,\n|]/);
  return [...new Set(values
    .map(normalizeText)
    .flatMap((entry) => entry.split(/[;\n|]/))
    .map((entry) => entry.trim())
    .filter(Boolean))];
}

function detectCompatibilitySignals(title, declaredBrand) {
  const brandTokens = [];
  for (const [brand, pattern] of compatibilityBrandPatterns) {
    if (pattern.test(title) && !brandTokens.includes(brand)) brandTokens.push(brand);
  }
  const explicitBrand = normalizeBrand(declaredBrand);
  if (explicitBrand && !brandTokens.includes(explicitBrand) && title.toLowerCase().includes(explicitBrand.toLowerCase())) {
    brandTokens.push(explicitBrand);
  }

  const brands = [...new Set(brandTokens.map(normalizeBrandFamily))];
  const models = extractMarketingModels(title, brandTokens);
  return { brands, models };
}

function normalizeBrand(value) {
  const text = normalizeText(value).toLowerCase();
  for (const [brand, pattern] of compatibilityBrandPatterns) {
    if (pattern.test(text)) return brand;
  }
  return normalizeText(value);
}

function normalizeBrandFamily(value) {
  const brand = normalizeBrand(value);
  if (brand === "Redmi" || brand === "POCO") return "Xiaomi";
  if (brand === "iPhone") return "Apple";
  return brand;
}

function extractMarketingModels(title, brands) {
  const cleaned = title
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\b(?:RMX|CPH|SM|V|EB|XT|TA|M)\s*[-_]?\d{3,}[A-Z0-9]*\b/gi, " ")
    .replace(/\bA\s*\d{3,}[A-Z]?\b/gi, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b\d{5,}\b/g, " ")
    .replace(/[;,|]/g, "/")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  const pieces = cleaned.split(/\s*\/\s*/).flatMap((piece) => splitAdjacentBrandModels(piece, brands));
  const models = [];
  for (const piece of pieces) {
    const model = normalizeModelCandidate(piece, brands);
    if (model && !models.some((entry) => sameModel(entry, model))) models.push(model);
  }
  return models;
}

function splitAdjacentBrandModels(piece, brands) {
  let remainder = piece;
  const chunks = [];
  const brandPattern = new RegExp(`\\b(?:${brands.map(escapeRegExp).join("|")})\\b`, "ig");
  let match;
  let lastIndex = 0;
  while ((match = brandPattern.exec(piece))) {
    if (match.index > lastIndex) chunks.push(piece.slice(lastIndex, match.index));
    remainder = piece.slice(match.index + match[0].length);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex > 0) {
    chunks.push(remainder);
    return chunks;
  }
  return [piece];
}

function normalizeModelCandidate(value, brands) {
  let candidate = normalizeText(value)
    .replace(/^[\s/:-]+|[\s/:-]+$/g, "")
    .replace(/\b(?:RMX|CPH|SM|V|EB|XT|TA|M)\s*[-_]?\d{3,}[A-Z0-9]*\b/gi, " ")
    .replace(/\bA\s*\d{3,}[A-Z]?\b/gi, " ")
    .replace(/\b(?:black|blue|green|grey|gray|gold|pink|purple|red|white|yellow|orange|silver|midnight|ocean|schwarz|nero|bianco|blu|verde|giallo|rosa)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const brand of brands) {
    candidate = candidate.replace(new RegExp(`\\b${escapeRegExp(brand)}\\b`, "ig"), " ");
  }
  candidate = candidate.replace(/^(?:for|with|and|the)\s+/i, "").trim();
  candidate = candidate
    .split(/\s+/)
    .filter((word, _, words) => (
      !compatibilityNoiseWords.has(word.toLowerCase())
      || (isNetworkToken(word) && words.length > 1)
    ))
    .join(" ")
    .trim();
  if (!candidate || isNoiseCandidate(candidate)) return "";
  if (isAliasOnly(candidate)) return "";
  return candidate;
}

function isNetworkToken(value) {
  return /^(?:4g|5g|lte)$/i.test(value);
}

function isNoiseCandidate(value) {
  const words = value.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  return words.every((word) => compatibilityNoiseWords.has(word));
}

function isAliasOnly(value) {
  const normalized = value.replace(/[\s/_-]+/g, "");
  return /^(?:rmx|cph)\d+[a-z]*$/i.test(normalized)
    || /^a145[a-z]*$/i.test(normalized)
    || /^(?:sm|xt|ta|eb|v|m)\d{3,}[a-z]*$/i.test(normalized)
    || /^\d{4,}$/.test(normalized);
}

function collectStructuredModels(compatibilityModels, modelCodes, model, brand) {
  const values = [...compatibilityModels, ...modelCodes, model];
  const brands = [
    ...compatibilityBrandPatterns.map(([knownBrand]) => knownBrand),
    ...(brand ? [normalizeBrand(brand)] : []),
  ];
  const models = [];
  for (const value of values) {
    const candidate = normalizeModelCandidate(value, brands);
    if (!candidate || isAliasOnly(candidate)) continue;
    if (!models.some((entry) => sameModel(entry, candidate))) models.push(candidate);
  }
  return models;
}

function hasSufficientCoverage(titleSignals, structuredModels) {
  if (titleSignals.models.length <= 1 && titleSignals.brands.length <= 1) return true;
  if (structuredModels.length < titleSignals.models.length) return false;
  const structuredIdentities = structuredModels.map(normalizeModelIdentity);
  const usedStructured = new Set();
  return titleSignals.models.every((candidate) => {
    const identity = normalizeModelIdentity(candidate);
    const matchIndex = structuredIdentities.findIndex(
      (structuredIdentity, index) => !usedStructured.has(index) && structuredIdentity === identity
    );
    if (matchIndex < 0) return false;
    usedStructured.add(matchIndex);
    return true;
  });
}

function normalizeModelIdentity(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sameModel(left, right) {
  return normalizeModelIdentity(left) === normalizeModelIdentity(right);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compatibilityFingerprint(normalized) {
  const serialized = JSON.stringify([
    normalized.name,
    normalized.brand,
    normalized.model,
    normalized.compatibilityModels,
    normalized.modelCodes,
    normalized.compatibilityManaged,
  ]);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `compat-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
