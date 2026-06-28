import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { updateAdminRmaRequest } from "@/lib/partspro-repository";
import { signSingleRmaRequestAttachments } from "@/lib/partspro-rma-evidence";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

type AdminRmaParams = { params: Promise<{ requestId: string }> };

const adminRmaStatusSchema = z.enum([
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "received",
  "replacement_sent",
  "refunded",
  "closed",
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

export async function PATCH(request: NextRequest, { params }: AdminRmaParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (
    !hasAdminPermission(admin.authState, "rma.manage") &&
    !hasAdminPermission(admin.authState, "orders.manage")
  ) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: "rma.manage or orders.manage",
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

    return NextResponse.json({
      data: signedRequest,
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
