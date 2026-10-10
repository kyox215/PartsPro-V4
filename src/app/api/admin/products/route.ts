import { z } from "zod";
import { hideAdminProductsSequentially } from "@/lib/partspro-admin-bulk-hide";
import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  createAdminProduct,
  getAdminProduct,
  hideAdminProduct,
  listAdminProducts,
  updateAdminProduct,
  type AdminProductQueryInput,
} from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";
import { toAdminProductDto } from "./_dto";
import {
  missingProductCreatePermissions,
  missingProductPatchPermissions,
} from "./_permissions";
import {
  productPatchSchema,
  productQuerySchema,
  productWriteSchema,
  type ProductQueryPayload,
} from "./_schemas";
import {
  analyzeProductCompatibilityReview,
  hasCompatibilityReviewField,
  hasManagedCompatibilityPatch,
  isCompatibilityReviewConfirmed,
  mergeCompatibilityReviewProduct,
  readCompatibilityReviewConfirmation,
  toCompatibilityReviewProductInput,
} from "@/lib/partspro-compatibility-review-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, productQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  const resolvedQuery = resolveProductQuery(query.data);

  if (!resolvedQuery.ok) {
    return resolvedQuery.response;
  }

  try {
    const result = await listAdminProducts(resolvedQuery.data);

    return NextResponse.json({
      data: result.data.products.map(toAdminProductDto),
      meta: {
        source: result.source,
        summary: result.data.summary,
        total: result.data.total,
        limit: resolvedQuery.data.limit,
        offset: resolvedQuery.data.offset,
        returned: result.data.products.length,
        storefrontLinkage: "products -> catalog_public_summary/catalog_buyer_prices",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCTS_UNAVAILABLE",
      "Admin product data is temporarily unavailable."
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("product.create_draft");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const requestId = z.string().uuid().safeParse(isRecord(body.data) ? body.data.requestId : null);
  if (!requestId.success) return apiError(400, "PRODUCT_CREATION_REQUEST_REQUIRED", "Draft creation needs a stable request ID.");
  const payload = readProductPayload(body.data);
  const parsed = productWriteSchema.safeParse(payload);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "Product payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const missingPermissions = missingProductCreatePermissions(
    admin.authState,
    parsed.data
  );

  if (missingPermissions.length > 0) {
    return apiError(403, "ADMIN_PRODUCT_PERMISSION_DENIED", "Missing product create permission.", {
      missing: missingPermissions,
      role: admin.authState.role,
    });
  }

  const compatibilityReviewConfirmation = readCompatibilityReviewConfirmation(body.data);
  let compatibilityReview;

  try {
    compatibilityReview = analyzeProductCompatibilityReview(
      toCompatibilityReviewProductInput({
        ...parsed.data,
        compatibleWith: parsed.data.compatibleWith,
        compatibilityManaged: false,
      })
    );
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_COMPATIBILITY_REVIEW_UNAVAILABLE",
      "Product compatibility review could not be completed."
    );
  }

  if (
    compatibilityReview.required &&
    !isCompatibilityReviewConfirmed(compatibilityReview, compatibilityReviewConfirmation)
  ) {
    return apiError(
      422,
      "PRODUCT_COMPATIBILITY_REVIEW_REQUIRED",
      "Confirm the compatibility review before creating this product.",
      { review: compatibilityReview }
    );
  }

  try {
    const result = await createAdminProduct({
      ...parsed.data,
      requestId: requestId.data,
      catalogStatus: "draft",
    });

    return NextResponse.json(
      {
        data: toAdminProductDto(result.data),
        meta: {
          source: result.source,
          storefrontVisible: false,
          storefrontLinkage: "products -> catalog_public_summary/catalog_buyer_prices",
          workflow: "draft_created_requires_publish_action",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_CREATE_FAILED",
      "Product could not be created at this time."
    );
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const sku = readSkuPayload(body.data);

  if (!sku) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "Product SKU is required.");
  }

  const payload = readProductPatchPayload(body.data);
  const parsed = productPatchSchema.safeParse(payload);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "Product payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  if (!hasWritableProductPatch(parsed.data)) {
    return apiError(400, "ADMIN_PRODUCT_PATCH_EMPTY", "Product update payload is empty.");
  }

  const missingPermissions = missingProductPatchPermissions(admin.authState, parsed.data);

  if (missingPermissions.length > 0) {
    return apiError(403, "ADMIN_PRODUCT_PERMISSION_DENIED", "Missing product edit permission.", {
      missing: missingPermissions,
      role: admin.authState.role,
    });
  }

  if (hasCompatibilityReviewField(parsed.data)) {
    const compatibilityReviewConfirmation = readCompatibilityReviewConfirmation(body.data);
    const product = await readAdminProductForCompatibilityReview(sku);

    if (!product.ok) {
      return product.response;
    }

    let compatibilityReview;

    try {
      compatibilityReview = analyzeProductCompatibilityReview(
        mergeCompatibilityReviewProduct(
          toCompatibilityReviewProductInput(product.data),
          parsed.data
        )
      );
    } catch (error) {
      return repositoryErrorResponse(
        error,
        "ADMIN_PRODUCT_COMPATIBILITY_REVIEW_UNAVAILABLE",
        "Product compatibility review could not be completed."
      );
    }

    if (
      product.data.compatibilityManaged &&
      hasManagedCompatibilityPatch(parsed.data)
    ) {
      return apiError(
        422,
        "PRODUCT_COMPATIBILITY_MANAGED",
        "Compatibility-managed products must use the dedicated compatibility review workflow.",
        { review: compatibilityReview }
      );
    }

    if (
      compatibilityReview.required &&
      !isCompatibilityReviewConfirmed(
        compatibilityReview,
        compatibilityReviewConfirmation
      )
    ) {
      return apiError(
        422,
        "PRODUCT_COMPATIBILITY_REVIEW_REQUIRED",
        "Confirm the compatibility review before updating this product.",
        { review: compatibilityReview }
      );
    }
  }

  try {
    const result = await updateAdminProduct(sku, parsed.data);

    return NextResponse.json({
      data: toAdminProductDto(result.data),
      meta: {
        source: result.source,
        storefrontVisible: result.data.catalogStatus === "active",
        storefrontLinkage: "products -> catalog_public_summary/catalog_buyer_prices",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_UPDATE_FAILED",
      "Product could not be updated at this time."
    );
  }
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminApi("product.hide");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const skus = [...new Set(readSkusPayload(body.data))];

  if (skus.length === 0) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "At least one SKU is required.");
  }

  if (skus.some((sku) => sku.length > 64)) return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "Invalid SKU.");
  if (skus.length > 100) return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "A maximum of 100 products may be hidden per request.");
  const result = await hideAdminProductsSequentially(skus, async (sku) => {
    const saved = await hideAdminProduct(sku, "Hidden through bulk admin products API.");
    return toAdminProductDto(saved.data);
  });
  if (result.failedSku && result.products.length === 0) {
    return repositoryErrorResponse(result.error, "ADMIN_PRODUCT_DELETE_FAILED", "Products could not be hidden at this time.");
  }
  return NextResponse.json({ data: result.products, meta: {
    source: "supabase", deleted: false, action: "hidden", count: result.products.length,
    storefrontVisible: false, outcome: result.failedSku ? "partial" : "complete",
    succeededSkus: result.succeededSkus, failedSku: result.failedSku, unattemptedSkus: result.unattemptedSkus,
  } }, { status: result.failedSku ? 207 : 200 });

}

function resolveProductQuery(
  query: ProductQueryPayload
):
  | { ok: true; data: AdminProductQueryInput }
  | { ok: false; response: ReturnType<typeof apiError> } {
  if (query.status && query.catalogStatus && query.status !== query.catalogStatus) {
    return {
      ok: false,
      response: apiError(400, "INVALID_QUERY", "Product status filters conflict.", {
        status: query.status,
        catalogStatus: query.catalogStatus,
      }),
    };
  }

  const { status, ...rest } = query;

  return {
    ok: true,
    data: {
      ...rest,
      catalogStatus: query.catalogStatus ?? status,
    },
  };
}

function hasWritableProductPatch(payload: Record<string, unknown>) {
  return Object.keys(payload).some((key) => key !== "reason" && key !== "expectedUpdatedAt");
}

function readProductPayload(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.product)) {
    return payload.product;
  }

  if (isRecord(payload) && Object.prototype.hasOwnProperty.call(payload, "compatibilityReview")) {
    const product = { ...payload };
    delete product.compatibilityReview;
    return product;
  }

  return payload;
}

function readProductPatchPayload(payload: unknown) {
  const product = readProductPayload(payload);

  if (
    isRecord(payload) &&
    !isRecord(payload.product) &&
    isRecord(product) &&
    Object.prototype.hasOwnProperty.call(product, "sku")
  ) {
    const patch = { ...product };
    delete patch.sku;
    return patch;
  }

  return product;
}

async function readAdminProductForCompatibilityReview(sku: string) {
  try {
    const result = await getAdminProduct(sku);

    if (!result.data) {
      return {
        ok: false as const,
        response: apiError(404, "ADMIN_PRODUCT_NOT_FOUND", "Product was not found.", {
          sku,
        }),
      };
    }

    return { ok: true as const, data: result.data };
  } catch (error) {
    return {
      ok: false as const,
      response: repositoryErrorResponse(
        error,
        "ADMIN_PRODUCT_COMPATIBILITY_REVIEW_UNAVAILABLE",
        "Product compatibility review could not be completed."
      ),
    };
  }
}

function readSkuPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  const directSku = readString(payload.sku);

  if (directSku) {
    return directSku;
  }

  return isRecord(payload.product) ? readString(payload.product.sku) : null;
}

function readSkusPayload(payload: unknown) {
  if (!isRecord(payload)) {
    return [];
  }

  if (Array.isArray(payload.skus)) {
    return payload.skus.map(readString).filter((sku): sku is string => Boolean(sku));
  }

  const sku = readString(payload.sku);
  return sku ? [sku] : [];
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
