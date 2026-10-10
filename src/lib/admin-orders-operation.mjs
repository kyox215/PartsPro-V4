export async function runOrderWriteAndRefresh(write, refresh, onSaved) {
  let result;
  try { result = await write(); }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Save failed" }; }
  onSaved(result);
  try { await refresh(); return { ok: true }; }
  catch (error) { return { ok: true, refreshError: error instanceof Error ? error.message : "Refresh failed" }; }
}
export function orderQueryParams(filters, page, limit = 20) {
  const params = new URLSearchParams({ limit: String(limit), offset: String((Math.max(1, page) - 1) * limit), sort: filters.sort || "operations_queue" });
  for (const key of ["customerId", "dateFrom", "dateTo", "status", "paymentStatus", "view", "stockRisk", "reservation"]) {
    if (filters[key] && filters[key] !== "all" && filters[key] !== "orders") params.set(key, filters[key]);
  }
  if (filters.q?.trim().length >= 2) params.set("q", filters.q.trim());
  return params;
}
export function combinePackingSlipDocuments(documents) {
  if (!documents.length) throw new Error("Select orders before printing");
  const styles = documents.map(html => html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? "").join("\n");
  const pages = documents.map(html => html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? "");
  if (pages.some(body => !body)) throw new Error("Packing slip could not be prepared");
  return `<!doctype html><html><head><meta charset="utf-8"><title>PartsPro</title><style>${styles}\n.print-page { break-after: page; } .print-page:last-child { break-after: auto; }</style></head><body>${pages.map(page => `<section class="print-page">${page}</section>`).join("")}</body></html>`;
}
export function orderDeepLinkFilters(filters, link) {
  const statuses = ["submitted", "accepted", "picking", "packed", "shipped", "completed", "cancelled"];
  return { ...filters, customerId: link.customerId, status: statuses.includes(link.focusStatus) ? link.focusStatus : undefined,
    paymentStatus: undefined, stockRisk: undefined, reservation: undefined, view: undefined, q: "", dateFrom: "", dateTo: "", sort: link.customerId || link.focusOrderId ? "date_desc" : "operations_queue" };
}
