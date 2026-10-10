/** A catalog return must be same-site and retain the exact assisted customer. */
export function safeCatalogReturn(value, assistedCompanyId = null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    if (/[\\\u0000-\u001f\u007f]/.test(decodeURIComponent(value))) return null;
    const url = new URL(value, "https://partspro.invalid");
    if (url.origin !== "https://partspro.invalid" || url.pathname !== "/catalogo") return null;
    if (url.searchParams.getAll("companyId").length > 1) return null;
    const companyId = url.searchParams.get("companyId");
    if ((companyId || null) !== (assistedCompanyId || null)) return null;
    url.hash = "";
    return `${url.pathname}${url.search}`;
  } catch { return null; }
}
export function catalogBrowseKey(url, userId, companyId) {
  return `partspro:catalog-browse:${userId || "guest"}:${companyId || "self"}:${url}`;
}

/** authorizedCompanyId comes from the server's delegation gate, never returnTo. */
export function productDetailPathWithCatalogReturn(sku, returnTo, authorizedCompanyId = null) {
  const companyId = typeof authorizedCompanyId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authorizedCompanyId) ? authorizedCompanyId : null;
  const path = `/prodotto/${encodeURIComponent(sku)}`;
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  const safeReturn = safeCatalogReturn(returnTo, companyId);
  if (safeReturn) params.set("returnTo", safeReturn);
  return params.size > 0 ? `${path}?${params}` : path;
}
