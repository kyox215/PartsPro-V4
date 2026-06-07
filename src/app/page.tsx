import { HomePage } from "@/components/partspro/home-page";
import {
  listActiveHomeBanners,
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
const publicHomeShelfCacheTtlMs = 30 * 1000;

type HomeShelfProducts = {
  catalogTotal: number;
  hotProducts: PartProduct[];
  newProducts: PartProduct[];
  stockedProducts: PartProduct[];
};

let publicHomeShelfCache:
  | {
      expiresAt: number;
      products: HomeShelfProducts;
    }
  | null = null;
let publicHomeShelfRequest: Promise<HomeShelfProducts> | null = null;

export default async function Home() {
  const [account, modelGroups, homeBanners] = await Promise.all([
    getCurrentAccountContext({ ensure: true }),
    listCatalogModelGroups(),
    listActiveHomeBanners(),
  ]);
  const homeShelves = account.canViewPrices
    ? await readHomeShelfProducts({ includeBuyerPrices: true })
    : await readCachedPublicHomeShelfProducts();
  const stockedProducts = homeShelves.stockedProducts.map((product) =>
    toHomeProduct(product, account)
  );
  const hotProducts =
    homeShelves.hotProducts.length > 0
      ? homeShelves.hotProducts.map((product) => toHomeProduct(product, account))
      : stockedProducts;

  return (
    <HomePage
      catalogTotal={homeShelves.catalogTotal}
      homeBanners={homeBanners.data}
      hotProducts={hotProducts}
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      modelGroups={modelGroups.data}
      newProducts={homeShelves.newProducts.map((product) =>
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

async function readCachedPublicHomeShelfProducts() {
  const now = Date.now();

  if (publicHomeShelfCache && publicHomeShelfCache.expiresAt > now) {
    return publicHomeShelfCache.products;
  }

  if (publicHomeShelfRequest) {
    return publicHomeShelfRequest;
  }

  publicHomeShelfRequest = readHomeShelfProducts({ includeBuyerPrices: false })
    .then((products) => {
      publicHomeShelfCache = {
        expiresAt: Date.now() + publicHomeShelfCacheTtlMs,
        products,
      };
      publicHomeShelfRequest = null;

      return products;
    })
    .catch((error) => {
      publicHomeShelfRequest = null;
      throw error;
    });

  return publicHomeShelfRequest;
}

async function readHomeShelfProducts(options: { includeBuyerPrices: boolean }) {
  const [hotProductsPage, newProductsPage, stockedProductsPage] = await Promise.all([
    pageHotCatalogProducts(
      {
        limit: homeShelfProductLimit,
      },
      options
    ),
    pageCatalogProducts(
      {
        limit: homeShelfProductLimit,
        offset: 0,
        sort: "created_desc",
      },
      options
    ),
    pageCatalogProducts(
      {
        limit: homeShelfProductLimit,
        minStock: 1,
        offset: 0,
        sort: "stock_desc",
      },
      options
    ),
  ]);

  return {
    catalogTotal: newProductsPage.data.total,
    hotProducts: hotProductsPage.data.products,
    newProducts: newProductsPage.data.products,
    stockedProducts: stockedProductsPage.data.products,
  };
}
