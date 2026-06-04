export const shippingFeeCents = 650;
export const freeShippingThresholdCents = 10000;
export const freeShippingThresholdEuros = freeShippingThresholdCents / 100;

export function calculateShippingCents(subtotalCents: number) {
  const normalizedSubtotalCents = Math.max(0, Math.round(subtotalCents));

  if (normalizedSubtotalCents === 0) {
    return 0;
  }

  return normalizedSubtotalCents >= freeShippingThresholdCents ? 0 : shippingFeeCents;
}
