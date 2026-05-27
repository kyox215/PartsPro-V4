import { AccountPage } from "@/components/partspro/account-page";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  listCompanies,
  listOrderSummaries,
  listRmaRequests,
} from "@/lib/partspro-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Page() {
  const configured = isSupabaseConfigured();

  if (!configured) {
    redirect("/login?next=/account&error=config");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const account = await getCurrentAccountContext({ ensure: true });
  const shouldReadCustomerData = account.accountType === "customer";
  const [companies, orders, rmas] = shouldReadCustomerData
    ? await Promise.all([
        listCompanies(),
        listOrderSummaries(),
        listRmaRequests(),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
      ];
  const company =
    account.customer?.id
      ? companies.data.find((item) => item.id === account.customer?.id) ?? null
      : null;

  return (
    <AccountPage
      company={company}
      orderSummaries={orders.data}
      rmaRequests={rmas.data}
      userEmail={account.email ?? user.email ?? undefined}
    />
  );
}
