import { HomePage } from "@/components/partspro/home-page";
import {
  listCatalogModelGroups,
  pageCatalogProducts,
} from "@/lib/partspro-repository";
import { categories, type PartProduct } from "@/lib/partspro-data";

const featuredProductLimit = 8;

export default async function Home() {
  const [modelGroups, catalogPage, catalogTotalPage, categoryPages] =
    await Promise.all([
      listCatalogModelGroups(),
      pageCatalogProducts({
        limit: featuredProductLimit,
        minStock: 1,
        offset: 0,
        sort: "stock_desc",
      }),
      pageCatalogProducts({
        limit: 1,
        offset: 0,
        sort: "stock_desc",
      }),
      Promise.all(
        categories.map((category) =>
          pageCatalogProducts({
            category: category.value,
            limit: 1,
            offset: 0,
            sort: "stock_desc",
          })
        )
      ),
    ]);
  const categoryCounts = Object.fromEntries(
    categories.map((category, index) => [
      category.value,
      categoryPages[index]?.data.total ?? 0,
    ])
  );

  return (
    <HomePage
      catalogTotal={catalogTotalPage.data.total}
      categoryCounts={categoryCounts}
      featuredProducts={catalogPage.data.products.map(toHomeProduct)}
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
