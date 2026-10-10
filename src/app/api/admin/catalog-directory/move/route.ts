import { NextRequest, NextResponse } from "next/server";
import { catalogMoveSchema } from "@/lib/partspro-catalog-directory";
import { catalogDirectoryRpc } from "@/lib/partspro-catalog-directory-server";
import { parseAdminJsonBody, repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { getAdminProductsBySkus } from "@/lib/partspro-repository";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi("product.edit_content");
  if (!admin.ok) return admin.response;
  const body = await parseAdminJsonBody(request, catalogMoveSchema);
  if (!body.ok) return body.response;
  try {
    // Resolve public/legacy aliases on the server; callers cannot bypass optimistic version checks.
    const current = await getAdminProductsBySkus(body.data.products.map((p) => p.sku));
    const resolved = body.data.products.map((p) => {
      const product = current.data.find((row) => row.sku === p.sku || row.sourceSku === p.sku);
      return { ...p, sku: product?.sourceSku ?? product?.sku ?? p.sku };
    });
    const data = await catalogDirectoryRpc("admin_move_catalog_products", { p_products: resolved, p_target: body.data.target, p_reason: body.data.reason });
    return NextResponse.json({ data, meta: { moved: resolved.length } });
  } catch (error) { return repositoryErrorResponse(error, "CATALOG_MOVE_FAILED", "Products could not be moved."); }
}
