import { NextRequest, NextResponse } from "next/server";
import { listAdminFinanceBatchOptions } from "@/lib/partspro-repository";
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
    const result = await listAdminFinanceBatchOptions(query.data);

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source, total: result.total,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_FINANCE_BATCH_OPTIONS_UNAVAILABLE",
      "Admin finance batch-options is temporarily unavailable."
    );
  }
}
