"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  Boxes,
  CheckCircle2,
  Clock,
  Lock,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  stockStatusLabel,
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import type { PartProduct } from "@/lib/partspro-data";
import { formatEuro } from "@/lib/partspro-data";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import { getProductImageCandidates } from "@/lib/partspro-product-images";
import { cn } from "@/lib/utils";
import { addCartItem } from "./cart-state";
import { useT } from "./i18n-provider";
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
  const t = useT();
  const [previewOpen, setPreviewOpen] = useState(false);
  const stockMeta = getStockMeta(product, t);
  const canAddToCart =
    product.stock >= Math.max(1, product.moq) && product.status !== "Out of Stock";
  const productPath = `/prodotto/${encodeURIComponent(product.sku)}`;
  const stockDescriptionId = `stock-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const imageAlt = product.imageAlt ?? product.name;
  const hasWholesalePrice = product.price > 0;
  const remainingModels = Math.max(product.compatibleWith.length - 2, 0);
  const imageCandidates = useMemo(() => getProductImageCandidates(product), [product]);
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const imageUrl = imageCandidates.find((candidate) => !failedImageUrls.includes(candidate));
  const hiddenPriceCopy = productPriceGateCopy(t, priceGateReason, product.moq);
  const isReviewPriceVisible =
    showWholesalePrice && priceGateReason === "customer_needs_assignment";
  const [addFeedbackVisible, setAddFeedbackVisible] = useState(false);
  const addFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (addFeedbackTimerRef.current) {
        window.clearTimeout(addFeedbackTimerRef.current);
      }
    };
  }, []);

  function markImageFailed(failedUrl: string) {
    setFailedImageUrls((current) =>
      current.includes(failedUrl) ? current : [...current, failedUrl]
    );
  }

  function handleAddToCart() {
    addCartItem(product.sku, Math.max(1, product.moq), [product]);
    setAddFeedbackVisible(true);

    if (addFeedbackTimerRef.current) {
      window.clearTimeout(addFeedbackTimerRef.current);
    }

    addFeedbackTimerRef.current = window.setTimeout(() => {
      setAddFeedbackVisible(false);
    }, 1400);
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
              aria-label={txFormat(
                t,
                "storefront.product.card.previewImageAria",
                "Apri anteprima immagine {name}",
                { name: product.name }
              )}
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
                title={txFormat(
                  t,
                  "storefront.product.card.stockLine",
                  "{status} · {count} pz",
                  { status: stockMeta.label, count: product.stock }
                )}
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
                title={txFormat(
                  t,
                  "storefront.product.card.stockLine",
                  "{status} · {count} pz",
                  { status: stockMeta.label, count: product.stock }
                )}
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
                  title={txFormat(
                    t,
                    "storefront.product.card.extraModelsTitle",
                    "{count} modelli compatibili aggiuntivi",
                    { count: remainingModels }
                  )}
                >
                  {txFormat(
                    t,
                    "storefront.home.productCard.extraModels",
                    "+{count} modelli",
                    { count: remainingModels }
                  )}
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
                  {txFormat(
                    t,
                    "storefront.product.card.stockLine",
                    "{status} · {count} pz",
                    { status: stockMeta.label, count: product.stock }
                  )}
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
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="truncate text-sm font-black sm:text-lg">
                        {hasWholesalePrice
                          ? formatEuro(product.price)
                          : tx(
                            t,
                            "storefront.product.card.priceUnset",
                            "Prezzo non impostato"
                          )}
                      </div>
                      {isReviewPriceVisible ? (
                        <Badge
                          className="shrink-0 border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-800"
                          title={tx(
                            t,
                            "storefront.product.card.reviewBadgeTitle",
                            "Account in revisione"
                          )}
                        >
                          {tx(t, "storefront.home.productCard.pendingPrice", "In revisione")}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="truncate text-[10px] text-slate-500 sm:text-xs">
                      {isReviewPriceVisible
                        ? txFormat(
                          t,
                          "storefront.home.productCard.pendingHint",
                          "In revisione · MOQ {moq}",
                          { moq: product.moq }
                        )
                        : hasWholesalePrice
                        ? txFormat(
                          t,
                          "storefront.product.card.visiblePriceHint",
                          "IVA escl. · MOQ {moq}",
                          { moq: product.moq }
                        )
                        : tx(
                          t,
                          "storefront.product.card.priceNeedsUpdate",
                          "Listino da aggiornare"
                        )}
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
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "size-8 min-w-0 shrink-0 bg-white px-0 text-primary sm:size-auto sm:min-w-[104px] sm:px-3",
                    addFeedbackVisible && "border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                  onClick={handleAddToCart}
                  aria-describedby={stockDescriptionId}
                  aria-label={txFormat(
                    t,
                    "storefront.product.card.addAria",
                    "Aggiungi {name} al carrello. MOQ {moq}, stock {stock} pezzi.",
                    { name: product.name, moq: product.moq, stock: product.stock }
                  )}
                >
                  {addFeedbackVisible ? (
                    <CheckCircle2 className="size-3.5 sm:size-4" />
                  ) : (
                    <ShoppingCart className="size-3.5 sm:size-4" />
                  )}
                  <span className="sr-only sm:not-sr-only">
                    {addFeedbackVisible
                      ? tx(t, "storefront.product.card.added", "Aggiunto")
                      : tx(t, "storefront.product.card.add", "Aggiungi")}
                  </span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="size-8 min-w-0 shrink-0 bg-slate-50 px-0 text-slate-500 sm:size-auto sm:min-w-[104px] sm:px-3"
                  disabled
                  aria-describedby={stockDescriptionId}
                  aria-label={txFormat(
                    t,
                    "storefront.product.card.unavailableAria",
                    "{name} non disponibile per il carrello",
                    { name: product.name }
                  )}
                >
                  <ShoppingCart className="size-3.5 sm:size-4" />
                  <span className="sr-only sm:not-sr-only">
                    {tx(t, "storefront.product.card.unavailable", "Esaurito")}
                  </span>
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

function getStockMeta(product: PartProduct, t: StorefrontTranslator) {
  if (product.status === "In Stock" && product.stock > 0) {
    return {
      label: stockStatusLabel(t, product.status),
      className: "border-emerald-100 bg-emerald-50 text-emerald-700",
    };
  }

  if (product.status === "Low Stock" && product.stock > 0) {
    return {
      label: stockStatusLabel(t, product.status),
      className: "border-amber-100 bg-amber-50 text-amber-800",
    };
  }

  return {
    label: stockStatusLabel(t, "Out of Stock"),
    className: "border-slate-200 bg-slate-100 text-slate-500",
  };
}

function productPriceGateCopy(
  t: StorefrontTranslator,
  reason: PriceVisibilityReason,
  moq: number
) {
  if (reason === "customer_needs_assignment") {
    return {
      label: tx(
        t,
        "storefront.product.card.accountReviewLabel",
        "Account in revisione"
      ),
      hint: txFormat(
        t,
        "storefront.product.card.accountReviewHint",
        "MOQ {moq} · verifica listino",
        { moq }
      ),
    };
  }

  if (reason === "wholesale_required") {
    return {
      label: tx(
        t,
        "storefront.product.card.wholesaleLabel",
        "Listino da abilitare"
      ),
      hint: txFormat(
        t,
        "storefront.product.card.wholesaleHint",
        "MOQ {moq} · verifica cliente",
        { moq }
      ),
    };
  }

  if (reason === "account_sync_failed" || reason === "customer_profile_required") {
    return {
      label: tx(
        t,
        "storefront.product.card.profileLabel",
        "Profilo in preparazione"
      ),
      hint: txFormat(
        t,
        "storefront.product.card.profileHint",
        "MOQ {moq} · riprova tra poco",
        { moq }
      ),
    };
  }

  if (reason === "customer_suspended") {
    return {
      label: tx(
        t,
        "storefront.product.card.suspendedLabel",
        "Account sospeso"
      ),
      hint: txFormat(
        t,
        "storefront.product.card.suspendedHint",
        "MOQ {moq} · contatta supporto",
        { moq }
      ),
    };
  }

  return {
    label: tx(t, "storefront.product.card.loginLabel", "Accedi per prezzo"),
    hint: txFormat(
      t,
      "storefront.product.card.loginHint",
      "MOQ {moq} · login richiesto",
      { moq }
    ),
  };
}
