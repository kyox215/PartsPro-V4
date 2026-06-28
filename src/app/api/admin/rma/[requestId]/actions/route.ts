import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  performAdminRmaAction,
  type AdminRmaAction,
} from "@/lib/partspro-repository";
import { signSingleRmaRequestAttachments } from "@/lib/partspro-rma-evidence";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

type AdminRmaActionParams = { params: Promise<{ requestId: string }> };

const adminRmaActionSchema = z
  .object({
    action: z.enum([
      "assign",
      "request_wallet_refund",
      "mark_received",
      "restock_return",
      "mark_scrapped",
      "close",
    ]),
    assignedTo: z.string().uuid().nullable().optional(),
    batchCode: z.string().trim().max(120).optional(),
    customerVisibleNote: z.string().trim().max(1000).optional(),
    internalNote: z.string().trim().max(1000).optional(),
    quantity: z.coerce.number().int().min(1).max(100000).optional(),
    reason: z.string().trim().max(1000).optional(),
    refundAmount: z.coerce.number().positive().max(999999).optional(),
    supplier: z.string().trim().max(160).optional(),
    warehouse: z.literal("Milano").optional(),
  })
  .strict();

export async function POST(request: NextRequest, { params }: AdminRmaActionParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = adminRmaActionSchema.safeParse(body.data);

  if (!parsedBody.success) {
    return apiError(400, "INVALID_RMA_ACTION_PAYLOAD", "RMA action payload is invalid.", {
      issues: formatZodIssues(parsedBody.error),
    });
  }

  const { requestId } = await params;
  const parsedRequestId = z.string().uuid().safeParse(requestId);

  if (!parsedRequestId.success) {
    return apiError(400, "INVALID_RMA_REQUEST_ID", "RMA request id is invalid.");
  }

  const permission = requiredPermissionForAction(parsedBody.data.action);

  if (
    !permission.some((item) => hasAdminPermission(admin.authState, item))
  ) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: permission.join(" or "),
      role: admin.authState.role,
    });
  }

  try {
    const result = await performAdminRmaAction({
      ...parsedBody.data,
      action: parsedBody.data.action as AdminRmaAction,
      requestId: parsedRequestId.data,
    });
    const signedRequest = await signSingleRmaRequestAttachments(result.data);

    return NextResponse.json({
      data: signedRequest,
      meta: {
        action: parsedBody.data.action,
        source: result.source,
        workflow: "admin_perform_rma_action",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_RMA_ACTION_FAILED",
      "Admin after-sales action could not be processed."
    );
  }
}

function requiredPermissionForAction(action: AdminRmaAction) {
  if (action === "request_wallet_refund") {
    return ["rma.refund", "wallet_refunds.request"];
  }

  if (action === "restock_return") {
    return ["product.adjust_stock", "inventory.manage"];
  }

  if (action === "mark_scrapped") {
    return ["rma.inventory", "product.adjust_stock", "inventory.manage"];
  }

  return ["rma.manage", "orders.manage"];
}
