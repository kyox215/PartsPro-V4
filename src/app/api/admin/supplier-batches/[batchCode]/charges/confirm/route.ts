import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { confirmAdminSupplierBatchChargeV2 } from "@/lib/partspro-repository";
import {
  hasSupplierBatchReadPermission,
  hasSupplierBatchCostPermission,
  parseAdminJsonBody,
  repositoryErrorResponse,
  requireAdminApi,
} from "../../../../_shared";
import { supplierBatchChargeV2ConfirmSchema } from "../_schemas";

export const dynamic = "force-dynamic";

type SupplierBatchChargeParams = {
  params: Promise<{ batchCode: string }>;
};

export async function POST(request: NextRequest, { params }: SupplierBatchChargeParams) {
  // Legacy supplier_batch.manage_costs is intentionally not a confirmation
  // capability; V2 confirmation requires the dedicated confirm permission.
  const admin = await requireAdminApi();

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

  if (!hasSupplierBatchCostPermission(admin.authState, "confirm")) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Supplier batch confirmation permission is required.");
  }

  const body = await parseAdminJsonBody(request, supplierBatchChargeV2ConfirmSchema);

  if (!body.ok) {
    return body.response;
  }

  const { batchCode } = await params;
  const decodedBatchCode = decodeURIComponent(batchCode).trim();

  if (!decodedBatchCode) {
    return apiError(400, "INVALID_SUPPLIER_BATCH", "Supplier batch code is required.");
  }

  try {
    const result = await confirmAdminSupplierBatchChargeV2(decodedBatchCode, body.data);
    return NextResponse.json({
      data: result.data,
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_BATCH_COST_CONFIRM_UNAVAILABLE",
      "Supplier batch cost confirmation could not be completed."
    );
  }
}
