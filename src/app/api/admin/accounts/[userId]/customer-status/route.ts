import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { updateAdminCustomerClassification } from "@/lib/partspro-repository";
import { createClient } from "@/lib/supabase/server";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import {
  readAdminAccountDetail,
  readEditableAdminAccountCustomerByUserId,
} from "../../_account-data";

export const dynamic = "force-dynamic";

const accountParamSchema = z
  .object({
    userId: z.string().trim().uuid(),
  })
  .strict();

const customerStatusPatchSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
    status: z.enum(["pending", "active", "suspended"]),
  })
  .strict();

type AccountParams = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, { params }: AccountParams) {
  const admin = await requireAdminApi("customers.classify");

  if (!admin.ok) {
    return admin.response;
  }

  const paramResult = accountParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_ID", "Account user id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = customerStatusPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_CUSTOMER_STATUS", "Customer status payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  try {
    const supabase = await createClient();
    const editableCustomer = await readEditableAdminAccountCustomerByUserId(
      supabase,
      paramResult.data.userId
    );

    if (!editableCustomer?.customer?.id) {
      return apiError(404, "ADMIN_ACCOUNT_CUSTOMER_NOT_FOUND", "Account is not linked to a customer profile.", {
        userId: paramResult.data.userId,
      });
    }

    await updateAdminCustomerClassification(editableCustomer.customer.id, {
      assignmentStatus:
        editableCustomer.account.accountType === "employee"
          ? undefined
          : parsed.data.status === "active"
            ? "assigned"
            : undefined,
      reason: parsed.data.reason,
      status: parsed.data.status,
    });

    const detail = await readAdminAccountDetail(supabase, paramResult.data.userId);

    if (!detail) {
      return apiError(404, "ADMIN_ACCOUNT_NOT_FOUND", "Account was updated but could not be reloaded.", {
        userId: paramResult.data.userId,
      });
    }

    return NextResponse.json({
      data: detail,
      meta: { source: "supabase_rpc", rpc: "admin_update_customer_classification" },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_ACCOUNT_CUSTOMER_STATUS_UPDATE_FAILED",
      "Customer status could not be updated at this time."
    );
  }
}
