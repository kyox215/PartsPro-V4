import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { previewAdminRemaxArrival } from "@/lib/partspro-remax-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

const schema = z.object({
  batchCode: z.string().trim().min(3).max(80),
  receipts: z.array(z.object({
    lineId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(999999),
  }).strict()).min(1).max(500),
}).strict();

export async function POST(request: Request) {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;
  const body = await readJsonBody(request);
  if (!body.ok) return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(400, "INVALID_REMAX_ARRIVAL", "I dati di arrivo non sono validi.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    return NextResponse.json({
      data: await previewAdminRemaxArrival(parsed.data.batchCode, parsed.data.receipts),
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_REMAX_ARRIVAL_PREVIEW_FAILED",
      "REMAX arrival preview could not be generated."
    );
  }
}
