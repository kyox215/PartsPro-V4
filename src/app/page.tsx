import { HomePage } from "@/components/partspro/home-page";
import {
  getCatalogCategoryCounts,
  listCatalogModelGroups,
  pageCatalogProducts,
} from "@/lib/partspro-repository";
import { type PartProduct } from "@/lib/partspro-data";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";

const featuredProductLimit = 8;

export default async function Home() {
  const [account, modelGroups, catalogPage, catalogSummary] = await Promise.all([
    getCurrentAccountContext(),
    listCatalogModelGroups(),
    pageCatalogProducts({
      limit: featuredProductLimit,
      minStock: 1,
      offset: 0,
      sort: "stock_desc",
    }),
    getCatalogCategoryCounts(),
  ]);

  return (
    <HomePage
      catalogTotal={catalogSummary.warning ? undefined : catalogSummary.data.total}
      categoryCounts={catalogSummary.data.categoryCounts}
      featuredProducts={catalogPage.data.products.map(toHomeProduct)}
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      modelGroups={modelGroups.data}
    />
  );
}

function toHomeProduct(product: PartProduct): PartProduct {
  return {
    ...product,
    price: 0,
    retailPrice: 0,
  };
}
