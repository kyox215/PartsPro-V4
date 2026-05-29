import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readQueryParams } from "@/lib/partspro-api";
import {
  listAdminProductRestockRequests,
  type ProductRestockRequestStatus,
} from "@/lib/partspro-repository";
import { toPublicSku } from "@/lib/partspro-sku";
import { repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

const restockStatusSchema = z.enum(["active", "notified", "cancelled"]);
const adminRestockQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/).optional(),
    status: restockStatusSchema.optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const queryParams = readQueryParams(
    request.nextUrl.searchParams,
    new Set(Object.keys(adminRestockQuerySchema.shape))
  );

  if (!queryParams.ok) {
    return apiError(400, "INVALID_QUERY", "Admin restock query is invalid.", queryParams.details);
  }

  const parsed = adminRestockQuerySchema.safeParse(queryParams.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_QUERY", "Admin restock query is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await listAdminProductRestockRequests({
      ...parsed.data,
      sku: parsed.data.sku ? toPublicSku(parsed.data.sku) : undefined,
      status: parsed.data.status as ProductRestockRequestStatus | undefined,
    });

    return NextResponse.json({
      data: result.data.requests,
      meta: {
        source: result.source,
        total: result.data.total,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        returned: result.data.requests.length,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_RESTOCK_REQUESTS_UNAVAILABLE",
      "Admin restock reminders are temporarily unavailable."
    );
  }
}
