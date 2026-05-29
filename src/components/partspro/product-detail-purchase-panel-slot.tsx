"use client";

import dynamic from "next/dynamic";
import type { PartProduct } from "@/lib/partspro-data";

const ProductDetailPurchasePanel = dynamic(
  () =>
    import("./product-detail-purchase-panel").then(
      (module) => module.ProductDetailPurchasePanel
    ),
  {
    loading: () => (
      <div className="mt-3 h-52 animate-pulse rounded-lg border border-primary/20 bg-primary/8" />
    ),
    ssr: false,
  }
);

export function ProductDetailPurchasePanelSlot({
  isAuthenticated = false,
  product,
}: {
  isAuthenticated?: boolean;
  product: PartProduct;
}) {
  return (
    <ProductDetailPurchasePanel
      isAuthenticated={isAuthenticated}
      product={product}
    />
  );
}
