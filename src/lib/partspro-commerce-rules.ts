import type { PartProduct } from "@/lib/partspro-data";

export function hasOrderableEffectivePrice(
  product: Pick<PartProduct, "price">
) {
  return Number.isFinite(product.price) && product.price > 0;
}
