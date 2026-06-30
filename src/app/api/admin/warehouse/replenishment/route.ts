import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  createAdminWarehouseReplenishmentItem,
  listAdminWarehouseReplenishmentItems,
  updateAdminWarehouseReplenishmentItem,
  type AdminWarehouseReplenishmentStatus,
} from "@/lib/partspro-repository";
import { toPublicSku } from "@/lib/partspro-sku";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

const replenishmentStatusSchema = z.enum([
  "open",
  "planned",
  "ordered",
  "received",
  "ignored",
]);

const replenishmentQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(2).max(100).optional(),
    status: z
      .enum(["all", "open", "planned", "ordered", "received", "ignored"])
      .default("open"),
    supplier: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

const replenishmentCreateSchema = z
  .object({
    availableQty: z.coerce.number().int().min(0),
    actualQty: z.coerce.number().int().min(0),
    costPrice: z.coerce.number().min(0).nullable().optional(),
    lastSoldAt: z.string().datetime().nullable().optional(),
    lockedQty: z.coerce.number().int().min(0),
    lowStockThreshold: z.coerce.number().int().min(1).max(999),
    moq: z.coerce.number().int().min(1).max(9999).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
    orderCount: z.coerce.number().int().min(0),
    plannedQty: z.coerce.number().int().min(0).max(99999).nullable().optional(),
    productName: z.string().trim().min(1).max(240),
    shortageType: z.enum(["out_of_stock", "low_stock"]),
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    soldQty: z.coerce.number().int().min(0),
    source: z.string().trim().min(1).max(80).optional(),
    startingAvailableQty: z.coerce.number().int().min(0),
    stockQty: z.coerce.number().int().min(0),
    suggestedQty: z.coerce.number().int().min(0).max(99999),
    supplier: z.string().trim().max(100).nullable().optional(),
    windowDays: z.coerce.number().int().min(1).max(365),
  })
  .strict();

const replenishmentUpdateSchema = z
  .object({
    id: z.string().uuid(),
    note: z.string().trim().max(500).nullable().optional(),
    plannedQty: z.coerce.number().int().min(0).max(99999).optional(),
    status: replenishmentStatusSchema.optional(),
    supplier: z.string().trim().max(100).nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.note !== undefined ||
      value.plannedQty !== undefined ||
      value.status !== undefined ||
      value.supplier !== undefined,
    { message: "At least one replenishment field is required." }
  );

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("panel.inventory");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, replenishmentQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminWarehouseReplenishmentItems({
      ...query.data,
      status: query.data.status as AdminWarehouseReplenishmentStatus | "all",
    });

    return NextResponse.json({
      data: result.data.items,
      meta: {
        source: result.source,
        total: result.data.total,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: result.data.items.length,
        summary: result.data.summary,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_WAREHOUSE_REPLENISHMENT_UNAVAILABLE",
      "Warehouse replenishment queue is temporarily unavailable."
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("inventory.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = replenishmentCreateSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_WAREHOUSE_REPLENISHMENT_CREATE",
      "Warehouse replenishment payload is invalid.",
      { issues: formatZodIssues(parsed.error) }
    );
  }

  try {
    const result = await createAdminWarehouseReplenishmentItem({
      ...parsed.data,
      sku: toPublicSku(parsed.data.sku),
    });

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_WAREHOUSE_REPLENISHMENT_CREATE_FAILED",
      "Warehouse replenishment item could not be created."
    );
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminApi("inventory.manage");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = replenishmentUpdateSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_WAREHOUSE_REPLENISHMENT_UPDATE",
      "Warehouse replenishment update payload is invalid.",
      { issues: formatZodIssues(parsed.error) }
    );
  }

  try {
    const result = await updateAdminWarehouseReplenishmentItem(parsed.data);

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_WAREHOUSE_REPLENISHMENT_UPDATE_FAILED",
      "Warehouse replenishment item could not be updated."
    );
  }
}
