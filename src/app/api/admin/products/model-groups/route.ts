import { NextResponse } from "next/server";
import { listAdminCatalogModelGroups } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const result = await listAdminCatalogModelGroups();

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
        returned: result.data.length,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_CATALOG_MODEL_GROUPS_UNAVAILABLE",
      "Admin catalog model groups are temporarily unavailable."
    );
  }
}
