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
  accountPricingCustomerId,
  applyAccountPriceToProduct,
  canDelegateCheckout,
  canUseStorefrontCart,
  getCurrentAccountContext,
  hasOrderableEffectivePrice,
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
    companyId: z.string().trim().uuid().optional(),
  })
  .strict();

const allowedQueryKeys = new Set(Object.keys(catalogQuerySchema.shape));
export const dynamic = "force-dynamic";
const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

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

    const account = await getCurrentAccountContext();
    const { companyId, ...catalogQuery } = result.data;
    const delegatedCheckout = canDelegateCheckout(account);
    const employeeSelfCustomerId =
      account.accountType === "employee" ? account.employeeSelfCustomer?.id : undefined;
    const assistedCustomerId = delegatedCheckout && companyId ? companyId : null;

    if (companyId && companyId !== employeeSelfCustomerId && !delegatedCheckout) {
      return apiError(403, "ASSISTED_ORDER_FORBIDDEN", "Only authorized staff can price catalog products for another customer.", {
        companyId,
      });
    }

    const buyerCustomerId =
      assistedCustomerId
        ? companyId
        : account.accountType === "employee"
          ? employeeSelfCustomerId
          : accountPricingCustomerId(account);
    const canUseCatalogCart = canUseStorefrontCart(account, assistedCustomerId);
    const showPrice = account.canViewPrices || Boolean(buyerCustomerId);
    const visibilityReason = priceVisibilityReason(account);
    const repositoryResult = await pageCatalogProducts(catalogQuery, {
      buyerCustomerId,
      includeBuyerPrices: showPrice,
    });

    return NextResponse.json(
      {
        data: repositoryResult.data.products.map((product) =>
          toCatalogProduct(product, account, { orderable: canUseCatalogCart })
        ),
        meta: {
          source: repositoryResult.source,
          total: repositoryResult.data.total,
          limit: result.data.limit,
          offset: result.data.offset,
          returned: repositoryResult.data.products.length,
          assistedOrderCustomerId: buyerCustomerId ?? null,
          currency: "EUR",
          priceVisibility:
            showPrice && visibilityReason !== "customer_needs_assignment"
              ? "visible_authenticated"
              : visibilityReason,
          vatMode: "tax_included_shipping_only",
        },
      },
      { headers: noStoreHeaders }
    );
  } catch {
    return apiError(500, "CATALOG_UNAVAILABLE", "Catalog data is temporarily unavailable.");
  }
}

function toCatalogProduct(
  product: PartProduct,
  account: AccountContext,
  priceAccess: { orderable: boolean }
) {
  const pricedProduct = applyAccountPriceToProduct(product, account);
  const hasEffectivePrice = hasOrderableEffectivePrice(pricedProduct);
  const hasSellableStock =
    pricedProduct.status !== "Out of Stock" &&
    pricedProduct.stock >= Math.max(1, pricedProduct.moq);

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
      orderable: Boolean(
        priceAccess.orderable &&
          hasEffectivePrice &&
          hasSellableStock
      ),
      visible: account.canViewPrices,
      reason: priceVisibilityReason(account),
      vatMode: "tax_included_shipping_only",
    },
    ...productPriceFields(pricedProduct, account.canViewPrices),
  };
}

function productPriceFields(product: PartProduct, visible: boolean) {
  return {
    basePrice: visible ? product.basePrice ?? null : null,
    customerLevel: visible ? product.customerLevel ?? null : null,
    discountPercent: visible ? product.discountPercent ?? null : null,
    levelDiscountAmount: visible ? product.levelDiscountAmount ?? null : null,
    levelDiscountPercent: visible ? product.levelDiscountPercent ?? null : null,
    priceGroupDiscountPercent: visible ? product.priceGroupDiscountPercent ?? null : null,
    priceResolved: Boolean(visible && product.priceResolved),
    priceSource: visible ? product.priceSource ?? null : null,
    priceVersion: visible ? product.priceVersion ?? null : null,
  };
}
