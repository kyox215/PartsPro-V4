import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listAdminInventoryHealth,
  type AdminInventoryHealthIssueFilter,
  type AdminInventoryHealthSort,
} from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

const inventoryHealthQuerySchema = z
  .object({
    issue: z
      .enum([
        "all",
        "stock_mismatch",
        "reserved_mismatch",
        "locked_orphan",
        "active_zero_stock_sold",
      ])
      .default("all"),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(2).max(100).optional(),
    sort: z.enum(["severity", "delta_desc", "last_sold_desc", "sku"]).default("severity"),
    staleLockHours: z.coerce.number().int().min(1).max(720).default(72),
    windowDays: z.coerce.number().int().min(1).max(365).default(90),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("panel.inventory");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, inventoryHealthQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminInventoryHealth({
      ...query.data,
      issue: query.data.issue as AdminInventoryHealthIssueFilter,
      sort: query.data.sort as AdminInventoryHealthSort,
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
          "products + inventory_items + active reserved order_lines + shipped/completed order_lines",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_INVENTORY_HEALTH_UNAVAILABLE",
      "Admin inventory health data is temporarily unavailable."
    );
  }
}
