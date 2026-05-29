import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { updateAdminProductRestockRequestStatus } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

const updateRestockRequestSchema = z
  .object({
    status: z.enum(["notified", "cancelled"]),
  })
  .strict();

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/admin/restock-requests/[id]">
) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await context.params;

  if (!z.string().uuid().safeParse(id).success) {
    return apiError(400, "INVALID_RESTOCK_REQUEST_ID", "Restock reminder id is invalid.");
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = updateRestockRequestSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_RESTOCK_REQUEST_UPDATE", "Restock update payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const result = await updateAdminProductRestockRequestStatus(id, parsed.data.status);

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_RESTOCK_REQUEST_UPDATE_FAILED",
      "Restock reminder could not be updated at this time."
    );
  }
}
