import { ProductDetailPage } from "@/components/partspro/product-detail-page";
import { getCatalogProductBySkuOrSlug } from "@/lib/partspro-repository";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  const product = (await getCatalogProductBySkuOrSlug(decodedSku)).data;

  if (!product) {
    notFound();
  }

  return <ProductDetailPage product={product} />;
}
