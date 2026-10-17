"use client";

import Link from "next/link";
import { PartsProLogo } from "./logo";
import { useT } from "./i18n-provider";
import { LanguageSwitcher } from "./language-switcher";
import { RefreshStatus } from "./storefront-refresh-status";

export type LoadingVariant = "home" | "catalog" | "product" | "cart" | "checkout" | "account" | "rma" | "auth" | "professional" | "help";
export function StorefrontLoading({ variant = "catalog" }: {variant?: LoadingVariant}) {
  const t = useT();
  return (
    <main className="pp-loading-page bg-[#f4f6fa] text-slate-950" aria-busy="true" data-loading-variant={variant}>
      <header className="pp-loading-header flex h-16 items-center justify-between gap-4 border-b bg-white px-4">
        <Link href="/" className="pp-header-logo" aria-label={t("nav.home")}><PartsProLogo /></Link>
        <form action="/catalogo" className="pp-loading-search" role="search"><input name="q" aria-label={t("storefront.header.searchFull")} placeholder={t("storefront.header.searchFull")}/><button type="submit">{t("storefront.header.searchSubmit")}</button></form>
        <div className="flex items-center gap-4"><Link href="/catalogo" className="text-sm font-semibold">{t("nav.catalog")}</Link><LanguageSwitcher scope="storefront" presentation="menu" /></div>
      </header>
      <div className="mx-auto max-w-[1500px] space-y-4 p-4">
        <RefreshStatus initialLoading />
        <div className="pp-loading-content" aria-hidden="true">
          {variant === "catalog" || variant === "home" ? <><aside className="pp-skeleton-sidebar" /><section><div className="pp-skeleton-heading"/><div className="pp-skeleton-grid">{Array.from({length: 8}, (_, index)=><div className="pp-skeleton-card" key={index}/>)}</div></section></> : variant === "product" ? <><div className="pp-skeleton-product-image"/><section><div className="pp-skeleton-heading"/><div className="pp-skeleton-panel"/><div className="pp-skeleton-panel"/></section></> : <><aside className="pp-skeleton-sidebar"/><section><div className="pp-skeleton-heading"/><div className="pp-skeleton-panel"/><div className="pp-skeleton-panel"/></section></>}
        </div>
      </div>
    </main>
  );
}
