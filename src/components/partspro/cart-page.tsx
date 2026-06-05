"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  LogIn,
  Minus,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type StorefrontTranslator, tx, txFormat } from "@/i18n/dictionaries/storefront";
import { formatMoney } from "@/i18n/format";
import {
  hrefWithAssistedCompanyId,
  readAssistedCompanyIdFromSearchParams,
  rememberAssistedCompanyId,
} from "@/lib/partspro-assisted-order";
import { type PartProduct } from "@/lib/partspro-data";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import {
  formatPercentBadge,
  getProductPriceDisplay,
} from "@/lib/partspro-price-display";
import { publicStockLevelMeta } from "@/lib/partspro-stock-availability";
import { cn } from "@/lib/utils";
import {
  CartCatalogProvider,
  refreshStoredCartItemSnapshots,
  type CartItemSnapshot,
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
  initialAccountAccess?: StoreHeaderAccountAccess;
};

type CartPageContentProps = {
  assistedCompanyId: string | null;
  catalogProducts: readonly PartProduct[];
  initialAccountAccess?: StoreHeaderAccountAccess;
  onCatalogProductsLoaded: (products: readonly PartProduct[]) => void;
};

type CartCatalogApiResponse = {
  data?: PartProduct[];
  meta?: {
    rejected?: CartCatalogRejectedItem[];
  };
};

type CartCatalogLoadState = "idle" | "loading" | "ready" | "error";

type CartCatalogRejectedItem = {
  brand?: string;
  category?: string;
  grade?: PartProduct["grade"];
  imageAlt?: string;
  imageUrl?: string;
  moq?: number;
  name?: string;
  reason?: string;
  sku: string;
  status?: string;
  stock?: number;
  visual?: PartProduct["visual"];
};

type CartDisplayRow =
  | {
      kind: "available";
      line: CartLine;
      sku: string;
    }
  | {
      kind: "loading";
      quantity: number;
      sku: string;
    }
  | {
      kind: "snapshot";
      quantity: number;
      sku: string;
      snapshot: CartItemSnapshot;
    }
  | {
      item: CartCatalogRejectedItem;
      kind: "rejected";
      quantity: number;
      sku: string;
    };

type RejectedCartLineViewProps = {
  item: CartCatalogRejectedItem;
  onChangeQuantity: (
    sku: string,
    direction: -1 | 1,
    item: CartCatalogRejectedItem
  ) => void;
  onRemove: (sku: string) => void;
  onSetQuantity: (
    sku: string,
    quantity: number,
    item: CartCatalogRejectedItem
  ) => void;
  quantity: number;
};

type LoadingCartLineViewProps = {
  quantity: number;
  sku: string;
};

type SnapshotCartLineViewProps = {
  quantity: number;
  sku: string;
  snapshot: CartItemSnapshot;
};

export function CartPage({
  catalogProducts = [],
  initialAccountAccess,
}: CartPageProps) {
  const searchParams = useSearchParams();
  const assistedCompanyId = readAssistedCompanyIdFromSearchParams(searchParams);

  return (
    <CartPageScoped
      key={assistedCompanyId ?? "default"}
      assistedCompanyId={assistedCompanyId}
      catalogProducts={catalogProducts}
      initialAccountAccess={initialAccountAccess}
    />
  );
}

function CartPageScoped({
  assistedCompanyId,
  catalogProducts,
  initialAccountAccess,
}: {
  assistedCompanyId: string | null;
  catalogProducts: readonly PartProduct[];
  initialAccountAccess?: StoreHeaderAccountAccess;
}) {
  const [catalogState, setCatalogState] = React.useState<PartProduct[]>(() =>
    filterOrderableCatalogProducts(catalogProducts)
  );

  const handleCatalogProductsLoaded = React.useCallback(
    (products: readonly PartProduct[]) => {
      setCatalogState((current) => mergeCatalogProducts(current, products));
    },
    []
  );

  return (
    <CartCatalogProvider products={catalogState}>
      <CartPageContent
        assistedCompanyId={assistedCompanyId}
        catalogProducts={catalogState}
        initialAccountAccess={initialAccountAccess}
        onCatalogProductsLoaded={handleCatalogProductsLoaded}
      />
    </CartCatalogProvider>
  );
}

function CartPageContent({
  assistedCompanyId,
  catalogProducts,
  initialAccountAccess,
  onCatalogProductsLoaded,
}: CartPageContentProps) {
  const t = useT();
  const isLoginRequired = initialAccountAccess?.authenticated === false;
  const cart = useCart({
    consumeUrlIntent: !isLoginRequired,
    preserveUnknown: true,
  });
  const [catalogLoadState, setCatalogLoadState] =
    React.useState<CartCatalogLoadState>("idle");
  const [catalogRejections, setCatalogRejections] = React.useState<
    Record<string, CartCatalogRejectedItem>
  >({});
  const requestedCatalogSkus = React.useRef(new Set<string>());
  const checkoutHref = hrefWithAssistedCompanyId("/checkout", assistedCompanyId);
  const catalogHref = hrefWithAssistedCompanyId("/catalogo", assistedCompanyId);
  const loginHref = loginHrefForNext(hrefWithAssistedCompanyId("/carrello", assistedCompanyId));
  const catalogSkuSet = React.useMemo(
    () => new Set(catalogProducts.map((product) => product.sku)),
    [catalogProducts]
  );
  const catalogProductBySku = React.useMemo(
    () => new Map(catalogProducts.map((product) => [product.sku, product])),
    [catalogProducts]
  );
  const totals = cart.totals;
  const cartLineBySku = React.useMemo(
    () => new Map(totals.lines.map((line) => [line.sku, line])),
    [totals.lines]
  );
  const cartItemBySku = React.useMemo(
    () => new Map(cart.items.map((item) => [item.sku, item])),
    [cart.items]
  );
  const hasPendingCatalogResolution = React.useMemo(
    () =>
      cart.isHydrated &&
      catalogLoadState !== "ready" &&
      catalogLoadState !== "error" &&
      cart.items.some(
        (item) =>
          !cartLineBySku.has(item.sku) &&
          !catalogProductBySku.has(item.sku) &&
          !catalogRejections[item.sku]
      ),
    [
      cart.isHydrated,
      cart.items,
      cartLineBySku,
      catalogLoadState,
      catalogProductBySku,
      catalogRejections,
    ]
  );
  const isCatalogResolving =
    cart.isHydrated &&
    cart.items.length > 0 &&
    (catalogLoadState === "loading" || hasPendingCatalogResolution);
  const isEmpty = !isLoginRequired && cart.isHydrated && cart.items.length === 0;
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
    !isCatalogResolving;
  const unresolvedItems = React.useMemo(
    () =>
      cart.items.flatMap((item) => {
        if (cartLineBySku.has(item.sku)) {
          return [];
        }

        return [
          cartRejectionForItem(
            item.sku,
            item.quantity,
            catalogProductBySku.get(item.sku),
            catalogRejections,
            catalogLoadState
          ),
        ];
      }),
    [cart.items, cartLineBySku, catalogLoadState, catalogProductBySku, catalogRejections]
  );
  const hasLoginRequiredUnresolved = unresolvedItems.some(
    isLoginRequiredCartRejection
  );
  const hasAccountStatusUnresolved = unresolvedItems.some(
    isAccountStatusCartRejection
  );
  const displayRows = React.useMemo<CartDisplayRow[]>(
    () =>
      cart.items.map((item) => {
        const line = cartLineBySku.get(item.sku);

        if (line) {
          return {
            kind: "available",
            line,
            sku: item.sku,
          };
        }

        if (
          isCatalogResolving &&
          item.snapshot &&
          !catalogProductBySku.has(item.sku) &&
          !catalogRejections[item.sku]
        ) {
          return {
            kind: "snapshot",
            quantity: item.quantity,
            sku: item.sku,
            snapshot: item.snapshot,
          };
        }

        if (
          catalogLoadState !== "ready" &&
          catalogLoadState !== "error" &&
          !catalogProductBySku.has(item.sku) &&
          !catalogRejections[item.sku]
        ) {
          return {
            kind: "loading",
            quantity: item.quantity,
            sku: item.sku,
          };
        }

        return {
          item: cartRejectionForItem(
            item.sku,
            item.quantity,
            catalogProductBySku.get(item.sku),
            catalogRejections,
            catalogLoadState
          ),
          kind: "rejected",
          quantity: item.quantity,
          sku: item.sku,
        };
      }),
    [
      cart.items,
      cartLineBySku,
      catalogLoadState,
      catalogProductBySku,
      catalogRejections,
      isCatalogResolving,
    ]
  );
  const displayItemCount = React.useMemo(
    () => cart.items.reduce((total, item) => total + item.quantity, 0),
    [cart.items]
  );
  const readyForCheckout =
    !isLoginRequired &&
    cart.isHydrated &&
    !isCatalogResolving &&
    totals.lines.length > 0 &&
    unresolvedSkus.length === 0;
  const canNavigateToCheckout =
    !isLoginRequired && cart.isHydrated && cart.items.length > 0;
  const hasCheckoutBlockers =
    canNavigateToCheckout &&
    (isCatalogResolving || totals.lines.length === 0 || unresolvedSkus.length > 0);
  const checkoutDisabled =
    !canNavigateToCheckout || isCatalogResolving;

  React.useEffect(() => {
    rememberAssistedCompanyId(assistedCompanyId);
  }, [assistedCompanyId]);

  React.useEffect(() => {
    if (!cart.isHydrated || catalogProducts.length === 0) {
      return;
    }

    refreshStoredCartItemSnapshots(catalogProducts);
  }, [cart.isHydrated, catalogProducts]);

  React.useEffect(() => {
    if (!cart.isHydrated || cart.items.length === 0) {
      return;
    }

    const missingSkus = cart.items
      .map((item) => item.sku)
      .filter(
        (sku) =>
          !catalogSkuSet.has(sku) &&
          !catalogRejections[sku] &&
          !requestedCatalogSkus.current.has(sku)
      );

    if (missingSkus.length === 0) {
      setCatalogLoadState("ready");
      return;
    }

    const controller = new AbortController();
    const inFlightSkus = requestedCatalogSkus.current;

    missingSkus.forEach((sku) => inFlightSkus.add(sku));
    setCatalogLoadState("loading");

    async function loadCartCatalogProducts() {
      try {
        const params = new URLSearchParams({ skus: missingSkus.join(",") });

        if (assistedCompanyId) {
          params.set("companyId", assistedCompanyId);
        }

        const response = await fetch(`/api/cart/catalog?${params.toString()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load cart catalog products");
        }

        const payload = (await response.json()) as CartCatalogApiResponse;
        const nextProducts = Array.isArray(payload.data) ? payload.data : [];

        onCatalogProductsLoaded(nextProducts);
        setCatalogRejections((current) => {
          const next = { ...current };

          missingSkus.forEach((sku) => {
            delete next[sku];
          });

          for (const rejection of payload.meta?.rejected ?? []) {
            next[rejection.sku] = rejection;
          }

          return next;
        });
        setCatalogLoadState("ready");
      } catch {
        if (!controller.signal.aborted) {
          setCatalogLoadState("error");
        }
        missingSkus.forEach((sku) => inFlightSkus.delete(sku));
      }
    }

    void loadCartCatalogProducts();

    return () => {
      controller.abort();
      missingSkus.forEach((sku) => inFlightSkus.delete(sku));
    };
  }, [
    assistedCompanyId,
    cart.isHydrated,
    cart.items,
    catalogRejections,
    catalogSkuSet,
    onCatalogProductsLoaded,
  ]);

  const {
    clearCart: clearCartItems,
    removeItem,
    setItems,
    updateQuantity,
  } = cart;

  const changeQuantity = React.useCallback((sku: string, direction: -1 | 1) => {
    const line = cartLineBySku.get(sku);

    if (line) {
      updateQuantity(sku, line.quantity + direction);
    }
  }, [cartLineBySku, updateQuantity]);

  const setQuantity = React.useCallback((sku: string, quantity: number) => {
    updateQuantity(sku, quantity);
  }, [updateQuantity]);

  const setRejectedQuantity = React.useCallback((
    sku: string,
    quantity: number,
    item: CartCatalogRejectedItem
  ) => {
    void item;
    const normalizedQuantity = normalizeRejectedCartQuantity(quantity);

    updateQuantity(sku, normalizedQuantity);
  }, [updateQuantity]);

  const changeRejectedQuantity = React.useCallback((
    sku: string,
    direction: -1 | 1,
    item: CartCatalogRejectedItem
  ) => {
    const currentQuantity =
      cartItemBySku.get(sku)?.quantity ?? 1;

    setRejectedQuantity(sku, currentQuantity + direction, item);
  }, [cartItemBySku, setRejectedQuantity]);

  const removeLine = React.useCallback((sku: string) => {
    removeItem(sku);
    setCatalogRejections((current) => removeRejection(current, sku));
  }, [removeItem]);

  const removeUnresolvedLines = React.useCallback(() => {
    const unresolvedSkuSet = new Set(unresolvedSkus);

    setItems(cart.items.filter((item) => !unresolvedSkuSet.has(item.sku)));
    setCatalogRejections((current) =>
      unresolvedSkus.reduce(
        (next, sku) => removeRejection(next, sku),
        current
      )
    );
  }, [cart.items, setItems, unresolvedSkus]);

  const clearCart = React.useCallback(() => {
    if (
      window.confirm(
        tx(t, "storefront.cart.clearConfirm", "Svuotare tutti gli articoli dal carrello?")
      )
    ) {
      clearCartItems();
      setCatalogRejections({});
    }
  }, [clearCartItems, t]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader
        assistedCompanyId={assistedCompanyId}
        initialAccountAccess={initialAccountAccess}
      />
      <div className="mx-auto grid max-w-[1360px] gap-2 px-2 pt-2 pb-[calc(5.25rem_+_env(safe-area-inset-bottom))] sm:gap-4 sm:px-4 sm:pt-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-3 lg:pt-3 lg:pb-4">
        <section className="space-y-2 sm:space-y-4 lg:space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3 lg:items-center">
            <div className="min-w-0">
              <Badge className="mb-1 hidden h-5 border border-primary/20 bg-primary/8 px-2 text-[11px] text-primary lg:inline-flex">
                {tx(t, "storefront.cart.badge", "Carrello clienti")}
              </Badge>
              <h1 className="text-xl font-black tracking-normal sm:text-3xl md:text-4xl lg:text-3xl">
                {tx(t, "storefront.cart.title", "Conferma prodotti e quantità")}
              </h1>
            </div>
            {cart.items.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-9 bg-white text-red-600 hover:text-red-700"
                onClick={clearCart}
              >
                <Trash2 className="size-4" />
                {tx(t, "storefront.cart.clear", "Svuota carrello")}
              </Button>
            )}
          </div>

          {readyForCheckout && (
            <Card className="hidden border-emerald-200 bg-emerald-50 lg:block">
              <CardContent className="flex gap-2 p-3 text-xs text-emerald-950 sm:gap-3 sm:p-4 sm:text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 sm:size-5" />
                <div className="min-w-0">
                  <div className="font-black">
                    {tx(t, "storefront.cart.localReadyTitle", "Carrello account pronto per checkout")}
                  </div>
                  <p className="mt-1 leading-5 sm:hidden">
                    {tx(t, "storefront.cart.localReadyShort", "Le modifiche sono sincronizzate con il tuo account.")}
                  </p>
                  <p className="mt-1 hidden leading-6 sm:block">
                    {tx(t, "storefront.cart.localReadyDescription", "Il carrello è legato al tuo account: disponibilità e quantità vengono ricontrollate al momento dell'ordine.")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {!isLoginRequired && !cart.isHydrated && (
            <Card className="border-slate-200 bg-white">
              <CardContent className="flex flex-col items-start gap-3 p-4 sm:p-5">
                <div>
                  <div className="text-lg font-black">
                    {tx(t, "storefront.cart.loadingTitle", "Caricamento carrello")}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {tx(t, "storefront.cart.loadingDescription", "Sincronizzazione del carrello del tuo account.")}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoginRequired && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex flex-col items-start gap-3 p-4 text-amber-950 sm:p-5">
                <div>
                  <div className="text-lg font-black">
                    {tx(t, "storefront.cart.loginRequiredTitle", "Accedi per usare il carrello")}
                  </div>
                  <p className="mt-1 text-sm leading-6">
                    {tx(t, "storefront.cart.loginRequiredDescription", "Il carrello è disponibile solo per account verificati. Accedi per vedere i tuoi articoli sincronizzati.")}
                  </p>
                </div>
                <Button asChild>
                  <Link href={loginHref}>
                    <LogIn className="size-4" />
                    {tx(t, "storefront.cart.loginForPrices", "Accedi")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isCatalogResolving && (
            <p className="sr-only" role="status">
              {tx(t, "storefront.cart.loadingProductsTitle", "Caricamento prodotti")}
            </p>
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
                    <Link href={catalogHref}>{tx(t, "storefront.cart.goToCatalog", "Vai al catalogo")}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {hasUnresolvedItems && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex flex-col items-start gap-3 p-3 text-amber-950 sm:p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:p-3">
                <div className="min-w-0">
                  <div className="text-base font-black">
                    {tx(t, "storefront.cart.blockedTitle", "Alcuni articoli richiedono attenzione")}
                  </div>
                  <p className="mt-1 text-sm leading-6 lg:line-clamp-1 lg:leading-5">
                    {hasLoginRequiredUnresolved
                      ? tx(
                        t,
                        "storefront.cart.blockedLoginDescription",
                        "Le righe restano nel carrello. Accedi o richiedi accesso professionale per vedere i prezzi, oppure rimuovi gli articoli non disponibili."
                      )
                      : hasAccountStatusUnresolved
                        ? tx(
                          t,
                          "storefront.cart.blockedAccountDescription",
                          "Account riconosciuto. Completa o fai attivare il profilo cliente, poi aggiorna il carrello per vedere prezzi e checkout."
                        )
                      : tx(t, "storefront.cart.blockedDescription", "Le righe restano nel carrello. Controlla lo stato su ogni articolo: puoi correggere quantità oltre stock o MOQ senza perdere la selezione.")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {hasLoginRequiredUnresolved ? (
                    <>
                      <Button asChild className="h-8">
                        <Link href={loginHref}>
                          <LogIn className="size-4" />
                          {tx(t, "storefront.cart.loginForPrices", "Accedi")}
                        </Link>
                      </Button>
                      <Button variant="outline" asChild className="h-8 bg-white">
                        <Link href="/professionale">
                          <UserPlus className="size-4" />
                          {tx(t, "storefront.cart.requestProfessionalAccess", "Richiedi accesso")}
                        </Link>
                      </Button>
                    </>
                  ) : hasAccountStatusUnresolved ? (
                    <Button variant="outline" asChild className="h-8 bg-white">
                      <Link href="/account">{tx(t, "storefront.account.openAccount", "Centro personale")}</Link>
                    </Button>
                  ) : (
                    <Button variant="outline" asChild className="h-8 bg-white">
                      <Link href={catalogHref}>{tx(t, "storefront.cart.goToCatalog", "Vai al catalogo")}</Link>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 bg-white text-red-600 hover:text-red-700"
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

          {displayRows.length > 0 && (
            <>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_25px_rgba(15,23,42,0.04)] lg:hidden">
                {displayRows.map((row) =>
                  row.kind === "available" ? (
                    <CartLineMobileRow
                      key={row.sku}
                      line={row.line}
                      onChangeQuantity={changeQuantity}
                      onRemove={removeLine}
                      onSetQuantity={setQuantity}
                    />
                  ) : row.kind === "snapshot" ? (
                    <CartLineMobileSnapshotRow
                      key={row.sku}
                      quantity={row.quantity}
                      sku={row.sku}
                      snapshot={row.snapshot}
                    />
                  ) : row.kind === "loading" ? (
                    <CartLineMobileLoadingRow
                      key={row.sku}
                      quantity={row.quantity}
                      sku={row.sku}
                    />
                  ) : (
                    <RejectedCartLineMobileRow
                      key={row.sku}
                      item={row.item}
                      quantity={row.quantity}
                      onChangeQuantity={changeRejectedQuantity}
                      onRemove={removeLine}
                      onSetQuantity={setRejectedQuantity}
                    />
                  )
                )}
              </div>
              <div className="hidden space-y-2 lg:block">
                {displayRows.map((row) =>
                  row.kind === "available" ? (
                    <CartLineDesktopCard
                      key={row.sku}
                      line={row.line}
                      onChangeQuantity={changeQuantity}
                      onRemove={removeLine}
                      onSetQuantity={setQuantity}
                    />
                  ) : row.kind === "snapshot" ? (
                    <CartLineDesktopSnapshotCard
                      key={row.sku}
                      quantity={row.quantity}
                      sku={row.sku}
                      snapshot={row.snapshot}
                    />
                  ) : row.kind === "loading" ? (
                    <CartLineDesktopLoadingCard
                      key={row.sku}
                      quantity={row.quantity}
                      sku={row.sku}
                    />
                  ) : (
                    <RejectedCartLineDesktopCard
                      key={row.sku}
                      item={row.item}
                      quantity={row.quantity}
                      onChangeQuantity={changeRejectedQuantity}
                      onRemove={removeLine}
                      onSetQuantity={setRejectedQuantity}
                    />
                  )
                )}
              </div>
            </>
          )}
        </section>

        <div className="hidden lg:block">
          {isLoginRequired ? null : isCatalogResolving ? (
            <CartSummaryLoadingCard lineCount={cart.items.length} />
          ) : (
            <OrderSummaryCard
              totals={totals}
              checkoutDisabled={checkoutDisabled}
              checkoutHref={checkoutHref}
              compact
              continueHref={catalogHref}
              lineCount={cart.items.length}
              summaryNote={
                hasCheckoutBlockers
                  ? tx(t, "storefront.cart.summaryNoteReviewCheckout", "Puoi aprire il checkout per vedere cosa manca. Login, cliente, prezzi, stock e MOQ verranno comunque verificati prima dell'invio.")
                  : tx(t, "storefront.cart.summaryNoteSynced", "Il carrello non blocca stock: spedizione €6,50, gratuita da €100; l'ordine riserverà gli articoli solo dopo la conferma.")
              }
            />
          )}
        </div>
      </div>
      {!isCatalogResolving && !isLoginRequired && (
        <MobileCartCheckoutBar
          totals={totals}
          catalogHref={catalogHref}
          checkoutDisabled={checkoutDisabled}
          checkoutHref={checkoutHref}
          hasBlockedItems={hasCheckoutBlockers}
          itemCount={displayItemCount}
          lineCount={displayRows.length}
          onClear={clearCart}
        />
      )}
    </main>
  );
}

function cartRejectionForItem(
  sku: string,
  quantity: number,
  product: PartProduct | undefined,
  rejections: Record<string, CartCatalogRejectedItem>,
  catalogLoadState: CartCatalogLoadState
): CartCatalogRejectedItem {
  const rejectedItem = rejections[sku];

  if (rejectedItem) {
    return rejectedItem;
  }

  if (product) {
    return cartRejectionFromProduct(product, quantity);
  }

  return {
    sku,
    reason:
      catalogLoadState === "loading"
        ? "loading"
        : "unavailable",
  };
}

function cartRejectionFromProduct(
  product: PartProduct,
  quantity: number
): CartCatalogRejectedItem {
  return {
    brand: product.brand,
    category: product.category,
    grade: product.grade,
    imageAlt: product.imageAlt,
    imageUrl: product.imageUrl,
    moq: product.moq,
    name: product.name,
    reason: cartProductRejectionReason(product, quantity),
    sku: product.sku,
    status: product.status,
    stock: product.stock,
    visual: product.visual,
  };
}

function cartProductRejectionReason(product: PartProduct, quantity: number) {
  const minimumQuantity = Math.max(1, product.moq);

  if (product.price <= 0) {
    return "price_unavailable";
  }

  if (
    product.status === "Out of Stock" ||
    product.stock <= 0 ||
    product.stock < minimumQuantity
  ) {
    return "unavailable";
  }

  if (quantity < minimumQuantity) {
    return "quantity_below_moq";
  }

  if (quantity > product.stock) {
    return "quantity_over_stock";
  }

  return "unavailable";
}

function isLoginRequiredCartRejection(item: CartCatalogRejectedItem) {
  return item.reason === "login_required";
}

function isAccountStatusCartRejection(item: CartCatalogRejectedItem) {
  return [
    "account_sync_failed",
    "customer_needs_assignment",
    "customer_profile_required",
    "customer_suspended",
    "wholesale_required",
  ].includes(item.reason ?? "");
}

function isAccountAccessCartRejection(item: CartCatalogRejectedItem) {
  return isLoginRequiredCartRejection(item) || isAccountStatusCartRejection(item);
}

function cartRejectedStatusCopy(
  t: StorefrontTranslator,
  item: CartCatalogRejectedItem
) {
  if (isLoginRequiredCartRejection(item)) {
    return {
      description: tx(t, "storefront.cart.rejectedLoginDescription", "Articolo salvato nel carrello. Accedi o richiedi accesso come cliente professionale per vedere il prezzo e procedere."),
      label: tx(t, "storefront.cart.rejectedLoginLabel", "Prezzo professionale protetto"),
    };
  }

  switch (item.reason) {
    case "account_sync_failed":
      return {
        description: tx(t, "storefront.cart.rejectedAccountSyncDescription", "Sessione valida, ma il profilo account non e stato sincronizzato. Aggiorna la pagina o contatta un amministratore."),
        label: tx(t, "storefront.cart.rejectedAccountSyncLabel", "Sincronizzazione account richiesta"),
      };
    case "customer_profile_required":
      return {
        description: tx(t, "storefront.cart.rejectedCustomerProfileDescription", "Account riconosciuto, ma il profilo cliente e ancora in collegamento o da completare. Apri il centro personale o contatta un amministratore."),
        label: tx(t, "storefront.cart.rejectedCustomerProfileLabel", "Profilo cliente da collegare"),
      };
    case "customer_needs_assignment":
      return {
        description: tx(t, "storefront.cart.rejectedCustomerAssignmentDescription", "Account riconosciuto, ma il listino cliente non e ancora attivo. Chiedi all'amministratore di attivare l'account in gestione account."),
        label: tx(t, "storefront.cart.rejectedCustomerAssignmentLabel", "Cliente da attivare"),
      };
    case "customer_suspended":
      return {
        description: tx(t, "storefront.cart.rejectedCustomerSuspendedDescription", "Account riconosciuto, ma il profilo cliente e sospeso. Contatta l'amministratore prima di procedere."),
        label: tx(t, "storefront.cart.rejectedCustomerSuspendedLabel", "Account cliente sospeso"),
      };
    case "wholesale_required":
      return {
        description: tx(t, "storefront.cart.rejectedWholesaleRequiredDescription", "Account riconosciuto, ma il listino professionale non e ancora abilitato per questo cliente."),
        label: tx(t, "storefront.cart.rejectedWholesaleRequiredLabel", "Prezzi professionali da abilitare"),
      };
    case "loading":
      return {
        description: tx(t, "storefront.cart.rejectedLoadingDescription", "Stiamo recuperando nome, immagine e disponibilita aggiornati per questa riga."),
        label: tx(t, "storefront.cart.rejectedLoadingLabel", "Dettagli prodotto in caricamento"),
      };
    case "not_found":
      return {
        description: tx(t, "storefront.cart.rejectedNotFoundDescription", "Questo SKU non risulta piu disponibile nel catalogo pubblico."),
        label: tx(t, "storefront.cart.rejectedNotFoundLabel", "SKU non trovato"),
      };
    case "price_unavailable":
      return {
        description: tx(t, "storefront.cart.rejectedPriceDescription", "Il prezzo non e disponibile per questa riga. Rimuovila o riprova dopo l'aggiornamento del listino."),
        label: tx(t, "storefront.cart.rejectedPriceLabel", "Prezzo non disponibile"),
      };
    case "quantity_below_moq":
      return {
        description: txFormat(t, "storefront.cart.rejectedBelowMoqDescription", "Quantità inferiore al MOQ {moq}. Aumenta manualmente la quantità per ripristinare l'acquisto.", {
          moq: Math.max(1, item.moq ?? 1),
        }),
        label: tx(t, "storefront.cart.rejectedBelowMoqLabel", "Sotto MOQ"),
      };
    case "quantity_over_stock":
      return {
        description: txFormat(t, "storefront.cart.rejectedOverStockDescription", "Stock disponibile {stock}. Riduci manualmente la quantità a {stock} o meno per ripristinare l'acquisto.", {
          stock: Math.max(0, item.stock ?? 0),
        }),
        label: tx(t, "storefront.cart.rejectedOverStockLabel", "Oltre stock"),
      };
    case "unavailable":
      return {
        description: tx(t, "storefront.cart.rejectedUnavailableDescription", "L'articolo non e acquistabile in questo momento per disponibilita o MOQ."),
        label: tx(t, "storefront.cart.rejectedUnavailableLabel", "Non acquistabile"),
      };
    default:
      return {
        description: tx(t, "storefront.cart.rejectedGenericDescription", "Questa riga resta salvata, ma deve essere risolta prima del checkout."),
        label: tx(t, "storefront.cart.rejectedGenericLabel", "Da verificare"),
      };
  }
}

function rejectedStatusBadgeClass(
  item: CartCatalogRejectedItem,
  density: "compact" | "regular" = "regular"
) {
  const sizeClass =
    density === "compact"
      ? "h-5 px-1.5 text-[10px] leading-none"
      : "border px-2 py-0.5 text-xs";

  if (isAccountAccessCartRejection(item)) {
    return `${sizeClass} border-sky-200 bg-sky-50 text-sky-700`;
  }

  switch (item.reason) {
    case "loading":
      return `${sizeClass} border-sky-200 bg-sky-50 text-sky-700`;
    case "not_found":
      return `${sizeClass} border-slate-200 bg-slate-100 text-slate-700`;
    case "price_unavailable":
      return `${sizeClass} border-orange-200 bg-orange-50 text-orange-700`;
    case "quantity_below_moq":
      return `${sizeClass} border-amber-200 bg-amber-50 text-amber-800`;
    case "quantity_over_stock":
      return `${sizeClass} border-red-200 bg-red-50 text-red-700`;
    case "unavailable":
      return `${sizeClass} border-red-200 bg-red-50 text-red-700`;
    default:
      return `${sizeClass} border-amber-200 bg-amber-50 text-amber-800`;
  }
}

function rejectedCartProduct(
  item: CartCatalogRejectedItem,
  fallbackName: string
): PartProduct {
  return {
    brand: item.brand ?? "",
    category: item.category ?? "",
    compatibleWith: [],
    grade: normalizeRejectedGrade(item.grade),
    imageAlt: item.imageAlt,
    imageUrl: item.imageUrl,
    leadTime: "",
    moq: Math.max(1, item.moq ?? 1),
    name: item.name ?? fallbackName,
    price: 0,
    retailPrice: 0,
    rmaDays: 0,
    sku: item.sku,
    slug: item.sku,
    status: normalizeRejectedStatus(item.status, item.stock),
    stock: Math.max(0, item.stock ?? 0),
    tags: [],
    updatedAt: "",
    vatRate: 22,
    visual: normalizeRejectedVisual(item.visual),
    warehouse: "Milano",
  };
}

function cartSnapshotProduct(
  snapshot: CartItemSnapshot,
  fallbackSku: string
): PartProduct {
  return {
    basePrice: snapshot.basePrice,
    brand: snapshot.brand,
    category: snapshot.category,
    compatibleWith: [],
    discountPercent: snapshot.discountPercent,
    grade: snapshot.grade,
    imageAlt: snapshot.imageAlt,
    imageUrl: snapshot.imageUrl,
    leadTime: "",
    levelDiscountAmount: snapshot.levelDiscountAmount,
    levelDiscountPercent: snapshot.levelDiscountPercent,
    marginPercent: snapshot.marginPercent,
    moq: Math.max(1, snapshot.moq),
    name: snapshot.name,
    price: Math.max(0, snapshot.price),
    priceGroupDiscountPercent: snapshot.priceGroupDiscountPercent,
    retailPrice: Math.max(0, snapshot.retailPrice),
    rmaDays: 0,
    sku: snapshot.sku || fallbackSku,
    slug: snapshot.sku || fallbackSku,
    status: snapshot.status,
    stock: Math.max(0, snapshot.stock),
    tags: [],
    updatedAt: snapshot.updatedAt,
    vatRate: 22,
    visual: snapshot.visual,
    warehouse: "Milano",
  };
}

function rejectedQuantityState(
  quantity: number,
  item: CartCatalogRejectedItem
) {
  const reason = item.reason ?? "";
  const canEditInput =
    isAccountAccessCartRejection(item) ||
    reason === "quantity_below_moq" ||
    reason === "quantity_over_stock";
  const minimum = 1;
  const maximum = Math.max(
    minimum,
    quantity,
    typeof item.stock === "number" ? item.stock : 0,
    typeof item.moq === "number" ? item.moq : 1
  );
  const canAdjustStoredQuantity =
    reason !== "not_found" && reason !== "price_unavailable";

  return {
    canDecrease: canAdjustStoredQuantity && quantity > minimum,
    canEditInput,
    canIncrease:
      canEditInput &&
      reason !== "quantity_over_stock" &&
      quantity < maximum,
    maximum,
    minimum,
  };
}

function normalizeRejectedCartQuantity(quantity: number) {
  const normalizedQuantity = Number.isFinite(quantity)
    ? Math.max(1, Math.trunc(quantity))
    : 1;

  return normalizedQuantity;
}

function normalizeRejectedGrade(
  value: CartCatalogRejectedItem["grade"]
): PartProduct["grade"] {
  return value === "A+" ||
    value === "A" ||
    value === "B" ||
    value === "Refurbished"
    ? value
    : "A";
}

function normalizeRejectedStatus(
  value: CartCatalogRejectedItem["status"],
  stock: CartCatalogRejectedItem["stock"]
): PartProduct["status"] {
  if (value === "In Stock" || value === "Low Stock" || value === "Out of Stock") {
    return value;
  }

  if ((stock ?? 0) <= 0) {
    return "Out of Stock";
  }

  if ((stock ?? 0) <= 5) {
    return "Low Stock";
  }

  return "In Stock";
}

function normalizeRejectedVisual(
  value: CartCatalogRejectedItem["visual"]
): PartProduct["visual"] {
  return value === "screen" ||
    value === "battery" ||
    value === "cover" ||
    value === "port" ||
    value === "camera" ||
    value === "flex" ||
    value === "speaker" ||
    value === "frame"
    ? value
    : "screen";
}

function removeRejection(
  current: Record<string, CartCatalogRejectedItem>,
  sku: string
) {
  if (!(sku in current)) {
    return current;
  }

  const next = { ...current };
  delete next[sku];

  return next;
}

type MobileCartCheckoutBarProps = {
  catalogHref: string;
  checkoutDisabled: boolean;
  checkoutHref: string;
  hasBlockedItems: boolean;
  itemCount: number;
  lineCount: number;
  onClear: () => void;
  totals: CartTotals;
};

type CartLineViewProps = {
  line: CartLine;
  onChangeQuantity: (sku: string, direction: -1 | 1) => void;
  onRemove: (sku: string) => void;
  onSetQuantity: (sku: string, quantity: number) => void;
};

const CartLineMobileSnapshotRow = React.memo(function CartLineMobileSnapshotRow({
  quantity,
  sku,
  snapshot,
}: SnapshotCartLineViewProps) {
  const t = useT();
  const { locale } = useI18n();
  const product = cartSnapshotProduct(snapshot, sku);
  const lineTotal = product.price * quantity;

  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-2 border-b border-slate-100 bg-white px-2.5 py-2 last:border-b-0">
      <StorefrontProductImage
        product={product}
        sizes="40px"
        quality={55}
        className="size-10 rounded-md border border-slate-100 bg-slate-50"
        fallbackClassName="shrink-0"
        imageClassName="object-contain p-1"
      />
      <div className="min-w-0 pt-0.5">
        <div className="line-clamp-2 break-words text-[13px] font-black leading-4">
          {product.name}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] leading-3 text-slate-500">
          {sku}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] leading-none">
            {product.grade}
          </Badge>
          <Badge className="h-5 border border-sky-200 bg-sky-50 px-1.5 text-[10px] leading-none text-sky-700">
            {tx(t, "storefront.cart.snapshotRefreshing", "Aggiornamento")}
          </Badge>
        </div>
      </div>
      <div className="grid min-w-[92px] justify-items-end gap-1 text-right">
        <div>
          <div className="whitespace-nowrap text-[13px] font-black leading-4">
            {formatMoney(lineTotal, locale)}
          </div>
          <div className="whitespace-nowrap text-[10px] leading-3 text-slate-500">
            {txFormat(t, "storefront.cart.priceEach", "{price} cad.", {
              price: formatMoney(product.price, locale),
            })}
          </div>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-black text-slate-500">
          x{quantity}
        </div>
      </div>
    </div>
  );
});

const CartLineMobileLoadingRow = React.memo(function CartLineMobileLoadingRow({
  quantity,
  sku,
}: LoadingCartLineViewProps) {
  return (
    <div
      className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-2 border-b border-slate-100 bg-white px-2.5 py-2 last:border-b-0"
      aria-label={`Loading ${sku}`}
    >
      <div className="size-10 animate-pulse rounded-md border border-slate-100 bg-slate-100" />
      <div className="min-w-0 pt-0.5">
        <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
        <div className="mt-1 h-3 w-28 animate-pulse rounded bg-slate-100" />
        <div className="mt-1.5 flex min-w-0 items-center gap-1">
          <div className="h-5 w-8 animate-pulse rounded-full bg-slate-100" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>
      <div className="grid min-w-[92px] justify-items-end gap-1">
        <div className="inline-flex h-7 items-center rounded-md border border-slate-100 bg-slate-50 px-2">
          <div className="h-3 w-14 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-3 w-12 rounded bg-transparent text-right text-[10px] font-bold leading-3 text-slate-300">
          x{quantity}
        </div>
      </div>
    </div>
  );
});

const RejectedCartLineMobileRow = React.memo(function RejectedCartLineMobileRow({
  item,
  onChangeQuantity,
  onRemove,
  onSetQuantity,
  quantity,
}: RejectedCartLineViewProps) {
  const t = useT();
  const product = rejectedCartProduct(
    item,
    tx(t, "storefront.cart.rejectedLoadingName", "Dettagli prodotto in caricamento")
  );
  const statusCopy = cartRejectedStatusCopy(t, item);
  const quantityState = rejectedQuantityState(quantity, item);

  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-2 border-b border-amber-100 bg-amber-50/35 px-2.5 py-2 last:border-b-0">
      <StorefrontProductImage
        product={product}
        sizes="40px"
        quality={55}
        className="size-10 rounded-md border border-amber-100 bg-white"
        fallbackClassName="shrink-0"
        imageClassName="object-contain p-1"
      />
      <div className="min-w-0 pt-0.5">
        <div className="line-clamp-2 break-words text-[13px] font-black leading-4">
          {product.name}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] leading-3 text-slate-500">
          {item.sku}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] leading-none">
            {product.grade}
          </Badge>
          <Badge className={rejectedStatusBadgeClass(item, "compact")}>
            {statusCopy.label}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-amber-950">
          {statusCopy.description}
        </p>
      </div>
      <div className="grid min-w-[92px] justify-items-end gap-1 text-right">
        <div className="inline-flex h-7 items-center rounded-md border bg-white">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-md"
            disabled={!quantityState.canDecrease}
            onClick={() => onChangeQuantity(item.sku, -1, item)}
            aria-label={txFormat(t, "storefront.cart.decreaseAria", "Riduci quantità per {sku}", { sku: item.sku })}
            title={tx(t, "storefront.cart.decreaseTitle", "Riduci quantità")}
          >
            <Minus className="size-3.5" />
          </Button>
          <QuantityInput
            compact
            disabled={!quantityState.canEditInput}
            max={quantityState.maximum}
            min={quantityState.minimum}
            quantity={quantity}
            sku={item.sku}
            onSetQuantity={(sku, nextQuantity) =>
              onSetQuantity(sku, nextQuantity, item)
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 rounded-md"
            disabled={!quantityState.canIncrease}
            onClick={() => onChangeQuantity(item.sku, 1, item)}
            aria-label={txFormat(t, "storefront.cart.increaseAria", "Aumenta quantità per {sku}", { sku: item.sku })}
            title={tx(t, "storefront.cart.increaseTitle", "Aumenta quantità")}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 rounded-md text-red-500"
          aria-label={txFormat(t, "storefront.cart.removeLineAria", "Rimuovi riga {sku}", { sku: item.sku })}
          title={tx(t, "storefront.cart.removeLineTitle", "Rimuovi questa riga dal carrello")}
          onClick={() => onRemove(item.sku)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
});

const CartLineMobileRow = React.memo(function CartLineMobileRow({
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
  const priceDisplay = getProductPriceDisplay(line.product);

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
          {priceDisplay.hasDiscount && priceDisplay.basePrice ? (
            <div className="whitespace-nowrap text-[10px] leading-3 text-slate-400 line-through">
              {formatMoney(priceDisplay.basePrice, locale)} cad.
            </div>
          ) : null}
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
});

const CartLineDesktopCard = React.memo(function CartLineDesktopCard({
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
  const priceDisplay = getProductPriceDisplay(line.product);
  const stockMeta = publicStockLevelMeta(t, line.product);

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white">
      <CardContent className="grid grid-cols-[64px_minmax(0,1fr)_190px] items-center gap-3 p-2.5">
        <StorefrontProductImage
          product={line.product}
          sizes="64px"
          quality={55}
          className="size-16 rounded-md border border-slate-100 bg-slate-50"
          fallbackClassName="shrink-0"
          imageClassName="object-contain p-1.5"
        />
        <div className="min-w-0">
          <div className="line-clamp-1 text-base font-black leading-5">{line.product.name}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] font-semibold leading-4 text-slate-500">
            {txFormat(t, "storefront.cart.skuLabel", "SKU {sku}", { sku: line.sku })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
              {line.product.grade}
            </Badge>
            <Badge variant="outline" className="h-5 max-w-[160px] px-1.5 text-[11px]">
              <span className="truncate">{line.product.brand} · {line.product.category}</span>
            </Badge>
            <Badge className={cn("h-5 px-1.5 text-[11px]", stockMeta.className)}>
              {stockMeta.label}
            </Badge>
            <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
              {txFormat(t, "storefront.cart.moqBadge", "MOQ {moq}", {
                moq: minimumQuantity,
              })}
            </Badge>
          </div>
        </div>
        <div className="block text-right">
          <div>
            <div className="whitespace-nowrap text-base font-black leading-5">
              {formatMoney(line.lineTotal, locale)}
            </div>
            <div className="whitespace-nowrap text-[11px] leading-4 text-slate-500">
              {txFormat(t, "storefront.cart.priceEach", "{price} cad.", {
                price: formatMoney(line.product.price, locale),
              })}
            </div>
            {priceDisplay.hasDiscount && priceDisplay.basePrice ? (
              <div className="flex justify-end gap-1 whitespace-nowrap text-[11px] text-slate-400">
                <span className="line-through">{formatMoney(priceDisplay.basePrice, locale)}</span>
                <span className="font-bold text-emerald-700">
                  {formatPercentBadge(priceDisplay.discountPercent)}
                </span>
              </div>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
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
                compact
                max={line.product.stock}
                min={minimumQuantity}
                quantity={line.quantity}
                sku={line.sku}
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
              className="size-7 rounded-md text-red-500"
              aria-label={txFormat(t, "storefront.cart.removeLineAria", "Rimuovi riga {sku}", { sku: line.sku })}
              title={tx(t, "storefront.cart.removeLineTitle", "Rimuovi questa riga dal carrello")}
              onClick={() => onRemove(line.sku)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const CartLineDesktopSnapshotCard = React.memo(function CartLineDesktopSnapshotCard({
  quantity,
  sku,
  snapshot,
}: SnapshotCartLineViewProps) {
  const t = useT();
  const { locale } = useI18n();
  const product = cartSnapshotProduct(snapshot, sku);
  const priceDisplay = getProductPriceDisplay(product);
  const lineTotal = product.price * quantity;

  return (
    <Card size="sm" className="rounded-lg border-slate-200 bg-white">
      <CardContent className="grid grid-cols-[64px_minmax(0,1fr)_190px] items-center gap-3 p-2.5">
        <StorefrontProductImage
          product={product}
          sizes="64px"
          quality={55}
          className="size-16 rounded-md border border-slate-100 bg-slate-50"
          fallbackClassName="shrink-0"
          imageClassName="object-contain p-1.5"
        />
        <div className="min-w-0">
          <div className="line-clamp-1 text-base font-black leading-5">{product.name}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] font-semibold leading-4 text-slate-500">
            {txFormat(t, "storefront.cart.skuLabel", "SKU {sku}", { sku })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
              {product.grade}
            </Badge>
            <Badge className="h-5 border border-sky-200 bg-sky-50 px-1.5 text-[11px] text-sky-700">
              {tx(t, "storefront.cart.snapshotRefreshing", "Aggiornamento")}
            </Badge>
            {(product.brand || product.category) && (
              <Badge variant="outline" className="h-5 max-w-[160px] px-1.5 text-[11px]">
                <span className="truncate">{product.brand} · {product.category}</span>
              </Badge>
            )}
          </div>
        </div>
        <div className="block text-right">
          <div className="whitespace-nowrap text-lg font-black leading-5">
            {formatMoney(lineTotal, locale)}
          </div>
          <div className="mt-0.5 whitespace-nowrap text-xs leading-4 text-slate-500">
            {txFormat(t, "storefront.cart.priceEach", "{price} cad.", {
              price: formatMoney(product.price, locale),
            })}
          </div>
          {priceDisplay.hasDiscount && priceDisplay.basePrice ? (
            <div className="whitespace-nowrap text-xs leading-4 text-slate-400 line-through">
              {formatMoney(priceDisplay.basePrice, locale)} cad.
            </div>
          ) : null}
          <div className="mt-2 inline-flex h-7 items-center rounded-md border border-slate-100 bg-slate-50 px-3 text-xs font-black text-slate-500">
            x{quantity}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const CartLineDesktopLoadingCard = React.memo(function CartLineDesktopLoadingCard({
  quantity,
  sku,
}: LoadingCartLineViewProps) {
  return (
    <Card
      size="sm"
      className="rounded-lg border-slate-200 bg-white"
      aria-label={`Loading ${sku}`}
    >
      <CardContent className="grid grid-cols-[64px_minmax(0,1fr)_190px] items-center gap-3 p-2.5">
        <div className="size-16 animate-pulse rounded-md border border-slate-100 bg-slate-100" />
        <div className="min-w-0">
          <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-1.5 h-4 w-32 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 flex flex-wrap gap-1">
            <div className="h-5 w-10 animate-pulse rounded-full bg-slate-100" />
            <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="grid justify-items-end gap-2">
          <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
          <div className="inline-flex h-7 items-center rounded-md border border-slate-100 bg-slate-50 px-3">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
          </div>
          <div className="h-3 w-12 rounded bg-transparent text-right text-[10px] font-bold leading-3 text-slate-300">
            x{quantity}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

const RejectedCartLineDesktopCard = React.memo(function RejectedCartLineDesktopCard({
  item,
  onChangeQuantity,
  onRemove,
  onSetQuantity,
  quantity,
}: RejectedCartLineViewProps) {
  const t = useT();
  const product = rejectedCartProduct(
    item,
    tx(t, "storefront.cart.rejectedLoadingName", "Dettagli prodotto in caricamento")
  );
  const statusCopy = cartRejectedStatusCopy(t, item);
  const quantityState = rejectedQuantityState(quantity, item);
  const stockMeta = publicStockLevelMeta(t, product);

  return (
    <Card size="sm" className="rounded-lg border-amber-200 bg-white">
      <CardContent className="grid grid-cols-[64px_minmax(0,1fr)_190px] items-center gap-3 p-2.5">
        <StorefrontProductImage
          product={product}
          sizes="64px"
          quality={55}
          className="size-16 rounded-md border border-amber-100 bg-amber-50"
          fallbackClassName="shrink-0"
          imageClassName="object-contain p-1.5"
        />
        <div className="min-w-0">
          <div className="line-clamp-1 text-base font-black leading-5">{product.name}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] font-semibold leading-4 text-slate-500">
            {txFormat(t, "storefront.cart.skuLabel", "SKU {sku}", { sku: item.sku })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
              {product.grade}
            </Badge>
            <Badge className={rejectedStatusBadgeClass(item)}>
              {statusCopy.label}
            </Badge>
            {(product.brand || product.category) && (
              <Badge variant="outline" className="h-5 max-w-[160px] px-1.5 text-[11px]">
                <span className="truncate">{product.brand} · {product.category}</span>
              </Badge>
            )}
            {item.reason === "quantity_over_stock" && typeof item.stock === "number" ? (
              <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
                {txFormat(t, "storefront.cart.stockBadge", "Stock {stock}", {
                  stock: item.stock,
                })}
              </Badge>
            ) : (
              <Badge className={cn("h-5 px-1.5 text-[11px]", stockMeta.className)}>
                {stockMeta.label}
              </Badge>
            )}
            <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
              {txFormat(t, "storefront.cart.moqBadge", "MOQ {moq}", {
                moq: Math.max(1, item.moq ?? 1),
              })}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-1 max-w-2xl text-xs font-semibold leading-5 text-amber-950">
            {statusCopy.description}
          </p>
        </div>
        <div className="block text-right">
          <div className="line-clamp-2 text-sm font-black leading-5 text-amber-950">
            {statusCopy.label}
          </div>
          <div className="mt-2 flex items-center justify-end gap-1">
            <div className="inline-flex h-7 items-center rounded-md border bg-white">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-7 rounded-md"
                disabled={!quantityState.canDecrease}
                onClick={() => onChangeQuantity(item.sku, -1, item)}
                aria-label={txFormat(t, "storefront.cart.decreaseAria", "Riduci quantità per {sku}", { sku: item.sku })}
                title={tx(t, "storefront.cart.decreaseTitle", "Riduci quantità")}
              >
                <Minus className="size-3.5" />
              </Button>
              <QuantityInput
                compact
                disabled={!quantityState.canEditInput}
                max={quantityState.maximum}
                min={quantityState.minimum}
                quantity={quantity}
                sku={item.sku}
                onSetQuantity={(sku, nextQuantity) =>
                  onSetQuantity(sku, nextQuantity, item)
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-7 rounded-md"
                disabled={!quantityState.canIncrease}
                onClick={() => onChangeQuantity(item.sku, 1, item)}
                aria-label={txFormat(t, "storefront.cart.increaseAria", "Aumenta quantità per {sku}", { sku: item.sku })}
                title={tx(t, "storefront.cart.increaseTitle", "Aumenta quantità")}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-7 rounded-md text-red-500"
              aria-label={txFormat(t, "storefront.cart.removeLineAria", "Rimuovi riga {sku}", { sku: item.sku })}
              title={tx(t, "storefront.cart.removeLineTitle", "Rimuovi questa riga dal carrello")}
              onClick={() => onRemove(item.sku)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

function QuantityInput({
  compact = false,
  disabled = false,
  max,
  min,
  onSetQuantity,
  quantity,
  sku,
}: {
  compact?: boolean;
  disabled?: boolean;
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
      disabled={disabled}
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

function CartSummaryLoadingCard({ lineCount }: { lineCount: number }) {
  const t = useT();

  return (
    <Card
      size="sm"
      className="h-fit border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] lg:sticky lg:top-28"
    >
      <CardContent className="space-y-3 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="size-4 animate-pulse rounded bg-primary/20" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="space-y-2">
          <CompactSummaryLine
            label={tx(t, "storefront.cart.rows", "Articoli")}
            value={String(lineCount)}
          />
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-1.5 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-10 animate-pulse rounded-md bg-primary/20" />
        <div className="h-9 animate-pulse rounded-md bg-slate-100" />
      </CardContent>
    </Card>
  );
}

function MobileCartCheckoutBar({
  catalogHref,
  checkoutDisabled,
  checkoutHref,
  hasBlockedItems,
  itemCount,
  lineCount,
  onClear,
  totals,
}: MobileCartCheckoutBarProps) {
  const t = useT();
  const { locale } = useI18n();
  const [expanded, setExpanded] = React.useState(false);
  const lineLabel =
    lineCount === 1
      ? tx(t, "storefront.cart.lineCountOne", "1 riga")
      : txFormat(t, "storefront.cart.lineCountMany", "{count} righe", {
          count: lineCount,
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
              label={tx(t, "storefront.common.total", "Totale")}
              value={formatMoney(totals.total, locale)}
              strong
            />
          </div>
          {hasBlockedItems && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] font-semibold leading-4 text-amber-900">
              {tx(t, "storefront.cart.summaryNoteReviewCheckout", "Puoi aprire il checkout per vedere cosa manca. Login, cliente, prezzi, stock e MOQ verranno comunque verificati prima dell'invio.")}
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button variant="outline" asChild className="h-9 bg-white text-xs">
              <Link href={catalogHref}>{tx(t, "storefront.cart.continueShort", "Continua")}</Link>
            </Button>
            {checkoutDisabled ? (
              <Button className="h-9 text-xs" disabled>
                {tx(t, "storefront.common.checkout", "Checkout")}
              </Button>
            ) : (
              <Button asChild className="h-9 text-xs">
                <Link href={checkoutHref}>{tx(t, "storefront.common.checkout", "Checkout")}</Link>
              </Button>
            )}
          </div>
          {lineCount > 0 && (
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
              <Link href={checkoutHref}>{tx(t, "storefront.common.checkout", "Checkout")}</Link>
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

function loginHrefForNext(nextHref: string) {
  return `/login?${new URLSearchParams({ next: nextHref }).toString()}`;
}
