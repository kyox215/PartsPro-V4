import { NextResponse } from "next/server";
import { readAdminRemaxDashboard } from "@/lib/partspro-remax-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;

  try {
    return NextResponse.json({ data: await readAdminRemaxDashboard() });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_REMAX_DASHBOARD_FAILED",
      "REMAX preorder dashboard could not be loaded."
    );
  }
}
