"use server";

import { type AuthFormState, PASSWORD_RECOVERY_COOKIE, SIGNUP_RESEND_AT_COOKIE } from "@/lib/partspro-auth-form-state";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { cleanAuthRedirect, postLoginRedirect, requestOrigin } from "@/lib/partspro-auth-redirect";
import { seedCurrentAccountPreferredLocaleFromCookies } from "@/i18n/account-locale";
import { resolveLocaleScope } from "@/i18n/config";
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
    return {error:"config",email};
  }

  if (!email || !password) {
    return {error:"missing",email};
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password }).catch(() => ({error:{message:"network"}}));

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      await setPendingSignupEmail(email);
      redirect(signupVerificationUrl(next, "unconfirmed"));
    }

    return {error:"invalid",email};
  }

  const accountSynced = await syncCurrentUserAccount();

  if (!accountSynced) {
    await supabase.auth.signOut({ scope: "local" });
    return {error:"account",email};
  }

  await seedCurrentAccountPreferredLocaleFromCookies(resolveLocaleScope("/login", next));

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
    return {error:"config",email,displayName};
  }

  if (!email || !password) {
    return {error:"missing",email,displayName};
  }

  if (password.length < 8) {
    return {error:"weak",email,displayName};
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
  }).catch(() => ({data:{session:null},error:{message:"network"}}));

  if (error) {
    const message = error.message.toLowerCase();
    return {error:message.includes("registered") ? "exists" : "signup",email,displayName};
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
    return {error:"config",email};
  }

  if (!email || token.length !== 6) {
    return {error:"code_missing",email};
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  }).catch(() => ({error:{message:"network"}}));

  if (error) {
    return {error:"code",email};
  }

  const accountSynced = await syncCurrentUserAccount();

  if (!accountSynced) {
    await supabase.auth.signOut({ scope: "local" });
    return {error:"account",email};
  }

  await clearPendingSignupEmail();
  await seedCurrentAccountPreferredLocaleFromCookies(resolveLocaleScope("/login", next));

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
    return {error:"config",email};
  }

  if (!email) {
    return {error:"email_required",email};
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
  }).catch(() => ({error:{message:"network"}}));

  if (error) {
    const message = error.message.toLowerCase();
    return {error:message.includes("rate") ? "resend_rate" : "resend",email,retryAt:Date.now()+60_000};
  }

  await setPendingSignupEmail(email);
  return {notice:"code_resent",email,retryAt:Date.now()+60_000};
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
  cookieStore.set(SIGNUP_RESEND_AT_COOKIE, String(Date.now()+60_000), {httpOnly:true,path:"/login",maxAge:60,sameSite:"lax",secure:process.env.NODE_ENV === "production"});
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

export async function signInForm(_state: AuthFormState, formData: FormData): Promise<AuthFormState> { return {...await signInWithPassword(formData),attempt:Date.now()}; }
export async function signUpForm(_state: AuthFormState, formData: FormData): Promise<AuthFormState> { return {...await signUpWithPassword(formData),attempt:Date.now()}; }
export async function verifySignupForm(_state: AuthFormState, formData: FormData): Promise<AuthFormState> { return verifySignupCode(formData); }
export async function resendSignupForm(_state: AuthFormState, formData: FormData): Promise<AuthFormState> { return resendSignupCode(formData); }

export async function requestPasswordRecovery(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = normalizeSignupVerificationEmail(formData.get("email"));
  const next = cleanAuthRedirect(formData.get("next"));
  if (!isSupabaseConfigured()) return {error:"config",email};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {error:"email_required",email};
  const client = await createClient();
  const origin = requestOrigin(await headers());
  try {
    const {error} = await client.auth.resetPasswordForEmail(email,{redirectTo:`${origin}/auth/recovery?${new URLSearchParams({next})}`});
    if (error) return {error: /rate/i.test(error.message) ? "resend_rate" : "recovery",email,retryAt:Date.now()+60_000};
    return {notice:"recovery_sent",email,retryAt:Date.now()+60_000};
  } catch { return {error:"recovery",email}; }
}

export async function updateRecoveredPassword(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const next = cleanAuthRedirect(formData.get("next"));
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");
  if (!isSupabaseConfigured()) return {error:"config"};
  if (password.length < 8) return {error:"weak"};
  if (password !== confirmation) return {error:"password_mismatch"};
  const client = await createClient();
  const {data:{user},error:authError} = await client.auth.getUser();
  const cookieStore = await cookies();
  if (authError || !user || cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !== user.id) return {error:"recovery_expired"};
  try {
    const {error} = await client.auth.updateUser({password});
    if (error) return {error:"password_update"};
  } catch { return {error:"password_update"}; }
  cookieStore.set(PASSWORD_RECOVERY_COOKIE,"",{httpOnly:true,path:"/",maxAge:0,sameSite:"lax",secure:process.env.NODE_ENV === "production"});
  await client.auth.signOut({scope:"local"}).catch(() => undefined);
  redirect(`/login?${new URLSearchParams({next,notice:"password_updated"})}`);
}
