import { tx, type StorefrontTranslator } from "@/i18n/dictionaries/storefront";
import type { PartProduct } from "@/lib/partspro-data";

export type PublicStockLevel =
  | "good"
  | "limited"
  | "belowMoq"
  | "outOfStock";

type StockLevelInput = Pick<PartProduct, "moq" | "status" | "stock">;

export function getPublicStockLevel({
  moq,
  status,
  stock,
}: StockLevelInput): PublicStockLevel {
  const minimumQuantity = Math.max(1, moq);

  if (status === "Out of Stock" || stock <= 0) {
    return "outOfStock";
  }

  if (stock < minimumQuantity) {
    return "belowMoq";
  }

  if (status === "Low Stock") {
    return "limited";
  }

  return "good";
}

export function publicStockLevelLabel(
  t: StorefrontTranslator,
  level: PublicStockLevel
) {
  switch (level) {
    case "good":
      return tx(t, "storefront.data.stockLevel.good", "Disponibilita buona");
    case "limited":
      return tx(t, "storefront.data.stockLevel.limited", "Scorte limitate");
    case "belowMoq":
      return tx(t, "storefront.data.stockLevel.belowMoq", "Sotto MOQ");
    case "outOfStock":
      return tx(t, "storefront.data.stockLevel.outOfStock", "Esaurito");
  }
}

export function publicStockLevelClassName(level: PublicStockLevel) {
  switch (level) {
    case "good":
      return "border border-emerald-100 bg-emerald-50 text-emerald-700";
    case "limited":
      return "border border-amber-100 bg-amber-50 text-amber-800";
    case "belowMoq":
      return "border border-orange-100 bg-orange-50 text-orange-800";
    case "outOfStock":
      return "border border-slate-200 bg-slate-100 text-slate-500";
  }
}

export function publicStockLevelMeta(
  t: StorefrontTranslator,
  product: StockLevelInput
) {
  const level = getPublicStockLevel(product);

  return {
    className: publicStockLevelClassName(level),
    label: publicStockLevelLabel(t, level),
    level,
  };
}
