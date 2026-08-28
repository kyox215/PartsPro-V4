export const SUPPLIER_BATCH_CURRENCIES = ["EUR", "USD", "CNY"] as const;

export type SupplierBatchCurrency = (typeof SUPPLIER_BATCH_CURRENCIES)[number];

export function normalizeSupplierBatchCurrency(
  value: unknown,
  fallback: SupplierBatchCurrency = "EUR"
): SupplierBatchCurrency {
  const currency = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (SUPPLIER_BATCH_CURRENCIES as readonly string[]).includes(currency)
    ? (currency as SupplierBatchCurrency)
    : fallback;
}
export function isSupplierBatchNonEurCurrency(value: unknown): boolean {
  return normalizeSupplierBatchCurrency(value) !== "EUR";
}

export function formatSupplierBatchMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = "EUR",
  locale = "zh-CN",
  options: Intl.NumberFormatOptions = {}
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—";
  }

  const normalizedCurrency = normalizeSupplierBatchCurrency(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    ...options,
  }).format(amount);
}

export function formatSupplierBatchCents(
  cents: number | null | undefined,
  currency: string | null | undefined = "EUR",
  locale = "zh-CN"
): string {
  return cents === null || cents === undefined
    ? "—"
    : formatSupplierBatchMoney(cents / 100, currency, locale);
}

export function formatSupplierBatchUnitMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = "EUR",
  locale = "zh-CN"
): string {
  return formatSupplierBatchMoney(amount, currency, locale, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function formatSupplierBatchDualMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  baseAmountEur: number | null | undefined,
  locale = "zh-CN"
): string {
  const primary = formatSupplierBatchMoney(amount, currency, locale);
  const normalizedCurrency = normalizeSupplierBatchCurrency(currency);
  if (normalizedCurrency === "EUR" || baseAmountEur === null || baseAmountEur === undefined) {
    return primary;
  }

  return `${primary} · ${formatSupplierBatchMoney(baseAmountEur, "EUR", locale)}`;
}

export function formatSupplierBatchDualCents(
  cents: number | null | undefined,
  currency: string | null | undefined,
  baseCentsEur: number | null | undefined,
  locale = "zh-CN"
): string {
  return formatSupplierBatchDualMoney(
    cents === null || cents === undefined ? null : cents / 100,
    currency,
    baseCentsEur === null || baseCentsEur === undefined ? null : baseCentsEur / 100,
    locale
  );
}

export function readSupplierBatchNumeric(
  value: unknown,
  keys: readonly string[]
): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim() !== "") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function readSupplierBatchMoneyCents(
  value: unknown,
  centsKeys: readonly string[],
  decimalKeys: readonly string[] = []
): number | null {
  const cents = readSupplierBatchNumeric(value, centsKeys);
  if (cents !== null && Number.isSafeInteger(cents)) {
    return cents;
  }

  const decimal = readSupplierBatchNumeric(value, decimalKeys);
  if (decimal === null) {
    return null;
  }

  const rounded = Math.round((decimal + Number.EPSILON) * 100);
  return Number.isSafeInteger(rounded) ? rounded : null;
}

export function readSupplierBatchCurrency(
  value: unknown,
  fallback: SupplierBatchCurrency = "EUR"
): SupplierBatchCurrency {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  return normalizeSupplierBatchCurrency(record.currency ?? record.currencyCode, fallback);
}

export function formatSupplierBatchDateTime(
  value: string | null | undefined,
  locale = "zh-CN",
  timeZone = "Europe/Rome"
): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}
