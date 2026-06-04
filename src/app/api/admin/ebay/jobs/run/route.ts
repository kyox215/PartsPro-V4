import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { runMarketplaceJobs } from "@/lib/partspro-marketplace";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

const runJobsSchema = z.object({
  limit: z.number().int().min(1).max(20).optional(),
});

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("ebay.jobs");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = runJobsSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_EBAY_JOB_RUN", "eBay job runner payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    return NextResponse.json({
      data: await runMarketplaceJobs(parsed.data.limit ?? 5),
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_EBAY_JOB_RUN_FAILED",
      "eBay queued jobs could not be processed."
    );
  }
}
