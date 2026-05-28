"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Grid3X3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { products as localProducts } from "@/lib/partspro-data";
import type { DeviceModelGroup, PartProduct } from "@/lib/partspro-data";
import { inferDeviceModelSeries } from "@/lib/partspro-device-series";
import type { PriceVisibilityReason } from "@/lib/partspro-account-context";
import type { StoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { CatalogBrandTree, type CatalogSelection } from "./catalog-brand-tree";
import { ProductCard } from "./product-card";
import { StoreHeader } from "./store-header";

type FilterKey = "brand" | "category" | "status" | "grade";

type CatalogFiltersState = Record<FilterKey, string[]>;

const emptyFilters: CatalogFiltersState = {
  brand: [],
  category: [],
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

  return {
    ...emptyFilters,
    brand: brand ? [brand] : [],
    category: category ? [category] : [],
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
  filteredTotal?: number;
  initialAccountAccess?: StoreHeaderAccountAccess;
  initialModelGroups?: DeviceModelGroup[];
  initialProducts?: PartProduct[];
  priceGateReason?: PriceVisibilityReason;
  showWholesalePrice?: boolean;
};

export function CatalogPage({
  filteredTotal,
  initialAccountAccess,
  initialModelGroups,
  initialProducts = localProducts,
  priceGateReason = "login_required",
  showWholesalePrice = false,
}: CatalogPageProps) {
  const searchParams = useSearchParams();

  return (
    <CatalogPageContent
      filteredTotal={filteredTotal ?? initialProducts.length}
      initialAccountAccess={initialAccountAccess}
      initialFilters={getFiltersFromParams(searchParams)}
      initialInStockOnly={getInStockOnlyFromParams(searchParams)}
      initialModelGroups={initialModelGroups}
      initialProducts={initialProducts}
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
  initialAccountAccess,
  initialFilters,
  initialInStockOnly,
  initialModelGroups,
  initialProducts,
  initialModelSeries,
  initialSearchQuery,
  initialSearchTerm,
  priceGateReason,
  showWholesalePrice,
}: {
  filteredTotal: number;
  initialAccountAccess?: StoreHeaderAccountAccess;
  initialFilters: CatalogFiltersState;
  initialInStockOnly: boolean;
  initialModelGroups?: DeviceModelGroup[];
  initialProducts: PartProduct[];
  initialModelSeries: string;
  initialSearchQuery: string;
  initialSearchTerm: string;
  priceGateReason: PriceVisibilityReason;
  showWholesalePrice: boolean;
}) {
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
  const [expandedBrand, setExpandedBrand] = useState<string | null>(
    () => initialFilters.brand[0] ?? null
  );
  const catalogPageCacheRef = useRef(
    new Map<string, { products: PartProduct[]; total: number }>([
      [
        buildCatalogApiPath(
          {
            brand: initialFilters.brand[0],
            category: initialFilters.category[0],
            inStockOnly: initialInStockOnly || undefined,
            model: initialSearchTerm || undefined,
            modelSeries: initialModelSeries || undefined,
            searchQuery: initialSearchQuery || undefined,
          },
          0
        ),
        {
          products: initialProducts,
          total: initialFilteredTotal,
        },
      ],
    ])
  );
  const catalogRequestRef = useRef<AbortController | null>(null);
  const modelGroups = useMemo(
    () => initialModelGroups ?? buildModelGroups(initialProducts),
    [initialModelGroups, initialProducts]
  );
  const selectedBrand = filters.brand[0];
  const selectedCategory = filters.category[0];
  const selectedCatalog = useMemo(
    () => ({
      brand: selectedBrand,
      category: selectedCategory,
      inStockOnly,
      model: searchTerm.trim() || undefined,
      modelSeries: modelSeries || undefined,
      searchQuery: searchQuery.trim() || undefined,
    }),
    [inStockOnly, modelSeries, searchQuery, searchTerm, selectedBrand, selectedCategory]
  );
  const initialActivitySelectionRef = useRef<CatalogSelection>({
    brand: initialFilters.brand[0],
    category: initialFilters.category[0],
    inStockOnly: initialInStockOnly || undefined,
    model: initialSearchTerm || undefined,
    modelSeries: initialModelSeries || undefined,
    searchQuery: initialSearchQuery || undefined,
  });
  const loadCatalogSelection = useCallback(
    async (selection: CatalogSelection, offset = 0) => {
      const apiPath = buildCatalogApiPath(selection, offset);
      const cachedPage = catalogPageCacheRef.current.get(apiPath);
      const tracksLatestRequest = offset === 0;

      if (tracksLatestRequest) {
        catalogRequestRef.current?.abort();
      }

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
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          data?: PartProduct[];
          meta?: { total?: number };
        };
        const nextProducts = payload.data ?? [];
        const nextTotal = payload.meta?.total ?? nextProducts.length;

        rememberCatalogPage(catalogPageCacheRef.current, apiPath, {
          products: nextProducts,
          total: nextTotal,
        });

        setFilteredTotal(nextTotal);
        setProducts((currentProducts) =>
          offset > 0 ? [...currentProducts, ...nextProducts] : nextProducts
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
      } finally {
        if (!tracksLatestRequest || catalogRequestRef.current === controller) {
          if (tracksLatestRequest) {
            catalogRequestRef.current = null;
          }
          setCatalogLoadState("idle");
        }
      }
    },
    []
  );

  useEffect(() => {
    void recordCatalogActivity(initialActivitySelectionRef.current, initialAccountAccess);
  }, [initialAccountAccess]);

  useEffect(() => {
    function syncCatalogStateFromLocation() {
      const search = new URLSearchParams(window.location.search);
      const nextFilters = getFiltersFromParams(search);
      const nextSelection = {
        brand: nextFilters.brand[0],
        category: nextFilters.category[0],
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
      setExpandedBrand(nextFilters.brand[0] ?? null);
      void loadCatalogSelection(nextSelection);
    }

    window.addEventListener("popstate", syncCatalogStateFromLocation);

    return () => {
      window.removeEventListener("popstate", syncCatalogStateFromLocation);
    };
  }, [loadCatalogSelection]);

  const hiddenProductCount = Math.max(filteredTotal - products.length, 0);

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
    };

    setSearchTerm(selection.model ?? "");
    setSearchQuery(selection.searchQuery ?? "");
    setModelSeries(selection.modelSeries ?? "");
    setFilters(nextFilters);
    setInStockOnly(Boolean(selection.inStockOnly));
    setExpandedBrand(selection.brand ?? null);
    window.history.pushState(null, "", buildCatalogSelectionPath(selection));
    void recordCatalogActivity(selection, initialAccountAccess);
    void loadCatalogSelection(selection);
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#f4f6fa] text-slate-950">
      <StoreHeader
        initialAccountAccess={initialAccountAccess}
        modelGroups={modelGroups}
        onCatalogSelect={selectCatalog}
        selectedCatalog={selectedCatalog}
      />
      <div className="mx-auto grid max-w-[1500px] gap-5 px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <CatalogNavigationSidebar
            expandedBrand={expandedBrand}
            modelGroups={modelGroups}
            onExpandedBrandChange={setExpandedBrand}
            onSelectCatalog={selectCatalog}
            selectedCatalog={selectedCatalog}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          {products.length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.sku}
                    priceGateReason={priceGateReason}
                    priorityImage={index === 0}
                    product={product}
                    showWholesalePrice={showWholesalePrice}
                  />
                ))}
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
                    {catalogLoadState === "loading-more"
                      ? "Caricamento..."
                      : `Carica altri ${Math.min(
                          hiddenProductCount,
                          visibleProductsIncrement
                        )} SKU`}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card className="rounded-lg border-slate-200 bg-white">
              <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-black">Nessun ricambio trovato</div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    Modifica ricerca o filtri rapidi per tornare al listino disponibile.
                  </p>
                </div>
                <Button className="w-full rounded-full sm:w-auto" onClick={clearAll}>
                  <RotateCcw className="size-4" />
                  Cancella filtri
                </Button>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}

function CatalogNavigationSidebar({
  expandedBrand,
  modelGroups,
  onExpandedBrandChange,
  onSelectCatalog,
  selectedCatalog,
}: {
  expandedBrand: string | null;
  modelGroups: readonly DeviceModelGroup[];
  onExpandedBrandChange: (brand: string | null) => void;
  onSelectCatalog: (selection: CatalogSelection) => void;
  selectedCatalog: CatalogSelection;
}) {
  return (
    <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black">Catalogo rapido</h2>
          <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
            Brand e modelli
          </p>
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary">
          <Grid3X3 className="size-4" />
        </div>
      </div>
      <CatalogBrandTree
        expandedBrand={expandedBrand}
        idPrefix="catalog-desktop-catalog"
        modelGroups={modelGroups}
        onExpandedBrandChange={onExpandedBrandChange}
        onSelectCatalog={onSelectCatalog}
        selectedCatalog={selectedCatalog}
        showAvailableLink
        variant="desktop"
      />
    </div>
  );
}

function buildModelGroups(items: PartProduct[]): DeviceModelGroup[] {
  const groups = new Map<
    string,
    {
      models: Set<string>;
      series: Map<string, Set<string>>;
    }
  >();

  for (const item of items) {
    const brand = item.brand.trim();

    if (!brand) {
      continue;
    }

    const group = groups.get(brand) ?? {
      models: new Set<string>(),
      series: new Map<string, Set<string>>(),
    };

    for (const model of item.compatibleWith) {
      const normalizedModel = model.trim();

      if (normalizedModel) {
        group.models.add(normalizedModel);

        const series = inferDeviceModelSeries(brand, normalizedModel);

        if (series) {
          const seriesModels = group.series.get(series) ?? new Set<string>();
          seriesModels.add(normalizedModel);
          group.series.set(series, seriesModels);
        }
      }
    }

    groups.set(brand, group);
  }

  return Array.from(groups.entries()).map(([brand, group]) => ({
    brand,
    models: Array.from(group.models).sort(compareModelNames),
    series: Array.from(group.series.entries())
      .map(([series, models]) => ({
        series,
        models: Array.from(models).sort(compareModelNames),
      }))
      .filter((entry) => entry.models.length > 0)
      .sort((left, right) => left.series.localeCompare(right.series, "it", { numeric: true })),
  }));
}

function buildCatalogSelectionPath(selection: CatalogSelection) {
  const params = new URLSearchParams();

  if (selection.brand) {
    params.set("brand", selection.brand);
  }

  if (selection.category) {
    params.set("category", selection.category);
  }

  if (selection.modelSeries) {
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

  const query = params.toString();

  return query ? `/catalogo?${query}` : "/catalogo";
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
      : selection.brand || selection.category || selection.modelSeries || selection.inStockOnly
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
    selection.brand ? `Brand: ${selection.brand}` : null,
    selection.category ? `Categoria: ${selection.category}` : null,
    selection.modelSeries ? `Serie: ${selection.modelSeries}` : null,
    selection.inStockOnly ? "Solo disponibili" : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildCatalogApiPath(selection: CatalogSelection, offset = 0) {
  const params = new URLSearchParams();

  if (selection.brand) {
    params.set("brand", selection.brand);
  }

  if (selection.category) {
    params.set("category", selection.category);
  }

  if (selection.modelSeries) {
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

  return `/api/catalogo?${params.toString()}`;
}

function compareModelNames(left: string, right: string) {
  return left.localeCompare(right, "it", { numeric: true, sensitivity: "base" });
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
