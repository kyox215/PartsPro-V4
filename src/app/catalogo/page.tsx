import { Suspense } from "react";
import { CatalogPage } from "@/components/partspro/catalog-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CatalogPage />
    </Suspense>
  );
}
