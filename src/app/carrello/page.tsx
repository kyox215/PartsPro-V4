import { Suspense } from "react";
import { CartPage } from "@/components/partspro/cart-page";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";

export const dynamic = "force-dynamic";

export default async function Page() {
  const account = await getCurrentAccountContext({ ensure: true });

  return (
    <Suspense fallback={null}>
      <CartPage initialAccountAccess={toStoreHeaderAccountAccess(account)} />
    </Suspense>
  );
}
