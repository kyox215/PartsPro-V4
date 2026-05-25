import { ProductDetailPage } from "@/components/partspro/product-detail-page";
import type { PartProduct } from "@/lib/partspro-data";
import { canViewWholesalePrices } from "@/lib/partspro-price-access";
import { getCatalogProductBySkuOrSlug } from "@/lib/partspro-repository";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  const [productResult, showWholesalePrice] = await Promise.all([
    getCatalogProductBySkuOrSlug(decodedSku),
    canViewWholesalePrices(),
  ]);
  const product = productResult.data;

  if (!product) {
    notFound();
  }

  return (
    <ProductDetailPage
      product={toProductDetailProduct(product, showWholesalePrice)}
      showWholesalePrice={showWholesalePrice}
    />
  );
}

function toProductDetailProduct(
  product: PartProduct,
  showWholesalePrice: boolean
): PartProduct {
  if (showWholesalePrice) {
    return product;
  }

  return {
    ...product,
    price: 0,
    retailPrice: 0,
  };
}
