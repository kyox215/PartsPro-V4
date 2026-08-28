import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/partspro-api";
import {
  buildCsvContent,
  buildSupplierBatchExportRows,
  buildXlsxBuffer,
  supplierBatchContentType,
  supplierBatchFileName,
} from "@/lib/partspro-supplier-batch-files";
import {
  getAdminSupplierBatchExportData,
} from "@/lib/partspro-repository";
import {
  hasSupplierBatchCostPermission,
  hasSupplierBatchHistoryPermission,
  hasSupplierBatchReadPermission,
  parseAdminQuery,
  repositoryErrorResponse,
  requireAdminApi,
} from "../../_shared";

export const dynamic = "force-dynamic";

const supplierBatchExportQuerySchema = z
  .object({
    batchCode: z.string().trim().min(1).max(80).optional(),
    dateFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateMode: z.enum(["imported", "received", "invoice"]).default("imported"),
    dateTo: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    format: z.enum(["csv", "xlsx"]).default("csv"),
    q: z.string().trim().min(1).max(120).optional(),
    scope: z.enum(["batches", "lines", "charges"]).default("batches"),
    supplier: z.string().trim().min(1).max(120).optional(),
    currency: z.enum(["EUR", "USD", "CNY"]).optional(),
    costStatus: z.enum(["unrecorded", "estimated", "confirmed_zero", "confirmed", "needs_review"]).optional(),
    chargeType: z.enum(["transport", "insurance", "customs", "handling", "other"]).optional(),
    vatTreatment: z.enum(["recoverable", "non_recoverable", "unknown"]).optional(),
    hasTransport: z.enum(["with", "without"]).optional(),
    hasTransportCost: z.enum(["with", "without"]).optional(),
    sort: z.enum(["updated_desc", "received_desc", "amount_desc", "supplier"]).default("updated_desc"),
  })
  .strict();

export async function GET(request: NextRequest) {
  const query = parseAdminQuery(request.nextUrl.searchParams, supplierBatchExportQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  const { format, scope, ...filters } = query.data;

  const admin = await requireAdminApi();

  if (!admin.ok) {
    return admin.response;
  }

  if (!hasSupplierBatchReadPermission(admin.authState)) {
    return apiError(
      403,
      "ADMIN_PERMISSION_DENIED",
      "A supplier batch read permission is required."
    );
  }

  // Every export scope carries financial or inventory facts.  Keep the
  // dedicated export capability as the single gate; read/product permissions
  // alone must never permit a file download.
  if (!hasSupplierBatchCostPermission(admin.authState, "export")) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Supplier batch export permission is required.");
  }

  // Charge exports include allocations and the canonical history stream.  A
  // product reader with export alone must not reach a path that hydrates the
  // history RPC and then fails downstream with a less useful 403.
  if (scope === "charges" && !hasSupplierBatchHistoryPermission(admin.authState)) {
    return apiError(
      403,
      "ADMIN_PERMISSION_DENIED",
      "Supplier batch cost read permission is required for charge exports."
    );
  }

  try {
    const exportData = await getAdminSupplierBatchExportData({
      ...filters,
      exportScope: scope,
      // The repository probes hard-limit + 1 before hydrating details and
      // returns a stable 413 when the filtered scope is too large.
      limit: 5001,
      offset: 0,
    });
    const batches = exportData.data.batches;
    const details = exportData.data.details;
    const exportRows = buildSupplierBatchExportRows(scope, batches, details);
    const body =
      format === "xlsx"
        ? await buildXlsxBuffer(exportRows)
        : buildCsvContent(exportRows.columns, exportRows.rows);
    const filename = supplierBatchFileName({
      format,
      scope,
      suffix: filters.batchCode,
    });

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": supplierBatchContentType(format),
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_BATCH_EXPORT_FAILED",
      "Supplier batch export could not be generated."
    );
  }
}
