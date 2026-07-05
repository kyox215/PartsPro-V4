import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  auditAdminFinanceExport,
  listAdminFinanceLedger,
  type AdminFinanceLedgerRow,
} from "@/lib/partspro-repository";
import { apiError } from "@/lib/partspro-api";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { financeQuerySchema } from "../_shared";

export const dynamic = "force-dynamic";

const exportQuerySchema = financeQuerySchema.extend({
  format: z.enum(["csv", "xlsx"]).default("csv"),
});

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi("finance.export");

  if (!admin.ok) {
    return admin.response;
  }

  if (
    !hasAdminPermission(admin.authState, "finance.read") &&
    !hasAdminPermission(admin.authState, "finance.manage")
  ) {
    return apiError(403, "ADMIN_PERMISSION_DENIED", "Missing admin permission.", {
      permission: "finance.read",
      role: admin.authState.role,
    });
  }

  const query = parseAdminQuery(request.nextUrl.searchParams, exportQuerySchema);

  if (!query.ok) {
    return query.response;
  }

  try {
    const result = await listAdminFinanceLedger({
      ...query.data,
      limit: 500,
      offset: 0,
    });
    const fileBase = `partspro-finance-${new Date().toISOString().slice(0, 10)}`;

    await auditAdminFinanceExport({
      dateFrom: query.data.dateFrom ?? null,
      dateMode: query.data.dateMode,
      dateTo: query.data.dateTo ?? null,
      format: query.data.format,
      returned: result.data.rows.length,
      total: result.data.total,
    });

    if (query.data.format === "xlsx") {
      const buffer = await buildFinanceWorkbook(result.data.rows, result.data.summary);

      return new NextResponse(buffer, {
        headers: {
          "Content-Disposition": `attachment; filename="${fileBase}.xlsx"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    }

    return new NextResponse(buildFinanceCsv(result.data.rows), {
      headers: {
        "Content-Disposition": `attachment; filename="${fileBase}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return repositoryErrorResponse(
      error,
      "ADMIN_FINANCE_EXPORT_UNAVAILABLE",
      "Admin finance export is temporarily unavailable."
    );
  }
}

const exportHeaders = [
  "type",
  "date",
  "title",
  "amount_net",
  "currency",
  "order_no",
  "sku_code",
  "batch_code",
  "supplier",
  "category",
  "status",
  "confidence",
] as const;

function buildFinanceCsv(rows: AdminFinanceLedgerRow[]) {
  const csvRows = [
    exportHeaders.join(","),
    ...rows.map((row) =>
      [
        row.type,
        row.date,
        row.title,
        row.amountNet.toFixed(2),
        row.currency,
        row.orderNo ?? "",
        row.skuCode ?? "",
        row.batchCode ?? "",
        row.supplierName ?? "",
        row.category ?? "",
        row.status ?? "",
        row.confidence ?? "",
      ]
        .map(escapeCsvCell)
        .join(",")
    ),
  ];

  return `\uFEFF${csvRows.join("\n")}`;
}

async function buildFinanceWorkbook(
  rows: AdminFinanceLedgerRow[],
  summary: Awaited<ReturnType<typeof listAdminFinanceLedger>>["data"]["summary"]
) {
  const workbook = new ExcelJS.Workbook();
  const ledgerSheet = workbook.addWorksheet("Ledger");

  ledgerSheet.columns = exportHeaders.map((header) => ({
    header,
    key: header,
    width: header === "title" ? 32 : 18,
  }));

  for (const row of rows) {
    ledgerSheet.addRow({
      amount_net: row.amountNet,
      batch_code: row.batchCode ?? "",
      category: row.category ?? "",
      confidence: row.confidence ?? "",
      currency: row.currency,
      date: row.date,
      order_no: row.orderNo ?? "",
      sku_code: row.skuCode ?? "",
      status: row.status ?? "",
      supplier: row.supplierName ?? "",
      title: row.title,
      type: row.type,
    });
  }

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "metric", key: "metric", width: 28 },
    { header: "value", key: "value", width: 18 },
  ];
  for (const [metric, value] of Object.entries(summary)) {
    if (typeof value === "number" || typeof value === "string") {
      summarySheet.addRow({ metric, value });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
