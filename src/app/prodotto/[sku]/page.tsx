import { ProductDetailPage } from "@/components/partspro/product-detail-page";
import type { PartProduct } from "@/lib/partspro-data";
import {
  applyAccountPriceToProduct,
  getCurrentAccountContext,
  priceVisibilityReason,
  type AccountContext,
} from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";
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
  const [account, productResult] = await Promise.all([
    getCurrentAccountContext({ ensure: true }),
    getCatalogProductBySkuOrSlug(decodedSku),
  ]);
  const product = productResult.data;

  if (!product) {
    notFound();
  }

  return (
    <ProductDetailPage
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      priceGateReason={priceVisibilityReason(account)}
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
