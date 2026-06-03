const hiddenSupplierToken = String.fromCharCode(77, 79, 66, 73, 76, 65, 88);
const supplierTokenPattern = new RegExp(
  `\\b${hiddenSupplierToken}\\b[\\s_-]*`,
  "gi"
);
const repeatedSeparatorPattern = /[-_]{2,}/g;
const repeatedWhitespacePattern = /\s{2,}/g;
const edgeSeparatorPattern = /^[\s_-]+|[\s_-]+$/g;

export function sanitizeSupplierText(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "";
  }

  return (
    trimmed
      .replace(supplierTokenPattern, "")
      .replace(repeatedSeparatorPattern, "-")
      .replace(repeatedWhitespacePattern, " ")
      .replace(edgeSeparatorPattern, "")
      .trim() || trimmed
  );
}

export function toPublicSku(value: string) {
  return (sanitizeSupplierText(value) || value.trim()).toUpperCase();
}

export type AdminProductSkuInput = {
  brand?: string | null;
  category?: string | null;
  grade?: string | null;
  model?: string | null;
  modelCode?: string | null;
  name?: string | null;
};

export type AdminProductSkuCandidate = {
  sku: string;
  source: "external" | "internal";
};

const adminSkuPattern = /^[A-Z0-9_+.-]{2,64}$/;

export function normalizeAdminSkuValue(value: string | null | undefined) {
  const cleaned = toPublicSku(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_+.-]+/g, "-")
    .replace(/[-_]{2,}/g, "-")
    .replace(/^[._+-]+|[._+-]+$/g, "");

  return cleaned.slice(0, 64);
}

export function isValidAdminSku(value: string | null | undefined) {
  const normalized = normalizeAdminSkuValue(value);
  return adminSkuPattern.test(normalized);
}

export function buildAdminProductSkuCandidate(
  input: AdminProductSkuInput
): AdminProductSkuCandidate {
  const externalSku = normalizeAdminSkuValue(input.modelCode);

  if (adminSkuPattern.test(externalSku)) {
    return { sku: externalSku, source: "external" };
  }

  const parts = [
    "PP",
    normalizeSkuSegment(input.brand) || "PRODUCT",
    normalizeSkuSegment(input.model) || normalizeSkuSegment(input.name) || "ITEM",
    normalizeSkuSegment(input.category) || "PART",
    normalizeSkuSegment(input.grade) || "A",
  ];
  const sku = normalizeAdminSkuValue(parts.join("-")) || "PP-PRODUCT-ITEM";

  return { sku: sku.slice(0, 64), source: "internal" };
}

export function catalogSkuLookupCandidates(value: string) {
  const trimmed = value.trim();
  const publicSku = toPublicSku(trimmed);
  const candidates = [trimmed, trimmed.toUpperCase(), publicSku];

  const legacyPrefixPattern = new RegExp(`^${hiddenSupplierToken}[-_\\s]`, "i");

  if (!legacyPrefixPattern.test(trimmed)) {
    candidates.push(`${hiddenSupplierToken}-${publicSku}`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}

function normalizeSkuSegment(value: string | null | undefined) {
  const normalized = normalizeAdminSkuValue(value);

  return normalized
    .replace(/[_.+]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
}
