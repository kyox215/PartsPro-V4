import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "../_shared";

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

const permissionOverrideSchema = z
  .object({
    effect: z.enum(["grant", "deny", "inherit"]),
    permissionId: z.string().trim().min(1).max(120),
  })
  .strict();

const permissionPatchSchema = z
  .object({
    overrides: z.array(permissionOverrideSchema).max(200).optional(),
    reason: z.string().trim().min(3).max(1000),
    roleTemplate: z.enum(roleTemplates).optional(),
    userId: z.string().trim().uuid(),
  })
  .strict();

type DbRow = Record<string, unknown>;
const selfProtectionPermissions = new Set(["employees.manage_permissions", "panel.settings"]);

export async function GET() {
  const admin = await requireAdminApi("employees.manage_permissions");

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const supabase = await createClient();
    const [permissions, templates, templatePermissions, overrides] = await Promise.all([
      supabase
        .from("admin_permissions")
        .select("id, label, group_name, description")
        .order("group_name", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("admin_role_templates")
        .select("id, label, description")
        .order("id", { ascending: true }),
      supabase
        .from("admin_role_template_permissions")
        .select("role_template_id, permission_id"),
      supabase
        .from("admin_user_permission_overrides")
        .select("user_id, permission_id, effect")
        .order("user_id", { ascending: true })
        .order("permission_id", { ascending: true }),
    ]);

    const error =
      permissions.error ??
      templates.error ??
      templatePermissions.error ??
      overrides.error;

    if (error) {
      return apiError(502, "ADMIN_PERMISSIONS_READ_FAILED", "Admin permissions could not be read.", {
        message: error.message,
      });
    }

    return NextResponse.json({
      data: {
        overrides: readRows(overrides.data).map(toOverrideDto),
        permissions: readRows(permissions.data).map(toPermissionDto),
        roleTemplates: readRows(templates.data).map((template) =>
          toRoleTemplateDto(template, readRows(templatePermissions.data))
        ),
      },
      meta: {
        source: "supabase",
        workflow: "role_templates + role_permissions + user_overrides",
      },
    });
  } catch {
    return apiError(
      500,
      "ADMIN_PERMISSIONS_UNAVAILABLE",
      "Admin permissions are temporarily unavailable."
    );
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminApi("employees.manage_permissions");

  if (!admin.ok) {
    return admin.response;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = permissionPatchSchema.safeParse(body.data);

  if (!parsed.success) {
    return apiError(400, "INVALID_ADMIN_PERMISSION_PAYLOAD", "Permission payload is invalid.", {
      issues: formatZodIssues(parsed.error),
    });
  }

  if (
    admin.authState.userId === parsed.data.userId &&
    wouldRemoveOwnAdminAccess(parsed.data)
  ) {
    return apiError(
      403,
      "ADMIN_SELF_PERMISSION_DOWNGRADE_DENIED",
      "Current admin account cannot remove its own settings or permission-management access.",
      { userId: parsed.data.userId }
    );
  }

  try {
    const supabase = await createClient();
    const rpcResult = await supabase.rpc("admin_update_permission_overrides", {
      p_overrides: parsed.data.overrides ?? [],
      p_reason: parsed.data.reason,
      p_role_template: parsed.data.roleTemplate ?? null,
      p_user_id: parsed.data.userId,
    });

    if (rpcResult.error) {
      return apiError(502, "ADMIN_PERMISSION_UPDATE_FAILED", "Permissions could not be updated.", {
        message: rpcResult.error.message,
      });
    }

    const { data, error } = await supabase
      .from("admin_user_permission_overrides")
      .select("user_id, permission_id, effect")
      .eq("user_id", parsed.data.userId)
      .order("permission_id", { ascending: true });

    if (error) {
      return apiError(502, "ADMIN_PERMISSION_OVERRIDES_READ_FAILED", "Permission overrides could not be read.", {
        message: error.message,
      });
    }

    return NextResponse.json({
      data: {
        overrides: readRows(data).map(toOverrideDto),
        userId: parsed.data.userId,
      },
      meta: {
        source: "supabase",
      },
    });
  } catch {
    return apiError(500, "ADMIN_PERMISSION_UPDATE_FAILED", "Permissions could not be updated.");
  }
}

function readRows(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter(isRow) : [];
}

function wouldRemoveOwnAdminAccess(input: z.infer<typeof permissionPatchSchema>) {
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

function toPermissionDto(row: DbRow) {
  return {
    description: readString(row.description),
    groupName: readString(row.group_name) ?? "other",
    id: readString(row.id) ?? "",
    label: readString(row.label) ?? readString(row.id) ?? "",
  };
}

function toRoleTemplateDto(row: DbRow, templatePermissions: DbRow[]) {
  const id = readString(row.id) ?? "";

  return {
    description: readString(row.description),
    id,
    label: readString(row.label) ?? id,
    permissions: templatePermissions
      .filter((permission) => readString(permission.role_template_id) === id)
      .map((permission) => readString(permission.permission_id))
      .filter((permission): permission is string => Boolean(permission)),
  };
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
