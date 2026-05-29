"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tx, txFormat } from "@/i18n/dictionaries/storefront";
import type { PartProduct } from "@/lib/partspro-data";
import { toPublicSku } from "@/lib/partspro-sku";
import { cn } from "@/lib/utils";
import {
  removeCartItemBySku,
  setCartItemQuantity,
  useStoredCartItems,
} from "./cart-state";
import { useT } from "./i18n-provider";

type ProductCartQuantityControlProps = {
  className?: string;
  density?: "card" | "detail";
  product: PartProduct;
  showLabel?: boolean;
};

export function useProductCartQuantity(sku: string) {
  const items = useStoredCartItems({ preserveUnknown: true });
  const normalizedSku = toPublicSku(sku);

  return (
    items.find((item) => toPublicSku(item.sku) === normalizedSku)?.quantity ?? 0
  );
}

export function ProductCartQuantityControl({
  className,
  density = "card",
  product,
  showLabel = false,
}: ProductCartQuantityControlProps) {
  const t = useT();
  const quantity = useProductCartQuantity(product.sku);
  const minimumQuantity = Math.max(1, product.moq);
  const stockAvailable = product.stock > 0 && product.status !== "Out of Stock";
  const canIncrease = stockAvailable && quantity < product.stock;
  const removesOnDecrease = quantity <= minimumQuantity;
  const isOverStock = stockAvailable && quantity > product.stock;

  if (quantity <= 0) {
    return null;
  }

  function updateProductQuantity(nextQuantity: number) {
    return setCartItemQuantity(product.sku, nextQuantity, [product]);
  }

  function handleDecrease() {
    if (quantity <= 0) {
      return;
    }

    if (removesOnDecrease) {
      removeCartItemBySku(product.sku, [product]);
      return;
    }

    updateProductQuantity(quantity - 1);
  }

  function handleIncrease() {
    if (!canIncrease) {
      return;
    }

    updateProductQuantity(quantity + 1);
  }

  const buttonSize = density === "detail" ? "icon-sm" : "icon-xs";
  const iconSize = density === "detail" ? "size-4" : "size-3.5";

  return (
    <div className={cn("min-w-0", density === "card" && "shrink-0", className)}>
      {showLabel ? (
        <div className="mb-1 truncate text-xs font-bold uppercase text-primary/70">
          {tx(t, "storefront.product.quantity.inCart", "Nel carrello")}
        </div>
      ) : null}
      <div
        className={cn(
          "inline-flex min-w-0 items-center justify-between overflow-hidden border bg-white shadow-sm",
          density === "detail"
            ? "h-10 w-full rounded-lg border-primary/20"
            : "h-8 w-24 rounded-md border-slate-200",
          isOverStock && "border-amber-200 bg-amber-50"
        )}
        title={
          isOverStock
            ? txFormat(
                t,
                "storefront.product.quantity.overStockTitle",
                "Quantita oltre stock: disponibili {stock} pezzi.",
                { stock: product.stock }
              )
            : txFormat(
                t,
                "storefront.product.quantity.inCartTitle",
                "{quantity} pezzi nel carrello",
                { quantity }
              )
        }
      >
        <Button
          type="button"
          variant="ghost"
          size={buttonSize}
          className={cn(
            "rounded-none",
            density === "detail" ? "size-9" : "size-8"
          )}
          onClick={handleDecrease}
          aria-label={
            removesOnDecrease
              ? txFormat(
                  t,
                  "storefront.product.quantity.removeAria",
                  "Rimuovi {name} dal carrello",
                  { name: product.name }
                )
              : txFormat(
                  t,
                  "storefront.product.quantity.decreaseAria",
                  "Riduci quantita di {name}",
                  { name: product.name }
                )
          }
          title={
            removesOnDecrease
              ? tx(t, "storefront.product.quantity.remove", "Rimuovi")
              : tx(t, "storefront.product.quantity.decrease", "Riduci")
          }
        >
          <Minus className={iconSize} />
        </Button>
        <div
          className={cn(
            "min-w-0 flex-1 border-x text-center font-black tabular-nums",
            density === "detail"
              ? "border-primary/10 px-3 text-sm"
              : "border-slate-100 px-1 text-xs",
            isOverStock ? "text-amber-900" : "text-slate-950"
          )}
          aria-live="polite"
        >
          <span className="sr-only">
            {tx(t, "storefront.product.quantity.inCart", "Nel carrello")}
          </span>
          <span className="truncate">{quantity}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size={buttonSize}
          className={cn(
            "rounded-none",
            density === "detail" ? "size-9" : "size-8"
          )}
          disabled={!canIncrease}
          onClick={handleIncrease}
          aria-label={txFormat(
            t,
            "storefront.product.quantity.increaseAria",
            "Aumenta quantita di {name}",
            { name: product.name }
          )}
          title={
            canIncrease
              ? tx(t, "storefront.product.quantity.increase", "Aumenta")
              : tx(t, "storefront.product.quantity.stockLimit", "Limite stock")
          }
        >
          <Plus className={iconSize} />
        </Button>
      </div>
      {showLabel && isOverStock ? (
        <div className="mt-1 text-xs font-semibold leading-5 text-amber-800">
          {txFormat(
            t,
            "storefront.product.quantity.overStock",
            "Disponibili {stock}: riduci la quantita per procedere.",
            { stock: product.stock }
          )}
        </div>
      ) : null}
    </div>
  );
}
