// Keep the visual shell away from operational and callback routes.
export function isStorefrontPath(pathname: string) {
  // Unknown public URLs still render the storefront's not-found page.
  return !["/admin", "/api", "/auth", "/internal"].some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  );
}

export function hasStorefrontMobileNavigation(pathname: string) {
  return ["/", "/catalogo", "/account", "/help"].includes(pathname);
}
