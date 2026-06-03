"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Flame,
  Grid3X3,
  PackageCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  categories,
  type DeviceModelGroup,
  type PartProduct,
  type PartVisual as PartVisualType,
} from "@/lib/partspro-data";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { PartVisual } from "./part-visual";
import { CatalogBrandTree } from "./catalog-brand-tree";
import { StoreHeader } from "./store-header";
import { useI18n, useT } from "./i18n-provider";
import {
  brandLabel,
  categoryLabel,
  tx,
  type StorefrontTranslator,
} from "@/i18n/dictionaries/storefront";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import { ProductCard } from "./product-card";

type HomeCategorySummary = {
  count?: number;
  label: string;
  value: string;
  visual: PartVisualType;
};

type HomePageProps = {
  catalogTotal?: number;
  categoryCounts?: Record<string, number | undefined>;
  hotProducts?: PartProduct[];
  initialAccountAccess?: StoreHeaderAccountAccess;
  modelGroups?: readonly DeviceModelGroup[];
  newProducts?: PartProduct[];
  priceGateReason?: PriceVisibilityReason;
  showPrices?: boolean;
  stockedProducts?: PartProduct[];
};

export function HomePage({
  catalogTotal = 0,
  categoryCounts = {},
  hotProducts = [],
  initialAccountAccess,
  modelGroups = [],
  newProducts = [],
  priceGateReason = "login_required",
  showPrices = false,
  stockedProducts = [],
}: HomePageProps) {
  const t = useT();
  const categorySummaries = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        count: categoryCounts[category.value],
      })),
    [categoryCounts]
  );

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f4f6fa] text-slate-950">
      <StoreHeader
        initialAccountAccess={initialAccountAccess}
        modelGroups={modelGroups}
        prefetchCatalogLinks
      />
      <div className="mx-auto grid w-full max-w-[1500px] min-w-0 grid-cols-[minmax(0,1fr)] gap-3 px-2 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <CategorySidebar modelGroups={modelGroups} />
        <div className="min-w-0 space-y-4">
          <HomeCatalogHeader
            catalogTotal={catalogTotal}
            modelGroupCount={modelGroups.length}
          />
          <ProductShelf
            actionHref="/catalogo?minStock=1"
            actionLabel={tx(t, "storefront.home.common.viewAll", "Vedi tutto")}
            emptyKey="storefront.home.hot.empty"
            emptyFallback="Non ci sono ancora vendite recenti. Sfoglia il catalogo disponibile."
            eyebrowKey="storefront.home.hot.eyebrow"
            eyebrowFallback="Vendite recenti"
            icon={Flame}
            id="hot-products"
            priceGateReason={priceGateReason}
            products={hotProducts}
            showPrices={showPrices}
            titleKey="storefront.home.hot.title"
            titleFallback="Prodotti più richiesti"
          />
          <ProductShelf
            actionHref="/catalogo"
            actionLabel={tx(t, "storefront.home.common.viewAll", "Vedi tutto")}
            emptyKey="storefront.home.new.empty"
            emptyFallback="Non ci sono nuovi prodotti da mostrare in questo momento."
            eyebrowKey="storefront.home.new.eyebrow"
            eyebrowFallback="Arrivi catalogo"
            icon={Sparkles}
            id="new-products"
            priceGateReason={priceGateReason}
            products={newProducts}
            showPrices={showPrices}
            titleKey="storefront.home.new.title"
            titleFallback="Nuovi prodotti"
          />
          <ProductShelf
            actionHref="/catalogo?minStock=1"
            actionLabel={tx(t, "storefront.home.products.action", "Disponibili ora")}
            emptyKey="storefront.home.products.empty"
            emptyFallback="Il catalogo pubblico non è disponibile in questo momento. Puoi comunque aprire il catalogo o accedere per verificare il listino."
            eyebrowKey="storefront.home.products.eyebrow"
            eyebrowFallback="Stock reale"
            icon={PackageCheck}
            id="stocked-products"
            priceGateReason={priceGateReason}
            products={stockedProducts}
            showPrices={showPrices}
            titleKey="storefront.home.products.title"
            titleFallback="Ricambi disponibili ora"
          />
          <CategoryShowcase categories={categorySummaries} />
          <BrandModelStrip catalogTotal={catalogTotal} modelGroups={modelGroups} />
        </div>
      </div>
    </main>
  );
}

function CategorySidebar({ modelGroups }: { modelGroups?: readonly DeviceModelGroup[] }) {
  const t = useT();
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
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

function HomeCatalogHeader({
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
      : tx(t, "storefront.home.hero.catalogFallback", "Catalogo professionale");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Badge className="mb-2 border border-primary/15 bg-primary/8 text-primary shadow-sm">
            {tx(t, "storefront.home.shelves.badge", "Catalogo prodotti")}
          </Badge>
          <h1 className="break-words text-2xl font-black leading-tight tracking-normal text-slate-950 sm:text-3xl">
            {tx(t, "storefront.home.shelves.title", "Prodotti pronti per l'acquisto")}
          </h1>
          <div className="mt-3 flex min-w-0 flex-wrap gap-2 text-xs font-bold text-slate-500">
            <span className="rounded-md bg-slate-50 px-2 py-1">
              {skuLabel} {tx(t, "storefront.home.hero.stats.sku", "SKU nel catalogo")}
            </span>
            <span className="rounded-md bg-slate-50 px-2 py-1">
              {modelGroupCount > 0 ? modelGroupCount : "8+"}{" "}
              {tx(t, "storefront.home.hero.stats.brands", "brand e famiglie")}
            </span>
            <span className="rounded-md bg-slate-50 px-2 py-1">
              24/48h {tx(t, "storefront.home.brands.stats.delivery", "Italia")}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <Button asChild className="h-10 px-4 shadow-sm shadow-primary/15">
            <Link href="/catalogo">
              {tx(t, "storefront.home.hero.browseCatalog", "Sfoglia catalogo")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild className="h-10 bg-white px-4">
            <Link href="/catalogo?minStock=1">
              {tx(t, "storefront.home.header.availableOnly", "Solo disponibili")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ProductShelf({
  actionHref,
  actionLabel,
  emptyFallback,
  emptyKey,
  eyebrowFallback,
  eyebrowKey,
  icon: Icon,
  id,
  priceGateReason,
  products,
  showPrices,
  titleFallback,
  titleKey,
}: {
  actionHref: string;
  actionLabel: string;
  emptyFallback: string;
  emptyKey: string;
  eyebrowFallback: string;
  eyebrowKey: string;
  icon: LucideIcon;
  id: string;
  priceGateReason: PriceVisibilityReason;
  products: PartProduct[];
  showPrices: boolean;
  titleFallback: string;
  titleKey: string;
}) {
  const t = useT();

  return (
    <section id={id} className="space-y-2">
      <SectionHeader
        actionHref={actionHref}
        actionLabel={actionLabel}
        eyebrow={tx(t, eyebrowKey, eyebrowFallback)}
        icon={Icon}
        title={tx(t, titleKey, titleFallback)}
      />
      {products.length > 0 ? (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product, index) => (
            <ProductCard
              key={`${id}-${product.sku}`}
              priceGateReason={priceGateReason}
              priorityImage={index < 4}
              product={product}
              showWholesalePrice={showPrices}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-500">
          {tx(t, emptyKey, emptyFallback)}
        </div>
      )}
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
            catalogTotal > 0 ? new Intl.NumberFormat(locale).format(catalogTotal) : "Pro",
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

function SectionHeader({
  actionHref,
  actionLabel,
  eyebrow,
  icon: Icon,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  eyebrow: string;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
            <Icon className="size-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="mb-0.5 text-[11px] font-black uppercase tracking-normal text-primary">
            {eyebrow}
          </div>
          <h2 className="break-words text-xl font-black tracking-normal text-slate-950 sm:text-2xl">
            {title}
          </h2>
        </div>
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
