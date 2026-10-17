import { loginUrl } from "@/lib/partspro-auth-redirect";
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
  const preserved = new URLSearchParams();
  for (const key of ["section", "orderId", "setup", "returnTo", "page", "q"]) { const value = readSingleParam(params[key]); if (value) preserved.set(key, value.slice(0, 2000)); }
  const authNext = "/account" + (preserved.size ? `?${preserved}` : "");
  const configured = isSupabaseConfigured();

  if (!configured) {
    redirect(loginUrl(authNext, "config"));
  }

  const account = await getCurrentAccountContext({ ensure: true });
  if (!account.authenticated) {
    redirect(loginUrl(authNext));
  }
  const requestedSection = readSingleParam(params.section);
  const loadedSection = readSingleParam(params.orderId) ? "orders"
    : requestedSection === "wallet" || requestedSection === "orders" || requestedSection === "service"
      ? requestedSection : "overview";
  const historyPage = Math.min(10000, Math.max(0, Number(readSingleParam(params.page)) || 0));
  const historyQuery = { offset: historyPage * 50, limit: 51, q: (readSingleParam(params.q) ?? "").slice(0,80) };
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
        needsOrders ? listCurrentCustomerOrderSummaries(loadedSection === "orders" ? historyQuery : {}) : emptyList,
        needsRmas ? listCurrentCustomerRmaRequests() : emptyList,
        getCurrentCustomerProfile(),
        needsWallet ? getCurrentCustomerWallet(loadedSection === "wallet" ? historyQuery : {}) : emptyWallet,
      ])
    : shouldReadEmployeeSelfData
      ? await Promise.all([
          loadedSection === "overview" ? getCurrentEmployeeSelfCompany().then((result) => ({
            ...result,
            data: result.data ? [result.data] : [],
          })) : emptyList,
          needsOrders ? listCurrentEmployeeSelfOrderSummaries(loadedSection === "orders" ? historyQuery : {}) : emptyList,
          needsRmas ? listCurrentEmployeeSelfRmaRequests() : emptyList,
          getCurrentEmployeeSelfProfile(),
          needsWallet ? getCurrentCustomerWallet(loadedSection === "wallet" ? historyQuery : {}) : emptyWallet,
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
      profileUnavailable={Boolean(customerProfile.warning)}
      dataWarning={customerProfile.warning ?? orders.warning ?? rmas.warning ?? companies.warning ?? wallet.warning}
      forceSetup={!customerProfile.warning && !customerProfile.data?.profileCompletedAt && readSingleParam(params.setup) === "1"}
      orderSummaries={loadedSection === "orders" ? orders.data.slice(0,50) : orders.data}
      historyHasMore={loadedSection === "orders" ? orders.data.length > 50 : wallet.data.transactions.length > 50}
      rmaRequests={rmas.data}
      wallet={{ ...wallet.data, transactions: wallet.data.transactions.slice(0, 50) }}
      userEmail={account.email ?? undefined}
      initialAccountAccess={toStoreHeaderAccountAccess(account)}
    />
  );
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
