import { ProductDetailPage } from "@/components/partspro/product-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = await params;

  return <ProductDetailPage slug={sku} />;
}
