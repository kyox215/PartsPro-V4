import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { ProductImportError } from "@/lib/partspro-product-import";
import { previewAdminProductImport } from "@/lib/partspro-product-import-service";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { readProductImportForm } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;

  try {
    const { file } = await readProductImportForm(request);
    return NextResponse.json({ data: await previewAdminProductImport(file, admin.authState) });
  } catch (error) {
    if (error instanceof ProductImportError) {
      return apiError(400, "INVALID_PRODUCT_IMPORT", error.message, error.details);
    }
    return repositoryErrorResponse(error, "PRODUCT_IMPORT_PREVIEW_FAILED", "商品导入预览暂时无法生成。");
  }
}
