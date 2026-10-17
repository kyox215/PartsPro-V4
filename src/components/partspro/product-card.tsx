"use client";

import { usePriceFreshness } from "./storefront-refresh-provider";
import { QuoteRegion } from "./storefront-refresh-status";
import { ProductPriceExplanation } from "./product-price-explanation";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Image from "./optimized-image";
import { IntentLink as Link } from "./intent-link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Info,
  LogIn,
  Lock,
  ShoppingCart,
  ZoomIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  tx,
  txFormat,
} from "@/i18n/dictionaries/storefront";
import type { PartProduct } from "@/lib/partspro-data";
import { formatEuro } from "@/lib/partspro-data";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import type {
  PriceVisibilityReason,
  StorefrontCartAccess,
} from "@/lib/partspro-account-context";
import { hasOrderableEffectivePrice } from "@/lib/partspro-commerce-rules";
import {
  getAccountGateCopy,
  isCustomerActionRequiredReason,
} from "@/lib/partspro-account-gate-copy";
import {
  formatPriceDiscountBadge,
  getProductPriceDisplay,
} from "@/lib/partspro-price-display";
import { getProductImageCandidates } from "@/lib/partspro-product-images";
import { publicStockLevelMeta } from "@/lib/partspro-stock-availability";
import {
  getProductOrderableQuantity,
  getProductPurchaseKind,
  isProductOrderable,
  preorderEtaLabel,
} from "@/lib/partspro-preorder-contract";
import { safeCatalogReturn } from "@/lib/partspro-catalog-return.mjs";
import { cn } from "@/lib/utils";
import { addCartItem, readClientStoredCartItems } from "./cart-state";
import { cartHasPurchaseKindConflict } from "./commerce-feedback";
import { useI18n, useT } from "./i18n-provider";
import { RoutePendingIndicator } from "./pending-feedback";
import { PartVisual } from "./part-visual";
import { AccountGateDialog } from "./account-gate-dialog";
import {
  ProductCartQuantityControl,
  useProductCartQuantity,
} from "./product-cart-quantity-control";
import { ProductRestockReminderButton } from "./product-restock-reminder-button";

type ProductCardProps = {
  className?: string;
  layout?: "home" | "catalog" | "preorder";
  returnTo?: string;
  searchMatch?: string;
  onOpenProduct?: () => void;
  assistedCompanyId?: string | null;
  cartAccess?: StorefrontCartAccess;
  priceGateReason?: PriceVisibilityReason;
  priorityImage?: boolean;
  pricingPending?: boolean;
  pricingError?: boolean;
  product: PartProduct;
  showWholesalePrice?: boolean;
};

type AddFeedbackState = "idle" | "success" | "error";

import { ProductImagePreviewDialog } from "./product-image-preview-dialog";

export const ProductCard = memo(function ProductCard({
  layout = "catalog",
  assistedCompanyId,
  className,
  returnTo,
  searchMatch = "",
  onOpenProduct,
  cartAccess = { allowed: false, missingFields: [], reason: "login_required" },
  priceGateReason = "login_required",
  priorityImage = false,
  pricingPending = false,
  pricingError = false,
  product,
  showWholesalePrice = false,
}: ProductCardProps) {
  const t = useT();
  const { locale } = useI18n();
  const [mixedCartRejected, setMixedCartRejected] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [accountGateOpen, setAccountGateOpen] = useState(false);
  const freshness = usePriceFreshness(product);
  const quotePending = showWholesalePrice && (pricingPending || pricingError || freshness.refreshing || !freshness.available);
  const canUseCart = cartAccess.allowed;
  const hasEffectivePrice = hasOrderableEffectivePrice(product);
  const priceDisplay = getProductPriceDisplay(product);
  const hasOpenPrice =
    showWholesalePrice &&
    (priceGateReason === "customer" || priceGateReason === "employee");
  const purchaseKind = getProductPurchaseKind(product);
  const stockMeta = publicStockLevelMeta(t, product);
  const isPreorder = purchaseKind === "preorder";
  const orderableQuantity = getProductOrderableQuantity(product);
  const hasSellableStock = isProductOrderable(product, Math.max(1, product.moq));
  const canRequestRestock = purchaseKind === "unavailable";
  const canAddToCart = !quotePending && canUseCart && hasOpenPrice && hasEffectivePrice && hasSellableStock;
  const isLoginRequired = priceGateReason === "login_required";
  const baseProductPath = hrefWithAssistedCompanyId(
    `/prodotto/${encodeURIComponent(product.sku)}`,
    assistedCompanyId
  );
  const safeReturn = safeCatalogReturn(returnTo, assistedCompanyId);
  const productPath = safeReturn ? `${baseProductPath}${baseProductPath.includes("?") ? "&" : "?"}${new URLSearchParams({returnTo:safeReturn})}` : baseProductPath;
  const matchingModels = [...product.compatibleWith].sort((a,b) => Number(b.toLowerCase().includes(searchMatch.toLowerCase())) - Number(a.toLowerCase().includes(searchMatch.toLowerCase())));
  const loginHref = `/login?${new URLSearchParams({ next: productPath }).toString()}`;
  const variantTokens = [...new Set([product.grade, ...(product.name.match(/\b(?:soft\s+oled|hard\s+oled|oled|incell|amoled|\d{2,3}\s?hz|con\s+cornice|senza\s+cornice|with\s+frame|no\s+frame|nero|bianco|black|white)\b/gi) || []), ...product.tags.filter(tag => /oled|incell|cornice|hz/i.test(tag))])].slice(0,4);
  const imageAlt = product.imageAlt ?? product.name;
  const remainingModels = Math.max(product.compatibleWith.length - 2, 0);
  const imageCandidates = useMemo(() => getProductImageCandidates(product), [product]);
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const imageUrl = imageCandidates.find((candidate) => !failedImageUrls.includes(candidate));
  const hiddenPriceCopy = getAccountGateCopy(t, priceGateReason, {
    loginNextPath: productPath,
    moq: product.moq,
  });
  const blockedCartReason = cartAccess.allowed
    ? "price_unavailable"
    : cartAccess.reason;
  const blockedCartCopy = getAccountGateCopy(t, blockedCartReason, {
    missingFields: cartAccess.allowed ? [] : cartAccess.missingFields,
    moq: product.moq,
  });
  const canOpenAccountGate =
    hasSellableStock &&
    !hasOpenPrice &&
    !isLoginRequired &&
    isCustomerActionRequiredReason(priceGateReason);
  const canExplainBlockedCart =
    hasSellableStock && !canAddToCart && !isLoginRequired;
  const dialogReason = canOpenAccountGate ? priceGateReason : blockedCartReason;
  const dialogMissingFields = cartAccess.allowed ? [] : cartAccess.missingFields;
  const addFailedHint = mixedCartRejected
    ? locale === "zh-CN"
      ? "现货与预售需要分开下单。请先完成当前购物车，再采购另一类商品。"
      : "Articoli disponibili e preordini richiedono ordini separati. Completa prima il carrello attuale."
    : tx(
    t,
    "storefront.product.card.addFailedHint",
    "Carrello non sincronizzato. Aggiorna la pagina o accedi di nuovo."
  );
  const isReviewPriceVisible =
    showWholesalePrice && priceGateReason === "customer_needs_assignment";
  const [addFeedbackState, setAddFeedbackState] = useState<AddFeedbackState>("idle");
  const addFeedbackTimerRef = useRef<number | null>(null);
  const addLockTimerRef = useRef<number | null>(null);
  const [addLocked, setAddLocked] = useState(false);
  const cartQuantity = useProductCartQuantity(product.sku);

  useEffect(() => {
    return () => {
      if (addFeedbackTimerRef.current) {
        window.clearTimeout(addFeedbackTimerRef.current);
      }
      if (addLockTimerRef.current) {
        window.clearTimeout(addLockTimerRef.current);
      }
    };
  }, []);

  function markImageFailed(failedUrl: string) {
    setFailedImageUrls((current) =>
      current.includes(failedUrl) ? current : [...current, failedUrl]
    );
  }

  function handleAddToCart() {
    if (!canAddToCart || addLocked) {
      return;
    }

    setAddLocked(true);
    const didAdd = safeAddCartItem(product.sku, Math.max(1, product.moq), [product]);
    setMixedCartRejected(!didAdd && cartHasPurchaseKindConflict(product, readClientStoredCartItems()));
    setAddFeedbackState(didAdd ? "success" : "error");

    if (addLockTimerRef.current) {
      window.clearTimeout(addLockTimerRef.current);
    }

    addLockTimerRef.current = window.setTimeout(() => {
      setAddLocked(false);
    }, 320);

    if (addFeedbackTimerRef.current) {
      window.clearTimeout(addFeedbackTimerRef.current);
    }

    if (didAdd) {
      addFeedbackTimerRef.current = window.setTimeout(() => {
        setAddFeedbackState("idle");
      }, 1400);
    }
  }

  return (
    <>
      <Card
        data-product-layout={layout}
        data-price-visible={showWholesalePrice}
        className={cn(
          "pp-product-card @container/product h-full min-w-0 rounded-lg border-slate-200 bg-white shadow-sm transition sm:shadow-[0_14px_34px_rgba(15,23,42,0.045)] sm:hover:-translate-y-0.5 sm:hover:shadow-[0_18px_40px_rgba(15,23,42,0.07)]",
          className
        )}
      >
        <CardContent className="pp-product-card-content grid h-full min-w-0 grid-cols-1 grid-rows-[auto_1fr] gap-1.5 p-1.5 @min-[320px]/product:grid-cols-[104px_minmax(0,1fr)] @min-[320px]/product:grid-rows-1 sm:p-2.5">
          {imageUrl ? (
            <div className="pp-card-media relative self-start">
            <Link
              href={productPath}
              onClick={onOpenProduct}
              className="pp-card-image relative block h-28 w-full cursor-pointer overflow-hidden rounded-md bg-slate-50 text-left outline-none transition hover:bg-slate-100 focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-auto sm:rounded-lg"
              aria-label={txFormat(
                t,
                "storefront.ux.openProduct",
                "Apri prodotto {name}",
                { name: product.name }
              )}

            >
              <div className="pp-card-image-frame relative h-full rounded-md sm:h-36 sm:rounded-lg">
                <Image
                  src={imageUrl}
                  alt={imageAlt}
                  fill
                  sizes="(max-width: 639px) 112px, (max-width: 1023px) 40vw, (max-width: 1279px) 160px, 220px"
                  quality={55}
                  fetchPriority={priorityImage ? "high" : undefined}
                  loading={priorityImage ? "eager" : "lazy"}
                  decoding="async"
                  onError={() => markImageFailed(imageUrl)}
                  className="object-contain p-1.5 sm:p-2"
                />
              </div>
            </Link>
            <Button type="button" size="icon-lg" variant="outline" className="pp-card-zoom absolute bottom-1 right-1 bg-white/95" aria-haspopup="dialog" aria-label={txFormat(t,"storefront.product.card.previewImageAria","Apri anteprima immagine {name}",{name:product.name})} onClick={() => setPreviewOpen(true)}><ZoomIn className="size-4" /></Button>
            </div>
          ) : (
            <Link href={productPath} onClick={onOpenProduct} className="pp-card-media pp-card-image relative block h-28 overflow-hidden rounded-md bg-slate-50 sm:h-auto sm:rounded-lg">
              <PartVisual variant={product.visual} className="h-full rounded-md sm:h-36 sm:rounded-lg" />
            </Link>
          )}

          <div className="pp-card-body flex min-w-0 flex-1 flex-col">
            <Link
              href={productPath}
              onClick={onOpenProduct}
              className="pp-card-title relative block min-h-0 pr-5 text-[13px] font-black leading-[0.95rem] text-slate-950 transition active:translate-y-px hover:text-primary sm:min-h-[2.15rem] sm:text-[13px] sm:leading-[1.08rem]"
            >
              <span className="line-clamp-2 break-words">{product.name}</span>
              <RoutePendingIndicator
                className="absolute right-0 top-0.5 size-3 text-primary"
                label={tx(t, "storefront.navigation.loadingProduct", "Caricamento prodotto...")}
              />
            </Link>
            <p className="pp-card-sku mt-1 break-words text-[10px] font-semibold leading-4 text-slate-600">SKU {product.sku} · {variantTokens.join(" · ")}</p>
            {isPreorder ? (
              <div className="pp-card-preorder mt-1 flex min-w-0 items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-1 text-[10px] font-black text-violet-800">
                <CalendarClock className="size-3 shrink-0" />
                <span className="min-w-0 truncate">
                  {tx(t, "storefront.preorder.badge", "Preordine")} · {orderableQuantity}{" "}
                  {tx(t, "storefront.preorder.available", "prenotabili")}
                  {product.preorder ? ` · ETA ${preorderEtaLabel(product.preorder)}` : ""}
                </span>
              </div>
            ) : null}
            <div className="pp-card-models mt-0.5 flex min-w-0 flex-wrap gap-0.5 sm:mt-1 sm:gap-1">
              {matchingModels.slice(0, 2).map((model) => (
                <span
                  key={model}
                  className={cn(
                    "max-w-full truncate rounded-full bg-slate-100 px-1.5 py-0 text-[10px] font-semibold text-slate-600 sm:px-1.5 sm:py-0.5",

                  )}
                  title={model}
                >
                  {model}
                </span>
              ))}
              {remainingModels > 0 && (
                <Link href={productPath} onClick={onOpenProduct}
                  className="max-w-full break-words rounded-full bg-primary/8 px-1.5 py-0.5 text-[10px] font-bold text-primary sm:inline-flex"
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
                </Link>
              )}
            </div>

            <div className="pp-card-supply">{!isPreorder ? <span className={cn("pp-card-stock", stockMeta.className)}><span aria-hidden="true" />{stockMeta.label}</span> : null}<span className="pp-card-moq">{txFormat(t, "storefront.cart.moqBadge", "MOQ {moq}", { moq: product.moq })}</span></div>
            <div className="pp-card-purchase mt-auto flex flex-wrap items-start gap-2 pt-2">
              <div className="pp-card-price w-full min-w-0"><QuoteRegion product={product} pending={showWholesalePrice && pricingPending} failed={pricingError}>
                {showWholesalePrice ? (
                  <>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <div className="pp-card-current-price shrink-0 whitespace-nowrap text-sm font-black sm:text-base">
                        {hasEffectivePrice
                          ? formatEuro(product.price)
                          : tx(
                            t,
                            "storefront.product.card.priceUnset",
                            "Prezzo non impostato"
                          )}
                      </div>
                      {priceDisplay.hasDiscount ? (
                        <Badge className="max-w-full shrink border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                          {formatPriceDiscountBadge(priceDisplay, t)}
                        </Badge>
                      ) : null}
                      {isReviewPriceVisible ? (
                        <Badge
                          className="max-w-full shrink border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-800"
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
                    {hasEffectivePrice ? <p className="pp-card-price-tax">{txFormat(t, "storefront.product.card.visiblePriceHint", "IVA inclusa · MOQ {moq}", { moq: product.moq })}</p> : null}
                    <ProductPriceExplanation product={product} />
                    {priceDisplay.hasDiscount && priceDisplay.basePrice ? (
                      <div className="mt-0.5 text-[10px] font-semibold leading-3 text-slate-400 line-through sm:text-xs sm:leading-4">
                        {tx(t, "storefront.product.card.basePrice", "Prezzo base")} {formatEuro(priceDisplay.basePrice)}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 items-center gap-1 text-xs font-bold leading-tight text-slate-700">
                      <Lock className="size-3 shrink-0" />
                      <span className="truncate">{hiddenPriceCopy.label}</span>
                    </div>
                  </>
                )}
              </QuoteRegion></div>
              {quotePending ? <Button type="button" disabled size="sm" className="pp-card-add" aria-label={locale === "zh-CN" ? "正在核对价格" : "Verifica prezzo"}><ShoppingCart className="size-4"/></Button> : canAddToCart && cartQuantity > 0 ? (
                <ProductCartQuantityControl product={product} />
              ) : canAddToCart ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={cn(
                    "pp-card-add min-h-11 min-w-0 max-w-full bg-white px-3 text-primary",
                    addFeedbackState === "success" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-700",
                    addFeedbackState === "error" &&
                      "border-red-200 bg-red-50 text-red-700"
                  )}
                  onClick={handleAddToCart}
                  data-feedback={addFeedbackState}
                  disabled={addLocked}
                  aria-label={
                    addFeedbackState === "error"
                      ? addFailedHint
                      : txFormat(
                          t,
                          "storefront.product.card.addAriaShort",
                          "Aggiungi {name} al carrello.",
                          { name: product.name }
                        )
                  }
                  title={addFeedbackState === "error" ? addFailedHint : undefined}
                >
                  {addFeedbackState === "success" ? (
                    <CheckCircle2 className="size-3.5 sm:size-4" />
                  ) : addFeedbackState === "error" ? (
                    <AlertTriangle className="size-3.5 sm:size-4" />
                  ) : (
                    <ShoppingCart className="size-3.5 sm:size-4" />
                  )}
                  <span className="min-w-0 whitespace-normal" aria-live="polite">
                    {addFeedbackState === "success"
                      ? tx(t, "storefront.product.card.added", "Aggiunto")
                      : addFeedbackState === "error"
                      ? tx(t, "storefront.product.card.addFailed", "Riprova")
                      : isPreorder
                        ? tx(t, "storefront.preorder.reserve", "Prenota")
                        : tx(t, "storefront.product.card.add", "Aggiungi")}
                  </span>
                </Button>
              ) : isLoginRequired && hasSellableStock ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11 min-w-0 max-w-full bg-white px-3 text-primary"
                  asChild
                >
                  <Link
                    href={loginHref}
                    aria-label={txFormat(
                      t,
                      "storefront.product.card.loginToAddAria",
                      "Accedi per aggiungere {name} al carrello.",
                      { name: product.name }
                    )}
                  >
                    <LogIn className="size-3.5 sm:size-4" />
                    <span className="min-w-0 whitespace-normal">
                      {tx(t, "storefront.product.card.loginToAdd", "Accedi")}
                    </span>
                    <RoutePendingIndicator className="size-3 text-primary" />
                  </Link>
                </Button>
              ) : canOpenAccountGate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 min-w-0 max-w-full bg-white px-3 text-primary"
                  aria-label={txFormat(
                    t,
                    "storefront.product.card.accountGateAria",
                    "{name}: apri istruzioni account.",
                    { name: product.name }
                  )}
                  title={hiddenPriceCopy.title}
                  onClick={() => setAccountGateOpen(true)}
                  aria-haspopup="dialog"
                >
                  <Info className="size-3.5 sm:size-4" />
                  <span className="min-w-0 whitespace-normal text-left">
                    {hiddenPriceCopy.label}
                  </span>
                </Button>
              ) : canRequestRestock ? (
                <ProductRestockReminderButton
                  isAuthenticated={priceGateReason !== "login_required"}
                  product={product}
                />
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 min-w-0 max-w-full bg-slate-50 px-3 text-slate-700 hover:bg-slate-100"
                  onClick={() => setAccountGateOpen(true)}
                  aria-haspopup="dialog"
                  aria-label={txFormat(
                    t,
                    "storefront.product.card.unavailableReasonAria",
                    "{name} non disponibile per il carrello. Apri il motivo.",
                    { name: product.name }
                  )}
                  title={blockedCartCopy.title}
                >
                  <ShoppingCart className="size-3.5 sm:size-4" />
                  <span className="min-w-0 whitespace-normal">
                    {blockedCartCopy.label}
                  </span>
                </Button>
              )}
            </div>
            {canAddToCart && addFeedbackState === "error" ? (
              <div
                className={cn(
                  "pp-card-feedback mt-1 flex min-h-5 items-start gap-1 rounded-md border px-1.5 py-1 text-[10px] font-bold leading-3",
                  addFeedbackState === "error"
                    ? "border-red-100 bg-red-50 text-red-700"
                    : "invisible border-transparent"
                )}
                role={addFeedbackState === "error" ? "alert" : undefined}
                aria-live="polite"
              >
                <AlertTriangle className="mt-px size-3 shrink-0" />
                <div><span>{addFailedHint}</span>{mixedCartRejected ? <Link href={hrefWithAssistedCompanyId("/carrello", assistedCompanyId)} className="pp-card-feedback-link">{tx(t, "nav.cart", "Carrello")} →</Link> : null}</div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {imageUrl && previewOpen && (
        <ProductImagePreviewDialog
          imageAlt={imageAlt}
          imageUrl={imageUrl}
          imageUrls={(product.galleryImageUrls ?? []).filter(url => !failedImageUrls.includes(url))}
          onImageError={markImageFailed}
          onOpenChange={setPreviewOpen}
          open={previewOpen}
          productName={product.name}
        />
      )}
      {canExplainBlockedCart ? (
        <AccountGateDialog
          loginNextPath={productPath}
          missingFields={dialogMissingFields}
          moq={product.moq}
          onOpenChange={setAccountGateOpen}
          open={accountGateOpen}
          productName={product.name}
          reason={dialogReason}
        />
      ) : null}
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
