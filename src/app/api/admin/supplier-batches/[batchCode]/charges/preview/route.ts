import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import {
  previewAdminSupplierBatchChargeCorrectionV2,
  previewAdminSupplierBatchChargeV2,
} from "@/lib/partspro-repository";
import {
  assertSupplierBatchCostRpcRequestContext,
  toSupplierBatchCostRpcResultDto,
  type SupplierBatchCostRpcRequestContext,
} from "../../../_dto";
import {
  hasSupplierBatchReadPermission,
  hasSupplierBatchCostPermission,
  parseAdminJsonBody,
  repositoryErrorResponse,
  requireAdminApi,
} from "../../../../_shared";
import { supplierBatchChargeV2PreviewSchema } from "../_schemas";

export const dynamic = "force-dynamic";

type SupplierBatchChargeParams = {
  params: Promise<{ batchCode: string }>;
};

export async function POST(request: NextRequest, { params }: SupplierBatchChargeParams) {
  // Legacy supplier_batch.manage_costs remains an estimate compatibility
  // mapping; V2 preview uses the dedicated estimate capability.
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

  const previewMode = request.nextUrl.searchParams.get("mode");
  if (previewMode !== null && previewMode !== "correction") {
    return apiError(400, "INVALID_SUPPLIER_BATCH_PREVIEW_MODE", "Supplier batch preview mode is invalid.");
  }
  const isCorrectionPreview = previewMode === "correction";
  if (!hasSupplierBatchCostPermission(admin.authState, isCorrectionPreview ? "correct" : "estimate")) {
    return apiError(
      403,
      "ADMIN_PERMISSION_DENIED",
      isCorrectionPreview
        ? "Supplier batch correction permission is required."
        : "Supplier batch estimate permission is required."
    );
  }

  const body = await parseAdminJsonBody(request, supplierBatchChargeV2PreviewSchema);

  if (!body.ok) {
    return body.response;
  }

  if (isCorrectionPreview && !body.data.chargeId) {
    return apiError(
      400,
      "CHARGE_ID_REQUIRED",
      "A confirmed supplier batch charge is required for correction preview."
    );
  }

  const { batchCode } = await params;
  const decodedBatchCode = decodeURIComponent(batchCode).trim();

  if (!decodedBatchCode) {
    return apiError(400, "INVALID_SUPPLIER_BATCH", "Supplier batch code is required.");
  }

  const requestContext: SupplierBatchCostRpcRequestContext = {
    batchCode: decodedBatchCode,
    chargeType: body.data.chargeType,
    vatTreatment: body.data.vatTreatment,
    allocationMethod: body.data.allocationMethod,
    currency: body.data.currency,
    carrierName: body.data.carrierName,
    reference: body.data.reference,
    occurredAt: body.data.occurredAt,
    evidenceUrl: body.data.evidenceUrl,
    notes: body.data.notes,
    zeroCostReason: body.data.zeroCostReason,
    fxRateToEur: body.data.fxRateToEur,
    fxRateDate: body.data.fxRateDate,
    fxRateSource: body.data.fxRateSource,
    fxEvidenceUrl: body.data.fxEvidenceUrl,
    batchGoodsValueFxRateToEur: body.data.batchGoodsValueFxRateToEur,
    batchGoodsValueFxDate: body.data.batchGoodsValueFxDate,
    batchGoodsValueFxSource: body.data.batchGoodsValueFxSource,
    batchGoodsValueFxEvidenceUrl: body.data.batchGoodsValueFxEvidenceUrl,
  };

  try {
    assertSupplierBatchCostRpcRequestContext(requestContext);
  } catch {
    return apiError(
      400,
      "INVALID_SUPPLIER_BATCH_COST_CONTEXT",
      "Supplier batch cost request context is invalid."
    );
  }

  try {
    // Correction previews stay on their dedicated permission-checked V2 RPC;
    // they must never fall through to the ordinary estimate preview.
    const result = isCorrectionPreview
      ? await previewAdminSupplierBatchChargeCorrectionV2(decodedBatchCode, {
          ...body.data,
          chargeId: body.data.chargeId!,
        })
      : await previewAdminSupplierBatchChargeV2(decodedBatchCode, body.data);
    const data = toSupplierBatchCostRpcResultDto(result.data, requestContext);

    return NextResponse.json({
      data,
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
