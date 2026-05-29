import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import {
  listCurrentProductRestockRequests,
  RepositoryWriteError,
  saveProductRestockRequest,
} from "@/lib/partspro-repository";
import { toPublicSku } from "@/lib/partspro-sku";

export const dynamic = "force-dynamic";

const restockRequestSchema = z
  .object({
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
  })
  .strict();

export async function GET() {
  try {
    const result = await listCurrentProductRestockRequests();

    return NextResponse.json({
      data: result.data,
      meta: {
        activeSkus: result.data.map((item) => item.sku),
        source: result.source,
        total: result.data.length,
        ...(result.warning ? { warning: result.warning } : {}),
      },
    });
  } catch (error) {
    if (error instanceof RepositoryWriteError) {
      return apiError(error.status, error.code, error.message, error.details);
    }

    return apiError(
      500,
      "RESTOCK_REQUESTS_UNAVAILABLE",
      "Restock reminders are temporarily unavailable."
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = restockRequestSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_RESTOCK_REQUEST", "Restock reminder payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await saveProductRestockRequest(toPublicSku(parsed.data.sku));

    return NextResponse.json(
      {
        data: result.data,
        meta: {
          source: result.source,
          status: result.data.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RepositoryWriteError) {
      return apiError(error.status, error.code, error.message, error.details);
    }

    return apiError(
      500,
      "RESTOCK_REQUEST_CREATE_FAILED",
      "Restock reminder could not be created at this time."
    );
  }
}
