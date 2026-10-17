import { QuoteRegion } from "./storefront-refresh-status";
import { productDetailPathWithCatalogReturn } from "@/lib/partspro-catalog-return.mjs";
import { PricingSessionBoundary, QuoteExpiryRefresh } from "./pricing-session-boundary";
import { CatalogBackLink } from "./catalog-back-link";
import { ProductCompatibilityList } from "./product-compatibility-list";
import { ProductPriceExplanation } from "./product-price-explanation";
import Link from "next/link";
import { Barcode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  brandLabel,
  categoryLabel,
  tx,
  txFormat,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import { getDictionary, translate } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import { formatEuro, type PartProduct } from "@/lib/partspro-data";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import { inferDeviceModelSeries } from "@/lib/partspro-device-series";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import { getAccountGateCopy } from "@/lib/partspro-account-gate-copy";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import {
  formatPriceDiscountBadge,
  getProductPriceDisplay,
} from "@/lib/partspro-price-display";
import { getProductPurchaseKind } from "@/lib/partspro-preorder-contract";
import { CustomerActivityTracker } from "./customer-activity-tracker";
import { ProductDetailPurchasePanelSlot } from "./product-detail-purchase-panel-slot";
import { StoreHeader } from "./store-header";
import { ProductDetailGallery } from "./product-detail-gallery";
import { MobileDisclosure } from "./mobile-disclosure";
import { publicStockLevelMeta } from "@/lib/partspro-stock-availability";

type ProductDetailPageProps = {
  assistedCompanyId?: string | null;
  catalogReturnTo?: string | null;
  canUseCart?: boolean;
  initialAccountAccess?: StoreHeaderAccountAccess;
  priceGateReason?: PriceVisibilityReason;
  product: PartProduct;
  showWholesalePrice?: boolean;
};

export async function ProductDetailPage({
  assistedCompanyId = null,
  catalogReturnTo = null,
  canUseCart = false,
  initialAccountAccess,
  priceGateReason = "login_required",
  product,
  showWholesalePrice = false,
}: ProductDetailPageProps) {
  const { locale } = await getRequestI18n();
  const dictionary = getDictionary(locale);
  const t: StorefrontTranslator = (key) => translate(dictionary, key);
  const hasBuyerPrice = product.price > 0;
  const priceDisplay = getProductPriceDisplay(product);
  const canPurchaseProduct =
    canUseCart &&
    showWholesalePrice &&
    (priceGateReason === "customer" || priceGateReason === "employee") &&
    hasBuyerPrice;
  const canRequestRestock = getProductPurchaseKind(product) === "unavailable";
  const shouldShowPurchasePanel = canPurchaseProduct || canRequestRestock;
  const productPath = productDetailPathWithCatalogReturn(product.sku, catalogReturnTo, assistedCompanyId);
  const hiddenPriceCopy = getAccountGateCopy(t, priceGateReason, {
    loginNextPath: productPath,
    moq: product.moq,
  });
  const isReviewPriceVisible =
    showWholesalePrice && priceGateReason === "customer_needs_assignment";
  const primaryModel = product.compatibleWith[0] ?? null;
  const modelSeries = inferDeviceModelSeries(product.brand, primaryModel);
  const localizedBrand = brandLabel(t, product.brand);
  const localizedCategory = categoryLabel(t, product.category);
  const stockMeta = publicStockLevelMeta(t, product);
  const purchaseKind = getProductPurchaseKind(product);

  return (
    <PricingSessionBoundary userId={initialAccountAccess?.userId}><main className="pp-product-page min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <CustomerActivityTracker
        brand={product.brand}
        enabled={Boolean(initialAccountAccess?.authenticated)}
        eventType="product_view"
        metadata={{ category: product.category }}
        model={primaryModel}
        modelSeries={modelSeries}
        productName={product.name}
        skuCode={product.sku}
      />
      <StoreHeader
        assistedCompanyId={assistedCompanyId}
        initialAccountAccess={initialAccountAccess}
      />
      <div className="pp-product-shell mx-auto max-w-[1440px]">
        <div className="pp-product-return"><CatalogBackLink assistedCompanyId={assistedCompanyId} /></div>

        <div className="pp-product-layout">
          <Card className="pp-product-gallery-card rounded-lg border-slate-200 bg-white">
            <CardContent className="pp-product-gallery-content">
              <ProductDetailGallery product={product} />
              <div className="pp-product-proof">
                {[
                  {
                    label: tx(t, "storefront.product.detail.lot", "Lotto"),
                    value: tx(t, "storefront.product.detail.lotTracked", "Tracciato"),
                  },
                  {
                    label: tx(t, "storefront.product.detail.qc", "QC"),
                    value: tx(t, "storefront.product.detail.qcText", "Test pre-spedizione"),
                  },
                  {
                    label: tx(t, "storefront.product.detail.packing", "Packing"),
                    value: tx(
                      t,
                      "storefront.product.detail.packingAntiStatic",
                      "Antistatico"
                    ),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="pp-product-proof-item min-w-0"
                  >
                    <div className="text-[11px] font-bold uppercase text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-0.5 break-words text-xs font-black text-slate-700">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <section className="pp-product-information min-w-0">
            <Card className="pp-product-information-card rounded-lg border-slate-200 bg-white">
              <CardContent className="pp-product-information-content">
                <div className="pp-product-heading-grid">
                  <div className="min-w-0">
                    <div className="pp-product-labels"><Badge variant="outline">{localizedCategory}</Badge><Badge className={purchaseKind === "preorder" ? "border-violet-200 bg-violet-50 text-violet-700" : stockMeta.className}>{purchaseKind === "preorder" ? tx(t, "storefront.preorder.badge", "Preordine") : stockMeta.label}</Badge></div>
                    <h1 className="pp-product-title break-words">
                      {product.name}
                    </h1>
                    <p className="pp-product-sku flex min-w-0 items-center gap-1.5 font-mono text-xs text-slate-500">
                      <Barcode className="size-3.5 shrink-0" />
                      <span className="truncate">{product.sku}</span>
                    </p>
                    {product.compatibleWith.length > 0 ? <a className="pp-product-model-link" href="#product-compatibility">{txFormat(t, "storefront.ux.allModels", "Mostra tutti i {count} modelli compatibili", { count: product.compatibleWith.length })}</a> : null}
                  </div>

                  {showWholesalePrice ? <div className="pp-product-price-context"><QuoteRegion product={product}><ProductPriceExplanation product={product} detailed /></QuoteRegion></div> : null}
                  <div className="pp-product-price-block"><QuoteRegion product={product}>
                    {showWholesalePrice && hasBuyerPrice ? (
                      <div className="flex min-w-0 flex-wrap items-end gap-2">
                        <div className="pp-product-current-price">
                          {formatEuro(product.price)}
                        </div>
                        {priceDisplay.hasDiscount && priceDisplay.basePrice ? (
                          <>
                            <div className="pb-0.5 text-sm font-semibold text-slate-400 line-through">
                              {formatEuro(priceDisplay.basePrice)}
                            </div>
                            <Badge className="mb-0.5 border border-emerald-200 bg-emerald-50 text-emerald-700">
                              {formatPriceDiscountBadge(priceDisplay, t)}
                            </Badge>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <p className="line-clamp-2 font-semibold leading-4 text-slate-700">
                        {isReviewPriceVisible && hasBuyerPrice
                          ? hiddenPriceCopy.description
                          : showWholesalePrice
                            ? tx(
                              t,
                              "storefront.product.detail.sessionPricePending",
                              "Account verificato: il prezzo per questo SKU deve ancora essere aggiornato."
                            )
                            : hiddenPriceCopy.description}
                      </p>
                    )}
                    {showWholesalePrice && hasBuyerPrice ? <p className="pp-product-tax">{tx(t, "storefront.product.purchase.quotePriceEach", "Prezzo IVA inclusa")}</p> : null}
                  </QuoteRegion></div>
                </div>

                <QuoteRegion product={product} preserveState>{shouldShowPurchasePanel ? (
                  <ProductDetailPurchasePanelSlot
                    checkoutHref={hrefWithAssistedCompanyId("/checkout", assistedCompanyId)}
                    isAuthenticated={Boolean(initialAccountAccess?.authenticated)}
                    product={product}
                  />
                ) : showWholesalePrice && hasBuyerPrice ? (
                  <Card className="mt-2 border-amber-200 bg-amber-50/60">
                    <CardContent className="flex flex-col gap-2 p-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-black">
                          {tx(
                            t,
                            "storefront.product.detail.priceVisibleOrderLockedTitle",
                            hiddenPriceCopy.cardTitle
                          )}
                        </div>
                        <p className="mt-1 leading-5">
                          {tx(
                            t,
                            "storefront.product.detail.priceVisibleOrderLockedDescription",
                            hiddenPriceCopy.cardDescription
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : showWholesalePrice ? (
                  <Card className="mt-2 border-amber-200 bg-amber-50/60">
                    <CardContent className="flex flex-col gap-2 p-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-black">
                          {tx(
                            t,
                            "storefront.product.detail.noPriceTitle",
                            "Prezzo non impostato"
                          )}
                        </div>
                        <p className="mt-1 leading-5">
                          {tx(
                            t,
                            "storefront.product.detail.noPriceDescription",
                            "Sessione verificata, ma il prezzo per questo SKU non è ancora stato aggiornato."
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="mt-2 border-primary/20 bg-white">
                    <CardContent className="flex flex-col gap-2 p-3 text-xs text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-black text-slate-950">{hiddenPriceCopy.cardTitle}</div>
                        <p className="mt-1 leading-5">{hiddenPriceCopy.cardDescription}</p>
                      </div>
                      {hiddenPriceCopy.actionHref ? (
                        <Button asChild className="shrink-0">
                          <Link href={hiddenPriceCopy.actionHref}>{hiddenPriceCopy.actionLabel}</Link>
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                )}

                </QuoteRegion><div className="pp-product-specifications">
                  <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                    <h2 className="truncate text-sm font-black text-slate-950">
                      {tx(t, "storefront.ux.quickDetails", "Dettagli rapidi")}
                    </h2>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                      SKU {product.sku}
                    </span>
                  </div>
                  <div className="pp-product-spec-grid">
                    <Spec label={tx(t,"storefront.ux.brand","Brand")} value={localizedBrand} />
                    <Spec label={tx(t,"storefront.ux.category","Categoria")} value={localizedCategory} />
                    <Spec label={tx(t,"storefront.ux.vat","IVA")} value={`${product.vatRate}%`} />
                    <Spec
                      label={tx(t, "storefront.product.detail.afterSales", "Assistenza")}
                      value={txFormat(t, "storefront.product.detail.afterSalesDays", "{days} giorni", {
                        days: product.rmaDays,
                      })}
                    />
                    <Spec
                      label={tx(t, "storefront.product.detail.invoice", "Fattura")}
                      value={tx(
                        t,
                        "storefront.product.detail.invoiceText",
                        "PEC / Codice Destinatario"
                      )}
                    />
                    <Spec label={tx(t,"storefront.ux.updated","Aggiornato")} value={Number.isNaN(Date.parse(product.updatedAt)) ? product.updatedAt : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Rome" }).format(new Date(product.updatedAt))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
        {product.compatibleWith.length > 0 ? <MobileDisclosure id="product-compatibility" className="pp-product-compatibility-panel" title={tx(t, "storefront.ui.product.compatibility", "Compatibilità")} description={`${localizedBrand} · ${localizedCategory}`}><ProductCompatibilityList models={product.compatibleWith} /></MobileDisclosure> : null}
      </div>
      <QuoteExpiryRefresh products={[product]} />
    </main></PricingSessionBoundary>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="pp-product-spec min-w-0">
      <div className="truncate text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-0.5 break-words text-xs font-bold text-slate-800">{value}</div>
    </div>
  );
}
