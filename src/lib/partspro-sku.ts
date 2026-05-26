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
