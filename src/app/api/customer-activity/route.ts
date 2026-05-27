import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { recordCustomerActivity } from "@/lib/partspro-repository";
import { repositoryErrorResponse } from "../admin/_shared";

export const dynamic = "force-dynamic";

const customerActivitySchema = z
  .object({
    brand: z.string().trim().max(120).nullable().optional(),
    eventType: z.enum([
      "product_view",
      "model_view",
      "catalog_search",
      "catalog_filter",
      "order_detail_view",
    ]),
    metadata: z.record(z.string(), z.unknown()).optional(),
    model: z.string().trim().max(160).nullable().optional(),
    modelSeries: z.string().trim().max(160).nullable().optional(),
    productName: z.string().trim().max(240).nullable().optional(),
    searchQuery: z.string().trim().max(240).nullable().optional(),
    skuCode: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = customerActivitySchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_CUSTOMER_ACTIVITY", "Customer activity payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await recordCustomerActivity(parsed.data);

    return NextResponse.json({
      data: result.data,
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "CUSTOMER_ACTIVITY_RECORD_FAILED",
      "Customer activity could not be recorded at this time."
    );
  }
}
