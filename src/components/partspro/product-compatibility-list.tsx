"use client";
import { useSearchParams } from "next/navigation";
import { useT } from "./i18n-provider";
import { txFormat } from "@/i18n/dictionaries/storefront";
export function ProductCompatibilityList({ models }: { models: string[] }) {
  const params = useSearchParams(); const t = useT();
  const returnTo = params.get("returnTo");
  let match = "";
  try { const p = new URL(returnTo || "/catalogo", "https://partspro.invalid").searchParams; match = p.get("model") || p.get("q") || ""; } catch { /* no context */ }
  const ordered = [...models].sort((a,b) => Number(b.toLowerCase().includes(match.toLowerCase())) - Number(a.toLowerCase().includes(match.toLowerCase())));
  const render = (list: string[]) => <div className="flex flex-wrap gap-1.5">{list.map((model) => <span key={model} className="max-w-full break-words rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{model}</span>)}</div>;
  return <div className="mt-2 space-y-2">{render(ordered.slice(0, 4))}{models.length > 4 && <details><summary className="min-h-11 cursor-pointer py-2 text-xs font-semibold text-primary">{txFormat(t,"storefront.ux.allModels","Mostra tutti i {count} modelli compatibili",{count:models.length})}</summary>{render(ordered.slice(4))}</details>}</div>;
}
