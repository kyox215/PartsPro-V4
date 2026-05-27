import { basicCustomerManagementDisabledResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function PATCH() {
  const admin = await requireAdminApi("customers.classify");

  if (!admin.ok) {
    return admin.response;
  }

  return basicCustomerManagementDisabledResponse("admin_b2b_application_review");
}
