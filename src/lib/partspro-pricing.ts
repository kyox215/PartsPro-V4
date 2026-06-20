import type { CompanyProfile, CustomerLevel } from "@/lib/partspro-data";
import { freeShippingThresholdEuros } from "@/lib/partspro-shipping";

export type CustomerTier = CustomerLevel;

export type CustomerTierRule = {
  tier: CustomerTier;
  discountAmount: number;
  paymentTerms: string;
  creditLimit: number;
  freeShippingThreshold: number;
  label: string;
  tagLabel: string;
  minSpend: number;
  maxSpend: number | null;
};

export type TierPriceBreakdown = {
  tier: CustomerTier;
  basePrice: number;
  discountAmount: number;
  finalPrice: number;
};

export const customerTiers = [
  "bronze",
  "silver",
  "gold",
  "emerald",
  "diamond",
  "master",
  "king",
] as const satisfies readonly CustomerTier[];

export const customerTierRules = {
  bronze: {
    tier: "bronze",
    discountAmount: 0,
    paymentTerms: "Pagamento anticipato",
    creditLimit: 0,
    freeShippingThreshold: freeShippingThresholdEuros,
    label: "Bronzo",
    tagLabel: "Livello Bronzo",
    minSpend: 0,
    maxSpend: 999.99,
  },
  silver: {
    tier: "silver",
    discountAmount: 0.25,
    paymentTerms: "30 giorni data fattura",
    creditLimit: 1000,
    freeShippingThreshold: freeShippingThresholdEuros,
    label: "Argento",
    tagLabel: "Livello Argento",
    minSpend: 1000,
    maxSpend: 10799.99,
  },
  gold: {
    tier: "gold",
    discountAmount: 0.5,
    paymentTerms: "45 giorni data fattura",
    creditLimit: 2500,
    freeShippingThreshold: freeShippingThresholdEuros,
    label: "Oro",
    tagLabel: "Livello Oro",
    minSpend: 10800,
    maxSpend: 20599.99,
  },
  emerald: {
    tier: "emerald",
    discountAmount: 0.75,
    paymentTerms: "45 giorni data fattura",
    creditLimit: 5000,
    freeShippingThreshold: freeShippingThresholdEuros,
    label: "Smeraldo",
    tagLabel: "Livello Smeraldo",
    minSpend: 20600,
    maxSpend: 30399.99,
  },
  diamond: {
    tier: "diamond",
    discountAmount: 1,
    paymentTerms: "60 giorni data fattura",
    creditLimit: 7500,
    freeShippingThreshold: freeShippingThresholdEuros,
    label: "Diamante",
    tagLabel: "Livello Diamante",
    minSpend: 30400,
    maxSpend: 40199.99,
  },
  master: {
    tier: "master",
    discountAmount: 1.25,
    paymentTerms: "60 giorni data fattura",
    creditLimit: 10000,
    freeShippingThreshold: freeShippingThresholdEuros,
    label: "Maestro",
    tagLabel: "Livello Maestro",
    minSpend: 40200,
    maxSpend: 49999.99,
  },
  king: {
    tier: "king",
    discountAmount: 1.5,
    paymentTerms: "60 giorni data fattura",
    creditLimit: 15000,
    freeShippingThreshold: freeShippingThresholdEuros,
    label: "Re",
    tagLabel: "Livello Re",
    minSpend: 50000,
    maxSpend: null,
  },
} as const satisfies Record<CustomerTier, CustomerTierRule>;

export function isCustomerTier(value: string): value is CustomerTier {
  return customerTiers.includes(value as CustomerTier);
}

export function normalizeCustomerTier(
  tier: CompanyProfile["priceList"] | string | null | undefined
): CustomerTier {
  if (typeof tier !== "string") {
    return "bronze";
  }

  const normalized = tier.trim().toLowerCase();

  if (isCustomerTier(normalized)) {
    return normalized;
  }

  if (normalized === "standard") {
    return "bronze";
  }

  if (normalized === "pro") {
    return "silver";
  }

  if (normalized === "partner") {
    return "gold";
  }

  return "bronze";
}

export type CustomerTierPromotionInput = {
  level?: CustomerTier | string | null;
  lifetimeSpendNet?: number | null;
  promoLevel?: CustomerTier | string | null;
  promoLevelExpiresAt?: string | Date | null;
  promoLevelStartsAt?: string | Date | null;
  tier?: CustomerTier | string | null;
};

export function isCustomerTierPromotionActive(
  input: CustomerTierPromotionInput,
  now: Date = new Date()
): boolean {
  const promoLevel = normalizeOptionalCustomerTier(input.promoLevel);

  if (!promoLevel || !input.promoLevelStartsAt || !input.promoLevelExpiresAt) {
    return false;
  }

  const startsAt = toValidDate(input.promoLevelStartsAt);
  const expiresAt = toValidDate(input.promoLevelExpiresAt);

  if (!startsAt || !expiresAt) {
    return false;
  }

  return now >= startsAt && now < expiresAt;
}

export function effectiveCustomerTier(
  input: CustomerTierPromotionInput,
  now: Date = new Date()
): CustomerTier {
  if (isCustomerTierPromotionActive(input, now)) {
    return normalizeCustomerTier(input.promoLevel);
  }

  const expiresAt = toValidDate(input.promoLevelExpiresAt ?? null);

  if (normalizeOptionalCustomerTier(input.promoLevel) && expiresAt && now >= expiresAt) {
    return levelForLifetimeSpend(input.lifetimeSpendNet ?? 0);
  }

  return normalizeCustomerTier(input.level ?? input.tier);
}

export function getTierRule(tier: CompanyProfile["priceList"]): CustomerTierRule {
  return customerTierRules[tier];
}

export function calculateTierPrice(
  basePrice: number,
  tier: CompanyProfile["priceList"]
): number {
  const price = Math.max(0, basePrice);
  const { discountAmount } = getTierRule(tier);

  return roundCurrency(Math.max(0, price - discountAmount));
}

export function levelForLifetimeSpend(spend: number): CustomerTier {
  if (spend >= 50000) return "king";
  if (spend >= 40200) return "master";
  if (spend >= 30400) return "diamond";
  if (spend >= 20600) return "emerald";
  if (spend >= 10800) return "gold";
  if (spend >= 1000) return "silver";
  return "bronze";
}

export function getTierPriceBreakdown(
  basePrice: number,
  tier: CompanyProfile["priceList"]
): TierPriceBreakdown {
  const price = Math.max(0, basePrice);
  const finalPrice = calculateTierPrice(price, tier);

  return {
    tier,
    basePrice: roundCurrency(price),
    discountAmount: roundCurrency(price - finalPrice),
    finalPrice,
  };
}

export function formatTierDiscount(tier: CompanyProfile["priceList"]): string {
  return formatTierDiscountAmount(getTierRule(tier).discountAmount);
}

export function formatTierDiscountAmount(discountAmount: number): string {
  return formatEuroCents(Math.max(0, discountAmount));
}

export function formatTierCreditLimit(tier: CompanyProfile["priceList"]): string {
  return formatEuro(getTierRule(tier).creditLimit);
}

export function formatTierFreeShippingThreshold(
  tier: CompanyProfile["priceList"]
): string {
  const threshold = getTierRule(tier).freeShippingThreshold;

  return threshold === 0 ? "Sempre inclusa" : `Da ${formatEuro(threshold)}`;
}

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    currency: "EUR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatEuroCents(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    currency: "EUR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function normalizeOptionalCustomerTier(
  tier: CustomerTier | string | null | undefined
): CustomerTier | null {
  if (typeof tier !== "string" || tier.trim().length === 0) {
    return null;
  }

  return normalizeCustomerTier(tier);
}

function toValidDate(value: string | Date | null): Date | null {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;

  return date && Number.isFinite(date.getTime()) ? date : null;
}
