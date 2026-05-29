import { Suspense } from "react";
import { CartPage } from "@/components/partspro/cart-page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CartPage />
    </Suspense>
  );
}
