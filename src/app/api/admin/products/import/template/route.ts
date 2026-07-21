import { NextResponse } from "next/server";
import { buildProductImportTemplateBuffer } from "@/lib/partspro-product-import";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { productImportDownloadName } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;

  try {
    const body = await buildProductImportTemplateBuffer();
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${productImportDownloadName("partspro-product-import-template")}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(error, "PRODUCT_IMPORT_TEMPLATE_FAILED", "商品导入模板暂时无法生成。");
  }
}
