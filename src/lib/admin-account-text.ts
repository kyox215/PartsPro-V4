import { accountText as bilingualText } from "./admin-account-copy.mjs";
import { englishUiCopy } from "@/i18n/english-ui-copy";
export function accountText(value: string, locale: string) {
  return locale.startsWith("en") ? englishUiCopy(bilingualText(value, "it-IT")) : bilingualText(value, locale);
}
export function accountTemplate(parts: readonly string[], values: readonly unknown[], locale: string) {
  return parts.map((part, index) => accountText(part, locale) + (index < values.length ? String(values[index] ?? "") : "")).join("");
}
