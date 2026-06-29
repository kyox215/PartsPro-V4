import { cookies, headers } from "next/headers";
import {
  defaultLocaleByScope,
  isLocale,
  isLocaleScope,
  resolveLocaleScope,
  type Locale,
  type LocaleScope,
} from "./config";
import {
  readCurrentAccountPreferredLocale,
  readLocaleCookie,
} from "./account-locale";

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
  const accountLocale = await readCurrentAccountPreferredLocale(cookieStore);
  const cookieLocale = readLocaleCookie(cookieStore, scope);
  const locale = isLocale(accountLocale)
    ? accountLocale
    : cookieLocale ?? defaultLocaleByScope[scope];

  return { locale, scope };
}
