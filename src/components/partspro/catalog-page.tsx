"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Truck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brands, categories, deviceModels, products } from "@/lib/partspro-data";
import type { PartProduct } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { ProductCard } from "./product-card";
import { StoreHeader } from "./store-header";

type FilterKey = "brand" | "category" | "status" | "grade" | "warehouse";
type SortKey = "recommended" | "stock" | "updated" | "name";

type CatalogFiltersState = Record<FilterKey, string[]>;

const emptyFilters: CatalogFiltersState = {
  brand: [],
  category: [],
  status: [],
  grade: [],
  warehouse: [],
};

const filterLabels: Record<FilterKey, string> = {
  brand: "Brand",
  category: "Categoria",
  status: "Stato",
  grade: "Qualita",
  warehouse: "Magazzino",
};

const sortLabels: Record<SortKey, string> = {
  recommended: "Consigliati",
  stock: "Stock alto",
  updated: "Aggiornati",
  name: "Nome A-Z",
};

const statusLabels: Record<PartProduct["status"], string> = {
  "In Stock": "Disponibili",
  "Low Stock": "Scorte basse",
  "Out of Stock": "Esauriti",
};

const statusOptions: PartProduct["status"][] = ["In Stock", "Low Stock", "Out of Stock"];
const gradeOptions: PartProduct["grade"][] = ["A+", "A", "B", "Refurbished"];
const warehouseOptions: PartProduct["warehouse"][] = ["Milano", "Roma", "Shenzhen"];
const modelSuggestions = deviceModels.flatMap((entry) => entry.models).slice(0, 10);

type CatalogSearchParams = {
  get: (name: string) => string | null;
};

function getFiltersFromParams(searchParams: CatalogSearchParams): CatalogFiltersState {
  const brand = searchParams.get("brand");

  return {
    ...emptyFilters,
    brand: brand && brands.includes(brand) ? [brand] : [],
  };
}

function getModelSearchFromParams(searchParams: CatalogSearchParams) {
  return searchParams.get("model") ?? "";
}

export function CatalogPage() {
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  return (
    <CatalogPageContent
      key={searchParamsKey}
      initialFilters={getFiltersFromParams(searchParams)}
      initialSearchTerm={getModelSearchFromParams(searchParams)}
    />
  );
}

function CatalogPageContent({
  initialFilters,
  initialSearchTerm,
}: {
  initialFilters: CatalogFiltersState;
  initialSearchTerm: string;
}) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [filters, setFilters] = useState<CatalogFiltersState>(initialFilters);
  const [sortKey, setSortKey] = useState<SortKey>("recommended");

  const filteredProducts = useMemo(() => {
    const query = normalize(searchTerm);
    const byFilter = products.filter((product) => {
      const searchableText = normalize(
        [
          product.sku,
          product.name,
          product.brand,
          product.category,
          product.compatibleWith.join(" "),
          product.tags.join(" "),
        ].join(" ")
      );

      if (query && !searchableText.includes(query)) {
        return false;
      }

      return (Object.keys(filters) as FilterKey[]).every((key) => {
        if (filters[key].length === 0) {
          return true;
        }

        return filters[key].includes(String(product[key]));
      });
    });

    return sortProducts(byFilter, sortKey);
  }, [filters, searchTerm, sortKey]);

  const activeCount = useMemo(
    () =>
      searchTerm.trim().length > 0
        ? 1 + countActiveFilters(filters) + (sortKey === "recommended" ? 0 : 1)
        : countActiveFilters(filters) + (sortKey === "recommended" ? 0 : 1),
    [filters, searchTerm, sortKey]
  );

  function toggleFilter(key: FilterKey, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  }

  function clearFilter(key: FilterKey, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value),
    }));
  }

  function clearGroup(key: FilterKey) {
    setFilters((current) => ({ ...current, [key]: [] }));
  }

  function clearAll() {
    setSearchTerm("");
    setFilters(emptyFilters);
    setSortKey("recommended");
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f6fa] text-slate-950">
      <StoreHeader />
      <div className="mx-auto grid max-w-[1500px] gap-5 px-3 py-4 sm:px-4 sm:py-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <CatalogFilters
            filters={filters}
            onClearGroup={clearGroup}
            onModelSearch={setSearchTerm}
            onToggleFilter={toggleFilter}
            searchTerm={searchTerm}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <Badge className="mb-3 rounded-full border border-primary/20 bg-primary/8 text-primary">
                  Catalogo B2B Italia
                </Badge>
                <h1 className="max-w-3xl text-2xl font-black tracking-normal sm:text-3xl md:text-4xl">
                  Ricambi pronti per laboratori e rivenditori
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Filtra per brand, modello e categoria. I prezzi wholesale sono
                  disponibili dopo la verifica della Partita IVA.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <details className="group lg:hidden">
                  <summary className="flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex items-center gap-2">
                      <SlidersHorizontal className="size-4" />
                      <span className="truncate">
                        Filtri{activeCount > 0 ? ` (${activeCount})` : ""}
                      </span>
                      <ChevronDown className="size-4 transition group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                    <div className="max-h-[60vh] overflow-y-auto pr-1">
                      <CatalogFilters
                        compact
                        filters={filters}
                        onClearGroup={clearGroup}
                        onModelSearch={setSearchTerm}
                        onToggleFilter={toggleFilter}
                        searchTerm={searchTerm}
                      />
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <Button
                        className="h-10 w-full rounded-full"
                        variant="outline"
                        onClick={clearAll}
                        disabled={activeCount === 0}
                      >
                        <RotateCcw className="size-4" />
                        Cancella filtri
                      </Button>
                    </div>
                  </div>
                </details>
                <Button variant="outline" className="hidden h-10 rounded-full bg-white lg:inline-flex">
                  <ArrowDownUp className="size-4" />
                  {sortLabels[sortKey]}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[
                {
                  icon: PackageCheck,
                  label: `${filteredProducts.length} di ${products.length} SKU`,
                  text: activeCount > 0 ? "Filtri attivi" : "Listino demo pronto",
                },
                {
                  icon: Truck,
                  label: "24/48h Italia",
                  text: "Priorità da magazzino locale",
                },
                {
                  icon: CheckCircle2,
                  label: "RMA tracciabile",
                  text: "Lotti e qualità visibili",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-primary shadow-sm">
                    <item.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black">{item.label}</div>
                    <div className="truncate text-xs text-slate-500">{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sticky top-[121px] z-20 space-y-3 rounded-lg border border-slate-200 bg-white/94 p-3 shadow-[0_12px_32px_rgba(15,23,42,0.06)] backdrop-blur md:top-32">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <label className="relative min-w-0" htmlFor="catalog-search">
                  <span className="sr-only">Cerca nel catalogo</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="catalog-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-11 rounded-full border-slate-200 bg-slate-50 pl-9 pr-10"
                    placeholder="Cerca SKU, nome, brand o modello..."
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-700"
                      aria-label="Svuota ricerca catalogo"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </label>
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="truncate text-sm font-black">Catalogo ricambi</div>
                  <div className="truncate text-xs text-slate-500">
                    {filteredProducts.length} risultati · prezzi B2B dopo login
                  </div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] xl:w-[360px]">
                <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                  <SelectTrigger
                    className="h-11 w-full min-w-0 rounded-full border-slate-200 bg-white"
                    aria-label="Ordina risultati catalogo"
                  >
                    <ArrowDownUp className="size-4 text-slate-500" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {sortLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  className="h-11 rounded-full bg-white"
                  onClick={clearAll}
                  disabled={activeCount === 0}
                >
                  <RotateCcw className="size-4" />
                  Reset
                </Button>
              </div>
            </div>

            <ActiveChips
              filters={filters}
              onClearAll={clearAll}
              onClearFilter={clearFilter}
              onClearSearch={() => setSearchTerm("")}
              onClearSort={() => setSortKey("recommended")}
              searchTerm={searchTerm}
              sortKey={sortKey}
            />
          </div>

          {filteredProducts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.sku} product={product} />
              ))}
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

function CatalogFilters({
  compact = false,
  filters,
  onClearGroup,
  onModelSearch,
  onToggleFilter,
  searchTerm,
}: {
  compact?: boolean;
  filters: CatalogFiltersState;
  onClearGroup: (key: FilterKey) => void;
  onModelSearch: (value: string) => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  searchTerm: string;
}) {
  return (
    <Card
      className={cn(
        "sticky top-32 rounded-lg border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]",
        compact && "static border-0 py-0 shadow-none ring-0"
      )}
    >
      <CardContent className={cn("space-y-5", compact ? "p-0" : "p-4")}>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-bold uppercase text-slate-400">Selezione rapida</div>
          <div className="mt-1 text-sm font-black text-slate-800">Ricambi per buyer verificati</div>
        </div>
        <FilterGroup
          filterKey="brand"
          items={brands}
          onClearGroup={onClearGroup}
          onToggle={onToggleFilter}
          selected={filters.brand}
          title="Brand"
        />
        <FilterGroup
          filterKey="category"
          items={categories.map((item) => item.label)}
          onClearGroup={onClearGroup}
          onToggle={onToggleFilter}
          selected={filters.category}
          title="Categorie"
        />
        <FilterGroup
          filterKey="status"
          formatLabel={(item) => statusLabels[item as PartProduct["status"]]}
          items={statusOptions}
          onClearGroup={onClearGroup}
          onToggle={onToggleFilter}
          selected={filters.status}
          title="Disponibilita"
        />
        <FilterGroup
          filterKey="grade"
          items={gradeOptions}
          onClearGroup={onClearGroup}
          onToggle={onToggleFilter}
          selected={filters.grade}
          title="Qualita"
        />
        <FilterGroup
          filterKey="warehouse"
          items={warehouseOptions}
          onClearGroup={onClearGroup}
          onToggle={onToggleFilter}
          selected={filters.warehouse}
          title="Magazzino"
        />
        <ModelSuggestionGroup
          title="Modelli frequenti"
          items={modelSuggestions}
          onSelect={onModelSearch}
          searchTerm={searchTerm}
        />
        {!compact && (
          <Button
            className="h-10 w-full rounded-full"
            variant="outline"
            onClick={() => {
              (Object.keys(emptyFilters) as FilterKey[]).forEach((key) => onClearGroup(key));
              onModelSearch("");
            }}
            disabled={countActiveFilters(filters) === 0 && !searchTerm}
          >
            <RotateCcw className="size-4" />
            Cancella filtri
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function FilterGroup({
  filterKey,
  formatLabel = (item) => item,
  items,
  onClearGroup,
  onToggle,
  selected,
  title,
}: {
  filterKey: FilterKey;
  formatLabel?: (item: string) => string;
  items: readonly string[];
  onClearGroup: (key: FilterKey) => void;
  onToggle: (key: FilterKey, value: string) => void;
  selected: string[];
  title: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="min-w-0 text-sm font-black">{title}</h2>
        {selected.length > 0 && (
          <button
            type="button"
            className="shrink-0 text-xs font-bold text-primary hover:underline"
            onClick={() => onClearGroup(filterKey)}
          >
            Pulisci
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isSelected = selected.includes(item);

          return (
          <button
            key={item}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(filterKey, item)}
            className={cn(
              "min-h-9 max-w-full min-w-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-semibold leading-4 text-slate-600 transition hover:border-primary/40 hover:bg-primary/8 hover:text-primary",
              "whitespace-normal break-words",
              isSelected && "border-primary/40 bg-primary/8 text-primary shadow-sm"
            )}
          >
            {formatLabel(item)}
          </button>
          );
        })}
      </div>
    </div>
  );
}

function ModelSuggestionGroup({
  items,
  onSelect,
  searchTerm,
  title,
}: {
  items: string[];
  onSelect: (value: string) => void;
  searchTerm: string;
  title: string;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-black">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const selected = normalize(searchTerm) === normalize(item);

          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? "" : item)}
              className={cn(
                "min-h-9 max-w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-semibold leading-4 text-slate-600 transition hover:border-primary/40 hover:bg-primary/8 hover:text-primary",
                "whitespace-normal break-words",
                selected && "border-primary/40 bg-primary/8 text-primary shadow-sm"
              )}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActiveChips({
  filters,
  onClearAll,
  onClearFilter,
  onClearSearch,
  onClearSort,
  searchTerm,
  sortKey,
}: {
  filters: CatalogFiltersState;
  onClearAll: () => void;
  onClearFilter: (key: FilterKey, value: string) => void;
  onClearSearch: () => void;
  onClearSort: () => void;
  searchTerm: string;
  sortKey: SortKey;
}) {
  const hasChips =
    Boolean(searchTerm.trim()) || countActiveFilters(filters) > 0 || sortKey !== "recommended";

  if (!hasChips) {
    return (
      <div className="flex flex-wrap gap-2">
        {["Disponibili ora", "Milano", "MOQ basso", "A+ / OEM"].map((item) => (
          <span
            key={item}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm"
          >
            {item}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchTerm.trim() && (
        <Chip label={`Ricerca: ${searchTerm.trim()}`} onRemove={onClearSearch} />
      )}
      {(Object.keys(filters) as FilterKey[]).flatMap((key) =>
        filters[key].map((value) => (
          <Chip
            key={`${key}-${value}`}
            label={`${filterLabels[key]}: ${key === "status" ? statusLabels[value as PartProduct["status"]] : value}`}
            onRemove={() => onClearFilter(key, value)}
          />
        ))
      )}
      {sortKey !== "recommended" && (
        <Chip label={`Ordine: ${sortLabels[sortKey]}`} onRemove={onClearSort} />
      )}
      <button
        type="button"
        onClick={onClearAll}
        className="rounded-full px-2 py-1 text-xs font-black text-primary hover:bg-primary/8"
      >
        Cancella tutto
      </button>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2.5 py-1 text-xs font-bold text-primary">
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-primary/10"
        aria-label={`Rimuovi filtro ${label}`}
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function sortProducts(items: PartProduct[], sortKey: SortKey) {
  const originalIndex = new Map(products.map((product, index) => [product.sku, index]));

  return [...items].sort((a, b) => {
    if (sortKey === "stock") {
      return b.stock - a.stock || a.name.localeCompare(b.name, "it");
    }

    if (sortKey === "updated") {
      return parseUpdatedAt(b.updatedAt) - parseUpdatedAt(a.updatedAt);
    }

    if (sortKey === "name") {
      return a.name.localeCompare(b.name, "it");
    }

    return (
      stockRank(b) - stockRank(a) ||
      b.stock - a.stock ||
      gradeRank(b.grade) - gradeRank(a.grade) ||
      parseUpdatedAt(b.updatedAt) - parseUpdatedAt(a.updatedAt) ||
      (originalIndex.get(a.sku) ?? 0) - (originalIndex.get(b.sku) ?? 0)
    );
  });
}

function countActiveFilters(filters: CatalogFiltersState) {
  return (Object.keys(filters) as FilterKey[]).reduce(
    (total, key) => total + filters[key].length,
    0
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("it-IT");
}

function stockRank(product: PartProduct) {
  if (product.status === "In Stock") {
    return 3;
  }

  if (product.status === "Low Stock") {
    return 2;
  }

  return 0;
}

function gradeRank(grade: PartProduct["grade"]) {
  if (grade === "A+") {
    return 4;
  }

  if (grade === "A") {
    return 3;
  }

  if (grade === "Refurbished") {
    return 2;
  }

  return 1;
}

function parseUpdatedAt(value: string) {
  return new Date(value.replace(" ", "T")).getTime();
}
