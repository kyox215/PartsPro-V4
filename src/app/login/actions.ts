"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cleanAuthRedirect, loginUrl, postLoginRedirect, requestOrigin } from "@/lib/partspro-auth-redirect";
import {
  ensureCurrentUserAccount,
  getCurrentAccountContext,
} from "@/lib/partspro-account-context";
import { getAdminAuthState } from "@/lib/partspro-admin-auth";
import {
  SIGNUP_VERIFICATION_COOKIE_MAX_AGE_SECONDS,
  SIGNUP_VERIFICATION_EMAIL_COOKIE,
  normalizeSignupVerificationCode,
  normalizeSignupVerificationEmail,
} from "@/lib/partspro-signup-verification";

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
    if (error.message.toLowerCase().includes("email not confirmed")) {
      await setPendingSignupEmail(email);
      redirect(signupVerificationUrl(next, "unconfirmed"));
    }

    redirect(loginUrl(next, "invalid"));
  }

  const accountSynced = await syncCurrentUserAccount();

  if (!accountSynced) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(loginUrl(next, "account"));
  }

  const [account, adminAuth] = await Promise.all([
    getCurrentAccountContext(),
    getAdminAuthState(),
  ]);

  redirect(postLoginRedirect(next, {
    adminAllowed: adminAuth.allowed,
    profileComplete:
      account.accountType !== "customer" || Boolean(account.customer?.profileCompletedAt),
  }));
}

export async function signUpWithPassword(formData: FormData) {
  const next = cleanAuthRedirect(formData.get("next"));
  const email = normalizeSignupVerificationEmail(formData.get("signupEmail"));
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
    await supabase.auth.signOut({ scope: "local" });
    await setPendingSignupEmail(email);
    redirect(signupVerificationUrl(next, "confirmation_config"));
  }

  await setPendingSignupEmail(email);
  redirect(signupVerificationUrl(next, undefined, "code_sent"));
}

export async function verifySignupCode(formData: FormData) {
  const next = cleanAuthRedirect(formData.get("next"));
  const email = await readSignupVerificationEmail(formData.get("verificationEmail"));
  const token = normalizeSignupVerificationCode(formData.get("verificationCode"));

  if (!isSupabaseConfigured()) {
    redirect(signupVerificationUrl(next, "config"));
  }

  if (!email || token.length !== 6) {
    redirect(signupVerificationUrl(next, "code_missing"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    redirect(signupVerificationUrl(next, "code"));
  }

  const accountSynced = await syncCurrentUserAccount();

  if (!accountSynced) {
    await supabase.auth.signOut({ scope: "local" });
    redirect(loginUrl(next, "account"));
  }

  await clearPendingSignupEmail();

  const [account, adminAuth] = await Promise.all([
    getCurrentAccountContext(),
    getAdminAuthState(),
  ]);

  redirect(postLoginRedirect(next, {
    adminAllowed: adminAuth.allowed,
    profileComplete:
      account.accountType !== "customer" || Boolean(account.customer?.profileCompletedAt),
  }));
}

export async function resendSignupCode(formData: FormData) {
  const next = cleanAuthRedirect(formData.get("next"));
  const email = await readSignupVerificationEmail(formData.get("verificationEmail"));

  if (!isSupabaseConfigured()) {
    redirect(signupVerificationUrl(next, "config"));
  }

  if (!email) {
    redirect(signupVerificationUrl(next, "email_required"));
  }

  const headersList = await headers();
  const origin = requestOrigin(headersList);
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?${new URLSearchParams({ next }).toString()}`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    redirect(signupVerificationUrl(next, message.includes("rate") ? "resend_rate" : "resend"));
  }

  await setPendingSignupEmail(email);
  redirect(signupVerificationUrl(next, undefined, "code_resent"));
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }

  redirect("/login");
}

async function syncCurrentUserAccount() {
  try {
    return isSuccessfulAccountSync(await ensureCurrentUserAccount());
  } catch (error) {
    console.error("Failed to sync current user account during password auth", error);
    return false;
  }
}

async function readSignupVerificationEmail(formValue: FormDataEntryValue | null) {
  const formEmail = normalizeSignupVerificationEmail(formValue);

  if (formEmail) {
    return formEmail;
  }

  const cookieStore = await cookies();

  return normalizeSignupVerificationEmail(
    cookieStore.get(SIGNUP_VERIFICATION_EMAIL_COOKIE)?.value
  );
}

async function setPendingSignupEmail(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(SIGNUP_VERIFICATION_EMAIL_COOKIE, email, {
    httpOnly: true,
    maxAge: SIGNUP_VERIFICATION_COOKIE_MAX_AGE_SECONDS,
    path: "/login",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function clearPendingSignupEmail() {
  const cookieStore = await cookies();
  cookieStore.set(SIGNUP_VERIFICATION_EMAIL_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/login",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function signupVerificationUrl(next: string, error?: string, notice?: string) {
  const params = new URLSearchParams({
    mode: "verify",
    next: cleanAuthRedirect(next),
  });

  if (error) {
    params.set("error", error);
  }

  if (notice) {
    params.set("notice", notice);
  }

  return `/login?${params.toString()}`;
}

function isSuccessfulAccountSync(result: unknown) {
  if (!result) {
    return false;
  }

  if (typeof result === "object") {
    const maybeFailure = result as { error?: unknown; ok?: unknown; success?: unknown };

    if (maybeFailure.error || maybeFailure.ok === false || maybeFailure.success === false) {
      return false;
    }
  }

  return true;
}
