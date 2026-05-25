import { NextRequest, NextResponse } from "next/server";
import { listAdminCustomers } from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";
import { toAdminCustomerDto, toAdminCustomerQuery } from "./_dto";
import { customerQuerySchema } from "./_schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, customerQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const repositoryQuery = toAdminCustomerQuery(query.data);
    const result = await listAdminCustomers(repositoryQuery);

    return NextResponse.json({
      data: result.data.customers.map(toAdminCustomerDto),
      meta: {
        source: result.source,
        total: result.data.total,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.customers.length,
        workflow: "b2b_applications -> customers -> orders",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_CUSTOMERS_UNAVAILABLE",
      "Admin customer data is temporarily unavailable."
    );
  }
}
