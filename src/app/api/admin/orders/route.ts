import { NextRequest, NextResponse } from "next/server";
import {
  listAdminOrders,
} from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";
import { toAdminOrderDto } from "./_dto";
import { orderQuerySchema } from "./_schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, orderQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminOrders(query.data);

    return NextResponse.json({
      data: result.data.orders.map((order) => toAdminOrderDto(order)),
      meta: {
        source: result.source,
        total: result.data.total,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.orders.length,
        workflow: "orders -> order_lines -> inventory reservation -> events",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ORDERS_UNAVAILABLE",
      "Admin order data is temporarily unavailable."
    );
  }
}
