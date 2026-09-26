import assert from "node:assert/strict";
import { test } from "node:test";
import { PostgrestClient } from "@supabase/postgrest-js";
import { applyOrderListFilters, orderListSelect } from "../src/lib/partspro-order-list-filters.mjs";

class Orders {
  constructor(rows) { this.rows = rows; }
  filter(predicate) { this.rows = this.rows.filter(predicate); return this; }
  eq(key, value) { return this.filter((row) => row[key] === value); }
  neq(key, value) { return this.filter((row) => row[key] !== value); }
  in(key, values) { return this.filter((row) => values.includes(row[key])); }
  lte(key, value) { return this.filter((row) => row[key] <= value); }
  gt(key, value) { return this.filter((row) => key === "reservation_filter.reserved_qty"
    ? row.lines.some((line) => line.reserved_qty > value) : row[key] > value); }
  range(from, to) { return { total: this.rows.length, data: this.rows.slice(from, to + 1) }; }
}
const now = Date.parse("2026-09-26T12:00:00Z");
const row = (id, extra = {}) => ({ id, status: "submitted", payment_status: "pending", stock_risk: "clear", created_at: "2026-09-01T12:00:00.000Z", lines: [{ reserved_qty: 1 }], ...extra });

test("unknown UI stock risk selects the stored split status", () => {
  const rows = [row(1), row(2, { stock_risk: "split" }), row(3, { stock_risk: "blocked" })];
  assert.deepEqual(applyOrderListFilters(new Orders(rows), { stockRisk: "unknown" }, now).rows.map((r) => r.id), [2]);
});

test("risk filtering reaches matching orders beyond the old 100-row window before pagination", () => {
  const rows = Array.from({ length: 180 }, (_, index) => row(index, { stock_risk: index >= 100 ? "low" : "clear" }));
  const result = applyOrderListFilters(new Orders(rows), { stockRisk: "risk" }, now).range(40, 59);
  assert.equal(result.total, 80);
  assert.deepEqual(result.data.map((r) => r.id), Array.from({ length: 20 }, (_, i) => 140 + i));
});

test("overdue requires an open order, positive reserved quantity and at least fourteen days", () => {
  const rows = [row(1), row(2, { status: "completed" }), row(3, { lines: [{ reserved_qty: 0 }] }),
    row(4, { created_at: "2026-09-12T12:00:00.000Z" }),
    row(5, { created_at: "2026-09-12T12:00:00.001Z" }), row(6, { status: "paid" })];
  assert.deepEqual(applyOrderListFilters(new Orders(rows), { reservation: "overdue" }, now).range(0, 19).data.map((r) => r.id), [1, 4, 6]);
});

test("legacy status aliases and payment/shipping views keep their UI meaning", () => {
  const rows = [row(1, { status: "draft" }), row(2, { status: "pending_payment" }), row(3, { status: "paid" }),
    row(4, { status: "cancelled" }), row(5, { status: "accepted", payment_status: "paid" })];
  assert.deepEqual(applyOrderListFilters(new Orders(rows), { status: "submitted" }, now).rows.map((r) => r.id), [1, 2]);
  assert.deepEqual(applyOrderListFilters(new Orders(rows), { view: "shipping", paymentStatus: "open" }, now).rows.map((r) => r.id), [3]);
  assert.deepEqual(applyOrderListFilters(new Orders(rows), { view: "payments" }, now).rows.map((r) => r.id), [1, 2, 3]);
});

test("Supabase request filters and exact count precede the requested range without expanding order payload", async () => {
  let captured;
  const client = new PostgrestClient("https://example.supabase.co/rest/v1", {
    fetch: async (url, init) => {
      captured = { url: new URL(url), headers: new Headers(init.headers) };
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" } });
    },
  });
  const query = { reservation: "overdue", stockRisk: "risk", status: "submitted" };
  await applyOrderListFilters(client.from("orders").select(orderListSelect("id,status", query), { count: "exact" }), query, now).range(20, 39);
  assert.equal(captured.url.searchParams.get("select"), "id,status,reservation_filter:order_lines!inner(reserved_qty)");
  assert.equal(captured.url.searchParams.get("reservation_filter.reserved_qty"), "gt.0");
  assert.equal(captured.url.searchParams.get("created_at"), "lte.2026-09-12T12:00:00.000Z");
  assert.equal(captured.url.searchParams.get("offset"), "20");
  assert.equal(captured.url.searchParams.get("limit"), "20");
  assert.equal(captured.headers.get("prefer"), "count=exact");
});
