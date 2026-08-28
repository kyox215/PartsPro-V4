import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { getAdminSupplierBatchDetail } from "@/lib/partspro-repository";
import {
  hasSupplierBatchAuditPermission,
  hasSupplierBatchHistoryPermission,
  hasSupplierBatchReadPermission,
  repositoryErrorResponse,
  requireAdminApi,
} from "../../_shared";
import { toSupplierBatchDetailDto } from "../_dto";

export const dynamic = "force-dynamic";

type SupplierBatchParams = { params: Promise<{ batchCode: string }> };

export async function GET(_request: NextRequest, { params }: SupplierBatchParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (!hasSupplierBatchReadPermission(admin.authState)) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "A supplier batch read permission is required.");
  }

  const { batchCode } = await params;
  const decodedBatchCode = decodeURIComponent(batchCode).trim();

  if (!decodedBatchCode) {
    return apiError(400, "INVALID_SUPPLIER_BATCH", "Supplier batch code is required.");
  }

  try {
    const canReadHistory = hasSupplierBatchHistoryPermission(admin.authState);
    const result = await getAdminSupplierBatchDetail(decodedBatchCode, {
      includeHistory: canReadHistory,
      includeAudit: false,
    });

    if (!result.data) {
      return apiError(404, "ADMIN_SUPPLIER_BATCH_NOT_FOUND", "Supplier batch was not found.", {
        batchCode: decodedBatchCode,
      });
    }

    const detail = toSupplierBatchDetailDto(result.data, {
      includeSensitiveAudit: hasSupplierBatchAuditPermission(admin.authState),
    });

    return NextResponse.json({
      data: detail,
      meta: {
        source: result.source,
        lineCount: detail.lines.length,
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
