import type { CustomerLevel, PartProduct } from "@/lib/partspro-data";
import { normalizeCustomerTier } from "@/lib/partspro-pricing";

export type ProductPriceDisplay = {
  basePrice: number | null;
  discountPercent: number;
  effectivePrice: number;
  hasDiscount: boolean;
  level: CustomerLevel;
  levelDiscountAmount: number;
  levelDiscountPercent: number;
  priceGroupDiscountPercent: number;
};

export function getProductPriceDisplay(product: PartProduct): ProductPriceDisplay {
  const effectivePrice = finiteMoney(product.price) ?? 0;
  const explicitBasePrice = finiteMoney(product.basePrice);
  const basePrice =
    explicitBasePrice !== null && explicitBasePrice > 0
      ? explicitBasePrice
      : null;
  const computedDiscountPercent =
    basePrice && basePrice > 0 && effectivePrice > 0
      ? roundPercent((1 - effectivePrice / basePrice) * 100)
      : 0;
  const discountPercent =
    finiteMoney(product.discountPercent) ?? computedDiscountPercent;
  const levelDiscountAmount = finiteMoney(product.levelDiscountAmount) ?? 0;
  const levelDiscountPercent = finiteMoney(product.levelDiscountPercent) ?? 0;
  const priceGroupDiscountPercent = finiteMoney(product.priceGroupDiscountPercent) ?? 0;
  const hasDiscount = Boolean(
    basePrice &&
      effectivePrice > 0 &&
      basePrice - effectivePrice > 0.005 &&
      discountPercent > 0
  );

  return {
    basePrice,
    discountPercent: Math.max(0, discountPercent),
    effectivePrice,
    hasDiscount,
    level: normalizeCustomerTier(product.customerLevel),
    levelDiscountAmount: Math.max(0, levelDiscountAmount),
    levelDiscountPercent: Math.max(0, levelDiscountPercent),
    priceGroupDiscountPercent: Math.max(0, priceGroupDiscountPercent),
  };
}

export function formatPercentBadge(value: number) {
  return `-${Math.round(Math.max(0, value))}%`;
}

function finiteMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function roundPercent(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
