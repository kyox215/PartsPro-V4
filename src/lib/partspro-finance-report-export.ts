import ExcelJS from "exceljs";
import { bucketFinanceReport } from "./partspro-finance-reports.mjs";
import type { AdminFinanceLedgerRow, AdminFinanceReport } from "./partspro-repository";

type Cell = string | number;
type Section = { name: string; columns: string[]; rows: Cell[][] };
const statementKeys = ["salesNet", "cogsNet", "grossProfit", "expenseNet", "operatingProfit"] as const;
const periodKeys = ["salesNet", "cogsNet", "expenseNet", "operatingProfit", "purchaseNet", "supplierPaymentsNet", "cashRefundsGross", "walletRefundsGross", "paidExpenseNet", "pendingExpenseNet", "salesOrders"] as const;

function sections(report: AdminFinanceReport, ledger: AdminFinanceLedgerRow[]): Section[] {
  const periodRows = (unit: "day" | "month") => bucketFinanceReport(report.daily, unit).map(row => [row.date, row.dateTo, ...periodKeys.map(key => row[key])]);
  return [
    { name: "Overview", columns: ["metric", "value"], rows: [
      ["date_from", report.range.dateFrom], ["date_to", report.range.dateTo], ["date_mode", report.range.dateMode], ["timezone", "Europe/Rome"], ["currency", "EUR"], ["generated_at", report.generatedAt],
      ["previous_from", report.previousRange.dateFrom], ["previous_to", report.previousRange.dateTo],
      ...Object.entries(report.totals).map(([key, value]) => [key, value] as Cell[]),
      ["accountsPayableNet_current_balance_for_period_batches", report.summary.accountsPayable], ["inventoryCostNet_current_not_historical", report.summary.inventoryCostValue],
      ["vatAmbiguousPurchaseNet", report.summary.vatAmbiguousPurchaseNet],
      ["basis", "Net operating report; sales = paid eligible orders, expenses = paid + pending; cancelled excluded. Receivables include VAT and shipping."],
      ["payments", "Recorded payments are net of VAT, not bank cash flow. Supplier payments do not reduce operating profit again. No opening cash balance or complete customer receipt journal."],
      ["limits", "RMA refunds reverse sales; cash and wallet payouts are recorded separately. Inventory and open balances are current snapshots, not historical balance sheets. Search/supplier/category/confidence filters apply to individual ledger entries."],
    ] },
    { name: "ProfitLoss", columns: ["metric", "current_net_EUR", "previous_net_EUR", "change_net_EUR", "change_percent"], rows: statementKeys.map(key => [key, report.totals[key], report.previousTotals[key], Math.round((report.totals[key] - report.previousTotals[key]) * 100) / 100, report.changes[key] ?? ""]) },
    { name: "Monthly", columns: ["from", "to", ...periodKeys], rows: periodRows("month") },
    { name: "Daily", columns: ["from", "to", ...periodKeys], rows: periodRows("day") },
    { name: "Expenses", columns: ["category", "recognized_net_EUR", "paid_net_EUR", "pending_net_EUR", "records"], rows: report.expenseCategories.map(row => [row.category, row.amountNet, row.paidNet, row.pendingNet, row.count]) },
    { name: "Suppliers", columns: ["identity", "supplier", "purchase_net_EUR", "historical_paid_net_EUR", "applied_paid_net_EUR", "outstanding_net_EUR", "batches"], rows: report.suppliers.map(row => [row.key, row.supplierName, row.purchaseNet, row.paidNet, row.appliedPaidNet, row.outstandingNet, row.batches]) },
    { name: "Ledger", columns: ["type", "date", "title", "amount_net_EUR_except_gross_receivables", "currency", "order_no", "sku", "batch", "supplier", "category", "status", "confidence"], rows: ledger.map(row => [row.type, row.date, row.title, row.amountNet, row.currency, row.orderNo ?? "", row.skuCode ?? "", row.batchCode ?? "", row.supplierName ?? "", row.category ?? "", row.status ?? "", row.confidence ?? ""]) },
  ];
}
function csvCell(value: Cell) {
  let text = String(value).replace(/\r\n?/g, "\n");
  if (typeof value === "string" && /^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function buildFinanceReportCsv(report: AdminFinanceReport, ledger: AdminFinanceLedgerRow[]) {
  return "\uFEFF" + sections(report, ledger).flatMap(section => [[`# ${section.name}`], section.columns, ...section.rows, []]).map(row => row.map(csvCell).join(",")).join("\r\n");
}
export async function buildFinanceReportWorkbook(report: AdminFinanceReport, ledger: AdminFinanceLedgerRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PartsPro";
  for (const section of sections(report, ledger)) {
    const sheet = workbook.addWorksheet(section.name, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = section.columns.map((header, index) => ({ header, key: String(index), width: index === 0 || section.name === "Overview" ? 36 : 24 }));
    sheet.addRows(section.rows);
    sheet.getRow(1).eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2558CC" } }; cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.alignment = { vertical: "middle", wrapText: true }; });
    sheet.getRow(1).height = 34;
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: section.columns.length } };
    sheet.eachRow((row, number) => { if (number > 1) row.eachCell(cell => { if (typeof cell.value === "number") cell.numFmt = '#,##0.00;[Red]-#,##0.00'; }); });
  }
  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}
