"use client";

import { memo, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  Clock,
  Lock,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PartProduct } from "@/lib/partspro-data";
import { formatEuro } from "@/lib/partspro-data";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import { getProductImageCandidates } from "@/lib/partspro-product-images";
import { cn } from "@/lib/utils";
import { PartVisual } from "./part-visual";

type ProductCardProps = {
  priceGateReason?: PriceVisibilityReason;
  priorityImage?: boolean;
  product: PartProduct;
  showWholesalePrice?: boolean;
};

const ProductImagePreviewDialog = dynamic(
  () =>
    import("./product-image-preview-dialog").then(
      (module) => module.ProductImagePreviewDialog
    ),
  { loading: () => null, ssr: false }
);

export const ProductCard = memo(function ProductCard({
  priceGateReason = "login_required",
  priorityImage = false,
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
  const imageCandidates = useMemo(() => getProductImageCandidates(product), [product]);
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const imageUrl = imageCandidates.find((candidate) => !failedImageUrls.includes(candidate));
  const hiddenPriceCopy = productPriceGateCopy(priceGateReason, product.moq);

  function markImageFailed(failedUrl: string) {
    setFailedImageUrls((current) =>
      current.includes(failedUrl) ? current : [...current, failedUrl]
    );
  }

  return (
    <>
      <Card
        className={cn(
          "h-full min-w-0 rounded-lg border-slate-200 bg-white shadow-sm transition sm:shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:hover:-translate-y-0.5 sm:hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]",
          !canAddToCart && "opacity-80"
        )}
      >
        <CardContent className="grid h-full min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-2 p-2 sm:flex sm:flex-col sm:p-3">
          {imageUrl ? (
            <button
              type="button"
              className="relative block h-28 w-full cursor-zoom-in overflow-hidden rounded-md bg-slate-50 text-left outline-none transition hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-auto sm:rounded-lg"
              aria-label={`Apri anteprima immagine ${product.name}`}
              aria-haspopup="dialog"
              onClick={() => setPreviewOpen(true)}
            >
              <div className="relative h-full rounded-md sm:h-36 sm:rounded-lg">
                <Image
                  src={imageUrl}
                  alt={imageAlt}
                  fill
                  sizes="(max-width: 640px) 104px, (max-width: 1280px) 180px, 220px"
                  quality={55}
                  fetchPriority={priorityImage ? "high" : undefined}
                  loading={priorityImage ? "eager" : "lazy"}
                  decoding="async"
                  onError={() => markImageFailed(imageUrl)}
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
                      {hiddenPriceCopy.label}
                    </div>
                    <div className="hidden truncate text-xs text-slate-500 sm:block">
                      {hiddenPriceCopy.hint}
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
      {imageUrl && previewOpen && (
        <ProductImagePreviewDialog
          imageAlt={imageAlt}
          imageUrl={imageUrl}
          onImageError={() => markImageFailed(imageUrl)}
          onOpenChange={setPreviewOpen}
          open={previewOpen}
          productName={product.name}
        />
      )}
    </>
  );
});

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

function productPriceGateCopy(reason: PriceVisibilityReason, moq: number) {
  if (reason === "customer_needs_assignment") {
    return {
      label: "Account in revisione",
      hint: `MOQ ${moq} · verifica listino`,
    };
  }

  if (reason === "wholesale_required") {
    return {
      label: "Listino B2B da abilitare",
      hint: `MOQ ${moq} · richiedi wholesale`,
    };
  }

  if (reason === "account_sync_failed" || reason === "customer_profile_required") {
    return {
      label: "Profilo in preparazione",
      hint: `MOQ ${moq} · riprova tra poco`,
    };
  }

  if (reason === "customer_suspended") {
    return {
      label: "Account sospeso",
      hint: `MOQ ${moq} · contatta supporto`,
    };
  }

  return {
    label: "Accedi per prezzo",
    hint: `MOQ ${moq} · Login richiesto`,
  };
}
