import { basicCustomerManagementDisabledResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminApi("customers.read");

  if (!admin.ok) {
    return admin.response;
  }

  return basicCustomerManagementDisabledResponse("legacy_customer_applications");
}
