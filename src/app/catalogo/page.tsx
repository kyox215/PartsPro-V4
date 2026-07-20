import { Suspense } from "react";
import { CatalogPage } from "@/components/partspro/catalog-page";
import {
  getCustomerProfileById,
  listCatalogDepartmentGroups,
  pageCatalogProducts,
} from "@/lib/partspro-repository";
import {
  catalogDepartments,
  type CatalogDepartment,
  type PartProduct,
} from "@/lib/partspro-data";
import {
  accountPricingCustomerId,
  applyAccountPriceToProduct,
  canDelegateCheckout,
  getCurrentAccountContext,
  priceVisibilityReason,
  storefrontCartAccess,
  type AccountContext,
} from "@/lib/partspro-account-context";
import { toStoreHeaderAccountAccess } from "@/lib/partspro-header-access";
import { readAssistedCompanyIdFromRecord } from "@/lib/partspro-assisted-order";
import { mergePreorderAvailability } from "@/lib/partspro-preorder-server";

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
  const accountPromise = getCurrentAccountContext();
  const departmentGroupsPromise = listCatalogDepartmentGroups();
  const account = await accountPromise;
  const requestedCompanyId = readAssistedCompanyIdFromRecord(resolvedSearchParams);
  const assistedCompanyId =
    requestedCompanyId && canDelegateCheckout(account) ? requestedCompanyId : null;
  const buyerCustomerId = assistedCompanyId ?? accountPricingCustomerId(account);
  const [catalogPage, departmentGroups, assistedCustomer] = await Promise.all([
    pageCatalogProducts(
      {
        ...query,
        limit: initialCatalogLimit,
        offset: 0,
        sort: "stock_desc",
      },
      {
        buyerCustomerId,
        includeBuyerPrices: account.canViewPrices || Boolean(assistedCompanyId),
      }
    ),
    departmentGroupsPromise,
    assistedCompanyId
      ? getCustomerProfileById(assistedCompanyId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const assistedProfile = assistedCustomer?.data ?? null;
  const productsWithPreorders = await mergePreorderAvailability(
    catalogPage.data.products
  );

  return (
    <Suspense fallback={null}>
      <CatalogPage
        assistedCompanyId={assistedCompanyId}
        assistedCompanyName={assistedProfile?.companyName ?? null}
        filteredTotal={catalogPage.data.total}
        initialAccountAccess={toStoreHeaderAccountAccess(account)}
        initialDepartmentGroups={departmentGroups.data}
        initialProducts={productsWithPreorders.map((product) =>
          toCatalogCardProduct(product, account)
        )}
        cartAccess={storefrontCartAccess(account, assistedCompanyId)}
        priceGateReason={priceVisibilityReason(account)}
        showWholesalePrice={account.canViewPrices}
      />
    </Suspense>
  );
}

function readCatalogQuery(params: Awaited<CatalogPageSearchParams>) {
  const minStockParam = readSingleParam(params.minStock);

  return {
    brand: readSingleParam(params.brand),
    category: readSingleParam(params.category),
    department: readCatalogDepartment(params.department),
    minStock: Number(minStockParam ?? "0") > 0 ? 1 : undefined,
    model: readSingleParam(params.model),
    modelSeries: readSingleParam(params.modelSeries),
    q: readSingleParam(params.q),
  };
}

function readCatalogDepartment(value: string | string[] | undefined) {
  const department = readSingleParam(value);

  return catalogDepartments.includes(department as CatalogDepartment)
    ? (department as CatalogDepartment)
    : undefined;
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
