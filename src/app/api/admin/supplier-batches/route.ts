import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listAdminSupplierBatches } from "@/lib/partspro-repository";
import {
  hasSupplierBatchReadPermission,
  parseAdminQuery,
  repositoryErrorResponse,
  requireAdminApi,
} from "../_shared";
import { apiError } from "@/lib/partspro-api";
import { toSupplierBatchRowDto } from "./_dto";

export const dynamic = "force-dynamic";

const supplierBatchQuerySchema = z
  .object({
    batchCode: z.string().trim().min(1).max(80).optional(),
    dateFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateMode: z.enum(["imported", "received", "invoice"]).default("imported"),
    dateTo: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(1).max(120).optional(),
    supplier: z.string().trim().min(1).max(120).optional(),
    currency: z.enum(["EUR", "USD", "CNY"]).optional(),
    costStatus: z.enum(["unrecorded", "estimated", "confirmed_zero", "confirmed", "needs_review"]).optional(),
    chargeType: z.enum(["transport", "insurance", "customs", "handling", "other"]).optional(),
    vatTreatment: z.enum(["recoverable", "non_recoverable", "unknown"]).optional(),
    hasTransport: z.enum(["with", "without"]).optional(),
    // UI v2 uses the explicit name; keep the original query key as a
    // compatibility alias while both clients roll forward.
    hasTransportCost: z.enum(["with", "without"]).optional(),
    sort: z.enum(["updated_desc", "received_desc", "amount_desc", "supplier"]).default("updated_desc"),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (!hasSupplierBatchReadPermission(admin.authState)) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "A supplier batch read permission is required.");
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, supplierBatchQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminSupplierBatches({
      ...query.data,
      hasTransport: query.data.hasTransport ?? query.data.hasTransportCost,
    });

    return NextResponse.json({
      data: result.data.batches.map(toSupplierBatchRowDto),
      meta: {
        source: result.source,
        total: result.data.total,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.batches.length,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_BATCHES_UNAVAILABLE",
      "Admin supplier batch data is temporarily unavailable."
    );
  }
}
