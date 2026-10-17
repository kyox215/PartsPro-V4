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

export async function setLocale(locale: Locale | null, scope: LocaleScope) {
  if ((locale !== null && !isLocale(locale)) || !isLocaleScope(scope)) {
    return { ok: false };
  }

  const cookieStore = await cookies();
  cookieStore.set(localeCookieByScope[scope], locale ?? "", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: locale === null ? 0 : 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");

  return {
    ok: true,
    locale,
    scope,
    persisted: true,
  };
}
