import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveLocaleScope } from "@/i18n/config";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  const scope = resolveLocaleScope(pathname, request.nextUrl.searchParams.get("next"));

  requestHeaders.set("x-partspro-pathname", pathname);
  requestHeaders.set("x-partspro-locale-scope", scope);

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headers ?? {}).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/auth/:path*",
    "/carrello/:path*",
    "/checkout/:path*",
    "/login/:path*",
    "/rma/:path*",
  ],
};
