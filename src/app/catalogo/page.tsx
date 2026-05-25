import { Suspense } from "react";
import { CatalogPage } from "@/components/partspro/catalog-page";
import { listCatalogProducts } from "@/lib/partspro-repository";

export default async function Page() {
  const catalog = await listCatalogProducts();

  return (
    <Suspense fallback={null}>
      <CatalogPage catalogSource={catalog.source} initialProducts={catalog.data} />
    </Suspense>
  );
}
