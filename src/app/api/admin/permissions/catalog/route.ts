import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

type DbRow = Record<string, unknown>;

export async function GET() {
  const admin = await requireAdminApi("employees.read");

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const supabase = await createClient();
    const [permissions, templates, templatePermissions] = await Promise.all([
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
    ]);

    const error = permissions.error ?? templates.error ?? templatePermissions.error;

    if (error) {
      return apiError(502, "ADMIN_PERMISSIONS_CATALOG_READ_FAILED", "Admin permissions catalog could not be read.", {
        message: error.message,
      });
    }

    const templatePermissionRows = readRows(templatePermissions.data);

    return NextResponse.json({
      data: {
        permissions: readRows(permissions.data).map(toPermissionDto),
        roleTemplates: readRows(templates.data).map((template) =>
          toRoleTemplateDto(template, templatePermissionRows)
        ),
      },
      meta: { source: "supabase" },
    });
  } catch {
    return apiError(500, "ADMIN_PERMISSIONS_CATALOG_UNAVAILABLE", "Admin permissions catalog is temporarily unavailable.");
  }
}

function readRows(value: unknown): DbRow[] {
  return Array.isArray(value) ? value.filter(isRow) : [];
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

function isRow(value: unknown): value is DbRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
