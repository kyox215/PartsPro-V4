export const shippingFeeCents = 650;
export const freeShippingThresholdCents = 10000;
export const freeShippingThresholdEuros = freeShippingThresholdCents / 100;

export const deliveryMethods = ["express_24_48", "pickup"] as const;
export const deliveryMethodInputValues = ["express_24_48", "pickup", "pickup_milano"] as const;
export type DeliveryMethod = (typeof deliveryMethods)[number];

export const defaultDeliveryMethod: DeliveryMethod = "express_24_48";
export const expressShippingMethodLabel = "GLS/BRT 24-48h";
export const pickupShippingMethodLabel = "Ritiro in sede";

export function normalizeDeliveryMethod(value: unknown): DeliveryMethod {
  if (typeof value !== "string") {
    return defaultDeliveryMethod;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "pickup" ||
    normalized === "pickup_milano" ||
    normalized.includes("ritiro")
  ) {
    return "pickup";
  }

  return defaultDeliveryMethod;
}

export function shippingMethodForDeliveryMethod(method: DeliveryMethod) {
  return method === "pickup" ? pickupShippingMethodLabel : expressShippingMethodLabel;
}

export function isPickupDeliveryMethod(method: DeliveryMethod) {
  return method === "pickup";
}

export function isPickupShippingMethod(value: unknown) {
  return normalizeDeliveryMethod(value) === "pickup";
}

export function calculateShippingCents(
  subtotalCents: number,
  deliveryMethod: DeliveryMethod = defaultDeliveryMethod
) {
  const normalizedSubtotalCents = Math.max(0, Math.round(subtotalCents));

  if (normalizedSubtotalCents === 0 || isPickupDeliveryMethod(deliveryMethod)) {
    return 0;
  }

  return normalizedSubtotalCents >= freeShippingThresholdCents ? 0 : shippingFeeCents;
}
