import "server-only";

import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import {
  normalizeProductImportHeader,
  normalizeProductImportSku,
  parseProductImportDelimited,
  shouldSkipProductImportUpdate,
  splitProductImportList,
} from "@/lib/partspro-product-import-core.mjs";
import type {
  AdminProduct,
  AdminProductPatchInput,
  AdminProductWriteInput,
} from "@/lib/partspro-repository";

export const productImportColumns = [
  "operation",
  "sku",
  "name",
  "catalog_department",
  "category",
  "brand",
  "model",
  "model_code",
  "model_codes",
  "compatibility_models",
  "grade",
  "cost_price",
  "b2b_price",
  "retail_price",
  "vat_mode",
  "moq",
  "warranty_days",
  "weight_gram",
  "warehouse",
  "supplier",
  "batch_code",
  "tags",
  "row_note",
] as const;

export type ProductImportColumn = (typeof productImportColumns)[number];
export type ProductImportResolvedOperation = "create" | "update" | "skip";
export type ProductImportStatus = "ready" | "draft" | "blocked" | "skipped";

const maxFileBytes = 5 * 1024 * 1024;
const maxRows = 500;
const maxColumns = 100;
const allowedExtensions = new Set(["xlsx", "csv"]);
const skuPattern = /^[A-Za-z0-9_+.-]+$/;
const grades = new Set(["A+", "A", "B", "Refurbished"]);
const departments = new Set(["phone", "tablet", "computer", "general_merchandise"]);
const operations = new Set(["auto", "create", "update", "skip"]);

const headerAliases: Record<string, ProductImportColumn> = {
  action: "operation",
  操作: "operation",
  操作方式: "operation",
  sku编码: "sku",
  商品编码: "sku",
  商品名称: "name",
  名称: "name",
  nome: "name",
  部门: "catalog_department",
  商品部门: "catalog_department",
  reparto: "catalog_department",
  分类: "category",
  categoria: "category",
  品牌: "brand",
  marca: "brand",
  型号: "model",
  modello: "model",
  型号代码: "model_code",
  兼容型号: "compatibility_models",
  品质: "grade",
  等级: "grade",
  qualita: "grade",
  质量: "grade",
  成本价: "cost_price",
  costo: "cost_price",
  批发价: "b2b_price",
  prezzo_b2b: "b2b_price",
  零售价: "retail_price",
  prezzo_retail: "retail_price",
  iva: "vat_mode",
  最低订购量: "moq",
  保修天数: "warranty_days",
  重量: "weight_gram",
  仓库: "warehouse",
  magazzino: "warehouse",
  供应商: "supplier",
  fornitore: "supplier",
  批次: "batch_code",
  标签: "tags",
  备注: "row_note",
  note: "row_note",
};

export type ProductImportChange = {
  currentValue: string;
  field: string;
  nextValue: string;
};

export type ProductImportParsedRow = {
  raw: Record<ProductImportColumn, string>;
  rowNumber: number;
};

export type ProductImportSource = {
  detectedHeaders: string[];
  ignoredHeaders: string[];
  rows: ProductImportParsedRow[];
  sourceFileName: string;
  sourceHash: string;
};

export type ProductImportPreviewRow = {
  changes: ProductImportChange[];
  createInput: AdminProductWriteInput | null;
  existing: AdminProduct | null;
  issues: string[];
  normalized: Record<ProductImportColumn, string>;
  operation: ProductImportResolvedOperation;
  patchInput: AdminProductPatchInput | null;
  requiredPermissions: string[];
  rowNumber: number;
  sku: string;
  status: ProductImportStatus;
  warnings: string[];
};

export type ProductImportPreview = {
  counts: {
    blocked: number;
    create: number;
    draft: number;
    ready: number;
    skipped: number;
    total: number;
    update: number;
  };
  detectedHeaders: string[];
  ignoredHeaders: string[];
  previewHash: string;
  rows: ProductImportPreviewRow[];
  sourceFileName: string;
  sourceHash: string;
};

type SpreadsheetRow = { rowNumber: number; values: string[] };

export class ProductImportError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "ProductImportError";
  }
}

export async function parseProductImportFile(file: File): Promise<ProductImportSource> {
  validateFile(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const spreadsheetRows = await readSpreadsheetRows(buffer, file.name);
  const [headerRecord, ...body] = spreadsheetRows;
  const rawHeaders = headerRecord?.values;

  if (!rawHeaders) {
    throw new ProductImportError("文件没有表头行。请使用标准模板或粘贴包含表头的数据。");
  }

  const resolvedHeaders = rawHeaders.map((header) => resolveHeader(normalizeProductImportHeader(header)));
  const resolvedProductHeaders = resolvedHeaders.filter(isProductImportColumn);
  const detectedHeaders = [...new Set(resolvedProductHeaders)];
  const ignoredHeaders = rawHeaders
    .map((header, index) => ({ header: header.trim(), resolved: resolvedHeaders[index] }))
    .filter((entry) => entry.header && !entry.resolved)
    .map((entry) => entry.header);
  const duplicateHeaders = resolvedProductHeaders.filter(
    (header, index) => resolvedProductHeaders.indexOf(header) !== index
  );

  if (!detectedHeaders.includes("sku")) {
    throw new ProductImportError("首版商品导入必须包含 sku 列。", { detectedHeaders, ignoredHeaders });
  }
  if (duplicateHeaders.length > 0) {
    throw new ProductImportError("同一个目标字段被重复声明。", {
      duplicateHeaders: [...new Set(duplicateHeaders)],
    });
  }

  const rows = body
    .map(({ rowNumber, values }) => {
      const raw = emptyNormalizedRow();
      resolvedHeaders.forEach((header, columnIndex) => {
        if (header) raw[header] = values[columnIndex]?.trim() ?? "";
      });
      return { raw, rowNumber };
    })
    .filter((row) => Object.values(row.raw).some(Boolean));

  if (rows.length === 0) throw new ProductImportError("文件中没有商品数据行。");
  if (rows.length > maxRows) throw new ProductImportError(`单次最多导入 ${maxRows} 行商品。`);

  return {
    detectedHeaders,
    ignoredHeaders: [...new Set(ignoredHeaders)],
    rows,
    sourceFileName: file.name.slice(0, 240),
    sourceHash: sha256(buffer),
  };
}

export function buildProductImportPreview(
  source: ProductImportSource,
  existingProducts: AdminProduct[],
  hasPermission: (permission: string) => boolean
): ProductImportPreview {
  const existingBySku = new Map(
    existingProducts.flatMap((product) =>
      [product.sku, product.sourceSku]
        .filter(Boolean)
        .map((sku) => [normalizeProductImportSku(sku!), product] as const)
    )
  );
  const seenSkuRows = new Map<string, number>();
  const seenProductRows = new Map<string, number>();
  const rows = source.rows.map((row) =>
    normalizePreviewRow(row, existingBySku, seenSkuRows, seenProductRows, hasPermission)
  );
  const counts = {
    blocked: rows.filter((row) => row.status === "blocked").length,
    create: rows.filter((row) => row.operation === "create").length,
    draft: rows.filter((row) => row.status === "draft").length,
    ready: rows.filter((row) => row.status === "ready").length,
    skipped: rows.filter((row) => row.status === "skipped").length,
    total: rows.length,
    update: rows.filter((row) => row.operation === "update").length,
  };
  const hashPayload = rows.map((row) => ({
    createInput: row.createInput,
    existingUpdatedAt: row.existing?.updatedAt ?? null,
    operation: row.operation,
    patchInput: row.patchInput,
    rowNumber: row.rowNumber,
    sku: row.sku,
    status: row.status,
  }));

  return {
    counts,
    detectedHeaders: source.detectedHeaders,
    ignoredHeaders: source.ignoredHeaders,
    previewHash: sha256(JSON.stringify({ sourceHash: source.sourceHash, rows: hashPayload })),
    rows,
    sourceFileName: source.sourceFileName,
    sourceHash: source.sourceHash,
  };
}

function normalizePreviewRow(
  parsed: ProductImportParsedRow,
  existingBySku: Map<string, AdminProduct>,
  seenSkuRows: Map<string, number>,
  seenProductRows: Map<string, number>,
  hasPermission: (permission: string) => boolean
): ProductImportPreviewRow {
  const raw = parsed.raw;
  const issues: string[] = [];
  const warnings: string[] = [];
  const requestedOperation = enumValue(raw.operation || "auto", operations, "operation", issues);
  const sku = normalizeProductImportSku(raw.sku);
  const existing = sku ? existingBySku.get(sku) ?? null : null;
  let operation: ProductImportResolvedOperation = requestedOperation === "skip"
    ? "skip"
    : requestedOperation === "auto"
      ? existing ? "update" : "create"
      : requestedOperation as ProductImportResolvedOperation;

  if (!sku) issues.push("sku 必填；首版不使用系统自动生成 SKU");
  if (sku && (!skuPattern.test(sku) || sku.length < 2 || sku.length > 64)) {
    issues.push("sku 必须为 2–64 位，只能包含字母、数字、_、+、.、-");
  }
  if (sku) {
    const previous = seenSkuRows.get(sku);
    if (previous) issues.push(`sku 与第 ${previous} 行重复`);
    else seenSkuRows.set(sku, parsed.rowNumber);
  }
  if (existing) {
    const previous = seenProductRows.get(existing.id);
    if (previous) issues.push(`与第 ${previous} 行指向同一个现有商品`);
    else seenProductRows.set(existing.id, parsed.rowNumber);
  }
  if (operation === "create" && existing) issues.push("operation=create，但 SKU 已存在");
  if (operation === "update" && !existing) issues.push("operation=update，但找不到该 SKU");

  validateTextFields(raw, issues);
  validateLists(raw, issues);
  const grade = optionalEnum(raw.grade, grades, "grade", issues);
  const department = optionalEnum(raw.catalog_department, departments, "catalog_department", issues);
  const costPrice = optionalDecimal(raw.cost_price, "cost_price", issues, 0, 100000);
  const b2bPrice = optionalDecimal(raw.b2b_price, "b2b_price", issues, 0, 100000);
  const retailPrice = optionalDecimal(raw.retail_price, "retail_price", issues, 0, 100000);
  const moq = optionalInteger(raw.moq, "moq", issues, 1, 10000);
  const warrantyDays = optionalInteger(raw.warranty_days, "warranty_days", issues, 0, 3650);
  const weightGram = optionalInteger(raw.weight_gram, "weight_gram", issues, 0, 100000);
  if (raw.warehouse && raw.warehouse.trim().toLowerCase() !== "milano") {
    issues.push("warehouse 当前只能填写 Milano");
  }

  const numbers = { b2bPrice, costPrice, department, grade, moq, retailPrice, warrantyDays, weightGram };
  const createInput = operation === "create" ? buildCreateInput(raw, numbers, issues) : null;
  const patchInput = operation === "update" && existing ? buildPatchInput(raw, numbers) : null;
  const changes = existing && patchInput ? productChanges(existing, patchInput) : [];
  if (patchInput && shouldSkipProductImportUpdate(operation, changes.length, issues.length)) {
    operation = "skip";
    warnings.push("没有检测到需要修改的字段");
  }

  const requiredPermissions = requiredPermissionsForRow(operation, createInput, patchInput);
  for (const permission of requiredPermissions) {
    if (!hasPermission(permission)) issues.push(`缺少权限：${permission}`);
  }
  const status: ProductImportStatus = operation === "skip"
    ? "skipped"
    : issues.length > 0
      ? "blocked"
      : operation === "update" ? "ready" : "draft";

  return {
    changes,
    createInput,
    existing,
    issues: [...new Set(issues)],
    normalized: raw,
    operation,
    patchInput,
    requiredPermissions,
    rowNumber: parsed.rowNumber,
    sku,
    status,
    warnings,
  };
}

type ParsedValues = {
  b2bPrice?: number;
  costPrice?: number;
  department?: string;
  grade?: string;
  moq?: number;
  retailPrice?: number;
  warrantyDays?: number;
  weightGram?: number;
};

function buildCreateInput(
  raw: Record<ProductImportColumn, string>,
  values: ParsedValues,
  issues: string[]
): AdminProductWriteInput {
  const name = raw.name.trim();
  const category = raw.category.trim();
  const brand = raw.brand.trim();
  if (name.length < 2 || name.length > 180) issues.push("新建商品的 name 必须为 2–180 字符");
  if (category.length < 2 || category.length > 80) issues.push("新建商品的 category 必须为 2–80 字符");
  if (!brand || brand.length > 80) issues.push("新建商品必须填写 brand（最多 80 字符）");
  if (!values.department) issues.push("新建商品必须填写 catalog_department");
  return {
    sku: normalizeProductImportSku(raw.sku),
    batchCode: optionalText(raw.batch_code),
    brand,
    catalogDepartment: (values.department ?? "general_merchandise") as AdminProductWriteInput["catalogDepartment"],
    catalogStatus: "draft",
    category,
    compatibleWith: splitProductImportList(raw.compatibility_models),
    costPrice: values.costPrice ?? 0,
    grade: (values.grade ?? "A") as AdminProductWriteInput["grade"],
    model: optionalText(raw.model),
    modelCode: optionalText(raw.model_code),
    modelCodes: splitProductImportList(raw.model_codes),
    moq: values.moq ?? 1,
    name,
    price: values.b2bPrice ?? 0,
    retailPrice: values.retailPrice ?? values.b2bPrice ?? 0,
    rmaDays: values.warrantyDays ?? 180,
    stock: 0,
    supplier: optionalText(raw.supplier),
    tags: splitProductImportList(raw.tags),
    vatMode: optionalText(raw.vat_mode) ?? "IVA esclusa",
    warehouse: "Milano",
    weightGram: values.weightGram ?? 0,
  };
}

function buildPatchInput(
  raw: Record<ProductImportColumn, string>,
  values: ParsedValues
): AdminProductPatchInput {
  const patch: AdminProductPatchInput = { reason: rowReason(raw) };
  assignText(patch, "name", raw.name);
  assignText(patch, "category", raw.category);
  if (values.department) patch.catalogDepartment = values.department as AdminProductPatchInput["catalogDepartment"];
  assignText(patch, "brand", raw.brand);
  if (values.grade) patch.grade = values.grade as AdminProductPatchInput["grade"];
  if (values.b2bPrice !== undefined) patch.price = values.b2bPrice;
  if (values.retailPrice !== undefined) patch.retailPrice = values.retailPrice;
  if (values.costPrice !== undefined) patch.costPrice = values.costPrice;
  if (values.moq !== undefined) patch.moq = values.moq;
  assignList(patch, "compatibleWith", raw.compatibility_models);
  assignList(patch, "tags", raw.tags);
  assignText(patch, "vatMode", raw.vat_mode);
  if (values.warrantyDays !== undefined) patch.rmaDays = values.warrantyDays;
  if (values.weightGram !== undefined) patch.weightGram = values.weightGram;
  assignText(patch, "model", raw.model);
  assignText(patch, "modelCode", raw.model_code);
  assignList(patch, "modelCodes", raw.model_codes);
  assignText(patch, "batchCode", raw.batch_code);
  assignText(patch, "supplier", raw.supplier);
  return patch;
}

function requiredPermissionsForRow(
  operation: ProductImportResolvedOperation,
  createInput: AdminProductWriteInput | null,
  patchInput: AdminProductPatchInput | null
) {
  if (operation === "skip") return [];
  const permissions = new Set<string>();
  if (operation === "create") permissions.add("product.create_draft");
  const data = createInput ?? patchInput ?? {};
  const hasOwn = (field: string) => Object.prototype.hasOwnProperty.call(data, field);
  const contentFields = ["name", "category", "catalogDepartment", "brand", "grade", "moq", "compatibleWith", "tags", "rmaDays", "weightGram", "model", "modelCode", "modelCodes", "batchCode", "supplier"];
  if (operation === "update" && contentFields.some(hasOwn)) permissions.add("product.edit_content");
  if (operation === "update" && ["price", "retailPrice", "vatMode"].some(hasOwn)) permissions.add("product.edit_price");
  if (operation === "create" && ((createInput?.price ?? 0) > 0 || (createInput?.retailPrice ?? 0) > 0 || Boolean(createInput?.vatMode))) permissions.add("product.edit_price");
  if ((operation === "update" && hasOwn("costPrice")) || (operation === "create" && (createInput?.costPrice ?? 0) > 0)) permissions.add("product.edit_cost");
  return [...permissions];
}

function productChanges(existing: AdminProduct, patch: AdminProductPatchInput) {
  const pairs: Array<[keyof AdminProductPatchInput, unknown, unknown]> = [
    ["name", existing.name, patch.name],
    ["category", existing.category, patch.category],
    ["catalogDepartment", existing.catalogDepartment, patch.catalogDepartment],
    ["brand", existing.brand, patch.brand],
    ["grade", existing.grade, patch.grade],
    ["price", existing.b2bPrice, patch.price],
    ["retailPrice", existing.retailPrice, patch.retailPrice],
    ["costPrice", existing.costPrice, patch.costPrice],
    ["moq", existing.moq, patch.moq],
    ["compatibleWith", existing.compatibleWith, patch.compatibleWith],
    ["tags", existing.tags, patch.tags],
    ["vatMode", existing.vatMode, patch.vatMode],
    ["rmaDays", existing.warrantyDays, patch.rmaDays],
    ["weightGram", existing.weightGram, patch.weightGram],
    ["model", existing.model, patch.model],
    ["modelCode", existing.modelCode, patch.modelCode],
    ["modelCodes", existing.modelCodes, patch.modelCodes],
    ["batchCode", existing.batchCode, patch.batchCode],
    ["supplier", existing.supplier, patch.supplier],
  ];
  return pairs
    .filter(([, , next]) => next !== undefined)
    .filter(([, current, next]) => stableValue(current) !== stableValue(next))
    .map(([field, current, next]) => ({
      currentValue: displayValue(current),
      field: String(field),
      nextValue: displayValue(next),
    }));
}

export async function buildProductImportTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PartsPro";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("商品导入", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = productImportColumns.map((key) => ({ header: key, key, width: columnWidth(key) }));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: productImportColumns.length } };
  styleHeader(sheet.getRow(1), "FF0F766E");
  sheet.addRow({
    operation: "auto",
    sku: "8050000000001",
    name: "Display OLED Samsung Galaxy A54 5G A546 Nero",
    catalog_department: "phone",
    category: "Schermi",
    brand: "Samsung",
    model: "Galaxy A54 5G",
    model_code: "A546B",
    model_codes: "A546B;A546E",
    compatibility_models: "Galaxy A54 5G A546",
    grade: "A",
    cost_price: 9.5,
    b2b_price: 15,
    retail_price: 18,
    vat_mode: "IVA esclusa",
    moq: 1,
    warranty_days: 180,
    weight_gram: 120,
    warehouse: "Milano",
    supplier: "Mobilax",
    batch_code: "MOB-2026-07",
    tags: "OLED;Nero",
    row_note: "示例行，正式导入前可以删除",
  });
  sheet.getColumn("sku").numFmt = "@";
  ["cost_price", "b2b_price", "retail_price"].forEach((key) => { sheet.getColumn(key).numFmt = "0.00"; });
  addListValidation(sheet, "operation", "'可选值'!$A$2:$A$5");
  addListValidation(sheet, "catalog_department", "'可选值'!$B$2:$B$5");
  addListValidation(sheet, "grade", "'可选值'!$C$2:$C$5");

  const guide = workbook.addWorksheet("字段说明", { views: [{ state: "frozen", ySplit: 1 }] });
  guide.columns = guideColumns();
  guide.addRows(fieldGuideRows());
  styleHeader(guide.getRow(1), "FF334155");
  guide.getColumn("format").alignment = { wrapText: true, vertical: "top" };

  const values = workbook.addWorksheet("可选值");
  values.addRow(["operation", "catalog_department", "grade"]);
  values.addRows([
    ["auto", "phone", "A+"],
    ["create", "tablet", "A"],
    ["update", "computer", "B"],
    ["skip", "general_merchandise", "Refurbished"],
  ]);
  styleHeader(values.getRow(1), "FF475569");
  values.columns.forEach((column) => { column.width = 24; });

  const notes = workbook.addWorksheet("填写示例");
  notes.columns = [{ header: "场景", key: "scene", width: 28 }, { header: "说明", key: "help", width: 100 }];
  notes.addRows([
    { scene: "新建草稿", help: "operation=auto，SKU 不存在时建立草稿。SKU 必须明确填写。" },
    { scene: "更新商品", help: "填写已有 SKU；空白字段保持原值，不会清空数据库内容。" },
    { scene: "粘贴资料", help: "在后台选择“粘贴表格”，从 Excel/Numbers 复制包含表头的区域即可。" },
    { scene: "库存、图片与发布", help: "首版 Excel 只处理商品主资料。库存、图片和发布继续在商品详情使用专用操作，避免产生半完成数据。" },
    { scene: "分隔符", help: "model_codes、compatibility_models、tags 的多个值使用英文分号 ; 分隔。" },
  ]);
  styleHeader(notes.getRow(1), "FF334155");
  notes.getColumn("help").alignment = { wrapText: true, vertical: "top" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function buildProductImportPreviewBuffer(preview: ProductImportPreview) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PartsPro";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("导入摘要");
  summary.columns = [{ header: "项目", key: "key", width: 30 }, { header: "结果", key: "value", width: 80 }];
  summary.addRows([
    { key: "状态", value: "仅预览，尚未写入数据库" },
    { key: "源文件", value: preview.sourceFileName },
    { key: "source_hash", value: preview.sourceHash },
    { key: "preview_hash", value: preview.previewHash },
    { key: "总行数", value: preview.counts.total },
    { key: "新增草稿", value: preview.counts.create },
    { key: "更新", value: preview.counts.update },
    { key: "跳过", value: preview.counts.skipped },
    { key: "阻断", value: preview.counts.blocked },
    { key: "未识别列", value: preview.ignoredHeaders.join("; ") || "无" },
  ]);
  styleHeader(summary.getRow(1), "FF0F766E");
  summary.getCell("B2").font = { bold: true, color: { argb: "FFB91C1C" } };

  const products = workbook.addWorksheet("商品预览", { views: [{ state: "frozen", ySplit: 1 }] });
  const previewColumns = ["source_row", "status", "operation", "sku", "name", "brand", "category", "catalog_department", "b2b_price", "retail_price", "cost_price", "issues", "warnings"];
  products.columns = previewColumns.map((key) => ({ header: key, key, width: key === "issues" || key === "warnings" ? 60 : 20 }));
  products.addRows(preview.rows.map((row) => ({
    source_row: row.rowNumber,
    status: row.status,
    operation: row.operation,
    sku: row.sku,
    name: row.normalized.name,
    brand: row.normalized.brand,
    category: row.normalized.category,
    catalog_department: row.normalized.catalog_department,
    b2b_price: row.normalized.b2b_price,
    retail_price: row.normalized.retail_price,
    cost_price: row.normalized.cost_price,
    issues: row.issues.join("; "),
    warnings: row.warnings.join("; "),
  })));
  styleHeader(products.getRow(1), "FF0F766E");
  products.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: previewColumns.length } };

  const changes = workbook.addWorksheet("字段变更", { views: [{ state: "frozen", ySplit: 1 }] });
  changes.columns = [
    { header: "source_row", key: "source_row", width: 14 },
    { header: "sku", key: "sku", width: 24 },
    { header: "field", key: "field", width: 24 },
    { header: "current_value", key: "current_value", width: 42 },
    { header: "proposed_value", key: "proposed_value", width: 42 },
  ];
  changes.addRows(preview.rows.flatMap((row) => row.changes.map((change) => ({ source_row: row.rowNumber, sku: row.sku, field: change.field, current_value: change.currentValue, proposed_value: change.nextValue }))));
  styleHeader(changes.getRow(1), "FF334155");

  const errors = workbook.addWorksheet("错误与提醒", { views: [{ state: "frozen", ySplit: 1 }] });
  errors.columns = [
    { header: "source_row", key: "source_row", width: 14 },
    { header: "severity", key: "severity", width: 14 },
    { header: "sku", key: "sku", width: 24 },
    { header: "message", key: "message", width: 100 },
  ];
  errors.addRows(preview.rows.flatMap((row) => [
    ...row.issues.map((message) => ({ source_row: row.rowNumber, severity: "blocked", sku: row.sku, message })),
    ...row.warnings.map((message) => ({ source_row: row.rowNumber, severity: "warning", sku: row.sku, message })),
  ]));
  styleHeader(errors.getRow(1), "FFB91C1C");

  const normalized = workbook.addWorksheet("标准化数据", { views: [{ state: "frozen", ySplit: 1 }] });
  normalized.columns = productImportColumns.map((key) => ({ header: key, key, width: columnWidth(key) }));
  normalized.addRows(preview.rows.map((row) => row.normalized));
  styleHeader(normalized.getRow(1), "FF0F766E");
  normalized.getColumn("sku").numFmt = "@";

  const guide = workbook.addWorksheet("字段说明");
  guide.columns = guideColumns();
  guide.addRows(fieldGuideRows());
  styleHeader(guide.getRow(1), "FF334155");
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function guideColumns() {
  return [
    { header: "字段", key: "field", width: 28 },
    { header: "中文说明", key: "label", width: 24 },
    { header: "必填条件", key: "required", width: 25 },
    { header: "格式/可选值", key: "format", width: 42 },
    { header: "默认值", key: "default", width: 20 },
  ];
}

function fieldGuideRows() {
  const rows: Record<ProductImportColumn, [string, string, string, string]> = {
    operation: ["操作方式", "可选", "auto/create/update/skip", "auto"],
    sku: ["SKU/EAN", "每行必填", "2–64 位 A-Z、数字、_+.-", ""],
    name: ["商品名称", "新建必填", "2–180 字符", ""],
    catalog_department: ["商品部门", "新建必填", "phone/tablet/computer/general_merchandise", ""],
    category: ["分类", "新建必填", "2–80 字符", ""],
    brand: ["品牌", "新建必填", "1–80 字符", ""],
    model: ["型号", "推荐", "最多 120 字符", ""],
    model_code: ["主型号代码", "可选", "最多 120 字符", ""],
    model_codes: ["型号代码列表", "可选", "多个值用 ; 分隔", ""],
    compatibility_models: ["兼容型号", "推荐", "多个值用 ; 分隔", ""],
    grade: ["品质", "可选", "A+/A/B/Refurbished", "A"],
    cost_price: ["成本价", "可选", "0–100000", "0"],
    b2b_price: ["批发价", "可选", "0–100000", "0"],
    retail_price: ["零售价", "可选", "0–100000", "等于批发价"],
    vat_mode: ["VAT 模式", "可选", "最多 40 字符", "IVA esclusa"],
    moq: ["最低订购量", "可选", "整数 1–10000", "1"],
    warranty_days: ["保修天数", "可选", "整数 0–3650", "180"],
    weight_gram: ["重量（克）", "可选", "整数 0–100000", "0"],
    warehouse: ["仓库", "可选", "当前只能 Milano", "Milano"],
    supplier: ["供应商", "可选", "最多 120 字符", ""],
    batch_code: ["批次", "可选", "最多 80 字符", ""],
    tags: ["标签", "可选", "多个值用 ; 分隔", ""],
    row_note: ["行备注", "可选", "进入审计原因", ""],
  };
  return productImportColumns.map((field) => ({ field, label: rows[field][0], required: rows[field][1], format: rows[field][2], default: rows[field][3] }));
}

async function readSpreadsheetRows(buffer: Buffer, fileName: string): Promise<SpreadsheetRow[]> {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "csv") {
    return parseProductImportDelimited(buffer.toString("utf8").replace(/^\uFEFF/, ""))
      .map((values, index) => ({ rowNumber: index + 1, values }));
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
  const worksheet = workbook.getWorksheet("商品导入") ?? workbook.worksheets[0];
  if (!worksheet) throw new ProductImportError("Excel 文件中没有工作表。");
  if (worksheet.rowCount > maxRows + 1 || worksheet.columnCount > maxColumns) {
    throw new ProductImportError(`Excel 工作表最多允许 ${maxRows} 行商品和 ${maxColumns} 列。`);
  }
  const rows: SpreadsheetRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    for (let column = 1; column <= row.cellCount; column += 1) values.push(cellText(row.getCell(column).value));
    rows.push({ rowNumber: row.number, values });
  });
  return rows;
}

function validateFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (!extension || !allowedExtensions.has(extension)) throw new ProductImportError("请选择 .xlsx 或 .csv 文件。");
  if (file.size <= 0 || file.size > maxFileBytes) throw new ProductImportError("文件大小必须在 1 byte 到 5MB 之间。");
}

function validateTextFields(raw: Record<ProductImportColumn, string>, issues: string[]) {
  const fields: Array<[ProductImportColumn, number, number]> = [
    ["name", 2, 180], ["category", 2, 80], ["brand", 1, 80], ["model", 1, 120],
    ["model_code", 1, 120], ["vat_mode", 1, 40], ["supplier", 1, 120],
    ["batch_code", 1, 80], ["row_note", 1, 500],
  ];
  for (const [field, min, max] of fields) {
    const value = raw[field].trim();
    if (value && (value.length < min || value.length > max)) issues.push(`${field} 必须为 ${min}–${max} 字符`);
  }
}

function validateLists(raw: Record<ProductImportColumn, string>, issues: string[]) {
  const fields: ProductImportColumn[] = ["model_codes", "compatibility_models", "tags"];
  for (const field of fields) {
    const values = splitProductImportList(raw[field]);
    if (values.length > 100) issues.push(`${field} 最多包含 100 个值`);
    if (values.some((value) => value.length > 120)) issues.push(`${field} 的每个值最多 120 字符`);
  }
}

function emptyNormalizedRow() {
  return Object.fromEntries(productImportColumns.map((column) => [column, ""])) as Record<ProductImportColumn, string>;
}
function resolveHeader(value: string): ProductImportColumn | null {
  if (isProductImportColumn(value)) return value;
  return headerAliases[value] ?? headerAliases[value.replace(/_/g, "")] ?? null;
}
function isProductImportColumn(value: string | null): value is ProductImportColumn { return Boolean(value && productImportColumns.includes(value as ProductImportColumn)); }
function optionalText(value: string) { const result = value.trim(); return result || undefined; }
function rowReason(raw: Record<ProductImportColumn, string>) { return raw.row_note.trim() || "Updated from product Excel import."; }
function sha256(value: Buffer | string) { return createHash("sha256").update(value).digest("hex"); }
function stableValue(value: unknown) { return JSON.stringify(Array.isArray(value) ? [...value].sort() : value ?? null); }
function displayValue(value: unknown) { return Array.isArray(value) ? value.join("; ") : value === null || value === undefined ? "" : String(value); }
function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return String(value.result ?? "");
    if ("text" in value) return String(value.text ?? "");
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((item) => item.text).join("");
  }
  return String(value);
}
function enumValue(value: string, allowed: Set<string>, field: string, issues: string[]) {
  const normalized = value.trim();
  if (!allowed.has(normalized)) { issues.push(`${field} 的值无效：${normalized}`); return [...allowed][0]; }
  return normalized;
}
function optionalEnum(value: string, allowed: Set<string>, field: string, issues: string[]) {
  const normalized = value.trim();
  return normalized ? enumValue(normalized, allowed, field, issues) : undefined;
}
function optionalDecimal(value: string, field: string, issues: string[], min: number, max: number) {
  if (!value.trim()) return undefined;
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) { issues.push(`${field} 必须为 ${min}–${max} 的数字`); return undefined; }
  return Math.round(parsed * 100) / 100;
}
function optionalInteger(value: string, field: string, issues: string[], min: number, max: number) {
  if (!value.trim()) return undefined;
  const parsed = Number(value.trim().replace(",", "."));
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) { issues.push(`${field} 必须为 ${min}–${max} 的整数`); return undefined; }
  return parsed;
}
function assignText<T extends Record<string, unknown>>(target: T, key: keyof T, value: string) { if (value.trim()) target[key] = value.trim() as T[keyof T]; }
function assignList<T extends Record<string, unknown>>(target: T, key: keyof T, value: string) { if (value.trim()) target[key] = splitProductImportList(value) as T[keyof T]; }
function styleHeader(row: ExcelJS.Row, argb: string) { row.font = { bold: true, color: { argb: "FFFFFFFF" } }; row.fill = { type: "pattern", pattern: "solid", fgColor: { argb } }; row.alignment = { vertical: "middle", wrapText: true }; row.height = 28; }
function columnWidth(key: ProductImportColumn) { return ["name", "compatibility_models", "row_note"].includes(key) ? 34 : Math.max(14, key.length + 3); }
function addListValidation(sheet: ExcelJS.Worksheet, key: ProductImportColumn, formula: string) {
  const column = productImportColumns.indexOf(key) + 1;
  for (let row = 2; row <= maxRows + 1; row += 1) sheet.getCell(row, column).dataValidation = { type: "list", allowBlank: true, formulae: [formula] };
}
