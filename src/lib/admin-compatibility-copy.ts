export function compatibilityReasonLabel(code: string, italian: boolean) {
  const labels: Record<string, [string, string]> = {
    MULTI_BRAND_TITLE: ["标题包含多个品牌，请核对同一配件是否通用", "Più brand nel titolo: verifica la compatibilità dello stesso ricambio"],
    MULTI_MODEL_TITLE: ["标题包含多个型号，请逐个核对适配范围", "Più modelli nel titolo: verifica ogni modello"],
    STRUCTURED_MODELS_INCOMPLETE: ["已登记型号未覆盖标题中的全部型号", "I modelli registrati non coprono tutti quelli del titolo"],
  };
  return labels[code]?.[italian ? 1 : 0] ?? (italian ? "Compatibilità da verificare manualmente" : "需人工核对兼容性");
}
export function compatibilitySignalLabel(signal: unknown, italian: boolean) {
  if (typeof signal !== "string") return italian ? "Evidenza da verificare" : "待核对证据";
  return signal.replace(/^title brands:/, italian ? "Brand nel titolo:" : "标题品牌：").replace(/^title models:/, italian ? "Modelli nel titolo:" : "标题型号：").replace(/^structured models:/, italian ? "Modelli registrati:" : "已登记型号：").replace(/\bnone\b/g, italian ? "nessuno" : "无");
}
