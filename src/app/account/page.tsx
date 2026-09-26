import { AccountPage } from "@/components/partspro/account-page";
import { getCurrentAccountContext } from "@/lib/partspro-account-context";
import {
  getCurrentCustomerProfile,
  getCurrentCustomerWallet,
  getCurrentEmployeeSelfCompany,
  getCurrentEmployeeSelfProfile,
  listCurrentCustomerCompanies,
  listCurrentCustomerOrderSummaries,
  listCurrentCustomerRmaRequests,
  listCurrentEmployeeSelfOrderSummaries,
  listCurrentEmployeeSelfRmaRequests,
} from "@/lib/partspro-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";
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

  const account = await getCurrentAccountContext({ ensure: true });
  if (!account.authenticated) {
    redirect("/login?next=/account");
  }
  const requestedSection = readSingleParam(params.section);
  const loadedSection = readSingleParam(params.orderId) ? "orders"
    : requestedSection === "wallet" || requestedSection === "orders" || requestedSection === "service"
      ? requestedSection : "overview";
  const needsOrders = loadedSection !== "wallet";
  const needsRmas = loadedSection === "overview" || loadedSection === "service";
  const needsWallet = loadedSection === "overview" || loadedSection === "wallet";
  const emptyList = { data: [], warning: undefined };
  const emptyWallet = { data: { balance: 0, currency: "EUR" as const, transactions: [] }, warning: undefined };
  const shouldReadCustomerData = account.accountType === "customer";
  const shouldReadEmployeeSelfData = account.accountType === "employee";
  const [companies, orders, rmas, customerProfile, wallet] = shouldReadCustomerData
    ? await Promise.all([
        loadedSection === "overview" ? listCurrentCustomerCompanies() : emptyList,
        needsOrders ? listCurrentCustomerOrderSummaries() : emptyList,
        needsRmas ? listCurrentCustomerRmaRequests() : emptyList,
        getCurrentCustomerProfile(),
        needsWallet ? getCurrentCustomerWallet() : emptyWallet,
      ])
    : shouldReadEmployeeSelfData
      ? await Promise.all([
          loadedSection === "overview" ? getCurrentEmployeeSelfCompany().then((result) => ({
            ...result,
            data: result.data ? [result.data] : [],
          })) : emptyList,
          needsOrders ? listCurrentEmployeeSelfOrderSummaries() : emptyList,
          needsRmas ? listCurrentEmployeeSelfRmaRequests() : emptyList,
          getCurrentEmployeeSelfProfile(),
          needsWallet ? getCurrentCustomerWallet() : emptyWallet,
        ])
    : [
        { data: [], warning: undefined },
        { data: [], warning: undefined },
        { data: [], warning: undefined },
        { data: null, warning: undefined },
        { data: { balance: 0, currency: "EUR" as const, transactions: [] }, warning: undefined },
      ];
  const company =
    shouldReadCustomerData && account.customer?.id
      ? companies.data.find((item) => item.id === account.customer?.id) ?? null
      : shouldReadEmployeeSelfData
        ? companies.data[0] ?? null
      : null;

  return (
    <AccountPage
      loadedSection={loadedSection}
      company={company}
      accountType={account.accountType}
      customerProfile={customerProfile.data}
      dataWarning={orders.warning ?? rmas.warning ?? companies.warning ?? wallet.warning}
      forceSetup={readSingleParam(params.setup) === "1"}
      orderSummaries={orders.data}
      rmaRequests={rmas.data}
      wallet={wallet.data}
      userEmail={account.email ?? undefined}
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
    />
  );
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
