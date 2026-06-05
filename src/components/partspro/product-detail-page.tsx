import Link from "next/link";
import {
  ArrowLeft,
  BadgeEuro,
  Barcode,
  Boxes,
  Clock,
  PackageCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  brandLabel,
  categoryLabel,
  leadTimeLabel,
  tx,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import { getDictionary, translate } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import { formatEuro, type PartProduct } from "@/lib/partspro-data";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import { inferDeviceModelSeries } from "@/lib/partspro-device-series";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import {
  formatPriceDiscountBadge,
  getProductPriceDisplay,
} from "@/lib/partspro-price-display";
import { publicStockLevelMeta } from "@/lib/partspro-stock-availability";
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
  const hiddenPriceCopy = productDetailPriceGateCopy(t, priceGateReason, productPath);
  const isReviewPriceVisible =
    showWholesalePrice && priceGateReason === "customer_needs_assignment";
  const primaryModel = product.compatibleWith[0] ?? null;
  const modelSeries = inferDeviceModelSeries(product.brand, primaryModel);
  const localizedBrand = brandLabel(t, product.brand);
  const localizedCategory = categoryLabel(t, product.category);
  const localizedLeadTime = leadTimeLabel(t, product.leadTime);
  const stockMeta = publicStockLevelMeta(t, product);

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
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <Button variant="ghost" size="sm" asChild className="mb-2 h-8 px-2">
          <Link href={hrefWithAssistedCompanyId("/catalogo", assistedCompanyId)}>
            <ArrowLeft className="size-4" />
            {tx(t, "storefront.product.backToCatalog", "Torna al catalogo")}
          </Link>
        </Button>

        <div className="grid gap-3 lg:grid-cols-[minmax(340px,0.86fr)_minmax(0,1.14fr)]">
          <Card className="rounded-lg border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.045)] lg:sticky lg:top-24 lg:self-start">
            <CardContent className="p-2.5 sm:p-3">
              <StorefrontProductImage
                product={product}
                sizes="(max-width: 1024px) 100vw, 42vw"
                quality={88}
                priority
                className="min-h-[240px] rounded-lg bg-slate-50 sm:min-h-[320px] lg:min-h-[360px] xl:min-h-[390px]"
                imageClassName="object-contain p-4"
              />
              <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
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
                    className="min-w-0 rounded-md border border-slate-100 bg-slate-50 p-2"
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

          <section className="space-y-3">
            <Card className="rounded-lg border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.045)]">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={stockMeta.className}>
                    {stockMeta.label}
                  </Badge>
                  <Badge variant="outline">{product.grade}</Badge>
                </div>
                <h1 className="mt-2 break-words text-2xl font-black leading-tight tracking-normal sm:text-3xl md:text-[2.15rem]">
                  {product.name}
                </h1>
                <p className="mt-1.5 flex min-w-0 items-center gap-1.5 font-mono text-xs text-slate-500">
                  <Barcode className="size-3.5 shrink-0" />
                  <span className="truncate">{product.sku}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {product.compatibleWith.map((model) => (
                    <span
                      key={model}
                      className="max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
                      title={model}
                    >
                      {model}
                    </span>
                  ))}
                </div>

                <Separator className="my-3" />

                <div className="rounded-lg border border-primary/20 bg-primary/8 p-3 text-xs text-slate-700">
                  <div className="flex items-center gap-2 font-black text-slate-950">
                    <BadgeEuro className="size-4 text-primary" />
                    {showWholesalePrice
                      ? isReviewPriceVisible
                        ? hiddenPriceCopy.title
                        : tx(
                          t,
                          "storefront.product.detail.sessionCustomerVerified",
                          "Sessione cliente verificata"
                        )
                      : hiddenPriceCopy.title}
                  </div>
                  {showWholesalePrice && hasBuyerPrice ? (
                    <div className="mt-2 flex min-w-0 flex-wrap items-end gap-2">
                      <div className="text-2xl font-black leading-none text-slate-950">
                        {formatEuro(product.price)}
                      </div>
                      {priceDisplay.hasDiscount && priceDisplay.basePrice ? (
                        <>
                          <div className="pb-0.5 text-sm font-semibold text-slate-400 line-through">
                            {formatEuro(priceDisplay.basePrice)}
                          </div>
                          <Badge className="mb-0.5 border border-emerald-200 bg-emerald-50 text-emerald-700">
                            {formatPriceDiscountBadge(priceDisplay)}
                          </Badge>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-1.5 leading-5">
                    {isReviewPriceVisible && hasBuyerPrice
                      ? hiddenPriceCopy.description
                      : showWholesalePrice && hasBuyerPrice
                        ? tx(
                          t,
                          "storefront.product.detail.sessionPriceReady",
                          "Prezzo netto, quantità minime e condizioni cliente sono disponibili per questo SKU."
                        )
                      : showWholesalePrice
                        ? tx(
                          t,
                          "storefront.product.detail.sessionPricePending",
                          "Account verificato: il prezzo per questo SKU deve ancora essere aggiornato."
                        )
                        : hiddenPriceCopy.description}
                  </p>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {[
                    {
                      icon: PackageCheck,
                      label: tx(
                        t,
                        "storefront.product.detail.stockLevel",
                        "Disponibilita"
                      ),
                      value: stockMeta.label,
                      text: tx(
                        t,
                        "storefront.product.detail.stockLevelText",
                        "Indicatore senza quantita"
                      ),
                    },
                    {
                      icon: Boxes,
                      label: "MOQ",
                      value: `${product.moq} pz`,
                      text: tx(
                        t,
                        "storefront.product.detail.minimumOrder",
                        "Ordine minimo"
                      ),
                    },
                    {
                      icon: Clock,
                      label: "Lead time",
                      value: localizedLeadTime,
                      text: tx(
                        t,
                        "storefront.product.detail.logisticsEstimate",
                        "Stima logistica"
                      ),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="min-w-0 rounded-md border border-slate-200 bg-white p-2"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400">
                        <item.icon className="size-3.5" />
                        {item.label}
                      </div>
                      <div className="mt-0.5 truncate text-sm font-black text-slate-800">
                        {item.value}
                      </div>
                      <div className="truncate text-xs text-slate-500">{item.text}</div>
                    </div>
                  ))}
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
                            "Listino non abilitato all'ordine"
                          )}
                        </div>
                        <p className="mt-1 leading-5">
                          {tx(
                            t,
                            "storefront.product.detail.priceVisibleOrderLockedDescription",
                            "Il prezzo è disponibile per consultazione, ma checkout e carrello richiedono un cliente professionale abilitato."
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
              </CardContent>
            </Card>

            <Card className="rounded-lg border-slate-200 bg-white">
              <CardContent className="p-3">
                <div className="mb-2 flex min-w-0 items-center justify-between gap-3">
                  <h2 className="truncate text-sm font-black text-slate-950">
                    Dettagli rapidi
                  </h2>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                    SKU {product.sku}
                  </span>
                </div>
                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                  <Spec label="Brand" value={localizedBrand} />
                  <Spec label="Categoria" value={localizedCategory} />
                  <Spec label="Qualità" value={product.grade} />
                  <Spec label="IVA" value={`${product.vatRate}%`} />
                  <Spec label="Lead time" value={localizedLeadTime} />
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
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}

function productDetailPriceGateCopy(
  t: StorefrontTranslator,
  reason: PriceVisibilityReason,
  loginNextPath: string
) {
  if (reason === "customer_needs_assignment") {
    return {
      actionHref: "/account",
      actionLabel: tx(
        t,
        "storefront.product.detail.priceGate.review.actionLabel",
        "Apri account"
      ),
      cardDescription: tx(
        t,
        "storefront.product.detail.priceGate.review.cardDescription",
        "Il tuo account è attivo e può vedere i prezzi. Il team PartsPro completerà la verifica del profilo cliente."
      ),
      cardTitle: tx(
        t,
        "storefront.product.detail.priceGate.review.cardTitle",
        "In revisione"
      ),
      description: tx(
        t,
        "storefront.product.detail.priceGate.review.description",
        "Account in revisione: il prezzo resta visibile mentre PartsPro completa la verifica del profilo cliente."
      ),
      title: tx(t, "storefront.product.detail.priceGate.review.title", "In revisione"),
    };
  }

  if (reason === "wholesale_required") {
    return {
      actionHref: "/account",
      actionLabel: tx(
        t,
        "storefront.product.detail.priceGate.wholesale.actionLabel",
        "Apri account"
      ),
      cardDescription: tx(
        t,
        "storefront.product.detail.priceGate.wholesale.cardDescription",
        "Questo account non è ancora abilitato al listino cliente. Completa la verifica del profilo."
      ),
      cardTitle: tx(
        t,
        "storefront.product.detail.priceGate.wholesale.cardTitle",
        "Listino da abilitare"
      ),
      description: tx(
        t,
        "storefront.product.detail.priceGate.wholesale.description",
        "Accesso rilevato: per questo SKU serve un profilo cliente abilitato."
      ),
      title: tx(
        t,
        "storefront.product.detail.priceGate.wholesale.title",
        "Prezzi riservati ai clienti abilitati"
      ),
    };
  }

  if (reason === "account_sync_failed" || reason === "customer_profile_required") {
    return {
      actionHref: "/account",
      actionLabel: tx(
        t,
        "storefront.product.detail.priceGate.profile.actionLabel",
        "Apri account"
      ),
      cardDescription: tx(
        t,
        "storefront.product.detail.priceGate.profile.cardDescription",
        "La sessione è valida, ma il profilo cliente PartsPro non è ancora collegato correttamente."
      ),
      cardTitle: tx(
        t,
        "storefront.product.detail.priceGate.profile.cardTitle",
        "Profilo in preparazione"
      ),
      description: tx(
        t,
        "storefront.product.detail.priceGate.profile.description",
        "Accesso rilevato: stiamo preparando il profilo cliente necessario per mostrare il listino."
      ),
      title: tx(
        t,
        "storefront.product.detail.priceGate.profile.title",
        "Profilo cliente richiesto"
      ),
    };
  }

  if (reason === "customer_suspended") {
    return {
      actionHref: null,
      actionLabel: null,
      cardDescription: tx(
        t,
        "storefront.product.detail.priceGate.suspended.cardDescription",
        "Il listino è temporaneamente bloccato per questo account. Contatta il team PartsPro."
      ),
      cardTitle: tx(
        t,
        "storefront.product.detail.priceGate.suspended.cardTitle",
        "Account sospeso"
      ),
      description: tx(
        t,
        "storefront.product.detail.priceGate.suspended.description",
        "Accesso rilevato, ma il listino non è disponibile per account sospesi."
      ),
      title: tx(
        t,
        "storefront.product.detail.priceGate.suspended.title",
        "Listino sospeso"
      ),
    };
  }

  return {
    actionHref: `/login?${new URLSearchParams({ next: loginNextPath }).toString()}`,
    actionLabel: tx(
      t,
      "storefront.product.detail.priceGate.login.actionLabel",
      "Accedi"
    ),
    cardDescription: tx(
      t,
      "storefront.product.detail.priceGate.login.cardDescription",
      "Accedi con un account cliente per sbloccare prezzo netto, preventivo e invio al carrello."
    ),
    cardTitle: tx(
      t,
      "storefront.product.detail.priceGate.login.cardTitle",
      "Prezzo protetto"
    ),
    description: tx(
      t,
      "storefront.product.detail.priceGate.login.description",
      "Accedi per vedere prezzo, quantità minime, riduzione livello e condizioni di pagamento."
    ),
    title: tx(
      t,
      "storefront.product.detail.priceGate.login.title",
      "Prezzi riservati agli account verificati"
    ),
  };
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50 p-2">
      <div className="truncate text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-xs font-bold text-slate-800">{value}</div>
    </div>
  );
}
