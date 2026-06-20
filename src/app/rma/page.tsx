import { redirect } from "next/navigation";
import { RmaPage } from "@/components/partspro/rma-page";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";

export const dynamic = "force-dynamic";

type RmaPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function Page({
  searchParams,
}: {
  searchParams: RmaPageSearchParams;
}) {
  const params = await searchParams;
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated) {
    redirect("/login?next=/rma");
  }

  return (
    <RmaPage
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      initialOrderId={readSingleParam(params.order)}
    />
  );
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
