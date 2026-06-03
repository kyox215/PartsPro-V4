import { HomePage } from "@/components/partspro/home-page";
import {
  getCatalogCategoryCounts,
  listCatalogModelGroups,
  pageHotCatalogProducts,
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

const homeShelfProductLimit = 8;

export default async function Home() {
  const [account, modelGroups, catalogSummary] = await Promise.all([
    getCurrentAccountContext({ ensure: true }),
    listCatalogModelGroups(),
    getCatalogCategoryCounts(),
  ]);
  const productPageOptions = {
    includeBuyerPrices: account.canViewPrices,
  };
  const [hotProductsPage, newProductsPage, stockedProductsPage] = await Promise.all([
    pageHotCatalogProducts(
      {
        limit: homeShelfProductLimit,
      },
      productPageOptions
    ),
    pageCatalogProducts(
      {
        limit: homeShelfProductLimit,
        offset: 0,
        sort: "created_desc",
      },
      productPageOptions
    ),
    pageCatalogProducts(
      {
        limit: homeShelfProductLimit,
        minStock: 1,
        offset: 0,
        sort: "stock_desc",
      },
      productPageOptions
    ),
  ]);
  const stockedProducts = stockedProductsPage.data.products.map((product) =>
    toHomeProduct(product, account)
  );
  const hotProducts =
    hotProductsPage.data.products.length > 0
      ? hotProductsPage.data.products.map((product) => toHomeProduct(product, account))
      : stockedProducts;

  return (
    <HomePage
      catalogTotal={catalogSummary.warning ? undefined : catalogSummary.data.total}
      categoryCounts={catalogSummary.data.categoryCounts}
      hotProducts={hotProducts}
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      modelGroups={modelGroups.data}
      newProducts={newProductsPage.data.products.map((product) =>
        toHomeProduct(product, account)
      )}
      priceGateReason={priceVisibilityReason(account)}
      showPrices={account.canViewPrices}
      stockedProducts={stockedProducts}
    />
  );
}

function toHomeProduct(product: PartProduct, account: AccountContext): PartProduct {
  return applyAccountPriceToProduct(product, account);
}
