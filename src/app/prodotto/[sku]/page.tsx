import { ProductDetailPage } from "@/components/partspro/product-detail-page";
import type { PartProduct } from "@/lib/partspro-data";
import {
  applyAccountPriceToProduct,
  canDelegateCheckout,
  getCurrentAccountContext,
  priceVisibilityReason,
  type AccountContext,
} from "@/lib/partspro-account-context";
import { readAssistedCompanyIdFromRecord } from "@/lib/partspro-assisted-order";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import {
  getCatalogProductBySkuOrSlug,
  listCatalogProductsBySkus,
} from "@/lib/partspro-repository";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sku: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ sku }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const decodedSku = decodeURIComponent(sku);
  const account = await getCurrentAccountContext({ ensure: true });
  const requestedCompanyId = readAssistedCompanyIdFromRecord(resolvedSearchParams);
  const assistedCompanyId =
    requestedCompanyId && canDelegateCheckout(account) ? requestedCompanyId : null;
  const productResult = assistedCompanyId
    ? await listCatalogProductsBySkus([decodedSku], {
        buyerCustomerId: assistedCompanyId,
        includeBuyerPrices: true,
      })
    : null;
  const assistedProduct = productResult?.data[0] ?? null;
  const fallbackProductResult = assistedProduct
    ? null
    : await getCatalogProductBySkuOrSlug(decodedSku);
  const product = assistedProduct ?? fallbackProductResult?.data ?? null;

  if (!product) {
    notFound();
  }

  return (
    <ProductDetailPage
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      assistedCompanyId={assistedCompanyId}
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
