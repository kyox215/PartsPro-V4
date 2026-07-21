import { toPublicSkuCore } from "./partspro-sku-core.mjs";

export function normalizeProductImportHeader(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normalizeProductImportSku(value) {
  return toPublicSkuCore(String(value ?? ""));
}

export function splitProductImportList(value) {
  return [...new Set(String(value ?? "").split(/[;\n]/).map((item) => item.trim()).filter(Boolean))];
}

export function shouldSkipProductImportUpdate(operation, changeCount, issueCount) {
  return operation === "update" && changeCount === 0 && issueCount === 0;
}

export function parseProductImportDelimited(input) {
  const text = String(input ?? "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}
