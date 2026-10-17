"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PartsProLogo } from "./logo";
import { useT } from "./i18n-provider";

export function StoreFooter() {
  const pathname = usePathname();
  const t = useT();
  if (!["/", "/catalogo", "/help"].includes(pathname) && !pathname.startsWith("/prodotto/")) return null;

  return (
    <footer className="pp-store-footer">
      <Link href="/" className="pp-store-footer-brand"><PartsProLogo /></Link>
      <nav aria-label="PartsPro">
        <Link href="/catalogo">{t("nav.catalog")}</Link>
        <Link href="/account">{t("nav.account")}</Link>
        <Link href="/help">{t("storefront.ux.help")}</Link>
      </nav>
      <span className="pp-store-footer-year">© {new Date().getFullYear()} PartsPro</span>
    </footer>
  );
}
