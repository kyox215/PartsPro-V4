import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  getAdminProduct,
  hideAdminProduct,
  updateAdminProduct,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { toAdminProductDto } from "../_dto";
import { missingProductPatchPermissions } from "../_permissions";
import { productPatchSchema } from "../_schemas";
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

type ProductParams = { params: Promise<{ sku: string }> };

export async function GET(_request: NextRequest, { params }: ProductParams) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const { sku } = await params;

  try {
    const result = await getAdminProduct(decodeURIComponent(sku));

    if (!result.data) {
      return apiError(404, "ADMIN_PRODUCT_NOT_FOUND", "Product was not found.", {
        sku,
      });
    }

    return NextResponse.json({
      data: toAdminProductDto(result.data),
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_UNAVAILABLE",
      "Product data is temporarily unavailable."
    );
  }
}

export async function PATCH(request: NextRequest, { params }: ProductParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = productPatchSchema.safeParse(readProductPayload(body.data));

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

  const { sku } = await params;
  let decodedSku: string;

  try {
    decodedSku = decodeURIComponent(sku);
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_UPDATE_FAILED",
      "Product SKU is invalid."
    );
  }

  if (hasCompatibilityReviewField(parsed.data)) {
    const compatibilityReviewConfirmation = readCompatibilityReviewConfirmation(body.data);
    let current;

    try {
      const result = await getAdminProduct(decodedSku);

      if (!result.data) {
        return apiError(404, "ADMIN_PRODUCT_NOT_FOUND", "Product was not found.", {
          sku,
        });
      }

      current = result.data;
    } catch (error) {
      return repositoryErrorResponse(
        error,
        "ADMIN_PRODUCT_COMPATIBILITY_REVIEW_UNAVAILABLE",
        "Product compatibility review could not be completed."
      );
    }

    let compatibilityReview;

    try {
      compatibilityReview = analyzeProductCompatibilityReview(
        mergeCompatibilityReviewProduct(
          toCompatibilityReviewProductInput(current),
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

    if (current.compatibilityManaged && hasManagedCompatibilityPatch(parsed.data)) {
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
    const result = await updateAdminProduct(decodedSku, parsed.data);

    return NextResponse.json({
      data: toAdminProductDto(result.data),
      meta: {
        source: result.source,
        storefrontVisible: result.data.catalogStatus === "active",
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

export async function DELETE(_request: NextRequest, { params }: ProductParams) {
  const admin = await requireAdminApi("product.hide");

  if (!admin.ok) {
    return admin.response;
  }

  const { sku } = await params;

  try {
    const result = await hideAdminProduct(
      decodeURIComponent(sku),
      "Hidden from admin product detail API."
    );

    return NextResponse.json({
      data: toAdminProductDto(result.data),
      meta: {
        source: result.source,
        deleted: false,
        action: "hidden",
        storefrontVisible: false,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_DELETE_FAILED",
      "Product could not be hidden at this time."
    );
  }
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

function hasWritableProductPatch(payload: Record<string, unknown>) {
  return Object.keys(payload).some((key) => key !== "reason");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
