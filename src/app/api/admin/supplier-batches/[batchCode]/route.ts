import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { getAdminSupplierBatchDetail } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

type SupplierBatchParams = { params: Promise<{ batchCode: string }> };

export async function GET(_request: NextRequest, { params }: SupplierBatchParams) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const { batchCode } = await params;
  const decodedBatchCode = decodeURIComponent(batchCode).trim();

  if (!decodedBatchCode) {
    return apiError(400, "INVALID_SUPPLIER_BATCH", "Supplier batch code is required.");
  }

  try {
    const result = await getAdminSupplierBatchDetail(decodedBatchCode);

    if (!result.data) {
      return apiError(404, "ADMIN_SUPPLIER_BATCH_NOT_FOUND", "Supplier batch was not found.", {
        batchCode: decodedBatchCode,
      });
    }

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
        lineCount: result.data.lines.length,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_BATCH_UNAVAILABLE",
      "Admin supplier batch detail is temporarily unavailable."
    );
  }
}
