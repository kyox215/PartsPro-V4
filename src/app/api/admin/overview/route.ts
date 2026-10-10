import { NextResponse } from "next/server";
import { buildOverviewModel, type OverviewOrder, type OverviewProduct } from "@/lib/partspro-overview-model";
import {
  readCompleteAdminOverviewOrders,
  readCompleteAdminOverviewProducts,
  type AdminOrder,
  type AdminOrderLine,
  type AdminProduct,
} from "@/lib/partspro-repository";
import { toPublicSku } from "@/lib/partspro-sku";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";
const overviewCache = new Map<string, { expiresAt: number; readStartedAt: string; readCompletedAt: string; data: [OverviewDomainResult<ReturnType<typeof toDashboardOrderPayload>>, OverviewDomainResult<ReturnType<typeof toDashboardProductPayload>>] }>();

type OverviewDomainResult<T> = {
  data: T[];
  error: string | null;
  returned: number;
  source: string;
  total: number;
};

export async function GET(request: Request) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const startedAt = new Date().toISOString();
  const ordersAllowed = hasAdminPermission(admin.authState, "orders.read");
  const productsAllowed = hasAdminPermission(admin.authState, "product.read_admin");
  const cacheKey = `${admin.authState.userId}:${ordersAllowed}:${productsAllowed}:${admin.authState.role}`;
  const cached = overviewCache.get(cacheKey);
  const cacheHit = Boolean(cached && cached.expiresAt > Date.now());
  const [ordersResult, productsResult] = cacheHit && cached ? cached.data : await Promise.all([
    readOverviewOrders(ordersAllowed), readOverviewProducts(productsAllowed),
  ]);
  const readCompletedAt = cacheHit && cached ? cached.readCompletedAt : new Date().toISOString();
  const readStartedAt = cacheHit && cached ? cached.readStartedAt : startedAt;
  if (!cacheHit && !ordersResult.error && !productsResult.error) {
    if (overviewCache.size >= 20) overviewCache.delete(overviewCache.keys().next().value!);
    overviewCache.set(cacheKey, { expiresAt: Date.now() + 30000, readStartedAt, readCompletedAt, data: [ordersResult, productsResult] });
  }
  const errors = [ordersResult.error, productsResult.error].filter(Boolean);

  const params = new URL(request.url).searchParams;
  const compact = params.get("view") === "compact";
  const range = params.get("range");
  const rangeDays = range === "30" ? 30 : range === "90" ? 90 : 7;
  const requestedZone = params.get("timeZone") ?? "UTC";
  let timeZone = "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: requestedZone });
    timeZone = requestedZone;
  } catch {
    // An invalid client zone cannot change the calendar calculation.
  }
  const requestedAnchor = params.get("anchor");
  const parsedAnchor = requestedAnchor ? new Date(requestedAnchor) : new Date();
  const anchor = Number.isNaN(parsedAnchor.getTime()) ? new Date() : parsedAnchor;
  const meta = {
    errors,
    orderSource: ordersResult.source,
    orderTotal: ordersResult.total,
    ordersReturned: ordersResult.returned,
    productSource: productsResult.source,
    productTotal: productsResult.total,
    productsReturned: productsResult.returned,
    source: "admin_overview",
    readStartedAt, readCompletedAt, cached: cacheHit,
  };

  if (errors.length) return NextResponse.json({ error: { code: "OVERVIEW_COMPLETE_READ_FAILED", message: "Complete overview unavailable.", details: { domains: errors } }, meta }, { status: 503 });

  if (compact) {
    const model = buildOverviewModel(
      ordersResult.data as OverviewOrder[],
      productsResult.data.map((product): OverviewProduct => ({
        ...product,
        status: product.stockStatus,
      })),
      rangeDays,
      anchor,
      timeZone,
    );
    return NextResponse.json({ data: { model }, meta: { ...meta, scope: "complete_authorized_domains", maxRowsPerDomain: 50000, readStartedAt, readCompletedAt } });
  }

  return NextResponse.json({
    data: {
      orders: ordersResult.data,
      products: productsResult.data,
    },
    meta,
  });
}

async function readOverviewOrders(
  allowed: boolean
): Promise<OverviewDomainResult<ReturnType<typeof toDashboardOrderPayload>>> {
  if (!allowed) {
    return emptyDomainResult("permission_denied", "Missing orders.read permission.");
  }

  try {
    const result = await readCompleteAdminOverviewOrders();
    const all = { rows: result.data.orders, total: result.data.total };

    return {
      data: all.rows.map(toDashboardOrderPayload),
      error: null,
      returned: all.rows.length,
      source: "supabase_complete",
      total: all.total,
    };
  } catch (error) {
    return emptyDomainResult("error", readErrorMessage(error));
  }
}

async function readOverviewProducts(
  allowed: boolean
): Promise<OverviewDomainResult<ReturnType<typeof toDashboardProductPayload>>> {
  if (!allowed) {
    return emptyDomainResult("permission_denied", "Missing product.read_admin permission.");
  }

  try {
    const result = await readCompleteAdminOverviewProducts();
    const all = { rows: result.data.products, total: result.data.total };

    return {
      data: all.rows.map(toDashboardProductPayload),
      error: null,
      returned: all.rows.length,
      source: "supabase_complete",
      total: all.total,
    };
  } catch (error) {
    return emptyDomainResult("error", readErrorMessage(error));
  }
}

function toDashboardOrderPayload(order: AdminOrder) {
  return {
    company: order.customer.name,
    createdAt: order.createdAt,
    id: order.orderNo,
    items: (order.lines ?? []).reduce((total, line) => total + line.quantity, 0),
    lines: (order.lines ?? []).map(toDashboardOrderLinePayload),
    paymentStatus: order.paymentStatus,
    status: order.status,
    total: order.total,
  };
}

function toDashboardOrderLinePayload(line: AdminOrderLine) {
  return {
    lineTotal: line.lineNet,
    name: line.productName,
    quantity: line.quantity,
    sku: toPublicSku(line.sku),
  };
}

function toDashboardProductPayload(product: AdminProduct) {
  return {
    availableQty: product.availableQty,
    brand: product.brand,
    catalogStatus: product.catalogStatus,
    category: product.category,
    galleryImagePaths: product.galleryImagePaths,
    galleryImageUrls: product.galleryImageUrls ?? [],
    imageAlt: product.imageAlt ?? null,
    imagePath: product.imagePath ?? null,
    imageUrl: product.imageUrl ?? null,
    lockedQty: product.lockedQty,
    name: product.name,
    price: product.b2bPrice,
    sku: toPublicSku(product.sku),
    stock: product.stockQty,
    stockStatus: product.stockStatus,
    updatedAt: product.updatedAt,
  };
}

function emptyDomainResult<T>(
  source: string,
  error: string | null = null
): OverviewDomainResult<T> {
  return {
    data: [],
    error,
    returned: 0,
    source,
    total: 0,
  };
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Admin overview data is unavailable.";
}
