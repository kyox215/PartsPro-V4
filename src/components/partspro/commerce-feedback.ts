import type { PartProduct } from "@/lib/partspro-data";
import { getProductPurchaseKind } from "@/lib/partspro-preorder-contract";
import type { CartItem } from "./cart-state";

/** Explain an existing add-to-cart rejection without changing cart policy. */
export function cartHasPurchaseKindConflict(product: PartProduct, items: readonly CartItem[]) {
  const incomingKind = getProductPurchaseKind(product);
  if (incomingKind === "unavailable") return false;
  const knownKinds = items.flatMap((item) => {
    const snapshot = item.sku === product.sku ? product : item.snapshot;
    if (!snapshot) return [];
    const kind = getProductPurchaseKind(snapshot);
    return kind === "unavailable" ? [] : [kind];
  });
  return knownKinds.length > 0 && !knownKinds.includes(incomingKind);
}
