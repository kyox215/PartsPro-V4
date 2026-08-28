import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { listAdminSupplierBatchCostHistoryV2 } from "@/lib/partspro-repository";
import { toSupplierBatchCostHistoryDto } from "../../../_dto";
import {
  hasSupplierBatchHistoryPermission,
  repositoryErrorResponse,
  requireAdminApi,
} from "../../../../_shared";

export const dynamic = "force-dynamic";

type SupplierBatchChargeParams = {
  params: Promise<{ batchCode: string }>;
};

export async function GET(_request: NextRequest, { params }: SupplierBatchChargeParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (!hasSupplierBatchHistoryPermission(admin.authState)) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "A supplier batch read permission is required.");
  }

  const { batchCode } = await params;
  const decodedBatchCode = decodeURIComponent(batchCode).trim();
  if (!decodedBatchCode) {
    return apiError(400, "INVALID_SUPPLIER_BATCH", "Supplier batch code is required.");
  }

  try {
    const result = await listAdminSupplierBatchCostHistoryV2(decodedBatchCode);
    return NextResponse.json({
      data: result.data.map((entry) =>
        toSupplierBatchCostHistoryDto(entry, {
          // History is always the redacted canonical event projection.  The
          // separate audit capability is not exposed by this endpoint.
          includeSensitiveAudit: false,
        })
      ),
      meta: { source: result.source, returned: result.data.length },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_BATCH_COST_HISTORY_UNAVAILABLE",
      "Supplier batch cost history is temporarily unavailable."
    );
  }
}
