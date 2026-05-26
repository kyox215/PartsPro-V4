import { ProductDetailPage } from "@/components/partspro/product-detail-page";
import type { PartProduct } from "@/lib/partspro-data";
import {
  applyAccountPriceToProduct,
  getCurrentAccountContext,
  type AccountContext,
} from "@/lib/partspro-account-context";
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
  const account = await getCurrentAccountContext({ ensure: true });
  const [productResult] = await Promise.all([
    getCatalogProductBySkuOrSlug(decodedSku),
  ]);
  const product = productResult.data;

  if (!product) {
    notFound();
  }

  return (
    <ProductDetailPage
      product={toProductDetailProduct(product, account)}
      showWholesalePrice={account.canViewPrices}
    />
  );
}

function toProductDetailProduct(
  product: PartProduct,
  account: AccountContext
): PartProduct {
  return applyAccountPriceToProduct(product, account);
}
