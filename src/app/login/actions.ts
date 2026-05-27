"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cleanAuthRedirect, loginUrl, postLoginRedirect, requestOrigin } from "@/lib/partspro-auth-redirect";
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

export async function signUpWithPassword(formData: FormData) {
  const next = cleanAuthRedirect(formData.get("next"));
  const email = String(formData.get("signupEmail") ?? "").trim();
  const password = String(formData.get("signupPassword") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!isSupabaseConfigured()) {
    redirect(loginUrl(next, "config"));
  }

  if (!email || !password) {
    redirect(loginUrl(next, "missing"));
  }

  if (password.length < 8) {
    redirect(loginUrl(next, "weak"));
  }

  const headersList = await headers();
  const origin = requestOrigin(headersList);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: `${origin}/auth/callback?${new URLSearchParams({ next }).toString()}`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    redirect(loginUrl(next, message.includes("registered") ? "exists" : "signup"));
  }

  if (data.session) {
    await ensureCurrentUserAccount();
    const adminAuth = await getAdminAuthState();

    redirect(postLoginRedirect(next, {
      adminAllowed: adminAuth.allowed,
    }));
  }

  redirect(loginUrl(next, undefined, "confirm"));
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  redirect("/login");
}
