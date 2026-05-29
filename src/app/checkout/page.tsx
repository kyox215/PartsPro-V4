import { CheckoutPage } from "@/components/partspro/checkout-page";
import { readAssistedCompanyIdFromRecord } from "@/lib/partspro-assisted-order";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <CheckoutPage
      requestedCompanyId={readAssistedCompanyIdFromRecord(resolvedSearchParams)}
    />
  );
}
