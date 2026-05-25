import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  getAdminProduct,
  hideAdminProduct,
  updateAdminProduct,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { toAdminProductDto } from "../_dto";
import { productPatchSchema } from "../_schemas";

export const dynamic = "force-dynamic";

type ProductParams = { params: Promise<{ sku: string }> };

export async function GET(_request: NextRequest, { params }: ProductParams) {
  const admin = await requireAdminApi();

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

  const parsed = productPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_PAYLOAD", "Product payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { sku } = await params;

  try {
    const result = await updateAdminProduct(decodeURIComponent(sku), parsed.data);

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
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const { sku } = await params;

  try {
    const result = await hideAdminProduct(decodeURIComponent(sku));

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
