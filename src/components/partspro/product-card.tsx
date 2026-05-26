"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeEuro,
  Boxes,
  CheckCircle2,
  Clock,
  Lock,
  Minus,
  PackageCheck,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PartProduct } from "@/lib/partspro-data";
import { formatEuro } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { PartVisual } from "./part-visual";

type ProductCardProps = {
  product: PartProduct;
  showWholesalePrice?: boolean;
};

export function ProductCard({
  product,
  showWholesalePrice = false,
}: ProductCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const stockMeta = getStockMeta(product);
  const canAddToCart =
    product.stock >= Math.max(1, product.moq) && product.status !== "Out of Stock";
  const productPath = `/prodotto/${encodeURIComponent(product.sku)}`;
  const cartPath = `/carrello?sku=${encodeURIComponent(product.sku)}&qty=${product.moq}`;
  const stockDescriptionId = `stock-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const imageAlt = product.imageAlt ?? product.name;
  const hasWholesalePrice = product.price > 0;
  const remainingModels = Math.max(product.compatibleWith.length - 2, 0);

  return (
    <>
      <Card
        className={cn(
          "h-full min-w-0 rounded-lg border-slate-200 bg-white shadow-sm transition sm:shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:hover:-translate-y-0.5 sm:hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]",
          !canAddToCart && "opacity-80"
        )}
      >
        <CardContent className="grid h-full min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-2 p-2 sm:flex sm:flex-col sm:p-3">
          {product.imageUrl ? (
            <button
              type="button"
              className="relative block h-28 w-full cursor-zoom-in overflow-hidden rounded-md bg-slate-50 text-left outline-none transition hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-auto sm:rounded-lg"
              aria-label={`Apri anteprima immagine ${product.name}`}
              aria-haspopup="dialog"
              onClick={() => setPreviewOpen(true)}
            >
              <div className="relative h-full rounded-md sm:h-36 sm:rounded-lg">
                <Image
                  src={product.imageUrl}
                  alt={imageAlt}
                  fill
                  sizes="(max-width: 640px) 104px, (max-width: 1280px) 180px, 220px"
                  quality={55}
                  loading="lazy"
                  decoding="async"
                  className="object-contain p-1.5 sm:p-2"
                />
              </div>
              <Badge
                className={cn(
                  "absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate border px-1.5 py-0.5 text-[10px] sm:bottom-2 sm:left-2 sm:max-w-[calc(100%-1rem)]",
                  stockMeta.className
                )}
                title={`${stockMeta.label} · ${product.stock} pz`}
              >
                {stockMeta.label}
              </Badge>
            </button>
          ) : (
            <div className="relative block h-28 overflow-hidden rounded-md bg-slate-50 sm:h-auto sm:rounded-lg">
              <PartVisual variant={product.visual} className="h-full rounded-md sm:h-36 sm:rounded-lg" />
              <Badge
                className={cn(
                  "absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate border px-1.5 py-0.5 text-[10px] sm:bottom-2 sm:left-2 sm:max-w-[calc(100%-1rem)]",
                  stockMeta.className
                )}
                title={`${stockMeta.label} · ${product.stock} pz`}
              >
                {stockMeta.label}
              </Badge>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col sm:mt-3">
            <Link
              href={productPath}
              className="line-clamp-2 min-h-0 break-words text-[13px] font-black leading-4 text-slate-950 hover:text-primary sm:min-h-10 sm:text-sm sm:leading-5"
            >
              {product.name}
            </Link>
            <div className="mt-1 flex min-w-0 flex-wrap gap-1 sm:mt-2 sm:gap-1.5">
              {product.compatibleWith.slice(0, 2).map((model, index) => (
                <span
                  key={model}
                  className={cn(
                    "max-w-full truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:px-2 sm:py-1 sm:text-[11px]",
                    index > 0 && "hidden sm:inline-flex"
                  )}
                  title={model}
                >
                  {model}
                </span>
              ))}
              {remainingModels > 0 && (
                <span
                  className="hidden max-w-full truncate rounded-full bg-primary/8 px-2 py-1 text-[11px] font-bold text-primary sm:inline-flex"
                  title={`${remainingModels} modelli compatibili aggiuntivi`}
                >
                  +{remainingModels} modelli
                </span>
              )}
            </div>

            <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10px] font-semibold text-slate-600 sm:mt-3 sm:gap-2 sm:text-[11px]">
              <div
                id={stockDescriptionId}
                className={cn(
                  "flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 sm:gap-1.5 sm:rounded-lg sm:px-2 sm:py-1.5",
                  stockMeta.className
                )}
              >
                <PackageCheck className="size-3 shrink-0 sm:size-3.5" />
                <span className="truncate">
                  {stockMeta.label} · {product.stock} pz
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-1.5 py-1 sm:gap-1.5 sm:rounded-lg sm:px-2 sm:py-1.5">
                <Boxes className="size-3 shrink-0 text-primary sm:size-3.5" />
                <span className="truncate">MOQ {product.moq}</span>
              </div>
              <div className="col-span-2 hidden min-w-0 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 sm:flex">
                <Clock className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{product.leadTime}</span>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-1 pt-1.5 sm:items-end sm:gap-2 sm:pt-4">
              <div className="min-w-0">
                {showWholesalePrice ? (
                  <>
                    <div className="text-sm font-black sm:text-lg">
                      {hasWholesalePrice ? formatEuro(product.price) : "Prezzo non impostato"}
                    </div>
                    <div className="truncate text-[10px] text-slate-500 sm:text-xs">
                      {hasWholesalePrice
                        ? `IVA escl. · MOQ ${product.moq}`
                        : "Listino da aggiornare"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-1 text-xs font-bold leading-tight text-slate-700 sm:text-sm">
                      <Lock className="size-3 shrink-0 sm:size-3.5" />
                      Accedi per prezzo
                    </div>
                    <div className="hidden truncate text-xs text-slate-500 sm:block">
                      MOQ {product.moq} · Login richiesto
                    </div>
                  </>
                )}
              </div>
              {canAddToCart ? (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="size-8 min-w-0 shrink-0 bg-white px-0 text-primary sm:size-auto sm:min-w-[104px] sm:px-3"
                >
                  <Link
                    href={cartPath}
                    aria-describedby={stockDescriptionId}
                    aria-label={`Aggiungi ${product.name} al carrello. MOQ ${product.moq}, stock ${product.stock} pezzi.`}
                  >
                    <ShoppingCart className="size-3.5 sm:size-4" />
                    <span className="sr-only sm:not-sr-only">Aggiungi</span>
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="size-8 min-w-0 shrink-0 bg-slate-50 px-0 text-slate-500 sm:size-auto sm:min-w-[104px] sm:px-3"
                  disabled
                  aria-describedby={stockDescriptionId}
                  aria-label={`${product.name} non disponibile per il carrello`}
                >
                  <ShoppingCart className="size-3.5 sm:size-4" />
                  <span className="sr-only sm:not-sr-only">Esaurito</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {product.imageUrl && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] gap-3 p-3 sm:max-w-3xl">
            <DialogHeader className="pr-10">
              <DialogTitle className="line-clamp-2 text-sm font-black text-slate-950">
                {product.name}
              </DialogTitle>
            </DialogHeader>
            <div className="relative h-[min(72vh,620px)] min-h-[280px] overflow-hidden rounded-lg bg-slate-50">
              <Image
                src={product.imageUrl}
                alt={imageAlt}
                fill
                sizes="(max-width: 640px) 92vw, 760px"
                quality={88}
                className="object-contain p-3"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

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

function getStockMeta(product: PartProduct) {
  if (product.status === "In Stock" && product.stock > 0) {
    return {
      label: "Disponibile",
      className: "border-emerald-100 bg-emerald-50 text-emerald-700",
    };
  }

  if (product.status === "Low Stock" && product.stock > 0) {
    return {
      label: "Scorta bassa",
      className: "border-amber-100 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: "Esaurito",
    className: "border-slate-200 bg-slate-100 text-slate-500",
  };
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
