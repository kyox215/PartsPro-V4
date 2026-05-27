import { NextRequest, NextResponse } from "next/server";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { getAdminCustomerDetail, updateAdminCustomer } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { toAdminCustomerDetailDto, toAdminCustomerDto, toAdminCustomerPatch } from "../_dto";
import { customerIdParamSchema, customerPatchSchema } from "../_schemas";

export const dynamic = "force-dynamic";

type CustomerParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: CustomerParams) {
  const admin = await requireAdminApi("customers.read");

  if (!admin.ok) {
    return admin.response;
  }

  const paramResult = customerIdParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_CUSTOMER_ID", "Customer id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const { id } = paramResult.data;

  try {
    const result = await getAdminCustomerDetail(id);

    if (!result.data) {
      return apiError(404, "ADMIN_CUSTOMER_NOT_FOUND", "Customer was not found.", {
        id,
      });
    }

    return NextResponse.json({
      data: toAdminCustomerDetailDto(result.data),
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

  const paramResult = customerIdParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_CUSTOMER_ID", "Customer id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const { id } = paramResult.data;

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
