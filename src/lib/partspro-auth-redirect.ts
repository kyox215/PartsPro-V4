const DEFAULT_LOGIN_REDIRECT = "/account";

type HeaderReader = {
  get(name: string): string | null;
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
