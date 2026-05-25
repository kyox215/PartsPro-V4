import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const STAFF_ROLES = new Set(["sales", "warehouse", "purchasing", "admin"]);

type AdminAuthState =
  | { configured: false; allowed: true; reason: "demo_missing_env" }
  | { configured: false; allowed: false; reason: "missing_env" }
  | { configured: true; allowed: true; reason: "staff"; role: string }
  | { configured: true; allowed: false; reason: "missing_session" | "not_staff"; role?: string };

export async function getAdminAuthState(): Promise<AdminAuthState> {
  if (!isSupabaseConfigured()) {
    if (isDemoAuthEnabled()) {
      return { configured: false, allowed: true, reason: "demo_missing_env" };
    }

    return { configured: false, allowed: false, reason: "missing_env" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { configured: true, allowed: false, reason: "missing_session" };
  }

  const role = await readStaffRole(supabase, user.id);

  if (role && STAFF_ROLES.has(role)) {
    return { configured: true, allowed: true, reason: "staff", role };
  }

  return { configured: true, allowed: false, reason: "not_staff", role: role ?? undefined };
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

function isDemoAuthEnabled() {
  return (
    process.env.PARTSPRO_ENABLE_DEMO_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  );
}
