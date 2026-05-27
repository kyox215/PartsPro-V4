import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { updateAdminCustomerTerms } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminCustomerDto, toAdminCustomerTermsPatch } from "../../_dto";
import { customerIdParamSchema, customerTermsPatchSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

type CustomerParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: CustomerParams) {
  const admin = await requireAdminApi("customers.manage_terms");

  if (!admin.ok) {
    return admin.response;
  }

  const paramResult = customerIdParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_CUSTOMER_ID", "Customer id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = customerTermsPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_CUSTOMER_TERMS", "Commercial terms payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await updateAdminCustomerTerms(
      paramResult.data.id,
      toAdminCustomerTermsPatch(parsed.data)
    );

    return NextResponse.json({
      data: toAdminCustomerDto(result.data),
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_CUSTOMER_TERMS_UPDATE_FAILED",
      "Customer commercial terms could not be updated at this time."
    );
  }
}
