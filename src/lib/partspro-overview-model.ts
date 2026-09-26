// Aggregations for the bounded admin overview samples. Keep these calculations
// independent of React so the compact API and its tests use the same rules.
export const overviewOrderStatuses = [
  "submitted", "accepted", "picking", "packed", "shipped", "completed", "cancelled",
] as const;
export type OverviewOrderStatus = (typeof overviewOrderStatuses)[number];
export type OverviewStockStatus = "In Stock" | "Low Stock" | "Out of Stock";
export type OverviewCatalogStatus = "active" | "draft" | "hidden" | "blocked";
export type OverviewOrder = {
  id: string;
  company: string;
  createdAt: string;
  items: number;
  lines: { sku: string; name: string; quantity: number; lineTotal: number }[];
  paymentStatus: "unpaid" | "authorized" | "paid" | "refunded";
  status: OverviewOrderStatus;
  total: number;
};
export type OverviewProduct = {
  sku: string;
  name: string;
  catalogStatus: OverviewCatalogStatus;
  galleryImagePaths: string[];
  galleryImageUrls: string[];
  imageAlt?: string | null;
  imagePath?: string | null;
  imageUrl?: string | null;
  lockedQty: number;
  price: number;
  status: OverviewStockStatus;
  stock: number;
  availableQty: number;
};
export type OverviewModel = ReturnType<typeof buildOverviewModel>;

const fulfillmentQueueStatuses = new Set<OverviewOrderStatus>([
  "submitted", "accepted", "picking", "packed", "shipped",
]);

function calendarKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function addCalendarDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calendarWindow(anchorKey: string, days: number) {
  return new Set(Array.from({ length: days }, (_, index) => addCalendarDays(anchorKey, index - days + 1)));
}

function orderDay(value: string, timeZone: string) {
  const date = new Date(value);
  return calendarKey(Number.isNaN(date.getTime()) ? new Date(0) : date, timeZone);
}

function sumBy<T>(items: T[], readValue: (item: T) => number) {
  return items.reduce((total, item) => total + readValue(item), 0);
}

function buildSalesTrend(orders: OverviewOrder[], rangeDays: number, anchorKey: string, timeZone: string) {
  const buckets = new Map(Array.from({ length: rangeDays }, (_, index) => {
    const key = addCalendarDays(anchorKey, index - rangeDays + 1);
    const [, month, day] = key.split("-");
    return [key, { day: `${Number(month)}/${Number(day)}`, key, orders: 0, pieces: 0, sales: 0 }] as [string, { day: string; key: string; orders: number; pieces: number; sales: number }];
  }));
  for (const order of orders) {
    const bucket = buckets.get(orderDay(order.createdAt, timeZone));
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.pieces += order.items;
    bucket.sales += order.total;
  }
  return Array.from(buckets.values());
}

function buildSkuSales(orders: OverviewOrder[]) {
  const sales = new Map<string, { name: string; orderIds: Set<string>; quantity: number; revenue: number; sku: string }>();
  for (const order of orders) {
    for (const line of order.lines) {
      const key = line.sku.toLowerCase();
      const current = sales.get(key) ?? { name: line.name, orderIds: new Set<string>(), quantity: 0, revenue: 0, sku: line.sku };
      current.orderIds.add(order.id);
      current.quantity += line.quantity;
      current.revenue += line.lineTotal;
      sales.set(key, current);
    }
  }
  return sales;
}

function stockRisk(product: OverviewProduct, sold7d: number, coverageDays: number | null) {
  if (product.availableQty <= 0 || product.stock <= 0) return "urgent" as const;
  if (coverageDays !== null && coverageDays <= 3) return "urgent" as const;
  if (product.status === "Low Stock" || product.availableQty <= 8 || sold7d >= 5 || (coverageDays !== null && coverageDays <= 10)) return "watch" as const;
  return "ok" as const;
}

export function buildOverviewModel(
  orders: OverviewOrder[],
  products: OverviewProduct[],
  rangeDays: 7 | 30 | 90,
  anchor: Date,
  timeZone: string,
) {
  const todayKey = calendarKey(anchor, timeZone);
  const yesterdayKey = addCalendarDays(todayKey, -1);
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const sales7dWindow = calendarWindow(todayKey, 7);
  const previousSales7dWindow = calendarWindow(addCalendarDays(todayKey, -7), 7);
  const recentPaidOrders = paidOrders.filter((order) => sales7dWindow.has(orderDay(order.createdAt, timeZone)));
  const previousPaidOrders = paidOrders.filter((order) => previousSales7dWindow.has(orderDay(order.createdAt, timeZone)));
  const sales7d = sumBy(recentPaidOrders, (order) => order.total);
  const previousSales7d = sumBy(previousPaidOrders, (order) => order.total);
  const salesBySku = buildSkuSales(recentPaidOrders);
  const productBySku = new Map(products.map((product) => [product.sku.toLowerCase(), product]));
  const hotStockAlerts = products.map((product) => {
    const sold7d = salesBySku.get(product.sku.toLowerCase())?.quantity ?? 0;
    const coverageDays = sold7d > 0 ? product.availableQty / (sold7d / 7) : null;
    const risk = stockRisk(product, sold7d, coverageDays);
    const score = (risk === "urgent" ? 1000 : risk === "watch" ? 500 : 0) + sold7d * 12 - product.availableQty;
    return { alert: {
      availableQty: product.availableQty, coverageDays,
      galleryImagePaths: product.galleryImagePaths, galleryImageUrls: product.galleryImageUrls,
      imageAlt: product.imageAlt, imagePath: product.imagePath, imageUrl: product.imageUrl,
      name: product.name, risk, sku: product.sku, sold7d, stock: product.stock,
    }, score };
  }).filter(({ alert }) => alert.risk !== "ok")
    .sort((left, right) => right.score - left.score).slice(0, 5).map(({ alert }) => alert);
  const hotSku = Array.from(salesBySku.values())
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 5).map((item) => ({
      availableQty: productBySku.get(item.sku.toLowerCase())?.availableQty ?? null,
      name: productBySku.get(item.sku.toLowerCase())?.name ?? item.name,
      quantity: item.quantity, revenue: item.revenue, sku: item.sku,
    }));
  const inStock = products.filter((product) => product.status === "In Stock").length;
  const lowStock = products.filter((product) => product.status === "Low Stock").length;
  const outOfStock = products.filter((product) => product.status === "Out of Stock").length;
  const active = products.filter((product) => product.catalogStatus === "active").length;
  const draft = products.filter((product) => product.catalogStatus === "draft").length;
  const hidden = products.filter((product) => product.catalogStatus === "hidden").length;
  const blocked = products.filter((product) => product.catalogStatus === "blocked").length;
  const missingImage = products.filter((product) => !product.imageUrl).length;
  const missingPrice = products.filter((product) => product.price <= 0).length;
  const completion = products.length ? Math.round(((active + (products.length - missingImage) + (products.length - missingPrice)) / (products.length * 3)) * 100) : 0;
  return {
    activeSku: active || products.filter((product) => product.stock > 0).length,
    averageOrder7d: recentPaidOrders.length > 0 ? sales7d / recentPaidOrders.length : 0,
    catalogHealth: { active, blocked, completion, draft, hidden, missingImage, missingPrice },
    fulfillmentQueue: orders.filter((order) => fulfillmentQueueStatuses.has(order.status)).length,
    hotSku, hotStockAlerts,
    inventoryMix: [
      { fill: "#16a34a", key: "In Stock" as const, label: "In Stock", value: inStock },
      { fill: "#f59e0b", key: "Low Stock" as const, label: "Low Stock", value: lowStock },
      { fill: "#ef4444", key: "Out of Stock" as const, label: "Out of Stock", value: outOfStock },
    ],
    inventoryTotals: { available: sumBy(products, (product) => product.availableQty), inStock, locked: sumBy(products, (product) => product.lockedQty), lowStock, outOfStock },
    paidOrders7d: recentPaidOrders.length,
    pendingPayments: orders.filter((order) => order.paymentStatus !== "paid" && order.status !== "cancelled").length,
    pipeline: overviewOrderStatuses.map((status) => {
      const statusOrders = orders.filter((order) => order.status === status);
      return { count: statusOrders.length, key: status, revenue: sumBy(statusOrders, (order) => order.total) };
    }),
    previousSales7d, sales7d,
    salesTrend: buildSalesTrend(paidOrders, rangeDays, todayKey, timeZone),
    stockAlerts: lowStock + outOfStock,
    todayOrders: orders.filter((order) => orderDay(order.createdAt, timeZone) === todayKey).length,
    uniqueCustomers: new Set(orders.map((order) => order.company).filter(Boolean)).size,
    yesterdayOrders: orders.filter((order) => orderDay(order.createdAt, timeZone) === yesterdayKey).length,
  };
}
