import { NextResponse, type NextRequest } from "next/server";
import { resolveLocaleScope } from "@/i18n/config";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  const scope = resolveLocaleScope(pathname, request.nextUrl.searchParams.get("next"));

  requestHeaders.set("x-partspro-pathname", pathname);
  requestHeaders.set("x-partspro-locale-scope", scope);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
