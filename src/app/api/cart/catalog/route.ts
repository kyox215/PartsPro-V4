import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readQueryParams,
} from "@/lib/partspro-api";
import {
  applyAccountPriceToProduct,
  canDelegateCheckout,
  getCurrentAccountContext,
  hasOrderableEffectivePrice,
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
    checkoutMode: z.enum(["customer_self", "employee_self", "delegated_customer"]).optional(),
    companyId: z.string().trim().uuid().optional(),
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
    const delegatedCheckout = canDelegateCheckout(account);
    const requestedCompanyId = result.data.companyId;
    const checkoutMode = resolveCheckoutMode(
      account,
      result.data.checkoutMode,
      requestedCompanyId ?? null,
      delegatedCheckout
    );

    if (checkoutMode === "forbidden") {
      return apiError(403, "COMPANY_FORBIDDEN", "This customer cannot be used for cart pricing.");
    }

    const buyerCustomerId =
      requestedCompanyId && requestedCompanyId !== account.customer?.id
        ? requestedCompanyId
        : requestedCompanyId ?? undefined;
    const canResolveTargetPrices =
      account.canViewPrices ||
      Boolean(buyerCustomerId && (delegatedCheckout || checkoutMode === "employee_self"));

    const repositoryResult = await listCatalogProductsBySkus(skus, {
      buyerCustomerId,
      includeBuyerPrices: canResolveTargetPrices,
    });
    const visibilityReason = priceVisibilityReason(account);
    const requestedCartProducts = repositoryResult.data.map((product) =>
        toCartCatalogProduct(product, account, {
          orderable:
            account.canCheckout ||
            account.canEmployeeSelfCheckout ||
            account.accountType === "employee" ||
            Boolean(buyerCustomerId && delegatedCheckout),
          visible: canResolveTargetPrices,
        })
    );
    const foundSkus = new Set(requestedCartProducts.map((product) => product.sku));
    const cartProducts = requestedCartProducts.filter(
      (product) => product.priceGate.orderable
    );
    const rejectedProducts = [
      ...requestedCartProducts
        .filter((product) => !product.priceGate.orderable)
        .map(toCartCatalogRejection),
      ...skus
        .filter((sku) => !foundSkus.has(sku))
        .map((sku) => ({
          sku,
          reason: "not_found",
        })),
    ];

    return NextResponse.json({
      data: cartProducts,
      meta: {
        source: repositoryResult.source,
        requested: skus.length,
        returned: cartProducts.length,
        rejected: rejectedProducts,
        currency: "EUR",
        priceVisibility:
          canResolveTargetPrices && visibilityReason !== "customer_needs_assignment"
            ? "visible_authenticated"
            : visibilityReason,
        vatMode: "tax_included_shipping_only",
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

function toCartCatalogRejection(
  product: ReturnType<typeof toCartCatalogProduct>
) {
  return {
    sku: product.sku,
    brand: product.brand,
    category: product.category,
    grade: product.grade,
    imageAlt: product.imageAlt,
    imageUrl: product.imageUrl,
    name: product.name,
    reason: product.priceGate.reason,
    stock: product.stock,
    status: product.status,
    moq: product.moq,
    visual: product.visual,
  };
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

function resolveCheckoutMode(
  account: AccountContext,
  requestedMode: "customer_self" | "employee_self" | "delegated_customer" | undefined,
  companyId: string | null,
  delegatedCheckout: boolean
) {
  if (!companyId) {
    return account.accountType === "employee" ? "employee_self" : "customer_self";
  }

  if (account.accountType === "customer") {
    return companyId === account.customer?.id &&
      (!requestedMode || requestedMode === "customer_self")
      ? "customer_self"
      : "forbidden";
  }

  if (account.accountType !== "employee") {
    return "forbidden";
  }

  const employeeSelfId = account.employeeSelfCustomer?.id;
  const inferredMode =
    requestedMode ??
    (employeeSelfId && companyId === employeeSelfId
      ? "employee_self"
      : "delegated_customer");

  if (inferredMode === "employee_self") {
    return employeeSelfId && companyId === employeeSelfId
      ? "employee_self"
      : "forbidden";
  }

  if (inferredMode === "delegated_customer") {
    return delegatedCheckout ? "delegated_customer" : "forbidden";
  }

  return "forbidden";
}

function toCartCatalogProduct(
  product: RepositoryPartProduct,
  account: AccountContext,
  priceAccess: { orderable: boolean; visible: boolean }
) {
  const pricedProduct = product.priceResolved || product.priceVersion
    ? product
    : applyAccountPriceToProduct(product, account);
  const hasEffectivePrice = hasOrderableEffectivePrice(pricedProduct);
  const hasSellableStock =
    pricedProduct.status !== "Out of Stock" &&
    pricedProduct.stock >= Math.max(1, pricedProduct.moq);
  const blockReason = cartCatalogBlockReason(account, priceAccess, {
    hasEffectivePrice,
    hasSellableStock,
  });

  return {
    sku: pricedProduct.sku,
    slug: pricedProduct.slug,
    name: pricedProduct.name,
    category: pricedProduct.category,
    brand: pricedProduct.brand,
    grade: pricedProduct.grade,
    price: pricedProduct.price,
    retailPrice: priceAccess.visible ? pricedProduct.retailPrice : 0,
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
        priceAccess.visible &&
          priceAccess.orderable &&
          hasEffectivePrice &&
          hasSellableStock
      ),
      visible: priceAccess.visible,
      reason: blockReason,
      vatMode: "tax_included_shipping_only",
    },
    ...productPriceFields(pricedProduct, priceAccess.visible),
  };
}

function cartCatalogBlockReason(
  account: AccountContext,
  priceAccess: { orderable: boolean; visible: boolean },
  state: { hasEffectivePrice: boolean; hasSellableStock: boolean }
) {
  if (!state.hasSellableStock) {
    return "unavailable";
  }

  if (!priceAccess.visible) {
    return priceVisibilityReason(account);
  }

  if (!state.hasEffectivePrice) {
    return "price_unavailable";
  }

  if (!priceAccess.orderable) {
    return priceVisibilityReason(account);
  }

  return priceVisibilityReason(account);
}

function productPriceFields(product: RepositoryPartProduct, visible: boolean) {
  return {
    basePrice: visible ? product.basePrice ?? null : null,
    customerLevel: visible ? product.customerLevel ?? null : null,
    discountPercent: visible ? product.discountPercent ?? null : null,
    levelDiscountPercent: visible ? product.levelDiscountPercent ?? null : null,
    priceGroupDiscountPercent: visible ? product.priceGroupDiscountPercent ?? null : null,
    priceResolved: Boolean(visible && product.priceResolved),
    priceSource: visible ? product.priceSource ?? null : null,
    priceVersion: visible ? product.priceVersion ?? null : null,
  };
}
