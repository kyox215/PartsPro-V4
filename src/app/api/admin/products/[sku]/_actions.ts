import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues } from "@/lib/partspro-api";
import {
  blockAdminProduct,
  hideAdminProduct,
  publishAdminProduct,
  restoreAdminProductDraft,
} from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { toAdminProductDto } from "../_dto";
import { productActionSchema } from "../_schemas";

type ProductAction = "block" | "hide" | "publish" | "restore";
type ProductActionParams = { params: Promise<{ sku: string }> };

export async function runProductAction(
  action: ProductAction,
  request: NextRequest,
  { params }: ProductActionParams
) {
  const permission =
    action === "hide"
      ? "product.hide"
      : action === "block"
        ? "product.block"
        : action === "restore"
          ? "product.restore_draft"
          : "product.publish";
  const admin = await requireAdminApi(permission);

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readOptionalJsonBody(request);
  const parsed = productActionSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PRODUCT_ACTION", "Product action payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  const reason = parsed.data.reason ?? `Product ${action} from admin API.`;

  try {
    const result =
      action === "publish"
        ? await publishAdminProduct(decodedSku, reason)
        : action === "hide"
          ? await hideAdminProduct(decodedSku, reason)
          : action === "block"
            ? await blockAdminProduct(decodedSku, reason)
            : await restoreAdminProductDraft(decodedSku, reason);

    return NextResponse.json({
      data: toAdminProductDto(result.data),
      meta: {
        action,
        source: result.source,
        storefrontVisible: result.data.catalogStatus === "active",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_ACTION_FAILED",
      "Product action could not be completed."
    );
  }
}

async function readOptionalJsonBody(request: NextRequest) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { reason: "" };
  }
}
