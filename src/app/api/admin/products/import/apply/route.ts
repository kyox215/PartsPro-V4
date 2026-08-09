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

    const requiredReviews = preview.rows.filter((row) => row.compatibilityReview.required);
    if (requiredReviews.length > 0) {
      const rawConfirmations = form.get("compatibilityReviewConfirmations");
      const confirmationEntries = parseCompatibilityReviewConfirmations(rawConfirmations);
      const requiredByRow = new Map(
        requiredReviews.map((row) => [row.rowNumber, row.compatibilityReview.fingerprint] as const)
      );
      const receivedByRow = new Map<number, string>();
      const duplicateRows: number[] = [];
      const malformedEntries: unknown[] = [];

      for (const entry of confirmationEntries) {
        if (!isCompatibilityReviewConfirmation(entry)) {
          malformedEntries.push(entry);
          continue;
        }
        if (receivedByRow.has(entry.rowNumber)) duplicateRows.push(entry.rowNumber);
        receivedByRow.set(entry.rowNumber, entry.fingerprint);
      }

      const missingRows = requiredReviews
        .filter((row) => !receivedByRow.has(row.rowNumber))
        .map((row) => row.rowNumber);
      const reviews = requiredReviews.flatMap((row) => {
        const receivedFingerprint = receivedByRow.get(row.rowNumber);
        return receivedFingerprint && receivedFingerprint === row.compatibilityReview.fingerprint
          ? []
          : [{
              expectedFingerprint: row.compatibilityReview.fingerprint,
              fingerprint: receivedFingerprint ?? null,
              receivedFingerprint: receivedFingerprint ?? null,
              rowNumber: row.rowNumber,
              sku: row.sku,
            }];
      });
      const unexpectedRows = [...receivedByRow.keys()].filter((rowNumber) => !requiredByRow.has(rowNumber));

      if (
        missingRows.length > 0 ||
        reviews.length > 0 ||
        duplicateRows.length > 0 ||
        unexpectedRows.length > 0 ||
        malformedEntries.length > 0
      ) {
        return apiError(
          422,
          "PRODUCT_IMPORT_COMPATIBILITY_REVIEW_REQUIRED",
          "请先逐行人工检查并确认所有兼容性候选提示。",
          {
            malformedEntries,
            missingRows,
            reviews,
            duplicateRows,
            unexpectedRows,
          }
        );
      }
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

function parseCompatibilityReviewConfirmations(value: FormDataEntryValue | null): unknown[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isCompatibilityReviewConfirmation(value: unknown): value is {
  fingerprint: string;
  rowNumber: number;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.fingerprint === "string" &&
    candidate.fingerprint.length > 0 &&
    typeof candidate.rowNumber === "number" &&
    Number.isSafeInteger(candidate.rowNumber)
  );
}
