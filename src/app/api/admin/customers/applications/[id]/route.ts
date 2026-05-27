import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { reviewAdminB2BApplication } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import {
  toAdminB2BApplicationReview,
  toAdminB2BReviewDto,
} from "../../../b2b-applications/_dto";
import { b2bApplicationPatchSchema } from "../../../b2b-applications/_schemas";

export const dynamic = "force-dynamic";

type ApplicationParams = { params: Promise<{ id: string }> };

const legacyApplicationParamSchema = z
  .object({
    id: z.string().trim().uuid(),
  })
  .strict();

export async function PATCH(request: NextRequest, { params }: ApplicationParams) {
  const admin = await requireAdminApi("customers.classify");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = b2bApplicationPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_ADMIN_B2B_APPLICATION_REVIEW",
      "B2B application review payload is invalid.",
      { issues: formatZodIssues(parsed.error) }
    );
  }

  const paramResult = legacyApplicationParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_B2B_APPLICATION_ID", "B2B application id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  try {
    const result = await reviewAdminB2BApplication(
      toAdminB2BApplicationReview(paramResult.data.id, parsed.data)
    );
    const dto = toAdminB2BReviewDto(result.data);
    const decision =
      parsed.data.decision ?? (parsed.data.status === "approved" ? "approve" : "reject");

    return NextResponse.json({
      data: {
        application: dto.application,
        customer: dto.customer,
      },
      meta: {
        deprecated: true,
        replacement: "/api/admin/b2b-applications/[applicationId]",
        source: result.source,
        convertedToActiveCustomer:
          decision === "approve" && result.data.customer !== null,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_B2B_APPLICATION_REVIEW_FAILED",
      "B2B application could not be reviewed at this time."
    );
  }
}
