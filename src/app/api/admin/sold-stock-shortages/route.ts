import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listAdminSoldStockShortages,
  type AdminSoldStockShortageSort,
} from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

const soldStockShortageQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    lowStockThreshold: z.coerce.number().int().min(1).max(999).default(10),
    q: z.string().trim().min(2).max(100).optional(),
    sort: z
      .enum(["urgency", "sold_desc", "stock_asc", "last_sold_desc"])
      .default("urgency"),
    windowDays: z.coerce.number().int().min(1).max(365).default(30),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("panel.inventory");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(
    request.nextUrl.searchParams,
    soldStockShortageQuerySchema
  );

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminSoldStockShortages({
      ...query.data,
      sort: query.data.sort as AdminSoldStockShortageSort,
    });

    return NextResponse.json({
      data: result.data.rows,
      meta: {
        source: result.source,
        total: result.data.total,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.rows.length,
        summary: result.data.summary,
        workflow:
          "orders(shipped/completed) -> order_lines sold quantity -> products/inventory current stock",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SOLD_STOCK_SHORTAGES_UNAVAILABLE",
      "Admin sold stock shortage data is temporarily unavailable."
    );
  }
}
