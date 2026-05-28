"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Grid3X3,
  MessageCircle,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  categories,
  formatEuro,
  type DeviceModelGroup,
  type PartProduct,
  type PartVisual as PartVisualType,
} from "@/lib/partspro-data";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { getProductImageCandidates } from "@/lib/partspro-product-images";
import { translateText } from "@/i18n/dictionaries/auto-translate";
import { PartVisual } from "./part-visual";
import { CatalogBrandTree } from "./catalog-brand-tree";
import { StoreHeader } from "./store-header";
import { useI18n, useT } from "./i18n-provider";
import {
  brandLabel,
  categoryLabel,
  leadTimeLabel,
  stockStatusLabel,
  tx,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";

type HomeCategorySummary = {
  count?: number;
  label: string;
  value: string;
  visual: PartVisualType;
};

type HomePageProps = {
  catalogTotal?: number;
  categoryCounts?: Record<string, number | undefined>;
  featuredProducts?: PartProduct[];
  initialAccountAccess?: StoreHeaderAccountAccess;
  modelGroups?: readonly DeviceModelGroup[];
  priceGateReason?: PriceVisibilityReason;
};

const trustItems = [
  {
    icon: Warehouse,
    titleKey: "storefront.home.trust.localStock.title",
    titleFallback: "Stock locale",
    valueKey: "storefront.home.trust.localStock.value",
    valueFallback: "Disponibilità aggiornata per SKU e modello",
  },
  {
    icon: ShieldCheck,
    titleKey: "storefront.home.trust.quality.title",
    titleFallback: "Qualità verificata",
    valueKey: "storefront.home.trust.quality.value",
    valueFallback: "Gradi, lotti e controlli pre-spedizione",
  },
  {
    icon: Truck,
    titleKey: "storefront.home.trust.delivery.title",
    titleFallback: "Logistica Italia",
    valueKey: "storefront.home.trust.delivery.value",
    valueFallback: "24/48h sui ricambi disponibili",
  },
  {
    icon: FileText,
    titleKey: "storefront.home.trust.invoice.title",
    titleFallback: "Fattura B2B",
    valueKey: "storefront.home.trust.invoice.value",
    valueFallback: "PEC, Codice SDI e dati aziendali",
  },
  {
    icon: MessageCircle,
    titleKey: "storefront.home.trust.support.title",
    titleFallback: "RMA tracciabile",
    valueKey: "storefront.home.trust.support.value",
    valueFallback: "Assistenza post-vendita per laboratori",
  },
];

const workflowItems = [
  {
    icon: Search,
    titleKey: "storefront.home.workflow.catalog.title",
    titleFallback: "Trova il ricambio",
    textKey: "storefront.home.workflow.catalog.text",
    textFallback: "Filtra per brand, modello, categoria e disponibilità reale.",
  },
  {
    icon: BadgeCheck,
    titleKey: "storefront.home.workflow.account.title",
    titleFallback: "Verifica il profilo cliente",
    textKey: "storefront.home.workflow.account.text",
    textFallback: "Accedi o richiedi approvazione per vedere prezzi e condizioni.",
  },
  {
    icon: ShoppingCart,
    titleKey: "storefront.home.workflow.order.title",
    titleFallback: "Prepara l'ordine",
    textKey: "storefront.home.workflow.order.text",
    textFallback: "Aggiungi MOQ, conferma IVA e spedizione, poi invia l'ordine.",
  },
  {
    icon: ClipboardCheck,
    titleKey: "storefront.home.workflow.afterSales.title",
    titleFallback: "Gestisci RMA e documenti",
    textKey: "storefront.home.workflow.afterSales.text",
    textFallback: "Segui richieste, fatture e storico direttamente dall'account.",
  },
];

const HomeRightRail = dynamic(
  () => import("./home-right-rail").then((module) => module.HomeRightRail),
  {
    loading: () => <aside aria-hidden="true" className="hidden xl:block" />,
    ssr: false,
  }
);

export function HomePage({
  catalogTotal = 0,
  categoryCounts = {},
  featuredProducts = [],
  initialAccountAccess,
  modelGroups = [],
  priceGateReason = "login_required",
}: HomePageProps) {
  const categorySummaries = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        count: categoryCounts[category.value],
      })),
    [categoryCounts]
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader
        initialAccountAccess={initialAccountAccess}
        modelGroups={modelGroups}
        prefetchCatalogLinks
      />
      <div className="mx-auto grid w-full max-w-[1500px] min-w-0 grid-cols-[minmax(0,1fr)] gap-3 px-2 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_300px]">
        <CategorySidebar modelGroups={modelGroups} />
        <div className="min-w-0 space-y-5">
          <HeroSection
            catalogTotal={catalogTotal}
            modelGroupCount={modelGroups.length}
          />
          <TrustBar />
          <WorkflowSection />
          <CategoryShowcase categories={categorySummaries} />
          <ProductPreview priceGateReason={priceGateReason} products={featuredProducts} />
          <BrandModelStrip catalogTotal={catalogTotal} modelGroups={modelGroups} />
        </div>
        <HomeRightRail />
      </div>
    </main>
  );
}

function CategorySidebar({ modelGroups }: { modelGroups?: readonly DeviceModelGroup[] }) {
  const t = useT();
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-black">
              {tx(t, "storefront.home.sidebar.title", "Catalogo rapido")}
            </h2>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
              {tx(t, "storefront.home.sidebar.subtitle", "Brand e modelli")}
            </p>
          </div>
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
            <Grid3X3 className="size-4" />
          </div>
        </div>
        <CatalogBrandTree
          expandedBrand={expandedBrand}
          idPrefix="home-desktop-catalog"
          modelGroups={modelGroups}
          onExpandedBrandChange={setExpandedBrand}
          prefetchCatalogLinks
          showAvailableLink
          variant="desktop"
        />
      </div>
    </aside>
  );
}

function HeroSection({
  catalogTotal,
  modelGroupCount,
}: {
  catalogTotal: number;
  modelGroupCount: number;
}) {
  const t = useT();
  const { locale } = useI18n();
  const skuLabel =
    catalogTotal > 0
      ? new Intl.NumberFormat(locale).format(catalogTotal)
      : tx(t, "storefront.home.hero.catalogFallback", "Catalogo B2B");

  return (
    <section className="relative max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] sm:px-6 sm:py-7 md:px-9">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)] lg:items-center">
        <div className="relative z-10 min-w-0">
          <Badge className="mb-3 border border-primary/15 bg-primary/8 text-primary shadow-sm">
            {tx(t, "storefront.home.hero.badge", "Forniture B2B Italia")}
          </Badge>
          <h1 className="max-w-3xl break-words text-[30px] font-black leading-[1.03] tracking-normal text-slate-950 sm:text-5xl">
            {tx(t, "storefront.home.hero.title", "Ricambi smartphone per laboratori e rivenditori")}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            {tx(
              t,
              "storefront.home.hero.description",
              "PartsPro unisce catalogo B2B, disponibilità locale, prezzi riservati, fatturazione elettronica e RMA tracciabile in un unico flusso per il mercato italiano."
            )}
          </p>
          <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
            <Button asChild className="h-11 px-5 shadow-lg shadow-primary/20">
              <Link href="/catalogo">
                {tx(t, "storefront.home.hero.browseCatalog", "Sfoglia catalogo")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-11 bg-white px-5">
              <Link href="/login?next=/account">
                {tx(t, "storefront.home.hero.loginForPrices", "Accedi ai prezzi")}
              </Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              {
                value: skuLabel,
                label: tx(t, "storefront.home.hero.stats.sku", "SKU nel catalogo"),
              },
              {
                value: modelGroupCount > 0 ? String(modelGroupCount) : "8+",
                label: tx(t, "storefront.home.hero.stats.brands", "brand e famiglie"),
              },
              {
                value: "24/48h",
                label: tx(t, "storefront.home.hero.stats.delivery", "logistica Italia"),
              },
            ].map((item) => (
              <div key={item.label} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="truncate text-lg font-black text-primary">{item.value}</div>
                <div className="truncate text-[11px] font-semibold text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[240px] overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="grid h-full grid-cols-2 gap-3">
            <PartVisual variant="screen" className="self-start rounded-md" />
            <PartVisual variant="battery" className="mt-8 rounded-md" />
            <PartVisual variant="camera" className="-mt-6 rounded-md" />
            <PartVisual variant="flex" className="self-end rounded-md" />
          </div>
          <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/70 bg-white/90 p-3 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-black text-slate-900">
              <CheckCircle2 className="size-4 text-emerald-600" />
              {tx(t, "storefront.home.hero.visualTitle", "Catalogo operativo, non vetrina statica")}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {tx(
                t,
                "storefront.home.hero.visualText",
                "SKU, stock, MOQ e compatibilità sono pensati per acquisti ricorrenti."
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const t = useT();

  return (
    <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {trustItems.map((item) => (
        <div
          key={item.titleKey}
          className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
            <item.icon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black leading-5">
              {tx(t, item.titleKey, item.titleFallback)}
            </div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {tx(t, item.valueKey, item.valueFallback)}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function WorkflowSection() {
  const t = useT();

  return (
    <section className="space-y-3">
      <SectionHeader
        actionHref="/account"
        actionLabel={tx(t, "storefront.home.workflow.action", "Apri account")}
        eyebrow={tx(t, "storefront.home.workflow.eyebrow", "Flusso B2B")}
        title={tx(t, "storefront.home.workflow.title", "Dalla ricerca al post-vendita senza passaggi manuali")}
      />
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {workflowItems.map((item, index) => (
          <div
            key={item.titleKey}
            className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-950 text-white">
                {index + 1}
              </span>
              <item.icon className="size-5 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-black">
              {tx(t, item.titleKey, item.titleFallback)}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {tx(t, item.textKey, item.textFallback)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CategoryShowcase({ categories: items }: { categories: HomeCategorySummary[] }) {
  const t = useT();
  const { locale } = useI18n();

  return (
    <section id="categories" className="space-y-3">
      <SectionHeader
        actionHref="/catalogo"
        actionLabel={tx(t, "storefront.home.common.viewAll", "Vedi tutto")}
        eyebrow={tx(t, "storefront.home.categories.eyebrow", "Catalogo")}
        title={tx(t, "storefront.home.categories.title", "Categorie richieste dai laboratori")}
      />
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 xl:grid-cols-8">
        {items.map((category) => (
          <Link
            key={category.value}
            href={`/catalogo?category=${encodeURIComponent(category.value)}`}
            className="group min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-center shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition hover:border-primary/40 sm:p-3"
          >
            <PartVisual
              variant={category.visual}
              className="mx-auto mb-2 w-14 rounded-md transition group-hover:scale-[1.02] sm:w-16"
            />
            <div className="truncate text-xs font-black sm:text-sm">
              {categoryLabel(t, category.label)}
            </div>
            <div className="mt-1 truncate text-[11px] font-semibold text-slate-500 sm:text-xs">
              {formatCount(
                t,
                locale,
                category.count,
                tx(t, "storefront.home.common.catalog", "Catalogo")
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductPreview({
  priceGateReason,
  products,
}: {
  priceGateReason: PriceVisibilityReason;
  products: PartProduct[];
}) {
  const t = useT();

  return (
    <section id="products" className="space-y-3">
      <SectionHeader
        actionHref="/catalogo?minStock=1"
        actionLabel={tx(t, "storefront.home.products.action", "Disponibili ora")}
        eyebrow={tx(t, "storefront.home.products.eyebrow", "Stock reale")}
        title={tx(t, "storefront.home.products.title", "Ricambi pronti da consultare")}
      />
      {products.length > 0 ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {products.slice(0, 8).map((product) => (
            <FeaturedProductCard
              key={product.sku}
              priceGateReason={priceGateReason}
              product={product}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-semibold leading-6 text-slate-500">
          {tx(
            t,
            "storefront.home.products.empty",
            "Il catalogo pubblico non è disponibile in questo momento. Puoi comunque aprire il catalogo o accedere per verificare il listino."
          )}
        </div>
      )}
    </section>
  );
}

function BrandModelStrip({
  catalogTotal,
  modelGroups,
}: {
  catalogTotal: number;
  modelGroups: readonly DeviceModelGroup[];
}) {
  const t = useT();
  const { locale } = useI18n();
  const visibleBrands = modelGroups.slice(0, 8);
  const modelTotal = modelGroups.reduce((total, group) => total + group.models.length, 0);

  return (
    <section className="space-y-3 pb-4">
      <SectionHeader
        actionHref="/catalogo"
        actionLabel={tx(t, "storefront.home.common.openCatalog", "Apri catalogo")}
        eyebrow={tx(t, "storefront.home.brands.eyebrow", "Brand e modelli")}
        title={tx(t, "storefront.home.brands.title", "Navigazione rapida per compatibilità")}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {(visibleBrands.length > 0 ? visibleBrands : fallbackBrands()).map((group) => (
          <Link
            key={group.brand}
            href={`/catalogo?brand=${encodeURIComponent(group.brand)}`}
            title={brandLabel(t, group.brand) === group.brand ? undefined : group.brand}
            className="grid h-16 min-w-0 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-center text-sm font-black shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition hover:border-primary/40 hover:text-primary"
          >
            <span className="max-w-full truncate">{brandLabel(t, group.brand)}</span>
          </Link>
        ))}
      </div>
      <div className="grid rounded-lg border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:grid-cols-4">
        {[
          [
            catalogTotal > 0 ? new Intl.NumberFormat(locale).format(catalogTotal) : "B2B",
            tx(t, "storefront.home.brands.stats.sku", "SKU catalogo"),
          ],
          [
            String(modelGroups.length || visibleBrands.length || 8),
            tx(t, "storefront.home.brands.stats.brands", "brand gestiti"),
          ],
          [
            String(modelTotal || 40),
            tx(t, "storefront.home.brands.stats.models", "modelli indicizzati"),
          ],
          ["24/48h", tx(t, "storefront.home.brands.stats.delivery", "Italia")],
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 p-3 text-center">
            <div className="truncate text-2xl font-black text-primary">{value}</div>
            <div className="mt-1 truncate text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturedProductCard({
  priceGateReason,
  product,
}: {
  priceGateReason: PriceVisibilityReason;
  product: PartProduct;
}) {
  const t = useT();
  const { locale } = useI18n();
  const productPath = `/prodotto/${encodeURIComponent(product.sku)}`;
  const productName = translateText(product.name, locale);
  const productImageAlt = translateText(product.imageAlt ?? product.name, locale);
  const imageCandidates = useMemo(() => getProductImageCandidates(product), [product]);
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const imageUrl = imageCandidates.find((candidate) => !failedImageUrls.includes(candidate));
  const visibleModels = product.compatibleWith.slice(0, 2);
  const extraModels = Math.max(product.compatibleWith.length - visibleModels.length, 0);
  const hasBuyerPrice = product.price > 0;
  const priceGateCopy = homePriceGateCopy(t, priceGateReason, product.moq);
  const isReviewPriceVisible =
    hasBuyerPrice && priceGateReason === "customer_needs_assignment";
  const stockLine = tx(
    t,
    "storefront.home.productCard.stockLine",
    "{status} · {count} pz"
  )
    .replace("{status}", stockStatusLabel(t, product.status))
    .replace("{count}", new Intl.NumberFormat(locale).format(product.stock));
  const extraModelsLabel = tx(
    t,
    "storefront.home.productCard.extraModels",
    "+{count} modelli"
  ).replace("{count}", new Intl.NumberFormat(locale).format(extraModels));

  function markImageFailed(failedUrl: string) {
    setFailedImageUrls((current) =>
      current.includes(failedUrl) ? current : [...current, failedUrl]
    );
  }

  return (
    <article className="grid h-full min-w-0 grid-cols-[104px_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition hover:border-primary/40 sm:flex sm:flex-col sm:p-3">
      <Link
        href={productPath}
        aria-label={tx(t, "storefront.home.productCard.openAria", "Apri scheda prodotto {name}").replace(
          "{name}",
          productName
        )}
        className="relative block h-28 overflow-hidden rounded-md bg-slate-50 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-36 sm:rounded-lg"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={productImageAlt}
            fill
            sizes="(max-width: 640px) 104px, (max-width: 1280px) 50vw, 25vw"
            onError={() => markImageFailed(imageUrl)}
            className="object-contain p-2 sm:p-3"
          />
        ) : (
          <PartVisual variant={product.visual} className="h-full rounded-md sm:rounded-lg" />
        )}
        <Badge className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] border border-primary/15 bg-white/90 px-1.5 py-0.5 text-[10px] text-primary shadow-sm">
          {product.grade}
        </Badge>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={productPath}
          className="line-clamp-2 break-words text-[13px] font-black leading-4 text-slate-950 hover:text-primary sm:text-sm sm:leading-5"
        >
          {productName}
        </Link>
        <div className="mt-1 truncate font-mono text-[10px] text-slate-500 sm:text-xs">
          {product.sku}
        </div>

        <div className="mt-2 grid gap-1.5 text-[11px] font-semibold text-slate-600">
          <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-emerald-700">
            <PackageCheck className="size-3.5 shrink-0" />
            <span className="truncate">{stockLine}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2 py-1">
            <Truck className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{leadTimeLabel(t, product.leadTime)}</span>
          </div>
        </div>

        <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
          {visibleModels.map((model) => (
            <span
              key={model}
              className="max-w-full truncate rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
              title={model}
            >
              {model}
            </span>
          ))}
          {extraModels > 0 && (
            <span className="max-w-full truncate rounded-full bg-primary/8 px-2 py-1 text-[11px] font-bold text-primary">
              {extraModelsLabel}
            </span>
          )}
        </div>

        <div className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="truncate text-xs font-bold text-slate-700">
                {hasBuyerPrice
                  ? formatEuro(product.price)
                  : priceGateCopy.label}
              </div>
              {isReviewPriceVisible ? (
                <Badge className="shrink-0 border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
                  {priceGateCopy.label}
                </Badge>
              ) : null}
            </div>
            <div className="truncate text-[11px] text-slate-500">
              {isReviewPriceVisible
                ? priceGateCopy.hint
                : hasBuyerPrice
                  ? tx(t, "storefront.home.productCard.priceVisibleHint", "IVA escl. · MOQ {moq}").replace(
                    "{moq}",
                    String(product.moq)
                  )
                  : priceGateCopy.hint}
            </div>
          </div>
          <Button size="sm" variant="outline" asChild className="shrink-0 bg-white text-primary">
            <Link href={productPath}>
              {tx(t, "storefront.home.productCard.open", "Apri")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function homePriceGateCopy(
  t: StorefrontTranslator,
  reason: PriceVisibilityReason,
  moq: number
) {
  const moqLabel = String(moq);

  if (reason === "customer_needs_assignment") {
    return {
      label: tx(t, "storefront.home.productCard.pendingPrice", "审核"),
      hint: tx(t, "storefront.home.productCard.pendingHint", "审核中 · MOQ {moq}").replace(
        "{moq}",
        moqLabel
      ),
    };
  }

  if (reason === "wholesale_required") {
    return {
      label: tx(t, "storefront.home.productCard.wholesalePrice", "Listino da abilitare"),
      hint: tx(t, "storefront.home.productCard.wholesaleHint", "MOQ {moq} · verifica cliente").replace(
        "{moq}",
        moqLabel
      ),
    };
  }

  if (reason === "account_sync_failed" || reason === "customer_profile_required") {
    return {
      label: tx(t, "storefront.home.productCard.profilePrice", "Profilo in preparazione"),
      hint: tx(t, "storefront.home.productCard.profileHint", "MOQ {moq} · riprova tra poco").replace(
        "{moq}",
        moqLabel
      ),
    };
  }

  if (reason === "customer_suspended") {
    return {
      label: tx(t, "storefront.home.productCard.suspendedPrice", "Account sospeso"),
      hint: tx(t, "storefront.home.productCard.suspendedHint", "MOQ {moq} · contatta supporto").replace(
        "{moq}",
        moqLabel
      ),
    };
  }

  return {
    label: tx(t, "storefront.home.productCard.loginPrice", "Prezzo dopo login"),
    hint: tx(t, "storefront.home.productCard.priceHint", "MOQ {moq} · login richiesto").replace(
      "{moq}",
      moqLabel
    ),
  };
}

function SectionHeader({
  actionHref,
  actionLabel,
  eyebrow,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="mb-1 text-[11px] font-black uppercase tracking-normal text-primary">
          {eyebrow}
        </div>
        <h2 className="break-words text-xl font-black tracking-normal text-slate-950 sm:text-2xl">
          {title}
        </h2>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0 text-primary" asChild>
        <Link href={actionHref}>
          {actionLabel}
          <ChevronRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function formatCount(
  t: StorefrontTranslator,
  locale: string,
  count: number | undefined,
  fallback: string
) {
  if (count === undefined) {
    return fallback;
  }

  return tx(t, "storefront.home.common.skuCount", "{count} SKU").replace(
    "{count}",
    new Intl.NumberFormat(locale).format(count)
  );
}

function fallbackBrands(): DeviceModelGroup[] {
  return [
    { brand: "Apple", models: [] },
    { brand: "Samsung", models: [] },
    { brand: "Xiaomi", models: [] },
    { brand: "Huawei", models: [] },
    { brand: "Oppo", models: [] },
    { brand: "Honor", models: [] },
    { brand: "Google", models: [] },
    { brand: "OnePlus", models: [] },
  ];
}
