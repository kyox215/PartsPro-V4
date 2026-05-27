import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { updateAdminCustomerProfile } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { toAdminCustomerDto, toAdminCustomerProfilePatch } from "../../_dto";
import { customerIdParamSchema, customerProfilePatchSchema } from "../../_schemas";

export const dynamic = "force-dynamic";

type CustomerParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: CustomerParams) {
  const admin = await requireAdminApi("customers.manage");

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

  const parsed = customerProfilePatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_CUSTOMER_PROFILE", "Customer profile payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await updateAdminCustomerProfile(
      paramResult.data.id,
      toAdminCustomerProfilePatch(parsed.data)
    );

    return NextResponse.json({
      data: toAdminCustomerDto(result.data),
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_CUSTOMER_PROFILE_UPDATE_FAILED",
      "Customer profile could not be updated at this time."
    );
  }
}
