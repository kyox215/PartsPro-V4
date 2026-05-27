import {
  basicCustomerManagementDisabledResponse,
  requireAdminApi,
} from "../../../../../_shared";

export const dynamic = "force-dynamic";

export async function PATCH() {
  const admin = await requireAdminApi("employees.manage_permissions");

  if (!admin.ok) {
    return admin.response;
  }

  return basicCustomerManagementDisabledResponse("customer_member_promotion");
}
