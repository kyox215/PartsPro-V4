"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { deviceModels, type DeviceModelGroup } from "@/lib/partspro-data";
import { cn } from "@/lib/utils";

type CatalogBrandTreeVariant = "mobile" | "desktop";

type CatalogBrandTreeProps = {
  expandedBrand: string | null;
  idPrefix: string;
  modelGroups?: readonly DeviceModelGroup[];
  onExpandedBrandChange: (brand: string | null) => void;
  onNavigate?: () => void;
  showAvailableLink?: boolean;
  variant?: CatalogBrandTreeVariant;
};

export function CatalogBrandTree({
  expandedBrand,
  idPrefix,
  modelGroups,
  onExpandedBrandChange,
  onNavigate,
  showAvailableLink = false,
  variant = "mobile",
}: CatalogBrandTreeProps) {
  const desktop = variant === "desktop";
  const groups = useMemo(
    () => mergeModelGroups(deviceModels, modelGroups ?? []),
    [modelGroups]
  );

  return (
    <div
      className={cn(
        desktop ? "space-y-2" : "space-y-2 rounded-lg bg-white px-2 py-2 shadow-sm"
      )}
    >
      <Link
        href="/catalogo"
        className={cn(
          "flex items-center rounded-md font-black text-primary transition hover:bg-primary/8",
          desktop ? "h-10 bg-primary/8 px-3 text-sm" : "h-8 px-2 text-xs"
        )}
        onClick={onNavigate}
      >
        Tutto il catalogo
      </Link>
      {showAvailableLink && (
        <Link
          href="/catalogo?minStock=1"
          className={cn(
            "flex items-center rounded-md font-black text-emerald-700 transition hover:bg-emerald-50",
            desktop ? "h-10 px-3 text-sm" : "h-8 px-2 text-xs"
          )}
          onClick={onNavigate}
        >
          Solo disponibili
        </Link>
      )}
      <div className={desktop ? "space-y-1.5" : "space-y-1"}>
        {groups.map((entry) => {
          const brandOpen = expandedBrand === entry.brand;
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
                  desktop ? "h-10 px-3 text-sm" : "h-9 px-2 text-xs"
                )}
                aria-expanded={brandOpen}
                aria-controls={brandPanelId}
                onClick={() =>
                  onExpandedBrandChange(brandOpen ? null : entry.brand)
                }
              >
                <span className="min-w-0 flex-1 truncate">{entry.brand}</span>
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
                    desktop ? "space-y-2 p-2" : "p-2"
                  )}
                >
                  <Link
                    href={catalogQueryHref({ brand: entry.brand })}
                    className={cn(
                      "flex items-center rounded-md bg-primary/8 font-black text-primary hover:bg-primary/12",
                      desktop ? "h-9 px-2.5 text-xs" : "mb-2 h-8 px-2 text-[11px]"
                    )}
                    onClick={onNavigate}
                  >
                    Tutti i modelli {entry.brand}
                  </Link>
                  <div className={desktop ? "grid gap-1" : "flex flex-wrap gap-1"}>
                    {entry.models.map((model) => (
                      <Link
                        key={model}
                        href={catalogQueryHref({ brand: entry.brand, model })}
                        className={cn(
                          "rounded-md bg-slate-50 font-semibold leading-4 text-slate-600 hover:bg-primary/8 hover:text-primary",
                          desktop ? "px-2.5 py-2 text-xs" : "px-2 py-1 text-[11px]"
                        )}
                        onClick={onNavigate}
                      >
                        {model}
                      </Link>
                    ))}
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

function mergeModelGroups(
  fallbackGroups: readonly DeviceModelGroup[],
  dynamicGroups: readonly DeviceModelGroup[]
) {
  const groups = new Map<string, Set<string>>();

  for (const group of [...fallbackGroups, ...dynamicGroups]) {
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

  const preferredBrandOrder = fallbackGroups.map((group) => group.brand);

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
