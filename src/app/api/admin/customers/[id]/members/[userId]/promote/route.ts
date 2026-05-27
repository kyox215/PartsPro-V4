import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "../../../../../_shared";

export const dynamic = "force-dynamic";

const promoteMemberParamSchema = z
  .object({
    id: z.string().trim().uuid(),
    userId: z.string().trim().uuid(),
  })
  .strict();

const employeeRoleTemplates = [
  "admin",
  "auditor",
  "catalog_manager",
  "inventory_manager",
  "pricing_manager",
  "purchasing",
  "sales",
  "sales_support",
  "warehouse",
] as const;

const promoteMemberBodySchema = z
  .object({
    reason: z.string().trim().min(3).max(1000),
    roleTemplate: z.enum(employeeRoleTemplates).default("sales_support"),
  })
  .strict();

type PromoteMemberParams = { params: Promise<{ id: string; userId: string }> };
type DbRow = Record<string, unknown>;

export async function PATCH(request: NextRequest, { params }: PromoteMemberParams) {
  const admin = await requireAdminApi("employees.manage_permissions");

  if (!admin.ok) {
    return admin.response;
  }

  const paramResult = promoteMemberParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_CUSTOMER_MEMBER_ID", "Customer member id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = promoteMemberBodySchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_CUSTOMER_MEMBER_PROMOTION", "Member promotion payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const { id, userId } = paramResult.data;

  try {
    const supabase = await createClient();
    const [membershipResult, roleTemplateResult] = await Promise.all([
      supabase
        .from("customer_memberships")
        .select("customer_id, user_id, status")
        .eq("customer_id", id)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("admin_role_templates")
        .select("id")
        .eq("id", parsed.data.roleTemplate)
        .maybeSingle(),
    ]);

    if (membershipResult.error) {
      return apiError(502, "ADMIN_CUSTOMER_MEMBER_READ_FAILED", "Customer member could not be read.", {
        message: membershipResult.error.message,
      });
    }

    if (!isRow(membershipResult.data)) {
      return apiError(404, "ADMIN_CUSTOMER_MEMBER_NOT_FOUND", "This user is not a member of the selected customer.", {
        customerId: id,
        userId,
      });
    }

    if (roleTemplateResult.error) {
      return apiError(502, "ADMIN_ROLE_TEMPLATE_READ_FAILED", "Employee role template could not be read.", {
        message: roleTemplateResult.error.message,
      });
    }

    if (!isRow(roleTemplateResult.data)) {
      return apiError(400, "ADMIN_ROLE_TEMPLATE_UNKNOWN", "Employee role template is unknown.", {
        roleTemplate: parsed.data.roleTemplate,
      });
    }

    const accountResult = await supabase.rpc("admin_update_account_type", {
      p_account_type: "employee",
      p_assignment_status: null,
      p_customer_type: null,
      p_reason: parsed.data.reason,
      p_user_id: userId,
    });

    if (accountResult.error) {
      return apiError(502, "ADMIN_CUSTOMER_MEMBER_PROMOTION_FAILED", "Customer member could not be promoted.", {
        message: accountResult.error.message,
      });
    }

    const roleResult = await supabase.rpc("admin_update_employee_role", {
      p_reason: parsed.data.reason,
      p_role_template: parsed.data.roleTemplate,
      p_user_id: userId,
    });

    if (roleResult.error) {
      return apiError(502, "ADMIN_CUSTOMER_MEMBER_ROLE_FAILED", "Employee role could not be assigned.", {
        message: roleResult.error.message,
      });
    }

    return NextResponse.json({
      data: {
        account: accountResult.data,
        role: roleResult.data,
      },
      meta: {
        customerId: id,
        roleTemplate: parsed.data.roleTemplate,
        source: "supabase_rpc",
        userId,
        workflow: "customer_membership -> employee",
      },
    });
  } catch {
    return apiError(500, "ADMIN_CUSTOMER_MEMBER_PROMOTION_FAILED", "Customer member could not be promoted.");
  }
}

function isRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
