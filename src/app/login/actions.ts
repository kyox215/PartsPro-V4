"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cleanAuthRedirect, loginUrl, postLoginRedirect } from "@/lib/partspro-auth-redirect";
import { ensureCurrentUserAccount } from "@/lib/partspro-account-context";
import { getAdminAuthState } from "@/lib/partspro-admin-auth";

export async function signInWithPassword(formData: FormData) {
  const next = cleanAuthRedirect(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!isSupabaseConfigured()) {
    redirect(loginUrl(next, "config"));
  }

  if (!email || !password) {
    redirect(loginUrl(next, "missing"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(loginUrl(next, "invalid"));
  }

  await ensureCurrentUserAccount();
  const adminAuth = await getAdminAuthState();

  redirect(postLoginRedirect(next, {
    adminAllowed: adminAuth.allowed,
  }));
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  redirect("/login");
}
