export const assistedOrderCompanyIdParam = "companyId";
export const assistedOrderStorageKey = "partspro.assistedOrder.companyId";

const supabaseUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SearchParamRecord = Record<string, string | string[] | undefined>;
type SearchParamReader = Pick<URLSearchParams, "get">;

export function normalizeAssistedCompanyId(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (typeof candidate !== "string") {
    return null;
  }

  const trimmed = candidate.trim();

  return supabaseUuidPattern.test(trimmed) ? trimmed : null;
}

export function readAssistedCompanyIdFromRecord(params: SearchParamRecord) {
  return normalizeAssistedCompanyId(params[assistedOrderCompanyIdParam]);
}

export function readAssistedCompanyIdFromSearchParams(
  params: SearchParamReader | null | undefined
) {
  return normalizeAssistedCompanyId(params?.get(assistedOrderCompanyIdParam));
}

export function hrefWithAssistedCompanyId(
  href: string,
  companyId?: string | null,
  extraParams?: Record<string, string | number | boolean | null | undefined>
) {
  const [pathname, rawQuery = ""] = href.split("?");
  const params = new URLSearchParams(rawQuery);
  const normalizedCompanyId = normalizeAssistedCompanyId(companyId);

  if (normalizedCompanyId) {
    params.set(assistedOrderCompanyIdParam, normalizedCompanyId);
  } else {
    params.delete(assistedOrderCompanyIdParam);
  }

  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value === null || value === undefined || value === false || value === "") {
      params.delete(key);
      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}

export function rememberAssistedCompanyId(companyId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedCompanyId = normalizeAssistedCompanyId(companyId);

  try {
    if (normalizedCompanyId) {
      window.sessionStorage.setItem(assistedOrderStorageKey, normalizedCompanyId);
    } else {
      window.sessionStorage.removeItem(assistedOrderStorageKey);
    }
  } catch {
    // URL is authoritative; session storage only helps the client keep context.
  }
}

export function clearAssistedCompanyId() {
  rememberAssistedCompanyId(null);
}

export function replaceCurrentUrlAssistedCompanyId(companyId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const nextHref = hrefWithAssistedCompanyId(
    `${window.location.pathname}${window.location.search}`,
    companyId
  );

  window.history.replaceState(null, "", nextHref);
}
