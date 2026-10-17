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
  const render = (list: string[]) => <div className="pp-compatible-models">{list.map((model) => <span key={model} className="pp-compatible-model" data-matched={Boolean(match) && model.toLowerCase().includes(match.toLowerCase())}>{model}</span>)}</div>;
  return <div className="pp-compatibility-list">{render(ordered.slice(0, 4))}{models.length > 4 && <details className="pp-compatibility-more"><summary>{txFormat(t,"storefront.ux.allModels","Mostra tutti i {count} modelli compatibili",{count:models.length})}</summary>{render(ordered.slice(4))}</details>}</div>;
}
