import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import {
  buildProductImportPreviewBuffer,
  ProductImportError,
} from "@/lib/partspro-product-import";
import { previewAdminProductImport } from "@/lib/partspro-product-import-service";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { productImportDownloadName, readProductImportForm } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;

  try {
    const { file } = await readProductImportForm(request);
    const preview = await previewAdminProductImport(file, admin.authState);
    const body = await buildProductImportPreviewBuffer(preview);
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${productImportDownloadName("partspro-product-import-preview")}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    if (error instanceof ProductImportError) {
      return apiError(400, "INVALID_PRODUCT_IMPORT", error.message, error.details);
    }
    return repositoryErrorResponse(error, "PRODUCT_IMPORT_PREVIEW_EXPORT_FAILED", "商品导入预览文件暂时无法生成。");
  }
}
