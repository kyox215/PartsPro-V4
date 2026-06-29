import { cookies } from "next/headers";
import {
  isLocale,
  localeCookieByScope,
  type Locale,
  type LocaleScope,
} from "@/i18n/config";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type PersistLocaleResult = {
  authenticated: boolean;
  persisted: boolean;
};

export function readLocaleCookie(
  cookieStore: CookieStore,
  scope: LocaleScope
): Locale | null {
  const value = cookieStore.get(localeCookieByScope[scope])?.value;

  return isLocale(value) ? value : null;
}

export function readPreferredLocaleCookie(
  cookieStore: CookieStore,
  primaryScope: LocaleScope
): Locale | null {
  const primaryLocale = readLocaleCookie(cookieStore, primaryScope);

  if (primaryLocale) {
    return primaryLocale;
  }

  return primaryScope === "admin"
    ? readLocaleCookie(cookieStore, "storefront")
    : readLocaleCookie(cookieStore, "admin");
}

export async function readCurrentAccountPreferredLocale(
  cookieStore?: CookieStore
): Promise<Locale | null> {
  const supabase = await createAuthenticatedLocaleClient(cookieStore);

  if (!supabase) {
    return null;
  }

  const { user } = supabase;
  const { data, error } = await supabase.client
    .from("profiles")
    .select("preferred_locale")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return null;
  }

  const preferredLocale = data?.preferred_locale;

  return isLocale(preferredLocale) ? preferredLocale : null;
}

export async function persistCurrentAccountPreferredLocale(
  locale: Locale,
  options: { onlyIfMissing?: boolean } = {}
): Promise<PersistLocaleResult> {
  const supabase = await createAuthenticatedLocaleClient();

  if (!supabase) {
    return { authenticated: false, persisted: false };
  }

  await supabase.client.rpc("ensure_current_user_account");

  let query = supabase.client
    .from("profiles")
    .update({ preferred_locale: locale })
    .eq("id", supabase.user.id);

  if (options.onlyIfMissing) {
    query = query.is("preferred_locale", null);
  }

  const { data, error } = await query
    .select("preferred_locale")
    .maybeSingle();

  return {
    authenticated: true,
    persisted: !error && isLocale(data?.preferred_locale),
  };
}

export async function seedCurrentAccountPreferredLocaleFromCookies(
  primaryScope: LocaleScope
): Promise<PersistLocaleResult> {
  const cookieStore = await cookies();
  const locale = readPreferredLocaleCookie(cookieStore, primaryScope);

  if (!locale) {
    return { authenticated: false, persisted: false };
  }

  return persistCurrentAccountPreferredLocale(locale, { onlyIfMissing: true });
}

async function createAuthenticatedLocaleClient(cookieStore?: CookieStore) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!(await hasSupabaseSessionCookie(cookieStore))) {
    return null;
  }

  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  return { client, user };
}

async function hasSupabaseSessionCookie(cookieStore?: CookieStore) {
  const currentCookieStore = cookieStore ?? (await cookies());
  const { url } = getSupabaseEnv();
  const projectRef = new URL(url).hostname.split(".")[0];
  const authCookiePrefix = `sb-${projectRef}-auth-token`;

  return currentCookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith(authCookiePrefix));
}
