// Local actual-component verification with synthetic records; never proxies business APIs.
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.resolve(process.env.ORDERS_UI_OUTPUT_DIR || "outputs/admin-orders-ui-runtime");
mkdirSync(dir, { recursive: true });
for (const name of ["entry.tsx", "build.cjs"]) {
  copyFileSync(path.join(root, "tests/fixtures/admin-orders-ui", name + ".fixture"), path.join(dir, name));
}
execFileSync(process.execPath, [path.join(dir, "build.cjs")], { cwd: root, stdio: "inherit" });
const cssRoot = path.join(root, ".next/static/css");
const css = readdirSync(cssRoot).filter(name => name.endsWith(".css")).map(name => readFileSync(path.join(cssRoot, name), "utf8")).join("\n");
const statuses = ["submitted", "accepted", "picking", "packed", "shipped", "completed", "cancelled"];
const permissions = ["orders.read", "orders.manage", "orders.danger", "wallet_refunds.read", "wallet_refunds.request", "wallet_refunds.approve"];
function records(scenario) {
  return Array.from({ length: scenario === "paging" ? 42 : 7 }, (_, index) => {
    const status = statuses[index % statuses.length];
    const closed = status === "completed" || status === "cancelled";
    const lines = [
      { id: "line-battery", sku: "300000211298", name: "Premium Battery Samsung Galaxy A22 5G A226B EB-BA226ABY", imageUrl: "/assets/battery.jpg", category: "A", batchCode: "CVBLUQU8H23", quantity: 1, pickedQty: 1, reservedQty: closed ? 0 : 1, fulfilledQty: status === "completed" ? 1 : 0, cancelledQty: 0, unitPrice: 20, lineTotal: 20 },
      { id: "line-screen", sku: "300000358627", name: scenario === "long" ? "OEM Display Touchscreen Motorola Moto G05 Black Original Service Pack con adesivo e telaio, versione professionale di ricambio a denominazione estesa" : "OEM Display Touchscreen Motorola Moto G05 Black", imageUrl: "/assets/display.png", category: "A", batchCode: "CA50KPWC8N4", quantity: 1, pickedQty: scenario === "shortage" ? 0 : 1, reservedQty: closed || scenario === "shortage" ? 0 : 1, fulfilledQty: status === "completed" ? 1 : 0, cancelledQty: scenario === "shortage" ? 1 : 0, billableQty: scenario === "shortage" ? 0 : 1, unitPrice: 40, lineTotal: 40 },
    ];
    const id = index === 0 ? "221026-F5F7D3" : `221026-DEMO${String(index + 1).padStart(2, "0")}`;
    return { id, createdAt: "2026-10-23T10:00:00.000Z", updatedAt: "2026-10-23T10:00:00.000Z", company: index === 0 ? "演示维修店" : "Officina Mobile Demo " + (index + 1), status, paymentStatus: index === 0 || index === 2 ? "unpaid" : "paid", paymentMethod: "bank_transfer", total: 64, totalNet: 60, vat: 0, shipping: 4, items: 2, stockRisk: scenario === "shortage" ? "blocked" : index === 0 ? "low" : "clear", fulfillmentStatus: status === "submitted" ? "allocated" : status === "accepted" ? "allocated" : status === "completed" ? "delivered" : status === "cancelled" ? "blocked" : status, customer: { id: "fixture-customer", name: "演示维修店", address: "Via Roma 1, 96010 Sortino (SR)", postalCode: "96010", city: "Sortino", province: "SR", partitaIva: "00000000000", priceList: "silver" }, carrier: scenario === "pickup" ? "Ritiro in sede" : "GLS", tracking: index === 4 ? "DEMO123456" : "", shippingAddress: "Via Roma 1, 96010 Sortino (SR)", service: "Standard", eta: "Da pianificare", owner: "Fixture admin", customerNote: "客户原始备注（只读）", staffNote: "", reservedQty: lines.reduce((sum, line) => sum + line.reservedQty, 0), fulfilledQty: lines.reduce((sum, line) => sum + line.fulfilledQty, 0), lockedSince: closed ? null : "2026-10-23T10:00:00.000Z", lines, walletRefunds: scenario === "shortage" ? [{ id: "fixture-refund", orderId: id, orderLineId: "line-screen", amount: 40, currency: "EUR", status: "requested", requestedAt: "2026-10-23T10:01:00Z", reason: "缺货", requestType: "shortage" }] : [], operationHistory: [{ id: "fixture-created", action: "created", eventType: "order_created", createdAt: "2026-10-23T10:00:00.000Z", note: "Synthetic order", actor: { id: "fixture-admin", label: "管理员（演示）", role: "admin" } }] };
  });
}
const runs = new Map();
function persistMetrics() {
  writeFileSync(path.join(dir, "metrics.json"), JSON.stringify([...runs].map(([run, value]) => ({ run, writes: value.writes, reads: value.reads })), null, 2));
}
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const json = (data, status = 200) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
  if (url.pathname === "/bundle.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(readFileSync(path.join(dir, "bundle.js"))); }
  if (url.pathname === "/style.css") { res.writeHead(200, { "Content-Type": "text/css" }); return res.end(css); }
  if (url.pathname.startsWith("/_next/static/media/")) {
    try { const name = path.basename(url.pathname); res.writeHead(200, { "Content-Type": "font/woff2" }); return res.end(readFileSync(path.join(root, ".next/static/media", name))); } catch { res.writeHead(404); return res.end(); }
  }
  if (url.pathname.startsWith("/assets/")) {
    const name = path.basename(url.pathname);
    if (!["battery.jpg", "display.png"].includes(name)) return json({ error: "Unknown fixture asset" }, 404);
    const asset = path.join(root, "../../outputs/account-center-mobile-preview/2026-10-18/assets", name);
    res.writeHead(200, { "Content-Type": name.endsWith("jpg") ? "image/jpeg" : "image/png" }); return res.end(readFileSync(asset));
  }
  if (!url.pathname.startsWith("/api/") && url.pathname !== "/__fixture/metrics") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}}</script><script src="/bundle.js"></script></body></html>');
  }
  const scenario = String(req.headers["x-fixture-scenario"] || "normal");
  const run = String(req.headers["x-fixture-run"] || "preview");
  const state = runs.get(run) || { orders: scenario === "empty" ? [] : records(scenario), writes: [], reads: [] };
  runs.set(run, state);
  if (url.pathname === "/__fixture/metrics") return json([...runs].map(([name, data]) => ({ name, writes: data.writes, reads: data.reads })));
  if (url.pathname === "/api/me") return json({ admin: { allowed: true, role: scenario === "readonly" ? "staff" : "admin" }, permissions: scenario === "readonly" ? ["orders.read"] : permissions });
  if (url.pathname === "/api/admin/wallet-refunds") return json({ data: state.orders.find(order => order.id === url.searchParams.get("orderId"))?.walletRefunds || [] });
  if (url.pathname === "/api/admin/orders") {
    state.reads.push(url.search); persistMetrics();
    if (scenario === "error") return json({ error: { code: "FIXTURE_UNAVAILABLE", message: "Synthetic list failure" } }, 503);
    if (scenario === "slow") await pause(700);
    let rows = state.orders.filter(order => {
      const view = url.searchParams.get("view"), status = url.searchParams.get("status"), q = url.searchParams.get("q")?.toLowerCase();
      if (status && order.status !== status) return false;
      if (view === "payments" && (order.paymentStatus === "paid" || order.status === "cancelled")) return false;
      if (view === "shipping" && !["accepted", "picking", "packed", "shipped"].includes(order.status)) return false;
      if (q && !(order.id + " " + order.company).toLowerCase().includes(q)) return false;
      if (url.searchParams.get("stockRisk") === "risk" && order.stockRisk === "clear") return false;
      return true;
    });
    const total = rows.length, offset = Number(url.searchParams.get("offset") || 0), limit = Number(url.searchParams.get("limit") || 20);
    rows = rows.slice(offset, offset + limit);
    return json({ data: rows, meta: { source: "admin_api", total, returned: rows.length } });
  }
  const match = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)(.*)$/);
  if (!match) return json({ error: { message: "Unexpected local API" } }, 404);
  const order = state.orders.find(item => item.id === decodeURIComponent(match[1]));
  if (!order) return json({ error: { message: "Synthetic order not found" } }, 404);
  if (req.method === "GET") { if (scenario === "slow") await pause(500); return json({ data: order, meta: { source: "admin_api" } }); }
  let raw = ""; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || "{}");
  state.writes.push({ path: url.pathname, method: req.method, body }); persistMetrics();
  if (scenario === "rejected" || scenario === "readonly") return json({ error: { code: "FORBIDDEN", message: "Synthetic rejected save" } }, 403);
  if (scenario === "slow") await pause(1200);
  const suffix = match[2];
  if (suffix === "/status") order.status = body.status;
  else if (suffix === "/payment") { order.paymentStatus = body.paymentStatus; order.paymentMethod = body.paymentMethod; order.paymentReconciliation = { receivedAmount: body.receivedAmount, receivedAt: body.receivedAt, reference: body.reference || "", note: body.note || "" }; }
  else if (suffix === "/shipping") { order.total += body.shippingAmount - order.shipping; order.shipping = body.shippingAmount; }
  else if (suffix.includes("/fulfillment")) { const line = order.lines.find(item => item.id === decodeURIComponent(suffix.split("/")[2])); line.pickedQty = body.actualQuantity; line.cancelledQty = line.quantity - body.actualQuantity; }
  else if (!suffix) { if (body.staffNote !== undefined) order.staffNote = body.staffNote; if (body.carrier !== undefined) order.carrier = body.carrier; if (body.tracking !== undefined) order.tracking = body.tracking; if (body.paymentMethod !== undefined) order.paymentMethod = body.paymentMethod; }
  else return json({ error: { message: "Unsupported synthetic mutation" } }, 400);
  order.updatedAt = new Date().toISOString();
  return json({ data: order, meta: { source: "admin_api" } });
});
server.listen(Number(process.env.ORDERS_UI_PORT || 3048), "127.0.0.1", () => console.log(`Order UI fixture: http://127.0.0.1:${server.address().port}/`));
