const hiddenSupplierToken = String.fromCharCode(77, 79, 66, 73, 76, 65, 88);
const supplierTokenPattern = new RegExp(`\\b${hiddenSupplierToken}\\b[\\s_-]*`, "gi");
const repeatedSeparatorPattern = /[-_]{2,}/g;
const repeatedWhitespacePattern = /\s{2,}/g;
const edgeSeparatorPattern = /^[\s_-]+|[\s_-]+$/g;

export function sanitizeSupplierTextCore(value) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return (
    trimmed
      .replace(supplierTokenPattern, "")
      .replace(repeatedSeparatorPattern, "-")
      .replace(repeatedWhitespacePattern, " ")
      .replace(edgeSeparatorPattern, "")
      .trim() || trimmed
  );
}

export function toPublicSkuCore(value) {
  return (sanitizeSupplierTextCore(value) || value.trim()).toUpperCase();
}
