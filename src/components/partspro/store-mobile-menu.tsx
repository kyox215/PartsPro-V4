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
import { deviceModels } from "@/lib/partspro-data";
import { tx } from "@/i18n/dictionaries/storefront";
import { LanguageSwitcher } from "./language-switcher";
import { PartsProLogo } from "./logo";
import { useT } from "./i18n-provider";

const storeMobileNavItems = [
  { labelKey: "nav.home", labelFallback: "Home", href: "/", icon: Home },
  { labelKey: "nav.account", labelFallback: "Account", href: "/account", icon: User },
];

type StoreMobileMenuProps = {
  className?: string;
};

export function StoreMobileMenu({ className }: StoreMobileMenuProps) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(() => pathname.startsWith("/catalogo"));
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);
  const catalogActive = pathname === "/catalogo" || pathname.startsWith("/catalogo/");

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setExpandedBrand(null);
    }
  }

  function closeMenu() {
    setOpen(false);
    setExpandedBrand(null);
  }

  function toggleCatalog() {
    setCatalogOpen((current) => {
      if (current) {
        setExpandedBrand(null);
      }

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
            <PartsProLogo />
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
                  className="space-y-2 rounded-lg bg-white px-2 py-2 shadow-sm"
                >
                  <Link
                    href="/catalogo"
                    className="flex h-8 items-center rounded-md px-2 text-xs font-black text-primary hover:bg-primary/8"
                    onClick={closeMenu}
                  >
                    Tutto il catalogo
                  </Link>
                  <Link
                    href="/catalogo?minStock=1"
                    className="flex h-8 items-center rounded-md px-2 text-xs font-black text-emerald-700 hover:bg-emerald-50"
                    onClick={closeMenu}
                  >
                    Solo disponibili
                  </Link>
                  <div className="space-y-1">
                    {deviceModels.map((entry) => {
                      const brandOpen = expandedBrand === entry.brand;
                      const brandPanelId = catalogBrandPanelId(entry.brand);

                      return (
                        <div key={entry.brand} className="rounded-md border border-slate-100">
                          <button
                            type="button"
                            className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-black text-slate-900 transition hover:bg-slate-50 hover:text-primary"
                            aria-expanded={brandOpen}
                            aria-controls={brandPanelId}
                            onClick={() =>
                              setExpandedBrand((current) =>
                                current === entry.brand ? null : entry.brand
                              )
                            }
                          >
                            <span className="min-w-0 flex-1">{entry.brand}</span>
                            <ChevronDown
                              className={cn(
                                "size-3.5 text-slate-400 transition",
                                brandOpen && "rotate-180 text-primary"
                              )}
                            />
                          </button>
                          {brandOpen && (
                            <div id={brandPanelId} className="border-t border-slate-100 p-2">
                              <Link
                                href={catalogQueryHref({ brand: entry.brand })}
                                className="mb-2 flex h-8 items-center rounded-md bg-primary/8 px-2 text-[11px] font-black text-primary hover:bg-primary/12"
                                onClick={closeMenu}
                              >
                                Tutti i modelli {entry.brand}
                              </Link>
                              <div className="flex flex-wrap gap-1">
                                {entry.models.map((model) => (
                                  <Link
                                    key={model}
                                    href={catalogQueryHref({ brand: entry.brand, model })}
                                    className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-semibold leading-4 text-slate-600 hover:bg-primary/8 hover:text-primary"
                                    onClick={closeMenu}
                                  >
                                    {model}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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

function catalogQueryHref({
  brand,
  model,
}: {
  brand?: string;
  model?: string;
}) {
  const params = new URLSearchParams();

  if (brand) {
    params.set("brand", brand);
  }

  if (model) {
    params.set("model", model);
  }

  const query = params.toString();

  return query ? `/catalogo?${query}` : "/catalogo";
}

function catalogBrandPanelId(brand: string) {
  return `store-mobile-catalog-brand-${brand.toLowerCase().replace(/\s+/g, "-")}`;
}
