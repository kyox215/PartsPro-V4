"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Grid3X3, Home, Search } from "lucide-react";
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
import type {
  CatalogDepartment,
  CatalogDepartmentGroup,
} from "@/lib/partspro-data";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import { tx } from "@/i18n/dictionaries/storefront";
import { CatalogBrandTree, type CatalogSelection } from "./catalog-brand-tree";
import { LanguageSwitcher } from "./language-switcher";
import { PartsProLogo } from "./logo";
import {
  DelayedPendingIndicator,
  RoutePendingIndicator,
} from "./pending-feedback";
import { useT } from "./i18n-provider";

const storeMobileNavItems = [
  { labelKey: "nav.home", labelFallback: "Home", href: "/", icon: Home },
];

export type StoreMobileMenuProps = {
  assistedCompanyId?: string | null;
  departmentGroups?: readonly CatalogDepartmentGroup[];
  onCatalogSelect?: (selection: CatalogSelection) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  prefetchCatalogLinks?: boolean;
  selectedCatalog?: CatalogSelection;
  trigger: ReactElement;
};

export function StoreMobileMenu({
  assistedCompanyId,
  departmentGroups,
  onCatalogSelect,
  onOpenChange,
  open,
  prefetchCatalogLinks = false,
  selectedCatalog,
  trigger,
}: StoreMobileMenuProps) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSearchPending, startSearchTransition] = useTransition();
  const [catalogOpen, setCatalogOpen] = useState(() => pathname.startsWith("/catalogo"));
  const catalogSearchValue = selectedCatalog?.searchQuery ?? selectedCatalog?.model ?? "";
  const [expandedDepartmentOverride, setExpandedDepartmentOverride] = useState<
    CatalogDepartment | null | undefined
  >(undefined);
  const [expandedBrandKeyOverride, setExpandedBrandKeyOverride] = useState<
    string | null | undefined
  >(undefined);
  const catalogActive = pathname === "/catalogo" || pathname.startsWith("/catalogo/");
  const selectedDepartment = selectedCatalog?.department ?? null;
  const selectedBrand = selectedCatalog?.brand ?? null;
  const selectedBrandKey =
    selectedDepartment && selectedBrand
      ? `${selectedDepartment}::${selectedBrand}`
      : null;
  const expandedDepartment =
    expandedDepartmentOverride === undefined
      ? selectedDepartment
      : expandedDepartmentOverride;
  const expandedBrandKey =
    expandedBrandKeyOverride === undefined
      ? selectedBrandKey
      : expandedBrandKeyOverride;

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);

    if (nextOpen && catalogActive) {
      setCatalogOpen(true);
      setExpandedDepartmentOverride(undefined);
      setExpandedBrandKeyOverride(undefined);
    }

    if (!nextOpen) {
      setExpandedDepartmentOverride(undefined);
      setExpandedBrandKeyOverride(undefined);
    }
  }

  function closeMenu() {
    onOpenChange(false);
    setExpandedDepartmentOverride(undefined);
    setExpandedBrandKeyOverride(undefined);
  }

  function handleCatalogSelect(selection: CatalogSelection) {
    onCatalogSelect?.(selection);
    closeMenu();
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("catalogSearch") ?? "").trim();

    if (!query) {
      return;
    }

    if (onCatalogSelect) {
      onCatalogSelect({ searchQuery: query });
      closeMenu();
      return;
    }

    startSearchTransition(() => {
      router.push(
        hrefWithAssistedCompanyId(
          `/catalogo?${new URLSearchParams({ q: query }).toString()}`,
          assistedCompanyId
        )
      );
    });
    closeMenu();
  }

  function toggleCatalog() {
    setExpandedDepartmentOverride(undefined);
    setExpandedBrandKeyOverride(undefined);
    setCatalogOpen((current) => {
      return !current;
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent
        ref={contentRef}
        side="left"
        className="flex h-dvh w-[min(86vw,320px,var(--overlay-width,100vw))] max-w-[320px] gap-0 overflow-hidden border-r bg-white p-0 text-slate-950"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
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
              "Menu mobile con home e catalogo."
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-3 py-3">
            <form className="relative" onSubmit={handleSearchSubmit}>
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                key={catalogSearchValue}
                className="h-9 rounded-lg border-slate-200 bg-slate-50 pl-8 pr-10 text-sm shadow-none focus-visible:bg-white"
                defaultValue={catalogSearchValue}
                name="catalogSearch"
                placeholder={tx(t, "storefront.home.mobileSearch", "Cerca SKU / prodotto")}
              />
              <Button
                type="submit"
                size="icon-xs"
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2 rounded-md"
                aria-label={tx(t, "storefront.header.searchSubmit", "Cerca")}
              >
                <span className="relative grid size-3.5 place-items-center">
                  <Search className="size-3.5" />
                  <DelayedPendingIndicator
                    className="absolute size-3.5 text-white"
                    label={tx(t, "storefront.header.searchLoading", "Ricerca in corso...")}
                    pending={isSearchPending}
                  />
                </span>
              </Button>
            </form>
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
                    <span className="min-w-0 flex-1 truncate">
                      {tx(t, item.labelKey, item.labelFallback)}
                    </span>
                    <RoutePendingIndicator className="size-3.5 text-primary" />
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
                    assistedCompanyId={assistedCompanyId}
                    departmentGroups={departmentGroups}
                    expandedBrandKey={expandedBrandKey}
                    expandedDepartment={expandedDepartment}
                    idPrefix="store-mobile-catalog"
                    onExpandedBrandKeyChange={setExpandedBrandKeyOverride}
                    onExpandedDepartmentChange={setExpandedDepartmentOverride}
                    onNavigate={onCatalogSelect ? undefined : closeMenu}
                    onSelectCatalog={
                      onCatalogSelect ? handleCatalogSelect : undefined
                    }
                    prefetchCatalogLinks={prefetchCatalogLinks}
                    selectedCatalog={selectedCatalog}
                  />
                </div>
              )}
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
