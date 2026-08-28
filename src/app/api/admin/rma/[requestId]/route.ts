import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  getAdminRmaRequest,
  updateAdminRmaRequest,
} from "@/lib/partspro-repository";
import {
  hydrateCustomerRmaAttachments,
  signSingleRmaRequestAttachments,
} from "@/lib/partspro-rma-evidence";
import {
  getAdminRmaCapabilities,
  toAdminRmaDto,
} from "@/lib/partspro-rma-admin-dto";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

type AdminRmaParams = { params: Promise<{ requestId: string }> };

const adminRmaStatusSchema = z.enum([
  "submitted",
  "under_review",
  "approved",
  "rejected",
]);

const updateRmaSchema = z
  .object({
    customerVisibleNote: z.string().trim().max(1000).optional(),
    internalNote: z.string().trim().max(1000).optional(),
    labResult: z.string().trim().max(1000).optional(),
    refundAmount: z.coerce.number().min(0).max(999999).optional(),
    resolutionNote: z.string().trim().max(1000).optional(),
    status: adminRmaStatusSchema,
  })
  .strict();

export async function GET(request: NextRequest, { params }: AdminRmaParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (
    !hasAdminPermission(admin.authState, "rma.read") &&
    !hasAdminPermission(admin.authState, "orders.read")
  ) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: "rma.read or orders.read",
      role: admin.authState.role,
    });
  }

  const { requestId } = await params;
  const parsedRequestId = z.string().uuid().safeParse(requestId);
  if (!parsedRequestId.success) {
    return apiError(400, "INVALID_RMA_REQUEST_ID", "RMA request id is invalid.");
  }

  try {
    const includeRefundPreview =
      hasAdminPermission(admin.authState, "rma.refund") ||
      hasAdminPermission(admin.authState, "rma.manage");
    const result = await getAdminRmaRequest(parsedRequestId.data, {
      includeRefundPreview,
    });

    if (!result.data) {
      return apiError(404, "RMA_NOT_FOUND", "RMA request was not found.");
    }

    const signedRequest = await signSingleRmaRequestAttachments(result.data.request);
    const [hydratedRequest] = await hydrateCustomerRmaAttachments(
      [signedRequest],
      admin.authState.userId
    );
    const capabilities = getAdminRmaCapabilities(admin.authState);
    const data = {
      ...toAdminRmaDto(hydratedRequest ?? signedRequest, capabilities),
      refundPreview: result.data.refundPreview,
      replacementCandidates: result.data.replacementCandidates,
    };

    return NextResponse.json({
      data,
      meta: {
        source: result.source,
        workflow: "admin_rma_detail",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_RMA_UNAVAILABLE",
      "Admin after-sales request data is temporarily unavailable."
    );
  }
}

export async function PATCH(request: NextRequest, { params }: AdminRmaParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (!hasAdminPermission(admin.authState, "rma.manage")) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: "rma.manage",
      role: admin.authState.role,
    });
  }

  const { requestId } = await params;
  const parsedParams = z.string().uuid().safeParse(requestId);

  if (!parsedParams.success) {
    return apiError(400, "INVALID_RMA_REQUEST_ID", "RMA request id is invalid.");
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = updateRmaSchema.safeParse(body.data);

  if (!parsedBody.success) {
    return apiError(400, "INVALID_RMA_UPDATE_PAYLOAD", "RMA update payload is invalid.", {
      issues: formatZodIssues(parsedBody.error),
    });
  }

  try {
    const result = await updateAdminRmaRequest({
      requestId: parsedParams.data,
      ...parsedBody.data,
    });
    const signedRequest = await signSingleRmaRequestAttachments(result.data);
    const [hydratedRequest] = await hydrateCustomerRmaAttachments(
      [signedRequest],
      admin.authState.userId
    );
    const capabilities = getAdminRmaCapabilities(admin.authState);

    return NextResponse.json({
      data: toAdminRmaDto(hydratedRequest ?? signedRequest, capabilities),
      meta: {
        source: result.source,
        workflow: "admin_update_rma_request",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_RMA_UPDATE_FAILED",
      "Admin after-sales request could not be updated."
    );
  }
}
