"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeEuro,
  CheckCircle2,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PartProduct } from "@/lib/partspro-data";
import { formatEuro } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";

type ProductDetailPurchasePanelProps = {
  product: PartProduct;
};

export function ProductDetailPurchasePanel({
  product,
}: ProductDetailPurchasePanelProps) {
  const minimumQuantity = Math.max(product.moq, 1);
  const stockAvailable = product.stock > 0 && product.status !== "Out of Stock";
  const initialQuantity = stockAvailable
    ? Math.min(Math.max(minimumQuantity, 1), product.stock)
    : minimumQuantity;
  const [quantity, setQuantity] = useState(initialQuantity);
  const safeQuantity = Number.isFinite(quantity) ? Math.max(1, Math.trunc(quantity)) : 1;
  const isBelowMoq = safeQuantity < minimumQuantity;
  const isAboveStock = stockAvailable && safeQuantity > product.stock;
  const canOrder = stockAvailable && !isBelowMoq && !isAboveStock;
  const subtotal = product.price * safeQuantity;
  const vat = subtotal * (product.vatRate / 100);
  const total = subtotal + vat;
  const validationId = `purchase-state-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const quantityId = `quantity-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const cartPath = `/carrello?sku=${encodeURIComponent(product.sku)}&qty=${safeQuantity}`;
  const checkoutPath = `/checkout?sku=${encodeURIComponent(product.sku)}&qty=${safeQuantity}`;
  const validationMessage = getPurchaseValidationMessage({
    canOrder,
    isAboveStock,
    isBelowMoq,
    minimumQuantity,
    product,
    safeQuantity,
    stockAvailable,
  });

  function updateQuantity(value: number) {
    if (!Number.isFinite(value)) {
      setQuantity(1);
      return;
    }

    setQuantity(Math.max(1, Math.trunc(value)));
  }

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/8 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-3">
          <div>
            <label
              htmlFor={quantityId}
              className="text-xs font-bold uppercase text-primary/70"
            >
              Quantita richiesta
            </label>
            <div className="mt-2 flex min-w-0 items-center rounded-lg border border-primary/20 bg-white">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
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
                className="h-10 min-w-0 flex-1 border-x border-primary/10 bg-white px-3 text-center text-sm font-black outline-none focus:ring-3 focus:ring-primary/20 disabled:bg-slate-50 disabled:text-slate-500"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!stockAvailable || safeQuantity >= product.stock}
                onClick={() => updateQuantity(safeQuantity + 1)}
                aria-label={`Aumenta quantita per ${product.name}`}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <div
            id={validationId}
            role="status"
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 text-sm font-semibold leading-5",
              canOrder
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-950"
            )}
          >
            {canOrder ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            )}
            <span className="min-w-0">{validationMessage}</span>
          </div>
        </div>

        <div className="rounded-lg border border-primary/15 bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-950">
            <BadgeEuro className="size-4 text-primary" />
            Riepilogo preventivo
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <SummaryLine label="Prezzo netto" value={`${formatEuro(product.price)} cad.`} />
            <SummaryLine label="Quantita" value={`${safeQuantity} pz`} />
            <SummaryLine label="Subtotale IVA escl." value={formatEuro(subtotal)} />
            <SummaryLine label={`IVA ${product.vatRate}%`} value={formatEuro(vat)} />
            <div className="border-t border-slate-100 pt-2">
              <SummaryLine label="Totale stimato" value={formatEuro(total)} strong />
            </div>
          </div>
          <div className="mt-3 text-xs font-semibold leading-5 text-slate-500">
            Preventivo locale: lo stock viene controllato lato interfaccia prima dell&apos;invio.
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {canOrder ? (
          <Button asChild className="h-11 flex-1">
            <Link
              href={cartPath}
              aria-label={`Aggiungi ${safeQuantity} pezzi di ${product.name} al carrello`}
            >
              <ShoppingCart className="size-4" />
              Aggiungi al carrello
            </Link>
          </Button>
        ) : (
          <Button className="h-11 flex-1" disabled aria-describedby={validationId}>
            <ShoppingCart className="size-4" />
            Aggiungi al carrello
          </Button>
        )}
        {canOrder ? (
          <Button variant="outline" asChild className="h-11 flex-1 bg-white">
            <Link
              href={checkoutPath}
              aria-label={`Ordina ora ${safeQuantity} pezzi di ${product.name}`}
            >
              Ordina ora
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="h-11 flex-1 bg-white"
            disabled
            aria-describedby={validationId}
          >
            Ordina ora
          </Button>
        )}
      </div>
    </div>
  );
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
