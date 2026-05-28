import Link from "next/link";
import {
  ArrowLeft,
  BadgeEuro,
  Barcode,
  Boxes,
  CheckCircle2,
  Clock,
  FileText,
  Landmark,
  PackageCheck,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  brandLabel,
  categoryLabel,
  leadTimeLabel,
  stockStatusLabel,
  tx,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import { getDictionary, translate } from "@/i18n/get-dictionary";
import { getRequestI18n } from "@/i18n/request";
import type { PartProduct } from "@/lib/partspro-data";
import { inferDeviceModelSeries } from "@/lib/partspro-device-series";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { CustomerActivityTracker } from "./customer-activity-tracker";
import { ProductDetailPurchasePanelSlot } from "./product-detail-purchase-panel-slot";
import { StoreHeader } from "./store-header";
import { StorefrontProductImage } from "./storefront-product-image";

type ProductDetailPageProps = {
  initialAccountAccess?: StoreHeaderAccountAccess;
  priceGateReason?: PriceVisibilityReason;
  product: PartProduct;
  showWholesalePrice?: boolean;
};

export async function ProductDetailPage({
  initialAccountAccess,
  priceGateReason = "login_required",
  product,
  showWholesalePrice = false,
}: ProductDetailPageProps) {
  const { locale } = await getRequestI18n();
  const dictionary = getDictionary(locale);
  const t: StorefrontTranslator = (key) => translate(dictionary, key);
  const hasBuyerPrice = product.price > 0;
  const hiddenPriceCopy = productDetailPriceGateCopy(t, priceGateReason);
  const isReviewPriceVisible =
    showWholesalePrice && priceGateReason === "customer_needs_assignment";
  const primaryModel = product.compatibleWith[0] ?? null;
  const modelSeries = inferDeviceModelSeries(product.brand, primaryModel);
  const localizedBrand = brandLabel(t, product.brand);
  const localizedCategory = categoryLabel(t, product.category);
  const localizedLeadTime = leadTimeLabel(t, product.leadTime);
  const localizedStockStatus = stockStatusLabel(t, product.status);

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
      <StoreHeader initialAccountAccess={initialAccountAccess} />
      <div className="mx-auto max-w-[1500px] px-3 py-4 sm:px-4 sm:py-6">
        <Button variant="ghost" asChild className="mb-3">
          <Link href="/catalogo">
            <ArrowLeft className="size-4" />
            {tx(t, "storefront.product.backToCatalog", "Torna al catalogo")}
          </Link>
        </Button>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <Card className="rounded-lg border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] lg:sticky lg:top-32 lg:self-start">
            <CardContent className="p-3 sm:p-4">
              <StorefrontProductImage
                product={product}
                sizes="(max-width: 1024px) 100vw, 42vw"
                quality={88}
                priority
                className="min-h-[260px] rounded-lg bg-slate-50 sm:min-h-[360px] lg:min-h-[460px]"
                imageClassName="object-contain p-5"
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
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
                    className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="text-[11px] font-bold uppercase text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-1 truncate text-xs font-black text-slate-700">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <Card className="rounded-lg border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-wrap gap-2">
                  <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">
                    {localizedStockStatus}
                  </Badge>
                  <Badge variant="outline">{product.grade}</Badge>
                </div>
                <h1 className="mt-4 break-words text-2xl font-black tracking-normal sm:text-3xl md:text-5xl">
                  {product.name}
                </h1>
                <p className="mt-2 flex min-w-0 items-center gap-2 font-mono text-sm text-slate-500">
                  <Barcode className="size-4 shrink-0" />
                  <span className="truncate">{product.sku}</span>
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {product.compatibleWith.map((model) => (
                    <span
                      key={model}
                      className="max-w-full truncate rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700"
                      title={model}
                    >
                      {model}
                    </span>
                  ))}
                </div>

                <Separator className="my-5" />

                <div className="rounded-lg border border-primary/20 bg-primary/8 p-4 text-sm text-slate-700">
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
                  <p className="mt-2 leading-6">
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

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      icon: PackageCheck,
                      label: "Stock",
                      value: `${product.stock} pezzi`,
                      text: localizedStockStatus,
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
                      className="min-w-0 rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                        <item.icon className="size-3.5" />
                        {item.label}
                      </div>
                      <div className="mt-1 truncate text-sm font-black text-slate-800">
                        {item.value}
                      </div>
                      <div className="truncate text-xs text-slate-500">{item.text}</div>
                    </div>
                  ))}
                </div>

                {showWholesalePrice && hasBuyerPrice ? (
                  <ProductDetailPurchasePanelSlot product={product} />
                ) : showWholesalePrice ? (
                  <Card className="mt-3 border-amber-200 bg-amber-50/60">
                    <CardContent className="flex flex-col gap-3 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-black">
                          {tx(
                            t,
                            "storefront.product.detail.noPriceTitle",
                            "Prezzo non impostato"
                          )}
                        </div>
                        <p className="mt-1 leading-6">
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
                  <Card className="mt-3 border-primary/20 bg-white">
                    <CardContent className="flex flex-col gap-3 p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-black text-slate-950">{hiddenPriceCopy.cardTitle}</div>
                        <p className="mt-1 leading-6">{hiddenPriceCopy.cardDescription}</p>
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

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Truck,
                  label: localizedLeadTime,
                  text: tx(
                    t,
                    "storefront.product.detail.trackedDelivery",
                    "Consegna tracciata in Italia"
                  ),
                },
                { icon: ShieldCheck, label: `${product.rmaDays} giorni RMA`, text: "Reso gestito da account" },
                { icon: PackageCheck, label: `${product.stock} pezzi`, text: localizedStockStatus },
                {
                  icon: FileText,
                  label: tx(t, "storefront.product.detail.invoice", "Fattura"),
                  text: tx(
                    t,
                    "storefront.product.detail.invoiceText",
                    "PEC / Codice Destinatario"
                  ),
                },
              ].map((item) => (
                <Card key={item.label} className="rounded-lg border-slate-200 bg-white">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <item.icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-black">{item.label}</div>
                      <div className="truncate text-xs text-slate-500">{item.text}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <Card className="rounded-lg border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Dettagli tecnici</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
              <Spec label="Brand" value={localizedBrand} />
              <Spec label="Categoria" value={localizedCategory} />
              <Spec label="Qualità" value={product.grade} />
              <Spec label="Aliquota IVA" value={`${product.vatRate}%`} />
              <Spec label="Ultimo aggiornamento" value={product.updatedAt} />
            </CardContent>
          </Card>
          <Card className="rounded-lg border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>
                {tx(
                  t,
                  "storefront.product.detail.customerConditions",
                  "Condizioni cliente"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow
                icon={Landmark}
                label="Partita IVA"
                value="Prezzo riservato ad account verificati"
              />
              <InfoRow
                icon={FileText}
                label="Fattura elettronica"
                value="PEC o Codice Destinatario in checkout"
              />
              <InfoRow
                icon={ShieldCheck}
                label="Garanzia RMA"
                value={`${product.rmaDays} giorni con lotto tracciato`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="rounded-lg border-slate-200 bg-white lg:col-span-2">
            <CardHeader>
              <CardTitle>Logistica e documenti</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <Spec label="DDT" value="Incluso in spedizione" />
              <Spec label="Imballo" value="Antistatico + blister" />
              <Spec label="Supporto" value="RMA da account" />
            </CardContent>
          </Card>
          <Card className="rounded-lg border-slate-200 bg-white">
            <CardHeader>
              <CardTitle>Checklist qualità</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["Test funzionale", "Controllo estetico", "Imballo antistatico", "Seriale lotto tracciato"].map(
                (item) => (
                  <div key={item} className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    {item}
                  </div>
                )
              )}
              <div className="flex items-center gap-2 pt-2 text-xs text-slate-500">
                <Clock className="size-4" />
                Aggiornato in tempo reale dal magazzino
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function productDetailPriceGateCopy(
  t: StorefrontTranslator,
  reason: PriceVisibilityReason
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
    actionHref: "/login?next=/catalogo",
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
      "Accedi per vedere prezzo, quantità minime, sconti livello e condizioni di pagamento."
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
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 font-bold text-slate-800">{value}</div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-black text-slate-800">{label}</div>
        <div className="mt-0.5 text-xs leading-5 text-slate-500">{value}</div>
      </div>
    </div>
  );
}
