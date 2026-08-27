import ExcelJS from "exceljs";
import type {
  AdminSupplierBatch,
  AdminSupplierBatchCharge,
  AdminSupplierBatchDetail,
  AdminSupplierBatchLine,
} from "@/lib/partspro-repository";

export type SupplierBatchFileFormat = "csv" | "xlsx";
export type SupplierBatchExportScope = "batches" | "lines" | "charges";

type ExportValue = string | number | boolean | null | undefined;
type ExportRow = Record<string, ExportValue>;
type ExportColumn = {
  header: string;
  key: string;
  width?: number;
};

const supplierBatchColumns: ExportColumn[] = [
  { header: "batch_code", key: "batch_code", width: 18 },
  { header: "supplier_code", key: "supplier_code", width: 16 },
  { header: "supplier_label", key: "supplier_label", width: 22 },
  { header: "invoice_no", key: "invoice_no", width: 18 },
  { header: "order_no", key: "order_no", width: 18 },
  { header: "invoice_date", key: "invoice_date", width: 14 },
  { header: "received_at", key: "received_at", width: 20 },
  { header: "imported_at", key: "imported_at", width: 20 },
  { header: "line_count", key: "line_count", width: 12 },
  { header: "qty_total", key: "qty_total", width: 12 },
  { header: "line_qty_total", key: "line_qty_total", width: 14 },
  { header: "ordered_qty", key: "ordered_qty", width: 12 },
  { header: "short_qty", key: "short_qty", width: 12 },
  { header: "total_cost", key: "total_cost", width: 12 },
  { header: "line_cost_total", key: "line_cost_total", width: 14 },
  { header: "currency", key: "currency", width: 10 },
  { header: "vat_mode", key: "vat_mode", width: 18 },
  { header: "active_products", key: "active_products", width: 14 },
  { header: "draft_products", key: "draft_products", width: 14 },
  { header: "missing_images", key: "missing_images", width: 14 },
  { header: "missing_products", key: "missing_products", width: 16 },
  { header: "price_violations", key: "price_violations", width: 16 },
  { header: "model_prefix_issues", key: "model_prefix_issues", width: 18 },
  { header: "verification_status", key: "verification_status", width: 18 },
  { header: "verification_issues", key: "verification_issues", width: 34 },
  { header: "cost_status", key: "cost_status", width: 18 },
  { header: "estimated_count", key: "estimated_count", width: 16 },
  { header: "confirmed_count", key: "confirmed_count", width: 16 },
  { header: "cancelled_count", key: "cancelled_count", width: 16 },
  { header: "estimated_net", key: "estimated_net", width: 16 },
  { header: "estimated_vat", key: "estimated_vat", width: 16 },
  { header: "estimated_gross", key: "estimated_gross", width: 18 },
  { header: "estimated_capitalized", key: "estimated_capitalized", width: 22 },
  { header: "confirmed_net", key: "confirmed_net", width: 16 },
  { header: "confirmed_vat", key: "confirmed_vat", width: 16 },
  { header: "confirmed_gross", key: "confirmed_gross", width: 18 },
  { header: "confirmed_capitalized", key: "confirmed_capitalized", width: 22 },
  { header: "confirmed_landed_total", key: "confirmed_landed_total", width: 22 },
  { header: "projected_landed_total", key: "projected_landed_total", width: 22 },
  { header: "review_codes", key: "review_codes", width: 30 },
  { header: "source_file_name", key: "source_file_name", width: 24 },
];

const supplierBatchLineColumns: ExportColumn[] = [
  { header: "batch_code", key: "batch_code", width: 18 },
  { header: "supplier_label", key: "supplier_label", width: 22 },
  { header: "invoice_no", key: "invoice_no", width: 18 },
  { header: "order_no", key: "order_no", width: 18 },
  { header: "line_no", key: "line_no", width: 10 },
  { header: "sku_code", key: "sku_code", width: 18 },
  { header: "ean", key: "ean", width: 18 },
  { header: "supplier_sku", key: "supplier_sku", width: 20 },
  { header: "name", key: "name", width: 42 },
  { header: "qty_ordered", key: "qty_ordered", width: 12 },
  { header: "qty_received", key: "qty_received", width: 12 },
  { header: "qty_short", key: "qty_short", width: 12 },
  { header: "unit_cost", key: "unit_cost", width: 12 },
  { header: "line_total", key: "line_total", width: 12 },
  { header: "weight_gram", key: "weight_gram", width: 14 },
  { header: "cost_status", key: "cost_status", width: 18 },
  { header: "goods_cost", key: "goods_cost", width: 14 },
  { header: "confirmed_inbound", key: "confirmed_inbound", width: 18 },
  { header: "landed_line_cost", key: "landed_line_cost", width: 18 },
  { header: "landed_unit_cost", key: "landed_unit_cost", width: 18 },
  { header: "image_status", key: "image_status", width: 14 },
  { header: "product_status", key: "product_status", width: 14 },
  { header: "current_stock_qty", key: "current_stock_qty", width: 16 },
  { header: "current_available_qty", key: "current_available_qty", width: 18 },
  { header: "current_catalog_status", key: "current_catalog_status", width: 18 },
  { header: "current_image_path", key: "current_image_path", width: 42 },
  { header: "price_rule_ok", key: "price_rule_ok", width: 14 },
  { header: "model_prefix_issue", key: "model_prefix_issue", width: 18 },
  { header: "product_missing", key: "product_missing", width: 16 },
];

const supplierBatchChargeColumns: ExportColumn[] = [
  { header: "batch_code", key: "batch_code", width: 18 },
  { header: "charge_id", key: "charge_id", width: 38 },
  { header: "charge_status", key: "charge_status", width: 16 },
  { header: "charge_type", key: "charge_type", width: 16 },
  { header: "amount_net", key: "amount_net", width: 16 },
  { header: "vat_amount", key: "vat_amount", width: 16 },
  { header: "amount_gross", key: "amount_gross", width: 18 },
  { header: "capitalized_amount", key: "capitalized_amount", width: 22 },
  { header: "currency", key: "currency", width: 10 },
  { header: "vat_treatment", key: "vat_treatment", width: 20 },
  { header: "allocation_method", key: "allocation_method", width: 20 },
  { header: "carrier_name", key: "carrier_name", width: 22 },
  { header: "reference", key: "reference", width: 22 },
  { header: "occurred_at", key: "occurred_at", width: 22 },
  { header: "evidence_url", key: "evidence_url", width: 42 },
  { header: "notes", key: "notes", width: 36 },
  { header: "zero_cost_reason", key: "zero_cost_reason", width: 28 },
  { header: "payload_fingerprint", key: "payload_fingerprint", width: 70 },
];

export const supplierBatchTemplateColumns = [
  "supplier_code",
  "supplier_label",
  "batch_code",
  "invoice_no",
  "order_no",
  "invoice_date",
  "received_at",
  "currency",
  "vat_mode",
  "location",
  "source_file_name",
  "line_no",
  "sku_code",
  "ean",
  "supplier_sku",
  "name",
  "brand",
  "model",
  "model_codes",
  "compatibility_models",
  "category",
  "quality_grade",
  "qty_ordered",
  "qty_received",
  "unit_cost",
  "line_total",
  "image_source_url",
  "image_status",
  "product_status",
  "notes",
] as const;

const templateColumns: ExportColumn[] = supplierBatchTemplateColumns.map((key) => ({
  header: key,
  key,
  width: Math.max(14, key.length + 2),
}));

const templateExampleRow: ExportRow = {
  supplier_code: "MOBILAX",
  supplier_label: "Mobilax ChinaTech",
  batch_code: "BATCH-YYYYMMDD",
  invoice_no: "BLIV0000000",
  order_no: "ORDER0000",
  invoice_date: "2026-06-18",
  received_at: "2026-06-18",
  currency: "EUR",
  vat_mode: "IVA esclusa",
  location: "Milano",
  source_file_name: "supplier-document.pdf",
  line_no: 1,
  sku_code: "3000000000000",
  ean: "3000000000000",
  supplier_sku: "SUPPLIER-SKU",
  name: "LCD Display TFT Samsung Galaxy A54 5G A546 Black",
  brand: "Samsung",
  model: "Galaxy A54 5G A546",
  model_codes: "A546B;A546E",
  compatibility_models: "Galaxy A54 5G A546",
  category: "Schermi",
  quality_grade: "A",
  qty_ordered: 2,
  qty_received: 2,
  unit_cost: 9.5,
  line_total: 19,
  image_source_url: "https://example.com/product-image",
  image_status: "uploaded",
  product_status: "active",
  notes: "No Chinese text; no domestic/assembly source terms.",
};

export function buildSupplierBatchExportRows(
  scope: SupplierBatchExportScope,
  batches: AdminSupplierBatch[],
  details: AdminSupplierBatchDetail[] = []
) {
  if (scope === "lines") {
    return {
      columns: supplierBatchLineColumns,
      rows: details.flatMap((detail) =>
        detail.lines.map((line) => supplierBatchLineExportRow(detail.batch, line))
      ),
      sheetName: "Batch Lines",
    };
  }

  if (scope === "charges") {
    return {
      columns: supplierBatchChargeColumns,
      rows: details.flatMap((detail) =>
        detail.charges.map((charge) => supplierBatchChargeExportRow(detail.batch, charge))
      ),
      sheetName: "Batch Charges",
    };
  }

  return {
    columns: supplierBatchColumns,
    rows: batches.map(supplierBatchExportRow),
    sheetName: "Batches",
  };
}

export function buildSupplierBatchTemplateRows(includeExample = false) {
  return {
    columns: templateColumns,
    exampleRows: [templateExampleRow],
    rows: includeExample ? [templateExampleRow] : [],
    sheetName: "Import Template",
  };
}

export function buildCsvContent(columns: ExportColumn[], rows: ExportRow[]) {
  const header = columns.map((column) => column.header);
  const body = rows.map((row) => columns.map((column) => row[column.key] ?? ""));
  return `\uFEFF${[header, ...body].map((row) => row.map(csvEscape).join(",")).join("\n")}`;
}

export async function buildXlsxBuffer({
  columns,
  exampleRows,
  rows,
  sheetName,
}: {
  columns: ExportColumn[];
  exampleRows?: ExportRow[];
  rows: ExportRow[];
  sheetName: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PartsPro";
  workbook.created = new Date();
  addWorksheet(workbook, sheetName, columns, rows);

  if (exampleRows?.length) {
    addWorksheet(workbook, "Example", columns, exampleRows);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function supplierBatchFileName({
  format,
  scope,
  suffix,
}: {
  format: SupplierBatchFileFormat;
  scope: "template" | SupplierBatchExportScope;
  suffix?: string;
}) {
  const date = new Date().toISOString().slice(0, 10);
  const parts = ["partspro", "supplier-batches", scope, suffix, date].filter(Boolean);
  return `${parts.join("-")}.${format}`;
}

export function supplierBatchContentType(format: SupplierBatchFileFormat) {
  return format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv; charset=utf-8";
}

function addWorksheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: ExportColumn[],
  rows: ExportRow[]
) {
  const worksheet = workbook.addWorksheet(name);
  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? Math.max(12, column.header.length + 2),
  }));
  worksheet.addRows(rows);
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
}

function supplierBatchExportRow(batch: AdminSupplierBatch): ExportRow {
  const summary = batch.costSummary;
  const costUnavailable = summary === null;
  const costRecorded = summary !== null && summary.costStatus !== "unrecorded";

  return {
    batch_code: batch.batchCode,
    supplier_code: batch.supplierCode,
    supplier_label: batch.supplierName,
    invoice_no: batch.invoiceNo,
    order_no: batch.orderNo,
    invoice_date: batch.invoiceDate,
    received_at: batch.receivedAt,
    imported_at: batch.createdAt,
    line_count: batch.lineCount,
    qty_total: batch.totalQty,
    line_qty_total: batch.lineQtyTotal,
    ordered_qty: batch.orderedQty,
    short_qty: batch.shortQty,
    total_cost: batch.totalCost,
    line_cost_total: batch.lineCostTotal,
    currency: batch.currency,
    vat_mode: batch.vatMode,
    active_products: batch.activeProductCount,
    draft_products: batch.draftProductCount,
    missing_images: batch.missingImageCount,
    missing_products: batch.productMissingCount,
    price_violations: batch.priceViolationCount,
    model_prefix_issues: batch.modelPrefixIssueCount,
    verification_status: batch.verification.status,
    verification_issues: batch.verification.issues.join(";"),
    cost_status: costUnavailable ? "unavailable" : summary.costStatus,
    estimated_count: summary?.estimatedCount ?? "",
    confirmed_count: summary?.confirmedCount ?? "",
    cancelled_count: summary?.cancelledCount ?? "",
    estimated_net: costRecorded ? centsToExportValue(summary.estimatedNetCents) : "",
    estimated_vat: costRecorded ? centsToExportValue(summary.estimatedVatCents) : "",
    estimated_gross: costRecorded ? centsToExportValue(summary.estimatedGrossCents) : "",
    estimated_capitalized: costRecorded
      ? centsToExportValue(summary.estimatedCapitalizedCents)
      : "",
    confirmed_net: costRecorded ? centsToExportValue(summary.confirmedNetCents) : "",
    confirmed_vat: costRecorded ? centsToExportValue(summary.confirmedVatCents) : "",
    confirmed_gross: costRecorded ? centsToExportValue(summary.confirmedGrossCents) : "",
    confirmed_capitalized: costRecorded
      ? centsToExportValue(summary.confirmedCapitalizedCents)
      : "",
    confirmed_landed_total: costRecorded
      ? centsToExportValue(summary.confirmedLandedTotalCents)
      : "",
    projected_landed_total: costRecorded
      ? centsToExportValue(summary.projectedLandedTotalCents)
      : "",
    review_codes: summary?.reviewCodes.join(";") ?? "",
    source_file_name: batch.sourceFileName,
  };
}

function supplierBatchLineExportRow(
  batch: AdminSupplierBatch,
  line: AdminSupplierBatchLine
): ExportRow {
  const summary = batch.costSummary;
  const costStatus = summary === null ? "unavailable" : summary.costStatus;
  const hasConfirmedCosts = summary !== null && summary.confirmedCount > 0;

  return {
    batch_code: batch.batchCode,
    supplier_label: batch.supplierName,
    invoice_no: batch.invoiceNo,
    order_no: batch.orderNo,
    line_no: line.lineNo,
    sku_code: line.skuCode,
    ean: line.ean,
    supplier_sku: line.supplierSku,
    name: line.name,
    qty_ordered: line.qtyOrdered,
    qty_received: line.qtyReceived,
    qty_short: line.qtyShort,
    unit_cost: line.unitCost,
    line_total: line.lineTotal,
    weight_gram: line.product?.weightGram,
    cost_status: costStatus,
    goods_cost: line.costs ? centsToExportValue(line.costs.goodsCostCents) : "",
    confirmed_inbound: hasConfirmedCosts && line.costs
      ? centsToExportValue(line.costs.confirmedInboundCents)
      : "",
    landed_line_cost: hasConfirmedCosts && line.costs
      ? centsToExportValue(line.costs.landedLineCostCents)
      : "",
    landed_unit_cost: hasConfirmedCosts && line.costs
      ? line.costs.landedUnitCost ?? ""
      : "",
    image_status: line.imageStatus,
    product_status: line.productStatus,
    current_stock_qty: line.product?.stockQty,
    current_available_qty: line.product?.availableQty,
    current_catalog_status: line.product?.catalogStatus,
    current_image_path: line.product?.imagePath,
    price_rule_ok: line.product?.priceRuleOk,
    model_prefix_issue: line.product?.modelPrefixIssue,
    product_missing: !line.product,
  };
}

function supplierBatchChargeExportRow(
  batch: AdminSupplierBatch,
  charge: AdminSupplierBatchCharge
): ExportRow {
  return {
    batch_code: batch.batchCode,
    charge_id: charge.chargeId,
    charge_status: charge.status,
    charge_type: charge.chargeType,
    amount_net: centsToExportValue(charge.amountNetCents),
    vat_amount: centsToExportValue(charge.vatAmountCents),
    amount_gross: centsToExportValue(charge.amountGrossCents),
    capitalized_amount: centsToExportValue(charge.capitalizedAmountCents),
    currency: charge.currency,
    vat_treatment: charge.vatTreatment,
    allocation_method: charge.allocationMethod,
    carrier_name: charge.carrierName,
    reference: charge.reference,
    occurred_at: charge.occurredAt,
    evidence_url: charge.evidenceUrl,
    notes: charge.notes,
    zero_cost_reason: charge.zeroCostReason,
    payload_fingerprint: charge.payloadFingerprint,
  };
}

function centsToExportValue(cents: number) {
  return Number((cents / 100).toFixed(2));
}

function csvEscape(value: ExportValue) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
