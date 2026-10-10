const DEFAULT_LOGIN_REDIRECT = "/account";
const CUSTOMER_POST_LOGIN_REDIRECT = "/account";
const STAFF_POST_LOGIN_REDIRECT = "/admin";

type HeaderReader = {
  get(name: string): string | null;
};

type PostLoginAccountState = {
  adminAllowed?: boolean;
  profileComplete?: boolean;
};

export function cleanAuthRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback = DEFAULT_LOGIN_REDIRECT
) {
  const next = typeof value === "string" ? value : fallback;

  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) {
    return fallback;
  }

  try {
    const url = new URL(next, "https://partspro.invalid");
    if (url.origin !== "https://partspro.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}

export function loginUrl(next: string, error?: string, notice?: string) {
  const params = new URLSearchParams({ next: cleanAuthRedirect(next) });

  if (error) {
    params.set("error", error);
  }

  if (notice) {
    params.set("notice", notice);
  }

  return `/login?${params.toString()}`;
}

export function postLoginRedirect(next: string, account: PostLoginAccountState) {
  if (account.adminAllowed) {
    return STAFF_POST_LOGIN_REDIRECT;
  }

  if (account.profileComplete === false) {
    const original = cleanAuthRedirect(next, CUSTOMER_POST_LOGIN_REDIRECT);
    const parsed = new URL(original,"https://partspro.invalid");
    const requestedReturn = parsed.pathname === "/account" && parsed.searchParams.get("setup") === "1" ? parsed.searchParams.get("returnTo") : original;
    const returnTo = cleanAuthRedirect(requestedReturn,CUSTOMER_POST_LOGIN_REDIRECT);
    const params = new URLSearchParams({setup:"1"});
    const destination = new URL(returnTo,"https://partspro.invalid");
    const loopsToSetup = destination.pathname === "/account" && destination.searchParams.get("setup") === "1";
    if (!loopsToSetup && returnTo !== CUSTOMER_POST_LOGIN_REDIRECT && !returnTo.startsWith("/login") && !returnTo.startsWith("/admin") && !returnTo.startsWith("/auth/")) params.set("returnTo",returnTo);
    return `${CUSTOMER_POST_LOGIN_REDIRECT}?${params}`;
  }

  const cleanedNext = cleanAuthRedirect(next, CUSTOMER_POST_LOGIN_REDIRECT);

  if (cleanedNext === DEFAULT_LOGIN_REDIRECT || cleanedNext === "/login" || cleanedNext.startsWith("/login?") || cleanedNext.startsWith("/login/")) {
    return CUSTOMER_POST_LOGIN_REDIRECT;
  }

  if (new URL(cleanedNext,"https://partspro.invalid").pathname === STAFF_POST_LOGIN_REDIRECT || cleanedNext.startsWith(`${STAFF_POST_LOGIN_REDIRECT}/`) || cleanedNext.startsWith("/auth/")) {
    return CUSTOMER_POST_LOGIN_REDIRECT;
  }

  return cleanedNext;
}

export function requestOrigin(headers: HeaderReader, fallbackOrigin = "http://localhost:3000") {
  const host = firstHeaderValue(headers.get("x-forwarded-host")) ?? firstHeaderValue(headers.get("host"));

  if (!host) {
    return fallbackOrigin;
  }

  const protocol = firstHeaderValue(headers.get("x-forwarded-proto")) ?? defaultProtocol(host);

  return `${protocol}://${host}`;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

function defaultProtocol(host: string) {
  return host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("[::1]")
    ? "http"
    : "https";
}
