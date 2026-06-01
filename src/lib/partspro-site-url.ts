const fallbackSiteUrl = "https://www.partspro.app";

export function getPartsProSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    fallbackSiteUrl;
  const normalizedUrl = configuredUrl.startsWith("http")
    ? configuredUrl
    : `https://${configuredUrl}`;

  try {
    return new URL(normalizedUrl).origin;
  } catch {
    return fallbackSiteUrl;
  }
}
