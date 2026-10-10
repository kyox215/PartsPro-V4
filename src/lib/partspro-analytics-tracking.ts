import type { BeforeSendEvent } from "@vercel/analytics";

const publicHosts = new Set(["partspro.app", "www.partspro.app"]);

export function isPublicAnalyticsPath(pathname: string | null): boolean {
  return pathname !== null && (
    pathname === "/" ||
    /^\/catalogo\/?$/.test(pathname) ||
    /^\/prodotto\/[^/]+\/?$/.test(pathname)
  );
}

export function sanitizePublicAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;

  try {
    const url = new URL(event.url);
    if (
      url.protocol !== "https:" ||
      !publicHosts.has(url.host) ||
      url.username || url.password ||
      !isPublicAnalyticsPath(url.pathname)
    ) return null;

    // Check every event, including SPA navigation after the script has loaded.
    // Queries can contain search terms or identifiers; only retain public paths.
    return { ...event, url: `${url.origin}${url.pathname}` };
  } catch {
    return null;
  }
}
