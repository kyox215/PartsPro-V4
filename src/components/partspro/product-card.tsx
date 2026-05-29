"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
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
  leadTimeLabel,
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import type { PartProduct } from "@/lib/partspro-data";
import { formatEuro } from "@/lib/partspro-data";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import {
  formatPercentBadge,
  getProductPriceDisplay,
} from "@/lib/partspro-price-display";
import { getProductImageCandidates } from "@/lib/partspro-product-images";
import { publicStockLevelMeta } from "@/lib/partspro-stock-availability";
import { cn } from "@/lib/utils";
import { addCartItem } from "./cart-state";
import { useT } from "./i18n-provider";
import { PartVisual } from "./part-visual";
import {
  ProductCartQuantityControl,
  useProductCartQuantity,
} from "./product-cart-quantity-control";
import { ProductRestockReminderButton } from "./product-restock-reminder-button";

type ProductCardProps = {
  assistedCompanyId?: string | null;
  priceGateReason?: PriceVisibilityReason;
  priorityImage?: boolean;
  product: PartProduct;
  showWholesalePrice?: boolean;
};

type AddFeedbackState = "idle" | "success" | "error";

const ProductImagePreviewDialog = dynamic(
  () =>
    import("./product-image-preview-dialog").then(
      (module) => module.ProductImagePreviewDialog
    ),
  { loading: () => null, ssr: false }
);

export const ProductCard = memo(function ProductCard({
  assistedCompanyId,
  priceGateReason = "login_required",
  priorityImage = false,
  product,
  showWholesalePrice = false,
}: ProductCardProps) {
  const t = useT();
  const [previewOpen, setPreviewOpen] = useState(false);
  const stockMeta = publicStockLevelMeta(t, product);
  const hasEffectivePrice = product.price > 0;
  const priceDisplay = getProductPriceDisplay(product);
  const hasOpenPrice =
    showWholesalePrice &&
    (priceGateReason === "customer" || priceGateReason === "employee");
  const hasSellableStock =
    product.stock >= Math.max(1, product.moq) && product.status !== "Out of Stock";
  const canRequestRestock =
    product.status === "Out of Stock" ||
    product.stock <= 0 ||
    product.stock < Math.max(1, product.moq);
  const canAddToCart = hasOpenPrice && hasEffectivePrice && hasSellableStock;
  const productPath = hrefWithAssistedCompanyId(
    `/prodotto/${encodeURIComponent(product.sku)}`,
    assistedCompanyId
  );
  const stockDescriptionId = `stock-${product.sku.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const imageAlt = product.imageAlt ?? product.name;
  const remainingModels = Math.max(product.compatibleWith.length - 2, 0);
  const imageCandidates = useMemo(() => getProductImageCandidates(product), [product]);
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const imageUrl = imageCandidates.find((candidate) => !failedImageUrls.includes(candidate));
  const hiddenPriceCopy = productPriceGateCopy(t, priceGateReason, product.moq);
  const disabledCartCopy = productCartDisabledCopy(t, {
    hasEffectivePrice,
    hasOpenPrice,
    hasSellableStock,
  });
  const isReviewPriceVisible =
    showWholesalePrice && priceGateReason === "customer_needs_assignment";
  const [addFeedbackState, setAddFeedbackState] = useState<AddFeedbackState>("idle");
  const addFeedbackTimerRef = useRef<number | null>(null);
  const cartQuantity = useProductCartQuantity(product.sku);

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
    if (!canAddToCart) {
      return;
    }

    const didAdd = safeAddCartItem(product.sku, Math.max(1, product.moq), [product]);
    setAddFeedbackState(didAdd ? "success" : "error");

    if (addFeedbackTimerRef.current) {
      window.clearTimeout(addFeedbackTimerRef.current);
    }

    addFeedbackTimerRef.current = window.setTimeout(() => {
      setAddFeedbackState("idle");
    }, 1400);
  }

  return (
    <>
      <Card
        className={cn(
          "h-full min-w-0 rounded-lg border-slate-200 bg-white shadow-sm transition sm:shadow-[0_14px_34px_rgba(15,23,42,0.045)] sm:hover:-translate-y-0.5 sm:hover:shadow-[0_18px_40px_rgba(15,23,42,0.07)]",
          !canAddToCart && "opacity-80"
        )}
      >
        <CardContent className="grid h-full min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-1.5 p-1.5 sm:flex sm:flex-col sm:p-2.5">
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
                  sizes="(max-width: 640px) 104px, (max-width: 1400px) 180px, 200px"
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
                  "storefront.product.card.stockLevelTitle",
                  "Disponibilita: {level}",
                  { level: stockMeta.label }
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
                  "storefront.product.card.stockLevelTitle",
                  "Disponibilita: {level}",
                  { level: stockMeta.label }
                )}
              >
                {stockMeta.label}
              </Badge>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col sm:mt-2">
            <Link
              href={productPath}
              className="line-clamp-2 min-h-0 break-words text-[13px] font-black leading-[0.95rem] text-slate-950 hover:text-primary sm:min-h-[2.15rem] sm:text-[13px] sm:leading-[1.08rem]"
            >
              {product.name}
            </Link>
            <div className="mt-0.5 flex min-w-0 flex-wrap gap-0.5 sm:mt-1 sm:gap-1">
              {product.compatibleWith.slice(0, 2).map((model, index) => (
                <span
                  key={model}
                  className={cn(
                    "max-w-full truncate rounded-full bg-slate-100 px-1.5 py-0 text-[10px] font-semibold text-slate-600 sm:px-1.5 sm:py-0.5",
                    index > 0 && "hidden sm:inline-flex"
                  )}
                  title={model}
                >
                  {model}
                </span>
              ))}
              {remainingModels > 0 && (
                <span
                  className="hidden max-w-full truncate rounded-full bg-primary/8 px-1.5 py-0.5 text-[10px] font-bold text-primary sm:inline-flex"
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

            <div className="mt-1 grid grid-cols-2 gap-0.5 text-[10px] font-semibold text-slate-600 sm:mt-2 sm:gap-1">
              <div
                id={stockDescriptionId}
                className={cn(
                  "flex min-w-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 sm:gap-1 sm:rounded-md sm:py-1",
                  stockMeta.className
                )}
              >
                <PackageCheck className="size-3 shrink-0" />
                <span className="truncate">{stockMeta.label}</span>
              </div>
              <div className="flex min-w-0 items-center gap-0.5 rounded-md border border-slate-100 bg-slate-50 px-1.5 py-0.5 sm:gap-1 sm:rounded-md sm:py-1">
                <Boxes className="size-3 shrink-0 text-primary" />
                <span className="truncate">MOQ {product.moq}</span>
              </div>
              <div className="col-span-2 hidden min-w-0 items-center gap-1 rounded-md border border-slate-100 bg-slate-50 px-1.5 py-1 sm:flex">
                <Clock className="size-3 shrink-0 text-primary" />
                <span className="truncate">{leadTimeLabel(t, product.leadTime)}</span>
              </div>
            </div>

            <div className="mt-auto flex items-center justify-between gap-1 pt-1 sm:items-end sm:pt-2">
              <div className="min-w-0">
                {showWholesalePrice ? (
                  <>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <div className="truncate text-sm font-black sm:text-base">
                        {hasEffectivePrice
                          ? formatEuro(product.price)
                          : tx(
                            t,
                            "storefront.product.card.priceUnset",
                            "Prezzo non impostato"
                          )}
                      </div>
                      {priceDisplay.hasDiscount ? (
                        <Badge className="shrink-0 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                          {formatPercentBadge(priceDisplay.discountPercent)}
                        </Badge>
                      ) : null}
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
                    {priceDisplay.hasDiscount && priceDisplay.basePrice ? (
                      <div className="truncate text-[10px] font-semibold text-slate-400 line-through sm:text-xs">
                        {tx(t, "storefront.product.card.basePrice", "Prezzo base")} {formatEuro(priceDisplay.basePrice)}
                      </div>
                    ) : null}
                    <div className="truncate text-[10px] leading-3 text-slate-500">
                      {isReviewPriceVisible
                        ? txFormat(
                          t,
                          "storefront.home.productCard.pendingHint",
                          "In revisione · MOQ {moq}",
                          { moq: product.moq }
                        )
                        : hasEffectivePrice
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
                    <div className="flex min-w-0 items-center gap-1 text-xs font-bold leading-tight text-slate-700">
                      <Lock className="size-3 shrink-0" />
                      <span className="truncate">{hiddenPriceCopy.label}</span>
                    </div>
                  </>
                )}
              </div>
              {canAddToCart && cartQuantity > 0 ? (
                <ProductCartQuantityControl product={product} />
              ) : canAddToCart ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "size-8 min-w-0 shrink-0 bg-white px-0 text-primary sm:size-auto sm:min-w-[96px] sm:px-2",
                    addFeedbackState === "success" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-700",
                    addFeedbackState === "error" &&
                      "border-red-200 bg-red-50 text-red-700"
                  )}
                  onClick={handleAddToCart}
                  aria-describedby={stockDescriptionId}
                  aria-label={txFormat(
                    t,
                    "storefront.product.card.addAria",
                    "Aggiungi {name} al carrello. MOQ {moq}.",
                    { name: product.name, moq: product.moq }
                  )}
                >
                  {addFeedbackState === "success" ? (
                    <CheckCircle2 className="size-3.5 sm:size-4" />
                  ) : addFeedbackState === "error" ? (
                    <AlertTriangle className="size-3.5 sm:size-4" />
                  ) : (
                    <ShoppingCart className="size-3.5 sm:size-4" />
                  )}
                  <span className="sr-only min-w-0 truncate sm:not-sr-only" aria-live="polite">
                    {addFeedbackState === "success"
                      ? tx(t, "storefront.product.card.added", "Aggiunto")
                      : addFeedbackState === "error"
                      ? tx(t, "storefront.product.card.addFailed", "Riprova")
                      : tx(t, "storefront.product.card.add", "Aggiungi")}
                  </span>
                </Button>
              ) : canRequestRestock ? (
                <ProductRestockReminderButton
                  isAuthenticated={priceGateReason !== "login_required"}
                  product={product}
                />
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="size-8 min-w-0 shrink-0 bg-slate-50 px-0 text-slate-500 sm:size-auto sm:min-w-[96px] sm:px-2"
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
                    {disabledCartCopy.label}
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

function productCartDisabledCopy(
  t: StorefrontTranslator,
  state: {
    hasEffectivePrice: boolean;
    hasOpenPrice: boolean;
    hasSellableStock: boolean;
  }
) {
  if (!state.hasSellableStock) {
    return {
      label: tx(t, "storefront.product.card.unavailable", "Esaurito"),
    };
  }

  if (!state.hasOpenPrice) {
    return {
      label: tx(t, "storefront.product.card.priceLocked", "Listino"),
    };
  }

  if (!state.hasEffectivePrice) {
    return {
      label: tx(t, "storefront.product.card.priceMissing", "Prezzo"),
    };
  }

  return {
    label: tx(t, "storefront.product.card.unavailable", "Esaurito"),
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
