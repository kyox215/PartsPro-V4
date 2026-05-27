const DEFAULT_LOGIN_REDIRECT = "/account";
const CUSTOMER_POST_LOGIN_REDIRECT = "/";
const STAFF_POST_LOGIN_REDIRECT = "/admin";

type HeaderReader = {
  get(name: string): string | null;
};

type PostLoginAccountState = {
  adminAllowed?: boolean;
};

export function cleanAuthRedirect(
  value: FormDataEntryValue | string | null | undefined,
  fallback = DEFAULT_LOGIN_REDIRECT
) {
  const next = typeof value === "string" ? value : fallback;

  if (!next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  return next;
}

export function loginUrl(next: string, error?: string) {
  const params = new URLSearchParams({ next: cleanAuthRedirect(next) });

  if (error) {
    params.set("error", error);
  }

  return `/login?${params.toString()}`;
}

export function postLoginRedirect(next: string, account: PostLoginAccountState) {
  if (account.adminAllowed) {
    return STAFF_POST_LOGIN_REDIRECT;
  }

  const cleanedNext = cleanAuthRedirect(next, CUSTOMER_POST_LOGIN_REDIRECT);

  if (cleanedNext === DEFAULT_LOGIN_REDIRECT || cleanedNext === "/login") {
    return CUSTOMER_POST_LOGIN_REDIRECT;
  }

  if (cleanedNext === STAFF_POST_LOGIN_REDIRECT || cleanedNext.startsWith(`${STAFF_POST_LOGIN_REDIRECT}/`)) {
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
