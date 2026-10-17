"use client";

import { catalogBrowseKey } from "@/lib/partspro-catalog-return.mjs";
import { AsyncFeedback } from "./async-feedback";
import { PricingSessionBoundary, QuoteExpiryRefresh } from "./pricing-session-boundary";
import { createLatestRequest } from "@/lib/latest-request.mjs";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronRight, Grid3X3, Loader2, RotateCcw } from "lucide-react";
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
  DelayedPendingIndicator,
  useDelayedVisible,
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
      key={JSON.stringify([initialAccountAccess?.userId, assistedCompanyId, initialProducts.map((product) => [product.sku, product.priceVersion])])}
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
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [modelSeries, setModelSeries] = useState(initialModelSeries);
  const [filters, setFilters] = useState<CatalogFiltersState>(initialFilters);
  const [inStockOnly, setInStockOnly] = useState(initialInStockOnly);
  const [sort, setSort] = useState<CatalogSort>(initialSort);
  const [products, setProducts] = useState(initialProducts);
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
        if (request.isCurrent()) {
          setCatalogLoadState("idle");
        }
      }
    },
    [assistedCompanyId, shouldUseCatalogPageCache]
  );

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const stored = JSON.parse(sessionStorage.getItem(browseKey) || "null") as { count?: number; scrollY?: number; savedAt?: number } | null;
        if (!stored || Date.now() - (stored.savedAt || 0) > 30 * 60_000) return;
        const desired = Math.min(Math.max(Math.trunc(Number(stored.count)) || 0, 0), initialFilteredTotal);
        let offset = initialProducts.length;
        while (!cancelled && offset < desired) {
          const page = await loadCatalogSelection(initialActivitySelectionRef.current, offset);
          if (!page || page.count === 0) break;
          offset += page.count;
          if (offset >= page.total) break;
        }
        if (!cancelled) requestAnimationFrame(() => window.scrollTo({ top: Math.max(0, Number(stored.scrollY) || 0), behavior: "instant" }));
      } catch { /* unavailable session storage must not block browsing */ }
    }
    void restore();
    return () => { cancelled = true; };
  }, [browseKey, initialProducts.length, initialFilteredTotal, loadCatalogSelection]);

  function rememberBrowse() {
    try {
      const path = buildCatalogSelectionPath(selectedCatalog, assistedCompanyId);
      sessionStorage.setItem(catalogBrowseKey(path, initialAccountAccess?.userId, assistedCompanyId), JSON.stringify({ count: products.length, scrollY: window.scrollY, savedAt: Date.now() }));
    } catch { /* browsing still works */ }
  }

  useEffect(() => {
    const refresh = () => {
      catalogPageCacheRef.current.clear();
      void loadCatalogSelection(selectedCatalog);
    };
    window.addEventListener("partspro:catalog-refreshed", refresh);
    return () => window.removeEventListener("partspro:catalog-refreshed", refresh);
  }, [loadCatalogSelection, selectedCatalog]);

  useEffect(() => {
    void recordCatalogActivity(initialActivitySelectionRef.current, initialAccountAccess);
  }, [initialAccountAccess]);

  useEffect(() => {
    rememberAssistedCompanyId(assistedCompanyId);
  }, [assistedCompanyId]);

  useEffect(() => {
    function syncCatalogStateFromLocation() {
      const search = new URLSearchParams(window.location.search);
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
    }

    window.addEventListener("popstate", syncCatalogStateFromLocation);

    return () => {
      window.removeEventListener("popstate", syncCatalogStateFromLocation);
    };
  }, [loadCatalogSelection]);

  const hiddenProductCount = Math.max(filteredTotal - products.length, 0);
  const catalogReplacing = catalogLoadState === "loading";
  const showCatalogPendingHint = useDelayedVisible(catalogReplacing, 80);
  const showCatalogSkeleton = useDelayedVisible(catalogReplacing, 300);
  const accountGateCopy =
    !assistedCompanyId && isCustomerActionRequiredReason(priceGateReason)
      ? getAccountGateCopy(t, priceGateReason)
      : null;

  function clearAll() {
    setSearchTerm("");
    setSearchQuery("");
    setFilters(emptyFilters);
    setInStockOnly(false);
    selectCatalog({ sort });
  }

  function selectCatalog(requestedSelection: CatalogSelection) {
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
    void loadCatalogSelection(selection);
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
          <nav className="pp-catalog-breadcrumb" aria-label={tx(t, "storefront.ux.browseCatalog", "Sfoglia catalogo")}><Link href="/">{tx(t, "nav.home", "Home")}</Link><ChevronRight className="size-3" /><span>{tx(t, "storefront.ux.browseCatalog", "Sfoglia catalogo")}</span>{selectedBrand ? <><ChevronRight className="size-3" /><span>{brandLabel(t, selectedBrand)}</span></> : null}</nav>
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
          {showCatalogPendingHint ? (
            <div
              className="flex items-center gap-2 rounded-lg border border-primary/15 bg-white px-3 py-2 text-xs font-black text-primary shadow-sm"
              role="status"
              aria-live="polite"
            >
              <DelayedPendingIndicator
                className="size-3.5 text-primary"
                delayMs={0}
                pending={catalogReplacing}
              />
              {tx(t, "storefront.catalog.filtering", "Filtro in corso...")}
            </div>
          ) : null}
          <div className="pp-catalog-toolbar">
            <h1 className="pp-catalog-title break-words">{searchQuery || searchTerm ? txFormat(t,"storefront.ux.searchResults","Risultati per “{query}”",{query:searchQuery || searchTerm}) : tx(t,"storefront.ux.browseCatalog","Sfoglia catalogo")}</h1>
            <p className="pp-catalog-count" role="status">{txFormat(t,"storefront.ux.resultCount","{loaded} di {total} SKU caricati",{loaded:products.length,total:filteredTotal})}</p>
            <p className="pp-catalog-description">{tx(t, "storefront.ui.catalog.subtitle", "Filtra i risultati e verifica la compatibilità prima di acquistare.")}</p>
            <div className="pp-catalog-filter-chips">
              {(["searchQuery","model","brand","category","department","modelSeries"] as const).map(key => selectedCatalog[key] ? <Button key={key} type="button" size="sm" variant="outline" className="max-w-full whitespace-normal" onClick={() => selectCatalog({...selectedCatalog,[key]:undefined})}>{key === "category" ? categoryLabel(t,String(selectedCatalog[key])) : key === "department" ? catalogDepartmentLabel(t, selectedCatalog[key] as CatalogDepartment) : key === "brand" ? brandLabel(t,String(selectedCatalog[key])) : String(selectedCatalog[key])} ×<span className="sr-only">{tx(t,"storefront.ux.removeFilter","Rimuovi filtro")}</span></Button> : null)}
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={inStockOnly} onChange={event => selectCatalog({...selectedCatalog,inStockOnly:event.target.checked})} className="size-5 accent-primary" />{tx(t,"storefront.ux.inStockOnly","Solo disponibili")}</label>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll}>{tx(t,"storefront.catalog.clearFilters","Cancella filtri")}</Button>
            </div>
            <div className="pp-catalog-selects">
            <label htmlFor="catalog-sort" className="pp-catalog-sort">
              <span>{locale.startsWith("zh") ? "排序" : "Ordina per"}</span>
              <select id="catalog-sort" value={sort} className="h-11 w-full min-w-0 rounded border bg-white px-2 sm:w-64" onChange={event => selectCatalog({ ...selectedCatalog, sort: normalizeCatalogSort(event.target.value) })}>
                <option value="stock_desc">{locale.startsWith("zh") ? "现货优先（默认）" : "Disponibilità (predefinito)"}</option>
                <option value="name">{locale.startsWith("zh") ? "商品名称" : "Nome prodotto"}</option>
                <option value="updated_desc">{locale.startsWith("zh") ? "最近更新" : "Aggiornati di recente"}</option>
              </select>
            </label>
          <label className="pp-catalog-category-filter">
            <span>{locale.startsWith("zh") ? "商品分类" : "Categoria"}</span>
            <select aria-label={locale.startsWith("zh") ? "商品分类" : "Categoria"} className="h-11 w-full min-w-0 rounded border bg-white px-2 sm:w-64" value={selectedCategory ?? ""} onChange={(e) => selectCatalog({ ...selectedCatalog, category: e.target.value || undefined })}>
              <option value="">{locale.startsWith("zh") ? "全部分类" : "Tutte le categorie"}</option>
              {directory.nodes.filter((n) => n.kind === "category" && n.active && (!selectedDepartment || (n.countsByDepartment[selectedDepartment] ?? 0) > 0)).map((n) => <option key={n.id} value={n.value}>{locale.startsWith("zh") && /^[\x00-\x7F]+$/.test(n.nameZh) ? categoryLabel(t,n.nameIt) : catalogNodeLabel(n, locale)}</option>)}
              {selectedCategory && !directory.nodes.some((n) => n.kind === "category" && n.value === selectedCategory) && <option value={selectedCategory}>{selectedCategory}</option>}
            </select>
          </label>
            </div>
          </div>
          {products.length > 0 || catalogReplacing ? (
            <div className="pp-catalog-products space-y-3">
              <div
                className="relative min-h-[320px]"
                aria-busy={catalogReplacing}
                aria-live="polite"
              >
                {products.length > 0 ? (
                  <div
                    inert={catalogReplacing}
                    aria-hidden={catalogReplacing || undefined}
                    className={cn(
                      "pp-product-grid partspro-catalog-grid transition-opacity duration-150 motion-reduce:transition-none",
                      catalogReplacing && "opacity-45"
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
                        showWholesalePrice={showWholesalePrice}
                      />
                    ))}
                  </div>
                ) : null}
                {showCatalogSkeleton ? (
                  <div
                    className={cn(
                      products.length > 0 &&
                        "pointer-events-none absolute inset-x-0 top-0"
                    )}
                  >
                    <CatalogProductSkeletonGrid count={products.length > 0 ? 10 : 8} />
                  </div>
                ) : null}
              </div>
              {catalogError && failedOffset > 0 && <AsyncFeedback state="error" title={tx(t,"storefront.ux.moreFailed","Impossibile caricare la pagina successiva")} description={tx(t,"storefront.ux.moreKept","I risultati già caricati restano disponibili.")} actions={<Button type="button" variant="outline" disabled={catalogLoadState !== "idle"} onClick={() => void loadCatalogSelection(selectedCatalog, failedOffset)}>{tx(t,"common.retry","Riprova")}</Button>} />}
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
                        {tx(t, "storefront.catalog.loadingMore", "Caricamento...")}
                      </>
                    ) : (
                      txFormat(t, "storefront.catalog.loadMore", "Carica altri {count} SKU", {
                          count: Math.min(
                            hiddenProductCount,
                            visibleProductsIncrement
                          ),
                        })
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
  onSelectCatalog: (selection: CatalogSelection) => void;
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

function CatalogProductSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="pp-product-grid partspro-catalog-grid">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-[184px] animate-pulse rounded-lg border border-slate-200 bg-white p-2 shadow-sm sm:h-[318px]"
        >
          <div className="h-28 rounded-md bg-slate-100 sm:h-36" />
          <div className="mt-2 h-4 w-5/6 rounded bg-slate-100" />
          <div className="mt-1.5 h-4 w-2/3 rounded bg-slate-100" />
          <div className="mt-2 grid grid-cols-2 gap-1">
            <div className="h-6 rounded bg-slate-100" />
            <div className="h-6 rounded bg-slate-100" />
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            <div className="space-y-1">
              <div className="h-5 w-16 rounded bg-slate-100" />
              <div className="h-3 w-24 rounded bg-slate-100" />
            </div>
            <div className="h-8 w-20 rounded-md bg-slate-100" />
          </div>
        </div>
      ))}
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

  params.set("limit", String(visibleProductsIncrement));
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
