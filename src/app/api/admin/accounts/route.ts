import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody, readQueryParams } from "@/lib/partspro-api";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { requireAdminApi } from "../_shared";
import { createClient } from "@/lib/supabase/server";
import {
  isRow,
  profileSelect,
  readAdminAccountDetail,
  readCustomersForProfiles,
  roleTemplates,
  toAccountDto,
} from "./_account-data";

export const dynamic = "force-dynamic";

const accountQuerySchema = z
  .object({
    accountType: z.enum(["customer", "employee"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(5000).default(0),
    q: z.string().trim().min(2).max(100).optional(),
  })
  .strict();

const accountPatchSchema = z
  .object({
    accountType: z.enum(["customer", "employee"]),
    customerType: z.enum(["retail", "wholesale"]).optional(),
    reason: z.string().trim().min(3).max(1000),
    roleTemplate: z
      .enum(roleTemplates)
      .nullable()
      .optional(),
    assignmentStatus: z
      .enum(["needs_review", "assigned", "converted_to_employee", "archived"])
      .optional(),
    userId: z.string().trim().uuid(),
  })
  .strict()
  .refine((value) => value.accountType === "employee" || value.roleTemplate === undefined, {
    message: "roleTemplate can only be set for employee accounts",
    path: ["roleTemplate"],
  });

const accountQueryKeys = new Set(Object.keys(accountQuerySchema.shape));

export async function GET(request: NextRequest) {
  const query = parseAccountQuery(request);

  if (!query.ok) {
    return query.response;
  }

  const accountType = query.data.accountType ?? "customer";
  const admin = await requireAdminApi(accountType === "employee" ? "employees.read" : "customers.read");

  if (!admin.ok) {
    return admin.response;
  }

  const from = query.data.offset;
  const to = from + query.data.limit - 1;

  try {
    const supabase = await createClient();
    let profileRequest = supabase
      .from("profiles")
      .select(profileSelect, { count: "exact" });

    profileRequest = profileRequest.eq("account_type", accountType);

    if (query.data.q) {
      const search = query.data.q.replace(/[%(),]/g, " ").trim();
      profileRequest = profileRequest.or(
        `email.ilike.%${search}%,display_name.ilike.%${search}%,role.ilike.%${search}%`
      );
    }

    const { data, error, count } = await profileRequest
      .order("created_at", { ascending: false })
      .range(from, to);
    const profiles = Array.isArray(data) ? data.filter(isRow) : [];

    if (error) {
      return apiError(502, "ADMIN_ACCOUNTS_READ_FAILED", "Admin accounts could not be read.");
    }

    const customers = await readCustomersForProfiles(supabase, profiles);

    return NextResponse.json({
      data: profiles.map((profile) => toAccountDto(profile, customers)),
      meta: {
        source: "supabase",
        total: count ?? profiles.length,
        limit: query.data.limit,
        offset: query.data.offset,
        returned: profiles.length,
        workflow: "profiles + customers + permissions",
      },
    });
  } catch {
    return apiError(500, "ADMIN_ACCOUNTS_UNAVAILABLE", "Admin accounts are temporarily unavailable.");
  }
}

export async function PATCH(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = accountPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_PAYLOAD", "Account payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  const requiredPermission =
    parsed.data.accountType === "employee" || parsed.data.roleTemplate !== undefined
      ? "employees.manage_permissions"
      : "customers.classify";

  if (!hasAdminPermission(admin.authState, requiredPermission)) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: requiredPermission,
      role: admin.authState.role,
    });
  }

  if (
    admin.authState.userId === parsed.data.userId &&
    (parsed.data.accountType !== "employee" || parsed.data.roleTemplate)
  ) {
    return apiError(
      403,
      "ADMIN_SELF_ACCOUNT_DOWNGRADE_DENIED",
      "Current admin account cannot change its own account type or role.",
      { userId: parsed.data.userId }
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_account_type", {
      p_account_type: parsed.data.accountType,
      p_assignment_status: parsed.data.assignmentStatus ?? null,
      p_customer_type: parsed.data.customerType ?? null,
      p_reason: parsed.data.reason,
      p_user_id: parsed.data.userId,
    });

    if (error) {
      return apiError(502, "ADMIN_ACCOUNT_UPDATE_FAILED", "Account could not be updated.", {
        message: error.message,
      });
    }

    let roleData: unknown = null;

    if (parsed.data.accountType === "employee" && parsed.data.roleTemplate) {
      const roleResult = await supabase.rpc("admin_update_employee_role", {
        p_reason: parsed.data.reason,
        p_role_template: parsed.data.roleTemplate,
        p_user_id: parsed.data.userId,
      });

      if (roleResult.error) {
        return apiError(502, "ADMIN_EMPLOYEE_ROLE_UPDATE_FAILED", "Employee role could not be updated.", {
          message: roleResult.error.message,
        });
      }

      roleData = roleResult.data;
    }

    const detail = await readAdminAccountDetail(supabase, parsed.data.userId);

    if (!detail) {
      return apiError(404, "ADMIN_ACCOUNT_NOT_FOUND", "Account was updated but could not be reloaded.", {
        userId: parsed.data.userId,
      });
    }

    return NextResponse.json({
      data: detail,
      meta: {
        source: "supabase_rpc",
        rpc: roleData ? "admin_update_employee_role" : "admin_update_account_type",
      },
    });
  } catch {
    return apiError(500, "ADMIN_ACCOUNT_UPDATE_FAILED", "Account could not be updated.");
  }
}

function parseAccountQuery(request: NextRequest) {
  const parsedParams = readQueryParams(request.nextUrl.searchParams, accountQueryKeys);

  if (!parsedParams.ok) {
    return {
      ok: false as const,
      response: apiError(400, "INVALID_QUERY", "Admin account query parameters are invalid.", parsedParams.details),
    };
  }

  const result = accountQuerySchema.safeParse(parsedParams.data);

  if (!result.success) {
    return {
      ok: false as const,
      response: apiError(400, "INVALID_QUERY", "Admin account query parameters are invalid.", {
        issues: formatZodIssues(result.error),
      }),
    };
  }

  return { ok: true as const, data: result.data };
}
