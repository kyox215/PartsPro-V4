import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { previewAdminSupplierBatchCharge } from "@/lib/partspro-repository";
import {
  hasSupplierBatchReadPermission,
  parseAdminJsonBody,
  repositoryErrorResponse,
  requireAdminApi,
} from "../../../../_shared";
import { supplierBatchChargePreviewSchema } from "../_schemas";

export const dynamic = "force-dynamic";

type SupplierBatchChargeParams = {
  params: Promise<{ batchCode: string }>;
};

export async function POST(request: NextRequest, { params }: SupplierBatchChargeParams) {
  const admin = await requireAdminApi("supplier_batch.manage_costs");

  if (!admin.ok) {
    return admin.response;
  }

  if (!hasSupplierBatchReadPermission(admin.authState)) {
    return apiError(
      403,
      "ADMIN_PERMISSION_DENIED",
      "A supplier batch read permission is required."
    );
  }

  const body = await parseAdminJsonBody(request, supplierBatchChargePreviewSchema);

  if (!body.ok) {
    return body.response;
  }

  const { batchCode } = await params;
  const decodedBatchCode = decodeURIComponent(batchCode).trim();

  if (!decodedBatchCode) {
    return apiError(400, "INVALID_SUPPLIER_BATCH", "Supplier batch code is required.");
  }

  try {
    const result = await previewAdminSupplierBatchCharge(decodedBatchCode, body.data);
    return NextResponse.json({
      data: result.data,
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_BATCH_COST_PREVIEW_UNAVAILABLE",
      "Supplier batch cost preview is temporarily unavailable."
    );
  }
}
