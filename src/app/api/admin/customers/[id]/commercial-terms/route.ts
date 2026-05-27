import { basicCustomerManagementDisabledResponse, requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function PATCH() {
  const admin = await requireAdminApi("customers.manage_terms");

  if (!admin.ok) {
    return admin.response;
  }

  return basicCustomerManagementDisabledResponse("customer_commercial_terms");
}
