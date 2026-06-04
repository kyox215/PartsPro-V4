import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

const accountRoleParamSchema = z
  .object({
    userId: z.string().trim().uuid(),
  })
  .strict();

const roleTemplates = [
  "admin",
  "auditor",
  "catalog_manager",
  "commerce_manager",
  "inventory_manager",
  "pricing_manager",
  "purchasing",
  "sales",
  "sales_support",
  "warehouse",
] as const;

const accountRolePatchSchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
    roleTemplate: z.enum(roleTemplates),
  })
  .strict();

type AccountParams = { params: Promise<{ userId: string }> };

export async function PATCH(request: NextRequest, { params }: AccountParams) {
  const admin = await requireAdminApi("employees.manage_permissions");

  if (!admin.ok) {
    return admin.response;
  }

  const paramResult = accountRoleParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_ID", "Account user id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = accountRolePatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_ROLE_PAYLOAD", "Account role payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  if (admin.authState.userId === paramResult.data.userId) {
    return apiError(
      403,
      "ADMIN_SELF_ROLE_DOWNGRADE_DENIED",
      "Current admin account cannot change its own employee role.",
      { userId: paramResult.data.userId }
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_update_employee_role", {
      p_reason: parsed.data.reason,
      p_role_template: parsed.data.roleTemplate,
      p_user_id: paramResult.data.userId,
    });

    if (error) {
      return apiError(502, "ADMIN_EMPLOYEE_ROLE_UPDATE_FAILED", "Employee role could not be updated.", {
        message: error.message,
      });
    }

    return NextResponse.json({
      data,
      meta: { source: "supabase_rpc", rpc: "admin_update_employee_role" },
    });
  } catch {
    return apiError(500, "ADMIN_EMPLOYEE_ROLE_UPDATE_FAILED", "Employee role could not be updated.");
  }
}
