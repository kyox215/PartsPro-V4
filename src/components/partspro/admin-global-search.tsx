"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import * as React from "react";
import { AdminEmptyState, AdminNotice } from "./admin-feedback";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import { AdminSearchField } from "./admin-ui-controls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "./i18n-provider";

type SearchResult = { id: string; kind: "order" | "product" | "account"; title: string; subtitle: string; href: string };

export function AdminGlobalSearch() {
  const { locale } = useI18n();
  const zh = locale.startsWith("zh");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [state, setState] = React.useState<"idle" | "pending" | "ready" | "error">("idle");
  const [partial, setPartial] = React.useState(false);
  React.useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (document.querySelector('[data-admin-mutating="true"]')) return;
        setOpen(value => !value);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);
  React.useEffect(() => {
    if (!open || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("pending");
      setPartial(false);
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("search unavailable");
        const payload = await response.json();
        if (controller.signal.aborted) return;
        setResults(Array.isArray(payload.data) ? payload.data : []);
        setPartial(payload.meta?.partial === true);
        setState("ready");
      } catch {
        if (!controller.signal.aborted) { setResults([]); setState("error"); }
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query]);
  const labels = (locale.startsWith("en") ? englishUiCopy({ order: "Ordine", product: "Prodotto", account: "Account" }) : zh ? { order: "订单", product: "商品", account: "账号" } : { order: "Ordine", product: "Prodotto", account: "Account" });
  return <>
    <Button variant="outline" type="button" aria-label={(locale.startsWith("en") ? englishUiCopy("Cerca ordini, prodotti e account") : zh ? "搜索订单、商品和账号" : "Cerca ordini, prodotti e account")} title="Ctrl / ⌘ K" className="ml-auto min-h-11 min-w-11 shrink bg-white sm:min-h-10 md:max-w-[240px] lg:max-w-md lg:flex-1 md:justify-start md:text-slate-500" onClick={() => { if (!document.querySelector('[data-admin-mutating="true"]')) setOpen(true); }}>
      <Search className="size-4" /><span className="hidden truncate md:inline">{(locale.startsWith("en") ? englishUiCopy("Cerca ordini, SKU, clienti…") : zh ? "搜索订单、SKU、客户…" : "Cerca ordini, SKU, clienti…")}</span>
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="admin-ui-panel sm:max-w-xl">
        <DialogHeader><DialogTitle>{(locale.startsWith("en") ? englishUiCopy("Ricerca nel pannello") : zh ? "后台搜索" : "Ricerca nel pannello")}</DialogTitle><DialogDescription>{(locale.startsWith("en") ? englishUiCopy("Inserisci almeno 2 caratteri. I risultati rispettano i tuoi permessi.") : zh ? "输入至少2个字符，搜索你有权访问的订单、商品和账号。" : "Inserisci almeno 2 caratteri. I risultati rispettano i tuoi permessi.")}</DialogDescription></DialogHeader>
        <AdminSearchField autoFocus aria-label={(locale.startsWith("en") ? englishUiCopy("Termine di ricerca") : zh ? "搜索关键字" : "Termine di ricerca")} pending={state === "pending"} value={query} onValueChange={value => { setQuery(value); setState("idle"); setResults([]); setPartial(false); }} placeholder={(locale.startsWith("en") ? englishUiCopy("Numero ordine, SKU, nome o email") : zh ? "订单号、SKU、姓名或邮箱" : "Numero ordine, SKU, nome o email")} />
        <div className="max-h-[55dvh] min-h-24 space-y-2 overflow-y-auto" aria-busy={state === "pending"}>
          {state === "pending" && <p role="status" className="flex items-center gap-2 p-3 text-sm"><Loader2 className="size-4 animate-spin" />{(locale.startsWith("en") ? englishUiCopy("Ricerca…") : zh ? "搜索中…" : "Ricerca…")}</p>}
          {state === "error" && <AdminNotice tone="error" message={(locale.startsWith("en") ? englishUiCopy("Ricerca non disponibile. Riprova.") : zh ? "搜索读取失败，请修改关键字重试。" : "Ricerca non disponibile. Riprova.")} />}
          {partial && <AdminNotice tone="warning" message={(locale.startsWith("en") ? englishUiCopy("Alcuni moduli non sono disponibili. Risultati parziali.") : zh ? "部分模块读取失败，以下为已读取的结果。" : "Alcuni moduli non sono disponibili. Risultati parziali.")} />}
          {state === "ready" && results.length === 0 && <AdminEmptyState title={(locale.startsWith("en") ? englishUiCopy("Nessun risultato.") : zh ? "没有匹配结果。" : "Nessun risultato.")} />}
          {results.map(result => <Link key={`${result.kind}:${result.id}`} href={result.href} onClick={() => setOpen(false)} className="block rounded-md border p-3 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-primary">
            <span className="text-xs text-primary">{labels[result.kind]}</span><div className="break-words text-sm font-semibold">{result.title}</div><div className="break-all text-xs text-slate-500">{result.subtitle}</div>
          </Link>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
