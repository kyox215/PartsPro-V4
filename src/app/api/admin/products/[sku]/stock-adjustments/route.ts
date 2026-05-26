import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { adjustAdminProductStock } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminProductDto } from "../../_dto";
import { productStockAdjustmentSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

type ProductParams = { params: Promise<{ sku: string }> };

export async function POST(request: NextRequest, { params }: ProductParams) {
  const admin = await requireAdminApi("product.adjust_stock");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = productStockAdjustmentSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_STOCK_ADJUSTMENT", "Stock adjustment payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { sku } = await params;

  try {
    const result = await adjustAdminProductStock({
      ...parsed.data,
      sku: decodeURIComponent(sku),
    });

    return NextResponse.json({
      data: toAdminProductDto(result.data),
      meta: {
        action: parsed.data.action,
        source: result.source,
        stockQty: result.data.stockQty,
        stockStatus: result.data.stockStatus,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_PRODUCT_STOCK_ADJUSTMENT_FAILED",
      "Product stock could not be adjusted."
    );
  }
}
