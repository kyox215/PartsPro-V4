/** A catalog return must be same-site and retain the exact assisted customer. */
export function safeCatalogReturn(value, assistedCompanyId = null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://partspro.invalid");
    if (url.origin !== "https://partspro.invalid" || url.pathname !== "/catalogo") return null;
    const companyId = url.searchParams.get("companyId");
    if ((companyId || null) !== (assistedCompanyId || null)) return null;
    url.hash = "";
    return `${url.pathname}${url.search}`;
  } catch { return null; }
}
export function catalogBrowseKey(url, userId, companyId) {
  return `partspro:catalog-browse:${userId || "guest"}:${companyId || "self"}:${url}`;
}
