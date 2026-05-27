import { NextRequest, NextResponse } from "next/server";
import { listAdminCustomers } from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";
import { toAdminCustomerDto, toAdminCustomerQuery } from "./_dto";
import { customerQuerySchema } from "./_schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("customers.read");

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
        facets: result.data.facets,
        source: result.source,
        nextCursor: result.data.nextCursor,
        total: result.data.total,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.customers.length,
        workflow: "customers + memberships + orders + audit",
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
