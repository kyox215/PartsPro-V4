import { NextRequest, NextResponse } from "next/server";
import { listAdminFinanceLedger } from "@/lib/partspro-repository";
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
    const result = await listAdminFinanceLedger(query.data);

    return NextResponse.json({
      data: result.data.rows,
      meta: {
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.rows.length,
        source: result.source,
        summary: result.data.summary,
        total: result.data.total,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_FINANCE_LEDGER_UNAVAILABLE",
      "Admin finance ledger is temporarily unavailable."
    );
  }
}
