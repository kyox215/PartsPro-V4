"use client";



import { catalogBrowseKey } from "@/lib/partspro-catalog-return.mjs";
import { AsyncFeedback } from "./async-feedback";
import { PricingSessionBoundary, QuoteExpiryRefresh } from "./pricing-session-boundary";
import { createLatestRequest } from "@/lib/latest-request.mjs";
import { refreshVisibleCatalog } from "@/lib/storefront-refresh.mjs";
import { useStorefrontRefresh } from "./storefront-refresh-provider";
import { RefreshStatus } from "./storefront-refresh-status";
import { countCatalogFilters, resetCatalogFilters, removeCatalogFilter } from "./catalog-filters.mjs";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronRight, Grid3X3, Loader2, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  catalogDepartmentGroups as fallbackCatalogDepartmentGroups,
  catalogDepartments,
  products as localProducts,
  type CatalogDepartment,
  type CatalogDepartmentGroup,
  type PartProduct,
} from "@/lib/partspro-data";
import {
  hrefWithAssistedCompanyId,
  rememberAssistedCompanyId,
} from "@/lib/partspro-assisted-order";
import { brandLabel, catalogDepartmentLabel, categoryLabel, tx, txFormat } from "@/i18n/dictionaries/storefront";
import { inferDeviceModelSeries } from "@/lib/partspro-device-series";
import type {
  PriceVisibilityReason,
  StorefrontCartAccess,
} from "@/lib/partspro-account-context";
import {
  getAccountGateCopy,
  isCustomerActionRequiredReason,
  type AccountGateCopy,
} from "@/lib/partspro-account-gate-copy";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { cn } from "@/lib/utils";
import { CatalogBrandTree, type CatalogSelection as BaseCatalogSelection } from "./catalog-brand-tree";
import { ProductCard } from "./product-card";
import { StoreHeader } from "./store-header";
import { useCatalogDirectory } from "./catalog-directory-provider";
import { catalogNodeLabel } from "@/lib/partspro-catalog-directory";
import { useI18n, useT } from "./i18n-provider";
import {
} from "./pending-feedback";

type CatalogSort = "name" | "stock_desc" | "updated_desc";
type CatalogSelection = BaseCatalogSelection & { sort?: CatalogSort };

function normalizeCatalogSort(value: string | null | undefined): CatalogSort {
  return value === "name" || value === "updated_desc" ? value : "stock_desc";
}

type FilterKey = "brand" | "category" | "department" | "status" | "grade";

type CatalogFiltersState = Record<FilterKey, string[]>;

const emptyFilters: CatalogFiltersState = {
  brand: [],
  category: [],
  department: [],
  status: [],
  grade: [],
};
const visibleProductsIncrement = 24;

type CatalogSearchParams = {
  get: (name: string) => string | null;
};

function getFiltersFromParams(searchParams: CatalogSearchParams): CatalogFiltersState {
  const brand = searchParams.get("brand");
  const category = searchParams.get("category");
  const departmentValue = searchParams.get("department");
  const department = catalogDepartments.includes(
    departmentValue as CatalogDepartment
  )
    ? departmentValue
    : null;

  return {
    ...emptyFilters,
    brand: brand ? [brand] : [],
    category: category ? [category] : [],
    department: department ? [department] : [],
  };
}

function getModelSearchFromParams(searchParams: CatalogSearchParams) {
  return searchParams.get("model") ?? "";
}

function getSearchQueryFromParams(searchParams: CatalogSearchParams) {
  return searchParams.get("q") ?? "";
}

function getModelSeriesFromParams(searchParams: CatalogSearchParams) {
  return searchParams.get("modelSeries") ?? "";
}

function getInStockOnlyFromParams(searchParams: CatalogSearchParams) {
  return Number(searchParams.get("minStock") ?? "0") > 0;
}

type CatalogPageProps = {
  assistedCompanyId?: string | null;
  assistedCompanyName?: string | null;
  cartAccess?: StorefrontCartAccess;
  filteredTotal?: number;
  initialAccountAccess?: StoreHeaderAccountAccess;
  initialDepartmentGroups?: CatalogDepartmentGroup[];
  initialProducts?: PartProduct[];
  priceGateReason?: PriceVisibilityReason;
  showWholesalePrice?: boolean;
};

export function CatalogPage({
  assistedCompanyId = null,
  assistedCompanyName = null,
  cartAccess = { allowed: false, missingFields: [], reason: "login_required" },
  filteredTotal,
  initialAccountAccess,
  initialDepartmentGroups,
  initialProducts = localProducts,
  priceGateReason = "login_required",
  showWholesalePrice = false,
}: CatalogPageProps) {
  const searchParams = useSearchParams();

  return (
    <PricingSessionBoundary userId={initialAccountAccess?.userId}><CatalogPageContent
      key={JSON.stringify([initialAccountAccess?.userId, assistedCompanyId])}
      filteredTotal={filteredTotal ?? initialProducts.length}
      assistedCompanyId={assistedCompanyId}
      assistedCompanyName={assistedCompanyName}
      initialAccountAccess={initialAccountAccess}
      initialFilters={getFiltersFromParams(searchParams)}
      initialInStockOnly={getInStockOnlyFromParams(searchParams)}
      initialSort={normalizeCatalogSort(searchParams.get("sort"))}
      initialDepartmentGroups={initialDepartmentGroups}
      initialProducts={initialProducts}
      cartAccess={cartAccess}
      initialModelSeries={getModelSeriesFromParams(searchParams)}
      initialSearchQuery={getSearchQueryFromParams(searchParams)}
      initialSearchTerm={getModelSearchFromParams(searchParams)}
      priceGateReason={priceGateReason}
      showWholesalePrice={showWholesalePrice}
    /></PricingSessionBoundary>
  );
}

function CatalogPageContent({
  filteredTotal: initialFilteredTotal,
  assistedCompanyId,
  assistedCompanyName,
  initialAccountAccess,
  cartAccess,
  initialFilters,
  initialInStockOnly,
  initialSort,
  initialDepartmentGroups,
  initialProducts,
  initialModelSeries,
  initialSearchQuery,
  initialSearchTerm,
  priceGateReason,
  showWholesalePrice,
}: {
  filteredTotal: number;
  assistedCompanyId: string | null;
  assistedCompanyName: string | null;
  initialAccountAccess?: StoreHeaderAccountAccess;
  cartAccess: StorefrontCartAccess;
  initialFilters: CatalogFiltersState;
  initialInStockOnly: boolean;
  initialSort: CatalogSort;
  initialDepartmentGroups?: CatalogDepartmentGroup[];
  initialProducts: PartProduct[];
  initialModelSeries: string;
  initialSearchQuery: string;
  initialSearchTerm: string;
  priceGateReason: PriceVisibilityReason;
  showWholesalePrice: boolean;
}) {
  const t = useT();
  const directory = useCatalogDirectory();
  const locale = useI18n().locale;
  const refresh = useStorefrontRefresh();
  const locationQuery = useSearchParams().toString();
  const [backgroundRefresh, setBackgroundRefresh] = useState(false);
  const [backgroundError, setBackgroundError] = useState(false);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [modelSeries, setModelSeries] = useState(initialModelSeries);
  const [filters, setFilters] = useState<CatalogFiltersState>(initialFilters);
  const [inStockOnly, setInStockOnly] = useState(initialInStockOnly);
  const [sort, setSort] = useState<CatalogSort>(initialSort);
  const [products, setProducts] = useState(initialProducts);
  const [restoreSnapshot] = useState(() => ({ count: initialProducts.length, total: initialFilteredTotal }));
  const [filteredTotal, setFilteredTotal] = useState(initialFilteredTotal);
  const [catalogLoadState, setCatalogLoadState] = useState<
    "idle" | "loading" | "loading-more"
  >("idle");
  const [catalogError, setCatalogError] = useState<"network" | null>(null);
  const [failedOffset, setFailedOffset] = useState(0);
  const [browseKey] = useState(() => catalogBrowseKey(
    buildCatalogSelectionPath({
      brand: initialFilters.brand[0],
      category: initialFilters.category[0],
      department: readDepartmentFilter(initialFilters) ?? undefined,
      inStockOnly: initialInStockOnly,
      sort: initialSort,
      model: initialSearchTerm,
      modelSeries: initialModelSeries,
      searchQuery: initialSearchQuery,
    }, assistedCompanyId),
    initialAccountAccess?.userId,
    assistedCompanyId
  ));
  const initialDepartment = readDepartmentFilter(initialFilters);
  const [expandedDepartment, setExpandedDepartment] =
    useState<CatalogDepartment | null>(() => initialDepartment);
  const [expandedBrandKey, setExpandedBrandKey] = useState<string | null>(
    () =>
      initialDepartment && initialFilters.brand[0]
        ? `${initialDepartment}::${initialFilters.brand[0]}`
        : null
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const [draftFilters, setDraftFilters] = useState<CatalogSelection>({});
  const [draftDepartment, setDraftDepartment] = useState<CatalogDepartment | null>("phone");
  const [draftBrand, setDraftBrand] = useState<string | null>(null);
  const shouldUseCatalogPageCache = !showWholesalePrice;
  const catalogPageCacheRef = useRef(
    new Map<string, { products: PartProduct[]; total: number; expiresAt: number }>([
      [
        buildCatalogApiPath(
          {
            brand: initialFilters.brand[0],
            category: initialFilters.category[0],
            department: initialDepartment ?? undefined,
            inStockOnly: initialInStockOnly,
            sort: initialSort,
            model: initialSearchTerm || undefined,
            modelSeries: initialModelSeries || undefined,
            searchQuery: initialSearchQuery || undefined,
          },
          0,
          assistedCompanyId
        ),
        {
          expiresAt: Date.now() + 30_000,
          products: initialProducts,
          total: initialFilteredTotal,
        },
      ],
    ])
  );
  const catalogRequestRef = useRef(createLatestRequest());
  useEffect(() => {
    const requests = catalogRequestRef.current;
    return () => requests.cancel();
  }, []);
  const departmentGroups = useMemo(
    () =>
      initialDepartmentGroups?.length
        ? initialDepartmentGroups
        : fallbackCatalogDepartmentGroups,
    [initialDepartmentGroups]
  );
  const selectedBrand = filters.brand[0];
  const selectedCategory = filters.category[0];
  const selectedDepartment = readDepartmentFilter(filters) ?? undefined;
  const selectedCatalog = useMemo(
    () => ({
      brand: selectedBrand,
      category: selectedCategory,
      department: selectedDepartment,
      inStockOnly,
      sort,
      model: searchTerm.trim() || undefined,
      modelSeries: modelSeries || undefined,
      searchQuery: searchQuery.trim() || undefined,
    }),
    [
      inStockOnly,
      sort,
      modelSeries,
      searchQuery,
      searchTerm,
      selectedBrand,
      selectedCategory,
      selectedDepartment,
    ]
  );
  const browseSnapshot = useRef({selection: selectedCatalog, count: products.length});
  useEffect(() => { browseSnapshot.current = {selection: selectedCatalog, count: products.length}; }, [selectedCatalog, products.length]);
  useEffect(() => {
    if (!refresh.refreshVersion) return;
    const requests = catalogRequestRef.current;
    const request = requests.begin();
    const snapshot = browseSnapshot.current;
    let active = true;
    let timedOut = false;
    const timeout = window.setTimeout(() => { if (request.isCurrent()) {timedOut = true; requests.cancel();} }, 15_000);
    queueMicrotask(() => { if (active) {
      setBackgroundRefresh(true); setBackgroundError(false);
      // This request owns the selected filter now; the cancelled foreground
      // request cannot clear its former loading state in its guarded finally.
      setCatalogLoadState("idle"); setCatalogError(null); setFailedOffset(0);
    } });
    void refreshVisibleCatalog(snapshot.count, async (offset, limit) => {
      const response = await fetch(buildCatalogApiPath(snapshot.selection, offset, assistedCompanyId, limit), {cache:"no-store", signal:request.signal});
      if (!response.ok) throw new Error("catalog_refresh_failed");
      const payload = await response.json() as {data?:PartProduct[];meta?:{total?:number}};
      return {products:payload.data??[],total:payload.meta?.total??0};
    }, request.signal).then(next => {
      if (!active || !request.isCurrent()) return;
      setProducts(next.products);
      setFilteredTotal(next.total);
      catalogPageCacheRef.current.clear();
    }).catch(() => {
      if (active && (request.isCurrent() || timedOut)) { setBackgroundError(true); if (request.isCurrent()) requests.cancel(); }
    }).finally(() => { window.clearTimeout(timeout); if (active) setBackgroundRefresh(false); });
    return () => { active=false; window.clearTimeout(timeout); if (request.isCurrent()) requests.cancel(); };
  }, [refresh.refreshVersion, assistedCompanyId]);
  const initialActivitySelectionRef = useRef<CatalogSelection>({
    brand: initialFilters.brand[0],
    category: initialFilters.category[0],
    department: initialDepartment ?? undefined,
    inStockOnly: initialInStockOnly,
    sort: initialSort,
    model: initialSearchTerm || undefined,
    modelSeries: initialModelSeries || undefined,
    searchQuery: initialSearchQuery || undefined,
  });
  const loadCatalogSelection = useCallback(
    async (selection: CatalogSelection, offset = 0) => {
      const apiPath = buildCatalogApiPath(selection, offset, assistedCompanyId);
      const cachedPage = shouldUseCatalogPageCache
        ? catalogPageCacheRef.current.get(apiPath)
        : undefined;
      const request = catalogRequestRef.current.begin();

      setCatalogError(null);
      setFailedOffset(offset);
      setCatalogLoadState(offset > 0 ? "loading-more" : "loading");

      if (cachedPage && cachedPage.expiresAt > Date.now()) {
        setFilteredTotal(cachedPage.total);
        setProducts((currentProducts) =>
          offset > 0 ? mergeUniqueProducts(currentProducts, cachedPage.products) : cachedPage.products
        );
        setCatalogLoadState("idle");
        return { count: cachedPage.products.length, total: cachedPage.total };
      }

      const timeout = window.setTimeout(() => {
        if (!request.isCurrent()) return;
        catalogRequestRef.current.cancel();
        setCatalogError("network");
        setCatalogLoadState("idle");
      }, 15_000);
      try {
        const response = await fetch(apiPath, {
          cache: "no-store",
          signal: request.signal,
        });

        if (!request.isCurrent()) return;

        if (!response.ok) {
          setCatalogError("network");
          return;
        }

        const payload = (await response.json()) as {
          data?: PartProduct[];
          meta?: { total?: number };
        };
        if (!request.isCurrent()) return;
        const nextProducts = payload.data ?? [];
        const nextTotal = payload.meta?.total ?? nextProducts.length;

        if (shouldUseCatalogPageCache) {
          rememberCatalogPage(catalogPageCacheRef.current, apiPath, {
            expiresAt: Date.now() + 30_000,
            products: nextProducts,
            total: nextTotal,
          });
        }

        setFilteredTotal(nextTotal);
        setProducts((currentProducts) =>
          offset > 0 ? mergeUniqueProducts(currentProducts, nextProducts) : nextProducts
        );
        setCatalogError(null);
        return { count: nextProducts.length, total: nextTotal };
      } catch (error) {
        if (!request.isCurrent() || (error instanceof Error && error.name === "AbortError")) {
          return;
        }
        setCatalogError("network");
      } finally {
        window.clearTimeout(timeout);
        if (request.isCurrent()) {
          setCatalogLoadState("idle");
        }
      }
    },
    [assistedCompanyId, shouldUseCatalogPageCache]
  );

  // Restore only this scope's first visit, including StrictMode effect replay.
  // Later RSC permissions/price changes must not replay the old browse record.
  const [restoreCatalogSelection] = useState(() => loadCatalogSelection);
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const stored = JSON.parse(sessionStorage.getItem(browseKey) || "null") as { count?: number; scrollY?: number; savedAt?: number } | null;
        if (!stored || Date.now() - (stored.savedAt || 0) > 30 * 60_000) return;
        const desired = Math.min(Math.max(Math.trunc(Number(stored.count)) || 0, 0), restoreSnapshot.total);
        let offset = restoreSnapshot.count;
        while (!cancelled && offset < desired) {
          const page = await restoreCatalogSelection(initialActivitySelectionRef.current, offset);
          if (!page || page.count === 0) break;
          offset += page.count;
          if (offset >= page.total) break;
        }
        if (!cancelled) requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, Number(stored.scrollY) || 0), behavior: "instant" }));
      } catch { /* unavailable session storage must not block browsing */ }
    }
    void restore();
    return () => { cancelled = true; };
  }, [browseKey, restoreSnapshot, restoreCatalogSelection]);

  function rememberBrowse() {
    try {
      const path = buildCatalogSelectionPath(selectedCatalog, assistedCompanyId);
      sessionStorage.setItem(catalogBrowseKey(path, initialAccountAccess?.userId, assistedCompanyId), JSON.stringify({ count: products.length, scrollY: window.scrollY, savedAt: Date.now() }));
    } catch { /* browsing still works */ }
  }

  useEffect(() => {
    void recordCatalogActivity(initialActivitySelectionRef.current, initialAccountAccess);
  }, [initialAccountAccess]);

  useEffect(() => {
    rememberAssistedCompanyId(assistedCompanyId);
  }, [assistedCompanyId]);

  useEffect(() => {
    let active = true;
    // Next Link, native history and back/forward all update useSearchParams.
    // Same-URL background refresh must not reset pagination or drafts.
    queueMicrotask(() => {
      if (!active) return;
      const search = new URLSearchParams(locationQuery);
      const nextFilters = getFiltersFromParams(search);
      const nextSelection = {
        brand: nextFilters.brand[0],
        category: nextFilters.category[0],
        department: readDepartmentFilter(nextFilters) ?? undefined,
        inStockOnly: getInStockOnlyFromParams(search),
        sort: normalizeCatalogSort(search.get("sort")),
        model: getModelSearchFromParams(search) || undefined,
        modelSeries: getModelSeriesFromParams(search) || undefined,
        searchQuery: getSearchQueryFromParams(search) || undefined,
      };

      if (buildCatalogSelectionPath(nextSelection, assistedCompanyId) === buildCatalogSelectionPath(browseSnapshot.current.selection, assistedCompanyId)) return;
      setSearchTerm(nextSelection.model ?? "");
      setSearchQuery(nextSelection.searchQuery ?? "");
      setModelSeries(nextSelection.modelSeries ?? "");
      setFilters(nextFilters);
      setInStockOnly(Boolean(nextSelection.inStockOnly));
      setSort(nextSelection.sort);
      setExpandedDepartment(nextSelection.department ?? null);
      setExpandedBrandKey(
        nextSelection.department && nextSelection.brand
          ? `${nextSelection.department}::${nextSelection.brand}`
          : null
      );
      void loadCatalogSelection(nextSelection);
    });
    return () => { active = false; };
  }, [locationQuery, assistedCompanyId, loadCatalogSelection]);

  const hiddenProductCount = Math.max(filteredTotal - products.length, 0);
  const catalogReplacing = catalogLoadState === "loading";
  const accountGateCopy =
    !assistedCompanyId && isCustomerActionRequiredReason(priceGateReason)
      ? getAccountGateCopy(t, priceGateReason)
      : null;

  function openFilters() {
    setDraftFilters({ ...selectedCatalog });
    setDraftDepartment(selectedCatalog.department ?? "phone");
    setDraftBrand(selectedCatalog.brand ? `${selectedCatalog.department ?? "phone"}::${selectedCatalog.brand}` : null);
    setFilterOpen(true);
  }

  function clearAll() {
    setSearchTerm("");
    setSearchQuery("");
    setFilters(emptyFilters);
    setInStockOnly(false);
    selectCatalog({ sort });
  }

  async function selectCatalog(requestedSelection: CatalogSelection) {
    const selection = { ...requestedSelection, sort: normalizeCatalogSort(requestedSelection.sort ?? sort) };
    setSort(selection.sort);
    const nextFilters: CatalogFiltersState = {
      ...emptyFilters,
      brand: selection.brand ? [selection.brand] : [],
      category: selection.category ? [selection.category] : [],
      department: selection.department ? [selection.department] : [],
    };

    setSearchTerm(selection.model ?? "");
    setSearchQuery(selection.searchQuery ?? "");
    setModelSeries(selection.modelSeries ?? "");
    setFilters(nextFilters);
    setInStockOnly(Boolean(selection.inStockOnly));
    const nextPath = buildCatalogSelectionPath(selection, assistedCompanyId);

    if (nextPath !== `${window.location.pathname}${window.location.search}`) {
      window.history.pushState(null, "", nextPath);
    }
    void recordCatalogActivity(selection, initialAccountAccess);
    return Boolean(await loadCatalogSelection(selection));
  }

  return (
    <main className="pp-catalog-page min-h-screen overflow-x-clip bg-[#f4f6fa] text-slate-950">
      <QuoteExpiryRefresh products={products} />
      <StoreHeader
        assistedCompanyId={assistedCompanyId}
        departmentGroups={departmentGroups}
        initialAccountAccess={initialAccountAccess}
        onCatalogSelect={selectCatalog}
        selectedCatalog={selectedCatalog}
      />
      <div className="pp-catalog-layout">
        <aside className="pp-browse-sidebar hidden lg:block">
          <CatalogNavigationSidebar
            assistedCompanyId={assistedCompanyId}
            departmentGroups={departmentGroups}
            expandedBrandKey={expandedBrandKey}
            expandedDepartment={expandedDepartment}
            onExpandedBrandKeyChange={setExpandedBrandKey}
            onExpandedDepartmentChange={setExpandedDepartment}
            onSelectCatalog={selectCatalog}
            selectedCatalog={selectedCatalog}
          />
        </aside>

        <section className="pp-catalog-results min-w-0">
          <h1 className="sr-only">{searchQuery || searchTerm ? txFormat(t,"storefront.ux.searchResults","Risultati per “{query}”",{query:searchQuery || searchTerm}) : tx(t,"storefront.ux.browseCatalog","Sfoglia catalogo")}</h1>
          <form className="pp-catalog-compact-search" role="search" onSubmit={event => {
            event.preventDefault();
            selectCatalog({ ...selectedCatalog, searchQuery: String(new FormData(event.currentTarget).get("q") ?? "") });
          }}>
            <Search aria-hidden="true"/>
            <input name="q" key={searchQuery} defaultValue={searchQuery} aria-label={tx(t,"storefront.header.searchFull","Cerca SKU, brand, modello...")} placeholder={tx(t,"storefront.header.searchFull","Cerca SKU, brand, modello...")}/>
            <button type="submit" aria-label={tx(t,"storefront.header.searchSubmit","Cerca")}><ChevronRight aria-hidden="true"/></button>
          </form>
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogContent closeLabel={t("common.close")} className="pp-storefront-portal pp-catalog-filter-dialog" onCloseAutoFocus={event => {
              event.preventDefault();
              filterTriggerRef.current?.focus({ preventScroll: true });
            }}>
              <DialogHeader>
                <DialogTitle>{tx(t,"storefront.reference.filters","Filtri")}</DialogTitle>
                <DialogDescription className="sr-only">{tx(t,"storefront.reference.filterDescription","Scegli brand, modello e disponibilità, poi applica i filtri.")}</DialogDescription>
              </DialogHeader>
              <div className="pp-catalog-filter-scroll">
                {countCatalogFilters(draftFilters) > 0 ? <div className="pp-catalog-draft-chips">
                  {(["department","brand","modelSeries","model","category"] as const).map(key => draftFilters[key] ? <Button key={key} type="button" size="sm" variant="outline" onClick={() => {
                    const next = removeCatalogFilter(draftFilters, key);
                    setDraftFilters(next);
                    setDraftDepartment(next.department ?? "phone");
                    setDraftBrand(next.brand ? `${next.department ?? "phone"}::${next.brand}` : null);
                  }}>{key === "category" ? categoryLabel(t,String(draftFilters[key])) : key === "department" ? catalogDepartmentLabel(t,draftFilters[key] as CatalogDepartment) : key === "brand" ? brandLabel(t,String(draftFilters[key])) : String(draftFilters[key])}<span aria-hidden="true"> ×</span><span className="sr-only">{tx(t,"storefront.ux.removeFilter","Rimuovi filtro")}</span></Button> : null)}
                </div> : null}
                <CatalogBrandTree departmentGroups={departmentGroups} expandedBrandKey={draftBrand} expandedDepartment={draftDepartment} onExpandedBrandKeyChange={setDraftBrand} onExpandedDepartmentChange={setDraftDepartment} selectedCatalog={draftFilters} onSelectCatalog={selection => setDraftFilters(previous => ({...selection,sort:previous.sort,searchQuery:previous.searchQuery,category:selection.department?previous.category:undefined,inStockOnly:selection.department?previous.inStockOnly:undefined}))} idPrefix="catalog-filter-draft" variant="mobile"/>
                <label className="pp-filter-field"><span>{tx(t,"storefront.reference.category","Categoria")}</span><select value={draftFilters.category ?? ""} onChange={event => setDraftFilters(previous => ({...previous,category:event.target.value || undefined}))}>
                  <option value="">{tx(t,"storefront.reference.allCategories","Tutte le categorie")}</option>
                  {directory.nodes.filter(node => node.kind === "category" && node.active).map(node => <option key={node.id} value={node.value}>{catalogNodeLabel(node,locale)}</option>)}
                  {draftFilters.category && !directory.nodes.some(node => node.kind === "category" && node.active && node.value === draftFilters.category) ? <option value={draftFilters.category}>{categoryLabel(t,draftFilters.category)}</option> : null}
                </select></label>
                <label className="pp-filter-stock"><input type="checkbox" checked={Boolean(draftFilters.inStockOnly)} onChange={event => setDraftFilters(previous => ({...previous,inStockOnly:event.target.checked}))}/>{tx(t,"storefront.ux.inStockOnly","Solo disponibili")}</label>
              </div>
              <div className="pp-filter-actions">
                <Button type="button" variant="outline" onClick={() => {setDraftFilters(resetCatalogFilters(draftFilters));setDraftBrand(null);setDraftDepartment("phone");}}>{tx(t,"storefront.reference.reset","Ripristina")}</Button>
                <Button type="button" disabled={catalogReplacing} onClick={async () => { if (await selectCatalog(draftFilters)) setFilterOpen(false); }}>{catalogReplacing ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none"/> : null}{tx(t,"storefront.reference.apply","Applica filtri")}</Button>
              </div>
            </DialogContent>
          </Dialog>
          {assistedCompanyId ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
              {assistedCompanyName
                ? `${tx(t, "storefront.assistedOrder.catalogBanner", "Ordine per cliente")}: ${assistedCompanyName}`
                : tx(t, "storefront.assistedOrder.catalogBannerGeneric", "Ordine per cliente: prezzi del cliente selezionato")}
            </div>
          ) : null}
          {accountGateCopy ? <CatalogAccountGateBanner copy={accountGateCopy} /> : null}
          {catalogError && failedOffset === 0 ? (
            <CatalogLoadErrorBanner
              loading={catalogLoadState !== "idle"}
              onRetry={() => {
                void loadCatalogSelection(selectedCatalog, failedOffset);
              }}
            />
          ) : null}
          <div className="pp-catalog-compact-toolbar">
            <div className="pp-catalog-compact-feedback"><RefreshStatus reserveSpace={false} busy={backgroundRefresh || catalogReplacing} failed={backgroundError} retry={refresh.retry}/></div>
            <label htmlFor="catalog-sort" className="pp-catalog-compact-sort">
              <span className="sr-only">{tx(t,"storefront.compact.sort","Ordina per")}</span>
              <select id="catalog-sort" value={sort} onChange={event => selectCatalog({ ...selectedCatalog, sort: normalizeCatalogSort(event.target.value) })}>
                <option value="stock_desc">{tx(t,"storefront.compact.stockFirst","Disponibilità")}</option>
                <option value="name">{tx(t,"storefront.compact.nameSort","Nome prodotto")}</option>
                <option value="updated_desc">{tx(t,"storefront.compact.newestSort","Più recenti")}</option>
              </select>
            </label>
            <Button ref={filterTriggerRef} type="button" variant="outline" className="pp-catalog-filter-trigger" onClick={openFilters} aria-haspopup="dialog" aria-expanded={filterOpen}>
              <SlidersHorizontal aria-hidden="true"/>{tx(t,"storefront.reference.filters","Filtri")}
              {countCatalogFilters(selectedCatalog) > 0 ? <span className="pp-filter-count">{countCatalogFilters(selectedCatalog)}</span> : null}
            </Button>
          </div>
          <p className="sr-only" role="status">{txFormat(t,"storefront.ux.resultCount","{loaded} di {total} SKU caricati",{loaded:products.length,total:filteredTotal})}</p>
          {products.length > 0 || catalogReplacing ? (
            <div className="pp-catalog-products space-y-3">
              <div
                className="relative min-h-[320px]"
                aria-busy={catalogReplacing}
                aria-live="polite"
              >
                {products.length > 0 ? (
                  <div
                    className={cn(
                      "pp-product-grid partspro-catalog-grid transition-opacity duration-150 motion-reduce:transition-none",

                    )}
                  >
                    {products.map((product, index) => (
                      <ProductCard
                        assistedCompanyId={assistedCompanyId}
                        returnTo={buildCatalogSelectionPath(selectedCatalog, assistedCompanyId)}
                        searchMatch={searchQuery || searchTerm}
                        onOpenProduct={rememberBrowse}
                        cartAccess={cartAccess}
                        key={product.sku}
                        priceGateReason={priceGateReason}
                        priorityImage={index < 4}
                        product={product}
                        pricingPending={backgroundRefresh}
                        pricingError={backgroundError}
                        showWholesalePrice={showWholesalePrice}
                      />
                    ))}
                  </div>
                ) : null}

              </div>
              {catalogError && failedOffset > 0 && <AsyncFeedback state="error" title={tx(t,"storefront.ux.moreFailed","Impossibile caricare la pagina successiva")} description={tx(t,"storefront.ux.moreKept","I risultati già caricati restano disponibili.")} actions={<Button type="button" variant="outline" disabled={catalogLoadState !== "idle"} onClick={() => void loadCatalogSelection(selectedCatalog, failedOffset)}>{tx(t,"storefront.common.retry","Riprova")}</Button>} />}
              {hiddenProductCount > 0 && !(catalogError && failedOffset > 0) && (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="bg-white"
                    disabled={catalogLoadState !== "idle"}
                    onClick={() => {
                      void loadCatalogSelection(selectedCatalog, products.length);
                    }}
                  >
                    {catalogLoadState === "loading-more" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {tx(t, "storefront.compact.loadMore", "Carica altri")}
                      </>
                    ) : (
                      tx(t, "storefront.compact.loadMore", "Carica altri")
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card className="pp-catalog-empty rounded-lg border-slate-200 bg-white">
              <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-black">
                    {tx(t, "storefront.catalog.emptyTitle", "Nessun ricambio trovato")}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    {tx(t, "storefront.catalog.emptyDescription", "Modifica ricerca o filtri rapidi per tornare al listino disponibile.")}
                  </p>
                </div>
                <Button className="w-full rounded-full sm:w-auto" onClick={clearAll}>
                  <RotateCcw className="size-4" />
                  {tx(t, "storefront.catalog.clearFilters", "Cancella filtri")}
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}

function CatalogAccountGateBanner({ copy }: { copy: AccountGateCopy }) {
  const t = useT();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <div className="font-black">{copy.title}</div>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-amber-900">
            {copy.description}
          </p>
        </div>
      </div>
      {copy.actionHref && copy.actionLabel ? (
        <Button asChild size="sm" className="shrink-0 bg-amber-600 text-white hover:bg-amber-600">
          <Link href={copy.actionHref}>{copy.actionLabel}</Link>
        </Button>
      ) : (
        <span className="shrink-0 text-xs font-black text-amber-800">
          {tx(t, "storefront.accountGate.noAction", "Contatta PartsPro")}
        </span>
      )}
    </div>
  );
}

function CatalogNavigationSidebar({
  assistedCompanyId,
  departmentGroups,
  expandedBrandKey,
  expandedDepartment,
  onExpandedBrandKeyChange,
  onExpandedDepartmentChange,
  onSelectCatalog,
  selectedCatalog,
}: {
  assistedCompanyId: string | null;
  departmentGroups: readonly CatalogDepartmentGroup[];
  expandedBrandKey: string | null;
  expandedDepartment: CatalogDepartment | null;
  onExpandedBrandKeyChange: (brandKey: string | null) => void;
  onExpandedDepartmentChange: (department: CatalogDepartment | null) => void;
  onSelectCatalog: (selection: CatalogSelection) => void | Promise<boolean>;
  selectedCatalog: CatalogSelection;
}) {
  const t = useT();

  return (
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
        assistedCompanyId={assistedCompanyId}
        departmentGroups={departmentGroups}
        expandedBrandKey={expandedBrandKey}
        expandedDepartment={expandedDepartment}
        idPrefix="catalog-desktop-catalog"
        onExpandedBrandKeyChange={onExpandedBrandKeyChange}
        onExpandedDepartmentChange={onExpandedDepartmentChange}
        onSelectCatalog={onSelectCatalog}
        selectedCatalog={selectedCatalog}
        variant="desktop"
      />
    </div>
  );
}

function CatalogLoadErrorBanner({
  loading,
  onRetry,
}: {
  loading: boolean;
  onRetry: () => void;
}) {
  const t = useT();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="min-w-0">
          <div className="font-black">
            {tx(t, "storefront.catalog.loadErrorTitle", "Catalogo non aggiornato")}
          </div>
          <div className="mt-0.5 text-xs font-semibold leading-5 text-amber-900">
            {tx(
              t,
              "storefront.catalog.loadErrorDescription",
              "La selezione precedente resta visibile. Riprova quando la connessione e stabile."
            )}
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="bg-white"
        disabled={loading}
        onClick={onRetry}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {tx(t, "storefront.catalog.retry", "Riprova")}
      </Button>
    </div>
  );
}


function buildCatalogSelectionPath(
  selection: CatalogSelection,
  assistedCompanyId?: string | null
) {
  const params = new URLSearchParams();

  if (selection.department) {
    params.set("department", selection.department);
  }

  if (selection.brand) {
    params.set("brand", selection.brand);
  }

  if (selection.category) {
    params.set("category", selection.category);
  }

  if (selection.modelSeries && !selection.model) {
    params.set("modelSeries", selection.modelSeries);
  }

  if (selection.model) {
    params.set("model", selection.model);
  }

  if (selection.searchQuery) {
    params.set("q", selection.searchQuery);
  }

  if (selection.inStockOnly) {
    params.set("minStock", "1");
  }

  params.set("sort", normalizeCatalogSort(selection.sort));

  return hrefWithAssistedCompanyId(
    `/catalogo${params.toString() ? `?${params.toString()}` : ""}`,
    assistedCompanyId
  );
}

async function recordCatalogActivity(
  selection: CatalogSelection,
  accountAccess?: StoreHeaderAccountAccess
) {
  if (!accountAccess?.authenticated) {
    return;
  }

  const eventType = selection.searchQuery
    ? "catalog_search"
    : selection.model
      ? "model_view"
      : selection.department ||
          selection.brand ||
          selection.category ||
          selection.modelSeries ||
          selection.inStockOnly
        ? "catalog_filter"
        : null;

  if (!eventType) {
    return;
  }

  const filterSummary = eventType === "catalog_filter" ? catalogFilterSummary(selection) : null;
  const activitySearchQuery = selection.searchQuery ?? filterSummary;
  const modelSeries =
    selection.modelSeries ??
    (selection.brand && selection.model ? inferDeviceModelSeries(selection.brand, selection.model) : null);
  const dedupeKey = [
    "partspro",
    "activity",
    eventType,
    selection.department,
    selection.brand,
    modelSeries,
    selection.model,
    selection.category,
    activitySearchQuery,
    selection.inStockOnly ? "stock" : "",
  ]
    .filter(Boolean)
    .join(":");

  try {
    const previous = Number(window.sessionStorage.getItem(dedupeKey) ?? "0");
    const now = Date.now();

    if (Number.isFinite(previous) && now - previous < 5 * 60 * 1000) {
      return;
    }

    window.sessionStorage.setItem(dedupeKey, String(now));
  } catch {
    // Browsing should stay responsive even when storage is unavailable.
  }

  await fetch("/api/customer-activity", {
    body: JSON.stringify({
      brand: selection.brand ?? null,
      eventType,
      metadata: {
        category: selection.category ?? null,
        department: selection.department ?? null,
        inStockOnly: Boolean(selection.inStockOnly),
      },
      model: selection.model ?? null,
      modelSeries,
      searchQuery: activitySearchQuery,
    }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  }).catch(() => {
    // Not every authenticated visitor has a customer profile yet.
  });
}

function catalogFilterSummary(selection: CatalogSelection) {
  const parts = [
    selection.department ? `Reparto: ${selection.department}` : null,
    selection.brand ? `Brand: ${selection.brand}` : null,
    selection.category ? `Categoria: ${selection.category}` : null,
    selection.modelSeries ? `Serie: ${selection.modelSeries}` : null,
    selection.inStockOnly ? "Solo disponibili" : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildCatalogApiPath(
  selection: CatalogSelection,
  offset = 0,
  assistedCompanyId?: string | null,
  limit = visibleProductsIncrement
) {
  const params = new URLSearchParams();

  if (selection.department) {
    params.set("department", selection.department);
  }

  if (selection.brand) {
    params.set("brand", selection.brand);
  }

  if (selection.category) {
    params.set("category", selection.category);
  }

  if (selection.modelSeries && !selection.model) {
    params.set("modelSeries", selection.modelSeries);
  }

  if (selection.model) {
    params.set("model", selection.model);
  }

  if (selection.searchQuery) {
    params.set("q", selection.searchQuery);
  }

  if (selection.inStockOnly) {
    params.set("minStock", "1");
  }

  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("sort", normalizeCatalogSort(selection.sort));

  return hrefWithAssistedCompanyId(
    `/api/catalogo?${params.toString()}`,
    assistedCompanyId
  );
}

function rememberCatalogPage(
  cache: Map<string, { products: PartProduct[]; total: number; expiresAt: number }>,
  key: string,
  page: { products: PartProduct[]; total: number; expiresAt: number }
) {
  cache.set(key, page);

  if (cache.size <= 20) {
    return;
  }

  const firstKey = cache.keys().next().value;

  if (firstKey) {
    cache.delete(firstKey);
  }
}

function readDepartmentFilter(filters: CatalogFiltersState) {
  const department = filters.department[0];

  return catalogDepartments.includes(department as CatalogDepartment)
    ? (department as CatalogDepartment)
    : null;
}

function mergeUniqueProducts(current: PartProduct[], next: PartProduct[]) {
  return [...new Map([...current, ...next].map(product => [product.sku, product])).values()];
}
