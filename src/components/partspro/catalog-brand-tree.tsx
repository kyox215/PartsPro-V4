"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  catalogDepartmentGroups as fallbackCatalogDepartmentGroups,
  catalogDepartments,
  type CatalogDepartment,
  type CatalogDepartmentGroup,
  type DeviceModelGroup,
  type DeviceModelSeriesGroup,
} from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { hrefWithAssistedCompanyId } from "@/lib/partspro-assisted-order";
import {
  brandLabel,
  catalogDepartmentLabel,
  tx,
  txFormat,
} from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";
import { RoutePendingIndicator } from "./pending-feedback";

type CatalogBrandTreeVariant = "mobile" | "desktop";

export type CatalogSelection = {
  brand?: string;
  category?: string;
  department?: CatalogDepartment;
  inStockOnly?: boolean;
  model?: string;
  modelSeries?: string;
  searchQuery?: string;
};

type CatalogBrandTreeProps = {
  assistedCompanyId?: string | null;
  departmentGroups?: readonly CatalogDepartmentGroup[];
  expandedBrandKey: string | null;
  expandedDepartment: CatalogDepartment | null;
  idPrefix: string;
  onExpandedBrandKeyChange: (brandKey: string | null) => void;
  onExpandedDepartmentChange: (department: CatalogDepartment | null) => void;
  onNavigate?: () => void;
  onSelectCatalog?: (selection: CatalogSelection) => void;
  prefetchCatalogLinks?: boolean;
  selectedCatalog?: CatalogSelection;
  variant?: CatalogBrandTreeVariant;
};

export function CatalogBrandTree({
  assistedCompanyId,
  departmentGroups,
  expandedBrandKey,
  expandedDepartment,
  idPrefix,
  onExpandedBrandKeyChange,
  onExpandedDepartmentChange,
  onNavigate,
  onSelectCatalog,
  prefetchCatalogLinks = false,
  selectedCatalog,
  variant = "mobile",
}: CatalogBrandTreeProps) {
  const t = useT();
  const desktop = variant === "desktop";
  const selectedBrand = selectedCatalog?.brand;
  const selectedCategory = selectedCatalog?.category;
  const selectedDepartment = selectedCatalog?.department;
  const selectedModel = selectedCatalog?.model;
  const selectedModelSeries = selectedCatalog?.modelSeries;
  const selectedSearchQuery = selectedCatalog?.searchQuery;
  const inStockOnly = selectedCatalog?.inStockOnly ?? false;
  const selectionKnown = Boolean(selectedCatalog);
  const [expandedSeriesKey, setExpandedSeriesKey] = useState<string | null>(null);
  const groups = useMemo(
    () =>
      canonicalDepartmentGroups(
        departmentGroups?.length
          ? departmentGroups
          : fallbackCatalogDepartmentGroups
      ),
    [departmentGroups]
  );
  const selectedModelSeriesFromGroups = useMemo(
    () =>
      findSeriesForModel(
        groups,
        selectedDepartment,
        selectedBrand,
        selectedModel
      ),
    [groups, selectedBrand, selectedDepartment, selectedModel]
  );
  const selectedSeries =
    selectedModel && selectedModelSeriesFromGroups
      ? selectedModelSeriesFromGroups
      : selectedModelSeries;
  const selectedBrandPanelKey =
    selectedDepartment && selectedBrand
      ? catalogBrandKey(selectedDepartment, selectedBrand)
      : null;
  const selectedSeriesPanelKey =
    selectedDepartment &&
    selectedBrand &&
    selectedModel &&
    selectedSeries &&
    expandedDepartment === selectedDepartment &&
    expandedBrandKey === selectedBrandPanelKey
      ? seriesPanelKey(selectedDepartment, selectedBrand, selectedSeries)
      : null;
  const expandedSeriesForCurrentBrand =
    expandedSeriesKey &&
    expandedBrandKey &&
    seriesPanelMatchesBrand(expandedSeriesKey, expandedBrandKey)
      ? expandedSeriesKey
      : null;
  const expandedSeriesPanelKey =
    expandedSeriesForCurrentBrand &&
    !isClosedSeriesPanelKey(expandedSeriesForCurrentBrand)
      ? expandedSeriesForCurrentBrand
      : null;
  const activeSeriesPanelKey =
    expandedSeriesPanelKey ??
    (selectedSeriesPanelKey &&
    expandedSeriesForCurrentBrand !== closedSeriesPanelKey(selectedSeriesPanelKey)
      ? selectedSeriesPanelKey
      : null);
  const catalogLinkClassName = cn(
    "flex w-full items-center rounded-md text-left font-black text-primary transition hover:bg-primary/8",
    desktop ? "h-10 bg-primary/8 px-3 text-sm" : "h-8 px-2 text-xs"
  );
  const catalogRootSelected =
    selectionKnown &&
    !selectedBrand &&
    !selectedCategory &&
    !selectedDepartment &&
    !selectedModel &&
    !selectedModelSeries &&
    !selectedSearchQuery &&
    !inStockOnly;

  function handleSelect(selection: CatalogSelection) {
    onSelectCatalog?.(selection);
    onNavigate?.();
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
        href={catalogQueryHref(selection, assistedCompanyId)}
        prefetch={prefetchCatalogLinks ? null : false}
        aria-current={pressed ? "page" : undefined}
        className={className}
        onClick={onNavigate}
        title={title}
      >
        <span className="flex min-w-0 items-center gap-1">
          <span className="min-w-0 flex-1">{children}</span>
          <RoutePendingIndicator className="size-3 text-primary" />
        </span>
      </Link>
    );
  }

  function renderModelSelection(
    department: CatalogDepartment,
    brand: string,
    model: string,
    modelSeries?: string
  ) {
    const modelSelected =
      selectedDepartment === department &&
      isSameCatalogValue(selectedBrand, brand) &&
      isSameCatalogValue(selectedModel, model);

    return renderSelectionItem({
      className: cn(
        "min-w-0 w-full rounded-md bg-white text-left font-semibold leading-4 text-slate-600 transition hover:bg-primary/8 hover:text-primary",
        desktop ? "px-2.5 py-2 text-xs" : "min-h-9 px-2 py-2 text-[11px]",
        modelSelected &&
          "bg-primary text-white shadow-sm hover:bg-primary hover:text-white"
      ),
      itemKey: `${department}-${brand}-${modelSeries ?? "direct"}-${model}`,
      pressed: modelSelected,
      selection: {
        brand,
        department,
        model,
        modelSeries,
      },
      elementId: modelSelected ? selectedModelElementId(idPrefix) : undefined,
      title: model,
      children: (
        <span className="block whitespace-normal break-words [overflow-wrap:anywhere]">
          {model}
        </span>
      ),
    });
  }

  useEffect(() => {
    if (
      !selectedModel ||
      !selectedBrand ||
      !selectedDepartment ||
      expandedDepartment !== selectedDepartment ||
      expandedBrandKey !== selectedBrandPanelKey
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(selectedModelElementId(idPrefix))?.scrollIntoView({
        block: "center",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    activeSeriesPanelKey,
    expandedBrandKey,
    expandedDepartment,
    idPrefix,
    selectedBrand,
    selectedBrandPanelKey,
    selectedDepartment,
    selectedModel,
  ]);

  return (
    <div
      className={cn(
        desktop ? "space-y-2" : "space-y-2 rounded-lg bg-white px-2 py-2 shadow-sm"
      )}
    >
      {onSelectCatalog ? (
        <button
          type="button"
          aria-pressed={catalogRootSelected}
          className={cn(
            catalogLinkClassName,
            catalogRootSelected &&
              "bg-primary text-white shadow-sm hover:bg-primary"
          )}
          onClick={() => handleSelect({})}
        >
          {tx(t, "storefront.catalog.allProducts", "Tutto il catalogo")}
        </button>
      ) : (
        <Link
          href={hrefWithAssistedCompanyId("/catalogo", assistedCompanyId)}
          prefetch={prefetchCatalogLinks ? null : false}
          className={catalogLinkClassName}
          onClick={onNavigate}
        >
          <span className="min-w-0 flex-1 truncate">
            {tx(t, "storefront.catalog.allProducts", "Tutto il catalogo")}
          </span>
          <RoutePendingIndicator className="size-3.5 text-primary" />
        </Link>
      )}

      <div className={desktop ? "space-y-1.5" : "space-y-1"}>
        {groups.map((departmentGroup) => {
          const department = departmentGroup.department;
          const departmentOpen = expandedDepartment === department;
          const departmentWithinSelection = selectedDepartment === department;
          const departmentSelected =
            departmentWithinSelection &&
            !selectedBrand &&
            !selectedModelSeries &&
            !selectedModel &&
            !selectedCategory &&
            !selectedSearchQuery &&
            !inStockOnly;
          const departmentPanelId = catalogDepartmentPanelId(idPrefix, department);
          const localizedDepartment = catalogDepartmentLabel(t, department);
          const hasBrands = departmentGroup.brands.length > 0;

          return (
            <div
              key={department}
              className={cn(
                "overflow-hidden rounded-md border border-slate-100 bg-white",
                desktop && "border-slate-200 shadow-[0_8px_22px_rgba(15,23,42,0.03)]"
              )}
            >
              <div className="flex min-w-0 items-stretch">
                {renderSelectionItem({
                  className: cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md text-left font-black text-slate-900 transition hover:bg-slate-50 hover:text-primary",
                    desktop ? "min-h-10 px-3 text-sm" : "min-h-9 px-2 text-xs",
                    departmentWithinSelection && "text-primary",
                    departmentSelected &&
                      "bg-primary text-white shadow-sm hover:bg-primary hover:text-white"
                  ),
                  itemKey: `department-${department}`,
                  pressed: departmentSelected,
                  selection: { department },
                  children: (
                    <>
                      <span className="min-w-0 flex-1 truncate">
                        {localizedDepartment}
                      </span>
                      {desktop && (
                        <span
                          className={cn(
                            "text-[11px] font-semibold text-slate-400",
                            departmentSelected && "text-white/80"
                          )}
                        >
                          {departmentGroup.brands.length}
                        </span>
                      )}
                    </>
                  ),
                })}
                {hasBrands ? (
                  <button
                    type="button"
                    className={cn(
                      "grid shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-50 hover:text-primary",
                      desktop ? "w-10" : "w-9"
                    )}
                    aria-label={groupToggleLabel(t, localizedDepartment, departmentOpen)}
                    aria-expanded={departmentOpen}
                    aria-controls={departmentPanelId}
                    onClick={() => {
                      setExpandedSeriesKey(null);
                      onExpandedBrandKeyChange(null);
                      onExpandedDepartmentChange(departmentOpen ? null : department);
                    }}
                  >
                    <ChevronDown
                      className={cn(
                        desktop ? "size-4" : "size-3.5",
                        "transition",
                        departmentOpen && "rotate-180 text-primary"
                      )}
                    />
                  </button>
                ) : null}
              </div>

              {departmentOpen && hasBrands ? (
                <div id={departmentPanelId} className="border-t border-slate-100 p-2">
                  <div className="space-y-1">
                    {departmentGroup.brands.map((entry) => {
                      const brandPanelKey = catalogBrandKey(department, entry.brand);
                      const brandOpen = expandedBrandKey === brandPanelKey;
                      const localizedBrand = brandLabel(t, entry.brand);
                      const brandWithinSelection =
                        departmentWithinSelection &&
                        isSameCatalogValue(selectedBrand, entry.brand);
                      const brandSelected =
                        brandWithinSelection &&
                        !selectedModelSeries &&
                        !selectedModel &&
                        !selectedCategory &&
                        !selectedSearchQuery &&
                        !inStockOnly;
                      const brandPanelId = catalogBrandPanelId(
                        idPrefix,
                        department,
                        entry.brand
                      );
                      const seriesGroups = entry.series ?? [];
                      const groupedModels = new Set(
                        seriesGroups.flatMap((seriesGroup) => seriesGroup.models)
                      );
                      const standaloneModels = entry.models.filter(
                        (model) => !groupedModels.has(model)
                      );
                      const hasBrandChildren =
                        seriesGroups.length > 0 || standaloneModels.length > 0;

                      return (
                        <div
                          key={brandPanelKey}
                          className="overflow-hidden rounded-md border border-slate-100 bg-white"
                        >
                          <div className="flex min-w-0 items-stretch">
                            {renderSelectionItem({
                              className: cn(
                                "flex min-w-0 flex-1 items-center gap-2 rounded-md text-left font-black text-slate-900 transition hover:bg-slate-50 hover:text-primary",
                                desktop ? "min-h-10 px-3 text-sm" : "min-h-9 px-2 text-xs",
                                brandWithinSelection && "text-primary",
                                brandSelected &&
                                  "bg-primary text-white shadow-sm hover:bg-primary hover:text-white"
                              ),
                              itemKey: `brand-${brandPanelKey}`,
                              pressed: brandSelected,
                              selection: { brand: entry.brand, department },
                              title:
                                localizedBrand === entry.brand ? undefined : entry.brand,
                              children: (
                                <>
                                  <span className="min-w-0 flex-1 truncate">
                                    {localizedBrand}
                                  </span>
                                  {desktop && hasBrandChildren ? (
                                    <span
                                      className={cn(
                                        "text-[11px] font-semibold text-slate-400",
                                        brandSelected && "text-white/80"
                                      )}
                                    >
                                      {entry.models.length}
                                    </span>
                                  ) : null}
                                </>
                              ),
                            })}
                            {hasBrandChildren ? (
                              <button
                                type="button"
                                className={cn(
                                  "grid shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-50 hover:text-primary",
                                  desktop ? "w-10" : "w-9"
                                )}
                                aria-label={groupToggleLabel(t, localizedBrand, brandOpen)}
                                aria-expanded={brandOpen}
                                aria-controls={brandPanelId}
                                onClick={() => {
                                  setExpandedSeriesKey(null);
                                  onExpandedBrandKeyChange(
                                    brandOpen ? null : brandPanelKey
                                  );
                                }}
                              >
                                <ChevronDown
                                  className={cn(
                                    desktop ? "size-4" : "size-3.5",
                                    "transition",
                                    brandOpen && "rotate-180 text-primary"
                                  )}
                                />
                              </button>
                            ) : null}
                          </div>

                          {brandOpen && hasBrandChildren ? (
                            <div id={brandPanelId} className="border-t border-slate-100 p-2">
                              <div className="space-y-1">
                                {seriesGroups.map((seriesGroup) => {
                                  const panelKey = seriesPanelKey(
                                    department,
                                    entry.brand,
                                    seriesGroup.series
                                  );
                                  const seriesOpen = activeSeriesPanelKey === panelKey;
                                  const seriesPanelId = `${brandPanelId}-series-${slugKey(
                                    seriesGroup.series
                                  )}`;
                                  const seriesWithinSelection =
                                    brandWithinSelection &&
                                    isSameCatalogValue(
                                      selectedSeries,
                                      seriesGroup.series
                                    );
                                  const seriesSelected =
                                    seriesWithinSelection &&
                                    !selectedModel &&
                                    !selectedCategory &&
                                    !selectedSearchQuery &&
                                    !inStockOnly;

                                  return (
                                    <div
                                      key={seriesGroup.series}
                                      className="rounded-md bg-slate-50/70"
                                    >
                                      <div className="flex min-w-0 items-stretch">
                                        {renderSelectionItem({
                                          className: cn(
                                            "flex min-w-0 flex-1 items-center rounded-md text-left font-black leading-4 text-slate-900 transition hover:bg-slate-100 hover:text-primary",
                                            desktop
                                              ? "min-h-9 px-2.5 py-2 text-xs"
                                              : "min-h-9 px-2 py-2 text-[11px]",
                                            seriesWithinSelection && "text-primary",
                                            seriesSelected &&
                                              "bg-primary text-white shadow-sm hover:bg-primary hover:text-white"
                                          ),
                                          itemKey: `series-${panelKey}`,
                                          pressed: seriesSelected,
                                          selection: {
                                            brand: entry.brand,
                                            department,
                                            modelSeries: seriesGroup.series,
                                          },
                                          title: seriesGroup.series,
                                          children: (
                                            <span className="min-w-0 flex-1 truncate">
                                              {seriesGroup.series}
                                            </span>
                                          ),
                                        })}
                                        <button
                                          type="button"
                                          className={cn(
                                            "grid shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-primary",
                                            desktop ? "w-9" : "w-8"
                                          )}
                                          aria-label={groupToggleLabel(
                                            t,
                                            seriesGroup.series,
                                            seriesOpen
                                          )}
                                          aria-expanded={seriesOpen}
                                          aria-controls={seriesPanelId}
                                          onClick={() =>
                                            setExpandedSeriesKey(
                                              seriesOpen
                                                ? closedSeriesPanelKey(panelKey)
                                                : panelKey
                                            )
                                          }
                                        >
                                          <ChevronDown
                                            className={cn(
                                              desktop ? "size-3.5" : "size-3",
                                              "transition",
                                              seriesOpen && "rotate-180 text-primary"
                                            )}
                                          />
                                        </button>
                                      </div>
                                      {seriesOpen ? (
                                        <div
                                          id={seriesPanelId}
                                          className="grid gap-1 border-t border-white/80 p-1"
                                        >
                                          {seriesGroup.models.map((model) =>
                                            renderModelSelection(
                                              department,
                                              entry.brand,
                                              model,
                                              seriesGroup.series
                                            )
                                          )}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}

                                {standaloneModels.length > 0 ? (
                                  <div className="grid gap-1">
                                    {standaloneModels.map((model) =>
                                      renderModelSelection(
                                        department,
                                        entry.brand,
                                        model
                                      )
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function catalogQueryHref(
  {
    brand,
    category,
    department,
    inStockOnly,
    model,
    modelSeries,
    searchQuery,
  }: CatalogSelection,
  assistedCompanyId?: string | null
) {
  const params = new URLSearchParams();

  if (department) {
    params.set("department", department);
  }

  if (category) {
    params.set("category", category);
  }

  if (brand) {
    params.set("brand", brand);
  }

  if (modelSeries && !model) {
    params.set("modelSeries", modelSeries);
  }

  if (model) {
    params.set("model", model);
  }

  if (searchQuery) {
    params.set("q", searchQuery);
  }

  if (inStockOnly) {
    params.set("minStock", "1");
  }

  const query = params.toString();

  return hrefWithAssistedCompanyId(
    query ? `/catalogo?${query}` : "/catalogo",
    assistedCompanyId
  );
}

function canonicalDepartmentGroups(sourceGroups: readonly CatalogDepartmentGroup[]) {
  const brandsByDepartment = new Map<CatalogDepartment, DeviceModelGroup[]>();

  for (const department of catalogDepartments) {
    brandsByDepartment.set(department, []);
  }

  for (const group of sourceGroups) {
    if (!isCatalogDepartment(group.department)) {
      continue;
    }

    brandsByDepartment.get(group.department)?.push(...group.brands);
  }

  return catalogDepartments.map((department) => ({
    department,
    brands: canonicalModelGroups(brandsByDepartment.get(department) ?? []),
  }));
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

function sortSeriesGroups(
  series: Map<string, Set<string>>
): DeviceModelSeriesGroup[] | undefined {
  const groups = Array.from(series.entries())
    .map(([seriesName, models]) => ({
      series: seriesName,
      models: Array.from(models).sort(compareModelNames),
    }))
    .filter((group) => group.models.length > 0)
    .sort((left, right) =>
      left.series.localeCompare(right.series, "it", { numeric: true })
    );

  return groups.length > 0 ? groups : undefined;
}

function findSeriesForModel(
  groups: readonly CatalogDepartmentGroup[],
  department?: CatalogDepartment,
  brand?: string,
  model?: string
) {
  if (!department || !brand || !model) {
    return undefined;
  }

  const departmentGroup = groups.find((entry) => entry.department === department);
  const group = departmentGroup?.brands.find((entry) =>
    isSameCatalogValue(entry.brand, brand)
  );
  const seriesGroup = group?.series?.find((entry) =>
    entry.models.some((entryModel) => isSameCatalogValue(entryModel, model))
  );

  return seriesGroup?.series;
}

function catalogDepartmentPanelId(prefix: string, department: CatalogDepartment) {
  return `${prefix}-department-${department}`;
}

function catalogBrandPanelId(
  prefix: string,
  department: CatalogDepartment,
  brand: string
) {
  return `${prefix}-brand-${department}-${slugKey(brand)}`;
}

function catalogBrandKey(department: CatalogDepartment, brand: string) {
  return `${department}::${brand}`;
}

function seriesPanelKey(
  department: CatalogDepartment,
  brand: string,
  series: string
) {
  return `${catalogBrandKey(department, brand)}::series::${series}`;
}

function closedSeriesPanelKey(panelKey: string) {
  return `closed::${panelKey}`;
}

function isClosedSeriesPanelKey(panelKey: string) {
  return panelKey.startsWith("closed::");
}

function seriesPanelMatchesBrand(panelKey: string, brandKey: string) {
  const openPanelKey = isClosedSeriesPanelKey(panelKey)
    ? panelKey.slice("closed::".length)
    : panelKey;

  return openPanelKey.startsWith(`${brandKey}::series::`);
}

function selectedModelElementId(prefix: string) {
  return `${prefix}-selected-model`;
}

function groupToggleLabel(
  t: (key: string) => string,
  label: string,
  expanded: boolean
) {
  return txFormat(
    t,
    expanded
      ? "storefront.catalog.collapseGroup"
      : "storefront.catalog.expandGroup",
    expanded ? "Comprimi {label}" : "Espandi {label}",
    { label }
  );
}

function compareModelNames(left: string, right: string) {
  return left.localeCompare(right, "it", { numeric: true, sensitivity: "base" });
}

function isSameCatalogValue(left?: string, right?: string) {
  if (!left || !right) {
    return false;
  }

  return (
    left.trim().localeCompare(right.trim(), "it", {
      numeric: true,
      sensitivity: "base",
    }) === 0
  );
}

function isCatalogDepartment(value: string): value is CatalogDepartment {
  return (catalogDepartments as readonly string[]).includes(value);
}

function slugKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}
