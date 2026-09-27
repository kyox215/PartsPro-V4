"use client";

import type { PartProduct } from "@/lib/partspro-data";
import { tx, txFormat } from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";

export function ProductPriceExplanation({ product, detailed = false }: { product: PartProduct; detailed?: boolean }) {
  const t = useT();
  if (!product.priceResolved || !product.priceVersion || product.price <= 0) return null;
  const priceType = product.customerType === "wholesale"
    ? tx(t, "storefront.price.wholesale", "Prezzo ingrosso")
    : tx(t, "storefront.price.retail", "Prezzo al dettaglio");
  const exempt = product.priceSource?.includes("discount_exempt");
  return <p className="mt-1 text-[11px] leading-4 text-slate-600">
    {priceType}
    {exempt ? ` · ${tx(t, "storefront.price.exempt", "Non soggetto a sconti di livello")}` : null}
    {detailed && product.customerLevel ? ` · ${txFormat(t, "storefront.price.effectiveLevel", "Livello applicato: {level}", { level: product.customerLevel })}` : null}
  </p>;
}
