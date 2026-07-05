import { NextRequest, NextResponse } from "next/server";
import { listAdminFinanceCogs } from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { financeQuerySchema } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("finance.read");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, financeQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminFinanceCogs(query.data);

    return NextResponse.json({
      data: result.data.allocations,
      meta: {
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.allocations.length,
        source: result.source,
        total: result.data.total,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_FINANCE_COGS_UNAVAILABLE",
      "Admin finance COGS data is temporarily unavailable."
    );
  }
}
