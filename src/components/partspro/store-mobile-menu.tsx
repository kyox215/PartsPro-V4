"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactElement } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
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
import type {
  CatalogDepartment,
  CatalogDepartmentGroup,
} from "@/lib/partspro-data";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import { tx } from "@/i18n/dictionaries/storefront";
import { CatalogBrandTree, type CatalogSelection } from "./catalog-brand-tree";
import { LanguageSwitcher } from "./language-switcher";
import { PartsProLogo } from "./logo";
import { DelayedPendingIndicator } from "./pending-feedback";
import { useT, useI18n } from "./i18n-provider";

export type StoreMobileMenuProps = {
  assistedCompanyId?: string | null;
  departmentGroups?: readonly CatalogDepartmentGroup[];
  onCatalogSelect?: (selection: CatalogSelection) => void | Promise<boolean>;
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
  const { locale } = useI18n();
  const [failedSelection, setFailedSelection] = useState<CatalogSelection | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const selectionRequest = useRef(0);
  useEffect(() => {
    if (previousPath.current !== pathname) onOpenChange(false);
    previousPath.current = pathname;
  }, [pathname, onOpenChange]);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSearchPending, startSearchTransition] = useTransition();
  const catalogSearchValue = selectedCatalog?.searchQuery ?? selectedCatalog?.model ?? "";
  const [expandedDepartmentOverride, setExpandedDepartmentOverride] = useState<
    CatalogDepartment | null | undefined
  >(undefined);
  const [expandedBrandKeyOverride, setExpandedBrandKeyOverride] = useState<
    string | null | undefined
  >(undefined);
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

    if (!nextOpen) {
      selectionRequest.current++;
      setFailedSelection(null);
      setExpandedDepartmentOverride(undefined);
      setExpandedBrandKeyOverride(undefined);
    }
  }

  function closeMenu() {
    onOpenChange(false);
    setExpandedDepartmentOverride(undefined);
    setExpandedBrandKeyOverride(undefined);
  }

  async function handleCatalogSelect(selection: CatalogSelection) {
    const request = ++selectionRequest.current;
    setFailedSelection(null);
    let succeeded = false;
    try { succeeded = (await onCatalogSelect?.(selection)) !== false; } catch { /* Show local retry below. */ }
    if (request !== selectionRequest.current) return false;
    if (succeeded) closeMenu();
    else setFailedSelection(selection);
    return succeeded;
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("catalogSearch") ?? "").trim();

    if (!query) {
      return;
    }

    if (onCatalogSelect) {
      startSearchTransition(async () => { await handleCatalogSelect({ searchQuery: query }); });
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
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent
        ref={contentRef}
        side="left"
        className="pp-storefront-portal flex h-dvh w-[min(86vw,320px,var(--overlay-width,100vw))] max-w-[320px] gap-0 overflow-hidden border-r bg-white p-0 text-slate-950"
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
              "Sfoglia smartphone, tablet, computer ed elettronica per brand e modello."
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
                name="catalogSearch" aria-label={tx(t, "storefront.header.searchFull", "Cerca SKU, brand, modello...")}
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
          {failedSelection ? <div role="alert" className="mx-3 rounded border border-red-200 bg-red-50 p-2 text-xs">
            {locale.startsWith("zh") ? "加载失败，请重试" : locale.startsWith("en") ? "Could not load. Try again." : "Caricamento non riuscito. Riprova."}
            <Button size="sm" variant="ghost" disabled={isSearchPending} onClick={() => startSearchTransition(async () => { await handleCatalogSelect(failedSelection); })}>{tx(t, "storefront.common.retry", "Riprova")}</Button>
          </div> : null}
          <nav
            aria-label={tx(t, "storefront.header.mobileMenuTitle", "Menu PartsPro")}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
          >
            <CatalogBrandTree
              expandBranchesOnClick
              assistedCompanyId={assistedCompanyId}
              departmentGroups={departmentGroups}
              departmentLabelOverrides={{
                general_merchandise: tx(t, "storefront.header.mobileElectronics", "Elettronica"),
              }}
              expandedBrandKey={expandedBrandKey}
              expandedDepartment={expandedDepartment}
              idPrefix="store-mobile-catalog"
              onExpandedBrandKeyChange={setExpandedBrandKeyOverride}
              onExpandedDepartmentChange={setExpandedDepartmentOverride}
              onNavigate={undefined}
              onSelectCatalog={onCatalogSelect ? handleCatalogSelect : undefined}
              prefetchCatalogLinks={prefetchCatalogLinks}
              selectedCatalog={selectedCatalog}
              showAllProducts={false}
            />
          </nav>
          <div className="mt-auto border-t border-slate-100 px-3 py-3">
            <LanguageSwitcher presentation="menu" className="w-full" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
