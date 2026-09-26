"use client";

import Link from "next/link";
import { PartsProLogo } from "./logo";
import { useT } from "./i18n-provider";

export function StorefrontLoading() {
  const t = useT();
  return (
    <main className="min-h-screen bg-[#f4f6fa] text-slate-950" aria-busy="true">
      <header className="flex h-16 items-center justify-between border-b bg-white px-4">
        <Link href="/" aria-label={t("nav.home")}><PartsProLogo /></Link>
        <Link href="/catalogo" className="text-sm font-semibold">{t("nav.catalog")}</Link>
      </header>
      <div className="mx-auto max-w-[1500px] space-y-4 p-4">
        <p role="status" className="text-sm text-slate-600">{t("common.loading")}</p>
        <div className="h-32 rounded-lg bg-white motion-safe:animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="h-36 rounded-lg border border-slate-200 bg-white sm:h-64 motion-safe:animate-pulse" />)}
        </div>
      </div>
    </main>
  );
}
