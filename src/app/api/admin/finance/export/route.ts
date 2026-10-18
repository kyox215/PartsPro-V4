import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  auditAdminFinanceExport,
  listAdminFinanceLedgerExport,
  type AdminFinanceLedgerRow,
} from "@/lib/partspro-repository";
import { apiError } from "@/lib/partspro-api";
import { hasAdminPermission } from "@/lib/partspro-admin-auth";
import { parseAdminQuery, repositoryErrorResponse, requireAdminApi } from "../../_shared";
import { financeQuerySchema } from "../_shared";

export const dynamic = "force-dynamic";

const exportQuerySchema = financeQuerySchema.safeExtend({
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
    const result = await listAdminFinanceLedgerExport(query.data);
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

    return new NextResponse(buildFinanceCsv(result.data.rows, result.data.summary), {
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

function buildFinanceCsv(rows: AdminFinanceLedgerRow[], summary: Awaited<ReturnType<typeof listAdminFinanceLedgerExport>>["data"]["summary"]) {
  const csvRows = [
    ["# range", summary.range.dateFrom ?? "", summary.range.dateTo ?? "", summary.range.dateMode, "Europe/Rome"].map(escapeCsvCell).join(","),
    ...Object.entries(summary).filter(([,value]) => typeof value === "number" || typeof value === "string").map(([key,value]) => ["# summary", key, String(value)].map(escapeCsvCell).join(",")),
    ["# confidence", JSON.stringify(summary.confidence)].map(escapeCsvCell).join(","),
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
  summary: Awaited<ReturnType<typeof listAdminFinanceLedgerExport>>["data"]["summary"]
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

  summarySheet.addRow({ metric: "range", value: JSON.stringify(summary.range) });
  summarySheet.addRow({ metric: "confidence", value: JSON.stringify(summary.confidence) });
  summarySheet.addRow({ metric: "timezone", value: "Europe/Rome" });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

function escapeCsvCell(value: string) {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const safeValue = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;

  if (/[",\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  return safeValue;
}
