import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { getAdminCustomer, updateAdminCustomer } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { toAdminCustomerDto, toAdminCustomerPatch } from "../_dto";
import { customerPatchSchema } from "../_schemas";

export const dynamic = "force-dynamic";

type CustomerParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: CustomerParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;

  try {
    const result = await getAdminCustomer(id);

    if (!result.data) {
      return apiError(404, "ADMIN_CUSTOMER_NOT_FOUND", "Customer was not found.", {
        id,
      });
    }

    return NextResponse.json({
      data: toAdminCustomerDto(result.data),
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_CUSTOMER_UNAVAILABLE",
      "Customer data is temporarily unavailable."
    );
  }
}

export async function PATCH(request: NextRequest, { params }: CustomerParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = customerPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_CUSTOMER_PAYLOAD", "Customer payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { id } = await params;

  try {
    const result = await updateAdminCustomer(id, toAdminCustomerPatch(parsed.data));

    return NextResponse.json({
      data: toAdminCustomerDto(result.data),
      meta: { source: result.source },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_CUSTOMER_UPDATE_FAILED",
      "Customer could not be updated at this time."
    );
  }
}
