"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { deviceModels, type DeviceModelGroup } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";
import { brandLabel, tx } from "@/i18n/dictionaries/storefront";
import { useT } from "./i18n-provider";

type CatalogBrandTreeVariant = "mobile" | "desktop";

export type CatalogSelection = {
  brand?: string;
  inStockOnly?: boolean;
  model?: string;
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
  const selectedModelRef = useRef<HTMLElement | null>(null);
  const selectedBrand = selectedCatalog?.brand;
  const selectedModel = selectedCatalog?.model;
  const inStockOnly = Boolean(selectedCatalog?.inStockOnly);
  const selectionKnown = Boolean(selectedCatalog);
  const groups = useMemo(
    () => canonicalModelGroups(modelGroups ?? deviceModels),
    [modelGroups]
  );
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
      inStockOnly: checked || undefined,
      model: selectedModel,
    });
  }

  function handleModelSelect(brand: string, model: string) {
    handleSelect({
      brand,
      inStockOnly: inStockOnly || undefined,
      model,
    });
  }

  useEffect(() => {
    if (!selectedModel || !selectedBrand || expandedBrand !== selectedBrand) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      selectedModelRef.current?.scrollIntoView({
        block: "center",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [expandedBrand, selectedBrand, selectedModel]);

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
                onClick={() =>
                  onExpandedBrandChange(brandOpen ? null : entry.brand)
                }
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
                  <div className={desktop ? "grid gap-1" : "grid grid-cols-2 gap-1"}>
                    {entry.models.map((model) => {
                      const modelSelected =
                        brandSelected && isSameCatalogValue(selectedModel, model);
                      const modelClassName = cn(
                        "min-w-0 rounded-md bg-slate-50 text-left font-semibold leading-4 text-slate-600 transition hover:bg-primary/8 hover:text-primary",
                        desktop ? "px-2.5 py-2 text-xs" : "h-9 px-2 py-2 text-[11px]",
                        modelSelected &&
                          "bg-primary text-white shadow-sm hover:bg-primary hover:text-white"
                      );
                      const selectedRef = modelSelected
                        ? (node: HTMLElement | null) => {
                            selectedModelRef.current = node;
                          }
                        : undefined;

                      return onSelectCatalog ? (
                        <button
                          key={model}
                          ref={selectedRef}
                          type="button"
                          aria-pressed={modelSelected}
                          className={modelClassName}
                          onClick={() => handleModelSelect(entry.brand, model)}
                          title={model}
                        >
                          <span className="block truncate">{model}</span>
                        </button>
                      ) : (
                        <Link
                          key={model}
                          ref={selectedRef}
                          href={catalogQueryHref({ brand: entry.brand, model })}
                          prefetch={prefetchCatalogLinks ? null : false}
                          className={modelClassName}
                          onClick={onNavigate}
                          title={model}
                        >
                          <span className="block truncate">{model}</span>
                        </Link>
                      );
                    })}
                  </div>
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
  model,
}: {
  brand?: string;
  model?: string;
}) {
  const params = new URLSearchParams();

  if (brand) {
    params.set("brand", brand);
  }

  if (model) {
    params.set("model", model);
  }

  const query = params.toString();

  return query ? `/catalogo?${query}` : "/catalogo";
}

function catalogBrandPanelId(prefix: string, brand: string) {
  return `${prefix}-brand-${brand.toLowerCase().replace(/\s+/g, "-")}`;
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
  const groups = new Map<string, Set<string>>();

  for (const group of sourceGroups) {
    const brand = group.brand.trim();

    if (!brand) {
      continue;
    }

    const models = groups.get(brand) ?? new Set<string>();

    for (const model of group.models) {
      const normalizedModel = model.trim();

      if (normalizedModel) {
        models.add(normalizedModel);
      }
    }

    groups.set(brand, models);
  }

  const preferredBrandOrder = sourceGroups.map((group) => group.brand);

  return Array.from(groups.entries())
    .map(([brand, models]) => ({
      brand,
      models: Array.from(models).sort(compareModelNames),
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

function compareModelNames(left: string, right: string) {
  return left.localeCompare(right, "it", { numeric: true, sensitivity: "base" });
}
