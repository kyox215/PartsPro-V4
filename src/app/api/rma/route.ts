import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  listCatalogProducts,
  listCurrentCustomerRmaRequests,
  RepositoryWriteError,
  saveRmaRequest,
} from "@/lib/partspro-repository";
import { toPublicSku } from "@/lib/partspro-sku";

const createRmaSchema = z
  .object({
    orderId: z.string().trim().min(1).max(80).optional(),
    orderLineId: z.string().trim().min(1).max(80).optional(),
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    quantity: z.coerce.number().int().min(1).max(999),
    reason: z.string().trim().min(5).max(120),
    description: z.string().trim().min(10).max(1000),
  })
  .strict()
  .refine((value) => value.orderLineId || value.orderId, {
    message: "Either orderLineId or orderId is required.",
    path: ["orderLineId"],
  });

export async function GET() {
  try {
    const repositoryResult = await listCurrentCustomerRmaRequests();

    return NextResponse.json({
      data: repositoryResult.data,
      meta: {
        source: repositoryResult.source,
        total: repositoryResult.data.length,
        uploadPolicy: "photos_or_video_before_return",
      },
    });
  } catch {
    return apiError(500, "RMA_UNAVAILABLE", "RMA data is temporarily unavailable.");
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = createRmaSchema.safeParse(body.data);

  if (!result.success) {
    return apiError(400, "INVALID_RMA_PAYLOAD", "RMA payload is invalid.", {
      issues: formatZodIssues(result.error),
    });
  }

  try {
    const catalog = await listCatalogProducts();
    const sku = toPublicSku(result.data.sku);
    const product = catalog.data.find((item) => item.sku === sku);
    const saved = await saveRmaRequest({
      ...result.data,
      sku,
      productName: product?.name,
    });

    return NextResponse.json(
      {
        data: saved.data,
        meta: {
          source: saved.source,
          catalogSource: catalog.source,
          uploadPolicy: "photos_or_video_before_return",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RepositoryWriteError) {
      return apiError(error.status, error.code, error.message);
    }

    return apiError(500, "RMA_CREATE_FAILED", "RMA request could not be created at this time.");
  }
}
