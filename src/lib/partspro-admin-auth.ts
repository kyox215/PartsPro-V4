import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STAFF_ROLES = new Set([
  "sales",
  "warehouse",
  "purchasing",
  "admin",
  "staff",
  "employee",
]);
const ADMIN_EMAILS = new Set(
  (process.env.PARTSPRO_ADMIN_EMAILS ?? "kyox120@gmail.com")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
);

type AdminAuthState =
  | { configured: false; allowed: false; reason: "missing_env" }
  | { configured: true; allowed: true; reason: "admin_email" | "staff"; role: string }
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
    return { configured: true, allowed: true, reason: "admin_email", role: "admin" };
  }

  const role = await readStaffRole(supabase, user.id);

  if (role && STAFF_ROLES.has(role)) {
    return { configured: true, allowed: true, reason: "staff", role };
  }

  return { configured: true, allowed: false, reason: "not_staff", role: role ?? undefined };
}

function isAdminEmail(email: string | undefined) {
  return Boolean(email && ADMIN_EMAILS.has(normalizeEmail(email)));
}

function normalizeEmail(email: string | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

async function readStaffRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return typeof data?.role === "string" ? data.role : null;
}
