import { cookies, headers } from "next/headers";
import {
  defaultLocaleByScope,
  isLocale,
  isLocaleScope,
  localeCookieByScope,
  resolveLocaleScope,
  type Locale,
  type LocaleScope,
} from "./config";

export type RequestI18n = {
  locale: Locale;
  scope: LocaleScope;
};

export async function getRequestI18n(): Promise<RequestI18n> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const pathname = headerStore.get("x-partspro-pathname") ?? "/";
  const headerScope = headerStore.get("x-partspro-locale-scope");
  const scope = isLocaleScope(headerScope)
    ? headerScope
    : resolveLocaleScope(pathname);
  const cookieLocale = cookieStore.get(localeCookieByScope[scope])?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : defaultLocaleByScope[scope];

  return { locale, scope };
}
