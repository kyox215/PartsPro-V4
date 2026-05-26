import { NextRequest, NextResponse } from "next/server";
import { listAdminProductAuditEvents } from "@/lib/partspro-repository";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";

export const dynamic = "force-dynamic";

type ProductParams = { params: Promise<{ sku: string }> };

export async function GET(request: NextRequest, { params }: ProductParams) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const { sku } = await params;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);

  try {
    const result = await listAdminProductAuditEvents(decodeURIComponent(sku), limit);

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
      "ADMIN_PRODUCT_AUDIT_UNAVAILABLE",
      "Product audit events are temporarily unavailable."
    );
  }
}
