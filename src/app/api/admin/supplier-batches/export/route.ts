import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildCsvContent,
  buildSupplierBatchExportRows,
  buildXlsxBuffer,
  supplierBatchContentType,
  supplierBatchFileName,
} from "@/lib/partspro-supplier-batch-files";
import {
  getAdminSupplierBatchDetail,
  listAdminSupplierBatches,
} from "@/lib/partspro-repository";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

const supplierBatchExportQuerySchema = z
  .object({
    batchCode: z.string().trim().min(1).max(80).optional(),
    dateFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateMode: z.enum(["imported", "received", "invoice"]).default("imported"),
    dateTo: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    format: z.enum(["csv", "xlsx"]).default("csv"),
    q: z.string().trim().min(1).max(120).optional(),
    scope: z.enum(["batches", "lines"]).default("batches"),
    supplier: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, supplierBatchExportQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  const { format, scope, ...filters } = query.data;

  try {
    const list = await listAdminSupplierBatches({
      ...filters,
      limit: 500,
      offset: 0,
    });
    const batches = list.data.batches;
    const details =
      scope === "lines"
        ? (
            await Promise.all(
              batches.map((batch) => getAdminSupplierBatchDetail(batch.batchCode))
            )
          )
            .map((result) => result.data)
            .filter((detail) => detail !== null)
        : [];
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
