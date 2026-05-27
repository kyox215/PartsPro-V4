"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatEuro, type PartProduct } from "@/lib/partspro-data";
import {
  CartCatalogProvider,
  type CartLine,
  type CartTotals,
  useCart,
} from "./cart-state";
import { PartVisual } from "./part-visual";
import { StoreHeader } from "./store-header";

type CartPageProps = {
  catalogProducts?: readonly PartProduct[];
};

export function CartPage({ catalogProducts = [] }: CartPageProps) {
  return (
    <CartCatalogProvider products={catalogProducts}>
      <CartPageContent />
    </CartCatalogProvider>
  );
}

function CartPageContent() {
  const cart = useCart({ consumeUrlIntent: true });
  const totals = cart.totals;
  const isEmpty = cart.isHydrated && totals.lines.length === 0;

  function changeQuantity(sku: string, direction: -1 | 1) {
    const line = totals.lines.find((item) => item.sku === sku);

    if (line) {
      cart.updateQuantity(sku, line.quantity + direction);
    }
  }

  function removeLine(sku: string) {
    cart.removeItem(sku);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader />
      <div className="mx-auto grid max-w-[1300px] gap-2 px-2 pt-2 pb-[calc(5.25rem_+_env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:pt-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-5">
        <section className="space-y-2 sm:space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <Badge className="mb-2 hidden border border-primary/20 bg-primary/8 text-primary lg:inline-flex">
                Carrello clienti
              </Badge>
              <h1 className="text-xl font-black tracking-normal sm:text-3xl md:text-4xl">
                Conferma prodotti e quantità
              </h1>
            </div>
          </div>

          <Card className="hidden border-emerald-200 bg-emerald-50 lg:block">
            <CardContent className="flex gap-2 p-3 text-xs text-emerald-950 sm:gap-3 sm:p-4 sm:text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 sm:size-5" />
              <div className="min-w-0">
                <div className="font-black">Carrello locale pronto per checkout</div>
                <p className="mt-1 leading-5 sm:hidden">
                  Le modifiche salvano gli articoli nel browser.
                </p>
                <p className="mt-1 hidden leading-6 sm:block">
                  Quantità e rimozioni aggiornano la selezione salvata nel
                  browser e saranno usate dal payload checkout. Il salvataggio
                  backend avviene solo alla conferma ordine.
                </p>
              </div>
            </CardContent>
          </Card>

          {!cart.isHydrated && (
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex flex-col items-start gap-3 p-4 sm:p-5">
                <div>
                  <div className="text-lg font-black">Caricamento carrello</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Lettura della selezione salvata in questo browser.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isEmpty && (
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex flex-col items-start gap-3 p-4 sm:p-5">
                <div>
                  <div className="text-lg font-black">Carrello vuoto</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Aggiungi prodotti dal catalogo per preparare il checkout.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild className="bg-white">
                    <Link href="/catalogo">Vai al catalogo</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {totals.lines.length > 0 && (
            <>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)] lg:hidden">
                {totals.lines.map((line) => (
                  <CartLineMobileRow
                    key={line.sku}
                    line={line}
                    onChangeQuantity={changeQuantity}
                    onRemove={removeLine}
                  />
                ))}
              </div>
              <div className="hidden space-y-4 lg:block">
                {totals.lines.map((line) => (
                  <CartLineDesktopCard
                    key={line.sku}
                    line={line}
                    onChangeQuantity={changeQuantity}
                    onRemove={removeLine}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <div className="hidden lg:block">
          <OrderSummaryCard
            totals={totals}
            checkoutDisabled={!cart.isHydrated || isEmpty}
            summaryNote="Totali aggiornati dalla selezione salvata nel browser. Il checkout invierà queste righe all'endpoint /api/orders."
          />
        </div>
      </div>
      <MobileCartCheckoutBar totals={totals} checkoutDisabled={!cart.isHydrated || isEmpty} />
    </main>
  );
}

type OrderSummaryCardProps = {
  showCheckoutAction?: boolean;
  checkoutLabel?: string;
  checkoutDisabled?: boolean;
  consumeUrlIntent?: boolean;
  summaryNote?: string;
  totals?: CartTotals;
};

type MobileCartCheckoutBarProps = {
  checkoutDisabled: boolean;
  totals: CartTotals;
};

type CartLineViewProps = {
  line: CartLine;
  onChangeQuantity: (sku: string, direction: -1 | 1) => void;
  onRemove: (sku: string) => void;
};

function CartLineMobileRow({ line, onChangeQuantity, onRemove }: CartLineViewProps) {
  const minimumQuantity = Math.max(1, line.product.moq);
  const canDecrease = line.quantity > minimumQuantity;
  const canIncrease = line.quantity < line.product.stock;

  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-2 border-b border-slate-100 px-2.5 py-2 last:border-b-0">
      <PartVisual variant={line.product.visual} className="size-10 rounded-md" />
      <div className="min-w-0 pt-0.5">
        <div className="line-clamp-2 break-words text-[13px] font-black leading-4">
          {line.product.name}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] leading-3 text-slate-500">
          {line.sku}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] leading-none">
            {line.product.grade}
          </Badge>
        </div>
      </div>
      <div className="grid min-w-[92px] justify-items-end gap-1 text-right">
        <div>
          <div className="whitespace-nowrap text-[13px] font-black leading-4">
            {formatEuro(line.lineTotal)}
          </div>
          <div className="whitespace-nowrap text-[10px] leading-3 text-slate-500">
            {formatEuro(line.product.price)} cad.
          </div>
        </div>
        <div className="inline-flex h-7 items-center rounded-md border bg-white">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-md"
            disabled={!canDecrease}
            onClick={() => onChangeQuantity(line.sku, -1)}
            aria-label={`Riduci quantità per ${line.sku}`}
            title={canDecrease ? "Riduci quantità" : `Quantità minima MOQ ${minimumQuantity}`}
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-6 text-center text-xs font-black" aria-live="polite">
            {line.quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-md"
            disabled={!canIncrease}
            onClick={() => onChangeQuantity(line.sku, 1)}
            aria-label={`Aumenta quantità per ${line.sku}`}
            title={canIncrease ? "Aumenta quantità" : "Stock disponibile esaurito"}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 rounded-md text-red-500"
          aria-label={`Rimuovi riga ${line.sku}`}
          title="Rimuovi questa riga dal carrello"
          onClick={() => onRemove(line.sku)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function CartLineDesktopCard({ line, onChangeQuantity, onRemove }: CartLineViewProps) {
  const minimumQuantity = Math.max(1, line.product.moq);
  const canDecrease = line.quantity > minimumQuantity;
  const canIncrease = line.quantity < line.product.stock;

  return (
    <Card className="border-slate-200 bg-white">
      <CardContent className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-4 p-4">
        <PartVisual variant={line.product.visual} className="size-24 rounded-lg" />
        <div className="min-w-0">
          <div className="text-lg font-black">{line.product.name}</div>
          <div className="mt-1 font-mono text-xs text-slate-500">{line.sku}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{line.product.grade}</Badge>
          </div>
        </div>
        <div className="block text-right">
          <div>
            <div className="whitespace-nowrap text-lg font-black">
              {formatEuro(line.lineTotal)}
            </div>
            <div className="whitespace-nowrap text-xs text-slate-500">
              {formatEuro(line.product.price)} cad.
            </div>
          </div>
          <div className="mt-3 inline-flex items-center rounded-lg border bg-white">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canDecrease}
              onClick={() => onChangeQuantity(line.sku, -1)}
              aria-label={`Riduci quantità per ${line.sku}`}
              title={canDecrease ? "Riduci quantità" : `Quantità minima MOQ ${minimumQuantity}`}
            >
              <Minus className="size-4" />
            </Button>
            <span className="w-10 text-center text-sm font-black" aria-live="polite">
              {line.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canIncrease}
              onClick={() => onChangeQuantity(line.sku, 1)}
              aria-label={`Aumenta quantità per ${line.sku}`}
              title={canIncrease ? "Aumenta quantità" : "Stock disponibile esaurito"}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mt-2 text-red-500"
            aria-label={`Rimuovi riga ${line.sku}`}
            title="Rimuovi questa riga dal carrello"
            onClick={() => onRemove(line.sku)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MobileCartCheckoutBar({ checkoutDisabled, totals }: MobileCartCheckoutBarProps) {
  const [expanded, setExpanded] = React.useState(false);
  const itemCount = totals.lines.reduce((total, line) => total + line.quantity, 0);
  const lineLabel = totals.lines.length === 1 ? "1 riga" : `${totals.lines.length} righe`;
  const itemLabel = itemCount === 1 ? "1 pezzo" : `${itemCount} pezzi`;
  const summaryId = React.useId();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-18px_40px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
      {expanded && (
        <div id={summaryId} className="border-b border-slate-200 px-3 py-2">
          <div className="space-y-1.5">
            <CompactSummaryLine label="Subtotale" value={formatEuro(totals.subtotal)} />
            <CompactSummaryLine
              label="Spedizione"
              value={totals.shipping === 0 ? "Gratis" : formatEuro(totals.shipping)}
            />
            <CompactSummaryLine label="IVA 22%" value={formatEuro(totals.vat)} />
            <CompactSummaryLine label="Totale" value={formatEuro(totals.total)} strong />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" asChild className="h-9 bg-white text-xs">
              <Link href="/catalogo">Continua</Link>
            </Button>
            {checkoutDisabled ? (
              <Button className="h-9 text-xs" disabled>
                Checkout
              </Button>
            ) : (
              <Button asChild className="h-9 text-xs">
                <Link href="/checkout">Checkout</Link>
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-[1300px] items-center justify-between gap-2 px-3 pt-2 pb-[calc(0.625rem_+_env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-controls={summaryId}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <div className="truncate text-[10px] font-bold uppercase tracking-normal text-slate-500">
            {lineLabel} · {itemLabel}
          </div>
          <div className="flex min-w-0 items-center gap-1 text-lg font-black" aria-live="polite">
            <span className="truncate">{formatEuro(totals.total)}</span>
            {expanded ? (
              <ChevronDown className="size-4 shrink-0 text-slate-500" />
            ) : (
              <ChevronUp className="size-4 shrink-0 text-slate-500" />
            )}
          </div>
        </button>
        {!expanded && (
          checkoutDisabled ? (
            <Button className="h-10 min-w-[128px] px-3" disabled>
              Checkout
            </Button>
          ) : (
            <Button asChild className="h-10 min-w-[128px] px-3">
              <Link href="/checkout">Checkout</Link>
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function CompactSummaryLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
      <span className={strong ? "font-black text-slate-950" : "font-semibold text-slate-500"}>
        {label}
      </span>
      <span className={strong ? "text-base font-black" : "font-bold text-slate-800"}>{value}</span>
    </div>
  );
}

export function OrderSummaryCard({
  showCheckoutAction = true,
  checkoutLabel = "Procedi al checkout",
  checkoutDisabled = false,
  consumeUrlIntent = false,
  summaryNote = "Totali calcolati dalla selezione salvata nel browser. Il checkout invia questi articoli all'endpoint esistente /api/orders.",
  totals,
}: OrderSummaryCardProps) {
  const cart = useCart({ consumeUrlIntent });
  const previewTotals = totals ?? cart.totals;
  const effectiveCheckoutDisabled =
    checkoutDisabled || (!totals && (!cart.isHydrated || previewTotals.lines.length === 0));

  return (
    <Card className="h-fit border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] lg:sticky lg:top-32">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-primary" />
          Riepilogo ordine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Line label="Righe" value={String(previewTotals.lines.length)} />
        <Line label="Subtotale" value={formatEuro(previewTotals.subtotal)} />
        <Line
          label="Spedizione"
          value={previewTotals.shipping === 0 ? "Gratis" : formatEuro(previewTotals.shipping)}
        />
        <Line label="IVA 22%" value={formatEuro(previewTotals.vat)} />
        <Separator />
        <Line label="Totale" value={formatEuro(previewTotals.total)} strong />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">
          {!totals && !cart.isHydrated ? "Caricamento carrello salvato nel browser..." : summaryNote}
        </div>
        {showCheckoutAction && (
          effectiveCheckoutDisabled ? (
            <Button className="mt-1 h-11 w-full" disabled>
              {checkoutLabel}
            </Button>
          ) : (
            <Button asChild className="mt-1 h-11 w-full">
              <Link href="/checkout">{checkoutLabel}</Link>
            </Button>
          )
        )}
        <Button variant="outline" asChild className="w-full bg-white">
          <Link href="/catalogo">Continua acquisti</Link>
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
