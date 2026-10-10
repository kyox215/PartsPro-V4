import { loginUrl } from "@/lib/partspro-auth-redirect";
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
  const preserved = new URLSearchParams();
  for (const key of ["order", "line", "requestId"]) { const value = readSingleParam(params[key]); if (value) preserved.set(key, value.slice(0, 2000)); }
  const authNext = "/rma" + (preserved.size ? `?${preserved}` : "");
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated) {
    redirect(loginUrl(authNext));
  }

  return (
    <RmaPage
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
      initialOrderId={readSingleParam(params.order)}
      initialOrderLineId={readSingleParam(params.line)}
      initialRequestId={readSingleParam(params.requestId)}
    />
  );
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
