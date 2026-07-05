import { NextRequest, NextResponse } from "next/server";
import { getAdminFinanceSummary } from "@/lib/partspro-repository";
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
    const result = await getAdminFinanceSummary(query.data);

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_FINANCE_SUMMARY_UNAVAILABLE",
      "Admin finance summary is temporarily unavailable."
    );
  }
}
