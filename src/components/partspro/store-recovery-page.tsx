"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AsyncFeedback } from "./async-feedback";
import { StoreHeader } from "./store-header";
import { useT } from "./i18n-provider";
import { tx } from "@/i18n/dictionaries/storefront";
export function StoreRecoveryPage({ error = false, onRetry }: { error?: boolean; onRetry?: () => void }) {
  const t=useT();
  return <main className="min-h-screen bg-background"><StoreHeader /><div className="mx-auto max-w-3xl space-y-4 px-4 py-10"><AsyncFeedback state={error ? "error" : "empty"} title={error ? tx(t,"storefront.ux.pageError","Impossibile aprire questa pagina") : tx(t,"storefront.ux.productMissing","Pagina o prodotto non disponibile")} description={error ? tx(t,"storefront.ux.pageErrorBody","Riprova o torna al catalogo per continuare.") : tx(t,"storefront.ux.productMissingBody","Il collegamento potrebbe essere scaduto oppure il prodotto non è più disponibile. Cerca uno SKU o modello nel catalogo.")} actions={<>{onRetry && <Button onClick={onRetry}>{tx(t,"common.retry","Riprova")}</Button>}<Button asChild variant="outline"><Link href="/catalogo">{tx(t,"storefront.ux.browseCatalog","Sfoglia catalogo")}</Link></Button><Button asChild variant="ghost"><Link href="/">{tx(t,"nav.home","Home")}</Link></Button></>} /></div></main>;
}
