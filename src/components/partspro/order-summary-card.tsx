"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { tx } from "@/i18n/dictionaries/storefront";
import { formatMoney } from "@/i18n/format";
import { cn } from "@/lib/utils";
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
  showContinueAction?: boolean;
  sticky?: boolean;
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
  showContinueAction = true,
  sticky = true,
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
    tx(t, "storefront.cart.summaryNote", "Il carrello non blocca stock: spedizione €6,50, gratuita da €100; disponibilita e quantita vengono verificate alla conferma.");
  const effectiveLineCount = lineCount ?? totals.lines.length;
  const effectiveCheckoutDisabled =
    checkoutDisabled || !isHydrated || effectiveLineCount === 0;

  return (
    <Card
      size={compact ? "sm" : "default"}
      className={cn(
        "h-fit border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]",
        sticky && "lg:sticky lg:top-28"
      )}
    >
      <CardHeader className={compact ? "px-3" : undefined}>
        <CardTitle className={compact ? "flex items-center gap-2 text-base" : "flex items-center gap-2"}>
          <ShoppingBag className={compact ? "size-4 text-primary" : "size-5 text-primary"} />
          {tx(t, "storefront.cart.summaryTitle", "Riepilogo ordine")}
        </CardTitle>
      </CardHeader>
      <CardContent className={compact ? "space-y-2 px-3" : "space-y-3"}>
        <Line compact={compact} label={tx(t, "storefront.cart.rows", "Articoli")} value={String(effectiveLineCount)} />
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
        <Separator />
        <Line compact={compact} label={tx(t, "storefront.common.total", "Totale")} value={formatMoney(totals.total, locale)} strong />
        <div className={compact ? "rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] font-semibold leading-4 text-amber-900" : "rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900"}>
          {!isHydrated
            ? tx(t, "storefront.cart.summaryLoading", "Caricamento carrello del tuo account...")
            : effectiveSummaryNote}
        </div>
        {(showCheckoutAction || showContinueAction) && (
          <div className="grid gap-2">
            {showCheckoutAction && (
              effectiveCheckoutDisabled ? (
                <Button className={compact ? "min-h-10 w-full whitespace-normal leading-5" : "min-h-11 w-full whitespace-normal leading-5"} disabled>
                  {effectiveCheckoutLabel}
                </Button>
              ) : (
                <Button asChild className={compact ? "min-h-10 w-full whitespace-normal leading-5" : "min-h-11 w-full whitespace-normal leading-5"}>
                  <Link href={checkoutHref}>{effectiveCheckoutLabel}</Link>
                </Button>
              )
            )}
            {showContinueAction && (
              <Button variant="outline" asChild className={compact ? "min-h-9 w-full whitespace-normal bg-white leading-5" : "min-h-10 w-full whitespace-normal bg-white leading-5"}>
                <Link href={continueHref}>{tx(t, "storefront.common.continueShopping", "Continua acquisti")}</Link>
              </Button>
            )}
          </div>
        )}
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
