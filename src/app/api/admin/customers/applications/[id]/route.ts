import { basicCustomerManagementDisabledResponse, requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

export async function PATCH() {
  const admin = await requireAdminApi("customers.classify");

  if (!admin.ok) {
    return admin.response;
  }

  return basicCustomerManagementDisabledResponse("legacy_customer_application_review");
}
