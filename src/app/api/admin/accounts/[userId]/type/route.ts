import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "../../../_shared";
import { readAdminAccountDetail } from "../../_account-data";

export const dynamic = "force-dynamic";

const accountTypeParamSchema = z
  .object({
    userId: z.string().trim().uuid(),
  })
  .strict();

const accountTypePatchSchema = z
  .object({
    accountType: z.enum(["customer", "employee"]),
    assignmentStatus: z
      .enum(["needs_review", "assigned", "converted_to_employee", "archived"])
      .optional(),
    customerType: z.enum(["retail", "wholesale"]).optional(),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

type AccountParams = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, { params }: AccountParams) {
  const paramResult = accountTypeParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_ID", "Account user id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = accountTypePatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_TYPE_PAYLOAD", "Account type payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const admin = await requireAdminApi(
    parsed.data.accountType === "employee"
      ? "employees.manage_permissions"
      : "customers.classify"
  );

  if (!admin.ok) {
    return admin.response;
  }

  if (admin.authState.userId === paramResult.data.userId) {
    return apiError(
      403,
      "ADMIN_SELF_ACCOUNT_DOWNGRADE_DENIED",
      "Current admin account cannot change its own account type.",
      { userId: paramResult.data.userId }
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_account_type", {
      p_account_type: parsed.data.accountType,
      p_assignment_status: parsed.data.assignmentStatus ?? null,
      p_customer_type: parsed.data.customerType ?? null,
      p_reason: parsed.data.reason,
      p_user_id: paramResult.data.userId,
    });

    if (error) {
      return apiError(502, "ADMIN_ACCOUNT_TYPE_UPDATE_FAILED", "Account type could not be updated.", {
        message: error.message,
      });
    }

    const detail = await readAdminAccountDetail(supabase, paramResult.data.userId);

    if (!detail) {
      return apiError(404, "ADMIN_ACCOUNT_NOT_FOUND", "Account was updated but could not be reloaded.", {
        userId: paramResult.data.userId,
      });
    }

    return NextResponse.json({
      data: detail,
      meta: { source: "supabase_rpc", rpc: "admin_update_account_type" },
    });
  } catch {
    return apiError(500, "ADMIN_ACCOUNT_TYPE_UPDATE_FAILED", "Account type could not be updated.");
  }
}
