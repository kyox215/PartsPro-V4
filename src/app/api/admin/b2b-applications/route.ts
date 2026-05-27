import { NextRequest, NextResponse } from "next/server";
import { listAdminB2BApplications } from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";
import {
  toAdminB2BApplicationDto,
  toAdminB2BApplicationQuery,
} from "./_dto";
import { b2bApplicationQuerySchema } from "./_schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("customers.read");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, b2bApplicationQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const repositoryQuery = toAdminB2BApplicationQuery(query.data);
    const result = await listAdminB2BApplications(repositoryQuery);

    return NextResponse.json({
      data: result.data.applications.map(toAdminB2BApplicationDto),
      meta: {
        source: result.source,
        total: result.data.total,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.applications.length,
        workflow: "submitted application -> approved customer",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_B2B_APPLICATIONS_UNAVAILABLE",
      "Admin B2B application data is temporarily unavailable."
    );
  }
}
