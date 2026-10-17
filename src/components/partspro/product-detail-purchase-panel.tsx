"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeEuro,
  CalendarClock,
  CheckCircle2 as CheckIcon,
  CheckCircle2,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { tx, txFormat } from "@/i18n/dictionaries/storefront";
import type { PartProduct } from "@/lib/partspro-data";
import { formatEuro } from "@/lib/partspro-data";
import {
  getProductOrderableQuantity,
  getProductPurchaseKind,
  preorderEtaLabel,
} from "@/lib/partspro-preorder-contract";
import { cn } from "@/lib/utils";
import { addCartItem, readClientStoredCartItems, useStoredCartItems } from "./cart-state";
import { cartHasPurchaseKindConflict } from "./commerce-feedback";
import { useI18n, useT } from "./i18n-provider";
import {
  ProductCartQuantityControl,
  useProductCartQuantity,
} from "./product-cart-quantity-control";
import { ProductRestockReminderButton } from "./product-restock-reminder-button";

type ProductDetailPurchasePanelProps = {
  checkoutHref?: string;
  isAuthenticated?: boolean;
  product: PartProduct;
};

type AddFeedbackState = "idle" | "success" | "error";

export function ProductDetailPurchasePanel({
  checkoutHref = "/checkout",
  isAuthenticated = false,
  product,
}: ProductDetailPurchasePanelProps) {
  const t = useT();
  const { locale } = useI18n();
  const [mixedCartRejected, setMixedCartRejected] = useState(false);
  const router = useRouter();
  const minimumQuantity = Math.max(product.moq, 1);
  const purchaseKind = getProductPurchaseKind(product);
  const isPreorder = purchaseKind === "preorder";
  const orderableQuantity = getProductOrderableQuantity(product);
  const stockAvailable = purchaseKind !== "unavailable" && orderableQuantity > 0;
  const initialQuantity = stockAvailable
    ? Math.min(Math.max(minimumQuantity, 1), orderableQuantity)
    : minimumQuantity;
  const [quantityDraft, setQuantityDraft] = useState(String(initialQuantity));
  const draftValid = /^\d+$/.test(quantityDraft) && Number.isSafeInteger(Number(quantityDraft)) && Number(quantityDraft) > 0;
  const quantity = Number(quantityDraft);
  const cartItems = useStoredCartItems({ preserveUnknown: true });
  const otherItems = cartItems.filter(item => item.sku !== product.sku).length;
  const cartQuantity = useProductCartQuantity(product.sku);
  const isInCart = cartQuantity > 0;
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.trunc(quantity)) : 1;
  const activeQuantity = isInCart ? cartQuantity : safeQuantity;
  const isBelowMoq = activeQuantity < minimumQuantity;
  const isAboveStock = stockAvailable && activeQuantity > orderableQuantity;
  const canOrder = stockAvailable && (isInCart || draftValid) && !isBelowMoq && !isAboveStock;
  const canRequestRestock = purchaseKind === "unavailable";
  const showQuoteSummary = canOrder && product.price > 0;
  const subtotal = product.price * activeQuantity;
  const total = subtotal;
  const validationId = `purchase-state-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const quantityId = `quantity-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const validationMessage = getPurchaseValidationMessage({
    t,
    canOrder,
    isAboveStock,
    isBelowMoq,
    minimumQuantity,
    orderableQuantity,
    product,
    purchaseKind,
    safeQuantity: activeQuantity,
    stockAvailable,
  });
  const addFailedHint = mixedCartRejected
    ? (locale.startsWith("en") ? englishUiCopy("Articoli disponibili e preordini richiedono ordini separati. Completa prima il carrello attuale.") : locale === "zh-CN"
      ? "现货与预售需要分开下单。请先完成当前购物车，再采购另一类商品。"
      : "Articoli disponibili e preordini richiedono ordini separati. Completa prima il carrello attuale.")
    : tx(
    t,
    "storefront.product.purchase.addFailedHint",
    "Carrello non sincronizzato. Aggiorna la pagina o accedi di nuovo."
  );
  const [addFeedbackState, setAddFeedbackState] = useState<AddFeedbackState>("idle");
  const addFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (addFeedbackTimerRef.current) {
        window.clearTimeout(addFeedbackTimerRef.current);
      }
    };
  }, []);

  function updateQuantity(value: number) {
    if (!Number.isFinite(value)) {
      setQuantityDraft(String(minimumQuantity));
      return;
    }

    setQuantityDraft(String(Math.max(1, Math.trunc(value))));
  }

  function addCurrentQuantityToCart() {
    const didAdd = safeAddCartItem(product.sku, safeQuantity, [product]);
    setMixedCartRejected(!didAdd && cartHasPurchaseKindConflict(product, readClientStoredCartItems()));
    setAddFeedbackState(didAdd ? "success" : "error");

    if (addFeedbackTimerRef.current) {
      window.clearTimeout(addFeedbackTimerRef.current);
    }

    if (didAdd) addFeedbackTimerRef.current = window.setTimeout(() => {
      setAddFeedbackState("idle");
    }, 1400);

    return didAdd;
  }

  function handleAddToCart() {
    if (!canOrder) {
      return;
    }

    addCurrentQuantityToCart();
  }

  function handleOrderNow() {
    if (!canOrder) {
      return;
    }

    if (addCurrentQuantityToCart()) {
      router.push(checkoutHref);
    }
  }

  function renderPurchaseActions() {
    return (
      <div className="pp-product-purchase-actions grid grid-cols-1 gap-2 sm:grid-cols-2" data-support-offset="mobile-action-bar">
        {isInCart ? (
          <Button variant="outline" className="min-h-11 min-w-0 bg-white" asChild>
            <Link href={checkoutHref.replace(/^\/checkout(?=\?|$)/, "/carrello")}><ShoppingCart className="size-4" /><span>{(locale.startsWith("en") ? englishUiCopy("Vedi il carrello") : locale === "zh-CN" ? "查看购物车" : "Vedi il carrello")}</span></Link>
          </Button>
        ) : canOrder ? (
          <Button
            type="button"
            className={cn(
              "min-h-11 min-w-0",
              addFeedbackState === "success" &&
                "bg-emerald-600 text-white hover:bg-emerald-600",
              addFeedbackState === "error" &&
                "bg-red-600 text-white hover:bg-red-600"
            )}
            onClick={handleAddToCart}
            aria-label={
              addFeedbackState === "error"
                ? addFailedHint
                : txFormat(
                    t,
                    "storefront.product.purchase.addAria",
                    "Aggiungi {quantity} pezzi di {name} al carrello",
                    { quantity: safeQuantity, name: product.name }
                  )
            }
            title={addFeedbackState === "error" ? addFailedHint : undefined}
          >
            {addFeedbackState === "success" ? (
              <CheckIcon className="size-4" />
            ) : addFeedbackState === "error" ? (
              <AlertTriangle className="size-4" />
            ) : (
              <ShoppingCart className="size-4" />
            )}
            <span className="min-w-0 truncate" aria-live="polite">
              {addFeedbackState === "success"
                ? tx(t, "storefront.product.purchase.added", "Aggiunto")
                : addFeedbackState === "error"
                  ? tx(t, "storefront.product.purchase.addFailed", "Riprova")
                  : isPreorder
                    ? tx(t, "storefront.preorder.reserve", "Prenota")
                    : tx(t, "storefront.product.purchase.add", "Aggiungi al carrello")}
            </span>
          </Button>
        ) : canRequestRestock ? (
          <ProductRestockReminderButton
            className="min-w-0"
            density="detail"
            isAuthenticated={isAuthenticated}
            product={product}
          />
        ) : (
          <Button className="min-h-11 min-w-0" disabled aria-describedby={validationId}>
            <ShoppingCart className="size-4" />
            <span className="min-w-0 truncate">
              {tx(t, "storefront.product.purchase.add", "Aggiungi al carrello")}
            </span>
          </Button>
        )}
        {isInCart ? (
          canOrder ? (
            <Button
              variant="outline"
              className="min-h-11 min-w-0 bg-white"
              asChild
            >
              <Link href={checkoutHref}>
                <span className="min-w-0 truncate">
                  {tx(t, "storefront.product.purchase.goCheckout", "Vai al checkout")}
                </span>
              </Link>
            </Button>
          ) : canRequestRestock ? (
            <ProductRestockReminderButton
              className="min-w-0"
              density="detail"
              isAuthenticated={isAuthenticated}
              product={product}
            />
          ) : (
            <Button
              variant="outline"
              className="min-h-11 min-w-0 bg-white"
              disabled
              aria-describedby={validationId}
            >
              <span className="min-w-0 truncate">
                {tx(t, "storefront.product.purchase.goCheckout", "Vai al checkout")}
              </span>
            </Button>
          )
        ) : canOrder ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 min-w-0 bg-white"
            onClick={handleOrderNow}
            aria-label={txFormat(
              t,
              "storefront.ux.addAndCheckoutAria",
              "Aggiungi {quantity} pezzi di {name} e apri il checkout del carrello",
              { quantity: safeQuantity, name: product.name }
            )}
          >
            <span className="min-w-0 truncate">
              {tx(t, "storefront.ux.addAndCheckout", "Aggiungi e vai al checkout")}
            </span>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="min-h-11 min-w-0 bg-white"
            disabled
            aria-describedby={validationId}
          >
            <span className="min-w-0 truncate">
              {tx(t, "storefront.product.purchase.orderNow", "Ordina ora")}
            </span>
          </Button>
        )}
        {addFeedbackState === "error" ? (
          <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-2 text-xs font-semibold leading-5 text-red-700" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div><span>{addFailedHint}</span>{mixedCartRejected ? <Link className="mt-1 block font-semibold underline underline-offset-4" href={checkoutHref.replace(/^\/checkout(?=\?|$)/, "/carrello")}>{(locale.startsWith("en") ? englishUiCopy("Vedi il carrello attuale") : locale === "zh-CN" ? "查看当前购物车" : "Vedi il carrello attuale")}</Link> : null}</div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pp-product-purchase mt-2 rounded-lg border p-2",
        isPreorder
          ? "border-violet-200 bg-violet-50/80"
          : "border-primary/20 bg-primary/8"
      )}
    >
      <div className="pp-product-purchase-grid grid gap-2 lg:grid-cols-[minmax(260px,360px)_minmax(240px,1fr)] xl:grid-cols-[minmax(280px,380px)_minmax(260px,1fr)]">
        <div className="space-y-1.5">
          {isInCart ? (
            <div>
              <div className="text-[10px] font-bold uppercase text-primary/70">
                {tx(t, "storefront.product.quantity.inCart", "Nel carrello")}
              </div>
              <div className="mt-1 rounded-md border border-primary/20 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700">
                {txFormat(
                  t,
                  "storefront.product.quantity.inCartSummary",
                  "{quantity} pezzi gia salvati nel carrello.",
                  { quantity: cartQuantity }
                )}
              </div>
              <ProductCartQuantityControl className="mt-2 min-w-0" density="detail" product={product} />
            </div>
          ) : (
            <div>
              <label
                htmlFor={quantityId}
                className="text-[10px] font-bold uppercase text-primary/70"
              >
                {tx(t,"storefront.product.purchase.quoteQuantity","Quantita")}
              </label>
              <div className="mt-1 flex min-w-0 items-center rounded-md border border-primary/20 bg-white">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-11 rounded-none"
                  disabled={!stockAvailable || safeQuantity <= 1}
                  onClick={() => updateQuantity(safeQuantity - 1)}
                  aria-label={txFormat(t,"storefront.product.quantity.decreaseAria","Riduci quantita di {name}",{name:product.name})}
                >
                  <Minus className="size-4" />
                </Button>
                <input
                  id={quantityId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={stockAvailable ? orderableQuantity : undefined}
                  value={quantityDraft}
                  disabled={!stockAvailable}
                  aria-describedby={validationId}
                  aria-invalid={!canOrder}
                  onChange={(event) => setQuantityDraft(event.target.value)}
                  onBlur={() => { if (!draftValid) setQuantityDraft(String(minimumQuantity)); }}
                  className="h-11 min-w-0 flex-1 border-x border-primary/10 bg-white px-2 text-center text-sm font-black outline-none focus:ring-3 focus:ring-primary/20 disabled:bg-slate-50 disabled:text-slate-500"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-11 rounded-none"
                  disabled={!stockAvailable || safeQuantity >= orderableQuantity}
                  onClick={() => updateQuantity(safeQuantity + 1)}
                  aria-label={txFormat(t,"storefront.product.quantity.increaseAria","Aumenta quantita di {name}",{name:product.name})}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          )}

          <div
            id={validationId}
            role="status"
            className={cn(
              "flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold leading-4",
              canOrder
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-950"
            )}
          >
            {canOrder ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            )}
            <span className="min-w-0">{validationMessage}</span>
          </div>
          {renderPurchaseActions()}
          <p className="text-xs leading-5 text-slate-600">{txFormat(t,"storefront.ux.checkoutIncludes","Il checkout include tutto il carrello, compresi {count} altri articoli.",{count:otherItems})}</p>
        </div>

        <div className="pp-product-quote rounded-md border border-primary/15 bg-white p-2">
          {showQuoteSummary ? (
            <>
              <div className="flex items-center gap-2 text-xs font-black text-slate-950">
                {isPreorder ? (
                  <CalendarClock className="size-4 text-violet-600" />
                ) : (
                  <BadgeEuro className="size-4 text-primary" />
                )}
                {isPreorder
                  ? tx(t, "storefront.preorder.summaryTitle", "Riepilogo preordine")
                  : tx(t, "storefront.product.purchase.quoteTitle", "Riepilogo preventivo")}
              </div>
              {isPreorder && product.preorder ? (
                <div className="mt-2 rounded-md border border-violet-100 bg-violet-50 px-2 py-1.5 text-[11px] font-semibold leading-4 text-violet-900">
                  <div className="font-black">
                    {tx(t, "storefront.preorder.eta", "Arrivo previsto")}: {preorderEtaLabel(product.preorder)}
                  </div>
                  <p className="mt-1">{product.preorder.terms}</p>
                </div>
              ) : null}
              <div className="mt-1.5 space-y-1 text-xs">
                <SummaryLine
                  label={tx(t, "storefront.product.purchase.quoteQuantity", "Quantita")}
                  value={txFormat(t, "storefront.cart.itemCountMany", "{count} pezzi", {
                    count: activeQuantity,
                  })}
                />
                <SummaryLine
                  label={tx(
                    t,
                    "storefront.product.purchase.quoteSubtotal",
                    "Subtotale prodotti"
                  )}
                  value={formatEuro(subtotal)}
                />
                <div className="border-t border-slate-100 pt-1.5">
                  <SummaryLine
                    label={tx(
                      t,
                      "storefront.product.purchase.quoteEstimatedTotal",
                      "Totale stimato"
                    )}
                    value={formatEuro(total)}
                    strong
                  />
                </div>
              </div>
              <div className="pp-product-quote-note mt-1.5 text-xs leading-5 text-slate-500">
                {(locale.startsWith("en") ? englishUiCopy("Stima per questo articolo. Prezzi e disponibilità vengono verificati al checkout.") : locale === "zh-CN" ? "当前商品估算金额，价格和库存会在结账时重新核对。" : "Stima per questo articolo. Prezzi e disponibilità vengono verificati al checkout.")}
              </div>
            </>
          ) : canRequestRestock ? (
            <div className="flex h-full min-h-28 flex-col justify-center rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <div className="font-black">
                {tx(
                  t,
                  "storefront.product.restock.detailTitle",
                  "Riassortimento"
                )}
              </div>
              <p className="mt-1.5 leading-5">
                {tx(
                  t,
                  "storefront.product.restock.detailDescription",
                  "Questo SKU non e acquistabile ora per stock o MOQ. Salva un avviso quando il riassortimento sara disponibile."
                )}
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-28 flex-col justify-center rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="font-black text-slate-950">
                {tx(
                  t,
                  "storefront.product.purchase.unavailableTitle",
                  "Acquisto non disponibile"
                )}
              </div>
              <p className="mt-1.5 leading-5">
                {validationMessage}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function safeAddCartItem(
  sku: string,
  quantity: number,
  catalog: readonly PartProduct[]
) {
  try {
    const result = addCartItem(sku, quantity, catalog) as boolean | void;

    return result !== false;
  } catch {
    return false;
  }
}

function SummaryLine({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className={cn("min-w-0 text-slate-500", strong && "font-black text-slate-800")}>
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 text-right font-bold text-slate-800",
          strong && "text-base font-black text-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function getPurchaseValidationMessage({
  t,
  canOrder,
  isAboveStock,
  isBelowMoq,
  minimumQuantity,
  orderableQuantity,
  product,
  purchaseKind,
  safeQuantity,
  stockAvailable,
}: {
  t: import("@/i18n/dictionaries/storefront").StorefrontTranslator;
  canOrder: boolean;
  isAboveStock: boolean;
  isBelowMoq: boolean;
  minimumQuantity: number;
  orderableQuantity: number;
  product: PartProduct;
  purchaseKind: ReturnType<typeof getProductPurchaseKind>;
  safeQuantity: number;
  stockAvailable: boolean;
}) {
  if (!stockAvailable) {
    return tx(t,"storefront.ux.stockUnavailable","Articolo esaurito: acquisto non disponibile.");
  }

  if (purchaseKind === "preorder" && canOrder) {
    const eta = product.preorder ? preorderEtaLabel(product.preorder) : "";
    return txFormat(t,"storefront.ux.preorderQuantity","{quantity} pezzi prenotabili · {eta}",{quantity:safeQuantity,eta});
  }

  if (isBelowMoq) {
    return txFormat(t,"storefront.ux.belowMoq","Seleziona almeno {quantity} pezzi.",{quantity:minimumQuantity});
  }

  if (isAboveStock) {
    return txFormat(t,"storefront.ux.aboveStock","Disponibili {quantity} pezzi: riduci la quantità.",{quantity:orderableQuantity});
  }

  if (canOrder) {
    return txFormat(t,"storefront.ux.quantityReady","{quantity} pezzi pronti per il carrello.",{quantity:safeQuantity});
  }

  return tx(t,"storefront.ux.checkQuantity","Inserisci una quantità intera valida e controlla disponibilità e MOQ.");
}
