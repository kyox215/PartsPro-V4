"use client";

import Link from "next/link";
import { CircleHelp, Headphones } from "lucide-react";
import { tx } from "@/i18n/dictionaries/storefront";
import { usePathname } from "next/navigation";
import { PartsProLogo } from "./logo";
import { useT } from "./i18n-provider";

export function StoreFooter() {
  const pathname = usePathname();
  const t = useT();
  if (!["/", "/catalogo", "/help"].includes(pathname) && !pathname.startsWith("/prodotto/")) return null;

  return (
    <footer className="pp-store-footer">
      <div className="pp-footer-identity"><Link href="/" className="pp-store-footer-brand"><PartsProLogo /></Link><span>{tx(t,"storefront.reference.brandPromise","Ricambi professionali, acquisti sereni")}</span></div>
      <nav aria-label="PartsPro">
        <Link href="/help"><CircleHelp aria-hidden="true" />{t("storefront.ux.help")}</Link>
        <Link href="/help?support=open"><Headphones aria-hidden="true" />{tx(t,"storefront.reference.contact","Contattaci")}</Link>
      </nav>
      <span className="pp-store-footer-year">© {new Date().getFullYear()} PartsPro</span>
    </footer>
  );
}
