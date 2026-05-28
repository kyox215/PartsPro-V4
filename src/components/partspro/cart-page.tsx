"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { tx, txFormat } from "@/i18n/dictionaries/storefront";
import { formatMoney } from "@/i18n/format";
import { type PartProduct } from "@/lib/partspro-data";
import {
  CartCatalogProvider,
  type CartLine,
  type CartTotals,
  useCart,
} from "./cart-state";
import { useI18n, useT } from "./i18n-provider";
import { OrderSummaryCard } from "./order-summary-card";
import { StorefrontProductImage } from "./storefront-product-image";
import { StoreHeader } from "./store-header";

type CartPageProps = {
  catalogProducts?: readonly PartProduct[];
};

type CartPageContentProps = {
  catalogProducts: readonly PartProduct[];
  onCatalogProductsLoaded: (products: readonly PartProduct[]) => void;
};

type CartCatalogApiResponse = {
  data?: PartProduct[];
};

type CartCatalogLoadState = "idle" | "loading" | "ready" | "error";

export function CartPage({ catalogProducts = [] }: CartPageProps) {
  const [resolvedCatalogProducts, setResolvedCatalogProducts] = React.useState<PartProduct[]>(
    () => filterOrderableCatalogProducts(catalogProducts)
  );
  const handleCatalogProductsLoaded = React.useCallback(
    (products: readonly PartProduct[]) => {
      setResolvedCatalogProducts((current) =>
        mergeCatalogProducts(current, products)
      );
    },
    []
  );

  return (
    <CartCatalogProvider products={resolvedCatalogProducts}>
      <CartPageContent
        catalogProducts={resolvedCatalogProducts}
        onCatalogProductsLoaded={handleCatalogProductsLoaded}
      />
    </CartCatalogProvider>
  );
}

function CartPageContent({
  catalogProducts,
  onCatalogProductsLoaded,
}: CartPageContentProps) {
  const t = useT();
  const cart = useCart({ consumeUrlIntent: true, preserveUnknown: true });
  const [catalogLoadState, setCatalogLoadState] =
    React.useState<CartCatalogLoadState>("idle");
  const requestedCatalogSkus = React.useRef(new Set<string>());
  const catalogSkuSet = React.useMemo(
    () => new Set(catalogProducts.map((product) => product.sku)),
    [catalogProducts]
  );
  const totals = cart.totals;
  const isCatalogLoading =
    cart.isHydrated && catalogLoadState === "loading" && cart.items.length > 0;
  const isEmpty = cart.isHydrated && cart.items.length === 0;
  const unresolvedSkus = React.useMemo(() => {
    const resolvedSkus = new Set(totals.lines.map((line) => line.sku));

    return cart.items
      .map((item) => item.sku)
      .filter((sku) => !resolvedSkus.has(sku));
  }, [cart.items, totals.lines]);
  const hasUnresolvedItems =
    cart.isHydrated &&
    cart.items.length > 0 &&
    unresolvedSkus.length > 0 &&
    !isCatalogLoading;
  const checkoutDisabled =
    !cart.isHydrated ||
    isCatalogLoading ||
    totals.lines.length === 0 ||
    unresolvedSkus.length > 0;

  React.useEffect(() => {
    if (!cart.isHydrated || cart.items.length === 0) {
      return;
    }

    const missingSkus = cart.items
      .map((item) => item.sku)
      .filter(
        (sku) => !catalogSkuSet.has(sku) && !requestedCatalogSkus.current.has(sku)
      );

    if (missingSkus.length === 0) {
      setCatalogLoadState("ready");
      return;
    }

    const controller = new AbortController();

    missingSkus.forEach((sku) => requestedCatalogSkus.current.add(sku));
    setCatalogLoadState("loading");

    async function loadCartCatalogProducts() {
      try {
        const response = await fetch(
          `/api/cart/catalog?skus=${encodeURIComponent(missingSkus.join(","))}`,
          {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Unable to load cart catalog products");
        }

        const payload = (await response.json()) as CartCatalogApiResponse;
        onCatalogProductsLoaded(Array.isArray(payload.data) ? payload.data : []);
        setCatalogLoadState("ready");
      } catch {
        if (!controller.signal.aborted) {
          missingSkus.forEach((sku) => requestedCatalogSkus.current.delete(sku));
          setCatalogLoadState("error");
        }
      }
    }

    void loadCartCatalogProducts();

    return () => {
      controller.abort();
    };
  }, [cart.isHydrated, cart.items, catalogSkuSet, onCatalogProductsLoaded]);

  function changeQuantity(sku: string, direction: -1 | 1) {
    const line = totals.lines.find((item) => item.sku === sku);

    if (line) {
      cart.updateQuantity(sku, line.quantity + direction);
    }
  }

  function setQuantity(sku: string, quantity: number) {
    cart.updateQuantity(sku, quantity);
  }

  function removeLine(sku: string) {
    cart.removeItem(sku);
  }

  function removeUnresolvedLines() {
    unresolvedSkus.forEach((sku) => cart.removeItem(sku));
  }

  function clearCart() {
    if (
      window.confirm(
        tx(t, "storefront.cart.clearConfirm", "Svuotare tutti gli articoli dal carrello?")
      )
    ) {
      cart.clearCart();
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader />
      <div className="mx-auto grid max-w-[1300px] gap-2 px-2 pt-2 pb-[calc(5.25rem_+_env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:pt-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:pb-5">
        <section className="space-y-2 sm:space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <Badge className="mb-2 hidden border border-primary/20 bg-primary/8 text-primary lg:inline-flex">
                {tx(t, "storefront.cart.badge", "Carrello clienti")}
              </Badge>
              <h1 className="text-xl font-black tracking-normal sm:text-3xl md:text-4xl">
                {tx(t, "storefront.cart.title", "Conferma prodotti e quantità")}
              </h1>
            </div>
            {totals.lines.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="bg-white text-red-600 hover:text-red-700"
                onClick={clearCart}
              >
                <Trash2 className="size-4" />
                {tx(t, "storefront.cart.clear", "Svuota carrello")}
              </Button>
            )}
          </div>

          <Card className="hidden border-emerald-200 bg-emerald-50 lg:block">
            <CardContent className="flex gap-2 p-3 text-xs text-emerald-950 sm:gap-3 sm:p-4 sm:text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 sm:size-5" />
              <div className="min-w-0">
                <div className="font-black">
                  {tx(t, "storefront.cart.localReadyTitle", "Carrello locale pronto per checkout")}
                </div>
                <p className="mt-1 leading-5 sm:hidden">
                  {tx(t, "storefront.cart.localReadyShort", "Le modifiche salvano gli articoli nel browser.")}
                </p>
                <p className="mt-1 hidden leading-6 sm:block">
                  {tx(t, "storefront.cart.localReadyDescription", "Quantità e rimozioni aggiornano la selezione salvata nel browser e saranno usate dal payload checkout. Il salvataggio backend avviene solo alla conferma ordine.")}
                </p>
              </div>
            </CardContent>
          </Card>

          {!cart.isHydrated && (
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex flex-col items-start gap-3 p-4 sm:p-5">
                <div>
                  <div className="text-lg font-black">
                    {tx(t, "storefront.cart.loadingTitle", "Caricamento carrello")}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {tx(t, "storefront.cart.loadingDescription", "Lettura della selezione salvata in questo browser.")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isCatalogLoading && (
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex flex-col items-start gap-3 p-4 sm:p-5">
                <div>
                  <div className="text-lg font-black">
                    {tx(t, "storefront.cart.loadingProductsTitle", "Caricamento prodotti")}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {tx(t, "storefront.cart.loadingProductsDescription", "Recupero disponibilità, MOQ e prezzi per gli articoli salvati.")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isEmpty && (
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex flex-col items-start gap-3 p-4 sm:p-5">
                <div>
                  <div className="text-lg font-black">
                    {tx(t, "storefront.cart.emptyTitle", "Carrello vuoto")}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {tx(t, "storefront.cart.emptyDescription", "Aggiungi prodotti dal catalogo per preparare il checkout.")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild className="bg-white">
                    <Link href="/catalogo">{tx(t, "storefront.cart.goToCatalog", "Vai al catalogo")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {hasUnresolvedItems && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex flex-col items-start gap-3 p-4 text-amber-950 sm:p-5">
                <div>
                  <div className="text-lg font-black">
                    {tx(t, "storefront.cart.unresolvedTitle", "Prodotti del carrello non disponibili")}
                  </div>
                  <p className="mt-1 text-sm leading-6">
                    {tx(t, "storefront.cart.unresolvedDescription", "Aggiorna il catalogo o aggiungi nuovamente gli articoli disponibili.")}
                    {" "}
                    {tx(t, "storefront.cart.unresolvedPriceHint", "Il checkout richiede prezzi cliente validi.")}
                    {" "}
                    {unresolvedSkus.join(", ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild className="bg-white">
                    <Link href="/catalogo">{tx(t, "storefront.cart.goToCatalog", "Vai al catalogo")}</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white text-red-600 hover:text-red-700"
                    onClick={removeUnresolvedLines}
                  >
                    <Trash2 className="size-4" />
                    {tx(t, "storefront.cart.removeUnavailable", "Rimuovi non disponibili")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {catalogLoadState === "error" && !hasUnresolvedItems && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4 text-sm font-semibold leading-6 text-amber-950 sm:p-5">
                {tx(t, "storefront.cart.detailsError", "Alcuni dettagli del carrello non sono stati aggiornati. Ricarica la pagina se i totali non corrispondono.")}
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
                    onSetQuantity={setQuantity}
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
                    onSetQuantity={setQuantity}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <div className="hidden lg:block">
          <OrderSummaryCard
            totals={totals}
            checkoutDisabled={checkoutDisabled}
            summaryNote={tx(t, "storefront.cart.summaryNoteSynced", "Totali aggiornati dalla selezione salvata nel browser. Il checkout invierà queste righe all'endpoint /api/orders.")}
          />
        </div>
      </div>
      <MobileCartCheckoutBar
        totals={totals}
        checkoutDisabled={checkoutDisabled}
        onClear={clearCart}
      />
    </main>
  );
}

type MobileCartCheckoutBarProps = {
  checkoutDisabled: boolean;
  onClear: () => void;
  totals: CartTotals;
};

type CartLineViewProps = {
  line: CartLine;
  onChangeQuantity: (sku: string, direction: -1 | 1) => void;
  onRemove: (sku: string) => void;
  onSetQuantity: (sku: string, quantity: number) => void;
};

function CartLineMobileRow({
  line,
  onChangeQuantity,
  onRemove,
  onSetQuantity,
}: CartLineViewProps) {
  const t = useT();
  const { locale } = useI18n();
  const minimumQuantity = Math.max(1, line.product.moq);
  const canDecrease = line.quantity > minimumQuantity;
  const canIncrease = line.quantity < line.product.stock;

  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-2 border-b border-slate-100 px-2.5 py-2 last:border-b-0">
      <StorefrontProductImage
        product={line.product}
        sizes="40px"
        quality={55}
        className="size-10 rounded-md border border-slate-100 bg-slate-50"
        fallbackClassName="shrink-0"
        imageClassName="object-contain p-1"
      />
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
            {formatMoney(line.lineTotal, locale)}
          </div>
          <div className="whitespace-nowrap text-[10px] leading-3 text-slate-500">
            {txFormat(t, "storefront.cart.priceEach", "{price} cad.", {
              price: formatMoney(line.product.price, locale),
            })}
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
            aria-label={txFormat(t, "storefront.cart.decreaseAria", "Riduci quantità per {sku}", { sku: line.sku })}
            title={
              canDecrease
                ? tx(t, "storefront.cart.decreaseTitle", "Riduci quantità")
                : txFormat(t, "storefront.cart.minimumTitle", "Quantità minima MOQ {minimum}", { minimum: minimumQuantity })
            }
          >
            <Minus className="size-3.5" />
          </Button>
          <QuantityInput
            max={line.product.stock}
            min={minimumQuantity}
            quantity={line.quantity}
            sku={line.sku}
            compact
            onSetQuantity={onSetQuantity}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-md"
            disabled={!canIncrease}
            onClick={() => onChangeQuantity(line.sku, 1)}
            aria-label={txFormat(t, "storefront.cart.increaseAria", "Aumenta quantità per {sku}", { sku: line.sku })}
            title={
              canIncrease
                ? tx(t, "storefront.cart.increaseTitle", "Aumenta quantità")
                : tx(t, "storefront.cart.stockLimitTitle", "Stock disponibile esaurito")
            }
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 rounded-md text-red-500"
          aria-label={txFormat(t, "storefront.cart.removeLineAria", "Rimuovi riga {sku}", { sku: line.sku })}
          title={tx(t, "storefront.cart.removeLineTitle", "Rimuovi questa riga dal carrello")}
          onClick={() => onRemove(line.sku)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function CartLineDesktopCard({
  line,
  onChangeQuantity,
  onRemove,
  onSetQuantity,
}: CartLineViewProps) {
  const t = useT();
  const { locale } = useI18n();
  const minimumQuantity = Math.max(1, line.product.moq);
  const canDecrease = line.quantity > minimumQuantity;
  const canIncrease = line.quantity < line.product.stock;

  return (
    <Card className="border-slate-200 bg-white">
      <CardContent className="grid grid-cols-[92px_minmax(0,1fr)_auto] items-center gap-4 p-4">
        <StorefrontProductImage
          product={line.product}
          sizes="96px"
          quality={55}
          className="size-24 rounded-lg border border-slate-100 bg-slate-50"
          fallbackClassName="shrink-0"
          imageClassName="object-contain p-2"
        />
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
              {formatMoney(line.lineTotal, locale)}
            </div>
            <div className="whitespace-nowrap text-xs text-slate-500">
              {txFormat(t, "storefront.cart.priceEach", "{price} cad.", {
                price: formatMoney(line.product.price, locale),
              })}
            </div>
          </div>
          <div className="mt-3 inline-flex items-center rounded-lg border bg-white">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canDecrease}
              onClick={() => onChangeQuantity(line.sku, -1)}
              aria-label={txFormat(t, "storefront.cart.decreaseAria", "Riduci quantità per {sku}", { sku: line.sku })}
              title={
                canDecrease
                  ? tx(t, "storefront.cart.decreaseTitle", "Riduci quantità")
                  : txFormat(t, "storefront.cart.minimumTitle", "Quantità minima MOQ {minimum}", { minimum: minimumQuantity })
              }
            >
              <Minus className="size-4" />
            </Button>
            <QuantityInput
              max={line.product.stock}
              min={minimumQuantity}
              quantity={line.quantity}
              sku={line.sku}
              onSetQuantity={onSetQuantity}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!canIncrease}
              onClick={() => onChangeQuantity(line.sku, 1)}
              aria-label={txFormat(t, "storefront.cart.increaseAria", "Aumenta quantità per {sku}", { sku: line.sku })}
              title={
                canIncrease
                  ? tx(t, "storefront.cart.increaseTitle", "Aumenta quantità")
                  : tx(t, "storefront.cart.stockLimitTitle", "Stock disponibile esaurito")
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mt-2 text-red-500"
            aria-label={txFormat(t, "storefront.cart.removeLineAria", "Rimuovi riga {sku}", { sku: line.sku })}
            title={tx(t, "storefront.cart.removeLineTitle", "Rimuovi questa riga dal carrello")}
            onClick={() => onRemove(line.sku)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuantityInput({
  compact = false,
  max,
  min,
  onSetQuantity,
  quantity,
  sku,
}: {
  compact?: boolean;
  max: number;
  min: number;
  onSetQuantity: (sku: string, quantity: number) => void;
  quantity: number;
  sku: string;
}) {
  const t = useT();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextQuantity = Number(event.currentTarget.value);

    if (Number.isFinite(nextQuantity)) {
      onSetQuantity(sku, nextQuantity);
    }
  }

  return (
    <Input
      aria-label={txFormat(t, "storefront.cart.quantityAria", "Quantità per {sku}", { sku })}
      className={
        compact
          ? "h-6 w-9 border-0 bg-transparent px-0 text-center text-xs font-black shadow-none focus-visible:ring-0"
          : "h-8 w-12 border-0 bg-transparent px-0 text-center text-sm font-black shadow-none focus-visible:ring-0"
      }
      inputMode="numeric"
      max={max}
      min={min}
      step={1}
      type="number"
      value={quantity}
      onChange={handleChange}
    />
  );
}

function MobileCartCheckoutBar({
  checkoutDisabled,
  onClear,
  totals,
}: MobileCartCheckoutBarProps) {
  const t = useT();
  const { locale } = useI18n();
  const [expanded, setExpanded] = React.useState(false);
  const itemCount = totals.lines.reduce((total, line) => total + line.quantity, 0);
  const lineLabel =
    totals.lines.length === 1
      ? tx(t, "storefront.cart.lineCountOne", "1 riga")
      : txFormat(t, "storefront.cart.lineCountMany", "{count} righe", {
          count: totals.lines.length,
        });
  const itemLabel =
    itemCount === 1
      ? tx(t, "storefront.cart.itemCountOne", "1 pezzo")
      : txFormat(t, "storefront.cart.itemCountMany", "{count} pezzi", {
          count: itemCount,
        });
  const summaryId = React.useId();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-18px_40px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden">
      {expanded && (
        <div id={summaryId} className="border-b border-slate-200 px-3 py-2">
          <div className="space-y-1.5">
            <CompactSummaryLine
              label={tx(t, "storefront.common.subtotal", "Subtotale")}
              value={formatMoney(totals.subtotal, locale)}
            />
            <CompactSummaryLine
              label={tx(t, "storefront.common.shipping", "Spedizione")}
              value={
                totals.shipping === 0
                  ? tx(t, "storefront.common.free", "Gratis")
                  : formatMoney(totals.shipping, locale)
              }
            />
            <CompactSummaryLine
              label={`${tx(t, "storefront.common.vat", "IVA")} 22%`}
              value={formatMoney(totals.vat, locale)}
            />
            <CompactSummaryLine
              label={tx(t, "storefront.common.total", "Totale")}
              value={formatMoney(totals.total, locale)}
              strong
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" asChild className="h-9 bg-white text-xs">
              <Link href="/catalogo">{tx(t, "storefront.cart.continueShort", "Continua")}</Link>
            </Button>
            {checkoutDisabled ? (
              <Button className="h-9 text-xs" disabled>
                {tx(t, "storefront.common.checkout", "Checkout")}
              </Button>
            ) : (
              <Button asChild className="h-9 text-xs">
                <Link href="/checkout">{tx(t, "storefront.common.checkout", "Checkout")}</Link>
              </Button>
            )}
          </div>
          {totals.lines.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-8 w-full text-xs text-red-600 hover:text-red-700"
              onClick={onClear}
            >
              <Trash2 className="size-3.5" />
              {tx(t, "storefront.cart.clear", "Svuota carrello")}
            </Button>
          )}
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
            <span className="truncate">{formatMoney(totals.total, locale)}</span>
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
              {tx(t, "storefront.common.checkout", "Checkout")}
            </Button>
          ) : (
            <Button asChild className="h-10 min-w-[128px] px-3">
              <Link href="/checkout">{tx(t, "storefront.common.checkout", "Checkout")}</Link>
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

function mergeCatalogProducts(
  currentProducts: PartProduct[],
  incomingProducts: readonly PartProduct[]
) {
  if (incomingProducts.length === 0) {
    return filterOrderableCatalogProducts(currentProducts);
  }

  const productsBySku = new Map(
    filterOrderableCatalogProducts(currentProducts).map((product) => [
      product.sku,
      product,
    ])
  );

  for (const product of filterOrderableCatalogProducts(incomingProducts)) {
    productsBySku.set(product.sku, product);
  }

  return Array.from(productsBySku.values());
}

function filterOrderableCatalogProducts(products: readonly PartProduct[]) {
  return products.filter((product) => {
    return (
      product.price > 0 &&
      product.status !== "Out of Stock" &&
      product.stock >= Math.max(1, product.moq)
    );
  });
}
