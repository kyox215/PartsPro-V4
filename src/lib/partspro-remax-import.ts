import "server-only";

import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { z } from "zod";

export const remaxTemplateColumns = [
  "sku",
  "ean",
  "supplier_sku",
  "name",
  "model",
  "model_codes",
  "compatibility_models",
  "category",
  "grade",
  "qty_ordered",
  "buffer_qty",
  "cost_price",
  "retail_price",
  "b2b_price",
  "image_url",
  "image_alt",
  "moq",
  "warranty_days",
  "publish",
  "notes",
] as const;

const requiredHeaders = new Set([
  "name",
  "qty_ordered",
  "cost_price",
  "retail_price",
  "b2b_price",
  "publish",
]);
const maxFileBytes = 5 * 1024 * 1024;
const maxRows = 500;

const importSettingsSchema = z
  .object({
    batchCode: z.string().trim().min(3).max(80).transform((value) => value.toUpperCase()),
    closeAt: z.string().trim().datetime({ offset: true }).nullable().optional(),
    currency: z.string().trim().length(3).default("EUR").transform((value) => value.toUpperCase()),
    etaEnd: z.string().date(),
    etaStart: z.string().date(),
    location: z.string().trim().min(1).max(120).default("Milano"),
    orderNo: z.string().trim().max(120).nullable().optional(),
    supplierName: z.string().trim().min(1).max(160).default("REMAX"),
    terms: z.string().trim().min(20).max(1200),
    vatMode: z.string().trim().min(1).max(80).default("IVA esclusa"),
  })
  .strict()
  .refine((value) => value.etaEnd >= value.etaStart, {
    message: "La data ETA finale deve essere uguale o successiva alla data iniziale.",
    path: ["etaEnd"],
  });

export type RemaxImportSettings = z.infer<typeof importSettingsSchema>;

export type RemaxImportLine = {
  b2bPrice: number;
  bufferQty: number;
  category: string;
  compatibilityModels: string[];
  costPrice: number;
  ean: string | null;
  grade: string;
  imageAlt: string | null;
  imageUrl: string | null;
  model: string | null;
  modelCodes: string[];
  moq: number;
  name: string;
  notes: string | null;
  publish: boolean;
  qtyOrdered: number;
  retailPrice: number;
  sku: string;
  supplierSku: string | null;
  warrantyDays: number;
};

export type RemaxImportPreviewRow = RemaxImportLine & {
  issues: string[];
  rowNumber: number;
  status: "ready" | "draft" | "blocked";
};

export type RemaxImportPayload = RemaxImportSettings & {
  idempotencyKey: string;
  lines: RemaxImportLine[];
  sourceFileName: string;
  sourceHash: string;
  supplierCode: "REMAX";
};

export type RemaxImportPreview = {
  counts: {
    blocked: number;
    draft: number;
    ready: number;
    total: number;
  };
  payload: RemaxImportPayload;
  previewHash: string;
  rows: RemaxImportPreviewRow[];
  sourceFileName: string;
  sourceHash: string;
};

export class RemaxImportError extends Error {
  constructor(
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "RemaxImportError";
  }
}

export function parseRemaxImportSettings(value: unknown) {
  const parsed = importSettingsSchema.safeParse(value);

  if (!parsed.success) {
    throw new RemaxImportError("Le impostazioni del lotto non sono valide.", {
      issues: parsed.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join("."),
      })),
    });
  }

  return parsed.data;
}

export async function buildRemaxTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PartsPro";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("REMAX Preordini");
  sheet.columns = remaxTemplateColumns.map((key) => ({
    header: key,
    key,
    width: Math.max(14, key.length + 3),
  }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: remaxTemplateColumns.length },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7E22CE" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
  sheet.addRow({
    sku: "REMAX-RPP-680",
    ean: "6954851200000",
    supplier_sku: "RPP-680",
    name: "REMAX Power Bank 20000mAh",
    model: "RPP-680",
    model_codes: "RPP-680",
    compatibility_models: "USB-C;Lightning",
    category: "Batterie esterne",
    grade: "A",
    qty_ordered: 30,
    buffer_qty: 2,
    cost_price: 12.5,
    retail_price: 24.9,
    b2b_price: 19.9,
    image_url: "https://example.com/remax-rpp-680.jpg",
    image_alt: "REMAX RPP-680 Power Bank",
    moq: 1,
    warranty_days: 180,
    publish: "yes",
    notes: "Riga di esempio: cancellare prima dell'importazione reale.",
  });

  const guide = workbook.addWorksheet("Istruzioni");
  guide.columns = [
    { header: "Campo", key: "field", width: 28 },
    { header: "Come compilarlo", key: "help", width: 78 },
  ];
  guide.addRows([
    { field: "Regola base", help: "Una riga = un prodotto REMAX. Non modificare i nomi delle colonne." },
    { field: "publish", help: "yes/no. yes richiede modello, immagine, prezzo retail e prezzo B2B." },
    { field: "qty_ordered", help: "Quantità ordinata al fornitore; non viene aggiunta allo stock finché non registri l'arrivo." },
    { field: "buffer_qty", help: "Quantità non prenotabile tenuta come margine. Deve essere inferiore a qty_ordered." },
    { field: "model_codes", help: "Più valori separati da punto e virgola (;)." },
    { field: "compatibility_models", help: "Più valori separati da punto e virgola (;)." },
    { field: "prezzi", help: "Usare numeri senza simbolo euro. I prezzi non vengono calcolati automaticamente." },
  ]);
  guide.getRow(1).font = { bold: true };
  guide.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEDE9FE" },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function previewRemaxImport(
  file: File,
  settings: RemaxImportSettings
): Promise<RemaxImportPreview> {
  validateFile(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const sourceHash = sha256(buffer);
  const rawRows = await readSpreadsheetRows(buffer, file.name);

  if (rawRows.length === 0) {
    throw new RemaxImportError("Il file non contiene righe prodotto.");
  }

  if (rawRows.length > maxRows) {
    throw new RemaxImportError(`Il file supera il limite di ${maxRows} righe.`);
  }

  const seenSkus = new Map<string, number>();
  const seenEans = new Map<string, number>();
  const rows = rawRows.map((raw, index) =>
    normalizeRow(raw, index + 2, seenSkus, seenEans)
  );
  const blocked = rows.filter((row) => row.status === "blocked").length;
  const draft = rows.filter((row) => row.status === "draft").length;
  const ready = rows.filter((row) => row.status === "ready").length;
  const payload: RemaxImportPayload = {
    ...settings,
    closeAt: settings.closeAt ?? null,
    idempotencyKey: `remax:${settings.batchCode}:${sourceHash}`,
    lines: rows.map(toImportLine),
    orderNo: settings.orderNo ?? null,
    sourceFileName: file.name.slice(0, 240),
    sourceHash,
    supplierCode: "REMAX",
  };

  return {
    counts: { blocked, draft, ready, total: rows.length },
    payload,
    previewHash: sha256(JSON.stringify(payload)),
    rows,
    sourceFileName: file.name,
    sourceHash,
  };
}

function validateFile(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();

  if (!extension || !["xlsx", "csv"].includes(extension)) {
    throw new RemaxImportError("Carica un file .xlsx oppure .csv.");
  }

  if (file.size <= 0 || file.size > maxFileBytes) {
    throw new RemaxImportError("Il file deve essere compreso tra 1 byte e 5 MB.");
  }
}

async function readSpreadsheetRows(buffer: Buffer, fileName: string) {
  const extension = fileName.toLowerCase().split(".").pop();

  if (extension === "csv") {
    return rowsFromMatrix(parseCsv(buffer.toString("utf8").replace(/^\uFEFF/, "")));
  }

  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  await workbook.xlsx.load(excelBuffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new RemaxImportError("Il file Excel non contiene fogli.");
  }

  const matrix: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    const lastColumn = Math.max(row.cellCount, remaxTemplateColumns.length);

    for (let column = 1; column <= lastColumn; column += 1) {
      values.push(cellText(row.getCell(column).value));
    }

    matrix.push(values);
  });

  return rowsFromMatrix(matrix);
}

function rowsFromMatrix(matrix: string[][]) {
  const [headerRow, ...body] = matrix;

  if (!headerRow) {
    throw new RemaxImportError("Il file non contiene una riga intestazione.");
  }

  const headers = headerRow.map(normalizeHeader);
  const missing = [...requiredHeaders].filter((header) => !headers.includes(header));

  if (missing.length > 0) {
    throw new RemaxImportError("Mancano colonne obbligatorie nel file.", { missing });
  }

  return body
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]))
    )
    .filter((row) => Object.values(row).some(Boolean));
}

function normalizeRow(
  raw: Record<string, string>,
  rowNumber: number,
  seenSkus: Map<string, number>,
  seenEans: Map<string, number>
): RemaxImportPreviewRow {
  const issues: string[] = [];
  const name = textValue(raw.name);
  const ean = optionalValue(raw.ean);
  const supplierSku = optionalValue(raw.supplier_sku)?.toUpperCase() ?? null;
  const sku = (optionalValue(raw.sku) ?? buildFallbackSku(ean, supplierSku, name, rowNumber))
    .toUpperCase()
    .replace(/[^A-Z0-9_+.-]+/g, "-")
    .slice(0, 64);
  const qtyOrdered = integerValue(raw.qty_ordered, "qty_ordered", issues, 1, 999999);
  const bufferQty = integerValue(raw.buffer_qty || "0", "buffer_qty", issues, 0, 999998);
  const costPrice = decimalValue(raw.cost_price, "cost_price", issues, 0);
  const retailPrice = decimalValue(raw.retail_price, "retail_price", issues, 0);
  const b2bPrice = decimalValue(raw.b2b_price, "b2b_price", issues, 0);
  const moq = integerValue(raw.moq || "1", "moq", issues, 1, 9999);
  const warrantyDays = integerValue(raw.warranty_days || "180", "warranty_days", issues, 1, 3650);
  const publish = booleanValue(raw.publish, issues);
  const model = optionalValue(raw.model);
  const imageUrl = optionalValue(raw.image_url);

  if (!name) {
    issues.push("name è obbligatorio");
  }
  if (!sku) {
    issues.push("sku non può essere generato");
  }
  if (bufferQty >= qtyOrdered) {
    issues.push("buffer_qty deve essere inferiore a qty_ordered");
  }
  if (publish && (!model || !imageUrl || retailPrice <= 0 || b2bPrice <= 0)) {
    issues.push("publish=yes richiede modello, immagine e prezzi retail/B2B maggiori di zero");
  }

  recordDuplicate(seenSkus, sku, rowNumber, "SKU", issues);
  if (ean) {
    recordDuplicate(seenEans, ean, rowNumber, "EAN", issues);
  }

  return {
    b2bPrice,
    bufferQty,
    category: optionalValue(raw.category) ?? "Accessori",
    compatibilityModels: listValue(raw.compatibility_models),
    costPrice,
    ean,
    grade: optionalValue(raw.grade) ?? "A",
    imageAlt: optionalValue(raw.image_alt),
    imageUrl,
    issues,
    model,
    modelCodes: listValue(raw.model_codes).map((value) => value.toUpperCase()),
    moq,
    name,
    notes: optionalValue(raw.notes),
    publish,
    qtyOrdered,
    retailPrice,
    rowNumber,
    sku,
    status: issues.length > 0 ? "blocked" : publish ? "ready" : "draft",
    supplierSku,
    warrantyDays,
  };
}

function toImportLine(row: RemaxImportPreviewRow): RemaxImportLine {
  return {
    b2bPrice: row.b2bPrice,
    bufferQty: row.bufferQty,
    category: row.category,
    compatibilityModels: row.compatibilityModels,
    costPrice: row.costPrice,
    ean: row.ean,
    grade: row.grade,
    imageAlt: row.imageAlt,
    imageUrl: row.imageUrl,
    model: row.model,
    modelCodes: row.modelCodes,
    moq: row.moq,
    name: row.name,
    notes: row.notes,
    publish: row.publish,
    qtyOrdered: row.qtyOrdered,
    retailPrice: row.retailPrice,
    sku: row.sku,
    supplierSku: row.supplierSku,
    warrantyDays: row.warrantyDays,
  };
}

function recordDuplicate(
  seen: Map<string, number>,
  value: string,
  rowNumber: number,
  label: string,
  issues: string[]
) {
  const previous = seen.get(value);
  if (previous) {
    issues.push(`${label} duplicato (già presente alla riga ${previous})`);
  } else {
    seen.set(value, rowNumber);
  }
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }
  return rows;
}

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return String(value.result ?? "");
    if ("text" in value) return String(value.text ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text).join("");
    }
  }
  return String(value);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function textValue(value: string | undefined) {
  return value?.trim().slice(0, 240) ?? "";
}

function optionalValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function listValue(value: string | undefined) {
  return [...new Set((value ?? "").split(/[;,\n]/).map((item) => item.trim()).filter(Boolean))];
}

function integerValue(
  value: string,
  field: string,
  issues: string[],
  minimum: number,
  maximum: number
) {
  const number = Number(value.replace(",", "."));
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    issues.push(`${field} deve essere un intero tra ${minimum} e ${maximum}`);
    return minimum;
  }
  return number;
}

function decimalValue(value: string, field: string, issues: string[], minimum: number) {
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number) || number < minimum || number > 9999999) {
    issues.push(`${field} deve essere un numero valido maggiore o uguale a ${minimum}`);
    return minimum;
  }
  return Math.round(number * 100) / 100;
}

function booleanValue(value: string | undefined, issues: string[]) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (["yes", "y", "true", "1", "si", "sì"].includes(normalized)) return true;
  if (["no", "n", "false", "0"].includes(normalized)) return false;
  issues.push("publish deve essere yes oppure no");
  return false;
}

function buildFallbackSku(
  ean: string | null,
  supplierSku: string | null,
  name: string,
  rowNumber: number
) {
  const source = ean ?? supplierSku ?? `${name}-${rowNumber}`;
  return `REMAX-${source}`;
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
