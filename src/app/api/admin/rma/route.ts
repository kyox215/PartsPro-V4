import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { apiError } from "@/lib/partspro-api";
import { listAdminRmaRequests } from "@/lib/partspro-repository";
import {
  hydrateCustomerRmaAttachments,
  signRmaRequestAttachments,
} from "@/lib/partspro-rma-evidence";
import {
  countAdminRmaQueues,
  getAdminRmaCapabilities,
  toAdminRmaDto,
} from "@/lib/partspro-rma-admin-dto";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

const adminRmaStatusSchema = z.enum([
  "submitted",
  "requested",
  "under_review",
  "approved",
  "rejected",
  "received",
  "return_in_transit",
  "replacement_sent",
  "replaced",
  "refunded",
  "closed",
]);

const adminRmaQueueSchema = z.enum([
  "review",
  "awaiting_return",
  "receiving",
  "qc",
  "resolution",
  "inventory_close",
  "archive",
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
    const [result, countResult] = await Promise.all([
      listAdminRmaRequests(query.data),
      listAdminRmaRequests({
        limit: 200,
        offset: 0,
        q: query.data.q,
        status: query.data.status,
      }),
    ]);
    const signedRequests = await signRmaRequestAttachments(result.data.requests);
    // Canonical opaque attachments live in the relation table; hydrate them
    // with service-role signing before the admin allowlist mapper strips path
    // and uploader metadata.
    const hydratedRequests = await hydrateCustomerRmaAttachments(
      signedRequests,
      admin.authState.userId
    );
    const capabilities = getAdminRmaCapabilities(admin.authState);
    const data = hydratedRequests.map((request) =>
      toAdminRmaDto(request, capabilities)
    );
    const countsComplete =
      countResult.data.totalIsExact &&
      countResult.data.total <= 200 &&
      countResult.data.total === countResult.data.requests.length;

    return NextResponse.json({
      data,
      meta: {
        limit: query.data.limit,
        offset: query.data.offset,
        returned: data.length,
        source: result.source,
        total: result.data.total,
        // Counts intentionally use an independent, queue-less 200-row read;
        // the page query may be scoped to one selected queue and must not make
        // every other queue appear empty.
        queueCounts: countAdminRmaQueues(countResult.data.requests, capabilities),
        countsComplete,
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
