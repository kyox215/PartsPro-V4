import Link from "next/link";
import { ArrowLeft, Barcode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  brandLabel,
  categoryLabel,
  tx,
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
import { CustomerActivityTracker } from "./customer-activity-tracker";
import { ProductDetailPurchasePanelSlot } from "./product-detail-purchase-panel-slot";
import { StoreHeader } from "./store-header";
import { StorefrontProductImage } from "./storefront-product-image";

type ProductDetailPageProps = {
  assistedCompanyId?: string | null;
  initialAccountAccess?: StoreHeaderAccountAccess;
  priceGateReason?: PriceVisibilityReason;
  product: PartProduct;
  showWholesalePrice?: boolean;
};

export async function ProductDetailPage({
  assistedCompanyId = null,
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
    showWholesalePrice &&
    (priceGateReason === "customer" || priceGateReason === "employee") &&
    hasBuyerPrice;
  const minimumQuantity = Math.max(1, product.moq);
  const canRequestRestock =
    product.status === "Out of Stock" ||
    product.stock <= 0 ||
    product.stock < minimumQuantity;
  const shouldShowPurchasePanel = canPurchaseProduct || canRequestRestock;
  const productPath = `/prodotto/${encodeURIComponent(product.sku)}`;
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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
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
      <div className="mx-auto max-w-[1440px] px-2 py-2 sm:px-3 sm:py-3">
        <Button variant="ghost" size="sm" asChild className="mb-2 h-8 px-2">
          <Link href={hrefWithAssistedCompanyId("/catalogo", assistedCompanyId)}>
            <ArrowLeft className="size-4" />
            {tx(t, "storefront.product.backToCatalog", "Torna al catalogo")}
          </Link>
        </Button>

        <div className="grid gap-2 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,460px)_minmax(0,1fr)]">
          <Card className="rounded-lg border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.045)] lg:sticky lg:top-24 lg:self-start">
            <CardContent className="p-2">
              <StorefrontProductImage
                product={product}
                sizes="(max-width: 1024px) 100vw, 420px"
                quality={88}
                priority
                className="min-h-[220px] rounded-lg bg-slate-50 sm:min-h-[300px] lg:min-h-[390px] xl:min-h-[430px]"
                imageClassName="object-contain p-3"
              />
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
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
                    className="min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
                  >
                    <div className="text-[11px] font-bold uppercase text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-black text-slate-700">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <section className="min-w-0 space-y-2">
            <Card className="rounded-lg border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.045)]">
              <CardContent className="p-3 md:p-3.5">
                <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)] xl:items-start">
                  <div className="min-w-0">
                    <h1 className="break-words text-2xl font-black leading-[1.05] tracking-normal sm:text-[1.8rem] xl:text-[2rem]">
                      {product.name}
                    </h1>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-xs text-slate-500">
                      <Barcode className="size-3.5 shrink-0" />
                      <span className="truncate">{product.sku}</span>
                    </p>
                    <div className="mt-2 flex max-h-[58px] flex-wrap gap-1.5 overflow-hidden">
                      {product.compatibleWith.map((model) => (
                        <span
                          key={model}
                          className="max-w-full truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700"
                          title={model}
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/20 bg-primary/8 p-2.5 text-xs text-slate-700">
                    {showWholesalePrice && hasBuyerPrice ? (
                      <div className="flex min-w-0 flex-wrap items-end gap-2">
                        <div className="text-2xl font-black leading-none text-slate-950">
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
                  </div>
                </div>

                {shouldShowPurchasePanel ? (
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

                <div className="mt-2 border-t border-slate-100 pt-2">
                  <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                    <h2 className="truncate text-sm font-black text-slate-950">
                      Dettagli rapidi
                    </h2>
                    <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                      SKU {product.sku}
                    </span>
                  </div>
                  <div className="grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                    <Spec label="Brand" value={localizedBrand} />
                    <Spec label="Categoria" value={localizedCategory} />
                    <Spec label="IVA" value={`${product.vatRate}%`} />
                    <Spec label="RMA" value={`${product.rmaDays} giorni`} />
                    <Spec
                      label={tx(t, "storefront.product.detail.invoice", "Fattura")}
                      value={tx(
                        t,
                        "storefront.product.detail.invoiceText",
                        "PEC / Codice Destinatario"
                      )}
                    />
                    <Spec label="Aggiornato" value={product.updatedAt} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
      <div className="truncate text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-xs font-bold text-slate-800">{value}</div>
    </div>
  );
}
