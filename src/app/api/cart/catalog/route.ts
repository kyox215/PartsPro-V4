import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readQueryParams,
} from "@/lib/partspro-api";
import {
  applyAccountPriceToProduct,
  getCurrentAccountContext,
  priceVisibilityReason,
  type AccountContext,
} from "@/lib/partspro-account-context";
import {
  listCatalogProductsBySkus,
  type RepositoryPartProduct,
} from "@/lib/partspro-repository";
import { toPublicSku } from "@/lib/partspro-sku";

const maxCartCatalogSkus = 50;
const cartCatalogQuerySchema = z
  .object({
    skus: z.string().trim().min(1).max(4096),
  })
  .strict();
const allowedQueryKeys = new Set(Object.keys(cartCatalogQuerySchema.shape));

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const parsedParams = readQueryParams(
      request.nextUrl.searchParams,
      allowedQueryKeys
    );

    if (!parsedParams.ok) {
      return apiError(
        400,
        "INVALID_QUERY",
        "Cart catalog query parameters are invalid.",
        parsedParams.details
      );
    }

    const result = cartCatalogQuerySchema.safeParse(parsedParams.data);

    if (!result.success) {
      return apiError(400, "INVALID_QUERY", "Cart catalog query parameters are invalid.", {
        issues: formatZodIssues(result.error),
      });
    }

    const skus = readSkuList(result.data.skus);

    if (skus.length === 0) {
      return apiError(400, "INVALID_SKUS", "At least one valid SKU is required.");
    }

    if (skus.length > maxCartCatalogSkus) {
      return apiError(400, "TOO_MANY_SKUS", "Too many cart SKUs were requested.", {
        max: maxCartCatalogSkus,
      });
    }

    const account = await getCurrentAccountContext({ ensure: true });
    const repositoryResult = await listCatalogProductsBySkus(skus, {
      includeBuyerPrices: account.canViewPrices,
    });
    const visibilityReason = priceVisibilityReason(account);

    return NextResponse.json({
      data: repositoryResult.data.map((product) =>
        toCartCatalogProduct(product, account)
      ),
      meta: {
        source: repositoryResult.source,
        requested: skus.length,
        returned: repositoryResult.data.length,
        currency: "EUR",
        priceVisibility:
          account.canViewPrices && visibilityReason !== "customer_needs_assignment"
            ? "visible_authenticated"
            : visibilityReason,
        vatMode: "net_prices_plus_iva",
      },
    });
  } catch {
    return apiError(
      500,
      "CART_CATALOG_UNAVAILABLE",
      "Cart catalog data is temporarily unavailable."
    );
  }
}

function readSkuList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((sku) => toPublicSku(sku))
        .filter((sku) => /^[A-Z0-9_+.-]{3,64}$/.test(sku))
    )
  );
}

function toCartCatalogProduct(
  product: RepositoryPartProduct,
  account: AccountContext
) {
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
