"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
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
  type DeviceModelGroup,
  type PartProduct,
} from "@/lib/partspro-data";
import type { HomeBanner } from "@/lib/partspro-repository";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { cn } from "@/lib/utils";
import { CatalogBrandTree } from "./catalog-brand-tree";
import { StoreHeader } from "./store-header";
import { useT } from "./i18n-provider";
import {
  tx,
} from "@/i18n/dictionaries/storefront";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import { RoutePendingIndicator } from "./pending-feedback";
import { ProductCard } from "./product-card";

type HomePageProps = {
  catalogTotal?: number;
  homeBanners?: HomeBanner[];
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
  homeBanners = [],
  hotProducts = [],
  initialAccountAccess,
  modelGroups = [],
  newProducts = [],
  priceGateReason = "login_required",
  showPrices = false,
  stockedProducts = [],
}: HomePageProps) {
  const t = useT();

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
          <HomeBannerCarousel
            banners={homeBanners}
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

function HomeBannerCarousel({
  banners,
  catalogTotal,
  modelGroupCount,
}: {
  banners: HomeBanner[];
  catalogTotal: number;
  modelGroupCount: number;
}) {
  const t = useT();
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const hasBanners = banners.length > 0;
  const safeActiveIndex = Math.min(activeIndex, Math.max(0, banners.length - 1));

  function scrollToBanner(index: number) {
    const nextIndex = Math.max(0, Math.min(index, banners.length - 1));
    const track = trackRef.current;

    setActiveIndex(nextIndex);
    track?.scrollTo({
      behavior: "smooth",
      left: nextIndex * track.clientWidth,
    });
  }

  function handleScroll() {
    const track = trackRef.current;

    if (!track || track.clientWidth <= 0) {
      return;
    }

    const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex(Math.max(0, Math.min(nextIndex, banners.length - 1)));
  }

  if (!hasBanners) {
    return (
      <CuttingMachinePoster
        catalogTotal={catalogTotal}
        modelGroupCount={modelGroupCount}
      />
    );
  }

  return (
    <section
      aria-label={tx(t, "storefront.home.banners.label", "Promozioni catalogo")}
      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.05)]"
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={handleScroll}
      >
        {banners.map((banner, index) => (
          <Link
            key={banner.id}
            aria-label={banner.title}
            className="relative block aspect-[4/1] min-h-[86px] w-full min-w-full snap-start bg-slate-50 outline-none transition-transform duration-150 active:scale-[0.995] focus-visible:ring-2 focus-visible:ring-primary sm:min-h-[150px]"
            href={banner.href}
            prefetch
          >
            <Image
              alt={banner.imageAlt}
              className="object-contain"
              fill
              fetchPriority={index === 0 ? "high" : "auto"}
              loading={index === 0 ? "eager" : "lazy"}
              sizes="(min-width: 1024px) 1220px, 100vw"
              src={banner.imageUrl}
              unoptimized
            />
            <span className="pointer-events-none absolute right-2 top-2 grid size-7 place-items-center text-primary drop-shadow-sm">
              <RoutePendingIndicator
                className="size-4"
                label={tx(t, "storefront.navigation.loadingCatalog", "Caricamento catalogo...")}
              />
            </span>
          </Link>
        ))}
      </div>
      {banners.length > 1 && (
        <>
          <Button
            aria-label={tx(t, "storefront.home.banners.previous", "Banner precedente")}
            className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 rounded-full bg-white/90 p-0 text-slate-700 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100 sm:inline-flex"
            onClick={() => scrollToBanner(safeActiveIndex - 1)}
            type="button"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label={tx(t, "storefront.home.banners.next", "Banner successivo")}
            className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 rounded-full bg-white/90 p-0 text-slate-700 opacity-0 shadow-sm transition-opacity hover:bg-white group-hover:opacity-100 sm:inline-flex"
            onClick={() => scrollToBanner(safeActiveIndex + 1)}
            type="button"
            variant="outline"
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-white/80 px-2 py-1 shadow-sm">
            {banners.map((banner, index) => (
              <button
                key={`${banner.id}-dot`}
                aria-label={`${tx(t, "storefront.home.banners.open", "Apri banner")} ${index + 1}`}
                className={cn(
                  "size-1.5 rounded-full bg-slate-300 transition-[width,background-color] duration-150",
                  safeActiveIndex === index && "w-4 bg-primary"
                )}
                onClick={() => scrollToBanner(index)}
                type="button"
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CuttingMachinePoster({
  catalogTotal,
  modelGroupCount,
}: {
  catalogTotal: number;
  modelGroupCount: number;
}) {
  const t = useT();
  const stats = [
    tx(t, "storefront.home.cuttingPoster.database", "2W+ database"),
    tx(t, "storefront.home.cuttingPoster.screen", "Big screen"),
    tx(t, "storefront.home.cuttingPoster.system", "Smart system"),
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
      <div className="grid min-h-[270px] bg-[#f7f4ef] md:min-h-[300px] lg:min-h-[340px] lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
        <div className="relative z-10 flex min-w-0 flex-col justify-center px-4 py-5 text-center sm:px-6 md:text-left lg:px-8">
          <Badge className="mx-auto w-fit border border-primary/15 bg-primary text-primary-foreground shadow-sm md:mx-0">
            {tx(t, "storefront.home.cuttingPoster.badge", "New Generation")}
          </Badge>
          <h1 className="mt-3 max-w-xl text-2xl font-black leading-tight tracking-normal text-slate-950 sm:text-3xl lg:text-4xl">
            {tx(t, "storefront.home.cuttingPoster.title", "Intelligent Film Cutting Machine")}
          </h1>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
            {tx(
              t,
              "storefront.home.cuttingPoster.description",
              "Custom cutting for phone front and back films, smart watches, tablets and other electronic devices."
            )}
          </p>
          <div className="mt-4 flex min-w-0 flex-wrap justify-center gap-2 text-xs font-black text-slate-600 md:justify-start">
            {stats.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-4 flex min-w-0 flex-wrap items-center justify-center gap-3 md:justify-start">
            <Button asChild className="h-9 px-4 shadow-sm shadow-primary/15">
              <Link href="/catalogo">
                {tx(t, "storefront.home.cuttingPoster.action", "Browse catalog")}
                <RoutePendingIndicator
                  className="size-3.5 text-primary-foreground"
                  label={tx(t, "storefront.navigation.loadingCatalog", "Caricamento catalogo...")}
                />
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <div className="text-xs font-bold text-slate-500">
              {catalogTotal.toLocaleString()} SKU · {modelGroupCount || "8+"} brand
            </div>
          </div>
        </div>
        <div className="relative min-h-[170px] overflow-hidden border-t border-white/80 bg-[#efe8de] md:min-h-[220px] lg:min-h-0 lg:border-l lg:border-t-0">
          <Image
            alt={tx(
              t,
              "storefront.home.cuttingPoster.alt",
              "Intelligent film cutting machine poster"
            )}
            className="object-cover object-[center_68%]"
            fill
            priority
            sizes="(min-width: 1024px) 640px, 100vw"
            src="/home/film-cutting-machine-poster.jpg"
          />
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
  const t = useT();

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
          <RoutePendingIndicator
            className="size-3.5 text-primary"
            label={tx(t, "storefront.navigation.loadingCatalog", "Caricamento catalogo...")}
          />
          <ChevronRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
