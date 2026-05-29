import { ProfessionalApplicationPage } from "@/components/partspro/professional-application-page";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";

export const dynamic = "force-dynamic";

export default async function Page() {
  const account = await getCurrentAccountContext({ ensure: true });

  return (
    <ProfessionalApplicationPage
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
    />
  );
}
