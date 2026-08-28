import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  hasAdminPermission,
  hasExactAdminPermission,
} from "@/lib/partspro-admin-auth";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { adminRmaActionSchema } from "@/lib/partspro-rma-contract";
import {
  performAdminRmaAction,
  type AdminRmaAction,
} from "@/lib/partspro-repository";
import {
  RmaEvidenceReadError,
  hydrateCustomerRmaAttachments,
  signSingleRmaRequestAttachments,
} from "@/lib/partspro-rma-evidence";
import {
  getAdminRmaCapabilities,
  toAdminRmaDto,
} from "@/lib/partspro-rma-admin-dto";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

// Non-review actions retain the v3 response contract: workflow: "admin_perform_rma_action_v3".

type AdminRmaActionParams = { params: Promise<{ requestId: string }> };

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

  // Restocking invokes the exact product-stock RPC. Its API gate must use the
  // same canonical permission, rather than accepting the broader RMA
  // inventory alias and letting the database reject the request later.
  const permissionGranted =
    parsedBody.data.action === "restock_return"
      ? hasExactAdminPermission(admin.authState, "product.adjust_stock")
      : permission.some((item) => hasAdminPermission(admin.authState, item));

  if (!permissionGranted) {
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
    const [hydratedRequest] = await hydrateCustomerRmaAttachments(
      [signedRequest],
      admin.authState.userId
    );
    const capabilities = getAdminRmaCapabilities(admin.authState);

    return NextResponse.json({
      data: toAdminRmaDto(hydratedRequest ?? signedRequest, capabilities),
      meta: {
        action: parsedBody.data.action,
        source: result.source,
        workflow:
          parsedBody.data.action === "start_review" ||
          parsedBody.data.action === "approve" ||
          parsedBody.data.action === "reject"
            ? "admin_perform_rma_review_action"
            : "admin_perform_rma_action_v3",
      },
    });
  } catch (error) {
    if (error instanceof RmaEvidenceReadError) {
      return apiError(error.status, error.code, error.message, error.details);
    }
    return repositoryErrorResponse(
      error,
      "ADMIN_RMA_ACTION_FAILED",
      "Admin after-sales action could not be processed."
    );
  }
}

function requiredPermissionForAction(action: AdminRmaAction) {
  if (action === "start_review" || action === "approve" || action === "reject") {
    return ["rma.manage"];
  }

  if (action === "request_wallet_refund") {
    return ["rma.refund", "wallet_refunds.request"];
  }

  if (action === "record_qc") {
    return ["rma.manage", "rma.inventory"];
  }

  if (action === "restock_return") {
    return ["product.adjust_stock"];
  }

  if (action === "mark_received" || action === "mark_scrapped" || action === "supplier_return") {
    return ["rma.inventory", "product.adjust_stock", "inventory.manage"];
  }

  return ["rma.manage", "orders.manage"];
}
