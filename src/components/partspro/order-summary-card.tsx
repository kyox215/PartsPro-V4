"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { tx } from "@/i18n/dictionaries/storefront";
import { formatMoney } from "@/i18n/format";
import { type CartTotals, useCart } from "./cart-state";
import { useI18n, useT } from "./i18n-provider";

type OrderSummaryCardProps = {
  showCheckoutAction?: boolean;
  checkoutLabel?: string;
  checkoutDisabled?: boolean;
  consumeUrlIntent?: boolean;
  summaryNote?: string;
  totals?: CartTotals;
};

export function OrderSummaryCard({
  showCheckoutAction = true,
  checkoutLabel,
  checkoutDisabled = false,
  consumeUrlIntent = false,
  summaryNote,
  totals,
}: OrderSummaryCardProps) {
  const t = useT();
  const { locale } = useI18n();
  const cart = useCart({ consumeUrlIntent, preserveUnknown: true });
  const previewTotals = totals ?? cart.totals;
  const effectiveCheckoutLabel =
    checkoutLabel ?? tx(t, "storefront.cart.checkoutLabel", "Procedi al checkout");
  const effectiveSummaryNote =
    summaryNote ??
    tx(t, "storefront.cart.summaryNote", "Totali calcolati dalla selezione salvata nel browser. Il checkout invia questi articoli all'ordine.");
  const effectiveCheckoutDisabled =
    checkoutDisabled || (!totals && (!cart.isHydrated || previewTotals.lines.length === 0));

  return (
    <Card className="h-fit border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] lg:sticky lg:top-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-primary" />
          {tx(t, "storefront.cart.summaryTitle", "Riepilogo ordine")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Line label={tx(t, "storefront.cart.rows", "Righe")} value={String(previewTotals.lines.length)} />
        <Line label={tx(t, "storefront.common.subtotal", "Subtotale")} value={formatMoney(previewTotals.subtotal, locale)} />
        <Line
          label={tx(t, "storefront.common.shipping", "Spedizione")}
          value={
            previewTotals.shipping === 0
              ? tx(t, "storefront.common.free", "Gratis")
              : formatMoney(previewTotals.shipping, locale)
          }
        />
        <Line label={`${tx(t, "storefront.common.vat", "IVA")} 22%`} value={formatMoney(previewTotals.vat, locale)} />
        <Separator />
        <Line label={tx(t, "storefront.common.total", "Totale")} value={formatMoney(previewTotals.total, locale)} strong />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
          {!totals && !cart.isHydrated
            ? tx(t, "storefront.cart.summaryLoading", "Caricamento carrello salvato nel browser...")
            : effectiveSummaryNote}
        </div>
        {showCheckoutAction && (
          effectiveCheckoutDisabled ? (
            <Button className="mt-1 h-11 w-full" disabled>
              {effectiveCheckoutLabel}
            </Button>
          ) : (
            <Button asChild className="mt-1 h-11 w-full">
              <Link href="/checkout">{effectiveCheckoutLabel}</Link>
            </Button>
          )
        )}
        <Button variant="outline" asChild className="w-full bg-white">
          <Link href="/catalogo">{tx(t, "storefront.common.continueShopping", "Continua acquisti")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
      <span className={strong ? "shrink-0 font-black" : "shrink-0 text-slate-500"}>{label}</span>
      <span className={strong ? "min-w-0 text-right text-xl font-black" : "min-w-0 text-right font-bold"}>
        {value}
      </span>
    </div>
  );
}
