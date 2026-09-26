const statusAliases = {
  submitted: ["submitted", "pending_payment", "draft"],
  accepted: ["accepted", "paid"],
  completed: ["completed", "delivered"],
};
const shippingStatuses = ["accepted", "paid", "picking", "packed", "shipped"];
const reservedStatuses = ["submitted", "pending_payment", "draft", ...shippingStatuses];

// Keep selection/count/pagination in the database. The embedded inner relation
// is an existence filter; all order lines are still hydrated separately later.
export function orderListSelect(select, query) {
  return query.reservation === "overdue"
    ? `${select},reservation_filter:order_lines!inner(reserved_qty)`
    : select;
}

export function applyOrderListFilters(request, query, now = Date.now()) {
  if (query.paymentStatus === "open") request = request.neq("payment_status", "paid");
  else if (query.paymentStatus) request = request.eq("payment_status", query.paymentStatus);
  if (query.view === "payments") request = request.neq("payment_status", "paid").neq("status", "cancelled");
  if (query.view === "shipping") request = request.in("status", shippingStatuses);
  if (query.status) request = request.in("status", statusAliases[query.status] ?? [query.status]);
  if (query.stockRisk === "risk") request = request.in("stock_risk", ["low", "blocked"]);
  else if (query.stockRisk) request = request.eq("stock_risk", query.stockRisk === "unknown" ? "split" : query.stockRisk);
  if (query.reservation === "overdue") {
    request = request.in("status", reservedStatuses)
      .lte("created_at", new Date(now - 14 * 24 * 3_600_000).toISOString())
      .gt("reservation_filter.reserved_qty", 0);
  }
  return request;
}
