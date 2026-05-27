import { CartPage } from "@/components/partspro/cart-page";
import {
  applyAccountPriceToProduct,
  getCurrentAccountContext,
} from "@/lib/partspro-account-context";
import { listCatalogProducts } from "@/lib/partspro-repository";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [account, catalog] = await Promise.all([
    getCurrentAccountContext({ ensure: true }),
    listCatalogProducts(),
  ]);
  const catalogProducts = catalog.data.map((product) =>
    applyAccountPriceToProduct(product, account)
  );

  return <CartPage catalogProducts={catalogProducts} />;
}
