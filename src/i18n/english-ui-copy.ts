import { englishLiteralCopy } from "./english-literals";

/** Only pass fixed UI copy. Customer names, addresses, products and notes stay original. */
export function englishUiCopy<T>(copy: T): T {
  if (typeof copy === "string") return (englishLiteralCopy[copy] ?? copy) as T;
  if (Array.isArray(copy)) return copy.map(item => englishUiCopy(item)) as T;
  if (copy && typeof copy === "object" && Object.prototype.toString.call(copy) === "[object Object]") {
    return Object.fromEntries(Object.entries(copy).map(([key, value]) => [key, englishUiCopy(value)])) as T;
  }
  return copy;
}

/** Translate static template parts; insert original business values afterwards. */
export function englishUiTemplate(parts: TemplateStringsArray, ...values: unknown[]) {
  const key = parts.reduce((text, part, index) => text + (index ? `{${index - 1}}` : "") + part, "");
  const template = englishLiteralCopy[key] ?? key;
  return template.replace(/\{(\d+)\}/g, (token, index) => Number(index) < values.length ? String(values[Number(index)]) : token);
}
