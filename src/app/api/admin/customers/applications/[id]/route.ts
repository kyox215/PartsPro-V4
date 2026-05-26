import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { reviewAdminB2BApplication } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminB2BApplicationDto, toAdminCustomerDto } from "../../_dto";
import { applicationReviewSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

type ApplicationParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: ApplicationParams) {
  const admin = await requireAdminApi("customers.classify");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = applicationReviewSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_ADMIN_B2B_APPLICATION_REVIEW",
      "B2B application review payload is invalid.",
      { issues: formatZodIssues(parsed.error) }
    );
  }

  const { id } = await params;

  try {
    const result = await reviewAdminB2BApplication({
      id,
      ...parsed.data,
    });

    return NextResponse.json({
      data: {
        application: toAdminB2BApplicationDto(result.data.application),
        customer: result.data.customer ? toAdminCustomerDto(result.data.customer) : null,
      },
      meta: {
        deprecated: true,
        replacement: "/api/admin/accounts",
        source: result.source,
        convertedToActiveCustomer:
          parsed.data.decision === "approve" && result.data.customer !== null,
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
