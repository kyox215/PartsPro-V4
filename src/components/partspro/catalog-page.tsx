"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Grid3X3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { products as localProducts } from "@/lib/partspro-data";
import type { DeviceModelGroup, PartProduct } from "@/lib/partspro-data";
import { CatalogBrandTree, type CatalogSelection } from "./catalog-brand-tree";
import { ProductCard } from "./product-card";
import { StoreHeader } from "./store-header";

type FilterKey = "brand" | "category" | "status" | "grade" | "warehouse";

type CatalogFiltersState = Record<FilterKey, string[]>;

const emptyFilters: CatalogFiltersState = {
  brand: [],
  category: [],
  status: [],
  grade: [],
  warehouse: [],
};
const visibleProductsIncrement = 48;

type CatalogSearchParams = {
  get: (name: string) => string | null;
};

function getFiltersFromParams(searchParams: CatalogSearchParams): CatalogFiltersState {
  const brand = searchParams.get("brand");

  return {
    ...emptyFilters,
    brand: brand ? [brand] : [],
  };
}

function getModelSearchFromParams(searchParams: CatalogSearchParams) {
  return searchParams.get("model") ?? "";
}

function getInStockOnlyFromParams(searchParams: CatalogSearchParams) {
  return Number(searchParams.get("minStock") ?? "0") > 0;
}

type CatalogPageProps = {
  filteredTotal?: number;
  initialModelGroups?: DeviceModelGroup[];
  initialProducts?: PartProduct[];
  showWholesalePrice?: boolean;
};

export function CatalogPage({
  filteredTotal,
  initialModelGroups,
  initialProducts = localProducts,
  showWholesalePrice = false,
}: CatalogPageProps) {
  const searchParams = useSearchParams();

  return (
    <CatalogPageContent
      filteredTotal={filteredTotal ?? initialProducts.length}
      initialFilters={getFiltersFromParams(searchParams)}
      initialInStockOnly={getInStockOnlyFromParams(searchParams)}
      initialModelGroups={initialModelGroups}
      initialProducts={initialProducts}
      initialSearchTerm={getModelSearchFromParams(searchParams)}
      showWholesalePrice={showWholesalePrice}
    />
  );
}

function CatalogPageContent({
  filteredTotal: initialFilteredTotal,
  initialFilters,
  initialInStockOnly,
  initialModelGroups,
  initialProducts,
  initialSearchTerm,
  showWholesalePrice,
}: {
  filteredTotal: number;
  initialFilters: CatalogFiltersState;
  initialInStockOnly: boolean;
  initialModelGroups?: DeviceModelGroup[];
  initialProducts: PartProduct[];
  initialSearchTerm: string;
  showWholesalePrice: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
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
  const modelGroups = useMemo(
    () => initialModelGroups ?? buildModelGroups(initialProducts),
    [initialModelGroups, initialProducts]
  );
  const selectedBrand = filters.brand[0];
  const selectedCatalog = useMemo(
    () => ({
      brand: selectedBrand,
      inStockOnly,
      model: searchTerm.trim() || undefined,
    }),
    [inStockOnly, searchTerm, selectedBrand]
  );
  const loadCatalogSelection = useCallback(
    async (selection: CatalogSelection, offset = 0) => {
      setCatalogLoadState(offset > 0 ? "loading-more" : "loading");

      try {
        const response = await fetch(buildCatalogApiPath(selection, offset));

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          data?: PartProduct[];
          meta?: { total?: number };
        };
        const nextProducts = payload.data ?? [];

        setFilteredTotal(payload.meta?.total ?? nextProducts.length);
        setProducts((currentProducts) =>
          offset > 0 ? [...currentProducts, ...nextProducts] : nextProducts
        );
      } finally {
        setCatalogLoadState("idle");
      }
    },
    []
  );

  useEffect(() => {
    function syncCatalogStateFromLocation() {
      const search = new URLSearchParams(window.location.search);
      const nextFilters = getFiltersFromParams(search);
      const nextSelection = {
        brand: nextFilters.brand[0],
        inStockOnly: getInStockOnlyFromParams(search),
        model: getModelSearchFromParams(search) || undefined,
      };

      setSearchTerm(nextSelection.model ?? "");
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
    setFilters(emptyFilters);
    setInStockOnly(false);
    selectCatalog({});
  }

  function selectCatalog(selection: CatalogSelection) {
    const nextFilters: CatalogFiltersState = {
      ...emptyFilters,
      brand: selection.brand ? [selection.brand] : [],
    };

    setSearchTerm(selection.model ?? "");
    setFilters(nextFilters);
    setInStockOnly(Boolean(selection.inStockOnly));
    setExpandedBrand(selection.brand ?? null);
    window.history.pushState(null, "", buildCatalogSelectionPath(selection));
    void loadCatalogSelection(selection);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader
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
                {products.map((product) => (
                  <ProductCard
                    key={product.sku}
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
  const groups = new Map<string, Set<string>>();

  for (const item of items) {
    const brand = item.brand.trim();

    if (!brand) {
      continue;
    }

    const models = groups.get(brand) ?? new Set<string>();

    for (const model of item.compatibleWith) {
      const normalizedModel = model.trim();

      if (normalizedModel) {
        models.add(normalizedModel);
      }
    }

    groups.set(brand, models);
  }

  return Array.from(groups.entries()).map(([brand, models]) => ({
    brand,
    models: Array.from(models).sort((left, right) =>
      left.localeCompare(right, "it", { numeric: true, sensitivity: "base" })
    ),
  }));
}

function buildCatalogSelectionPath(selection: CatalogSelection) {
  const params = new URLSearchParams();

  if (selection.brand) {
    params.set("brand", selection.brand);
  }

  if (selection.model) {
    params.set("model", selection.model);
  }

  if (selection.inStockOnly) {
    params.set("minStock", "1");
  }

  const query = params.toString();

  return query ? `/catalogo?${query}` : "/catalogo";
}

function buildCatalogApiPath(selection: CatalogSelection, offset = 0) {
  const params = new URLSearchParams();

  if (selection.brand) {
    params.set("brand", selection.brand);
  }

  if (selection.model) {
    params.set("model", selection.model);
  }

  if (selection.inStockOnly) {
    params.set("minStock", "1");
  }

  params.set("limit", String(visibleProductsIncrement));
  params.set("offset", String(offset));
  params.set("sort", "stock_desc");

  return `/api/catalogo?${params.toString()}`;
}
