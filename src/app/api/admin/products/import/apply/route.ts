import { NextResponse } from "next/server";
import { apiError } from "@/lib/partspro-api";
import { ProductImportError } from "@/lib/partspro-product-import";
import {
  applyAdminProductImport,
  previewAdminProductImport,
} from "@/lib/partspro-product-import-service";
import { repositoryErrorResponse, requireAdminApi } from "../../../_shared";
import { readProductImportForm } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await requireAdminApi("product.read_admin");
  if (!admin.ok) return admin.response;

  try {
    const { file, form } = await readProductImportForm(request);
    const requestedPreviewHash = form.get("previewHash");
    const confirmed = form.get("confirmed");
    if (typeof requestedPreviewHash !== "string" || confirmed !== "true") {
      return apiError(400, "PRODUCT_IMPORT_CONFIRMATION_REQUIRED", "请先预览并确认本次商品导入。");
    }

    const preview = await previewAdminProductImport(file, admin.authState);
    if (preview.previewHash !== requestedPreviewHash) {
      return apiError(409, "PRODUCT_IMPORT_PREVIEW_STALE", "文件、商品资料或权限已经变化，请重新生成预览。", {
        currentPreviewHash: preview.previewHash,
      });
    }
    if (preview.counts.blocked > 0) {
      return apiError(422, "PRODUCT_IMPORT_BLOCKED", "请先修正所有阻断行。", {
        blocked: preview.counts.blocked,
      });
    }

    const result = await applyAdminProductImport(preview);
    return NextResponse.json(
      { data: result },
      { status: result.failures.length > 0 ? 207 : 200 }
    );
  } catch (error) {
    if (error instanceof ProductImportError) {
      return apiError(400, "INVALID_PRODUCT_IMPORT", error.message, error.details);
    }
    return repositoryErrorResponse(error, "PRODUCT_IMPORT_APPLY_FAILED", "商品导入暂时无法执行。");
  }
}
