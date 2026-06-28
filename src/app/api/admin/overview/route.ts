import { NextResponse } from "next/server";
import {
  listAdminOrders,
  listAdminProducts,
  type AdminOrder,
  type AdminOrderLine,
  type AdminProduct,
} from "@/lib/partspro-repository";
import { toPublicSku } from "@/lib/partspro-sku";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

type OverviewDomainResult<T> = {
  data: T[];
  error: string | null;
  returned: number;
  source: string;
  total: number;
};

export async function GET() {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const [ordersResult, productsResult] = await Promise.all([
    readOverviewOrders(hasAdminPermission(admin.authState, "orders.read")),
    readOverviewProducts(hasAdminPermission(admin.authState, "product.read_admin")),
  ]);
  const errors = [ordersResult.error, productsResult.error].filter(Boolean);

  return NextResponse.json({
    data: {
      orders: ordersResult.data,
      products: productsResult.data,
    },
    meta: {
      errors,
      orderSource: ordersResult.source,
      orderTotal: ordersResult.total,
      ordersReturned: ordersResult.returned,
      productSource: productsResult.source,
      productTotal: productsResult.total,
      productsReturned: productsResult.returned,
      source: "admin_overview",
    },
  });
}

async function readOverviewOrders(
  allowed: boolean
): Promise<OverviewDomainResult<ReturnType<typeof toDashboardOrderPayload>>> {
  if (!allowed) {
    return emptyDomainResult("permission_denied", "Missing orders.read permission.");
  }

  try {
    const result = await listAdminOrders({
      limit: 100,
      offset: 0,
      sort: "date_desc",
    });

    return {
      data: result.data.orders.map(toDashboardOrderPayload),
      error: null,
      returned: result.data.orders.length,
      source: result.source,
      total: result.data.total,
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
    const result = await listAdminProducts({
      limit: 100,
      offset: 0,
      sort: "updated_desc",
    });

    return {
      data: result.data.products.map(toDashboardProductPayload),
      error: null,
      returned: result.data.products.length,
      source: result.source,
      total: result.data.total,
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
    items: order.lineCount,
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
