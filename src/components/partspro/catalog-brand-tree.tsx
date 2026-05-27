"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  deviceModels,
  type DeviceModelGroup,
  type DeviceModelSeriesGroup,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { brandLabel, tx } from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";

type CatalogBrandTreeVariant = "mobile" | "desktop";

export type CatalogSelection = {
  brand?: string;
  category?: string;
  inStockOnly?: boolean;
  model?: string;
  modelSeries?: string;
  searchQuery?: string;
};

type CatalogBrandTreeProps = {
  expandedBrand: string | null;
  idPrefix: string;
  modelGroups?: readonly DeviceModelGroup[];
  onExpandedBrandChange: (brand: string | null) => void;
  onNavigate?: () => void;
  onSelectCatalog?: (selection: CatalogSelection) => void;
  prefetchCatalogLinks?: boolean;
  selectedCatalog?: CatalogSelection;
  showAvailableLink?: boolean;
  variant?: CatalogBrandTreeVariant;
};

export function CatalogBrandTree({
  expandedBrand,
  idPrefix,
  modelGroups,
  onExpandedBrandChange,
  onNavigate,
  onSelectCatalog,
  prefetchCatalogLinks = false,
  selectedCatalog,
  showAvailableLink = false,
  variant = "mobile",
}: CatalogBrandTreeProps) {
  const t = useT();
  const desktop = variant === "desktop";
  const selectedBrand = selectedCatalog?.brand;
  const selectedCategory = selectedCatalog?.category;
  const selectedModel = selectedCatalog?.model;
  const selectedModelSeries = selectedCatalog?.modelSeries;
  const inStockOnly = Boolean(selectedCatalog?.inStockOnly);
  const selectionKnown = Boolean(selectedCatalog);
  const [expandedSeriesKey, setExpandedSeriesKey] = useState<string | null>(null);
  const groups = useMemo(
    () => canonicalModelGroups(modelGroups ?? deviceModels),
    [modelGroups]
  );
  const selectedModelSeriesFromGroups = useMemo(
    () => findSeriesForModel(groups, selectedBrand, selectedModel),
    [groups, selectedBrand, selectedModel]
  );
  const selectedSeries =
    selectedModel && selectedModelSeriesFromGroups
      ? selectedModelSeriesFromGroups
      : selectedModelSeries;
  const selectedSeriesPanelKey =
    selectedBrand && selectedModel && selectedSeries && expandedBrand === selectedBrand
      ? seriesPanelKey(selectedBrand, selectedSeries)
      : null;
  const expandedSeriesPanelKey =
    expandedSeriesKey && !isClosedSeriesPanelKey(expandedSeriesKey)
      ? expandedSeriesKey
      : null;
  const activeSeriesPanelKey =
    expandedSeriesPanelKey ??
    (selectedSeriesPanelKey &&
    expandedSeriesKey !== closedSeriesPanelKey(selectedSeriesPanelKey)
      ? selectedSeriesPanelKey
      : null);
  const catalogLinkClassName = cn(
    "flex w-full items-center rounded-md text-left font-black text-primary transition hover:bg-primary/8",
    desktop ? "h-10 bg-primary/8 px-3 text-sm" : "h-8 px-2 text-xs"
  );
  const availableLinkClassName = cn(
    "flex w-full items-center rounded-md text-left font-black text-emerald-700 transition hover:bg-emerald-50",
    desktop ? "h-10 px-3 text-sm" : "h-8 px-2 text-xs"
  );

  function handleSelect(selection: CatalogSelection) {
    onSelectCatalog?.(selection);
    onNavigate?.();
  }

  function handleCatalogRootSelect() {
    handleSelect({ inStockOnly: inStockOnly || undefined });
  }

  function handleAvailabilityToggle(checked: boolean) {
    handleSelect({
      brand: selectedBrand,
      category: selectedCategory,
      inStockOnly: checked || undefined,
      model: selectedModel,
      modelSeries: selectedSeries,
    });
  }

  function handleModelSelect(brand: string, model: string, modelSeries?: string) {
    handleSelect({
      brand,
      category: selectedCategory,
      inStockOnly: inStockOnly || undefined,
      model,
      modelSeries,
    });
  }

  function renderSelectionItem({
    ariaLabel,
    children,
    className,
    elementId,
    itemKey,
    onClick,
    pressed,
    selection,
    title,
  }: {
    ariaLabel?: string;
    children: ReactNode;
    className: string;
    itemKey: string;
    onClick?: () => void;
    pressed?: boolean;
    selection: CatalogSelection;
    elementId?: string;
    title?: string;
  }) {
    return onSelectCatalog ? (
      <button
        key={itemKey}
        id={elementId}
        type="button"
        aria-label={ariaLabel}
        aria-pressed={pressed}
        className={className}
        onClick={onClick ?? (() => handleSelect(selection))}
        title={title}
      >
        {children}
      </button>
    ) : (
      <Link
        key={itemKey}
        id={elementId}
        href={catalogQueryHref(selection)}
        prefetch={prefetchCatalogLinks ? null : false}
        className={className}
        onClick={onNavigate}
        title={title}
      >
        {children}
      </Link>
    );
  }

  useEffect(() => {
    if (!selectedModel || !selectedBrand || expandedBrand !== selectedBrand) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(selectedModelElementId(idPrefix))?.scrollIntoView({
        block: "center",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSeriesPanelKey, expandedBrand, idPrefix, selectedBrand, selectedModel]);

  return (
    <div
      className={cn(
        desktop ? "space-y-2" : "space-y-2 rounded-lg bg-white px-2 py-2 shadow-sm"
      )}
    >
      {onSelectCatalog ? (
        <button
          type="button"
          className={cn(
            catalogLinkClassName,
            selectionKnown &&
              !selectedBrand &&
              !selectedModel &&
              !inStockOnly &&
              "bg-primary text-white shadow-sm hover:bg-primary"
          )}
          onClick={handleCatalogRootSelect}
        >
          {tx(t, "storefront.catalog.allProducts", "Tutto il catalogo")}
        </button>
      ) : (
        <Link
          href="/catalogo"
          prefetch={prefetchCatalogLinks ? null : false}
          className={catalogLinkClassName}
          onClick={onNavigate}
        >
          {tx(t, "storefront.catalog.allProducts", "Tutto il catalogo")}
        </Link>
      )}
      {showAvailableLink && (
        onSelectCatalog ? (
          <div
            className={cn(
              "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border text-left font-black transition",
              desktop ? "min-h-10 px-3 text-sm" : "min-h-9 px-2 text-xs",
              inStockOnly
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-100 bg-white text-emerald-700 hover:bg-emerald-50"
            )}
            onClick={() => handleAvailabilityToggle(!inStockOnly)}
          >
            <span className="min-w-0 flex-1 truncate">
              {tx(t, "storefront.catalog.availableOnly", "Solo disponibili")}
            </span>
            <Switch
              aria-label={tx(
                t,
                "storefront.catalog.availableOnlyAria",
                "Filtra solo prodotti disponibili"
              )}
              checked={inStockOnly}
              onCheckedChange={handleAvailabilityToggle}
              onClick={(event) => event.stopPropagation()}
              size={desktop ? "default" : "sm"}
            />
          </div>
        ) : (
          <Link
            href="/catalogo?minStock=1"
            prefetch={prefetchCatalogLinks ? null : false}
            className={availableLinkClassName}
            onClick={onNavigate}
          >
            {tx(t, "storefront.catalog.availableOnly", "Solo disponibili")}
          </Link>
        )
      )}
      <div className={desktop ? "space-y-1.5" : "space-y-1"}>
        {groups.map((entry) => {
          const brandOpen = expandedBrand === entry.brand;
          const localizedBrand = brandLabel(t, entry.brand);
          const brandSelected = isSameCatalogValue(selectedBrand, entry.brand);
          const brandPanelId = catalogBrandPanelId(idPrefix, entry.brand);

          return (
            <div
              key={entry.brand}
              className={cn(
                "overflow-hidden rounded-md border border-slate-100 bg-white",
                desktop && "border-slate-200 shadow-[0_8px_22px_rgba(15,23,42,0.03)]"
              )}
            >
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md text-left font-black text-slate-900 transition hover:bg-slate-50 hover:text-primary",
                  desktop ? "h-10 px-3 text-sm" : "h-9 px-2 text-xs",
                  brandSelected && "text-primary"
                )}
                aria-expanded={brandOpen}
                aria-controls={brandPanelId}
                onClick={() => {
                  setExpandedSeriesKey(null);
                  onExpandedBrandChange(brandOpen ? null : entry.brand);
                }}
                title={localizedBrand === entry.brand ? undefined : entry.brand}
              >
                <span className="min-w-0 flex-1 truncate">{localizedBrand}</span>
                {desktop && (
                  <span className="text-[11px] font-semibold text-slate-400">
                    {entry.models.length}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    desktop ? "size-4" : "size-3.5",
                    "text-slate-400 transition",
                    brandOpen && "rotate-180 text-primary"
                  )}
                />
              </button>
              {brandOpen && (
                <div
                  id={brandPanelId}
                  className={cn(
                    "border-t border-slate-100",
                    "p-2"
                  )}
                >
                  {entry.series?.length ? (
                    <div className="space-y-1">
                      {entry.series.map((seriesGroup) => {
                        const panelKey = seriesPanelKey(entry.brand, seriesGroup.series);
                        const seriesOpen = activeSeriesPanelKey === panelKey;
                        const seriesPanelId = `${brandPanelId}-series-${slugKey(seriesGroup.series)}`;

                        return (
                          <div key={seriesGroup.series} className="rounded-md bg-slate-50/70">
                            <button
                              type="button"
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md text-left font-black leading-4 text-slate-900 transition hover:bg-slate-100 hover:text-primary",
                                desktop ? "px-2.5 py-2 text-xs" : "h-9 px-2 py-2 text-[11px]",
                                seriesOpen && "bg-slate-100"
                              )}
                              aria-expanded={seriesOpen}
                              aria-controls={seriesPanelId}
                              onClick={() =>
                                setExpandedSeriesKey(
                                  seriesOpen ? closedSeriesPanelKey(panelKey) : panelKey
                                )
                              }
                              title={seriesGroup.series}
                            >
                              <span className="min-w-0 flex-1 truncate">
                                {seriesGroup.series}
                              </span>
                              <ChevronDown
                                className={cn(
                                  desktop ? "size-3.5" : "size-3",
                                  "shrink-0 text-slate-400 transition",
                                  seriesOpen && "rotate-180 text-primary"
                                )}
                              />
                            </button>
                            {seriesOpen && (
                              <div
                                id={seriesPanelId}
                                className={cn(
                                  "grid border-t border-white/80 p-1",
                                  desktop ? "gap-1" : "grid-cols-2 gap-1"
                                )}
                              >
                                {seriesGroup.models.map((model) => {
                                  const modelSelected =
                                    brandSelected && isSameCatalogValue(selectedModel, model);

                                  return renderSelectionItem({
                                    className: cn(
                                      "min-w-0 rounded-md bg-white text-left font-semibold leading-4 text-slate-600 transition hover:bg-primary/8 hover:text-primary",
                                      desktop
                                        ? "px-2.5 py-2 text-xs"
                                        : "h-9 px-2 py-2 text-[11px]",
                                      modelSelected &&
                                        "bg-primary text-white shadow-sm hover:bg-primary hover:text-white"
                                    ),
                                    itemKey: model,
                                    onClick: () =>
                                      handleModelSelect(
                                        entry.brand,
                                        model,
                                        seriesGroup.series
                                      ),
                                    pressed: modelSelected,
                                    selection: {
                                      brand: entry.brand,
                                      category: selectedCategory,
                                      inStockOnly: inStockOnly || undefined,
                                      model,
                                      modelSeries: seriesGroup.series,
                                    },
                                    elementId: modelSelected
                                      ? selectedModelElementId(idPrefix)
                                      : undefined,
                                    title: model,
                                    children: <span className="block truncate">{model}</span>,
                                  });
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={desktop ? "grid gap-1" : "grid grid-cols-2 gap-1"}>
                      {entry.models.map((model) => {
                        const modelSelected =
                          brandSelected && isSameCatalogValue(selectedModel, model);

                        return renderSelectionItem({
                          className: cn(
                            "min-w-0 rounded-md bg-slate-50 text-left font-semibold leading-4 text-slate-600 transition hover:bg-primary/8 hover:text-primary",
                            desktop ? "px-2.5 py-2 text-xs" : "h-9 px-2 py-2 text-[11px]",
                            modelSelected &&
                              "bg-primary text-white shadow-sm hover:bg-primary hover:text-white"
                          ),
                          itemKey: model,
                          onClick: () => handleModelSelect(entry.brand, model),
                          pressed: modelSelected,
                          selection: {
                            brand: entry.brand,
                            category: selectedCategory,
                            inStockOnly: inStockOnly || undefined,
                            model,
                          },
                          elementId: modelSelected ? selectedModelElementId(idPrefix) : undefined,
                          title: model,
                          children: <span className="block truncate">{model}</span>,
                        });
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function catalogQueryHref({
  brand,
  category,
  inStockOnly,
  model,
  modelSeries,
}: {
  brand?: string;
  category?: string;
  inStockOnly?: boolean;
  model?: string;
  modelSeries?: string;
}) {
  const params = new URLSearchParams();

  if (category) {
    params.set("category", category);
  }

  if (brand) {
    params.set("brand", brand);
  }

  if (modelSeries) {
    params.set("modelSeries", modelSeries);
  }

  if (model) {
    params.set("model", model);
  }

  if (inStockOnly) {
    params.set("minStock", "1");
  }

  const query = params.toString();

  return query ? `/catalogo?${query}` : "/catalogo";
}

function catalogBrandPanelId(prefix: string, brand: string) {
  return `${prefix}-brand-${slugKey(brand)}`;
}

function isSameCatalogValue(left?: string, right?: string) {
  if (!left || !right) {
    return false;
  }

  return left.trim().localeCompare(right.trim(), "it", {
    numeric: true,
    sensitivity: "base",
  }) === 0;
}

function canonicalModelGroups(sourceGroups: readonly DeviceModelGroup[]) {
  const groups = new Map<
    string,
    {
      models: Set<string>;
      series: Map<string, Set<string>>;
    }
  >();

  for (const group of sourceGroups) {
    const brand = group.brand.trim();

    if (!brand) {
      continue;
    }

    const existing = groups.get(brand) ?? {
      models: new Set<string>(),
      series: new Map<string, Set<string>>(),
    };

    for (const model of group.models) {
      const normalizedModel = model.trim();

      if (normalizedModel) {
        existing.models.add(normalizedModel);
      }
    }

    for (const seriesGroup of group.series ?? []) {
      const seriesName = seriesGroup.series.trim();

      if (!seriesName) {
        continue;
      }

      const seriesModels = existing.series.get(seriesName) ?? new Set<string>();

      for (const model of seriesGroup.models) {
        const normalizedModel = model.trim();

        if (normalizedModel) {
          seriesModels.add(normalizedModel);
          existing.models.add(normalizedModel);
        }
      }

      if (seriesModels.size > 0) {
        existing.series.set(seriesName, seriesModels);
      }
    }

    groups.set(brand, existing);
  }

  const preferredBrandOrder = sourceGroups.map((group) => group.brand);

  return Array.from(groups.entries())
    .map(([brand, group]) => ({
      brand,
      models: Array.from(group.models).sort(compareModelNames),
      series: sortSeriesGroups(group.series),
    }))
    .sort((left, right) => {
      const leftIndex = preferredBrandOrder.indexOf(left.brand);
      const rightIndex = preferredBrandOrder.indexOf(right.brand);

      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }

      return left.brand.localeCompare(right.brand, "it", { numeric: true });
    });
}

function sortSeriesGroups(series: Map<string, Set<string>>): DeviceModelSeriesGroup[] | undefined {
  const groups = Array.from(series.entries())
    .map(([seriesName, models]) => ({
      series: seriesName,
      models: Array.from(models).sort(compareModelNames),
    }))
    .filter((group) => group.models.length > 0)
    .sort((left, right) => left.series.localeCompare(right.series, "it", { numeric: true }));

  return groups.length > 0 ? groups : undefined;
}

function compareModelNames(left: string, right: string) {
  return left.localeCompare(right, "it", { numeric: true, sensitivity: "base" });
}

function findSeriesForModel(
  groups: readonly DeviceModelGroup[],
  brand?: string,
  model?: string
) {
  if (!brand || !model) {
    return undefined;
  }

  const group = groups.find((entry) => isSameCatalogValue(entry.brand, brand));
  const seriesGroup = group?.series?.find((entry) =>
    entry.models.some((entryModel) => isSameCatalogValue(entryModel, model))
  );

  return seriesGroup?.series;
}

function seriesPanelKey(brand: string, series: string) {
  return `${brand}::${series}`;
}

function closedSeriesPanelKey(panelKey: string) {
  return `closed::${panelKey}`;
}

function isClosedSeriesPanelKey(panelKey: string) {
  return panelKey.startsWith("closed::");
}

function selectedModelElementId(prefix: string) {
  return `${prefix}-selected-model`;
}

function slugKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}
