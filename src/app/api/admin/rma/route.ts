import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { apiError } from "@/lib/partspro-api";
import { listAdminRmaRequests } from "@/lib/partspro-repository";
import { signRmaRequestAttachments } from "@/lib/partspro-rma-evidence";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

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

const adminRmaQueueSchema = z.enum([
  "mine",
  "needs_inventory",
  "needs_refund",
  "overdue",
  "unassigned",
]);

const adminRmaQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  q: z.string().trim().max(120).optional(),
  queue: adminRmaQueueSchema.optional(),
  status: adminRmaStatusSchema.optional(),
});

export async function GET(request: NextRequest) {
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

  const query = parseAdminQuery(request.nextUrl.searchParams, adminRmaQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminRmaRequests(query.data);
    const signedRequests = await signRmaRequestAttachments(result.data.requests);

    return NextResponse.json({
      data: signedRequests,
      meta: {
        limit: query.data.limit,
        offset: query.data.offset,
        returned: signedRequests.length,
        source: result.source,
        total: result.data.total,
        workflow: "rma_requests -> rma_request_events -> private evidence",
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
