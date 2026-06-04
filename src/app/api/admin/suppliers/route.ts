import { NextResponse } from "next/server";
import { listAdminSuppliers } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  try {
    const result = await listAdminSuppliers();

    return NextResponse.json({
      data: result.data,
      meta: {
        source: result.source,
        total: result.data.length,
        returned: result.data.length,
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIERS_UNAVAILABLE",
      "Admin supplier data is temporarily unavailable."
    );
  }
}
