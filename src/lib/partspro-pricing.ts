import type { CompanyProfile } from "@/lib/partspro-data";

export type CustomerTier = CompanyProfile["priceList"];

export type CustomerTierRule = {
  tier: CustomerTier;
  discountRate: number;
  paymentTerms: string;
  creditLimit: number;
  freeShippingThreshold: number;
  label: string;
  tagLabel: string;
};

export type TierPriceBreakdown = {
  tier: CustomerTier;
  basePrice: number;
  discountRate: number;
  discountAmount: number;
  finalPrice: number;
};

export const customerTiers = ["Standard", "Pro", "Partner"] as const satisfies readonly CustomerTier[];

export const customerTierRules = {
  Standard: {
    tier: "Standard",
    discountRate: 0,
    paymentTerms: "Pagamento anticipato",
    creditLimit: 0,
    freeShippingThreshold: 250,
    label: "Standard",
    tagLabel: "Listino Standard",
  },
  Pro: {
    tier: "Pro",
    discountRate: 0.08,
    paymentTerms: "30 giorni data fattura",
    creditLimit: 2500,
    freeShippingThreshold: 150,
    label: "Pro",
    tagLabel: "Listino Pro",
  },
  Partner: {
    tier: "Partner",
    discountRate: 0.15,
    paymentTerms: "45 giorni data fattura",
    creditLimit: 7500,
    freeShippingThreshold: 0,
    label: "Partner",
    tagLabel: "Partner premium",
  },
} as const satisfies Record<CustomerTier, CustomerTierRule>;

export function isCustomerTier(value: string): value is CustomerTier {
  return customerTiers.includes(value as CustomerTier);
}

export function normalizeCustomerTier(
  tier: CompanyProfile["priceList"] | string | null | undefined
): CustomerTier {
  return typeof tier === "string" && isCustomerTier(tier) ? tier : "Standard";
}

export function getTierRule(tier: CompanyProfile["priceList"]): CustomerTierRule {
  return customerTierRules[tier];
}

export function calculateTierPrice(
  basePrice: number,
  tier: CompanyProfile["priceList"]
): number {
  const price = Math.max(0, basePrice);
  const { discountRate } = getTierRule(tier);

  return roundCurrency(price * (1 - discountRate));
}

export function getTierPriceBreakdown(
  basePrice: number,
  tier: CompanyProfile["priceList"]
): TierPriceBreakdown {
  const price = Math.max(0, basePrice);
  const rule = getTierRule(tier);
  const finalPrice = calculateTierPrice(price, tier);

  return {
    tier,
    basePrice: roundCurrency(price),
    discountRate: rule.discountRate,
    discountAmount: roundCurrency(price - finalPrice),
    finalPrice,
  };
}

export function formatTierDiscount(tier: CompanyProfile["priceList"]): string {
  return formatDiscountRate(getTierRule(tier).discountRate);
}

export function formatDiscountRate(discountRate: number): string {
  return `${Math.round(discountRate * 100)}%`;
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
