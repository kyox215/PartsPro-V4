"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  isLocale,
  isLocaleScope,
  localeCookieByScope,
  type Locale,
  type LocaleScope,
} from "@/i18n/config";
import { persistCurrentAccountPreferredLocale } from "@/i18n/account-locale";

export async function setLocale(locale: Locale, scope: LocaleScope) {
  if (!isLocale(locale) || !isLocaleScope(scope)) {
    return { ok: false };
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieByScope[scope], locale, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  const persistence = await persistCurrentAccountPreferredLocale(locale);

  revalidatePath("/", "layout");

  return {
    ok: true,
    locale,
    scope,
    persisted: persistence.persisted,
  };
}
