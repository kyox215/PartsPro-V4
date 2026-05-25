"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function signInWithPassword(formData: FormData) {
  const next = cleanNext(formData.get("next"));
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

  redirect(next);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}

function cleanNext(value: FormDataEntryValue | string | null) {
  const next = typeof value === "string" ? value : "/account";

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/account";
  }

  return next;
}

function loginUrl(next: string, error: string) {
  const params = new URLSearchParams({ next, error });

  return `/login?${params.toString()}`;
}
