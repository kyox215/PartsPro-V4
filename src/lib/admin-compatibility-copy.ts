function languageIndex(language: boolean | string) {
  return typeof language === "boolean" ? (language ? 1 : 0) : language.startsWith("zh") ? 0 : language.startsWith("it") ? 1 : 2;
}
export function compatibilityReasonLabel(code: string, language: boolean | string) {
  const index = languageIndex(language);
  const labels: Record<string, [string, string, string]> = {
    MULTI_BRAND_TITLE: ["标题包含多个品牌，请核对同一配件是否通用", "Più brand nel titolo: verifica la compatibilità dello stesso ricambio", "Multiple brands in the title: check whether the same part is compatible"],
    MULTI_MODEL_TITLE: ["标题包含多个型号，请逐个核对适配范围", "Più modelli nel titolo: verifica ogni modello", "Multiple models in the title: check each model"],
    STRUCTURED_MODELS_INCOMPLETE: ["已登记型号未覆盖标题中的全部型号", "I modelli registrati non coprono tutti quelli del titolo", "Registered models do not cover all models in the title"],
  };
  return labels[code]?.[index] ?? ["需人工核对兼容性", "Compatibilità da verificare manualmente", "Compatibility requires manual review"][index];
}
export function compatibilitySignalLabel(signal: unknown, language: boolean | string) {
  const index = languageIndex(language);
  if (typeof signal !== "string") return ["待核对证据", "Evidenza da verificare", "Evidence to review"][index];
  return signal.replace(/^title brands:/, ["标题品牌：", "Brand nel titolo:", "Title brands:"][index]).replace(/^title models:/, ["标题型号：", "Modelli nel titolo:", "Title models:"][index]).replace(/^structured models:/, ["已登记型号：", "Modelli registrati:", "Registered models:"][index]).replace(/\bnone\b/g, ["无", "nessuno", "none"][index]);
}
