import { StorefrontLoading } from "@/components/partspro/storefront-loading";
import { Suspense } from "react";
import { CartPage } from "@/components/partspro/cart-page";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";

export const dynamic = "force-dynamic";

export default async function Page() {
  const account = await getCurrentAccountContext();

  return (
    <Suspense fallback={<StorefrontLoading variant="cart"/>}>
      <CartPage initialAccountAccess={toStoreHeaderAccountAccess(account)} />
    </Suspense>
  );
}
