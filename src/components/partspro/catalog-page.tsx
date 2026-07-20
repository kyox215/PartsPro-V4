"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Grid3X3, Loader2, RotateCcw } from "lucide-react";
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
import { tx, txFormat } from "@/i18n/dictionaries/storefront";
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
import { CatalogBrandTree, type CatalogSelection } from "./catalog-brand-tree";
import { ProductCard } from "./product-card";
import { StoreHeader } from "./store-header";
import { useT } from "./i18n-provider";
import {
  DelayedPendingIndicator,
  useDelayedVisible,
} from "./pending-feedback";

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
    <CatalogPageContent
      filteredTotal={filteredTotal ?? initialProducts.length}
      assistedCompanyId={assistedCompanyId}
      assistedCompanyName={assistedCompanyName}
      initialAccountAccess={initialAccountAccess}
      initialFilters={getFiltersFromParams(searchParams)}
      initialInStockOnly={getInStockOnlyFromParams(searchParams)}
      initialDepartmentGroups={initialDepartmentGroups}
      initialProducts={initialProducts}
      cartAccess={cartAccess}
      initialModelSeries={getModelSeriesFromParams(searchParams)}
      initialSearchQuery={getSearchQueryFromParams(searchParams)}
      initialSearchTerm={getModelSearchFromParams(searchParams)}
      priceGateReason={priceGateReason}
      showWholesalePrice={showWholesalePrice}
    />
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
  initialDepartmentGroups?: CatalogDepartmentGroup[];
  initialProducts: PartProduct[];
  initialModelSeries: string;
  initialSearchQuery: string;
  initialSearchTerm: string;
  priceGateReason: PriceVisibilityReason;
  showWholesalePrice: boolean;
}) {
  const t = useT();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [modelSeries, setModelSeries] = useState(initialModelSeries);
  const [filters, setFilters] = useState<CatalogFiltersState>(initialFilters);
  const [inStockOnly, setInStockOnly] = useState(initialInStockOnly);
  const [products, setProducts] = useState(initialProducts);
  const [filteredTotal, setFilteredTotal] = useState(initialFilteredTotal);
  const [catalogLoadState, setCatalogLoadState] = useState<
    "idle" | "loading" | "loading-more"
  >("idle");
  const [catalogError, setCatalogError] = useState<"network" | null>(null);
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
    new Map<string, { products: PartProduct[]; total: number }>([
      [
        buildCatalogApiPath(
          {
            brand: initialFilters.brand[0],
            category: initialFilters.category[0],
            department: initialDepartment ?? undefined,
            inStockOnly: initialInStockOnly,
            model: initialSearchTerm || undefined,
            modelSeries: initialModelSeries || undefined,
            searchQuery: initialSearchQuery || undefined,
          },
          0,
          assistedCompanyId
        ),
        {
          products: initialProducts,
          total: initialFilteredTotal,
        },
      ],
    ])
  );
  const catalogRequestRef = useRef<AbortController | null>(null);
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
      model: searchTerm.trim() || undefined,
      modelSeries: modelSeries || undefined,
      searchQuery: searchQuery.trim() || undefined,
    }),
    [
      inStockOnly,
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
      const tracksLatestRequest = offset === 0;

      if (tracksLatestRequest) {
        catalogRequestRef.current?.abort();
      }

      setCatalogError(null);
      setCatalogLoadState(offset > 0 ? "loading-more" : "loading");

      if (cachedPage) {
        setFilteredTotal(cachedPage.total);
        setProducts((currentProducts) =>
          offset > 0 ? [...currentProducts, ...cachedPage.products] : cachedPage.products
        );
        setCatalogLoadState("idle");
        return;
      }

      const controller = new AbortController();

      if (tracksLatestRequest) {
        catalogRequestRef.current = controller;
      }

      try {
        const response = await fetch(apiPath, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setCatalogError("network");
          return;
        }

        const payload = (await response.json()) as {
          data?: PartProduct[];
          meta?: { total?: number };
        };
        const nextProducts = payload.data ?? [];
        const nextTotal = payload.meta?.total ?? nextProducts.length;

        if (shouldUseCatalogPageCache) {
          rememberCatalogPage(catalogPageCacheRef.current, apiPath, {
            products: nextProducts,
            total: nextTotal,
          });
        }

        setFilteredTotal(nextTotal);
        setProducts((currentProducts) =>
          offset > 0 ? [...currentProducts, ...nextProducts] : nextProducts
        );
        setCatalogError(null);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setCatalogError("network");
      } finally {
        if (!tracksLatestRequest || catalogRequestRef.current === controller) {
          if (tracksLatestRequest) {
            catalogRequestRef.current = null;
          }
          setCatalogLoadState("idle");
        }
      }
    },
    [assistedCompanyId, shouldUseCatalogPageCache]
  );

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
        model: getModelSearchFromParams(search) || undefined,
        modelSeries: getModelSeriesFromParams(search) || undefined,
        searchQuery: getSearchQueryFromParams(search) || undefined,
      };

      setSearchTerm(nextSelection.model ?? "");
      setSearchQuery(nextSelection.searchQuery ?? "");
      setModelSeries(nextSelection.modelSeries ?? "");
      setFilters(nextFilters);
      setInStockOnly(Boolean(nextSelection.inStockOnly));
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
  const showCatalogPendingHint = useDelayedVisible(catalogReplacing, 120);
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
    selectCatalog({});
  }

  function selectCatalog(selection: CatalogSelection) {
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
    <main className="min-h-screen overflow-x-clip bg-[#f4f6fa] text-slate-950">
      <StoreHeader
        assistedCompanyId={assistedCompanyId}
        departmentGroups={departmentGroups}
        initialAccountAccess={initialAccountAccess}
        onCatalogSelect={selectCatalog}
        selectedCatalog={selectedCatalog}
      />
      <div className="mx-auto grid max-w-[1500px] gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
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

        <section className="min-w-0 space-y-3">
          {assistedCompanyId ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
              {assistedCompanyName
                ? `${tx(t, "storefront.assistedOrder.catalogBanner", "Ordine per cliente")}: ${assistedCompanyName}`
                : tx(t, "storefront.assistedOrder.catalogBannerGeneric", "Ordine per cliente: prezzi del cliente selezionato")}
            </div>
          ) : null}
          {accountGateCopy ? <CatalogAccountGateBanner copy={accountGateCopy} /> : null}
          {catalogError ? (
            <CatalogLoadErrorBanner
              loading={catalogLoadState !== "idle"}
              onRetry={() => {
                void loadCatalogSelection(selectedCatalog);
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
          {products.length > 0 || catalogReplacing ? (
            <div className="space-y-3">
              <div
                className="relative min-h-[320px]"
                aria-busy={catalogReplacing}
                aria-live="polite"
              >
                {products.length > 0 ? (
                  <div
                    className={cn(
                      "partspro-catalog-grid transition-opacity duration-150",
                      catalogReplacing && "opacity-45"
                    )}
                  >
                    {products.map((product, index) => (
                      <ProductCard
                        assistedCompanyId={assistedCompanyId}
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
              {hiddenProductCount > 0 && (
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
            <Card className="rounded-lg border-slate-200 bg-white">
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
    <div className="partspro-catalog-grid">
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
  params.set("sort", "stock_desc");

  return hrefWithAssistedCompanyId(
    `/api/catalogo?${params.toString()}`,
    assistedCompanyId
  );
}

function rememberCatalogPage(
  cache: Map<string, { products: PartProduct[]; total: number }>,
  key: string,
  page: { products: PartProduct[]; total: number }
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
