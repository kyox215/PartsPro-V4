import { createClient } from "@/lib/supabase/server";
import { adminPermissions } from "@/lib/partspro-permissions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STAFF_ROLES = new Set([
  "sales",
  "warehouse",
  "purchasing",
  "admin",
  "catalog_manager",
  "commerce_manager",
  "pricing_manager",
  "inventory_manager",
  "sales_support",
  "auditor",
]);
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
      email: string | null;
      allowed: true;
      permissions: string[];
      reason: "admin_email" | "staff";
      role: string;
      userId: string;
    }
  | {
      configured: true;
      allowed: false;
      reason: "missing_session" | "not_staff" | "permission_unavailable";
      role?: string;
    };

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

  const profile = await readStaffProfile(supabase, user.id);
  const role = profile?.role;

  if (isBootstrapAdminEmail(user.email)) {
    const remotePermissions = await readEffectivePermissions(supabase);
    const permissions = mergePermissions(
      adminPermissions,
      remotePermissions.ok ? remotePermissions.permissions : []
    );

    return {
      configured: true,
      email: user.email ?? null,
      allowed: true,
      permissions,
      reason: "admin_email",
      role: role ?? "admin",
      userId: user.id,
    };
  }

  if (role && (STAFF_ROLES.has(role) || profile?.accountType === "employee")) {
    const remotePermissions = await readEffectivePermissions(supabase);

    if (!remotePermissions.ok) {
      return {
        configured: true,
        allowed: false,
        reason: "permission_unavailable",
        role,
      };
    }

    return {
      configured: true,
      email: user.email ?? null,
      allowed: true,
      permissions: remotePermissions.permissions,
      reason: "staff",
      role,
      userId: user.id,
    };
  }

  return { configured: true, allowed: false, reason: "not_staff", role: role ?? undefined };
}

export function isBootstrapAdminEmail(email: string | null | undefined) {
  return Boolean(email && ADMIN_EMAILS.has(normalizeEmail(email)));
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

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function mergePermissions(...permissionLists: Array<Iterable<string>>) {
  return [...new Set(permissionLists.flatMap((permissions) => [...permissions]))];
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
    case "employees.read":
      return ["employees.manage_permissions"];
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

async function readEffectivePermissions(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase.rpc("partspro_my_permissions");

  if (error || !Array.isArray(data)) {
    return { ok: false as const, permissions: [] };
  }

  return {
    ok: true as const,
    permissions: data.filter((permission): permission is string => typeof permission === "string"),
  };
}
