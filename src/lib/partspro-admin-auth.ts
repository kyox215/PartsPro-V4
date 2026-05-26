import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  adminPermissions,
  permissionsForRoleTemplate,
} from "@/lib/partspro-permissions";

const STAFF_ROLES = new Set([
  "sales",
  "warehouse",
  "purchasing",
  "admin",
  "catalog_manager",
  "pricing_manager",
  "inventory_manager",
  "sales_support",
  "auditor",
]);
const ADMIN_PERMISSIONS = new Set(adminPermissions);
const ADMIN_EMAILS = new Set(
  (process.env.PARTSPRO_ADMIN_EMAILS ?? "kyox120@gmail.com")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
);

type AdminAuthState =
  | { configured: false; allowed: false; reason: "missing_env" }
  | {
      configured: true;
      allowed: true;
      permissions: string[];
      reason: "admin_email" | "staff";
      role: string;
    }
  | { configured: true; allowed: false; reason: "missing_session" | "not_staff"; role?: string };

export async function getAdminAuthState(): Promise<AdminAuthState> {
  if (!isSupabaseConfigured()) {
    return { configured: false, allowed: false, reason: "missing_env" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { configured: true, allowed: false, reason: "missing_session" };
  }

  if (isAdminEmail(user.email)) {
    return {
      configured: true,
      allowed: true,
      permissions: [...ADMIN_PERMISSIONS],
      reason: "admin_email",
      role: "admin",
    };
  }

  const profile = await readStaffProfile(supabase, user.id);
  const role = profile?.role;
  const roleTemplate = profile?.roleTemplate ?? role;

  if (role && (STAFF_ROLES.has(role) || profile?.accountType === "employee")) {
    const remotePermissions = await readEffectivePermissions(supabase);
    const localPermissions = permissionsForRole(roleTemplate ?? null);

    return {
      configured: true,
      allowed: true,
      permissions: remotePermissions.length > 0 ? remotePermissions : [...localPermissions],
      reason: "staff",
      role,
    };
  }

  return { configured: true, allowed: false, reason: "not_staff", role: role ?? undefined };
}

export function hasAdminPermission(
  authState: AdminAuthState,
  permission: string
) {
  if (!authState.allowed) {
    return false;
  }

  const permissions = new Set(authState.permissions);

  if (permissions.has(permission)) {
    return true;
  }

  return permissionAliases(permission).some((alias) => permissions.has(alias));
}

function isAdminEmail(email: string | undefined) {
  return Boolean(email && ADMIN_EMAILS.has(normalizeEmail(email)));
}

function normalizeEmail(email: string | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function permissionAliases(permission: string) {
  switch (permission) {
    case "product.read_admin":
      return ["products.read_admin"];
    case "product.create_draft":
    case "product.edit_content":
    case "product.publish":
    case "product.hide":
    case "product.block":
    case "product.restore_draft":
    case "product.image_manage":
      return ["products.manage"];
    case "product.edit_price":
    case "product.edit_cost":
      return ["products.pricing", "products.manage"];
    case "product.adjust_stock":
      return ["inventory.manage"];
    default:
      return [];
  }
}

async function readStaffProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role, account_type, role_template")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return {
    accountType: typeof data?.account_type === "string" ? data.account_type : null,
    role: typeof data?.role === "string" ? data.role : null,
    roleTemplate:
      typeof data?.role_template === "string" && data.role_template.length > 0
        ? data.role_template
        : null,
  };
}

function permissionsForRole(role: string | null) {
  return permissionsForRoleTemplate(role);
}

async function readEffectivePermissions(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase.rpc("partspro_my_permissions");

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.filter((permission): permission is string => typeof permission === "string");
}
