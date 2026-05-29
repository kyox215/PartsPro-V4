import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

const roleTemplates = [
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

const permissionUserParamSchema = z
  .object({
    userId: z.string().trim().uuid(),
  })
  .strict();

const permissionOverrideSchema = z
  .object({
    effect: z.enum(["grant", "deny", "inherit"]),
    permissionId: z.string().trim().min(1).max(120),
  })
  .strict();

const permissionUserPatchSchema = z
  .object({
    overrides: z.array(permissionOverrideSchema).max(200).optional(),
    reason: z.string().trim().min(3).max(1000),
    roleTemplate: z.enum(roleTemplates).optional(),
  })
  .strict();

type DbRow = Record<string, unknown>;
type PermissionUserParams = { params: Promise<{ userId: string }> };
const selfProtectionPermissions = new Set(["employees.manage_permissions", "panel.settings"]);

export async function GET(_request: NextRequest, { params }: PermissionUserParams) {
  const admin = await requireAdminApi("employees.manage_permissions");

  if (!admin.ok) {
    return admin.response;
  }

  const paramResult = permissionUserParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_PERMISSION_USER_ID", "Permission user id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  try {
    const supabase = await createClient();
    const [profile, overrides] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, role_template")
        .eq("id", paramResult.data.userId)
        .maybeSingle(),
      supabase
        .from("admin_user_permission_overrides")
        .select("user_id, permission_id, effect")
        .eq("user_id", paramResult.data.userId)
        .order("permission_id", { ascending: true }),
    ]);

    const error = profile.error ?? overrides.error;

    if (error) {
      return apiError(502, "ADMIN_PERMISSION_USER_READ_FAILED", "Permission user could not be read.", {
        message: error.message,
      });
    }

    if (!isRow(profile.data)) {
      return apiError(404, "ADMIN_PERMISSION_USER_NOT_FOUND", "Permission user was not found.", {
        userId: paramResult.data.userId,
      });
    }

    return NextResponse.json({
      data: {
        email: readString(profile.data.email),
        overrides: readRows(overrides.data).map(toOverrideDto),
        roleTemplate: readString(profile.data.role_template),
        userId: paramResult.data.userId,
      },
      meta: { source: "supabase" },
    });
  } catch {
    return apiError(500, "ADMIN_PERMISSION_USER_UNAVAILABLE", "Permission user is temporarily unavailable.");
  }
}

export async function PATCH(request: NextRequest, { params }: PermissionUserParams) {
  const admin = await requireAdminApi("employees.manage_permissions");

  if (!admin.ok) {
    return admin.response;
  }

  const paramResult = permissionUserParamSchema.safeParse(await params);

  if (!paramResult.success) {
    return apiError(400, "INVALID_ADMIN_PERMISSION_USER_ID", "Permission user id must be a UUID.", {
      issues: formatZodIssues(paramResult.error),
    });
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = permissionUserPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PERMISSION_USER_PAYLOAD", "Permission user payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  if (
    admin.authState.userId === paramResult.data.userId &&
    wouldRemoveOwnAdminAccess(parsed.data)
  ) {
    return apiError(
      403,
      "ADMIN_SELF_PERMISSION_DOWNGRADE_DENIED",
      "Current admin account cannot remove its own settings or permission-management access.",
      { userId: paramResult.data.userId }
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_update_permission_overrides", {
      p_overrides: parsed.data.overrides ?? [],
      p_reason: parsed.data.reason,
      p_role_template: parsed.data.roleTemplate ?? null,
      p_user_id: paramResult.data.userId,
    });

    if (error) {
      return apiError(502, "ADMIN_PERMISSION_USER_UPDATE_FAILED", "Permission user could not be updated.", {
        message: error.message,
      });
    }

    return NextResponse.json({
      data,
      meta: { source: "supabase_rpc", rpc: "admin_update_permission_overrides" },
    });
  } catch {
    return apiError(500, "ADMIN_PERMISSION_USER_UPDATE_FAILED", "Permission user could not be updated.");
  }
}

function readRows(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter(isRow) : [];
}

function wouldRemoveOwnAdminAccess(input: z.infer<typeof permissionUserPatchSchema>) {
  if (input.roleTemplate && input.roleTemplate !== "admin") {
    return true;
  }

  return Boolean(
    input.overrides?.some(
      (override) =>
        selfProtectionPermissions.has(override.permissionId) &&
        override.effect !== "grant"
    )
  );
}

function toOverrideDto(row: DbRow) {
  return {
    effect: readString(row.effect) === "deny" ? "deny" : "grant",
    permissionId: readString(row.permission_id) ?? "",
    userId: readString(row.user_id) ?? "",
  };
}

function isRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
