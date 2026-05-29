"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeEuro,
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
import { cn } from "@/lib/utils";
import { addCartItem } from "./cart-state";
import { useT } from "./i18n-provider";
import {
  ProductCartQuantityControl,
  useProductCartQuantity,
} from "./product-cart-quantity-control";
import { ProductRestockReminderButton } from "./product-restock-reminder-button";

type ProductDetailPurchasePanelProps = {
  isAuthenticated?: boolean;
  product: PartProduct;
};

type AddFeedbackState = "idle" | "success" | "error";

export function ProductDetailPurchasePanel({
  isAuthenticated = false,
  product,
}: ProductDetailPurchasePanelProps) {
  const t = useT();
  const router = useRouter();
  const minimumQuantity = Math.max(product.moq, 1);
  const stockAvailable = product.stock > 0 && product.status !== "Out of Stock";
  const initialQuantity = stockAvailable
    ? Math.min(Math.max(minimumQuantity, 1), product.stock)
    : minimumQuantity;
  const [quantity, setQuantity] = useState(initialQuantity);
  const cartQuantity = useProductCartQuantity(product.sku);
  const isInCart = cartQuantity > 0;
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.trunc(quantity)) : 1;
  const activeQuantity = isInCart ? cartQuantity : safeQuantity;
  const isBelowMoq = activeQuantity < minimumQuantity;
  const isAboveStock = stockAvailable && activeQuantity > product.stock;
  const canOrder = stockAvailable && !isBelowMoq && !isAboveStock;
  const canRequestRestock =
    product.status === "Out of Stock" ||
    product.stock <= 0 ||
    product.stock < minimumQuantity;
  const showQuoteSummary = canOrder && product.price > 0;
  const subtotal = product.price * activeQuantity;
  const vat = subtotal * (product.vatRate / 100);
  const total = subtotal + vat;
  const validationId = `purchase-state-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const quantityId = `quantity-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const validationMessage = getPurchaseValidationMessage({
    canOrder,
    isAboveStock,
    isBelowMoq,
    minimumQuantity,
    product,
    safeQuantity: activeQuantity,
    stockAvailable,
  });
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
      setQuantity(1);
      return;
    }

    setQuantity(Math.max(1, Math.trunc(value)));
  }

  function addCurrentQuantityToCart() {
    const didAdd = safeAddCartItem(product.sku, safeQuantity, [product]);
    setAddFeedbackState(didAdd ? "success" : "error");

    if (addFeedbackTimerRef.current) {
      window.clearTimeout(addFeedbackTimerRef.current);
    }

    addFeedbackTimerRef.current = window.setTimeout(() => {
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
      router.push("/checkout");
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-primary/20 bg-primary/8 p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-2">
          {isInCart ? (
            <div>
              <div className="text-[10px] font-bold uppercase text-primary/70">
                {tx(t, "storefront.product.quantity.inCart", "Nel carrello")}
              </div>
              <div className="mt-1.5 rounded-md border border-primary/20 bg-white p-2 text-xs font-semibold text-slate-700">
                {txFormat(
                  t,
                  "storefront.product.quantity.inCartSummary",
                  "{quantity} pezzi gia salvati nel carrello.",
                  { quantity: cartQuantity }
                )}
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor={quantityId}
                className="text-[10px] font-bold uppercase text-primary/70"
              >
                Quantita richiesta
              </label>
              <div className="mt-1.5 flex min-w-0 items-center rounded-md border border-primary/20 bg-white">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 rounded-none"
                  disabled={!stockAvailable || safeQuantity <= 1}
                  onClick={() => updateQuantity(safeQuantity - 1)}
                  aria-label={`Riduci quantita per ${product.name}`}
                >
                  <Minus className="size-4" />
                </Button>
                <input
                  id={quantityId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={stockAvailable ? product.stock : undefined}
                  value={safeQuantity}
                  disabled={!stockAvailable}
                  aria-describedby={validationId}
                  aria-invalid={!canOrder}
                  onChange={(event) => updateQuantity(Number(event.target.value))}
                  className="h-9 min-w-0 flex-1 border-x border-primary/10 bg-white px-2 text-center text-sm font-black outline-none focus:ring-3 focus:ring-primary/20 disabled:bg-slate-50 disabled:text-slate-500"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 rounded-none"
                  disabled={!stockAvailable || safeQuantity >= product.stock}
                  onClick={() => updateQuantity(safeQuantity + 1)}
                  aria-label={`Aumenta quantita per ${product.name}`}
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
              "flex items-start gap-2 rounded-md border p-2 text-xs font-semibold leading-4",
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
        </div>

        <div className="rounded-md border border-primary/15 bg-white p-2.5">
          {showQuoteSummary ? (
            <>
              <div className="flex items-center gap-2 text-xs font-black text-slate-950">
                <BadgeEuro className="size-4 text-primary" />
                Riepilogo preventivo
              </div>
              <div className="mt-2 space-y-1.5 text-xs">
                <SummaryLine label="Prezzo netto" value={`${formatEuro(product.price)} cad.`} />
                <SummaryLine label="Quantita" value={`${activeQuantity} pz`} />
                <SummaryLine label="Subtotale IVA escl." value={formatEuro(subtotal)} />
                <SummaryLine label={`IVA ${product.vatRate}%`} value={formatEuro(vat)} />
                <div className="border-t border-slate-100 pt-2">
                  <SummaryLine label="Totale stimato" value={formatEuro(total)} strong />
                </div>
              </div>
              <div className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">
                Preventivo locale: lo stock viene controllato lato interfaccia prima dell&apos;invio.
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

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {isInCart ? (
          <ProductCartQuantityControl
            className="flex-1"
            density="detail"
            product={product}
          />
        ) : canOrder ? (
          <Button
            type="button"
            className={cn(
              "h-10 min-w-0 flex-1",
              addFeedbackState === "success" &&
                "bg-emerald-600 text-white hover:bg-emerald-600",
              addFeedbackState === "error" &&
                "bg-red-600 text-white hover:bg-red-600"
            )}
            onClick={handleAddToCart}
            aria-label={txFormat(
              t,
              "storefront.product.purchase.addAria",
              "Aggiungi {quantity} pezzi di {name} al carrello",
              { quantity: safeQuantity, name: product.name }
            )}
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
                : tx(t, "storefront.product.purchase.add", "Aggiungi al carrello")}
            </span>
          </Button>
        ) : canRequestRestock ? (
          <ProductRestockReminderButton
            className="flex-1"
            density="detail"
            isAuthenticated={isAuthenticated}
            product={product}
          />
        ) : (
          <Button className="h-10 min-w-0 flex-1" disabled aria-describedby={validationId}>
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
              className="h-10 min-w-0 flex-1 bg-white"
              asChild
            >
              <Link href="/checkout">
                <span className="min-w-0 truncate">
                  {tx(t, "storefront.product.purchase.goCheckout", "Vai al checkout")}
                </span>
              </Link>
            </Button>
          ) : canRequestRestock ? (
            <ProductRestockReminderButton
              className="flex-1"
              density="detail"
              isAuthenticated={isAuthenticated}
              product={product}
            />
          ) : (
            <Button
              variant="outline"
              className="h-10 min-w-0 flex-1 bg-white"
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
            className="h-10 min-w-0 flex-1 bg-white"
            onClick={handleOrderNow}
            aria-label={txFormat(
              t,
              "storefront.product.purchase.orderNowAria",
              "Ordina ora {quantity} pezzi di {name}",
              { quantity: safeQuantity, name: product.name }
            )}
          >
            <span className="min-w-0 truncate">
              {tx(t, "storefront.product.purchase.orderNow", "Ordina ora")}
            </span>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-10 min-w-0 flex-1 bg-white"
            disabled
            aria-describedby={validationId}
          >
            <span className="min-w-0 truncate">
              {tx(t, "storefront.product.purchase.orderNow", "Ordina ora")}
            </span>
          </Button>
        )}
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
  canOrder,
  isAboveStock,
  isBelowMoq,
  minimumQuantity,
  product,
  safeQuantity,
  stockAvailable,
}: {
  canOrder: boolean;
  isAboveStock: boolean;
  isBelowMoq: boolean;
  minimumQuantity: number;
  product: PartProduct;
  safeQuantity: number;
  stockAvailable: boolean;
}) {
  if (!stockAvailable) {
    return "Articolo esaurito: il carrello resta disattivato finche lo stock non rientra.";
  }

  if (isBelowMoq) {
    return `Quantita sotto MOQ: seleziona almeno ${minimumQuantity} pezzi per procedere.`;
  }

  if (isAboveStock) {
    return `Quantita oltre stock: disponibili ${product.stock} pezzi.`;
  }

  if (canOrder) {
    return `${safeQuantity} pezzi pronti per il carrello.`;
  }

  return "Controlla quantita, MOQ e disponibilita prima di procedere.";
}
