import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_NEXT_COOKIE } from "@/lib/partspro-auth-cookies";
import { cleanAuthRedirect, loginUrl, requestOrigin } from "@/lib/partspro-auth-redirect";
import { ensureCurrentUserAccount } from "@/lib/partspro-account-context";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = requestOrigin(request.headers, requestUrl.origin);
  const cookieStore = await cookies();
  const next = cleanAuthRedirect(
    requestUrl.searchParams.get("next") ?? cookieStore.get(AUTH_NEXT_COOKIE)?.value,
    "/account"
  );
  const code = requestUrl.searchParams.get("code");

  if (!isSupabaseConfigured()) {
    return redirectAndClearNext(`${origin}${loginUrl(next, "config")}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await ensureCurrentUserAccount();
      return redirectAndClearNext(`${origin}${next}`);
    }
  }

  return redirectAndClearNext(`${origin}${loginUrl(next, "oauth")}`);
}

function redirectAndClearNext(url: string) {
  const response = NextResponse.redirect(url);
  response.cookies.set(AUTH_NEXT_COOKIE, "", {
    maxAge: 0,
    path: "/auth/callback",
  });

  return response;
}
