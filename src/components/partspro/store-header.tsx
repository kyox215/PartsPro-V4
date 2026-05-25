"use client";

import Link from "next/link";
import {
  PackageCheck,
  PackageSearch,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DeviceModelGroup } from "@/lib/partspro-data";
import type { CatalogSelection } from "./catalog-brand-tree";
import { PartsProLogo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { StoreMobileMenu } from "./store-mobile-menu";
import { useCart } from "./cart-state";
import { useT } from "./i18n-provider";
import { tx } from "@/i18n/dictionaries/storefront";

type StoreHeaderProps = {
  modelGroups?: readonly DeviceModelGroup[];
  onCatalogSelect?: (selection: CatalogSelection) => void;
  selectedCatalog?: CatalogSelection;
};

export function StoreHeader({
  modelGroups,
  onCatalogSelect,
  selectedCatalog,
}: StoreHeaderProps) {
  const t = useT();
  const cart = useCart();
  const availabilitySelection = {
    brand: selectedCatalog?.brand,
    inStockOnly: selectedCatalog?.inStockOnly ? undefined : true,
    model: selectedCatalog?.model,
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1500px] items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
          <StoreMobileMenu
            modelGroups={modelGroups}
            onCatalogSelect={onCatalogSelect}
            selectedCatalog={selectedCatalog}
          />

          <Link
            href="/"
            aria-label="Torna alla home PartsPro"
            className="hidden shrink-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex"
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

          <div className="relative ml-auto hidden min-w-0 flex-1 md:block lg:max-w-xl xl:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="h-10 rounded-full border-primary/25 bg-white pl-9 shadow-[0_0_0_3px_rgba(59,91,255,0.03)]"
              placeholder={tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")}
            />
          </div>

          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {onCatalogSelect ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onCatalogSelect({})}
              >
                <PackageSearch className="size-4" />
                {tx(t, "nav.catalog", "Catalogo")}
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/catalogo">
                  <PackageSearch className="size-4" />
                  {tx(t, "nav.catalog", "Catalogo")}
                </Link>
              </Button>
            )}
            {onCatalogSelect ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => onCatalogSelect(availabilitySelection)}
              >
                <PackageCheck className="size-4" />
                Solo disponibili
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link href="/catalogo?minStock=1">
                  <PackageCheck className="size-4" />
                  Solo disponibili
                </Link>
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href="/account">{tx(t, "nav.account", "Account")}</Link>
            </Button>
          </nav>

          <LanguageSwitcher compact className="hidden md:inline-flex" />

          <Button
            variant="outline"
            size="icon"
            asChild
            className="relative ml-auto bg-white shadow-sm sm:ml-0 sm:w-auto sm:px-2.5"
          >
            <Link href="/carrello" aria-label={tx(t, "storefront.header.openCart", "Apri carrello")}>
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">{tx(t, "nav.cart", "Carrello")}</span>
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {cart.itemCount}
              </span>
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            asChild
            className="bg-white shadow-sm lg:hidden"
          >
            <Link
              href="/account"
              aria-label={tx(t, "storefront.header.openAccount", "Apri account B2B")}
            >
              <User className="size-4" />
            </Link>
          </Button>
        </div>
      </header>
      <div aria-hidden="true" className="h-14 sm:h-16" />
    </>
  );
}
