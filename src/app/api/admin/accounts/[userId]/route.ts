import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues } from "@/lib/partspro-api";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "../../_shared";
import { readAdminAccountDetail } from "../_account-data";

export const dynamic = "force-dynamic";

const accountParamSchema = z
  .object({
    userId: z.string().trim().uuid(),
  })
  .strict();

type AccountParams = { params: Promise<{ userId: string }> };

export async function GET(_request: NextRequest, { params }: AccountParams) {
  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (
    !hasAdminPermission(admin.authState, "customers.read") &&
    !hasAdminPermission(admin.authState, "employees.read")
  ) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: "customers.read or employees.read",
      role: admin.authState.role,
    });
  }

  const paramResult = accountParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_ACCOUNT_ID", "Account user id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  try {
    const supabase = await createClient();
    const detail = await readAdminAccountDetail(supabase, paramResult.data.userId);

    if (!detail) {
      return apiError(404, "ADMIN_ACCOUNT_NOT_FOUND", "Account was not found.", {
        userId: paramResult.data.userId,
      });
    }

    const isEmployee = detail.account.accountType === "employee";
    const requiredPermission = isEmployee ? "employees.read" : "customers.read";

    if (!hasAdminPermission(admin.authState, requiredPermission)) {
      return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
        permission: requiredPermission,
        role: admin.authState.role,
      });
    }

    return NextResponse.json({
      data: detail,
      meta: {
        source: "supabase",
        workflow: "profile + customer + memberships + permissions + audit",
      },
    });
  } catch {
    return apiError(500, "ADMIN_ACCOUNT_UNAVAILABLE", "Admin account is temporarily unavailable.");
  }
}
