import { Suspense } from "react";
import { CatalogPage } from "@/components/partspro/catalog-page";
import {
  listCatalogModelGroups,
  pageCatalogProducts,
} from "@/lib/partspro-repository";
import type { PartProduct } from "@/lib/partspro-data";
import { canViewWholesalePrices } from "@/lib/partspro-price-access";

const initialCatalogLimit = 48;
export const dynamic = "force-dynamic";

type CatalogPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function Page({
  searchParams,
}: {
  searchParams: CatalogPageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const query = readCatalogQuery(resolvedSearchParams);
  const showWholesalePrice = await canViewWholesalePrices();
  const [catalogPage, modelGroups] = await Promise.all([
    pageCatalogProducts(
      {
        ...query,
        limit: initialCatalogLimit,
        offset: 0,
        sort: "stock_desc",
      },
      {
        includeBuyerPrices: showWholesalePrice,
      }
    ),
    listCatalogModelGroups(),
  ]);

  return (
    <Suspense fallback={null}>
      <CatalogPage
        filteredTotal={catalogPage.data.total}
        initialModelGroups={modelGroups.data}
        initialProducts={catalogPage.data.products.map((product) =>
          toCatalogCardProduct(product, showWholesalePrice)
        )}
        showWholesalePrice={showWholesalePrice}
      />
    </Suspense>
  );
}

function readCatalogQuery(params: Awaited<CatalogPageSearchParams>) {
  return {
    brand: readSingleParam(params.brand),
    minStock: Number(readSingleParam(params.minStock) ?? "0") > 0 ? 1 : undefined,
    model: readSingleParam(params.model),
  };
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toCatalogCardProduct(
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
