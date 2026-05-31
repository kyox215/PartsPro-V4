import { AccountPage } from "@/components/partspro/account-page";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  getCurrentCustomerProfile,
  getCurrentEmployeeSelfProfile,
  listCurrentCustomerCompanies,
  listCurrentCustomerOrderSummaries,
  listCurrentCustomerRmaRequests,
} from "@/lib/partspro-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AccountPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function Page({
  searchParams,
}: {
  searchParams: AccountPageSearchParams;
}) {
  const params = await searchParams;
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
  const shouldReadEmployeeSelfData = account.accountType === "employee";
  const [companies, orders, rmas, customerProfile] = shouldReadCustomerData
    ? await Promise.all([
        listCurrentCustomerCompanies(),
        listCurrentCustomerOrderSummaries(),
        listCurrentCustomerRmaRequests(),
        getCurrentCustomerProfile(),
      ])
    : shouldReadEmployeeSelfData
      ? await Promise.all([
          { data: [], warning: undefined },
          { data: [], warning: undefined },
          { data: [], warning: undefined },
          getCurrentEmployeeSelfProfile(),
        ])
    : [
        { data: [], warning: undefined },
        { data: [], warning: undefined },
        { data: [], warning: undefined },
        { data: null, warning: undefined },
      ];
  const company =
    account.customer?.id
      ? companies.data.find((item) => item.id === account.customer?.id) ?? null
      : null;

  return (
    <AccountPage
      company={company}
      accountType={account.accountType}
      customerProfile={customerProfile.data}
      dataWarning={orders.warning ?? rmas.warning ?? companies.warning}
      forceSetup={readSingleParam(params.setup) === "1"}
      orderSummaries={orders.data}
      rmaRequests={rmas.data}
      userEmail={account.email ?? user.email ?? undefined}
    />
  );
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
