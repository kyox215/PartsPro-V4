"use client";

import type { ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { PartProduct } from "@/lib/partspro-data";
import { useI18n } from "./i18n-provider";
import { useDelayedVisible } from "./pending-feedback";
import { usePriceFreshness, useStorefrontRefresh } from "./storefront-refresh-provider";

export function RefreshStatus({ initialLoading = false, busy = false, failed = false, retry, compact = false }: { initialLoading?: boolean; busy?: boolean; failed?: boolean; retry?: () => void; compact?: boolean }) {
  const state = useStorefrontRefresh();
  const { locale } = useI18n();
  const zh = locale === "zh-CN";
  const error = failed || Boolean(state.error);
  const pending = initialLoading || busy || state.refreshing;
  const visible = useDelayedVisible(pending, 120);
  if (!error && !visible) return <span className={compact ? "pp-refresh-placeholder" : "pp-refresh-status-reserved"} aria-hidden="true" />;
  return <div role={error ? "alert" : "status"} aria-live="polite" className="pp-refresh-status" data-error={error || undefined}>
    {!error ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none"/> : null}
    <span>{error ? compact ? zh ? "价格待核对" : "Prezzo da verificare" : zh ? "更新未完成，页面内容已保留。" : "Aggiornamento non riuscito. Contenuti conservati." : zh ? "正在更新…" : "Aggiornamento…"}</span>
    {error ? <button type="button" onClick={retry ?? state.retry}><RefreshCw className="size-3.5" aria-hidden="true"/>{zh ? "重试" : "Riprova"}</button> : null}
  </div>;
}

export function QuoteRegion({ product, pending = false, failed = false, retry, preserveState = false, children }: {product: Pick<PartProduct,"quoteStatus"|"priceValidUntil">; pending?: boolean; failed?: boolean; retry?:()=>void; preserveState?:boolean; children:ReactNode}) {
  const state = usePriceFreshness(product);
  const blocked = !state.available || state.refreshing || pending || failed;
  const stale = !state.available && !state.refreshing && !pending;
  const feedback = blocked ? <div className="pp-quote-pending" aria-busy={state.refreshing || pending}><RefreshStatus compact initialLoading={!state.error && !failed && !stale} failed={failed || stale} retry={retry}/></div> : null;
  // Purchase drafts belong to the account scope, not the lifetime of a quote.
  // Keep their component mounted while hiding and disabling the stale quotation.
  if (preserveState) return <><div hidden={blocked} inert={blocked || undefined} style={{ display: blocked ? "none" : "contents" }}>{children}</div>{feedback}</>;
  return blocked ? feedback : <>{children}</>;
}
