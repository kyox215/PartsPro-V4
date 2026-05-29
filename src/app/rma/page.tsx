import { redirect } from "next/navigation";
import { RmaPage } from "@/components/partspro/rma-page";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";

export const dynamic = "force-dynamic";

export default async function Page() {
  const account = await getCurrentAccountContext({ ensure: true });

  if (!account.authenticated) {
    redirect("/login?next=/rma");
  }

  return <RmaPage initialAccountAccess={toStoreHeaderAccountAccess(account)} />;
}
