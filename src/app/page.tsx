import { HomePage } from "@/components/partspro/home-page";
import {
  getCatalogCategoryCounts,
  listCatalogModelGroups,
  pageCatalogProducts,
} from "@/lib/partspro-repository";
import { type PartProduct } from "@/lib/partspro-data";
import {
  applyAccountPriceToProduct,
  getCurrentAccountContext,
  priceVisibilityReason,
  type AccountContext,
} from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";

const featuredProductLimit = 8;

export default async function Home() {
  const [account, modelGroups, catalogSummary] = await Promise.all([
    getCurrentAccountContext({ ensure: true }),
    listCatalogModelGroups(),
    getCatalogCategoryCounts(),
  ]);
  const catalogPage = await pageCatalogProducts(
    {
      limit: featuredProductLimit,
      minStock: 1,
      offset: 0,
      sort: "stock_desc",
    },
    {
      includeBuyerPrices: account.canViewPrices,
    }
  );

  return (
    <HomePage
      catalogTotal={catalogSummary.warning ? undefined : catalogSummary.data.total}
      categoryCounts={catalogSummary.data.categoryCounts}
      featuredProducts={catalogPage.data.products.map((product) =>
        toHomeProduct(product, account)
      )}
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      modelGroups={modelGroups.data}
      priceGateReason={priceVisibilityReason(account)}
    />
  );
}

function toHomeProduct(product: PartProduct, account: AccountContext): PartProduct {
  return applyAccountPriceToProduct(product, account);
}
