export const locales = ["en-US", "it-IT", "zh-CN"] as const;

export type Locale = (typeof locales)[number];
export type LocaleScope = "storefront" | "admin";

export const defaultLocaleByScope: Record<LocaleScope, Locale> = {
  storefront: "en-US",
  admin: "en-US",
};

export const localeCookieByScope: Record<LocaleScope, string> = {
  storefront: "partspro_locale_device_v2",
  admin: "partspro_locale_device_v2",
};

export const localeLabels: Record<Locale, string> = {
  "en-US": "English",
  "it-IT": "Italiano",
  "zh-CN": "中文",
};

export const localeShortLabels: Record<Locale, string> = {
  "en-US": "EN",
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
    (nextValue.split(/[?#]/)[0] === "/admin" || nextValue.startsWith("/admin/"))
  ) {
    return "admin";
  }

  return "storefront";
}

/** Use the device's primary preference. Unsupported primary languages use English. */
export function deviceLocale(acceptLanguage: string | null | undefined): Locale {
  const preferences = (acceptLanguage ?? "").split(",").map((entry, index) => {
    const [tag, ...parameters] = entry.trim().split(";");
    const quality = parameters.find(value => value.trim().startsWith("q="));
    const weight = quality ? Number(quality.trim().slice(2)) : 1;
    return { tag: tag.trim().toLowerCase(), weight, index };
  }).filter(item => item.tag && Number.isFinite(item.weight) && item.weight > 0 && item.weight <= 1)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  const primary = preferences[0]?.tag.split("-")[0];
  return primary === "zh" ? "zh-CN" : primary === "it" ? "it-IT" : "en-US";
}
