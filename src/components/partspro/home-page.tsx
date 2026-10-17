"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "./optimized-image";
import Link from "next/link";
import {
  ArrowRight,
  Ellipsis,
  BatteryCharging,
  Cable,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Flame,
  Grid3X3,
  Search,
  PackageCheck,
  MonitorSmartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type CatalogDepartment,
  type CatalogDepartmentGroup,
  type PartProduct,
} from "@/lib/partspro-data";
import type { HomeBanner } from "@/lib/partspro-repository";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { cn } from "@/lib/utils";
import { CatalogBrandTree } from "./catalog-brand-tree";
import { StoreHeader } from "./store-header";
import { useI18n, useT } from "./i18n-provider";
import { useCatalogDirectory } from "./catalog-directory-provider";
import { catalogNodeLabel } from "@/lib/partspro-catalog-directory";
import {
  tx,
  txFormat,
} from "@/i18n/dictionaries/storefront";
import type {
  PriceVisibilityReason,
  StorefrontCartAccess,
} from "@/lib/partspro-account-context";
import { RoutePendingIndicator } from "./pending-feedback";
import { PricingSessionBoundary, QuoteExpiryRefresh } from "./pricing-session-boundary";
import { ProductCard } from "./product-card";

type HomePageProps = {
  departmentGroups: readonly CatalogDepartmentGroup[];
  initialAccountAccess: StoreHeaderAccountAccess;
  banner: ReactNode;
  preorder: ReactNode;
  children: ReactNode;
};

export function HomePage({ departmentGroups, initialAccountAccess, banner, preorder, children }: HomePageProps) {
  const t = useT();
  const { locale } = useI18n();
  const directory = useCatalogDirectory();
  const categoryPriority = ["Schermi", "Batterie", "Connettori"];
  const quickCategories = directory.nodes.filter((node) => node.kind === "category" && node.active)
    .sort((a, b) => (categoryPriority.includes(a.value) ? categoryPriority.indexOf(a.value) : 99) - (categoryPriority.includes(b.value) ? categoryPriority.indexOf(b.value) : 99)).slice(0, 3);
  return (
    <PricingSessionBoundary userId={initialAccountAccess.userId}><main className="pp-home-page min-h-screen overflow-x-clip bg-[#f4f6fa] text-slate-950">
      <StoreHeader departmentGroups={departmentGroups} initialAccountAccess={initialAccountAccess} prefetchCatalogLinks />
      <div className="pp-home-layout">
        <CategorySidebar departmentGroups={departmentGroups} />
        <div className="pp-home-content min-w-0">
          <h1 className="pp-home-mobile-title sr-only">{tx(t,"storefront.reference.mobileTitle","Trova il ricambio giusto")}</h1>
          <form action="/catalogo" className="pp-home-search" role="search"><Search aria-hidden="true"/><input name="q" aria-label={tx(t,"storefront.header.searchFull","Cerca SKU, brand, modello...")} placeholder={tx(t,"storefront.header.searchFull","Cerca SKU, brand, modello...")} /><button type="submit" aria-label={tx(t,"storefront.header.searchSubmit","Cerca")}>{tx(t,"storefront.header.searchSubmit","Cerca")}</button></form>
          <div className="pp-reference-hero-row">
            <section className="pp-reference-hero"><div className="pp-reference-hero-copy"><h1>{tx(t,"storefront.ui.home.title","Trova il ricambio giusto.")}</h1><p>{tx(t,"storefront.ui.home.subtitle","Cerca per brand, modello o SKU e prepara il tuo ordine.")}</p><Button asChild><Link href="/catalogo">{tx(t,"storefront.ux.browseCatalog","Sfoglia catalogo")}<ArrowRight className="size-4"/></Link></Button></div><div className="pp-reference-hero-products" aria-hidden="true"><Image src="/home/reference-display.png" alt="" width={210} height={230}/><Image src="/home/reference-battery.jpg" alt="" width={150} height={170}/><Image src="/home/reference-connector.png" alt="" width={140} height={140}/></div></section>
            <nav className="pp-home-category-links" aria-label={tx(t,"storefront.ui.home.quickLinks","Acquista per categoria")}>
              {quickCategories.map((node) => {const Icon = /scherm|display|screen/i.test(node.value) ? MonitorSmartphone : /batt/i.test(node.value) ? BatteryCharging : Cable;return <Link href={`/catalogo?${new URLSearchParams({category:node.value}).toString()}`} key={node.id}><span className="pp-home-category-icon"><Icon/></span><Image className="pp-home-category-photo" src={/scherm|display|screen/i.test(node.value) ? "/home/reference-display.png" : /batt/i.test(node.value) ? "/home/reference-battery.jpg" : "/home/reference-connector.png"} alt="" width={68} height={70}/><span>{catalogNodeLabel(node,locale)}</span><ChevronRight className="size-4"/></Link>;})}
            </nav>
          </div>
          <section className="pp-home-brands-panel">
            <div><h2>{tx(t,"storefront.reference.chooseBrand","Scegli il brand")}</h2><Link href="/catalogo">{tx(t,"storefront.reference.moreBrands","Altri brand")}<ArrowRight aria-hidden="true"/></Link></div>
            <nav className="pp-home-mobile-brands" aria-label={tx(t,"storefront.home.sidebar.subtitle","Brand e modelli")}>
              {departmentGroups.find(group => group.department === "phone")?.brands.slice(0,2).map(brand=><Link key={brand.brand} href={`/catalogo?${new URLSearchParams({department:"phone",brand:brand.brand}).toString()}`}><span className="pp-home-brand-monogram" aria-hidden="true">{brand.brand.slice(0,2)}</span>{brand.brand}</Link>)}
              <Link href="/catalogo"><span className="pp-home-brand-monogram"><Ellipsis aria-hidden="true"/></span>{tx(t,"storefront.reference.moreBrands","Altri brand")}</Link>
            </nav>
          </section>
          {children}
        </div>
      </div>
      <div className="pp-home-secondary">{preorder}<div className="pp-home-secondary-promotion">{banner}</div></div>
    </main></PricingSessionBoundary>
  );
}

export function HomeReferenceTabs({ hot, fresh, stocked }: {hot: ReactNode; fresh: ReactNode; stocked: ReactNode}) {
  const t = useT();
  const [active,setActive] = useState("hot");
  const tabs = [{id:"hot",label:tx(t,"storefront.reference.hot","Più venduti"),content:hot},{id:"new",label:tx(t,"storefront.reference.new","Novità"),content:fresh},{id:"stock",label:tx(t,"storefront.reference.stock","Disponibili"),content:stocked}];
  return <section className="pp-reference-common"><div className="pp-reference-common-heading"><h2>{tx(t,"storefront.reference.common","Ricambi più richiesti")}</h2><Link href="/catalogo">{tx(t,"storefront.home.common.viewAll","Vedi tutto")}<ArrowRight className="size-4"/></Link></div><div role="tablist" aria-label={tx(t,"storefront.reference.common","Ricambi più richiesti")} className="pp-reference-tabs">{tabs.map(tab=><button key={tab.id} type="button" role="tab" id={`home-tab-${tab.id}`} aria-controls={`home-panel-${tab.id}`} aria-selected={active===tab.id} tabIndex={active===tab.id?0:-1} onKeyDown={event=>{const index=tabs.findIndex(item=>item.id===tab.id);const next=event.key==="ArrowRight"?(index+1)%tabs.length:event.key==="ArrowLeft"?(index+tabs.length-1)%tabs.length:event.key==="Home"?0:event.key==="End"?tabs.length-1:null;if(next!==null){event.preventDefault();setActive(tabs[next].id);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();}}} onClick={()=>setActive(tab.id)}>{tab.label}</button>)}</div>{tabs.map(tab=><div key={tab.id} role="tabpanel" id={`home-panel-${tab.id}`} aria-labelledby={`home-tab-${tab.id}`} hidden={active!==tab.id}>{tab.content}</div>)}</section>;
}

export function HomeProductShelf({ kind, products, cartAccess, priceGateReason, showPrices }: {
  kind: "remax" | "hot" | "new" | "stocked";
  products: PartProduct[];
  cartAccess: StorefrontCartAccess;
  priceGateReason: PriceVisibilityReason;
  showPrices: boolean;
}) {
  const t = useT();
  return (<>
          <QuoteExpiryRefresh products={products} />
          {kind === "remax" && products.length > 0 ? (
            <ProductShelf
              actionHref="/catalogo?brand=REMAX"
              actionLabel={tx(t, "storefront.home.common.viewAll", "Vedi tutto")}
              emptyKey="storefront.home.remax.empty"
              emptyFallback="I preordini REMAX saranno disponibili a breve."
              eyebrowKey="storefront.home.remax.eyebrow"
              eyebrowFallback="Esclusiva PartsPro"
              icon={CalendarClock}
              id="remax-preorders"
              cartAccess={cartAccess}
              priceGateReason={priceGateReason}
              products={products}
              showPrices={showPrices}
              titleKey="storefront.home.remax.title"
              titleFallback="REMAX · Prenota i prossimi arrivi"
              tone="preorder"
            />
          ) : null}
          {kind === "hot" ? (
          <ProductShelf
            actionHref="/catalogo?minStock=1"
            actionLabel={tx(t, "storefront.home.products.action", "Disponibili ora")}
            emptyKey="storefront.home.hot.empty"
            emptyFallback="Non ci sono ancora vendite recenti. Sfoglia il catalogo disponibile."
            eyebrowKey="storefront.home.hot.eyebrow"
            eyebrowFallback="Vendite recenti"
            icon={Flame}
            id="hot-products"
            cartAccess={cartAccess}
            priceGateReason={priceGateReason}
            products={products}
            showPrices={showPrices}
            titleKey="storefront.home.hot.title"
            titleFallback="Prodotti più richiesti"
          />
          ) : null}
          {kind === "new" ? (
          <ProductShelf
            actionHref="/catalogo"
            actionLabel={tx(t, "storefront.ux.browseCatalog", "Sfoglia catalogo")}
            emptyKey="storefront.home.new.empty"
            emptyFallback="Non ci sono nuovi prodotti da mostrare in questo momento."
            eyebrowKey="storefront.home.new.eyebrow"
            eyebrowFallback="Arrivi catalogo"
            icon={Sparkles}
            id="new-products"
            cartAccess={cartAccess}
            priceGateReason={priceGateReason}
            products={products}
            showPrices={showPrices}
            titleKey="storefront.home.new.title"
            titleFallback="Nuovi prodotti"
          />
          ) : null}
          {kind === "stocked" ? (
          <ProductShelf
            actionHref="/catalogo?minStock=1"
            actionLabel={tx(t, "storefront.home.products.action", "Disponibili ora")}
            emptyKey="storefront.home.products.empty"
            emptyFallback="Il catalogo pubblico non è disponibile in questo momento. Puoi comunque aprire il catalogo o accedere per verificare il listino."
            eyebrowKey="storefront.home.products.eyebrow"
            eyebrowFallback="Stock reale"
            icon={PackageCheck}
            id="stocked-products"
            cartAccess={cartAccess}
            priceGateReason={priceGateReason}
            products={products}
            showPrices={showPrices}
            titleKey="storefront.home.products.title"
            titleFallback="Ricambi disponibili ora"
          />
          ) : null}
  </>);
}

export function HomeShelfLoading() {
  const t = useT();
  return (
    <section aria-busy="true" aria-label={t("common.loading")} className="space-y-2">
      <div className="h-10 w-60 rounded-lg bg-slate-200 motion-safe:animate-pulse" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-36 rounded-lg border border-slate-200 bg-white sm:h-72 motion-safe:animate-pulse" />)}
      </div>
    </section>
  );
}

function CategorySidebar({
  departmentGroups,
}: {
  departmentGroups?: readonly CatalogDepartmentGroup[];
}) {
  const t = useT();
  const [expandedDepartment, setExpandedDepartment] =
    useState<CatalogDepartment | null>("phone");
  const [expandedBrandKey, setExpandedBrandKey] = useState<string | null>(null);

  return (
    <aside className="pp-browse-sidebar hidden lg:block">
      <div className="pp-browse-sidebar-surface sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white">
        <div className="pp-sidebar-heading flex items-center justify-between gap-3">
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
          departmentGroups={departmentGroups}
          expandedBrandKey={expandedBrandKey}
          expandedDepartment={expandedDepartment}
          idPrefix="home-desktop-catalog"
          brandLimit={5}
          onExpandedBrandKeyChange={setExpandedBrandKey}
          onExpandedDepartmentChange={setExpandedDepartment}
          prefetchCatalogLinks
          variant="desktop"
        />
      </div>
    </aside>
  );
}

export function HomeBannerCarousel({
  banners,
  catalogBrandCount,
  catalogTotal,
}: {
  banners: HomeBanner[];
  catalogBrandCount: number;
  catalogTotal: ReactNode;
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
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
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
        catalogBrandCount={catalogBrandCount}
        catalogTotal={catalogTotal}
      />
    );
  }

  return (
    <section
      aria-label={tx(t, "storefront.home.banners.label", "Promozioni catalogo")}
      className="pp-home-banner group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
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
            className="pp-banner-arrow absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-0 text-slate-700 shadow-sm hover:bg-white"
            disabled={safeActiveIndex === 0}
            onClick={() => scrollToBanner(safeActiveIndex - 1)}
            type="button"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label={tx(t, "storefront.home.banners.next", "Banner successivo")}
            className="pp-banner-arrow absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-0 text-slate-700 shadow-sm hover:bg-white"
            disabled={safeActiveIndex === banners.length - 1}
            onClick={() => scrollToBanner(safeActiveIndex + 1)}
            type="button"
            variant="outline"
          >
            <ChevronRight className="size-4" />
          </Button>
          <div className="pp-banner-pagination absolute bottom-2 left-1/2 flex -translate-x-1/2 rounded-full bg-white/80 shadow-sm">
            {banners.map((banner, index) => (
              <button
                key={`${banner.id}-dot`}
                aria-label={txFormat(t, "storefront.home.banners.open", "Apri promozione {title}", { title: banner.title || index + 1 })}
                aria-current={safeActiveIndex === index ? "true" : undefined}
                className={cn(
                  "pp-banner-dot",
                  safeActiveIndex === index && "pp-banner-dot-active"
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
  catalogBrandCount,
  catalogTotal,
}: {
  catalogBrandCount: number;
  catalogTotal: ReactNode;
}) {
  const t = useT();
  const stats = [
    tx(t, "storefront.home.cuttingPoster.database", "2W+ database"),
    tx(t, "storefront.home.cuttingPoster.screen", "Big screen"),
    tx(t, "storefront.home.cuttingPoster.system", "Smart system"),
  ];

  return (
    <section className="pp-home-fallback-promotion overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="pp-home-fallback-grid">
        <div className="relative z-10 flex min-w-0 flex-col justify-center px-4 py-5 text-center sm:px-6 md:text-left lg:px-8">
          <Badge className="mx-auto w-fit border border-primary/15 bg-primary text-primary-foreground shadow-sm md:mx-0">
            {tx(t, "storefront.home.cuttingPoster.badge", "New Generation")}
          </Badge>
          <h2 className="pp-home-promotion-title mt-3 max-w-xl font-bold text-slate-950">
            {tx(t, "storefront.home.cuttingPoster.title", "Intelligent Film Cutting Machine")}
          </h2>
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
              <Link href="/help?support=open">
                {tx(t, "storefront.ux.askCuttingMachine", "Chiedi informazioni")}
                <RoutePendingIndicator
                  className="size-3.5 text-primary-foreground"
                  label={tx(t, "storefront.navigation.loadingCatalog", "Caricamento catalogo...")}
                />
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <div className="text-xs font-bold text-slate-500">
              {catalogTotal} SKU · {catalogBrandCount || "8+"} brand
            </div>
          </div>
        </div>
        <div className="relative hidden min-h-[170px] overflow-hidden border-t border-white/80 bg-[#efe8de] sm:block md:min-h-[220px] lg:min-h-0 lg:border-l lg:border-t-0">
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
  cartAccess,
  priceGateReason,
  products,
  showPrices,
  titleFallback,
  titleKey,
  tone = "default",
}: {
  actionHref: string;
  actionLabel: string;
  emptyFallback: string;
  emptyKey: string;
  eyebrowFallback: string;
  eyebrowKey: string;
  icon: LucideIcon;
  id: string;
  cartAccess: StorefrontCartAccess;
  priceGateReason: PriceVisibilityReason;
  products: PartProduct[];
  showPrices: boolean;
  titleFallback: string;
  titleKey: string;
  tone?: "default" | "preorder";
}) {
  const t = useT();

  return (
    <section
      id={id}
      className={cn(
        "pp-home-shelf",
        tone === "preorder" &&
          "pp-home-shelf-preorder"
      )}
    >
      <SectionHeader
        actionHref={actionHref}
        actionLabel={actionLabel}
        eyebrow={tx(t, eyebrowKey, eyebrowFallback)}
        icon={Icon}
        title={tx(t, titleKey, titleFallback)}
      />
      {products.length > 0 ? (
        <div className="pp-home-product-grid">
          {products.slice(0, 4).map((product) => (
            <ProductCard
              key={`${id}-${product.sku}`}
              layout={tone === "preorder" ? "preorder" : "home"}
              cartAccess={cartAccess}
              priceGateReason={priceGateReason}
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
    <div className="pp-shelf-heading flex flex-wrap items-end justify-between gap-3">
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
