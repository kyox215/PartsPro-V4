import { Suspense } from "react";
import { CatalogPage } from "@/components/partspro/catalog-page";
import {
  getCustomerProfileById,
  listCatalogModelGroups,
  pageCatalogProducts,
} from "@/lib/partspro-repository";
import type { PartProduct } from "@/lib/partspro-data";
import {
  applyAccountPriceToProduct,
  canDelegateCheckout,
  getCurrentAccountContext,
  priceVisibilityReason,
  type AccountContext,
} from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { readAssistedCompanyIdFromRecord } from "@/lib/partspro-assisted-order";

const initialCatalogLimit = 24;
export const dynamic = "force-dynamic";

type CatalogPageSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function Page({
  searchParams,
}: {
  searchParams: CatalogPageSearchParams;
}) {
  const resolvedSearchParams = await searchParams;
  const query = readCatalogQuery(resolvedSearchParams);
  const accountPromise = getCurrentAccountContext({ ensure: true });
  const modelGroupsPromise = listCatalogModelGroups();
  const account = await accountPromise;
  const requestedCompanyId = readAssistedCompanyIdFromRecord(resolvedSearchParams);
  const assistedCompanyId =
    requestedCompanyId && canDelegateCheckout(account) ? requestedCompanyId : null;
  const [catalogPage, modelGroups, assistedCustomer] = await Promise.all([
    pageCatalogProducts(
      {
        ...query,
        limit: initialCatalogLimit,
        offset: 0,
        sort: "stock_desc",
      },
      {
        buyerCustomerId: assistedCompanyId ?? undefined,
        includeBuyerPrices: account.canViewPrices || Boolean(assistedCompanyId),
      }
    ),
    modelGroupsPromise,
    assistedCompanyId
      ? getCustomerProfileById(assistedCompanyId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const assistedProfile = assistedCustomer?.data ?? null;

  return (
    <Suspense fallback={null}>
      <CatalogPage
        assistedCompanyId={assistedCompanyId}
        assistedCompanyName={assistedProfile?.companyName ?? null}
        filteredTotal={catalogPage.data.total}
        initialAccountAccess={toStoreHeaderAccountAccess(account)}
        initialModelGroups={modelGroups.data}
        initialProducts={catalogPage.data.products.map((product) =>
          toCatalogCardProduct(product, account)
        )}
        priceGateReason={priceVisibilityReason(account)}
        showWholesalePrice={account.canViewPrices}
      />
    </Suspense>
  );
}

function readCatalogQuery(params: Awaited<CatalogPageSearchParams>) {
  return {
    brand: readSingleParam(params.brand),
    category: readSingleParam(params.category),
    minStock: Number(readSingleParam(params.minStock) ?? "0") > 0 ? 1 : undefined,
    model: readSingleParam(params.model),
    modelSeries: readSingleParam(params.modelSeries),
    q: readSingleParam(params.q),
  };
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toCatalogCardProduct(
  product: PartProduct,
  account: AccountContext
): PartProduct {
  return applyAccountPriceToProduct(product, account);
}
