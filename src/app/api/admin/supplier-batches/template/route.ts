import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildCsvContent,
  buildSupplierBatchTemplateRows,
  buildXlsxBuffer,
  supplierBatchContentType,
  supplierBatchFileName,
} from "@/lib/partspro-supplier-batch-files";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../../_shared";

export const dynamic = "force-dynamic";

const supplierBatchTemplateQuerySchema = z
  .object({
    format: z.enum(["csv", "xlsx"]).default("csv"),
  })
  .strict();

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("product.read_admin");

  if (!admin.ok) {
    return admin.response;
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, supplierBatchTemplateQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const template = buildSupplierBatchTemplateRows(false);
    const body =
      query.data.format === "xlsx"
        ? await buildXlsxBuffer(template)
        : buildCsvContent(template.columns, template.rows);
    const filename = supplierBatchFileName({
      format: query.data.format,
      scope: "template",
    });

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": supplierBatchContentType(query.data.format),
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_SUPPLIER_BATCH_TEMPLATE_FAILED",
      "Supplier batch import template could not be generated."
    );
  }
}
