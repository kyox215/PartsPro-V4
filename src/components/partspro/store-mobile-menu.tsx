"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Grid3X3, Home, Menu, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { DeviceModelGroup } from "@/lib/partspro-data";
import { tx } from "@/i18n/dictionaries/storefront";
import { CatalogBrandTree, type CatalogSelection } from "./catalog-brand-tree";
import { LanguageSwitcher } from "./language-switcher";
import { PartsProLogo } from "./logo";
import { useT } from "./i18n-provider";

const storeMobileNavItems = [
  { labelKey: "nav.home", labelFallback: "Home", href: "/", icon: Home },
  { labelKey: "nav.account", labelFallback: "Account", href: "/account", icon: User },
];

type StoreMobileMenuProps = {
  className?: string;
  modelGroups?: readonly DeviceModelGroup[];
  onCatalogSelect?: (selection: CatalogSelection) => void;
  prefetchCatalogLinks?: boolean;
  selectedCatalog?: CatalogSelection;
};

export function StoreMobileMenu({
  className,
  modelGroups,
  onCatalogSelect,
  prefetchCatalogLinks = false,
  selectedCatalog,
}: StoreMobileMenuProps) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(() => pathname.startsWith("/catalogo"));
  const [expandedBrandOverride, setExpandedBrandOverride] = useState<
    string | null | undefined
  >(undefined);
  const catalogActive = pathname === "/catalogo" || pathname.startsWith("/catalogo/");
  const selectedBrand = selectedCatalog?.brand ?? null;
  const expandedBrand =
    expandedBrandOverride === undefined ? selectedBrand : expandedBrandOverride;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen && catalogActive) {
      setCatalogOpen(true);
      setExpandedBrandOverride(undefined);
    }

    if (!nextOpen) {
      setExpandedBrandOverride(undefined);
    }
  }

  function closeMenu() {
    setOpen(false);
    setExpandedBrandOverride(undefined);
  }

  function handleCatalogSelect(selection: CatalogSelection) {
    setExpandedBrandOverride(undefined);
    onCatalogSelect?.(selection);
  }

  function toggleCatalog() {
    setExpandedBrandOverride(undefined);
    setCatalogOpen((current) => {
      return !current;
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn("bg-white shadow-sm lg:hidden", className)}
          aria-label={tx(t, "storefront.header.openMenu", "Apri menu")}
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex h-dvh w-[min(86vw,320px)] max-w-[320px] gap-0 overflow-hidden border-r bg-white p-0 text-slate-950"
      >
        <SheetHeader className="border-b px-4 py-3 pr-12 text-left">
          <div className="min-w-0">
            <PartsProLogo
              tagline={tx(
                t,
                "storefront.logo.tagline",
                "Ricambi smartphone Italia"
              )}
            />
          </div>
          <SheetTitle className="sr-only">
            {tx(t, "storefront.header.mobileMenuTitle", "Menu PartsPro")}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {tx(
              t,
              "storefront.home.mobileMenuDescription",
              "Menu mobile con home, catalogo e account."
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 rounded-lg border-slate-200 bg-slate-50 pl-8 text-sm shadow-none focus-visible:bg-white"
                placeholder={tx(t, "storefront.home.mobileSearch", "Cerca SKU / prodotto")}
              />
            </div>
          </div>
          <nav
            aria-label={tx(t, "storefront.header.mobileMenuTitle", "Menu PartsPro")}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
          >
            <div className="space-y-1 rounded-xl bg-slate-50 p-1">
              {storeMobileNavItems.slice(0, 1).map((item) => {
                const active = pathname === "/";

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
                      active
                        ? "bg-white text-primary shadow-sm"
                        : "text-slate-700 hover:bg-white hover:text-primary"
                    )}
                    onClick={closeMenu}
                  >
                    <item.icon className="size-4" />
                    {tx(t, item.labelKey, item.labelFallback)}
                  </Link>
                );
              })}
              <button
                type="button"
                className={cn(
                  "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition",
                  catalogActive
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-700 hover:bg-white hover:text-primary"
                )}
                aria-expanded={catalogOpen}
                aria-controls="store-mobile-catalog-tree"
                onClick={toggleCatalog}
              >
                <Grid3X3 className="size-4" />
                <span className="min-w-0 flex-1">
                  {tx(t, "nav.catalog", "Catalogo")}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 text-slate-400 transition",
                    catalogOpen && "rotate-180 text-primary"
                  )}
                />
              </button>
              {catalogOpen && (
                <div
                  id="store-mobile-catalog-tree"
                  className="rounded-lg bg-white shadow-sm"
                >
                  <CatalogBrandTree
                    expandedBrand={expandedBrand}
                    idPrefix="store-mobile-catalog"
                    modelGroups={modelGroups}
                    onExpandedBrandChange={setExpandedBrandOverride}
                    onNavigate={onCatalogSelect ? undefined : closeMenu}
                    onSelectCatalog={onCatalogSelect ? handleCatalogSelect : undefined}
                    prefetchCatalogLinks={prefetchCatalogLinks}
                    selectedCatalog={selectedCatalog}
                    showAvailableLink
                  />
                </div>
              )}
              {storeMobileNavItems.slice(1).map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
                      active
                        ? "bg-white text-primary shadow-sm"
                        : "text-slate-700 hover:bg-white hover:text-primary"
                    )}
                    onClick={closeMenu}
                  >
                    <item.icon className="size-4" />
                    {tx(t, item.labelKey, item.labelFallback)}
                  </Link>
                );
              })}
            </div>
          </nav>
          <div className="mt-auto border-t border-slate-100 px-3 py-3">
            <LanguageSwitcher compact className="h-9 shadow-none" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
