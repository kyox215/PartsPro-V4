import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listAdminSupplierBatches } from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";

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
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, supplierBatchQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminSupplierBatches(query.data);

    return NextResponse.json({
      data: result.data.batches,
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
