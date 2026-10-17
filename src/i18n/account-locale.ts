import type { cookies } from "next/headers";
import { isLocale, localeCookieByScope, type Locale, type LocaleScope } from "./config";

/** An explicit choice belongs to this device, never to the signed-in account. */
export function readLocaleCookie(
  cookieStore: Pick<Awaited<ReturnType<typeof cookies>>, "get">,
  scope: LocaleScope
): Locale | null {
  const value = cookieStore.get(localeCookieByScope[scope])?.value;
  return isLocale(value) ? value : null;
}
