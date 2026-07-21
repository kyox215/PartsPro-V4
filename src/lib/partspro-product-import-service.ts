import "server-only";

import type { AdminAuthState } from "@/lib/partspro-admin-auth";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import {
  buildProductImportPreview,
  parseProductImportFile,
  type ProductImportPreview,
} from "@/lib/partspro-product-import";
import {
  createAdminProduct,
  getAdminProductsBySkus,
  updateAdminProduct,
  type AdminProduct,
} from "@/lib/partspro-repository";

export async function previewAdminProductImport(
  file: File,
  authState: AdminAuthState
) {
  const source = await parseProductImportFile(file);
  const requestedSkus = source.rows.map((row) => row.raw.sku).filter(Boolean);
  const existing = await getAdminProductsBySkus(requestedSkus);
  return buildProductImportPreview(
    source,
    existing.data,
    (permission) => hasAdminPermission(authState, permission)
  );
}

export async function applyAdminProductImport(preview: ProductImportPreview) {
  const applied: Array<{
    operation: "create" | "update";
    rowNumber: number;
    sku: string;
  }> = [];
  const failures: Array<{ message: string; rowNumber: number; sku: string }> = [];

  for (const row of preview.rows) {
    if (row.operation === "skip") continue;

    try {
      let product: AdminProduct;
      if (row.operation === "create" && row.createInput) {
        product = (await createAdminProduct(row.createInput)).data;
      } else if (row.operation === "update" && row.patchInput) {
        product = (await updateAdminProduct(row.sku, row.patchInput)).data;
      } else {
        throw new Error("导入行缺少可执行的商品资料。");
      }

      applied.push({
        operation: row.operation,
        rowNumber: row.rowNumber,
        sku: product.sku,
      });
    } catch (error) {
      failures.push({
        message: error instanceof Error ? error.message : "商品导入失败。",
        rowNumber: row.rowNumber,
        sku: row.sku,
      });
      break;
    }
  }

  return {
    applied,
    counts: {
      applied: applied.length,
      failed: failures.length,
      skipped: preview.counts.skipped,
      total: preview.counts.total,
    },
    failures,
    partial: failures.length > 0 && applied.length > 0,
    previewHash: preview.previewHash,
    sourceHash: preview.sourceHash,
  };
}
