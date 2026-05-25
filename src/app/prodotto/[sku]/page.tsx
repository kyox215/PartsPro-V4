import { ProductDetailPage } from "@/components/partspro/product-detail-page";
import { listCatalogProducts } from "@/lib/partspro-repository";
import { notFound } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;
  const decodedSku = decodeURIComponent(sku);
  const catalog = await listCatalogProducts();
  const product = catalog.data.find(
    (item) => item.sku === decodedSku || item.slug === decodedSku
  );

  if (!product) {
    notFound();
  }

  return <ProductDetailPage product={product} />;
}
