export const locales = ["it-IT", "zh-CN"] as const;

export type Locale = (typeof locales)[number];
export type LocaleScope = "storefront" | "admin";

export const defaultLocaleByScope: Record<LocaleScope, Locale> = {
  storefront: "it-IT",
  admin: "zh-CN",
};

export const localeCookieByScope: Record<LocaleScope, string> = {
  storefront: "partspro_locale_storefront",
  admin: "partspro_locale_admin",
};

export const localeLabels: Record<Locale, string> = {
  "it-IT": "Italiano",
  "zh-CN": "中文",
};

export const localeShortLabels: Record<Locale, string> = {
  "it-IT": "IT",
  "zh-CN": "中",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

export function isLocaleScope(value: unknown): value is LocaleScope {
  return value === "storefront" || value === "admin";
}

export function resolveLocaleScope(
  pathname: string,
  nextValue?: string | null
): LocaleScope {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }

  if (
    pathname === "/login" &&
    nextValue &&
    (nextValue === "/admin" || nextValue.startsWith("/admin/"))
  ) {
    return "admin";
  }

  return "storefront";
}
