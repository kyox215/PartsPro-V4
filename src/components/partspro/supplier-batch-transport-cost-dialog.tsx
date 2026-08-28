"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  formatSupplierBatchCents,
  formatSupplierBatchDualCents,
  normalizeSupplierBatchCurrency,
  readSupplierBatchMoneyCents,
  SUPPLIER_BATCH_CURRENCIES,
  type SupplierBatchCurrency,
} from "@/lib/partspro-supplier-batch-money";
import {
  normalizeSupplierBatchCostRpcResult,
  normalizeSupplierBatchCorrectionReceipt,
  type SupplierBatchAllocationMethod,
  type SupplierBatchCharge,
  type SupplierBatchChargeType,
  type SupplierBatchCostRpcResult,
  type SupplierBatchCostRpcPreviewResult,
  type SupplierBatchCorrectionResult,
  type SupplierBatchVatTreatment,
} from "@/lib/partspro-supplier-batch-cost-core.mjs";
import * as supplierBatchChargeSchemaModule from "@/lib/partspro-supplier-batch-cost-input-schema.mjs";
import {
  formatSupplierBatchUnitCost,
  type SupplierBatchCostDetail,
  type SupplierBatchChargeView,
  type SupplierBatchCostLanguage,
  type SupplierBatchHistoryEntry,
} from "./supplier-batch-transport-cost-card";

export type SupplierBatchChargeDialogMode = "create" | "edit" | "correction";

export type SupplierBatchChargeFormValues = {
  allocationMethod: SupplierBatchAllocationMethod;
  amountNet: string;
  capitalizedAmount: string;
  carrierName: string;
  chargeType: SupplierBatchChargeType;
  correctionReason: string;
  evidenceUrl: string;
  notes: string;
  occurredAt: string;
  reference: string;
  vatAmount: string;
  vatTreatment: SupplierBatchVatTreatment;
  zeroCostReason: string;
  currency: SupplierBatchCurrency;
  fxRateToEur: string;
  fxRateDate: string;
  fxRateSource: string;
  fxEvidenceUrl: string;
  batchGoodsValueFxRateToEur: string;
  batchGoodsValueFxDate: string;
  batchGoodsValueFxSource: string;
  batchGoodsValueFxEvidenceUrl: string;
};

export type SupplierBatchMoneyParseResult = {
  cents: number | null;
  error: "format" | "required" | null;
  value: number | null;
};

export type SupplierBatchFxRateParseResult = {
  value: number | null;
  error: "format" | "required" | "invalid" | null;
};

export type SupplierBatchDateTimeLocalResult = {
  error: "invalid" | null;
  value: string | null;
};

export type SupplierBatchChargeFormResult = {
  form: SupplierBatchChargeFormValues;
  manualAmounts: Record<string, string>;
};

export type SupplierBatchChargePayloadBuildResult = {
  fieldErrors: Record<string, string>;
  payload: Record<string, unknown> | null;
};

export type SupplierBatchSchemaFieldIssue = {
  code?: string;
  message: string;
  path: PropertyKey[];
};

export type SupplierBatchManualAllocationSummary = {
  capitalizedCents: number | null;
  differenceCents: number | null;
  invalidCount: number;
  rows: Array<{ amount: number; amountCents: number; batchLineId: string }>;
  totalCents: number;
};

const CHARGE_TYPES: readonly SupplierBatchChargeType[] = [
  "transport",
  "insurance",
  "customs",
  "handling",
  "other",
];
const ALLOCATION_METHODS: readonly SupplierBatchAllocationMethod[] = [
  "goods_value",
  "received_qty",
  "weight",
  "manual",
];
const VAT_TREATMENTS: readonly SupplierBatchVatTreatment[] = [
  "recoverable",
  "non_recoverable",
  "unknown",
];
const MAX_MANUAL_ROWS = 500;

type SupplierBatchSchemaLike = {
  safeParse: (value: unknown) =>
    | { success: true; data: Record<string, unknown> }
    | { success: false; error: { issues: readonly SupplierBatchSchemaFieldIssue[] } };
};

/*
 * Keep the client compatible with the legacy declaration file while the V2
 * runtime schema adds original-currency and immutable-FX fields. The backend
 * worker owns the generated declaration; reading the V2 exports by key lets
 * this UI compile against either side of that hand-off and still fail closed
 * when a schema is unavailable.
 */
const supplierBatchSchemaExports = supplierBatchChargeSchemaModule as unknown as Record<
  string,
  SupplierBatchSchemaLike | undefined
>;
const supplierBatchChargePreviewSchemaV2 =
  supplierBatchSchemaExports.supplierBatchChargeV2PreviewSchema ??
  (supplierBatchChargeSchemaModule.supplierBatchChargePreviewSchema as unknown as SupplierBatchSchemaLike);
const supplierBatchChargeEstimateSchemaV2 =
  supplierBatchSchemaExports.supplierBatchChargeV2EstimateSchema ??
  (supplierBatchChargeSchemaModule.supplierBatchChargeEstimateSchema as unknown as SupplierBatchSchemaLike);
const supplierBatchChargeConfirmSchemaV2 =
  supplierBatchSchemaExports.supplierBatchChargeV2ConfirmSchema ??
  (supplierBatchChargeSchemaModule.supplierBatchChargeConfirmSchema as unknown as SupplierBatchSchemaLike);
const supplierBatchChargeCorrectSchemaV2 =
  supplierBatchSchemaExports.supplierBatchChargeV2CorrectSchema ??
  supplierBatchChargeConfirmSchemaV2;

const copy = {
  zh: {
    title: "登记运输 / 到货费用",
    editTitle: "编辑预估费用",
    description: "填写账单金额，确认计入商品成本的金额，再预览每个商品的分摊。预览不会保存数据。关闭后本次未保存草稿不会保留。",
    step1Title: "1. 填写账单",
    step1Description: "先录入供应商账单上的金额和币种。",
    step2Title: "2. 确认计入商品成本",
    step2Description: "选择真正要分摊到商品落地成本的金额和方式。",
    step3Title: "3. 补充凭证（选填）",
    step3Description: "需要时再展开，补充承运商、单号和凭证。",
    chargeType: "费用类型",
    amountNet: "未税金额",
    vatAmount: "IVA",
    gross: "含税总额（自动）",
    capitalizedAmount: "计入商品成本",
    capitalizedHelp: "此金额会计入商品落地成本，不改变售价和库存。",
    useNetAmount: "使用未税金额",
    useGrossAmount: "使用含税总额",
    currency: "币种",
    currencyHelp: "金额按原币录入；EUR 本位币会由服务端按快照计算。",
    fxRateToEur: "汇率（原币 → EUR）",
    fxRateDate: "汇率日期",
    fxRateSource: "汇率来源",
    fxEvidenceUrl: "费用汇率证据 URL",
    fxRequired: "USD/CNY 必须填写汇率、日期和来源。",
    fxRateHelp: "例如 1 USD = 0.92 EUR；请使用最多 12 位小数。",
    fxRateInvalid: "汇率必须是大于 0 的数字。",
    fxDateInvalid: "请填写有效的汇率日期。",
    fxSourceInvalid: "请填写汇率来源。",
    fxEvidenceHelp: "可选；仅支持 http:// 或 https:// 链接。",
    goodsFxSnapshot: "商品货值汇率快照（批次）",
    goodsFxRateToEur: "商品货值汇率（原币 → EUR）",
    goodsFxDate: "商品货值汇率日期",
    goodsFxSource: "商品货值汇率来源",
    goodsFxEvidenceUrl: "商品货值汇率证据 URL",
    goodsFxRequired: "非 EUR 批次必须填写商品货值汇率、日期和来源；证据 URL 可选。",
    goodsFxLocked: "批次货值汇率快照已保存，只读不可修改。",
    amountHelp: "支持 1.23 或 1,23；不要输入千位分隔符。",
    vatPresets: "常用税率",
    vatPresetHelp: "辅助计算 IVA，提交时仍保存明确金额。",
    timezone: "时区 Europe/Rome",
    previewSummary: "预览对账",
    capitalized: "资本化",
    candidateTotal: "候选分摊",
    difference: "差额",
    currentConfirmed: "当前已确认",
    projectedTotal: "预计落地",
    rounding: "分摊舍入差额",
    correctionOtherTotal: "其他有效费用（不含原费用）",
    correctionBeforeTotal: "纠正前总成本（含原费用）",
    correctionReplacement: "替代新费用",
    correctionAfterTotal: "纠正后总成本",
    correctionCostDelta: "纠正成本变化（后−前）",
    validRows: "有效行",
    missingRows: "缺失行",
    confirmSummaryTitle: "确认正式成本",
    confirmSummaryDescription: "确认后记录将成为不可变事实；后续只能走纠错/冲正流程。请再次核对以下摘要。",
    confirmProceed: "确认并提交正式成本",
    confirmBack: "返回修改",
    draftGuardTitle: "存在未保存草稿",
    draftGuardDescription: "关闭将丢弃当前未保存字段和预览结果。",
    draftGuardKeep: "继续编辑",
    draftGuardDiscard: "丢弃并关闭",
    vatTreatment: "税额能否抵扣",
    allocationMethod: "怎么分到商品",
    carrierName: "承运商",
    reference: "参考号",
    occurredAt: "发生时间",
    evidenceUrl: "证据 URL",
    notes: "备注",
    zeroCostReason: "零成本原因",
    invalidUrl: "仅支持 http:// 或 https:// 链接。",
    zeroCostHelp: "资本化金额为 0 时必填。",
    manual: "手工分摊",
    preview: "预览分摊",
    nextStep: "下一步：查看分摊结果",
    cancel: "取消",
    correctionReason: "纠错理由",
    correctionReasonHelp: "正式成本不可直接修改；请填写本次纠错/冲正的业务理由。",
    correctionTitle: "纠错正式成本",
    correctionDescription: "纠错会保留原记录并建立关联链；请核对新金额和理由后提交。",
    correctionProceed: "确认提交纠错",
    correctionApplied: "冲正已应用；替代记录已建立。",
    correctionPending: "已提交纠错，待财务调整；历史成本未修改。",
    close: "关闭",
    noManage: "当前账号没有成本管理权限，表单不可用。",
    nonEstimatedCharge: "已确认或已取消的费用不可编辑；当前仅允许编辑预估费用。",
    saveEstimate: "保存为估算",
    confirm: "确认正式成本",
    retryMutation: "按同一草稿重试",
    verifyReadback: "回读核对",
    retryRefresh: "仅重试回读",
    required: "请填写此字段。",
    invalid: "格式不正确，请检查输入。",
    fixFields: "请先修正标记的字段。",
    previewRequired: "请先完成一次预览；字段变化后必须重新预览。",
    previewBlocked: "当前预览被阻止，需先处理复核原因。",
    previewReady: "预览通过；可保存为估算，或在 IVA 已确定且无复核阻止时确认正式成本。",
    confirmVatRequired: "确认正式成本前请选择可抵扣或不可抵扣 IVA，不能使用“未知”。",
    mutationTimeout: "提交超时，状态可能已改变；请按同一草稿重试或先回读核对，不会生成新的幂等键。",
    mutationUnknown: "提交状态暂时无法确认；请按同一草稿重试或先回读核对。",
    mutationNotFound: "回读未发现匹配记录；可先回读核对，或按同一草稿安全重试。",
    readbackConflict: "写入已返回成功，但回读发现同一幂等键内容不一致；请仅重试回读，不会再次提交。",
    readbackNotFound: "写入已返回成功，但回读暂未发现匹配记录；请仅重试回读，不会再次提交。",
    readbackTimeout: "回读超时；请重试回读核对，必要时按同一草稿重试。",
    readbackFailed: "回读失败；请重试回读核对，不会自动再次提交。",
    readbackInvalid: "回读数据无法核对；请稍后重试回读。",
    refreshPending: "已提交，正在回读最新批次数据。",
    refreshFailed: "已提交，但最新批次数据回读失败；请仅重试回读，不要重复提交。",
    manualHelp: "只显示实际到货数量大于 0 的行；每行金额合计必须等于资本化金额。",
    manualLimit: "手工分摊最多支持 500 个有效到货行，当前批次超出限制。",
    manualNone: "当前没有可用于手工分摊的到货行。",
    manualTotal: "手工合计",
    manualDifference: "与资本化金额差额",
    weightMissing: (count: number) => `有 ${count} 行缺少正重量；最终由预览接口拒绝或处理。`,
    weightMissingShort: "重量不完整",
    currentAllocation: "当前分摊",
    candidateAllocation: "本次候选",
    currentLandedLine: "当前落地行",
    projectedLandedLine: "预计落地行",
    currentLandedUnit: "当前落地单价",
    projectedLandedUnit: "预计落地单价",
    correctionCurrentAllocation: "其他有效分摊（不含原费用）",
    correctionCandidateAllocation: "替代费用分摊",
    correctionCurrentLandedLine: "其他有效落地行（不含原费用）",
    correctionProjectedLandedLine: "替代后有效落地行",
    correctionCurrentLandedUnit: "其他有效落地单价",
    correctionProjectedLandedUnit: "替代后有效落地单价",
    line: "行",
    sku: "SKU",
    productName: "商品",
    review: "复核提示",
    genericError: "成本操作暂时失败，请重试。",
    networkError: "网络或服务暂时不可用，请检查连接后重试。",
    timeout: "成本预览超时，请稍后重试。",
    refetchError: "操作已提交，但最新批次数据未能回读；请刷新后核对。",
    invalidResponse: "服务返回的数据无法通过校验，未更新页面成本。",
    unknown: "未知成本错误，请稍后重试。",
    typeLabels: {
      transport: "运输",
      insurance: "保险",
      customs: "关税",
      handling: "处理费",
      other: "其他",
    },
    allocationLabels: {
      goods_value: "商品货值占比",
      received_qty: "实际到货数量",
      weight: "重量",
      manual: "手工分摊",
    },
    vatLabels: {
      recoverable: "可抵扣",
      non_recoverable: "不可抵扣",
      unknown: "未知",
    },
  },
  it: {
    title: "Registra costo trasporto / arrivo",
    editTitle: "Modifica costo stimato",
    description: "Inserisci l'importo della fattura, conferma quanto va nel costo della merce e verifica la ripartizione per ogni prodotto. L'anteprima non salva dati. La bozza non salvata si perde alla chiusura.",
    step1Title: "1. Inserisci la fattura",
    step1Description: "Inserisci prima importo e valuta riportati sulla fattura del fornitore.",
    step2Title: "2. Conferma il costo della merce",
    step2Description: "Scegli l'importo e il criterio da includere nel costo sbarcato dei prodotti.",
    step3Title: "3. Dati aggiuntivi (facoltativi)",
    step3Description: "Apri solo se servono vettore, riferimento o documenti.",
    chargeType: "Tipo costo",
    amountNet: "Importo netto",
    vatAmount: "IVA",
    gross: "Totale lordo (automatico)",
    capitalizedAmount: "Costo incluso nella merce",
    capitalizedHelp: "Questo importo entra nel costo sbarcato dei prodotti; non cambia prezzi di vendita o disponibilità.",
    useNetAmount: "Usa importo netto",
    useGrossAmount: "Usa totale lordo",
    currency: "Valuta",
    currencyHelp: "Inserisci gli importi nella valuta originale; la base EUR usa lo snapshot del server.",
    fxRateToEur: "Cambio (valuta → EUR)",
    fxRateDate: "Data cambio",
    fxRateSource: "Fonte cambio",
    fxEvidenceUrl: "URL evidenza cambio costo",
    fxRequired: "Per USD/CNY servono cambio, data e fonte.",
    fxRateHelp: "Esempio: 1 USD = 0,92 EUR; sono accettate fino a 12 cifre decimali.",
    fxRateInvalid: "Il cambio deve essere un numero maggiore di 0.",
    fxDateInvalid: "Inserisci una data cambio valida.",
    fxSourceInvalid: "Inserisci la fonte del cambio.",
    fxEvidenceHelp: "Facoltativo; sono supportati solo link http:// o https://.",
    goodsFxSnapshot: "Snapshot cambio valore merce (lotto)",
    goodsFxRateToEur: "Cambio valore merce (valuta → EUR)",
    goodsFxDate: "Data cambio valore merce",
    goodsFxSource: "Fonte cambio valore merce",
    goodsFxEvidenceUrl: "URL evidenza cambio valore merce",
    goodsFxRequired: "Per un lotto non EUR servono cambio, data e fonte del valore merce; URL evidenza facoltativo.",
    goodsFxLocked: "Lo snapshot del cambio del valore merce è salvato e non modificabile.",
    amountHelp: "Sono validi 1.23 o 1,23; non usare separatori delle migliaia.",
    vatPresets: "Aliquote comuni",
    vatPresetHelp: "Aiuto per calcolare IVA; l'importo esplicito resta quello inviato.",
    timezone: "Fuso Europe/Rome",
    previewSummary: "Riconciliazione anteprima",
    capitalized: "Capitalizzato",
    candidateTotal: "Totale candidato",
    difference: "Differenza",
    currentConfirmed: "Confermato attuale",
    projectedTotal: "Sbarcato previsto",
    rounding: "Differenza arrotondamento ripartizione",
    correctionOtherTotal: "Altri costi effettivi (escluso l'originale)",
    correctionBeforeTotal: "Totale prima della rettifica (originale incluso)",
    correctionReplacement: "Nuovo costo sostitutivo",
    correctionAfterTotal: "Totale dopo la rettifica",
    correctionCostDelta: "Variazione costo rettifica (dopo−prima)",
    validRows: "Righe valide",
    missingRows: "Righe mancanti",
    confirmSummaryTitle: "Conferma costo definitivo",
    confirmSummaryDescription: "Dopo la conferma il record è immutabile; per correggerlo serve una rettifica/controstorno. Ricontrolla il riepilogo.",
    confirmProceed: "Conferma e invia costo",
    confirmBack: "Torna alla modifica",
    draftGuardTitle: "Bozza non salvata",
    draftGuardDescription: "La chiusura elimina i campi non salvati e l'anteprima.",
    draftGuardKeep: "Continua modifica",
    draftGuardDiscard: "Scarta e chiudi",
    vatTreatment: "IVA recuperabile?",
    allocationMethod: "Come ripartire sui prodotti",
    carrierName: "Vettore",
    reference: "Riferimento",
    occurredAt: "Data e ora",
    evidenceUrl: "URL evidenza",
    notes: "Note",
    zeroCostReason: "Motivo costo zero",
    invalidUrl: "Sono supportati solo link http:// o https://.",
    zeroCostHelp: "Obbligatorio quando l'importo capitalizzato è 0.",
    manual: "Ripartizione manuale",
    preview: "Anteprima ripartizione",
    nextStep: "Avanti: verifica ripartizione",
    cancel: "Annulla",
    correctionReason: "Motivo rettifica",
    correctionReasonHelp: "Il costo confermato non si modifica direttamente; indica il motivo operativo della rettifica.",
    correctionTitle: "Rettifica costo confermato",
    correctionDescription: "La rettifica conserva il record originale e crea una catena collegata; controlla importi e motivo.",
    correctionProceed: "Conferma rettifica",
    correctionApplied: "Rettifica applicata; il record sostitutivo è stato creato.",
    correctionPending: "Rettifica inviata, adeguamento finanziario richiesto; lo storico non è stato modificato.",
    close: "Chiudi",
    noManage: "L'account non dispone del permesso di gestione costi; il modulo è disabilitato.",
    nonEstimatedCharge: "Un costo confermato o annullato non è modificabile; solo le stime possono essere modificate.",
    saveEstimate: "Salva come stima",
    confirm: "Conferma costo definitivo",
    retryMutation: "Riprova con la stessa bozza",
    verifyReadback: "Verifica rilettura",
    retryRefresh: "Riprova solo rilettura",
    required: "Compila questo campo.",
    invalid: "Formato non valido; controlla il valore.",
    fixFields: "Correggi prima i campi evidenziati.",
    previewRequired: "Esegui prima un'anteprima; dopo ogni modifica serve una nuova anteprima.",
    previewBlocked: "L'anteprima è bloccata; risolvi prima il motivo di verifica.",
    previewReady: "Anteprima completata; puoi salvare la stima o confermare se l'IVA è definita e non ci sono blocchi.",
    confirmVatRequired: "Per confermare scegli IVA recuperabile o non recuperabile; “sconosciuto” non è ammesso.",
    mutationTimeout: "Invio scaduto; lo stato potrebbe essere cambiato. Riprova con la stessa bozza o rileggi prima; la chiave idempotente non cambia.",
    mutationUnknown: "Lo stato dell'invio non è verificabile; riprova con la stessa bozza o rileggi prima.",
    mutationNotFound: "La rilettura non trova un record corrispondente; verifica o riprova con la stessa bozza.",
    readbackConflict: "L'invio è riuscito, ma la rilettura mostra un contenuto diverso per la stessa chiave; riprova solo la rilettura.",
    readbackNotFound: "L'invio è riuscito, ma la rilettura non trova ancora il record; riprova solo la rilettura.",
    readbackTimeout: "Rilettura scaduta; riprova la verifica o, se necessario, l'invio con la stessa bozza.",
    readbackFailed: "Rilettura non riuscita; riprova la verifica, senza un nuovo invio automatico.",
    readbackInvalid: "I dati riletti non sono verificabili; riprova la rilettura.",
    refreshPending: "Inviato; rilettura dei dati aggiornati del lotto in corso.",
    refreshFailed: "Inviato, ma la rilettura del lotto non è riuscita; riprova solo la rilettura, senza un nuovo invio.",
    manualHelp: "Sono mostrate solo le righe ricevute con quantità > 0; il totale deve uguagliare l'importo capitalizzato.",
    manualLimit: "La ripartizione manuale supporta al massimo 500 righe ricevute; questo lotto supera il limite.",
    manualNone: "Non ci sono righe ricevute disponibili per la ripartizione manuale.",
    manualTotal: "Totale manuale",
    manualDifference: "Differenza dall'importo capitalizzato",
    weightMissing: (count: number) => `${count} righe non hanno un peso positivo; il rifiuto finale spetta all'anteprima API.`,
    weightMissingShort: "Peso incompleto",
    currentAllocation: "Ripartizione attuale",
    candidateAllocation: "Candidata",
    currentLandedLine: "Riga sbarcata attuale",
    projectedLandedLine: "Riga sbarcata prevista",
    currentLandedUnit: "Unitario sbarcato attuale",
    projectedLandedUnit: "Unitario sbarcato previsto",
    correctionCurrentAllocation: "Altra ripartizione effettiva (originale escluso)",
    correctionCandidateAllocation: "Ripartizione del costo sostitutivo",
    correctionCurrentLandedLine: "Altra riga sbarcata effettiva (originale escluso)",
    correctionProjectedLandedLine: "Riga sbarcata effettiva dopo la sostituzione",
    correctionCurrentLandedUnit: "Altro unitario sbarcato effettivo",
    correctionProjectedLandedUnit: "Unitario sbarcato effettivo dopo la sostituzione",
    line: "Riga",
    sku: "SKU",
    productName: "Prodotto",
    review: "Verifica",
    genericError: "Operazione costi non riuscita; riprova.",
    networkError: "Rete o servizio non disponibili; controlla la connessione e riprova.",
    timeout: "L'anteprima costi è scaduta; riprova più tardi.",
    refetchError: "Operazione inviata, ma i dati aggiornati del lotto non sono stati riletti; verifica dopo un refresh.",
    invalidResponse: "La risposta del servizio non supera i controlli; i costi visualizzati non sono stati aggiornati.",
    unknown: "Errore costi non riconosciuto; riprova più tardi.",
    typeLabels: {
      transport: "Trasporto",
      insurance: "Assicurazione",
      customs: "Dogana",
      handling: "Gestione",
      other: "Altro",
    },
    allocationLabels: {
      goods_value: "Valore merce",
      received_qty: "Quantità ricevuta",
      weight: "Peso",
      manual: "Manuale",
    },
    vatLabels: {
      recoverable: "Recuperabile",
      non_recoverable: "Non recuperabile",
      unknown: "Sconosciuto",
    },
  },
} as const;

type CostCopy = (typeof copy)[SupplierBatchCostLanguage];
type SupplierBatchCostLineLike = {
  id: string;
  lineNo: number;
  skuCode: string | null;
  name?: string;
  qtyReceived: number;
  product: { weightGram: number | null } | null;
};

export function createSupplierBatchIdempotencyKey(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID !== "function") {
    throw new Error("Browser crypto.randomUUID is unavailable.");
  }
  return randomUUID.call(globalThis.crypto);
}

export function isSupplierBatchEvidenceUrl(input: string): boolean {
  const trimmed = input.trim();
  return trimmed === "" || /^(?:https?):\/\/\S+$/i.test(trimmed);
}

export function formatSupplierBatchCostLineLabel(
  line: Pick<SupplierBatchCostLineLike, "lineNo" | "skuCode">,
  language: SupplierBatchCostLanguage
): string {
  return language === "it"
    ? `Ripartizione manuale Riga ${line.lineNo} SKU ${line.skuCode ?? "—"}`
    : `手工分摊 行 ${line.lineNo} SKU ${line.skuCode ?? "—"}`;
}

export function isSupplierBatchChargeFormEditable(
  charge: Pick<SupplierBatchCharge, "status"> | null,
  canReadCosts: boolean,
  canManageCosts: boolean,
  mode: SupplierBatchChargeDialogMode = "edit"
): boolean {
  return canReadCosts && canManageCosts && (
    charge === null ||
    charge.status === "estimated" ||
    (mode === "correction" && charge.status === "confirmed")
  );
}

export function canConfirmSupplierBatchCharge(
  previewCurrent: boolean,
  vatTreatment: SupplierBatchVatTreatment,
  confirmationBlocked: boolean | null | undefined
): boolean {
  return previewCurrent && vatTreatment !== "unknown" && confirmationBlocked !== true;
}

/**
 * A consumed finance layer blocks ordinary confirmation but does not block a
 * correction request. The dedicated correction RPC returns a pending-finance
 * receipt in that case, so the client must not pre-empt that server decision.
 * Other safety blocks (unknown IVA, missing batch FX, stale/invalid preview)
 * remain client-side gates.
 */
export function canCorrectSupplierBatchCharge(
  previewCurrent: boolean,
  vatTreatment: SupplierBatchVatTreatment,
  confirmationBlocked: boolean | null | undefined,
  confirmationBlockCode: string | null | undefined
): boolean {
  if (!previewCurrent || vatTreatment === "unknown") return false;
  if (confirmationBlocked !== true) return true;
  return confirmationBlockCode === "FINANCIAL_ADJUSTMENT_REQUIRED" ||
    confirmationBlockCode === "FINANCE_ADJUSTMENT_REQUIRED";
}

export function isSupplierBatchMutationResultForCurrent(
  result: SupplierBatchCostRpcResult | null,
  expectedStatus: "estimated" | "confirmed",
  batchId: string,
  batchCode: string,
  idempotencyKey: string,
  payloadFingerprint: string,
  chargeId: string | null
): boolean {
  if (
    result === null ||
    result.status !== expectedStatus ||
    result.batchId !== batchId ||
    result.batchCode !== batchCode ||
    result.charge === null ||
    result.payloadFingerprint !== payloadFingerprint
  ) {
    return false;
  }

  return (
    result.charge.status === expectedStatus &&
    result.charge.batchId === batchId &&
    result.charge.batchCode === batchCode &&
    result.charge.idempotencyKey === idempotencyKey &&
    result.charge.payloadFingerprint === payloadFingerprint &&
    (chargeId === null || result.charge.chargeId === chargeId)
  );
}

export type SupplierBatchMutationReadbackOutcome =
  | "matched"
  | "correction_pending"
  | "not_found"
  | "idempotency_conflict"
  | "invalid";

function dedupeSupplierBatchHistory(
  entries: readonly SupplierBatchHistoryEntry[]
): SupplierBatchHistoryEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.id || [
      entry.correctionId ?? "",
      entry.chargeId ?? "",
      entry.eventType ?? entry.action ?? "",
      entry.createdAt ?? "",
      entry.status ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readSupplierBatchChargeCorrectionLinks(charge: SupplierBatchChargeView) {
  // Correction links are projected only by the permission-checked history
  // path. Persisted charge metadata is deliberately not an authority here.
  return charge.correction ?? null;
}

/**
 * Match a server-read charge to the exact mutation draft that produced it.
 * The estimate action also accepts an already-confirmed charge because a
 * concurrent confirmer may have advanced the same payload before readback.
 */
export function classifySupplierBatchMutationReadback(
  detail: Pick<SupplierBatchCostDetail, "batch" | "charges"> | null,
  expectedStatus: "estimated" | "confirmed",
  batchId: string,
  batchCode: string,
  idempotencyKey: string,
  payloadFingerprint: string,
  chargeId: string | null
): SupplierBatchMutationReadbackOutcome {
  if (
    detail === null ||
    detail.batch.id !== batchId ||
    detail.batch.batchCode !== batchCode ||
    !idempotencyKey.trim() ||
    !payloadFingerprint.trim() ||
    !Array.isArray(detail.charges)
  ) {
    return "invalid";
  }

  const identityMatches = detail.charges.filter(
    (charge) =>
      charge.batchId === batchId &&
      charge.batchCode === batchCode &&
      charge.idempotencyKey === idempotencyKey &&
      (chargeId === null || charge.chargeId === chargeId)
  );
  if (identityMatches.length === 0) return "not_found";

  const fingerprintMatches = identityMatches.filter(
    (charge) => charge.payloadFingerprint === payloadFingerprint
  );
  if (fingerprintMatches.length === 0) return "idempotency_conflict";

  const expectedCharge = fingerprintMatches.some((charge) =>
    expectedStatus === "confirmed"
      ? charge.status === "confirmed"
      : charge.status === "estimated" || charge.status === "confirmed"
  );
  return expectedCharge ? "matched" : "not_found";
}

/**
 * Correction readback deliberately uses the replacement identity for an
 * applied receipt. A consumed layer has no replacement yet; its successful
 * readback is the history event carrying the pending-finance status. Neither
 * branch is allowed to fall through to the ordinary charge matcher.
 */
export function classifySupplierBatchCorrectionReadback(
  detail: Pick<SupplierBatchCostDetail, "batch" | "charges" | "history"> | null,
  receipt: SupplierBatchCorrectionReceipt
): SupplierBatchMutationReadbackOutcome {
  if (
    detail === null ||
    detail.batch.batchCode !== receipt.batchCode ||
    !isSupplierBatchCorrectionReceipt(receipt)
  ) {
    return "invalid";
  }

  if (receipt.status === "corrected") {
    const replacement = detail.charges.find(
      (charge) =>
        charge.batchId === detail.batch.id &&
        charge.batchCode === receipt.batchCode &&
        charge.chargeId === receipt.replacementChargeId &&
        charge.idempotencyKey === receipt.idempotencyKey &&
        charge.payloadFingerprint === receipt.previewFingerprint
    );
    if (!replacement) return "not_found";
    if (replacement.status !== "confirmed") return "not_found";
    const links = readSupplierBatchChargeCorrectionLinks(replacement);
    if (
      !links ||
      links.originalChargeId !== receipt.originalChargeId ||
      links.replacementChargeId !== receipt.replacementChargeId ||
      links.correctionId !== receipt.correctionId ||
      replacement.idempotencyKey !== receipt.idempotencyKey ||
      replacement.payloadFingerprint !== receipt.previewFingerprint
    ) {
      return "idempotency_conflict";
    }
    return "matched";
  }

  const history = dedupeSupplierBatchHistory(detail.history ?? []);
  const pendingEvent = history.some((entry) => {
    const links = entry.links;
    const originalChargeId = links?.originalChargeId ?? entry.correctionOfChargeId ?? null;
    const eventCorrectionId = links?.correctionId ?? entry.correctionId ?? null;
    const replacementChargeId = links?.replacementChargeId ?? null;
    return (
      entry.batchId === detail.batch.id &&
      entry.batchCode === receipt.batchCode &&
      entry.status?.trim().toLowerCase() === "pending_finance_adjustment" &&
      eventCorrectionId === receipt.correctionId &&
      originalChargeId === receipt.originalChargeId &&
      replacementChargeId === null &&
      entry.idempotencyKey === receipt.idempotencyKey &&
      entry.payloadFingerprint === receipt.previewFingerprint
    );
  });
  return pendingEvent ? "correction_pending" : "not_found";
}

/**
 * A correction request can time out after the database has committed, before
 * the dedicated receipt reaches the browser.  In that case there is no
 * correctionId to use for the strict receipt matcher.  Read back only the
 * original-charge relationship plus the same idempotency/fingerprint pair;
 * never fall through to the ordinary estimate/confirm matcher, which would
 * treat a pending correction as an unknown confirmed charge.
 */
export function classifySupplierBatchCorrectionReadbackByContext(
  detail: Pick<SupplierBatchCostDetail, "batch" | "charges" | "history"> | null,
  batchCode: string,
  originalChargeId: string,
  idempotencyKey: string,
  payloadFingerprint: string
): SupplierBatchMutationReadbackOutcome {
  if (
    detail === null ||
    detail.batch.batchCode !== batchCode ||
    !batchCode.trim() ||
    !originalChargeId.trim() ||
    !idempotencyKey.trim() ||
    !payloadFingerprint.trim()
  ) {
    return "invalid";
  }

  const replacementCandidates = detail.charges.filter((charge) => {
    const correction = readSupplierBatchChargeCorrectionLinks(charge);
    return (
      charge.batchId === detail.batch.id &&
      charge.batchCode === batchCode &&
      charge.status === "confirmed" &&
      correction?.originalChargeId === originalChargeId &&
      charge.idempotencyKey === idempotencyKey
    );
  });
  if (replacementCandidates.length > 1) {
    return "invalid";
  }
  if (replacementCandidates.length === 1) {
    return replacementCandidates[0]?.payloadFingerprint === payloadFingerprint
      ? "matched"
      : "idempotency_conflict";
  }

  const history = dedupeSupplierBatchHistory(detail.history ?? []);
  const pendingCandidates = history.filter((entry) => {
    const links = entry.links;
    const linkedOriginalChargeId =
      links?.originalChargeId ??
      entry.correctionOfChargeId ??
      null;
    return (
      entry.batchId === detail.batch.id &&
      entry.batchCode === batchCode &&
      entry.status?.trim().toLowerCase() === "pending_finance_adjustment" &&
      linkedOriginalChargeId === originalChargeId &&
      entry.idempotencyKey === idempotencyKey &&
      entry.payloadFingerprint === payloadFingerprint
    );
  });
  if (pendingCandidates.length > 1) {
    return "invalid";
  }
  if (pendingCandidates.length === 1) {
    return "correction_pending";
  }
  return "not_found";
}

export function isSupplierBatchMutationErrorCodeTrusted(code: unknown): boolean {
  const key = typeof code === "string" ? code.trim().toUpperCase() : "";
  return [
    "ADMIN_PERMISSION_DENIED",
    "ADMIN_FORBIDDEN",
    "PERMISSION_DENIED",
    "AUTHENTICATION_REQUIRED",
    "INVALID_BODY",
    "INVALID_REQUEST_BODY",
    "INVALID_SUPPLIER_BATCH",
    "BATCH_NOT_FOUND",
    "BATCH_IDS_LIMIT_EXCEEDED",
    "CHARGE_NOT_FOUND",
    "IDEMPOTENCY_CONFLICT",
    "CHARGE_IMMUTABLE",
    "CHARGE_CANCELLED",
    "CANCELLATION_REASON_REQUIRED",
    "CHARGE_IDEMPOTENCY_MISMATCH",
    "IDEMPOTENCY_KEY_MISMATCH",
    "IDEMPOTENCY_KEY_REQUIRED",
    "CORRECTION_NOT_ALLOWED",
    "CORRECTION_ALREADY_EXISTS",
    "CORRECTION_REPLACEMENT_MANAGED",
    "CORRECTION_REASON_REQUIRED",
    "STALE_PREVIEW",
    "STALE_REVISION",
    "FINANCIAL_ADJUSTMENT_REQUIRED",
    "FINANCE_ADJUSTMENT_REQUIRED",
    "BATCH_FX_SNAPSHOT_IMMUTABLE",
    "BATCH_FX_DIRECT_UPDATE_FORBIDDEN",
    "ALLOCATION_TOTAL_MISMATCH",
    "ALLOCATION_EUR_TOTAL_MISMATCH",
    "SUPPLIER_BATCH_COST_OVERFLOW",
    "SUPPLIER_BATCH_CONFIRMED_IMMUTABLE",
    "SUPPLIER_BATCH_LINE_CONFIRMED_IMMUTABLE",
    "UNKNOWN_VAT_NOT_ALLOWED",
    "BATCH_FX_RATE_REQUIRED",
    "BATCH_FX_SNAPSHOT_INCOMPLETE",
    "FX_RATE_REQUIRED",
    "FX_SNAPSHOT_REQUIRED",
    "NON_EUR_FX_SNAPSHOT_REQUIRED",
    "FX_EVIDENCE_URL_REQUIRED_OR_OMIT",
    "MANUAL_ALLOCATIONS_REQUIRED",
    "MANUAL_ALLOCATIONS_SUM_MUST_EQUAL_CAPITALIZED",
    "MANUAL_ALLOCATIONS_IDS_MUST_BE_UNIQUE",
    "MANUAL_ALLOCATIONS_LIMIT",
    "MANUAL_ALLOCATIONS_IDS",
    "WEIGHT_REQUIRED_FOR_ESTIMATE",
    "PRODUCT_MAPPING_REQUIRED",
    "ADMIN_SUPPLIER_BATCH_COST_PREVIEW_UNAVAILABLE",
    "ADMIN_SUPPLIER_BATCH_COST_ESTIMATE_UNAVAILABLE",
    "ADMIN_SUPPLIER_BATCH_COST_CONFIRM_UNAVAILABLE",
    "ADMIN_SUPPLIER_BATCH_COST_CORRECTION_UNAVAILABLE",
  ].includes(key);
}

export function classifySupplierBatchMutationError(
  status: number,
  code: unknown
): "known_rejection" | "unknown_write" {
  const key = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (
    status < 400 ||
    status >= 500 ||
    key === "ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE" ||
    key === "ADMIN_SUPPLIER_BATCH_COST_V2_RPC_INVALID_RESPONSE"
  ) {
    return "unknown_write";
  }
  return isSupplierBatchMutationErrorCodeTrusted(key)
    ? "known_rejection"
    : "unknown_write";
}

export function shouldInvalidateSupplierBatchPreviewForMutationError(code: unknown): boolean {
  const key = typeof code === "string" ? code.trim().toUpperCase() : "";
  return new Set([
    "STALE_PREVIEW",
    "STALE_REVISION",
    "FINANCIAL_ADJUSTMENT_REQUIRED",
    "IDEMPOTENCY_CONFLICT",
    "CHARGE_IMMUTABLE",
    "CHARGE_CANCELLED",
    "CHARGE_NOT_FOUND",
    "BATCH_NOT_FOUND",
    "BATCH_FX_RATE_REQUIRED",
    "FX_RATE_REQUIRED",
    "FX_SNAPSHOT_REQUIRED",
  ]).has(key);
}

export function buildSupplierBatchFieldAriaDescribedBy(
  id: string,
  hasError: boolean,
  hasDescription = false
): string | undefined {
  const ids = [
    hasDescription ? `${id}-description` : null,
    hasError ? `${id}-error` : null,
  ].filter((value): value is string => value !== null);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function parseSupplierBatchMoneyInput(input: string): SupplierBatchMoneyParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { cents: null, error: "required", value: null };
  }

  const normalized = trimmed.replace(",", ".");
  const match = normalized.match(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/) ??
    normalized.match(/^\.\d{1,2}$/);
  if (!match) {
    return { cents: null, error: "format", value: null };
  }

  const [wholePart = "0", fractionPart = ""] = normalized.startsWith(".")
    ? ["0", normalized.slice(1)]
    : normalized.split(".");
  const cents = Number(wholePart) * 100 + Number((fractionPart + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) {
    return { cents: null, error: "format", value: null };
  }

  return { cents, error: null, value: cents / 100 };
}

export function parseSupplierBatchFxRateInput(input: string): SupplierBatchFxRateParseResult {
  const trimmed = input.trim().replace(",", ".");
  if (!trimmed) {
    return { value: null, error: "required" };
  }
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(trimmed)) {
    return { value: null, error: "format" };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0.000001 || value > 1_000_000) {
    return { value: null, error: "invalid" };
  }
  return { value, error: null };
}

export function supplierBatchDateTimeLocalToIso(input: string): SupplierBatchDateTimeLocalResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: null, value: null };
  }

  // `datetime-local` has no offset. Interpret the value in the business
  // timezone instead of the browser timezone so a user travelling outside
  // Italy cannot silently shift an arrival cost's occurredAt timestamp.
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed);
  if (!match) {
    return { error: "invalid", value: null };
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const wallClockMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const wallClockDate = new Date(wallClockMs);
  if (
    Number.isNaN(wallClockDate.getTime()) ||
    wallClockDate.getUTCFullYear() !== year ||
    wallClockDate.getUTCMonth() !== month - 1 ||
    wallClockDate.getUTCDate() !== day ||
    wallClockDate.getUTCHours() !== hour ||
    wallClockDate.getUTCMinutes() !== minute ||
    wallClockDate.getUTCSeconds() !== second
  ) {
    return { error: "invalid", value: null };
  }

  const initialOffsetMs = supplierBatchRomeOffsetMilliseconds(wallClockDate);
  let date = new Date(wallClockMs - initialOffsetMs);
  // Re-evaluate after applying the offset to handle the two DST transition
  // edges. A nonexistent local wall-clock time is rejected below rather than
  // being silently normalised to a different time.
  const correctedOffsetMs = supplierBatchRomeOffsetMilliseconds(date);
  if (correctedOffsetMs !== initialOffsetMs) {
    date = new Date(wallClockMs - correctedOffsetMs);
  }

  return supplierBatchRomeDateTimeMatches(date, year, month, day, hour, minute, second)
    ? { error: null, value: date.toISOString() }
    : { error: "invalid", value: null };
}

export function supplierBatchDateTimeLocalFromIso(input: string | null): string {
  if (!input) {
    return "";
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date).replace(" ", "T");
}

function supplierBatchRomeOffsetMilliseconds(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;
  const localAsUtcMs = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );
  return localAsUtcMs - date.getTime();
}

function supplierBatchRomeDateTimeMatches(
  date: Date,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;
  return (
    values.year === year &&
    values.month === month &&
    values.day === day &&
    values.hour === hour &&
    values.minute === minute &&
    values.second === second
  );
}

export function supplierBatchCurrentDateTimeLocal(): string {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return formatter.format(new Date()).replace(" ", "T");
}

export function getSupplierBatchManualLines(
  lines: readonly SupplierBatchCostLineLike[]
): SupplierBatchCostLineLike[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (line.qtyReceived <= 0 || !Number.isFinite(line.qtyReceived) || seen.has(line.id)) {
      return false;
    }
    seen.add(line.id);
    return true;
  });
}

export function getSupplierBatchMissingWeightCount(
  lines: readonly SupplierBatchCostLineLike[]
): number {
  return getSupplierBatchManualLines(lines).filter(
    (line) => !line.product || !Number.isFinite(line.product.weightGram) || (line.product.weightGram ?? 0) <= 0
  ).length;
}

export function summarizeSupplierBatchManualAllocations(
  lines: readonly SupplierBatchCostLineLike[],
  manualAmounts: Readonly<Record<string, string>>,
  capitalizedAmount: string
): SupplierBatchManualAllocationSummary {
  const capitalized = parseSupplierBatchMoneyInput(capitalizedAmount);
  const eligibleLines = getSupplierBatchManualLines(lines);
  let totalCents = 0;
  let invalidCount = 0;
  const rows: SupplierBatchManualAllocationSummary["rows"] = [];

  for (const line of eligibleLines) {
    const parsed = parseSupplierBatchMoneyInput(manualAmounts[line.id] ?? "");
    if (parsed.cents === null || parsed.value === null) {
      invalidCount += 1;
      continue;
    }
    totalCents += parsed.cents;
    rows.push({ amount: parsed.value, amountCents: parsed.cents, batchLineId: line.id });
  }

  return {
    capitalizedCents: capitalized.cents,
    differenceCents: capitalized.cents === null ? null : totalCents - capitalized.cents,
    invalidCount,
    rows,
    totalCents,
  };
}

export function supplierBatchChargeFormFingerprint(
  form: SupplierBatchChargeFormValues,
  manualAmounts: Readonly<Record<string, string>>,
  chargeId: string | null,
  idempotencyKey: string
): string {
  return JSON.stringify({
    chargeId,
    form,
    idempotencyKey,
    manualAmounts: Object.entries(manualAmounts).sort(([left], [right]) => left.localeCompare(right)),
  });
}

export function isSupplierBatchPreviewCurrent(
  previewSnapshotKey: string | null,
  currentSnapshotKey: string
): boolean {
  return previewSnapshotKey !== null && previewSnapshotKey === currentSnapshotKey;
}

export function createSupplierBatchChargeForm(
  charge: SupplierBatchChargeView | null,
  lines: readonly SupplierBatchCostLineLike[],
  batch?: Pick<SupplierBatchCostDetail["batch"],
    "currency" | "goodsValueFxRateToEur" | "goodsValueFxDate" | "goodsValueFxSource" | "goodsValueFxEvidenceUrl">
): SupplierBatchChargeFormResult {
  const chargeRecord = charge as (SupplierBatchChargeView & Record<string, unknown>) | null;
  const batchRecord = batch as (Pick<SupplierBatchCostDetail["batch"],
    "currency" | "goodsValueFxRateToEur" | "goodsValueFxDate" | "goodsValueFxSource" | "goodsValueFxEvidenceUrl"> & Record<string, unknown>) | undefined;
  const currency = normalizeSupplierBatchCurrency(chargeRecord?.currency);
  const batchCurrency = normalizeSupplierBatchCurrency(batchRecord?.currency);
  const fxRate = chargeRecord?.fxRateToEur;
  const form: SupplierBatchChargeFormValues = {
    allocationMethod: charge?.allocationMethod ?? "goods_value",
    amountNet: charge ? formatCentsForInput(charge.amountNetCents) : "",
    capitalizedAmount: charge ? formatCentsForInput(charge.capitalizedAmountCents) : "",
    carrierName: charge?.carrierName ?? "",
    chargeType: charge?.chargeType ?? "transport",
    correctionReason: "",
    evidenceUrl: charge?.evidenceUrl ?? "",
    notes: charge?.notes ?? "",
    occurredAt: charge
      ? supplierBatchDateTimeLocalFromIso(charge.occurredAt ?? null)
      : supplierBatchCurrentDateTimeLocal(),
    reference: charge?.reference ?? "",
    vatAmount: charge ? formatCentsForInput(charge.vatAmountCents) : "",
    vatTreatment: charge?.vatTreatment ?? "unknown",
    zeroCostReason: charge?.zeroCostReason ?? "",
    currency,
    fxRateToEur: typeof fxRate === "number" && Number.isFinite(fxRate) ? String(fxRate) : currency === "EUR" ? "1" : "",
    fxRateDate: typeof chargeRecord?.fxRateDate === "string" ? chargeRecord.fxRateDate.slice(0, 10) : currency === "EUR" ? supplierBatchCurrentDateTimeLocal().slice(0, 10) : "",
    fxRateSource: typeof chargeRecord?.fxRateSource === "string" ? chargeRecord.fxRateSource : currency === "EUR" ? "EUR base" : "",
    fxEvidenceUrl: typeof chargeRecord?.fxEvidenceUrl === "string" ? chargeRecord.fxEvidenceUrl : "",
    batchGoodsValueFxRateToEur: batchCurrency === "EUR"
      ? ""
      : typeof batchRecord?.goodsValueFxRateToEur === "number" && Number.isFinite(batchRecord.goodsValueFxRateToEur)
        ? String(batchRecord.goodsValueFxRateToEur)
        : "",
    batchGoodsValueFxDate: batchCurrency === "EUR"
      ? ""
      : typeof batchRecord?.goodsValueFxDate === "string" ? batchRecord.goodsValueFxDate.slice(0, 10) : "",
    batchGoodsValueFxSource: batchCurrency === "EUR"
      ? ""
      : typeof batchRecord?.goodsValueFxSource === "string" ? batchRecord.goodsValueFxSource : "",
    batchGoodsValueFxEvidenceUrl: batchCurrency === "EUR"
      ? ""
      : typeof batchRecord?.goodsValueFxEvidenceUrl === "string" ? batchRecord.goodsValueFxEvidenceUrl : "",
  };
  const snapshot = new Map(
    (charge?.manualAllocationsSnapshot ?? []).map((row) => [row.batchLineId, row.amountCents])
  );
  const manualAmounts: Record<string, string> = {};
  for (const line of getSupplierBatchManualLines(lines)) {
    const amountCents = snapshot.get(line.id);
    manualAmounts[line.id] = amountCents === undefined ? "" : formatCentsForInput(amountCents);
  }
  return { form, manualAmounts };
}

export function buildSupplierBatchChargePayload(
  form: SupplierBatchChargeFormValues,
  manualAmounts: Readonly<Record<string, string>>,
  lines: readonly SupplierBatchCostLineLike[],
  mode: SupplierBatchChargeDialogMode,
  idempotencyKey: string,
  revision?: string,
  chargeId?: string,
  previewFingerprint?: string,
  includeCorrectionReason = false,
  batchCurrencyInput?: SupplierBatchCurrency
): SupplierBatchChargePayloadBuildResult {
  const fieldErrors: Record<string, string> = {};
  const amountNet = parseSupplierBatchMoneyInput(form.amountNet);
  const vatAmount = parseSupplierBatchMoneyInput(form.vatAmount);
  const capitalizedAmount = parseSupplierBatchMoneyInput(form.capitalizedAmount);
  const currency = normalizeSupplierBatchCurrency(form.currency);
  const fxRate = parseSupplierBatchFxRateInput(form.fxRateToEur);
  // Older callers only supplied the charge currency.  They represent the
  // legacy EUR-batch contract; the dialog passes the actual batch currency
  // explicitly so non-EUR goods FX cannot be silently skipped.
  const batchCurrency = normalizeSupplierBatchCurrency(batchCurrencyInput ?? "EUR");
  // Keep older EUR drafts/fixtures compatible while the non-EUR goods FX
  // snapshot fields roll out.  The batch currency gate below decides whether
  // this parsed value is required.
  const batchGoodsFxRate = parseSupplierBatchFxRateInput(form.batchGoodsValueFxRateToEur ?? "");

  for (const [field, parsed] of [
    ["amountNet", amountNet],
    ["vatAmount", vatAmount],
    ["capitalizedAmount", capitalizedAmount],
  ] as const) {
    if (parsed.error === "required") fieldErrors[field] = "required";
    if (parsed.error === "format") fieldErrors[field] = "format";
  }

  if (supplierBatchDateTimeLocalToIso(form.occurredAt).error === "invalid") {
    fieldErrors.occurredAt = "invalid";
  }
  if (currency !== "EUR") {
    if (fxRate.error === "required") fieldErrors.fxRateToEur = "required";
    if (fxRate.error === "format" || fxRate.error === "invalid") fieldErrors.fxRateToEur = "invalid";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.fxRateDate.trim())) fieldErrors.fxRateDate = "invalid";
    if (!form.fxRateSource.trim()) fieldErrors.fxRateSource = "required";
    if (!isSupplierBatchEvidenceUrl(form.fxEvidenceUrl ?? "")) fieldErrors.fxEvidenceUrl = "protocol";
  }
  if (batchCurrency !== "EUR") {
    if (batchGoodsFxRate.error === "required") fieldErrors.batchGoodsValueFxRateToEur = "required";
    if (batchGoodsFxRate.error === "format" || batchGoodsFxRate.error === "invalid") fieldErrors.batchGoodsValueFxRateToEur = "invalid";
    if (!/^\d{4}-\d{2}-\d{2}$/.test((form.batchGoodsValueFxDate ?? "").trim())) fieldErrors.batchGoodsValueFxDate = "invalid";
    if (!(form.batchGoodsValueFxSource ?? "").trim()) fieldErrors.batchGoodsValueFxSource = "required";
    if (!isSupplierBatchEvidenceUrl(form.batchGoodsValueFxEvidenceUrl ?? "")) fieldErrors.batchGoodsValueFxEvidenceUrl = "protocol";
  }
  if (!isSupplierBatchEvidenceUrl(form.evidenceUrl)) {
    fieldErrors.evidenceUrl = "protocol";
  }
  if (!idempotencyKey.trim()) {
    fieldErrors.idempotencyKey = "required";
  }
  if (form.allocationMethod === "manual") {
    const eligibleLines = getSupplierBatchManualLines(lines);
    if (eligibleLines.length > MAX_MANUAL_ROWS) {
      fieldErrors.manualAllocations = "limit";
    } else {
      const manual = summarizeSupplierBatchManualAllocations(lines, manualAmounts, form.capitalizedAmount);
      if (manual.invalidCount > 0) fieldErrors.manualAllocations = "required";
      if (manual.differenceCents !== 0) fieldErrors.manualAllocations = "sum";
    }
  }
  if (mode === "correction") {
    if (!chargeId) fieldErrors.chargeId = "required";
    if (includeCorrectionReason && !form.correctionReason.trim()) {
      fieldErrors.correctionReason = "required";
    }
    if (includeCorrectionReason && !revision) fieldErrors.revision = "required";
    if (includeCorrectionReason && !previewFingerprint) fieldErrors.previewFingerprint = "required";
  }
  if (capitalizedAmount.cents === 0 && !form.zeroCostReason.trim()) {
    fieldErrors.zeroCostReason = "required";
  }

  if (Object.keys(fieldErrors).length > 0 || amountNet.value === null || vatAmount.value === null || capitalizedAmount.value === null) {
    return { fieldErrors, payload: null };
  }

  const occurredAt = supplierBatchDateTimeLocalToIso(form.occurredAt);
  const payload: Record<string, unknown> = {
    allocationMethod: form.allocationMethod,
    amountNet: amountNet.value,
    capitalizedAmount: capitalizedAmount.value,
    carrierName: form.carrierName.trim() || null,
    chargeType: form.chargeType,
    currency,
    evidenceUrl: form.evidenceUrl.trim() || null,
    idempotencyKey: idempotencyKey.trim(),
    notes: form.notes.trim() || null,
    occurredAt: occurredAt.value,
    reference: form.reference.trim() || null,
    vatAmount: vatAmount.value,
    vatTreatment: form.vatTreatment,
    zeroCostReason: form.zeroCostReason.trim() || null,
  };

  if (currency !== "EUR") {
    payload.fxRateToEur = fxRate.value;
    payload.fxRateDate = form.fxRateDate.trim();
    payload.fxRateSource = form.fxRateSource.trim();
    if ((form.fxEvidenceUrl ?? "").trim()) payload.fxEvidenceUrl = form.fxEvidenceUrl.trim();
  }

  if (batchCurrency !== "EUR") {
    payload.batchGoodsValueFxRateToEur = batchGoodsFxRate.value;
    payload.batchGoodsValueFxDate = (form.batchGoodsValueFxDate ?? "").trim();
    payload.batchGoodsValueFxSource = (form.batchGoodsValueFxSource ?? "").trim();
    if ((form.batchGoodsValueFxEvidenceUrl ?? "").trim()) {
      payload.batchGoodsValueFxEvidenceUrl = form.batchGoodsValueFxEvidenceUrl.trim();
    }
  }

  if (mode === "edit" && chargeId) {
    // Keep the persisted identity in every preview/save/confirm payload.
    payload.chargeId = chargeId;
  }
  if (mode === "correction" && chargeId) {
    // A correction previews against the immutable confirmed charge identity.
    payload.chargeId = chargeId;
  }
  if (revision !== undefined) {
    payload.revision = revision;
    if (previewFingerprint !== undefined) payload.previewFingerprint = previewFingerprint;
  }
  if (mode === "correction" && includeCorrectionReason) {
    payload.correctionReason = form.correctionReason.trim();
  }
  if (form.allocationMethod === "manual") {
    const manual = summarizeSupplierBatchManualAllocations(lines, manualAmounts, form.capitalizedAmount);
    payload.manualAllocations = manual.rows.map((row) => ({
      amount: row.amount,
      batchLineId: row.batchLineId,
    }));
  }

  return { fieldErrors, payload };
}

export function mapSupplierBatchCostErrorCode(
  code: unknown,
  language: SupplierBatchCostLanguage
): string {
  const key = typeof code === "string" ? code.trim().toUpperCase() : "";
  const messages: Record<string, Record<string, string>> = {
    STALE_REVISION: {
      zh: "批次数据已变化，请重新预览后再试。",
      it: "I dati del lotto sono cambiati; esegui una nuova anteprima.",
    },
    STALE_PREVIEW: {
      zh: "预览已过期，请重新预览后再试。",
      it: "L'anteprima è scaduta; esegui una nuova anteprima.",
    },
    FINANCIAL_ADJUSTMENT_REQUIRED: {
      zh: "已有成本层需要财务调整，暂不能确认。",
      it: "Serve una rettifica finanziaria prima della conferma.",
    },
    FINANCE_ADJUSTMENT_REQUIRED: {
      zh: "已有成本层需要财务调整；纠错提交后将进入待财务调整。",
      it: "Serve un adeguamento finanziario; la rettifica resta in attesa dell'intervento contabile.",
    },
    BATCH_FX_RATE_REQUIRED: {
      zh: "批次商品货值缺少独立 EUR 汇率，暂不能确认。",
      it: "Manca il cambio EUR indipendente del valore merce; conferma bloccata.",
    },
    BATCH_FX_SNAPSHOT_INCOMPLETE: {
      zh: "批次商品货值汇率快照需同时填写汇率、日期和来源。",
      it: "Lo snapshot del valore merce richiede cambio, data e fonte.",
    },
    NON_EUR_FX_SNAPSHOT_REQUIRED: {
      zh: "非 EUR 费用必须提供完整汇率快照。",
      it: "Per un costo non EUR serve uno snapshot cambio completo.",
    },
    FX_EVIDENCE_URL_REQUIRED_OR_OMIT: {
      zh: "汇率证据 URL 为空时请留空，不要提交 null。",
      it: "Lascia vuoto l'URL evidenza cambio invece di inviare null.",
    },
    FX_RATE_REQUIRED: {
      zh: "非 EUR 费用必须提供有效的 EUR 汇率快照。",
      it: "Per una valuta diversa da EUR serve uno snapshot cambio valido.",
    },
    FX_SNAPSHOT_REQUIRED: {
      zh: "汇率日期和来源必须完整。",
      it: "Data e fonte del cambio sono obbligatorie.",
    },
    IDEMPOTENCY_CONFLICT: {
      zh: "该幂等键对应的内容不同，请关闭后重新建立草稿。",
      it: "La chiave idempotente è associata a un contenuto diverso; crea una nuova bozza.",
    },
    CHARGE_IMMUTABLE: {
      zh: "该费用已不可修改。",
      it: "Questo costo non è più modificabile.",
    },
    CHARGE_CANCELLED: {
      zh: "该费用已取消，不能继续操作。",
      it: "Questo costo è annullato e non può essere modificato.",
    },
    CANCELLATION_REASON_REQUIRED: {
      zh: "取消预估费用必须填写原因。",
      it: "Per annullare la stima è obbligatorio indicare il motivo.",
    },
    CHARGE_IDEMPOTENCY_MISMATCH: {
      zh: "费用身份与幂等键不匹配，未重复提交。",
      it: "L'identità del costo non corrisponde alla chiave idempotente; nessun nuovo invio.",
    },
    IDEMPOTENCY_KEY_MISMATCH: {
      zh: "幂等键与当前请求不匹配，未重复提交。",
      it: "La chiave idempotente non corrisponde alla richiesta corrente; nessun nuovo invio.",
    },
    IDEMPOTENCY_KEY_REQUIRED: {
      zh: "该操作必须提供幂等键。",
      it: "Questa operazione richiede una chiave idempotente.",
    },
    CORRECTION_NOT_ALLOWED: {
      zh: "该费用当前不允许纠错。",
      it: "Questo costo non può essere rettificato in questo stato.",
    },
    CORRECTION_ALREADY_EXISTS: {
      zh: "该费用已有纠错记录，请查看历史。",
      it: "Questo costo ha già una rettifica; controlla lo storico.",
    },
    CORRECTION_REPLACEMENT_MANAGED: {
      zh: "替代记录不能再次作为普通费用操作。",
      it: "Il record sostitutivo non può essere gestito come un costo ordinario.",
    },
    CORRECTION_REASON_REQUIRED: {
      zh: "纠错理由不能为空。",
      it: "Il motivo della rettifica è obbligatorio.",
    },
    BATCH_FX_SNAPSHOT_IMMUTABLE: {
      zh: "批次商品货值汇率快照不可修改。",
      it: "Lo snapshot cambio del valore merce non può essere modificato.",
    },
    BATCH_FX_DIRECT_UPDATE_FORBIDDEN: {
      zh: "批次汇率只能通过受控成本流程更新。",
      it: "Il cambio del lotto può essere aggiornato solo tramite il flusso costi autorizzato.",
    },
    ALLOCATION_TOTAL_MISMATCH: {
      zh: "分摊合计与资本化金额不一致。",
      it: "Il totale delle allocazioni non coincide con l'importo capitalizzato.",
    },
    ALLOCATION_EUR_TOTAL_MISMATCH: {
      zh: "EUR 分摊合计与资本化金额不一致。",
      it: "Il totale delle allocazioni EUR non coincide con l'importo capitalizzato.",
    },
    SUPPLIER_BATCH_COST_OVERFLOW: {
      zh: "成本金额超过系统可安全保存的上限。",
      it: "L'importo del costo supera il limite sicuro di salvataggio.",
    },
    SUPPLIER_BATCH_CONFIRMED_IMMUTABLE: {
      zh: "已有正式成本的批次不可直接修改货币或总成本。",
      it: "Un lotto con costi confermati non può modificare direttamente valuta o totale.",
    },
    SUPPLIER_BATCH_LINE_CONFIRMED_IMMUTABLE: {
      zh: "已有正式成本的到货行不可直接修改。",
      it: "Una riga di arrivo con costi confermati non può essere modificata direttamente.",
    },
    UNKNOWN_VAT_NOT_ALLOWED: {
      zh: "IVA 未确定，不能执行此正式成本操作。",
      it: "L'IVA non è definita; l'operazione sul costo definitivo non è consentita.",
    },
    CHARGE_NOT_FOUND: {
      zh: "费用记录不存在，请重新读取批次。",
      it: "Costo non trovato; rileggi il lotto.",
    },
    BATCH_NOT_FOUND: {
      zh: "批次不存在，请重新读取批次。",
      it: "Lotto non trovato; rileggi i dati.",
    },
    MANUAL_ALLOCATIONS_REQUIRED: {
      zh: "手工分摊必须填写每个有效到货行。",
      it: "La ripartizione manuale richiede ogni riga ricevuta valida.",
    },
    MANUAL_ALLOCATIONS_SUM_MUST_EQUAL_CAPITALIZED: {
      zh: "手工分摊合计必须等于资本化金额。",
      it: "Il totale manuale deve uguagliare l'importo capitalizzato.",
    },
    MANUAL_ALLOCATIONS_IDS_MUST_BE_UNIQUE: {
      zh: "手工分摊行不能重复。",
      it: "Le righe manuali non possono essere duplicate.",
    },
    MANUAL_ALLOCATIONS_LIMIT: {
      zh: "手工分摊最多支持 500 行。",
      it: "La ripartizione manuale supporta al massimo 500 righe.",
    },
    MANUAL_ALLOCATIONS_IDS: {
      zh: "手工分摊包含无效行。",
      it: "La ripartizione manuale contiene righe non valide.",
    },
    WEIGHT_REQUIRED_FOR_ESTIMATE: {
      zh: "重量分摊需要所有有效商品都有正重量。",
      it: "La ripartizione per peso richiede un peso positivo per ogni prodotto valido.",
    },
    PRODUCT_MAPPING_REQUIRED: {
      zh: "存在未映射商品，暂不能计算分摊。",
      it: "Esistono prodotti non mappati; la ripartizione non è disponibile.",
    },
    ADMIN_PERMISSION_DENIED: {
      zh: "当前账号没有成本管理权限。",
      it: "L'account non dispone del permesso di gestione costi.",
    },
    ADMIN_FORBIDDEN: {
      zh: "当前账号无权执行此成本操作。",
      it: "L'account non è autorizzato per questa operazione sui costi.",
    },
    PERMISSION_DENIED: {
      zh: "当前账号没有成本管理权限。",
      it: "L'account non dispone del permesso di gestione costi.",
    },
    AUTHENTICATION_REQUIRED: {
      zh: "登录状态已失效，请重新登录后重试。",
      it: "La sessione è scaduta; accedi di nuovo e riprova.",
    },
    INVALID_SUPPLIER_BATCH: {
      zh: "批次编号无效，请重新读取批次。",
      it: "Il codice lotto non è valido; rileggi il lotto.",
    },
    INVALID_REQUEST_BODY: {
      zh: "提交内容未通过校验，请检查字段。",
      it: "Il contenuto inviato non supera la validazione; controlla i campi.",
    },
    INVALID_BODY: {
      zh: "提交内容未通过校验，请检查字段。",
      it: "Il contenuto inviato non supera la validazione; controlla i campi.",
    },
    ADMIN_SUPPLIER_BATCH_COST_PREVIEW_UNAVAILABLE: {
      zh: "成本预览暂不可用，请重试。",
      it: "L'anteprima costi non è disponibile; riprova.",
    },
    ADMIN_SUPPLIER_BATCH_COST_ESTIMATE_UNAVAILABLE: {
      zh: "预估成本暂不能保存，请重试。",
      it: "La stima costi non può essere salvata; riprova.",
    },
    ADMIN_SUPPLIER_BATCH_COST_CONFIRM_UNAVAILABLE: {
      zh: "正式成本暂不能确认，请重试。",
      it: "Il costo non può essere confermato; riprova.",
    },
    ADMIN_SUPPLIER_BATCH_COST_CORRECTION_UNAVAILABLE: {
      zh: "纠错暂不能提交，请重试。",
      it: "La rettifica non può essere inviata; riprova.",
    },
    ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE: {
      zh: "服务返回的数据无法通过校验，未更新页面成本。",
      it: "La risposta del servizio non supera i controlli; i costi visualizzati non sono stati aggiornati.",
    },
    ADMIN_SUPPLIER_BATCH_COST_V2_RPC_INVALID_RESPONSE: {
      zh: "成本服务返回的数据无法通过校验；未写入成本，请检查后重新预览。",
      it: "La risposta del servizio costi non supera i controlli; nessun costo è stato scritto. Controlla e riprova l'anteprima.",
    },
  };
  return messages[key]?.[language] ?? (language === "it" ? "Errore costi non riconosciuto; riprova." : "未知成本错误，请稍后重试。");
}

export function mapSupplierBatchSchemaIssues(
  issues: readonly SupplierBatchSchemaFieldIssue[]
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path.length > 0 ? String(issue.path[0]) : "form";
    const message = issue.message.toUpperCase();
    const code = issue.code?.toLowerCase();
    const mapped = message.includes("REQUIRED")
      ? "required"
      : message.includes("SUM_MUST_EQUAL")
        ? "sum"
        : (code === "too_big" || message.includes("MAXIMUM")) && field === "manualAllocations"
          ? "limit"
          : "invalid";
    errors[field] ??= mapped;
  }
  return errors;
}

function formatCentsForInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

type SupplierBatchCostApiError = {
  code: string | null;
  unknownWrite?: boolean;
  status: number;
};

type SupplierBatchMutationAction = "estimate" | "confirm" | "correct";
type SupplierBatchPendingAction = "preview" | SupplierBatchMutationAction | "refresh" | null;
export type SupplierBatchMutationReceipt = {
  action: SupplierBatchMutationAction;
  status: "estimated" | "confirmed";
  batchId: string;
  batchCode: string;
  chargeId: string;
  idempotencyKey: string;
  payloadFingerprint: string;
};
export type SupplierBatchCorrectionReceipt = SupplierBatchCorrectionResult;
type SupplierBatchMutationContext = {
  action: SupplierBatchMutationAction;
  chargeId: string | null;
  idempotencyKey: string;
  payloadFingerprint: string;
  snapshotKey: string;
  /** A receipt can identify a newly-created charge when the draft had no chargeId yet. */
  readbackChargeId?: string;
  correctionReceipt?: SupplierBatchCorrectionReceipt;
};

type SupplierBatchMutationResponse =
  | { kind: "result"; result: SupplierBatchCostRpcResult }
  | { kind: "receipt"; receipt: SupplierBatchMutationReceipt }
  | { kind: "correction_receipt"; receipt: SupplierBatchCorrectionReceipt }
  | { kind: "invalid_receipt" };
type SupplierBatchMutationReceiptEnvelope = {
  outcome: "persisted_readback_required";
  receipt: SupplierBatchMutationReceipt;
};

function readApiErrorCode(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.error)) return null;
  return typeof payload.error.code === "string" ? payload.error.code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const SUPPLIER_BATCH_MUTATION_RECEIPT_KEYS = [
  "action",
  "status",
  "batchId",
  "batchCode",
  "chargeId",
  "idempotencyKey",
  "payloadFingerprint",
] as const;

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isNonEmptyReceiptString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Recognise the intentionally small persisted-write receipt envelope. Exact
 * keys make malformed or future-expanded envelopes fail closed before the
 * normal RPC result parser can interpret them as a success.
 */
export function isSupplierBatchMutationReceipt(
  value: unknown
): value is SupplierBatchMutationReceipt {
  if (!isRecord(value) || !hasExactKeys(value, SUPPLIER_BATCH_MUTATION_RECEIPT_KEYS)) {
    return false;
  }

  return (
    (value.action === "estimate" || value.action === "confirm" || value.action === "correct") &&
    (value.status === "estimated" || value.status === "confirmed") &&
    isNonEmptyReceiptString(value.batchId) &&
    isNonEmptyReceiptString(value.batchCode) &&
    isNonEmptyReceiptString(value.chargeId) &&
    isNonEmptyReceiptString(value.idempotencyKey) &&
    isNonEmptyReceiptString(value.payloadFingerprint)
  );
}

export function isSupplierBatchMutationReceiptEnvelope(
  value: unknown
): value is SupplierBatchMutationReceiptEnvelope {
  if (!isRecord(value) || !hasExactKeys(value, ["outcome", "receipt"])) {
    return false;
  }
  return value.outcome === "persisted_readback_required" && isSupplierBatchMutationReceipt(value.receipt);
}

/**
 * Extract the identity-only receipt from the repository's canonical persisted
 * RPC result. The result also contains internal monetary fields, but this
 * adapter deliberately never reads or converts any of them.
 */
export function extractSupplierBatchMutationReceiptFromCanonicalResult(
  value: unknown,
  action: SupplierBatchMutationAction
): SupplierBatchMutationReceipt | null {
  if (!isRecord(value)) {
    return null;
  }

  const expectedStatus = action === "confirm" || action === "correct" ? "confirmed" : "estimated";
  if (
    value.status !== expectedStatus ||
    !isNonEmptyReceiptString(value.batchId) ||
    !isNonEmptyReceiptString(value.batchCode) ||
    !isRecord(value.charge) ||
    (value.charge.status !== undefined && value.charge.status !== expectedStatus) ||
    (value.charge.batchId !== undefined && value.charge.batchId !== value.batchId) ||
    (value.charge.batchCode !== undefined && value.charge.batchCode !== value.batchCode)
  ) {
    return null;
  }

  const chargeId = value.charge.chargeId;
  const legacyChargeId = value.charge.id;
  if (
    (chargeId !== undefined && !isNonEmptyReceiptString(chargeId)) ||
    (legacyChargeId !== undefined && !isNonEmptyReceiptString(legacyChargeId)) ||
    (chargeId !== undefined && legacyChargeId !== undefined && chargeId !== legacyChargeId)
  ) {
    return null;
  }

  const resolvedChargeId = isNonEmptyReceiptString(chargeId)
    ? chargeId
    : isNonEmptyReceiptString(legacyChargeId)
      ? legacyChargeId
      : null;
  const idempotencyKey = value.charge.idempotencyKey;
  const payloadFingerprint = value.charge.payloadFingerprint;
  if (
    resolvedChargeId === null ||
    !isNonEmptyReceiptString(idempotencyKey) ||
    !isNonEmptyReceiptString(payloadFingerprint)
  ) {
    return null;
  }

  return {
    action,
    status: expectedStatus,
    batchId: value.batchId,
    batchCode: value.batchCode,
    chargeId: resolvedChargeId,
    idempotencyKey,
    payloadFingerprint,
  };
}

function looksLikeSupplierBatchCanonicalMutationResult(value: unknown): boolean {
  if (!isRecord(value) || (value.status !== "estimated" && value.status !== "confirmed")) {
    return false;
  }

  // Presence checks only distinguish a persisted result from a preview; no
  // monetary value is read. A malformed candidate must not fall through to
  // the full DTO normalizer and accidentally become a write success.
  return (
    Object.hasOwn(value, "charge") ||
    Object.hasOwn(value, "lineProjections")
  );
}

/**
 * Match a receipt to the exact draft that produced the POST. A create draft
 * has no chargeId before persistence, so its server-generated chargeId is
 * accepted; edits and confirmations for an existing charge must match it.
 */
export function isSupplierBatchMutationReceiptForCurrent(
  receipt: unknown,
  action: SupplierBatchMutationAction,
  batchId: string,
  batchCode: string,
  idempotencyKey: string,
  payloadFingerprint: string,
  chargeId: string | null
): receipt is SupplierBatchMutationReceipt {
  if (!isSupplierBatchMutationReceipt(receipt)) {
    return false;
  }

  const expectedStatus = action === "confirm" || action === "correct" ? "confirmed" : "estimated";
  return (
    receipt.action === action &&
    receipt.status === expectedStatus &&
    receipt.batchId === batchId &&
    receipt.batchCode === batchCode &&
    receipt.idempotencyKey === idempotencyKey &&
    receipt.payloadFingerprint === payloadFingerprint &&
    (chargeId === null || receipt.chargeId === chargeId)
  );
}

/**
 * Keep the correction receipt a separate success contract.  The server-side
 * core normalizer validates the wire shape before this helper is called; this
 * guard then verifies the identity binding required by the current draft.
 */
export function isSupplierBatchCorrectionReceipt(
  value: unknown
): value is SupplierBatchCorrectionReceipt {
  if (!isRecord(value)) return false;
  const status = value.status;
  if (status !== "corrected" && status !== "pending_finance_adjustment") {
    return false;
  }
  if (
    !isNonEmptyReceiptString(value.correctionId) ||
    !isNonEmptyReceiptString(value.originalChargeId) ||
    !isNonEmptyReceiptString(value.batchCode) ||
    !isNonEmptyReceiptString(value.idempotencyKey) ||
    !isNonEmptyReceiptString(value.previewFingerprint) ||
    !isNonEmptyReceiptString(value.revision) ||
    typeof value.financeAdjustmentRequired !== "boolean" ||
    !("replacement" in value)
  ) {
    return false;
  }

  if (status === "pending_finance_adjustment") {
    return value.financeAdjustmentRequired === true &&
      value.replacementChargeId === null &&
      value.replacement === null;
  }

  const replacement = value.replacement;
  return (
    value.financeAdjustmentRequired === false &&
    isNonEmptyReceiptString(value.replacementChargeId) &&
    isRecord(replacement) &&
    replacement.status === "confirmed" &&
    replacement.batchCode === value.batchCode &&
    isRecord(replacement.charge) &&
    replacement.charge.chargeId === value.replacementChargeId
  );
}

export function isSupplierBatchCorrectionReceiptForCurrent(
  receipt: unknown,
  batchCode: string,
  originalChargeId: string,
  idempotencyKey: string,
  previewFingerprint: string,
  revision: string
): receipt is SupplierBatchCorrectionReceipt {
  if (!isSupplierBatchCorrectionReceipt(receipt)) return false;
  return (
    receipt.batchCode === batchCode &&
    receipt.originalChargeId === originalChargeId &&
    receipt.idempotencyKey === idempotencyKey &&
    receipt.previewFingerprint === previewFingerprint &&
    receipt.revision === revision
  );
}

function fieldErrorText(code: string | undefined, text: CostCopy): string | null {
  if (!code) return null;
  if (code === "required") return text.required;
  if (code === "format" || code === "invalid") return text.invalid;
  if (code === "protocol") return text.invalidUrl;
  if (code === "limit") return text.manualLimit;
  if (code === "sum") return text.manualDifference;
  return text.invalid;
}

function formatCents(
  cents: number | null,
  currency: string | null | undefined = "EUR",
  language: SupplierBatchCostLanguage = "zh"
): string {
  return formatSupplierBatchCents(cents, currency, language === "it" ? "it-IT" : "zh-CN");
}

function previewCents(
  result: SupplierBatchCostRpcPreviewResult,
  centsKeys: readonly string[],
  decimalKeys: readonly string[] = []
): number | null {
  return readSupplierBatchMoneyCents(result, centsKeys, decimalKeys);
}

function previewBaseCents(
  result: SupplierBatchCostRpcPreviewResult,
  keys: readonly string[]
): number | null {
  return readSupplierBatchMoneyCents(result, keys);
}

function formatPreviewAmount(
  result: SupplierBatchCostRpcPreviewResult,
  cents: number | null,
  baseCents: number | null,
  language: SupplierBatchCostLanguage
): string {
  const resultRecord = result as unknown as Record<string, unknown>;
  const currency = normalizeSupplierBatchCurrency(resultRecord.currency);
  return formatSupplierBatchDualCents(
    cents,
    currency,
    currency === "EUR" ? null : baseCents,
    language === "it" ? "it-IT" : "zh-CN"
  );
}

function formatCorrectionPreviewEurCents(
  cents: number | null | undefined,
  language: SupplierBatchCostLanguage
): string {
  return formatSupplierBatchCents(
    cents,
    "EUR",
    language === "it" ? "it-IT" : "zh-CN"
  );
}

function formatCorrectionPreviewLineCents(
  line: SupplierBatchCostRpcPreviewResult["lineProjections"][number],
  key: keyof Pick<
    SupplierBatchCostRpcPreviewResult["lineProjections"][number],
    | "currentAllocationEurCents"
    | "candidateAllocationEurCents"
    | "currentLandedLineCostEurCents"
    | "projectedLandedLineCostEurCents"
  >,
  language: SupplierBatchCostLanguage
): string {
  return formatCorrectionPreviewEurCents(line[key], language);
}

function formatCorrectionPreviewLineUnit(
  line: SupplierBatchCostRpcPreviewResult["lineProjections"][number],
  key: keyof Pick<
    SupplierBatchCostRpcPreviewResult["lineProjections"][number],
    "currentLandedUnitCostEur" | "projectedLandedUnitCostEur"
  >,
  language: SupplierBatchCostLanguage
): string {
  return formatSupplierBatchUnitCost(line[key], language, "EUR");
}

function formatPreviewLineCents(
  result: SupplierBatchCostRpcPreviewResult,
  line: SupplierBatchCostRpcPreviewResult["lineProjections"][number],
  originalCents: number | null,
  eurCents: number | null,
  language: SupplierBatchCostLanguage
): string {
  // Original-currency landed values are not comparable when a batch contains
  // mixed/unknown allocation currencies.  The EUR projection is the only
  // authoritative display in that case, including ordinary (non-correction)
  // previews.
  return line.originalCurrencyComparable === false
    ? formatSupplierBatchCents(eurCents, "EUR", language === "it" ? "it-IT" : "zh-CN")
    : formatPreviewAmount(result, originalCents, null, language);
}

function formatPreviewLineUnit(
  line: SupplierBatchCostRpcPreviewResult["lineProjections"][number],
  originalUnit: number | null,
  eurUnit: number | null,
  language: SupplierBatchCostLanguage,
  currency: SupplierBatchCurrency
): string {
  return line.originalCurrencyComparable === false
    ? formatSupplierBatchUnitCost(eurUnit, language, "EUR")
    : formatSupplierBatchUnitCost(originalUnit, language, currency);
}

function reviewReason(result: SupplierBatchCostRpcPreviewResult, language: SupplierBatchCostLanguage): string | null {
  if (!result.confirmationBlocked && !result.confirmationBlockCode) return null;
  return mapSupplierBatchCostErrorCode(
    result.confirmationBlockCode ?? "FINANCIAL_ADJUSTMENT_REQUIRED",
    language
  );
}

export function SupplierBatchTransportCostDialog({
  canManageCosts,
  canReadCosts,
  canEstimateCosts = canManageCosts,
  canConfirmCosts = false,
  canCorrectCosts = false,
  charge,
  detail,
  language,
  mode = "create",
  onCostChanged,
  onOpenChange,
  open,
}: {
  canManageCosts: boolean;
  canReadCosts: boolean;
  canEstimateCosts?: boolean;
  canConfirmCosts?: boolean;
  canCorrectCosts?: boolean;
  charge: SupplierBatchChargeView | null;
  detail: SupplierBatchCostDetail;
  language: SupplierBatchCostLanguage;
  mode?: SupplierBatchChargeDialogMode;
  /** Re-reads the server-owned batch detail/list after a successful mutation. */
  onCostChanged: (
    batchCode: string,
    signal?: AbortSignal
  ) => Promise<SupplierBatchCostDetail>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const text = copy[language];
  // Preserve the pre-V2 call contract: a supplied charge without an explicit
  // mode is still an editable estimate. Confirmed charges must opt into the
  // dedicated correction flow explicitly.
  const resolvedMode: SupplierBatchChargeDialogMode = mode === "create" && charge ? "edit" : mode;
  const isCorrectionMode = resolvedMode === "correction";
  const canPerformFormAction = canReadCosts && (isCorrectionMode ? canCorrectCosts : canEstimateCosts);
  const dualPermission = canPerformFormAction;
  const chargeIsReadOnly = charge !== null && charge.status !== "estimated" && !isCorrectionMode;
  const canUseForm = isSupplierBatchChargeFormEditable(
    charge,
    canReadCosts,
    isCorrectionMode ? canCorrectCosts : canEstimateCosts,
    resolvedMode
  );
  const lines = React.useMemo(() => detail.lines, [detail.lines]);
  const manualLines = React.useMemo(() => getSupplierBatchManualLines(lines), [lines]);
  const missingWeightCount = React.useMemo(() => getSupplierBatchMissingWeightCount(lines), [lines]);
  const [form, setForm] = React.useState<SupplierBatchChargeFormValues>(() => createSupplierBatchChargeForm(charge, lines, detail.batch).form);
  const [manualAmounts, setManualAmounts] = React.useState<Record<string, string>>(() => createSupplierBatchChargeForm(charge, lines, detail.batch).manualAmounts);
  const [idempotencyKey, setIdempotencyKey] = React.useState("");
  const [previewState, setPreviewState] = React.useState<{
    result: SupplierBatchCostRpcPreviewResult;
    snapshotKey: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [errorCode, setErrorCode] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<SupplierBatchPendingAction>(null);
  const [persistedKnownSuccess, setPersistedKnownSuccess] = React.useState<SupplierBatchMutationContext | null>(null);
  const [uncertainMutation, setUncertainMutation] = React.useState<SupplierBatchMutationContext | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);
  const [closeGuardOpen, setCloseGuardOpen] = React.useState(false);
  const [draftDirty, setDraftDirty] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const previewAbortRef = React.useRef<AbortController | null>(null);
  const previewRequestIdRef = React.useRef(0);
  const mutationRequestIdRef = React.useRef(0);
  const mutationActiveRef = React.useRef(false);
  const mutationAbortRef = React.useRef<AbortController | null>(null);
  const initialisedRef = React.useRef<string | null>(null);
  const openRef = React.useRef(open);
  const confirmGateRef = React.useRef(false);
  const chargeId = charge?.chargeId ?? null;
  const manualSummary = React.useMemo(
    () => summarizeSupplierBatchManualAllocations(lines, manualAmounts, form.capitalizedAmount),
    [form.capitalizedAmount, lines, manualAmounts]
  );
  const manualLimitExceeded = manualLines.length > MAX_MANUAL_ROWS;

  const invalidatePreviewRequest = React.useCallback(() => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    previewRequestIdRef.current += 1;
  }, []);

  const reset = React.useCallback(() => {
    invalidatePreviewRequest();
    setForm(createSupplierBatchChargeForm(null, [], detail.batch).form);
    setManualAmounts({});
    setIdempotencyKey("");
    setPreviewState(null);
    setFieldErrors({});
    setErrorCode(null);
    setPending(null);
    setPersistedKnownSuccess(null);
    setUncertainMutation(null);
    setConfirmDialogOpen(false);
    setCloseGuardOpen(false);
    setDraftDirty(false);
    setAdvancedOpen(false);
    confirmGateRef.current = false;
  }, [detail.batch, invalidatePreviewRequest]);

  React.useEffect(() => {
    if (!open) {
      if (mutationActiveRef.current || persistedKnownSuccess !== null || uncertainMutation !== null) {
        invalidatePreviewRequest();
        return;
      }
      initialisedRef.current = null;
      invalidatePreviewRequest();
      const closeResetId = window.setTimeout(() => reset(), 0);
      return () => window.clearTimeout(closeResetId);
    }
    // A mutation/readback may refresh the parent detail before this dialog
    // finishes its own outcome check. Preserve the original draft context;
    // reinitialising from the refreshed charge would lose the same-key retry.
    if (mutationActiveRef.current || persistedKnownSuccess !== null || uncertainMutation !== null) {
      return;
    }
    const initKey = [
      detail.batch.id,
      detail.batch.batchCode,
      resolvedMode,
      chargeId ?? "create",
      charge?.status ?? "new",
      charge?.idempotencyKey ?? "draft",
      charge?.payloadFingerprint ?? "draft",
    ].join(":");
    if (initialisedRef.current === initKey) return;
    initialisedRef.current = initKey;
    invalidatePreviewRequest();
    const next = createSupplierBatchChargeForm(charge, lines, detail.batch);
    const timeoutId = window.setTimeout(() => {
      if (!open || initialisedRef.current !== initKey) return;
      setForm(next.form);
      setManualAmounts(next.manualAmounts);
      setPreviewState(null);
      setFieldErrors({});
      setErrorCode(null);
      setDraftDirty(false);
      setAdvancedOpen(Boolean(
        isCorrectionMode ||
        next.form.carrierName.trim() ||
        next.form.reference.trim() ||
        next.form.evidenceUrl.trim() ||
        next.form.notes.trim()
      ));
      setConfirmDialogOpen(false);
      try {
        setIdempotencyKey(charge?.idempotencyKey ?? createSupplierBatchIdempotencyKey());
      } catch {
        setIdempotencyKey("");
        setErrorCode("NETWORK_ERROR");
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [charge, chargeId, detail.batch, detail.batch.batchCode, detail.batch.id, invalidatePreviewRequest, isCorrectionMode, lines, open, persistedKnownSuccess, reset, resolvedMode, uncertainMutation]);

  React.useEffect(() => () => {
    invalidatePreviewRequest();
    mutationAbortRef.current?.abort();
    mutationAbortRef.current = null;
    mutationRequestIdRef.current += 1;
    mutationActiveRef.current = false;
  }, [invalidatePreviewRequest]);

  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  function updateField<K extends keyof SupplierBatchChargeFormValues>(field: K, value: SupplierBatchChargeFormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setDraftDirty(true);
    previewRequestIdRef.current += 1;
    setPreviewState(null);
    setErrorCode(null);
    setFieldErrors({});
  }

  function updateCurrency(value: string) {
    const nextCurrency = normalizeSupplierBatchCurrency(value);
    setForm((current) => ({
      ...current,
      currency: nextCurrency,
      ...(nextCurrency === "EUR"
        ? {
            fxRateToEur: "1",
            fxRateDate: supplierBatchCurrentDateTimeLocal().slice(0, 10),
            fxRateSource: "EUR base",
            fxEvidenceUrl: "",
          }
        : {
            fxRateToEur: "",
            fxRateDate: "",
            fxRateSource: "",
            fxEvidenceUrl: "",
          }),
    }));
    setDraftDirty(true);
    previewRequestIdRef.current += 1;
    setPreviewState(null);
    setErrorCode(null);
    setFieldErrors({});
  }

  function updateManualAmount(lineId: string, value: string) {
    setManualAmounts((current) => ({ ...current, [lineId]: value }));
    setDraftDirty(true);
    previewRequestIdRef.current += 1;
    setPreviewState(null);
    setErrorCode(null);
    setFieldErrors({});
  }

  function preparePayload(revision?: string, includeCorrectionReason = false) {
    const built = buildSupplierBatchChargePayload(
      form,
      manualAmounts,
      lines,
      resolvedMode,
      idempotencyKey,
      revision,
      chargeId ?? undefined,
      previewState?.result.payloadFingerprint,
      includeCorrectionReason,
      normalizeSupplierBatchCurrency(detail.batch.currency)
    );
    const nextFieldErrors = { ...built.fieldErrors };
    if (Object.keys(nextFieldErrors).length > 0 || !built.payload) {
      setFieldErrors(nextFieldErrors);
      setErrorCode("INVALID_REQUEST_BODY");
      return null;
    }
    return built.payload;
  }

  async function postPreview(
    payload: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<SupplierBatchCostRpcPreviewResult> {
    const endpoint = `/api/admin/supplier-batches/${encodeURIComponent(detail.batch.batchCode)}/charges/preview${isCorrectionMode ? "?mode=correction" : ""}`;
    let response: Response;
    let body: unknown;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        cache: "no-store",
        signal,
        body: JSON.stringify(payload),
      });
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } catch {
      throw { code: "NETWORK_ERROR", status: 0 } satisfies SupplierBatchCostApiError;
    }
    if (!response.ok) {
      throw { code: readApiErrorCode(body), status: response.status } satisfies SupplierBatchCostApiError;
    }
    const data = isRecord(body) && "data" in body ? body.data : null;
    const result = normalizeSupplierBatchCostRpcResult(data);
    if (!result || result.batchId !== detail.batch.id || result.batchCode !== detail.batch.batchCode || result.status !== "preview") {
      throw { code: "INVALID_RESPONSE", status: response.status } satisfies SupplierBatchCostApiError;
    }
    return result;
  }

  async function postMutation(
    action: SupplierBatchMutationAction,
    payload: Record<string, unknown>,
    signal: AbortSignal
  ): Promise<SupplierBatchMutationResponse> {
    const endpoint = action === "estimate"
      ? `/api/admin/supplier-batches/${encodeURIComponent(detail.batch.batchCode)}/charges/estimate`
      : action === "confirm"
        ? `/api/admin/supplier-batches/${encodeURIComponent(detail.batch.batchCode)}/charges/confirm`
        : `/api/admin/supplier-batches/${encodeURIComponent(detail.batch.batchCode)}/charges/correct`;
    let response: Response;
    let body: unknown;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        cache: "no-store",
        signal,
        body: JSON.stringify(payload),
      });
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } catch {
      throw { code: "NETWORK_ERROR", status: 0, unknownWrite: true } satisfies SupplierBatchCostApiError;
    }
    if (!response.ok) {
      const code = readApiErrorCode(body);
      throw {
        code,
        status: response.status,
        unknownWrite: classifySupplierBatchMutationError(response.status, code) === "unknown_write",
      } satisfies SupplierBatchCostApiError;
    }
    const data = isRecord(body) && "data" in body ? body.data : null;
    if (action === "correct") {
      // Corrections have a dedicated two-branch receipt.  Normalize it before
      // any ordinary persisted-result adapter so a pending finance adjustment
      // cannot be mistaken for a confirmed replacement or an unknown write.
      const correctionData = isRecord(data) && data.outcome === "persisted_readback_required"
        ? data.receipt
        : data;
      const correctionReceipt = normalizeSupplierBatchCorrectionReceipt(correctionData);
      return correctionReceipt
        ? { kind: "correction_receipt", receipt: correctionReceipt }
        : { kind: "invalid_receipt" };
    }
    // A successful write may return only a persistence receipt when the
    // server cannot safely expose its full mutation DTO. Recognise that
    // envelope before the full result normalizer; malformed receipts must
    // remain an unknown-write outcome and must never be treated as success.
    if (isRecord(data) && data.outcome === "persisted_readback_required") {
      return isSupplierBatchMutationReceiptEnvelope(data)
        ? { kind: "receipt", receipt: data.receipt }
        : { kind: "invalid_receipt" };
    }
    const canonicalReceipt = extractSupplierBatchMutationReceiptFromCanonicalResult(data, action);
    if (canonicalReceipt !== null) {
      return { kind: "receipt", receipt: canonicalReceipt };
    }
    if (looksLikeSupplierBatchCanonicalMutationResult(data)) {
      return { kind: "invalid_receipt" };
    }
    let result: SupplierBatchCostRpcResult | null = null;
    try {
      result = normalizeSupplierBatchCostRpcResult(data);
    } catch {
      result = null;
    }
    if (!result) {
      throw { code: "INVALID_RESPONSE", status: response.status, unknownWrite: true } satisfies SupplierBatchCostApiError;
    }
    return { kind: "result", result };
  }

  type SupplierBatchReadbackFailure = {
    cause: unknown;
    timedOut: boolean;
  };

  async function performMutationReadback(
    requestId: number,
    context: SupplierBatchMutationContext
  ): Promise<{ detail: SupplierBatchCostDetail; outcome: SupplierBatchMutationReadbackOutcome }> {
    const controller = new AbortController();
    let timedOut = false;
    mutationAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 25_000);

    try {
      const nextDetail = await onCostChanged(detail.batch.batchCode, controller.signal);
      if (requestId !== mutationRequestIdRef.current) {
        throw { cause: new Error("Stale supplier batch readback."), timedOut: false } satisfies SupplierBatchReadbackFailure;
      }
      const outcome = context.action === "correct"
        ? context.correctionReceipt
          ? classifySupplierBatchCorrectionReadback(nextDetail, context.correctionReceipt)
          : classifySupplierBatchCorrectionReadbackByContext(
              nextDetail,
              detail.batch.batchCode,
              context.chargeId ?? "",
              context.idempotencyKey,
              context.payloadFingerprint
            )
        : classifySupplierBatchMutationReadback(
            nextDetail,
            context.action === "confirm" ? "confirmed" : "estimated",
            detail.batch.id,
            detail.batch.batchCode,
            context.idempotencyKey,
            context.payloadFingerprint,
            context.readbackChargeId ?? context.chargeId
          );
      return {
        detail: nextDetail,
        outcome,
      };
    } catch (cause) {
      if (isRecord(cause) && "timedOut" in cause && typeof cause.timedOut === "boolean") {
        throw cause as SupplierBatchReadbackFailure;
      }
      throw { cause, timedOut } satisfies SupplierBatchReadbackFailure;
    } finally {
      window.clearTimeout(timeoutId);
      if (mutationAbortRef.current === controller) mutationAbortRef.current = null;
    }
  }

  async function runPreview() {
    if (
      !canUseForm ||
      pending ||
      previewAbortRef.current ||
      mutationActiveRef.current ||
      persistedKnownSuccess !== null ||
      uncertainMutation !== null
    ) return;
    setPending("preview");
    setErrorCode(null);
    setFieldErrors({});
    invalidatePreviewRequest();
    const requestId = previewRequestIdRef.current;
    const payload = preparePayload();
    if (!payload) {
      setPending(null);
      return;
    }
    const snapshotKey = supplierBatchChargeFormFingerprint(form, manualAmounts, chargeId, idempotencyKey);
    const parsed = supplierBatchChargePreviewSchemaV2.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(mapSupplierBatchSchemaIssues(parsed.error.issues));
      setErrorCode("INVALID_REQUEST_BODY");
      setPending(null);
      return;
    }
    const controller = new AbortController();
    let timedOut = false;
    previewAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 25_000);
    try {
      const result = await postPreview(parsed.data, controller.signal);
      if (requestId === previewRequestIdRef.current && open) {
        setFieldErrors({});
        setErrorCode(null);
        setPreviewState({ result, snapshotKey });
      }
    } catch (cause) {
      const apiError = cause as SupplierBatchCostApiError;
      if (requestId === previewRequestIdRef.current && open) {
        setPreviewState(null);
        setErrorCode(timedOut ? "PREVIEW_TIMEOUT" : apiError.code ?? "ADMIN_SUPPLIER_BATCH_COST_PREVIEW_UNAVAILABLE");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (previewAbortRef.current === controller) previewAbortRef.current = null;
      if (requestId === previewRequestIdRef.current) setPending(null);
    }
  }

  async function runMutation(action: SupplierBatchMutationAction, bypassConfirmGate = false) {
    if (
      !canUseForm ||
      pending !== null ||
      persistedKnownSuccess !== null ||
      mutationActiveRef.current ||
      (uncertainMutation !== null && uncertainMutation.action !== action)
    ) {
      return;
    }

    if (action === "confirm" && !canConfirmCosts) {
      setErrorCode("ADMIN_FORBIDDEN");
      return;
    }
    if (action === "correct" && !canCorrectCosts) {
      setErrorCode("ADMIN_FORBIDDEN");
      return;
    }

    const currentSnapshotKey = supplierBatchChargeFormFingerprint(
      form,
      manualAmounts,
      chargeId,
      idempotencyKey
    );
    const currentPreview = previewState;
    if (
      currentPreview === null ||
      !isSupplierBatchPreviewCurrent(currentPreview.snapshotKey, currentSnapshotKey)
    ) {
      setPreviewState(null);
      setErrorCode("PREVIEW_REQUIRED");
      return;
    }
    const mutationContext: SupplierBatchMutationContext = {
      action,
      chargeId,
      idempotencyKey,
      payloadFingerprint: currentPreview.result.payloadFingerprint,
      snapshotKey: currentSnapshotKey,
    };
    if (
      uncertainMutation !== null &&
      (uncertainMutation.action !== mutationContext.action ||
        uncertainMutation.chargeId !== mutationContext.chargeId ||
        uncertainMutation.idempotencyKey !== mutationContext.idempotencyKey ||
        uncertainMutation.payloadFingerprint !== mutationContext.payloadFingerprint ||
        uncertainMutation.snapshotKey !== mutationContext.snapshotKey)
    ) {
      setPreviewState(null);
      setUncertainMutation(null);
      setErrorCode("PREVIEW_REQUIRED");
      return;
    }
    const previewAllowsAction = action === "correct"
      ? canCorrectSupplierBatchCharge(
          true,
          form.vatTreatment,
          currentPreview.result.confirmationBlocked,
          currentPreview.result.confirmationBlockCode
        )
      : action === "confirm"
        ? canConfirmSupplierBatchCharge(
            true,
            form.vatTreatment,
            currentPreview.result.confirmationBlocked
          )
        : true;
    if ((action === "confirm" || action === "correct") && !previewAllowsAction) {
      setErrorCode(
        form.vatTreatment === "unknown"
          ? "CONFIRM_VAT_REQUIRED"
          : currentPreview.result.confirmationBlockCode ?? "FINANCIAL_ADJUSTMENT_REQUIRED"
      );
      return;
    }

    if ((action === "confirm" || action === "correct") && !bypassConfirmGate && !confirmGateRef.current) {
      setConfirmDialogOpen(true);
      return;
    }
    confirmGateRef.current = false;

    mutationActiveRef.current = true;
    setPending(action);
    setErrorCode(null);
    setFieldErrors({});
    setUncertainMutation(null);
    const finalMutation = action === "confirm" || action === "correct";
    const payload = preparePayload(
      finalMutation ? currentPreview.result.revision : undefined,
      action === "correct"
    );
    if (!payload) {
      mutationActiveRef.current = false;
      setPending(null);
      return;
    }
    const parsed = action === "confirm"
      ? supplierBatchChargeConfirmSchemaV2.safeParse(payload)
      : action === "correct"
        ? supplierBatchChargeCorrectSchemaV2.safeParse(payload)
        : supplierBatchChargeEstimateSchemaV2.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(mapSupplierBatchSchemaIssues(parsed.error.issues));
      setErrorCode("INVALID_REQUEST_BODY");
      mutationActiveRef.current = false;
      setPending(null);
      return;
    }

    const requestId = mutationRequestIdRef.current + 1;
    mutationRequestIdRef.current = requestId;
    mutationActiveRef.current = true;
    const controller = new AbortController();
    mutationAbortRef.current = controller;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 25_000);

    try {
      const mutationResponse = await postMutation(action, parsed.data, controller.signal);
      if (requestId !== mutationRequestIdRef.current) return;

      if (mutationResponse.kind === "invalid_receipt") {
        throw { code: "INVALID_RESPONSE", status: 200, unknownWrite: true } satisfies SupplierBatchCostApiError;
      }

      let persistedContext = mutationContext;
      if (mutationResponse.kind === "correction_receipt") {
        if (!isSupplierBatchCorrectionReceiptForCurrent(
          mutationResponse.receipt,
          detail.batch.batchCode,
          chargeId ?? "",
          idempotencyKey,
          currentPreview.result.payloadFingerprint,
          currentPreview.result.revision
        )) {
          throw { code: "INVALID_RESPONSE", status: 200, unknownWrite: true } satisfies SupplierBatchCostApiError;
        }
        persistedContext = {
          ...mutationContext,
          correctionReceipt: mutationResponse.receipt,
          ...(mutationResponse.receipt.replacementChargeId
            ? { readbackChargeId: mutationResponse.receipt.replacementChargeId }
            : {}),
        };
      } else if (mutationResponse.kind === "receipt") {
        if (!isSupplierBatchMutationReceiptForCurrent(
          mutationResponse.receipt,
          action,
          detail.batch.id,
          detail.batch.batchCode,
          idempotencyKey,
          currentPreview.result.payloadFingerprint,
          chargeId
        )) {
          throw { code: "INVALID_RESPONSE", status: 200, unknownWrite: true } satisfies SupplierBatchCostApiError;
        }
        // Preserve the original draft snapshot/key while using the server
        // charge identity to make the subsequent GET readback exact. This
        // is especially important for a create estimate, where chargeId was
        // null before the server persisted the charge.
        persistedContext = {
          ...mutationContext,
          readbackChargeId: mutationResponse.receipt.chargeId,
        };
      } else if (mutationResponse.kind === "result" && !isSupplierBatchMutationResultForCurrent(
        mutationResponse.result,
        action === "confirm" || action === "correct" ? "confirmed" : "estimated",
        detail.batch.id,
        detail.batch.batchCode,
        idempotencyKey,
        currentPreview.result.payloadFingerprint,
        chargeId
      )) {
        throw { code: "INVALID_RESPONSE", status: 200, unknownWrite: true } satisfies SupplierBatchCostApiError;
      }

      // The mutation response is authoritative enough to enter the
      // persisted-known-success state, but only the server detail readback
      // may close the dialog or clear this draft context.
      setPersistedKnownSuccess(persistedContext);
      setPending("refresh");
      try {
        if (mutationAbortRef.current === controller) mutationAbortRef.current = null;
        const readback = await performMutationReadback(requestId, persistedContext);
        if (requestId !== mutationRequestIdRef.current) return;
        if (readback.outcome === "matched" || readback.outcome === "correction_pending") {
          mutationActiveRef.current = false;
          reset();
          if (openRef.current) onOpenChange(false);
          return;
        }
        if (readback.outcome === "idempotency_conflict") {
          setPersistedKnownSuccess(persistedContext);
          setErrorCode("READBACK_IDEMPOTENCY_CONFLICT");
          return;
        }
        if (requestId === mutationRequestIdRef.current) {
          if (readback.outcome === "invalid") {
            setPersistedKnownSuccess(persistedContext);
            setErrorCode("READBACK_INVALID");
          } else {
            setPersistedKnownSuccess(persistedContext);
            setErrorCode("READBACK_NOT_FOUND");
          }
        }
        return;
      } catch (cause) {
        if (requestId === mutationRequestIdRef.current) {
          const failure = cause as SupplierBatchReadbackFailure;
          setPersistedKnownSuccess(persistedContext);
          setErrorCode(failure.timedOut ? "REFRESH_TIMEOUT" : "REFRESH_FAILED");
        }
        return;
      }
    } catch (cause) {
      const apiError = cause as SupplierBatchCostApiError;
      if (requestId !== mutationRequestIdRef.current) return;
      if (timedOut) {
        setUncertainMutation(mutationContext);
        setErrorCode("MUTATION_TIMEOUT");
      } else if (apiError.unknownWrite) {
        setUncertainMutation(mutationContext);
        setErrorCode("MUTATION_UNKNOWN");
      } else {
        if (shouldInvalidateSupplierBatchPreviewForMutationError(apiError.code)) {
          setPreviewState(null);
        }
        setErrorCode(apiError.code ?? `ADMIN_SUPPLIER_BATCH_COST_${action.toUpperCase()}_UNAVAILABLE`);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (mutationAbortRef.current === controller) mutationAbortRef.current = null;
      if (requestId === mutationRequestIdRef.current) {
        mutationActiveRef.current = false;
        setPending(null);
      }
    }
  }

  async function verifyMutationReadback() {
    const context = uncertainMutation;
    const currentSnapshotKey = supplierBatchChargeFormFingerprint(
      form,
      manualAmounts,
      chargeId,
      idempotencyKey
    );
    if (
      context === null ||
      pending !== null ||
      mutationActiveRef.current ||
      previewState === null ||
      !isSupplierBatchPreviewCurrent(previewState.snapshotKey, currentSnapshotKey) ||
      context.snapshotKey !== currentSnapshotKey ||
      context.idempotencyKey !== idempotencyKey ||
      context.chargeId !== chargeId ||
      context.payloadFingerprint !== previewState.result.payloadFingerprint
    ) {
      if (context !== null) {
        setPreviewState(null);
        setUncertainMutation(null);
        setErrorCode("PREVIEW_REQUIRED");
      }
      return;
    }

    const requestId = mutationRequestIdRef.current + 1;
    mutationRequestIdRef.current = requestId;
    mutationActiveRef.current = true;
    setPending("refresh");
    setErrorCode(null);
    try {
      const readback = await performMutationReadback(requestId, context);
      if (requestId !== mutationRequestIdRef.current) return;
      if (readback.outcome === "matched" || readback.outcome === "correction_pending") {
        mutationActiveRef.current = false;
        reset();
        if (openRef.current) onOpenChange(false);
      } else if (readback.outcome === "idempotency_conflict") {
        setPreviewState(null);
        setUncertainMutation(null);
        setErrorCode("IDEMPOTENCY_CONFLICT");
      } else {
        setUncertainMutation(context);
        setErrorCode(readback.outcome === "invalid" ? "READBACK_INVALID" : "MUTATION_NOT_FOUND");
      }
    } catch (cause) {
      if (requestId === mutationRequestIdRef.current) {
        const failure = cause as SupplierBatchReadbackFailure;
        setUncertainMutation(context);
        setErrorCode(failure.timedOut ? "READBACK_TIMEOUT" : "READBACK_FAILED");
      }
    } finally {
      if (requestId === mutationRequestIdRef.current) {
        mutationActiveRef.current = false;
        setPending(null);
      }
    }
  }

  async function retryRefresh() {
    const context = persistedKnownSuccess;
    if (context === null || pending !== null || mutationActiveRef.current) return;
    setPending("refresh");
    setErrorCode(null);
    const requestId = mutationRequestIdRef.current + 1;
    mutationRequestIdRef.current = requestId;
    mutationActiveRef.current = true;
    try {
      const readback = await performMutationReadback(requestId, context);
      if (requestId !== mutationRequestIdRef.current) return;
      if (readback.outcome === "matched" || readback.outcome === "correction_pending") {
        mutationActiveRef.current = false;
        reset();
        if (openRef.current) onOpenChange(false);
      } else if (readback.outcome === "idempotency_conflict") {
        setPersistedKnownSuccess(context);
        setErrorCode("READBACK_IDEMPOTENCY_CONFLICT");
      } else if (readback.outcome === "invalid") {
        setPersistedKnownSuccess(context);
        setErrorCode("READBACK_INVALID");
      } else {
        setPersistedKnownSuccess(context);
        setErrorCode("READBACK_NOT_FOUND");
      }
    } catch (cause) {
      if (requestId === mutationRequestIdRef.current) {
        const failure = cause as SupplierBatchReadbackFailure;
        setPersistedKnownSuccess(context);
        setErrorCode(failure.timedOut ? "REFRESH_TIMEOUT" : "REFRESH_FAILED");
      }
    } finally {
      if (requestId === mutationRequestIdRef.current) {
        mutationActiveRef.current = false;
        setPending(null);
      }
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    const mutationPending = pending === "estimate" || pending === "confirm" || pending === "correct" || pending === "refresh";
    if (!nextOpen && (mutationActiveRef.current || mutationPending || persistedKnownSuccess !== null || uncertainMutation !== null)) {
      return;
    }
    if (!nextOpen) {
      if (draftDirty) {
        setCloseGuardOpen(true);
        return;
      }
      initialisedRef.current = null;
      reset();
    }
    onOpenChange(nextOpen);
  }

  function requestConfirm() {
    if (!canConfirmCosts) {
      setErrorCode("ADMIN_FORBIDDEN");
      return;
    }
    void runMutation("confirm");
  }

  function requestCorrection() {
    if (!canCorrectCosts) {
      setErrorCode("ADMIN_FORBIDDEN");
      return;
    }
    void runMutation("correct");
  }

  function discardDraftAndClose() {
    setCloseGuardOpen(false);
    initialisedRef.current = null;
    reset();
    onOpenChange(false);
  }

  const currentSnapshotKey = supplierBatchChargeFormFingerprint(
    form,
    manualAmounts,
    chargeId,
    idempotencyKey
  );
  const previewCurrent = previewState !== null && isSupplierBatchPreviewCurrent(
    previewState.snapshotKey,
    currentSnapshotKey
  );
  const canSaveEstimate = canUseForm &&
    previewCurrent &&
    pending === null &&
    persistedKnownSuccess === null &&
    uncertainMutation === null;
  const canConfirm = canUseForm &&
    canConfirmCosts &&
    pending === null &&
    persistedKnownSuccess === null &&
    uncertainMutation === null &&
    canConfirmSupplierBatchCharge(
      previewCurrent,
      form.vatTreatment,
      previewState?.result.confirmationBlocked
    );
  const canCorrect = isCorrectionMode &&
    canUseForm &&
    canCorrectCosts &&
    pending === null &&
    persistedKnownSuccess === null &&
    uncertainMutation === null &&
    form.correctionReason.trim().length > 0 &&
    canCorrectSupplierBatchCharge(
      previewCurrent,
      form.vatTreatment,
      previewState?.result.confirmationBlocked,
      previewState?.result.confirmationBlockCode
    );

  const parsedAmountNet = parseSupplierBatchMoneyInput(form.amountNet);
  const parsedVatAmount = parseSupplierBatchMoneyInput(form.vatAmount);
  const parsedCapitalizedAmount = parseSupplierBatchMoneyInput(form.capitalizedAmount);
  const grossCents = parsedAmountNet.cents !== null && parsedVatAmount.cents !== null
    ? parsedAmountNet.cents + parsedVatAmount.cents
    : null;
  const showZeroCostReason = parsedCapitalizedAmount.cents === 0 || Boolean(fieldErrors.zeroCostReason);
  const canUseNetAmount = parsedAmountNet.cents !== null;
  const canUseGrossAmount = grossCents !== null;
  const hasAdvancedFieldErrors = ["carrierName", "reference", "occurredAt", "evidenceUrl", "notes"].some((field) => Boolean(fieldErrors[field]));
  const formCurrency = normalizeSupplierBatchCurrency(form.currency);
  const batchCurrency = normalizeSupplierBatchCurrency(detail.batch.currency);
  const batchGoodsFxSnapshotLocked = batchCurrency !== "EUR" && [
    detail.batch.goodsValueEur,
    detail.batch.goodsValueFxRateToEur,
    detail.batch.goodsValueFxDate,
    detail.batch.goodsValueFxSource,
    detail.batch.goodsValueFxEvidenceUrl,
  ].some((value) => value !== null && value !== undefined && value !== "");
  const previewCurrency = normalizeSupplierBatchCurrency(
    (previewState?.result as unknown as Record<string, unknown> | null)?.currency ?? formCurrency
  );
  const errorMessage = errorCode === "NETWORK_ERROR"
    ? text.networkError
    : errorCode === "PREVIEW_TIMEOUT"
      ? text.timeout
    : errorCode === "MUTATION_TIMEOUT"
      ? text.mutationTimeout
    : errorCode === "MUTATION_UNKNOWN"
      ? text.mutationUnknown
    : errorCode === "MUTATION_NOT_FOUND"
      ? text.mutationNotFound
    : errorCode === "READBACK_TIMEOUT" || errorCode === "REFRESH_TIMEOUT"
      ? text.readbackTimeout
    : errorCode === "READBACK_FAILED"
      ? text.readbackFailed
    : errorCode === "READBACK_INVALID"
      ? text.readbackInvalid
    : errorCode === "READBACK_IDEMPOTENCY_CONFLICT"
      ? text.readbackConflict
    : errorCode === "READBACK_NOT_FOUND"
      ? text.readbackNotFound
    : errorCode === "REFRESH_FAILED"
      ? text.refreshFailed
    : errorCode === "CONFIRM_VAT_REQUIRED"
      ? text.confirmVatRequired
    : errorCode === "INVALID_RESPONSE"
      ? text.invalidResponse
      : errorCode === "PREVIEW_REQUIRED"
        ? text.previewRequired
        : errorCode === "FINANCIAL_ADJUSTMENT_REQUIRED"
          ? text.previewBlocked
          : errorCode
            ? mapSupplierBatchCostErrorCode(errorCode, language)
            : null;
  const review = previewState ? reviewReason(previewState.result, language) : null;
  const actionDisabled = !canUseForm || pending !== null || persistedKnownSuccess !== null || uncertainMutation !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-modal={true} className="flex max-h-[94dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-6xl">
        <DialogHeader className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <DialogTitle>{isCorrectionMode ? text.correctionTitle : charge ? text.editTitle : text.title}</DialogTitle>
          <DialogDescription>{isCorrectionMode ? text.correctionDescription : text.description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {chargeIsReadOnly ? (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" role="status">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{text.nonEstimatedCharge}</span>
            </div>
          ) : !dualPermission ? (
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{text.noManage}</span>
            </div>
          ) : (
            <>
              {errorMessage || pending === "refresh" ? (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" aria-live="polite">
                  <XCircle className="mt-0.5 size-4 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span>{errorMessage ?? text.refreshPending}</span>
                    {persistedKnownSuccess !== null ? (
                      <Button size="xs" variant="outline" className="bg-white" onClick={() => void retryRefresh()} disabled={pending !== null}>
                        {pending === "refresh" ? <Loader2 className="size-3 animate-spin" /> : null}
                        {text.retryRefresh}
                      </Button>
                    ) : null}
                    {uncertainMutation !== null ? (
                      <>
                        <Button size="xs" variant="outline" className="bg-white" onClick={() => void verifyMutationReadback()} disabled={pending !== null}>
                          {pending === "refresh" ? <Loader2 className="size-3 animate-spin" /> : null}
                          {text.verifyReadback}
                        </Button>
                        <Button size="xs" variant="outline" className="bg-white" onClick={() => void runMutation(uncertainMutation.action)} disabled={pending !== null}>
                          {pending === uncertainMutation.action ? <Loader2 className="size-3 animate-spin" /> : null}
                        {text.retryMutation}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <section className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 sm:p-4" aria-labelledby="supplier-cost-step-1">
                <div className="mb-4">
                  <h3 id="supplier-cost-step-1" className="text-sm font-bold text-slate-950">{text.step1Title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{text.step1Description}</p>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field id="charge-type" label={text.chargeType} error={fieldErrorText(fieldErrors.chargeType, text)}>
                    <Select value={form.chargeType} onValueChange={(value) => updateField("chargeType", value as SupplierBatchChargeType)} disabled={actionDisabled}>
                      <SelectTrigger id="charge-type" aria-label={text.chargeType} aria-invalid={Boolean(fieldErrors.chargeType)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("charge-type", Boolean(fieldErrors.chargeType))}><SelectValue /></SelectTrigger>
                      <SelectContent>{CHARGE_TYPES.map((value) => <SelectItem key={value} value={value}>{text.typeLabels[value]}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field id="amount-net" label={text.amountNet} error={fieldErrorText(fieldErrors.amountNet, text)} description={text.amountHelp}>
                    <Input id="amount-net" inputMode="decimal" value={form.amountNet} onChange={(event) => updateField("amountNet", event.target.value)} aria-invalid={Boolean(fieldErrors.amountNet)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("amount-net", Boolean(fieldErrors.amountNet), true)} disabled={actionDisabled} />
                  </Field>
                  <Field id="vat-amount" label={text.vatAmount} error={fieldErrorText(fieldErrors.vatAmount, text)} description={text.vatPresetHelp}>
                    <Input id="vat-amount" inputMode="decimal" value={form.vatAmount} onChange={(event) => updateField("vatAmount", event.target.value)} aria-invalid={Boolean(fieldErrors.vatAmount)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("vat-amount", Boolean(fieldErrors.vatAmount), true)} disabled={actionDisabled} />
                    <div className="flex flex-wrap gap-1" aria-label={text.vatPresets}>
                      {[0, 10, 22].map((rate) => (
                        <Button key={rate} type="button" size="xs" variant="ghost" className="h-6 px-1.5 text-[11px]" disabled={actionDisabled || parsedAmountNet.value === null} onClick={() => {
                          const net = parsedAmountNet.value ?? 0;
                          updateField("vatAmount", (net * rate / 100).toFixed(2));
                        }}>{rate}%</Button>
                      ))}
                    </div>
                  </Field>
                  <Field id="gross" label={text.gross}>
                    <Input id="gross" className="bg-slate-100 text-slate-700" value={grossCents === null ? "—" : formatCents(grossCents)} readOnly tabIndex={-1} />
                  </Field>
                  <Field id="currency" label={text.currency} description={text.currencyHelp}>
                    <Select value={formCurrency} onValueChange={updateCurrency} disabled={actionDisabled}>
                      <SelectTrigger id="currency" aria-label={text.currency}><SelectValue /></SelectTrigger>
                      <SelectContent>{SUPPLIER_BATCH_CURRENCIES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  {formCurrency !== "EUR" ? (
                    <>
                      <Field id="fx-rate-to-eur" label={text.fxRateToEur} error={fieldErrorText(fieldErrors.fxRateToEur, text)} description={text.fxRateHelp}>
                        <Input id="fx-rate-to-eur" inputMode="decimal" value={form.fxRateToEur} onChange={(event) => updateField("fxRateToEur", event.target.value)} aria-invalid={Boolean(fieldErrors.fxRateToEur)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("fx-rate-to-eur", Boolean(fieldErrors.fxRateToEur), true)} disabled={actionDisabled} />
                      </Field>
                      <Field id="fx-rate-date" label={text.fxRateDate} error={fieldErrorText(fieldErrors.fxRateDate, text)}>
                        <Input id="fx-rate-date" type="date" value={form.fxRateDate} onChange={(event) => updateField("fxRateDate", event.target.value)} aria-invalid={Boolean(fieldErrors.fxRateDate)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("fx-rate-date", Boolean(fieldErrors.fxRateDate))} disabled={actionDisabled} />
                      </Field>
                      <Field id="fx-rate-source" label={text.fxRateSource} error={fieldErrorText(fieldErrors.fxRateSource, text)}>
                        <Input id="fx-rate-source" value={form.fxRateSource} onChange={(event) => updateField("fxRateSource", event.target.value)} aria-invalid={Boolean(fieldErrors.fxRateSource)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("fx-rate-source", Boolean(fieldErrors.fxRateSource))} disabled={actionDisabled} />
                      </Field>
                      <Field id="fx-evidence-url" label={text.fxEvidenceUrl} error={fieldErrorText(fieldErrors.fxEvidenceUrl, text)} description={text.fxEvidenceHelp}>
                        <Input id="fx-evidence-url" type="url" value={form.fxEvidenceUrl} onChange={(event) => updateField("fxEvidenceUrl", event.target.value)} aria-invalid={Boolean(fieldErrors.fxEvidenceUrl)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("fx-evidence-url", Boolean(fieldErrors.fxEvidenceUrl), true)} disabled={actionDisabled} />
                      </Field>
                    </>
                  ) : null}
                  {normalizeSupplierBatchCurrency(detail.batch.currency) !== "EUR" ? (
                    <section className="col-span-full rounded-lg border border-indigo-200 bg-indigo-50/60 p-3" aria-label={text.goodsFxSnapshot}>
                      <div className="mb-2">
                        <h4 className="text-sm font-bold text-slate-950">{text.goodsFxSnapshot}</h4>
                        <p className="mt-1 text-xs text-slate-600">{batchGoodsFxSnapshotLocked ? text.goodsFxLocked : text.goodsFxRequired}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field id="batch-goods-fx-rate-to-eur" label={text.goodsFxRateToEur} error={fieldErrorText(fieldErrors.batchGoodsValueFxRateToEur, text)}>
                          <Input id="batch-goods-fx-rate-to-eur" inputMode="decimal" value={form.batchGoodsValueFxRateToEur} onChange={(event) => updateField("batchGoodsValueFxRateToEur", event.target.value)} aria-invalid={Boolean(fieldErrors.batchGoodsValueFxRateToEur)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("batch-goods-fx-rate-to-eur", Boolean(fieldErrors.batchGoodsValueFxRateToEur))} disabled={actionDisabled || batchGoodsFxSnapshotLocked} />
                        </Field>
                        <Field id="batch-goods-fx-date" label={text.goodsFxDate} error={fieldErrorText(fieldErrors.batchGoodsValueFxDate, text)}>
                          <Input id="batch-goods-fx-date" type="date" value={form.batchGoodsValueFxDate} onChange={(event) => updateField("batchGoodsValueFxDate", event.target.value)} aria-invalid={Boolean(fieldErrors.batchGoodsValueFxDate)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("batch-goods-fx-date", Boolean(fieldErrors.batchGoodsValueFxDate))} disabled={actionDisabled || batchGoodsFxSnapshotLocked} />
                        </Field>
                        <Field id="batch-goods-fx-source" label={text.goodsFxSource} error={fieldErrorText(fieldErrors.batchGoodsValueFxSource, text)}>
                          <Input id="batch-goods-fx-source" value={form.batchGoodsValueFxSource} onChange={(event) => updateField("batchGoodsValueFxSource", event.target.value)} aria-invalid={Boolean(fieldErrors.batchGoodsValueFxSource)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("batch-goods-fx-source", Boolean(fieldErrors.batchGoodsValueFxSource))} disabled={actionDisabled || batchGoodsFxSnapshotLocked} />
                        </Field>
                        <Field id="batch-goods-fx-evidence-url" label={text.goodsFxEvidenceUrl} error={fieldErrorText(fieldErrors.batchGoodsValueFxEvidenceUrl, text)} description={text.fxEvidenceHelp}>
                          <Input id="batch-goods-fx-evidence-url" type="url" value={form.batchGoodsValueFxEvidenceUrl} onChange={(event) => updateField("batchGoodsValueFxEvidenceUrl", event.target.value)} aria-invalid={Boolean(fieldErrors.batchGoodsValueFxEvidenceUrl)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("batch-goods-fx-evidence-url", Boolean(fieldErrors.batchGoodsValueFxEvidenceUrl), true)} disabled={actionDisabled || batchGoodsFxSnapshotLocked} />
                        </Field>
                      </div>
                    </section>
                  ) : null}
                </div>
              </section>

              <section className="mt-4 rounded-lg border border-slate-200/80 bg-white p-3 sm:p-4" aria-labelledby="supplier-cost-step-2">
                <div className="mb-4">
                  <h3 id="supplier-cost-step-2" className="text-sm font-bold text-slate-950">{text.step2Title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{text.step2Description}</p>
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-3">
                  <Field id="capitalized-amount" label={text.capitalizedAmount} error={fieldErrorText(fieldErrors.capitalizedAmount, text)} description={text.capitalizedHelp}>
                    <Input id="capitalized-amount" inputMode="decimal" value={form.capitalizedAmount} onChange={(event) => updateField("capitalizedAmount", event.target.value)} aria-invalid={Boolean(fieldErrors.capitalizedAmount)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("capitalized-amount", Boolean(fieldErrors.capitalizedAmount), true)} disabled={actionDisabled} />
                    <div className="flex flex-wrap gap-1.5 pt-1" aria-label={text.capitalizedAmount}>
                      <Button type="button" size="xs" variant="outline" className="h-7 text-[11px]" disabled={actionDisabled || !canUseNetAmount} onClick={() => {
                        if (parsedAmountNet.cents !== null) updateField("capitalizedAmount", formatCentsForInput(parsedAmountNet.cents));
                      }}>{text.useNetAmount}</Button>
                      <Button type="button" size="xs" variant="outline" className="h-7 text-[11px]" disabled={actionDisabled || !canUseGrossAmount} onClick={() => {
                        if (grossCents !== null) updateField("capitalizedAmount", formatCentsForInput(grossCents));
                      }}>{text.useGrossAmount}</Button>
                    </div>
                  </Field>
                  <Field id="vat-treatment" label={text.vatTreatment} error={fieldErrorText(fieldErrors.vatTreatment, text)}>
                    <Select value={form.vatTreatment} onValueChange={(value) => updateField("vatTreatment", value as SupplierBatchVatTreatment)} disabled={actionDisabled}>
                      <SelectTrigger id="vat-treatment" aria-label={text.vatTreatment} aria-invalid={Boolean(fieldErrors.vatTreatment)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("vat-treatment", Boolean(fieldErrors.vatTreatment))}><SelectValue /></SelectTrigger>
                      <SelectContent>{VAT_TREATMENTS.map((value) => <SelectItem key={value} value={value}>{text.vatLabels[value]}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field id="allocation-method" label={text.allocationMethod} error={fieldErrorText(fieldErrors.allocationMethod, text)} description={manualLimitExceeded && form.allocationMethod !== "manual" ? text.manualLimit : undefined}>
                    <Select value={form.allocationMethod} onValueChange={(value) => updateField("allocationMethod", value as SupplierBatchAllocationMethod)} disabled={actionDisabled}>
                      <SelectTrigger id="allocation-method" aria-label={text.allocationMethod} aria-invalid={Boolean(fieldErrors.allocationMethod)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("allocation-method", Boolean(fieldErrors.allocationMethod), manualLimitExceeded && form.allocationMethod !== "manual")}><SelectValue /></SelectTrigger>
                      <SelectContent>{ALLOCATION_METHODS.map((value) => <SelectItem key={value} value={value} disabled={value === "manual" && manualLimitExceeded}>{text.allocationLabels[value]}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                {showZeroCostReason ? (
                  <div className="mt-4 max-w-xl">
                    <Field id="zero-cost-reason" label={text.zeroCostReason} error={fieldErrorText(fieldErrors.zeroCostReason, text)} description={text.zeroCostHelp}>
                      <Input id="zero-cost-reason" value={form.zeroCostReason} onChange={(event) => updateField("zeroCostReason", event.target.value)} aria-invalid={Boolean(fieldErrors.zeroCostReason)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("zero-cost-reason", Boolean(fieldErrors.zeroCostReason), true)} disabled={actionDisabled} />
                    </Field>
                  </div>
                ) : null}
              </section>

              {isCorrectionMode ? (
                <section className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Field id="correction-reason" label={text.correctionReason} error={fieldErrorText(fieldErrors.correctionReason, text)} description={text.correctionReasonHelp}>
                    <Textarea
                      id="correction-reason"
                      value={form.correctionReason}
                      onChange={(event) => updateField("correctionReason", event.target.value)}
                      aria-invalid={Boolean(fieldErrors.correctionReason)}
                      aria-describedby={buildSupplierBatchFieldAriaDescribedBy("correction-reason", Boolean(fieldErrors.correctionReason), true)}
                      disabled={actionDisabled}
                    />
                  </Field>
                </section>
              ) : null}

              <details
                className="mt-4 rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 sm:p-4"
                open={advancedOpen || hasAdvancedFieldErrors}
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
              >
                <summary className="cursor-pointer list-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                  <span className="text-sm font-bold text-slate-950">{text.step3Title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{text.step3Description}</span>
                </summary>
                <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field id="carrier-name" label={text.carrierName} error={fieldErrorText(fieldErrors.carrierName, text)}><Input id="carrier-name" value={form.carrierName} onChange={(event) => updateField("carrierName", event.target.value)} aria-invalid={Boolean(fieldErrors.carrierName)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("carrier-name", Boolean(fieldErrors.carrierName))} disabled={actionDisabled} /></Field>
                  <Field id="reference" label={text.reference} error={fieldErrorText(fieldErrors.reference, text)}><Input id="reference" value={form.reference} onChange={(event) => updateField("reference", event.target.value)} aria-invalid={Boolean(fieldErrors.reference)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("reference", Boolean(fieldErrors.reference))} disabled={actionDisabled} /></Field>
                  <Field id="occurred-at" label={text.occurredAt} error={fieldErrorText(fieldErrors.occurredAt, text)} description={text.timezone}><Input id="occurred-at" type="datetime-local" value={form.occurredAt} onChange={(event) => updateField("occurredAt", event.target.value)} aria-invalid={Boolean(fieldErrors.occurredAt)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("occurred-at", Boolean(fieldErrors.occurredAt), true)} disabled={actionDisabled} /></Field>
                  <Field id="evidence-url" label={text.evidenceUrl} error={fieldErrorText(fieldErrors.evidenceUrl, text)}><Input id="evidence-url" type="url" value={form.evidenceUrl} onChange={(event) => updateField("evidenceUrl", event.target.value)} aria-invalid={Boolean(fieldErrors.evidenceUrl)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("evidence-url", Boolean(fieldErrors.evidenceUrl))} disabled={actionDisabled} /></Field>
                  <div className="sm:col-span-2 lg:col-span-2">
                    <Field id="notes" label={text.notes} error={fieldErrorText(fieldErrors.notes, text)}><Textarea id="notes" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} aria-invalid={Boolean(fieldErrors.notes)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("notes", Boolean(fieldErrors.notes))} disabled={actionDisabled} /></Field>
                  </div>
                </div>
              </details>

              {form.allocationMethod === "manual" ? (
                <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label={text.manual}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">{text.manual}</h3>
                      <p className="mt-1 text-xs text-slate-500">{text.manualHelp}</p>
                    </div>
                    <Badge className={manualLimitExceeded || manualSummary.differenceCents !== 0 ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}>
                      {manualLines.length}/{MAX_MANUAL_ROWS}
                    </Badge>
                  </div>
                  {manualLimitExceeded ? <p className="mt-2 text-xs font-semibold text-amber-700">{text.manualLimit}</p> : null}
                  {manualLines.length === 0 ? <p className="mt-2 text-xs text-slate-500">{text.manualNone}</p> : null}
                  {manualLines.length > 0 && !manualLimitExceeded ? (
                    <div className="mt-3 overflow-x-auto">
                      <Table className="min-w-[760px] text-xs">
                        <TableHeader><TableRow><TableHead>{text.line}</TableHead><TableHead>{text.sku}</TableHead><TableHead>{text.productName}</TableHead><TableHead>{text.manual}</TableHead></TableRow></TableHeader>
                        <TableBody>{manualLines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="font-mono">{line.lineNo}</TableCell>
                            <TableCell className="font-mono">{line.skuCode ?? "—"}</TableCell>
                            <TableCell>{line.name ?? "—"}</TableCell>
                            <TableCell><Input id={`manual-${line.id}`} className="h-8 max-w-36" inputMode="decimal" value={manualAmounts[line.id] ?? ""} onChange={(event) => updateManualAmount(line.id, event.target.value)} aria-label={formatSupplierBatchCostLineLabel(line, language)} aria-invalid={Boolean(fieldErrors[`manualAllocations.${line.id}`] ?? fieldErrors.manualAllocations)} aria-describedby={(fieldErrors[`manualAllocations.${line.id}`] ?? fieldErrors.manualAllocations) ? "manual-allocations-error" : undefined} disabled={actionDisabled} /></TableCell>
                          </TableRow>
                        ))}</TableBody>
                      </Table>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
                    <span>{text.manualTotal}: {formatCents(manualSummary.totalCents)}</span>
                    <span className={manualSummary.differenceCents === 0 ? "text-emerald-700" : "text-amber-700"}>{text.manualDifference}: {manualSummary.differenceCents === null ? "—" : formatCents(manualSummary.differenceCents)}</span>
                  </div>
                  {fieldErrorText(fieldErrors.manualAllocations, text) ? <p id="manual-allocations-error" className="mt-1 text-xs font-semibold text-red-700" role="alert">{fieldErrorText(fieldErrors.manualAllocations, text)}</p> : null}
                </section>
              ) : null}

              {form.allocationMethod === "weight" && missingWeightCount > 0 ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800" role="status">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{text.weightMissing(missingWeightCount)}</span>
                </div>
              ) : null}

              {previewState ? (
                <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3" aria-live="polite">
                  <div className="flex flex-wrap items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-700" />
                    <h3 className="text-sm font-bold text-slate-950">{text.preview}</h3>
                    {previewState.result.confirmationBlocked ? <Badge className="border border-amber-200 bg-amber-50 text-amber-700">{text.review}</Badge> : null}
                  </div>
                  {review ? <p className="mt-2 text-xs font-semibold text-amber-800">{review}</p> : null}
                  {isCorrectionMode &&
                  (previewState.result.confirmationBlockCode === "FINANCIAL_ADJUSTMENT_REQUIRED" ||
                    previewState.result.confirmationBlockCode === "FINANCE_ADJUSTMENT_REQUIRED") ? (
                    <p className="mt-2 text-xs font-semibold text-amber-800">{text.correctionPending}</p>
                  ) : null}
                  {form.vatTreatment === "unknown" ? <p className="mt-2 text-xs font-semibold text-amber-800">{text.confirmVatRequired}</p> : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label={text.previewSummary}>
                    {isCorrectionMode && previewState.result.correctionTotals ? (
                      <>
                        <PreviewMetric label={text.correctionOtherTotal} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.otherEffectiveCostEurCents, language)} />
                        <PreviewMetric label={text.correctionBeforeTotal} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.beforeTotalEurCents, language)} />
                        <PreviewMetric label={text.correctionReplacement} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.replacementChargeEurCents, language)} />
                        <PreviewMetric label={text.correctionAfterTotal} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.afterTotalEurCents, language)} />
                        <PreviewMetric label={text.correctionCostDelta} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.costDeltaEurCents, language)} />
                        <PreviewMetric label={text.rounding} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["roundingAdjustmentCents", "rounding_adjustment_cents"], ["roundingAdjustment"]), previewBaseCents(previewState.result, ["roundingAdjustmentBaseCents"]), language)} />
                      </>
                    ) : (
                      <>
                        <PreviewMetric label={text.capitalized} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["capitalizedAmountCents", "capitalized_amount_cents"], ["capitalizedAmount"]), previewBaseCents(previewState.result, ["baseCapitalizedAmountCents", "capitalizedAmountBaseCents"]), language)} />
                        <PreviewMetric label={text.candidateTotal} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["candidateAllocationTotalCents", "candidate_allocation_total_cents"], ["candidateAllocationTotal"]), previewBaseCents(previewState.result, ["candidateAllocationTotalBaseCents", "baseCandidateAllocationTotalCents"]), language)} />
                        <PreviewMetric label={text.currentConfirmed} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["confirmedAllocationTotalCents", "confirmed_allocation_total_cents"], ["confirmedAllocationTotal"]), previewBaseCents(previewState.result, ["baseConfirmedAllocationTotalCents"]), language)} />
                        <PreviewMetric label={text.projectedTotal} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["allocationTotalCents", "allocation_total_cents"], ["allocationTotal"]), previewBaseCents(previewState.result, ["allocationTotalBaseCents", "baseAllocationTotalCents"]), language)} />
                        <PreviewMetric label={text.difference} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["candidateAllocationDifferenceCents", "candidate_allocation_difference_cents"], ["candidateAllocationDifference"]), previewBaseCents(previewState.result, ["candidateAllocationDifferenceBaseCents"]), language)} />
                        <PreviewMetric label={text.rounding} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["roundingAdjustmentCents", "rounding_adjustment_cents"], ["roundingAdjustment"]), previewBaseCents(previewState.result, ["roundingAdjustmentBaseCents"]), language)} />
                      </>
                    )}
                    <PreviewMetric label={text.validRows} value={String(previewState.result.lineProjections.length)} />
                    <PreviewMetric label={text.missingRows} value={String(missingWeightCount)} />
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <Table className="min-w-[950px] text-xs">
                      <TableHeader><TableRow><TableHead>{text.line}</TableHead><TableHead>{text.sku}</TableHead><TableHead>{isCorrectionMode ? text.correctionCurrentAllocation : text.currentAllocation}</TableHead><TableHead>{isCorrectionMode ? text.correctionCandidateAllocation : text.candidateAllocation}</TableHead><TableHead>{isCorrectionMode ? text.correctionCurrentLandedLine : text.currentLandedLine}</TableHead><TableHead>{isCorrectionMode ? text.correctionProjectedLandedLine : text.projectedLandedLine}</TableHead><TableHead>{isCorrectionMode ? text.correctionCurrentLandedUnit : text.currentLandedUnit}</TableHead><TableHead>{isCorrectionMode ? text.correctionProjectedLandedUnit : text.projectedLandedUnit}</TableHead></TableRow></TableHeader>
                      <TableBody>{previewState.result.lineProjections.map((line) => (
                        <TableRow key={line.batchLineId}>
                          <TableCell className="font-mono">{line.lineNo}</TableCell>
                          <TableCell className="font-mono">{line.skuCode ?? "—"}</TableCell>
                          <TableCell>{isCorrectionMode ? formatCorrectionPreviewLineCents(line, "currentAllocationEurCents", language) : formatPreviewLineCents(previewState.result, line, line.currentAllocationCents, line.currentAllocationEurCents, language)}</TableCell>
                          <TableCell>{isCorrectionMode ? formatCorrectionPreviewLineCents(line, "candidateAllocationEurCents", language) : formatPreviewLineCents(previewState.result, line, line.candidateAllocationCents, line.candidateAllocationEurCents, language)}</TableCell>
                          <TableCell>{isCorrectionMode ? formatCorrectionPreviewLineCents(line, "currentLandedLineCostEurCents", language) : formatPreviewLineCents(previewState.result, line, line.currentLandedLineCostCents, line.currentLandedLineCostEurCents, language)}</TableCell>
                          <TableCell>{isCorrectionMode ? formatCorrectionPreviewLineCents(line, "projectedLandedLineCostEurCents", language) : formatPreviewLineCents(previewState.result, line, line.projectedLandedLineCostCents, line.projectedLandedLineCostEurCents, language)}</TableCell>
                          <TableCell>{isCorrectionMode ? formatCorrectionPreviewLineUnit(line, "currentLandedUnitCostEur", language) : formatPreviewLineUnit(line, line.currentLandedUnitCost, line.currentLandedUnitCostEur, language, previewCurrency)}</TableCell>
                          <TableCell>{isCorrectionMode ? formatCorrectionPreviewLineUnit(line, "projectedLandedUnitCostEur", language) : formatPreviewLineUnit(line, line.projectedLandedUnitCost, line.projectedLandedUnitCostEur, language, previewCurrency)}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-blue-800">{text.previewReady}</p>
                </section>
              ) : null}
            </>
          )}
        </div>

        <DialogFooter className="m-0 rounded-none border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending === "estimate" || pending === "confirm" || pending === "correct" || pending === "refresh" || persistedKnownSuccess !== null || uncertainMutation !== null}
          >
            {dualPermission ? text.cancel : text.close}
          </Button>
          {canUseForm ? (
            <>
              <Button variant="outline" onClick={() => void runPreview()} disabled={actionDisabled}>
                {pending === "preview" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {text.nextStep}
              </Button>
              {previewState ? (
                <>
                  {isCorrectionMode ? (
                    <Button variant="destructive" onClick={requestCorrection} disabled={!canCorrect}>
                      {pending === "correct" ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
                      {text.correctionProceed}
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => void runMutation("estimate")} disabled={!canSaveEstimate}>
                        {pending === "estimate" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {text.saveEstimate}
                      </Button>
                      <Button variant="destructive" onClick={requestConfirm} disabled={!canConfirm}>
                        {pending === "confirm" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        {text.confirm}
                      </Button>
                    </>
                  )}
                </>
              ) : null}
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
      <DialogContent aria-modal={true} className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCorrectionMode ? text.correctionTitle : text.confirmSummaryTitle}</DialogTitle>
          <DialogDescription>{isCorrectionMode ? text.correctionDescription : text.confirmSummaryDescription}</DialogDescription>
        </DialogHeader>
        {previewState ? (
          <div className="grid gap-2 sm:grid-cols-2" aria-label={text.previewSummary}>
            {isCorrectionMode && previewState.result.correctionTotals ? (
              <>
                <PreviewMetric label={text.correctionBeforeTotal} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.beforeTotalEurCents, language)} />
                <PreviewMetric label={text.correctionReplacement} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.replacementChargeEurCents, language)} />
                <PreviewMetric label={text.correctionAfterTotal} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.afterTotalEurCents, language)} />
                <PreviewMetric label={text.correctionCostDelta} value={formatCorrectionPreviewEurCents(previewState.result.correctionTotals.costDeltaEurCents, language)} />
                <PreviewMetric label={text.rounding} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["roundingAdjustmentCents"], ["roundingAdjustment"]), previewBaseCents(previewState.result, ["baseRoundingAdjustmentCents"]), language)} />
              </>
            ) : (
              <>
                <PreviewMetric label={text.capitalized} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["capitalizedAmountCents"], ["capitalizedAmount"]), previewBaseCents(previewState.result, ["baseCapitalizedAmountCents"]), language)} />
                <PreviewMetric label={text.candidateTotal} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["candidateAllocationTotalCents"], ["candidateAllocationTotal"]), previewBaseCents(previewState.result, ["candidateAllocationTotalBaseCents"]), language)} />
                <PreviewMetric label={text.difference} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["candidateAllocationDifferenceCents"], ["candidateAllocationDifference"]), previewBaseCents(previewState.result, ["candidateAllocationDifferenceBaseCents"]), language)} />
                <PreviewMetric label={text.projectedTotal} value={formatPreviewAmount(previewState.result, previewCents(previewState.result, ["allocationTotalCents"], ["allocationTotal"]), previewBaseCents(previewState.result, ["allocationTotalBaseCents"]), language)} />
              </>
            )}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setConfirmDialogOpen(false)}>{text.confirmBack}</Button>
          <Button type="button" variant="destructive" disabled={(isCorrectionMode ? !canCorrect : !canConfirm) || pending !== null} onClick={() => {
            confirmGateRef.current = true;
            setConfirmDialogOpen(false);
            void runMutation(isCorrectionMode ? "correct" : "confirm", true);
          }}>
            {pending === "confirm" || pending === "correct" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {isCorrectionMode ? text.correctionProceed : text.confirmProceed}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
      <Dialog open={closeGuardOpen} onOpenChange={setCloseGuardOpen}>
      <DialogContent aria-modal={true} className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{text.draftGuardTitle}</DialogTitle>
          <DialogDescription>{text.draftGuardDescription}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setCloseGuardOpen(false)}>{text.draftGuardKeep}</Button>
          <Button type="button" variant="destructive" onClick={discardDraftAndClose}>{text.draftGuardDiscard}</Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  children,
  description,
  error,
  id,
  label,
}: {
  children: React.ReactNode;
  description?: string;
  error?: string | null;
  id?: string;
  label: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs font-semibold leading-5 text-slate-700">{label}</Label>
      {children}
      {description ? <p id={id ? `${id}-description` : undefined} className="text-[11px] leading-4 text-slate-500">{description}</p> : null}
      {error ? <p id={id ? `${id}-error` : undefined} className="text-[11px] font-semibold leading-4 text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-blue-100 bg-white/80 p-2">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black text-slate-950">{value}</div>
    </div>
  );
}
