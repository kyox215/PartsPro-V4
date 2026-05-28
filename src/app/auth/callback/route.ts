import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_NEXT_COOKIE } from "@/lib/partspro-auth-cookies";
import { cleanAuthRedirect, loginUrl, postLoginRedirect, requestOrigin } from "@/lib/partspro-auth-redirect";
import { ensureCurrentUserAccount } from "@/lib/partspro-account-context";
import { getAdminAuthState } from "@/lib/partspro-admin-auth";
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
      const accountSynced = await syncCurrentUserAccount();

      if (!accountSynced) {
        await supabase.auth.signOut({ scope: "local" });
        return redirectAndClearNext(`${origin}${loginUrl(next, "account")}`);
      }

      const adminAuth = await getAdminAuthState();
      const redirectPath = postLoginRedirect(next, {
        adminAllowed: adminAuth.allowed,
      });

      return redirectAndClearNext(`${origin}${redirectPath}`);
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

async function syncCurrentUserAccount() {
  try {
    return isSuccessfulAccountSync(await ensureCurrentUserAccount());
  } catch (error) {
    console.error("Failed to sync current user account during OAuth callback", error);
    return false;
  }
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
