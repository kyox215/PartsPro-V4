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
  checkoutHref?: string;
  compact?: boolean;
  consumeUrlIntent?: boolean;
  continueHref?: string;
  lineCount?: number;
  summaryNote?: string;
  totals?: CartTotals;
};

export function OrderSummaryCard({
  totals,
  ...props
}: OrderSummaryCardProps) {
  if (totals) {
    return (
      <OrderSummaryCardView
        {...props}
        isHydrated
        totals={totals}
      />
    );
  }

  return <ConnectedOrderSummaryCard {...props} />;
}

function ConnectedOrderSummaryCard({
  consumeUrlIntent = false,
  ...props
}: Omit<OrderSummaryCardProps, "totals">) {
  const cart = useCart({ consumeUrlIntent, preserveUnknown: true });

  return (
    <OrderSummaryCardView
      {...props}
      isHydrated={cart.isHydrated}
      totals={cart.totals}
    />
  );
}

function OrderSummaryCardView({
  showCheckoutAction = true,
  checkoutLabel,
  checkoutDisabled = false,
  checkoutHref = "/checkout",
  compact = false,
  continueHref = "/catalogo",
  isHydrated,
  lineCount,
  summaryNote,
  totals,
}: Omit<OrderSummaryCardProps, "consumeUrlIntent"> & {
  isHydrated: boolean;
  totals: CartTotals;
}) {
  const t = useT();
  const { locale } = useI18n();
  const effectiveCheckoutLabel =
    checkoutLabel ?? tx(t, "storefront.cart.checkoutLabel", "Procedi al checkout");
  const effectiveSummaryNote =
    summaryNote ??
    tx(t, "storefront.cart.summaryNote", "Il carrello non blocca stock: disponibilita e quantita vengono riservate solo alla conferma ordine.");
  const effectiveCheckoutDisabled =
    checkoutDisabled || (!isHydrated || totals.lines.length === 0);
  const effectiveLineCount = lineCount ?? totals.lines.length;

  return (
    <Card
      size={compact ? "sm" : "default"}
      className="h-fit border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] lg:sticky lg:top-28"
    >
      <CardHeader className={compact ? "px-3" : undefined}>
        <CardTitle className={compact ? "flex items-center gap-2 text-base" : "flex items-center gap-2"}>
          <ShoppingBag className={compact ? "size-4 text-primary" : "size-5 text-primary"} />
          {tx(t, "storefront.cart.summaryTitle", "Riepilogo ordine")}
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? "space-y-2 px-3" : "space-y-3"}>
        <Line compact={compact} label={tx(t, "storefront.cart.rows", "Righe")} value={String(effectiveLineCount)} />
        <Line compact={compact} label={tx(t, "storefront.common.subtotal", "Subtotale")} value={formatMoney(totals.subtotal, locale)} />
        <Line
          compact={compact}
          label={tx(t, "storefront.common.shipping", "Spedizione")}
          value={
            totals.shipping === 0
              ? tx(t, "storefront.common.free", "Gratis")
              : formatMoney(totals.shipping, locale)
          }
        />
        <Line compact={compact} label={`${tx(t, "storefront.common.vat", "IVA")} 22%`} value={formatMoney(totals.vat, locale)} />
        <Separator />
        <Line compact={compact} label={tx(t, "storefront.common.total", "Totale")} value={formatMoney(totals.total, locale)} strong />
        <div className={compact ? "rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] font-semibold leading-4 text-amber-900" : "rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900"}>
          {!isHydrated
            ? tx(t, "storefront.cart.summaryLoading", "Caricamento carrello salvato nel browser...")
            : effectiveSummaryNote}
        </div>
        {showCheckoutAction && (
          effectiveCheckoutDisabled ? (
            <Button className={compact ? "mt-1 h-10 w-full" : "mt-1 h-11 w-full"} disabled>
              {effectiveCheckoutLabel}
            </Button>
          ) : (
            <Button asChild className={compact ? "mt-1 h-10 w-full" : "mt-1 h-11 w-full"}>
              <Link href={checkoutHref}>{effectiveCheckoutLabel}</Link>
            </Button>
          )
        )}
        <Button variant="outline" asChild className={compact ? "h-9 w-full bg-white" : "w-full bg-white"}>
          <Link href={continueHref}>{tx(t, "storefront.common.continueShopping", "Continua acquisti")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Line({
  compact = false,
  label,
  value,
  strong = false,
}: {
  compact?: boolean;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={compact ? "flex min-w-0 items-center justify-between gap-3 text-xs" : "flex min-w-0 items-center justify-between gap-3 text-sm"}>
      <span className={strong ? "shrink-0 font-black" : "shrink-0 text-slate-500"}>{label}</span>
      <span className={strong ? (compact ? "min-w-0 text-right text-lg font-black" : "min-w-0 text-right text-xl font-black") : "min-w-0 text-right font-bold"}>
        {value}
      </span>
    </div>
  );
}
