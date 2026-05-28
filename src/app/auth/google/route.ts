import { NextResponse } from "next/server";
import { AUTH_NEXT_COOKIE } from "@/lib/partspro-auth-cookies";
import { cleanAuthRedirect, loginUrl, requestOrigin } from "@/lib/partspro-auth-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestOrigin(request.headers, requestUrl.origin);
  const next = cleanAuthRedirect(requestUrl.searchParams.get("next"), "/account");
  const prompt = requestUrl.searchParams.get("prompt") === "select_account"
    ? "select_account"
    : undefined;

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}${loginUrl(next, "config")}`);
  }

  const callbackUrl = new URL("/auth/callback", origin);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      queryParams: prompt ? { prompt } : undefined,
      redirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}${loginUrl(next, "oauth")}`);
  }

  const response = NextResponse.redirect(data.url);
  response.cookies.set(AUTH_NEXT_COOKIE, next, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/auth/callback",
    sameSite: "lax",
    secure: origin.startsWith("https://"),
  });

  return response;
}
