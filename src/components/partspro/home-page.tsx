"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Battery,
  Bell,
  Camera,
  Cable,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Grid3X3,
  Lock,
  MessageCircle,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Truck,
  User,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  categories,
  products,
  brands,
  mobilaxAppleParts,
  type PartProduct,
  formatEuro,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { PartsProLogo } from "./logo";
import { PartVisual } from "./part-visual";
import { LanguageSwitcher } from "./language-switcher";
import { StoreMobileMenu } from "./store-mobile-menu";
import { useT } from "./i18n-provider";
import { useCart } from "./cart-state";
import {
  categoryLabel,
  tx,
} from "@/i18n/dictionaries/storefront";

const categoryIcons = [Smartphone, Battery, Package, Cable, Camera, Wrench];
const ALL_CATEGORIES = "all";

type HomeCategorySelection = typeof ALL_CATEGORIES | string;

const trustItems = [
  {
    icon: Package,
    titleKey: "storefront.home.trust.italyWarehouse.title",
    titleFallback: "Magazzino Italia",
    valueKey: "storefront.home.trust.italyWarehouse.value",
    valueFallback: "SKU pronti 24/48h",
  },
  {
    icon: ShieldCheck,
    titleKey: "storefront.home.trust.quality.title",
    titleFallback: "Qualità verificata",
    valueKey: "storefront.home.trust.quality.value",
    valueFallback: "QC e lotti tracciati",
  },
  {
    icon: Truck,
    titleKey: "storefront.home.trust.delivery.title",
    titleFallback: "Consegna rapida",
    valueKey: "storefront.home.trust.delivery.value",
    valueFallback: "Corrieri locali",
  },
  {
    icon: MessageCircle,
    titleKey: "storefront.home.trust.support.title",
    titleFallback: "Supporto B2B",
    valueKey: "storefront.home.trust.support.value",
    valueFallback: "Ordini e RMA",
  },
  {
    icon: CreditCard,
    titleKey: "storefront.home.trust.invoice.title",
    titleFallback: "Fattura pronta",
    valueKey: "storefront.home.trust.invoice.value",
    valueFallback: "PEC / Codice SDI",
  },
];

export function HomePage() {
  const [selectedCategory, setSelectedCategory] =
    useState<HomeCategorySelection>(ALL_CATEGORIES);

  return (
    <main className="min-h-screen overflow-x-hidden text-slate-950">
      <HomeHeader
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <div className="mx-auto grid w-full max-w-[1500px] min-w-0 grid-cols-[minmax(0,1fr)] gap-2 px-2 py-2 sm:gap-4 sm:px-4 sm:py-4 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_300px]">
        <CategorySidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <div className="min-w-0 space-y-2 sm:space-y-4">
          <HeroSection />
          <TrustBar />
          <ApplePartsShowcase />
          <CategoryShowcase
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <ProductShelf
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
          <PromoBanners />
          <BrandStrip />
        </div>
        <RightRail />
      </div>
    </main>
  );
}

function HomeHeader({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: HomeCategorySelection;
  onSelectCategory: (category: HomeCategorySelection) => void;
}) {
  const t = useT();
  const cart = useCart();

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1500px] min-w-0 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
          <div className="flex min-w-0 shrink-0 items-center gap-2 lg:w-[230px] lg:gap-3">
            <StoreMobileMenu />
            <Link
              href="/"
              aria-label="Torna alla home PartsPro"
              className="hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex"
            >
              <PartsProLogo />
            </Link>
            <Link
              href="/"
              aria-label="Torna alla home PartsPro"
              className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden"
            >
              <PartsProLogo compact />
              <span className="text-base font-black leading-none tracking-normal text-slate-950">
                PartsPro
              </span>
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="hidden h-10 gap-2 bg-white lg:inline-flex"
              >
                <Grid3X3 className="size-4" />
                {tx(t, "storefront.common.categories", "Categorie")}
                <ChevronRight className="size-3.5 rotate-90" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full",
                    selectedCategory === ALL_CATEGORIES && "bg-primary/8 text-primary"
                  )}
                  aria-pressed={selectedCategory === ALL_CATEGORIES}
                  onClick={() => onSelectCategory(ALL_CATEGORIES)}
                >
                  Tutti
                  <span className="ml-auto text-xs text-muted-foreground">
                    {products.length}
                  </span>
                </button>
              </DropdownMenuItem>
              {categories.slice(0, 6).map((category) => (
                <DropdownMenuItem key={category.value} asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-full",
                      selectedCategory === category.label && "bg-primary/8 text-primary"
                    )}
                    aria-pressed={selectedCategory === category.label}
                    onClick={() => onSelectCategory(category.label)}
                  >
                    {categoryLabel(t, category.label)}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {category.count}
                    </span>
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative hidden min-w-0 flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 rounded-lg border-primary/40 bg-white pl-9 shadow-[0_0_0_3px_rgba(59,91,255,0.04)]"
              placeholder={tx(
                t,
                "storefront.home.searchPlaceholder",
                "Cerca prodotto, SKU, brand, modello..."
              )}
            />
          </div>

          <nav className="ml-auto flex shrink-0 items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
              <Link href="/admin">{tx(t, "nav.admin", "Admin")}</Link>
            </Button>
            <LanguageSwitcher compact className="hidden sm:inline-flex" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative hidden sm:inline-flex"
              aria-label={tx(t, "storefront.home.notifications", "Notifiche")}
            >
              <Bell className="size-4" />
              <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              asChild
              className="relative bg-white shadow-sm"
            >
              <Link href="/carrello" aria-label={tx(t, "storefront.header.openCart", "Apri carrello")}>
                <ShoppingCart className="size-4" />
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {cart.itemCount}
                </span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              asChild
              className="bg-white shadow-sm sm:hidden"
            >
              <Link
                href="/account"
                aria-label={tx(t, "storefront.header.openAccount", "Apri account B2B")}
              >
                <User className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild className="hidden h-10 bg-white sm:inline-flex">
              <Link href="/account">{tx(t, "storefront.common.b2bAccount", "Account B2B")}</Link>
            </Button>
          </nav>
        </div>
      </header>
      <div aria-hidden="true" className="h-14 sm:h-16" />
    </>
  );
}

function CategorySidebar({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: HomeCategorySelection;
  onSelectCategory: (category: HomeCategorySelection) => void;
}) {
  const t = useT();

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-2 flex items-center justify-between px-3 py-2">
          <span className="text-sm font-bold">
            {tx(t, "storefront.common.categories", "Categorie")}
          </span>
          <ChevronRight className="size-4 text-slate-400" />
        </div>
        <div className="space-y-1">
          <button
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-slate-700 transition hover:bg-primary hover:text-white",
              selectedCategory === ALL_CATEGORIES &&
                "bg-primary text-white shadow-lg shadow-primary/20"
            )}
            aria-pressed={selectedCategory === ALL_CATEGORIES}
            onClick={() => onSelectCategory(ALL_CATEGORIES)}
          >
            <Grid3X3 className="size-4" />
            <span className="min-w-0 flex-1 truncate">Tutti</span>
            <ChevronRight className="size-3.5 opacity-65" />
          </button>
          {categories.map((category, index) => {
            const Icon = categoryIcons[index % categoryIcons.length];
            const selected = selectedCategory === category.label;

            return (
              <button
                key={category.value}
                type="button"
                className={cn(
                  "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-slate-700 transition hover:bg-primary hover:text-white",
                  selected && "bg-primary text-white shadow-lg shadow-primary/20"
                )}
                aria-pressed={selected}
                onClick={() => onSelectCategory(category.label)}
              >
                <Icon className="size-4" />
                <span className="min-w-0 flex-1 truncate">
                  {categoryLabel(t, category.label)}
                </span>
                <ChevronRight className="size-3.5 opacity-65" />
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function HeroSection() {
  const t = useT();

  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative max-w-full overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(120deg,#edf6ff_0%,#eef0ff_48%,#fff1fa_100%)] px-2.5 py-3 shadow-[0_18px_45px_rgba(59,91,255,0.08)] sm:min-h-[310px] sm:px-6 sm:py-8 md:px-12"
    >
      <div className="relative z-10 max-w-full sm:max-w-xl">
        <Badge className="mb-1.5 h-5 border border-primary/15 bg-white/70 px-1.5 text-[10px] text-primary shadow-sm sm:mb-4 sm:h-auto sm:px-2.5 sm:text-xs">
          {tx(t, "storefront.home.hero.badge", "Forniture B2B Italia")}
        </Badge>
        <h1 className="max-w-[20rem] break-words text-[23px] font-black leading-[1.04] tracking-normal text-slate-950 sm:max-w-lg sm:text-4xl md:text-5xl">
          {tx(t, "storefront.home.hero.titleLine1", "Ricambi smartphone")}
          <span className="block">
            {tx(t, "storefront.home.hero.titleLine2", "per professionisti")}
          </span>
        </h1>
        <p className="mt-1.5 max-w-[21rem] break-words text-xs leading-4 text-slate-600 sm:mt-4 sm:max-w-md sm:text-sm sm:leading-7 md:text-base">
          {tx(
            t,
            "storefront.home.hero.description",
            "Disponibilità locale, prezzi wholesale dopo login, fattura B2B e RMA tracciabile per laboratori e rivenditori italiani."
          )}
        </p>
        <div className="mt-3 grid max-w-[21rem] grid-cols-2 gap-1.5 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
          <Button asChild className="min-h-10 px-2 text-xs leading-tight shadow-lg shadow-primary/24 sm:h-11 sm:px-6 sm:text-sm">
            <Link href="/catalogo" className="whitespace-normal text-center">
              {tx(t, "storefront.home.hero.browseCatalog", "Sfoglia catalogo")}
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            className="min-h-10 bg-white/75 px-2 text-xs leading-tight sm:h-11 sm:px-6 sm:text-sm"
          >
            <Link href="/login?next=/account" className="whitespace-normal text-center">
              {tx(t, "storefront.home.hero.loginForPrices", "Accedi ai prezzi")}
            </Link>
          </Button>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 hidden h-[260px] w-[420px] 2xl:block">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          className="absolute left-10 top-2 w-36 rotate-[-7deg]"
        >
          <PartVisual variant="screen" />
        </motion.div>
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 5.6, ease: "easeInOut" }}
          className="absolute right-8 top-8 w-32 rotate-[8deg]"
        >
          <PartVisual variant="battery" />
        </motion.div>
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ repeat: Infinity, duration: 4.8, ease: "easeInOut" }}
          className="absolute bottom-0 left-48 w-32 rotate-[12deg]"
        >
          <PartVisual variant="flex" />
        </motion.div>
      </div>
    </motion.section>
  );
}

function ApplePartsShowcase() {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-normal text-primary">
            Fonte catalogo Mobilax
          </div>
          <h2 className="mt-1 text-lg font-black sm:text-xl">
            Ricambi Apple reali
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
            Immagini, modelli e ricambi ricavati da schede prodotto pubbliche Mobilax.
          </p>
        </div>
        <Button variant="outline" size="sm" className="bg-white" asChild>
          <a href="https://www.mobilax.com/" target="_blank" rel="noreferrer">
            Mobilax
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {mobilaxAppleParts.map((part) => (
          <Card
            key={part.id}
            className="overflow-hidden border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition hover:border-primary/40"
          >
            <CardContent className="p-0">
              <a
                href={part.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="block min-w-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="relative h-40 overflow-hidden bg-slate-50 sm:h-44">
                  <Image
                    src={part.imageUrl}
                    alt={`${part.part} ${part.model}`}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 16vw"
                    className="object-contain p-4"
                    unoptimized
                  />
                  <Badge className="absolute left-3 top-3 border border-slate-200 bg-white text-slate-700 shadow-sm">
                    Apple
                  </Badge>
                </div>
                <div className="space-y-3 p-3">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold uppercase tracking-normal text-slate-400">
                        Modello
                      </div>
                      <div className="truncate text-sm font-black text-slate-950">
                        {part.model}
                      </div>
                    </div>
                    <ExternalLink className="mt-1 size-4 shrink-0 text-slate-400" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-normal text-slate-400">
                      Ricambio
                    </div>
                    <div className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-800">
                      {part.part}
                    </div>
                  </div>
                  <div className="line-clamp-2 min-h-8 text-xs leading-4 text-slate-500">
                    {part.title}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-500">
                    <span className="min-w-0 truncate">Rif. {part.reference}</span>
                    <span className="shrink-0 text-primary">{part.sourceName}</span>
                  </div>
                </div>
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function TrustBar() {
  const t = useT();

  return (
    <section className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:grid-cols-2 sm:gap-3 sm:p-3 xl:grid-cols-5">
      {trustItems.map((item) => (
        <div key={item.titleKey} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:size-10">
            <item.icon className="size-3.5 sm:size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-bold sm:text-sm">
              {tx(t, item.titleKey, item.titleFallback)}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500 sm:text-xs">
              {tx(t, item.valueKey, item.valueFallback)}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function CategoryShowcase({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: HomeCategorySelection;
  onSelectCategory: (category: HomeCategorySelection) => void;
}) {
  return (
    <section id="categories" className="space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black sm:text-lg">Categorie richieste</h2>
        <Button variant="ghost" size="sm" className="text-primary" asChild>
          <Link href="/catalogo">
            Vedi tutto
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 xl:grid-cols-8">
        {categories.map((category) => {
          const selected = selectedCategory === category.label;

          return (
            <motion.button
              whileHover={{ y: -4 }}
              key={category.value}
              type="button"
              className={cn(
                "min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-center shadow-[0_14px_35px_rgba(15,23,42,0.04)] transition hover:border-primary/40 sm:p-3",
                selected && "border-primary/40 bg-primary/8 text-primary"
              )}
              aria-pressed={selected}
              onClick={() => onSelectCategory(category.label)}
            >
              <PartVisual variant={category.visual} className="mx-auto mb-1.5 w-12 rounded-md sm:mb-2 sm:w-16" />
              <div className="truncate text-xs font-bold sm:text-sm">{category.label}</div>
              <div className="mt-0.5 text-[11px] text-slate-500 sm:mt-1 sm:text-xs">
                {category.count} SKU
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function ProductShelf({
  selectedCategory,
  onSelectCategory,
}: {
  selectedCategory: HomeCategorySelection;
  onSelectCategory: (category: HomeCategorySelection) => void;
}) {
  const selectedProducts = useMemo(
    () =>
      selectedCategory === ALL_CATEGORIES
        ? products.slice(0, 5)
        : products.filter((item) => item.category === selectedCategory),
    [selectedCategory]
  );
  const selectedCategoryMeta = categories.find(
    (category) => category.label === selectedCategory
  );

  return (
    <section id="products" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">
            {selectedCategory === ALL_CATEGORIES
              ? "Prodotti consigliati"
              : selectedCategory}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {selectedCategory === ALL_CATEGORIES
              ? "Ordinati per qualità, disponibilità e rotazione acquisti"
              : `${selectedProducts.length} SKU selezionati su ${selectedCategoryMeta?.count ?? selectedProducts.length}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="text-primary" asChild>
          <Link href="/catalogo">
            Vedi tutto
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>

      <Tabs
        value={selectedCategory}
        onValueChange={onSelectCategory}
        className="w-full"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-10 min-w-max bg-white">
            <TabsTrigger value={ALL_CATEGORIES}>Tutti</TabsTrigger>
            {categories.map((category) => (
              <TabsTrigger key={category.value} value={category.label}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {selectedProducts.length > 0 ? (
          <ProductGrid items={selectedProducts} />
        ) : (
          <Card className="mt-3 border-slate-200 bg-white">
            <CardContent className="p-4 text-sm font-semibold text-slate-500">
              Nessun prodotto disponibile in questa categoria.
            </CardContent>
          </Card>
        )}
      </Tabs>
    </section>
  );
}

function ProductGrid({ items }: { items: PartProduct[] }) {
  return (
    <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {items.map((product) => (
        <motion.div
          key={product.sku}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.16 }}
        >
          <ProductCard product={product} />
        </motion.div>
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: PartProduct }) {
  const cartPath = `/carrello?sku=${encodeURIComponent(product.sku)}&qty=${product.moq}`;
  const canAddToCart =
    product.stock >= Math.max(1, product.moq) && product.status !== "Out of Stock";

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <CardContent className="p-3">
        <div className="relative">
          <PartVisual variant={product.visual} className="h-36" />
          <Badge
            className={cn(
              "absolute left-2 top-2 border text-xs",
              product.grade === "A+" && "border-emerald-200 bg-emerald-50 text-emerald-700",
              product.grade === "A" && "border-cyan-200 bg-cyan-50 text-cyan-700",
              product.grade === "B" && "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            {product.grade}
          </Badge>
        </div>
        <div className="mt-3 min-h-12">
          <div className="line-clamp-2 text-sm font-bold leading-5">{product.name}</div>
          <div className="mt-1 text-xs font-medium text-slate-500">{product.sku}</div>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-1 text-sm font-black text-slate-700">
              <Lock className="size-3.5" />
              Prezzo dopo login
            </div>
            <div className="text-xs text-slate-500">Stock: {product.stock} pz</div>
          </div>
          {canAddToCart ? (
            <Button size="icon" variant="outline" className="text-primary" asChild>
              <Link
                href={cartPath}
                aria-label={`Aggiungi ${product.name} al carrello`}
              >
                <ShoppingCart className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button
              size="icon"
              variant="outline"
              className="text-slate-400"
              disabled
              aria-label={`${product.name} non disponibile per il carrello`}
            >
              <ShoppingCart className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PromoBanners() {
  return (
    <section className="grid gap-3 md:grid-cols-2">
      <div className="relative overflow-hidden rounded-lg border border-indigo-100 bg-[linear-gradient(120deg,#eef2ff,#ffffff)] p-6">
        <div className="max-w-sm">
          <h3 className="text-xl font-black">Nuovi clienti B2B</h3>
          <p className="mt-2 text-sm text-slate-600">Verifica azienda e sblocca listino Pro</p>
          <Button className="mt-5 h-10 px-5" asChild>
            <Link href="/account">Configura account</Link>
          </Button>
        </div>
        <div className="absolute bottom-4 right-5 flex gap-2">
          <div className="size-16 rotate-12 rounded-lg bg-primary/20" />
          <div className="size-12 -rotate-6 rounded-lg bg-emerald-300/45" />
        </div>
      </div>
      <div className="relative overflow-hidden rounded-lg border border-amber-100 bg-[linear-gradient(120deg,#fff7ed,#eef6ff)] p-6">
        <div className="max-w-sm">
          <h3 className="text-xl font-black">Sconti su volumi</h3>
          <p className="mt-2 text-sm text-slate-600">Listini dedicati per laboratori ricorrenti</p>
          <Button variant="outline" className="mt-5 h-10 bg-white px-5" asChild>
            <Link href="/login?next=/account">Scopri di più</Link>
          </Button>
        </div>
        <ShoppingCart className="absolute bottom-6 right-8 size-20 text-amber-400/70" />
      </div>
    </section>
  );
}

function BrandStrip() {
  return (
    <section className="space-y-3 pb-4">
      <h2 className="text-lg font-black">Brand supportati</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {brands.map((brand) => (
          <div
            key={brand}
            className="grid h-16 place-items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-black shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
          >
            {brand}
          </div>
        ))}
      </div>
      <div className="grid rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:grid-cols-4">
        {[
          [String(products.length), "SKU pronti"],
          ["0", "clienti B2B"],
          ["24/48h", "Italia"],
          ["0", "ordini tracciati"],
        ].map(([value, label]) => (
          <div key={label} className="p-3 text-center">
            <div className="text-2xl font-black text-primary">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RightRail() {
  const cart = useCart();
  const totals = cart.totals;
  const visibleLines = totals.lines.slice(0, 3);
  const lineLabel = totals.lines.length === 1 ? "1 riga" : `${totals.lines.length} righe`;

  return (
    <aside className="hidden space-y-4 xl:block">
      <section id="cart" className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-black">Anteprima carrello</h2>
          <Badge className="bg-primary/10 text-primary">{lineLabel}</Badge>
        </div>
        {visibleLines.length > 0 ? (
          <div className="space-y-3">
            {visibleLines.map((line) => (
              <div key={line.sku} className="flex gap-3">
                <PartVisual variant={line.product.visual} className="size-12 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{line.product.name}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{line.sku}</div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-emerald-600">{line.quantity} pz</span>
                    <span className="font-bold text-primary">{formatEuro(line.lineTotal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-500">
            Aggiungi un prodotto per preparare checkout e ordine.
          </div>
        )}
        <Separator className="my-4" />
        <div className="mb-4 flex items-center justify-between text-sm font-bold">
          <span>Subtotale</span>
          <span>{formatEuro(totals.subtotal)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" asChild>
            <Link href="/carrello">Carrello</Link>
          </Button>
          {totals.lines.length === 0 ? (
            <Button disabled>Checkout</Button>
          ) : (
            <Button asChild>
              <Link href="/checkout">Checkout</Link>
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h2 className="mb-4 font-black">Notifiche</h2>
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-500">
          Nessuna notifica disponibile.
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h2 className="mb-3 font-black">Menu utente</h2>
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
            <User className="size-4" />
          </div>
          <div>
            <div className="text-sm font-bold">Account B2B</div>
            <div className="text-xs text-slate-500">Accedi con Supabase</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/account">I miei ordini</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/catalogo">Preferiti</Link>
          </Button>
        </div>
      </section>
    </aside>
  );
}
