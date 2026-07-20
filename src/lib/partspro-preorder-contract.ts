import type { PartProduct, ProductPreorderAvailability } from "@/lib/partspro-data";

export type ProductPurchaseKind = "stock" | "preorder" | "unavailable";
type OrderableProduct = Pick<
  PartProduct,
  "moq" | "preorder" | "price" | "status" | "stock"
>;

export function getProductPurchaseKind(product: OrderableProduct): ProductPurchaseKind {
  const minimumQuantity = Math.max(1, product.moq);

  if (
    product.status !== "Out of Stock" &&
    product.stock >= minimumQuantity
  ) {
    return "stock";
  }

  if (isOpenPreorder(product.preorder, minimumQuantity)) {
    return "preorder";
  }

  return "unavailable";
}

export function getProductOrderableQuantity(product: OrderableProduct) {
  return getProductPurchaseKind(product) === "preorder"
    ? Math.max(0, product.preorder?.remainingQty ?? 0)
    : Math.max(0, product.stock);
}

export function isProductOrderable(product: OrderableProduct, quantity = product.moq) {
  const minimumQuantity = Math.max(1, product.moq);
  const normalizedQuantity = Math.trunc(quantity);

  return (
    product.price > 0 &&
    normalizedQuantity >= minimumQuantity &&
    normalizedQuantity <= getProductOrderableQuantity(product) &&
    getProductPurchaseKind(product) !== "unavailable"
  );
}

export function isPreorderProduct(product: OrderableProduct) {
  return getProductPurchaseKind(product) === "preorder";
}

export function isOpenPreorder(
  preorder: ProductPreorderAvailability | undefined,
  minimumQuantity = 1
) {
  return Boolean(
    preorder?.enabled &&
      preorder.status === "open" &&
      preorder.remainingQty >= Math.max(1, minimumQuantity) &&
      (!preorder.closeAt || Date.parse(preorder.closeAt) > Date.now())
  );
}

export function preorderEtaLabel(
  preorder: ProductPreorderAvailability | undefined,
  locale = "it-IT"
) {
  if (!preorder?.etaStart || !preorder.etaEnd) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  });
  const start = new Date(`${preorder.etaStart}T12:00:00Z`);
  const end = new Date(`${preorder.etaEnd}T12:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }

  return preorder.etaStart === preorder.etaEnd
    ? formatter.format(start)
    : `${formatter.format(start)} - ${formatter.format(end)}`;
}
