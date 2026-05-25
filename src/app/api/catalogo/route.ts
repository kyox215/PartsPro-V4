import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readQueryParams,
} from "@/lib/partspro-api";
import { pageCatalogProducts } from "@/lib/partspro-repository";
import { type PartProduct } from "@/lib/partspro-data";
import { canViewWholesalePrices } from "@/lib/partspro-price-access";

const catalogQuerySchema = z
  .object({
    brand: z.string().trim().min(1).max(40).optional(),
    category: z.string().trim().min(1).max(40).optional(),
    q: z.string().trim().min(2).max(80).optional(),
    model: z.string().trim().min(2).max(80).optional(),
    warehouse: z.enum(["Milano", "Roma", "Shenzhen"]).optional(),
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

    const showWholesalePrice = await canViewWholesalePrices();
    const repositoryResult = await pageCatalogProducts(result.data, {
      includeBuyerPrices: showWholesalePrice,
    });

    return NextResponse.json({
      data: repositoryResult.data.products.map((product) =>
        toCatalogProduct(product, showWholesalePrice)
      ),
      meta: {
        source: repositoryResult.source,
        total: repositoryResult.data.total,
        limit: result.data.limit,
        offset: result.data.offset,
        returned: repositoryResult.data.products.length,
        currency: "EUR",
        priceVisibility: showWholesalePrice
          ? "visible_authenticated"
          : "hidden_until_b2b_login",
        vatMode: "net_prices_plus_iva",
      },
    });
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", "Catalog data is temporarily unavailable.");
  }
}

function toCatalogProduct(product: PartProduct, showWholesalePrice: boolean) {
  return {
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    category: product.category,
    brand: product.brand,
    grade: product.grade,
    price: showWholesalePrice ? product.price : 0,
    retailPrice: showWholesalePrice ? product.retailPrice : 0,
    stock: product.stock,
    status: product.status,
    visual: product.visual,
    warehouse: product.warehouse,
    moq: product.moq,
    vatRate: product.vatRate,
    rmaDays: product.rmaDays,
    leadTime: product.leadTime,
    updatedAt: product.updatedAt,
    compatibleWith: product.compatibleWith,
    tags: product.tags,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    galleryImageUrls: product.galleryImageUrls,
    priceGate: {
      visible: showWholesalePrice,
      reason: showWholesalePrice ? "authenticated" : "b2b_login_required",
      vatMode: "net_prices_plus_iva",
    },
  };
}
