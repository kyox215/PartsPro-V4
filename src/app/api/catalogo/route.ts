import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readQueryParams,
} from "@/lib/partspro-api";
import { pageCatalogProducts } from "@/lib/partspro-repository";
import { type PartProduct } from "@/lib/partspro-data";
import {
  applyAccountPriceToProduct,
  getCurrentAccountContext,
  priceVisibilityReason,
  type AccountContext,
} from "@/lib/partspro-account-context";

const catalogQuerySchema = z
  .object({
    brand: z.string().trim().min(1).max(40).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    q: z.string().trim().min(2).max(80).optional(),
    model: z.string().trim().min(2).max(80).optional(),
    modelSeries: z.string().trim().min(1).max(80).optional(),
    status: z.enum(["In Stock", "Low Stock", "Out of Stock"]).optional(),
    grade: z.enum(["A+", "A", "B", "Refurbished"]).optional(),
    minStock: z.coerce.number().int().min(0).max(10000).optional(),
    sort: z.enum(["name", "stock_desc", "updated_desc"]).default("name"),
    limit: z.coerce.number().int().min(1).max(50).default(24),
    offset: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .strict();

const allowedQueryKeys = new Set(Object.keys(catalogQuerySchema.shape));
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const parsedParams = readQueryParams(request.nextUrl.searchParams, allowedQueryKeys);

    if (!parsedParams.ok) {
      return apiError(400, "INVALID_QUERY", "Catalog query parameters are invalid.", parsedParams.details);
    }

    const result = catalogQuerySchema.safeParse(parsedParams.data);

    if (!result.success) {
      return apiError(400, "INVALID_QUERY", "Catalog query parameters are invalid.", {
        issues: formatZodIssues(result.error),
      });
    }

    const account = await getCurrentAccountContext({ ensure: true });
    const showPrice = account.canViewPrices;
    const visibilityReason = priceVisibilityReason(account);
    const repositoryResult = await pageCatalogProducts(result.data, {
      includeBuyerPrices: showPrice,
    });

    return NextResponse.json({
      data: repositoryResult.data.products.map((product) =>
        toCatalogProduct(product, account)
      ),
      meta: {
        source: repositoryResult.source,
        total: repositoryResult.data.total,
        limit: result.data.limit,
        offset: result.data.offset,
        returned: repositoryResult.data.products.length,
        currency: "EUR",
        priceVisibility:
          showPrice && visibilityReason !== "customer_needs_assignment"
            ? "visible_authenticated"
            : visibilityReason,
        vatMode: "net_prices_plus_iva",
      },
    });
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", "Catalog data is temporarily unavailable.");
  }
}

function toCatalogProduct(product: PartProduct, account: AccountContext) {
  const pricedProduct = applyAccountPriceToProduct(product, account);

  return {
    sku: pricedProduct.sku,
    slug: pricedProduct.slug,
    name: pricedProduct.name,
    category: pricedProduct.category,
    brand: pricedProduct.brand,
    grade: pricedProduct.grade,
    price: pricedProduct.price,
    retailPrice: account.canViewPrices ? pricedProduct.retailPrice : 0,
    stock: pricedProduct.stock,
    status: pricedProduct.status,
    visual: pricedProduct.visual,
    warehouse: pricedProduct.warehouse,
    moq: pricedProduct.moq,
    vatRate: pricedProduct.vatRate,
    rmaDays: pricedProduct.rmaDays,
    leadTime: pricedProduct.leadTime,
    updatedAt: pricedProduct.updatedAt,
    compatibleWith: pricedProduct.compatibleWith,
    tags: pricedProduct.tags,
    imageUrl: pricedProduct.imageUrl,
    imageAlt: pricedProduct.imageAlt,
    galleryImageUrls: pricedProduct.galleryImageUrls,
    priceGate: {
      visible: account.canViewPrices,
      reason: priceVisibilityReason(account),
      vatMode: "net_prices_plus_iva",
    },
  };
}
