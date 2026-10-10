import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readAdminFinanceSupplierBatchOptions } from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";
const optionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  supplier: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
}).strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("finance.read");
  if (!admin.ok) return admin.response;
  const query = parseAdminQuery(request.nextUrl.searchParams, optionsQuerySchema);
  if (!query.ok) return query.response;
  try {
    const result = await readAdminFinanceSupplierBatchOptions(query.data);
    return NextResponse.json({
      data: result.data.batches,
      meta: { total: result.data.total, returned: result.data.batches.length, limit: query.data.limit, offset: query.data.offset },
    });
  } catch (error) {
    return repositoryErrorResponse(error, "ADMIN_FINANCE_BATCH_OPTIONS_UNAVAILABLE", "Supplier payment batches could not be read.");
  }
}
