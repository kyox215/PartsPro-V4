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
import { formatEuro } from "@/lib/partspro-data";
import {
  normalizeSupplierBatchCostRpcResult,
  type SupplierBatchAllocationMethod,
  type SupplierBatchCharge,
  type SupplierBatchChargeType,
  type SupplierBatchCostRpcResult,
  type SupplierBatchCostRpcPreviewResult,
  type SupplierBatchVatTreatment,
} from "@/lib/partspro-supplier-batch-cost-core.mjs";
import {
  supplierBatchChargeConfirmSchema,
  supplierBatchChargeEstimateSchema,
  supplierBatchChargePreviewSchema,
} from "@/lib/partspro-supplier-batch-cost-input-schema.mjs";
import {
  formatSupplierBatchUnitCost,
  type SupplierBatchCostDetail,
  type SupplierBatchCostLanguage,
} from "./supplier-batch-transport-cost-card";

export type SupplierBatchChargeDialogMode = "create" | "edit";

export type SupplierBatchChargeFormValues = {
  allocationMethod: SupplierBatchAllocationMethod;
  amountNet: string;
  capitalizedAmount: string;
  carrierName: string;
  chargeType: SupplierBatchChargeType;
  evidenceUrl: string;
  notes: string;
  occurredAt: string;
  reference: string;
  vatAmount: string;
  vatTreatment: SupplierBatchVatTreatment;
  zeroCostReason: string;
};

export type SupplierBatchMoneyParseResult = {
  cents: number | null;
  error: "format" | "required" | null;
  value: number | null;
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

const copy = {
  zh: {
    title: "登记运输 / 到货费用",
    editTitle: "编辑预估费用",
    description: "先预览分摊结果，再保存预估或确认正式成本。关闭后本次未保存草稿不会保留。",
    chargeType: "费用类型",
    amountNet: "净额",
    vatAmount: "IVA",
    gross: "含税额（自动）",
    capitalizedAmount: "资本化金额",
    currency: "币种",
    vatTreatment: "IVA 处理",
    allocationMethod: "分摊方式",
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
    cancel: "取消",
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
    description: "Esegui l'anteprima, poi salva la stima o conferma il costo definitivo. La bozza non salvata si perde alla chiusura.",
    chargeType: "Tipo costo",
    amountNet: "Netto",
    vatAmount: "IVA",
    gross: "Lordo (automatico)",
    capitalizedAmount: "Importo capitalizzato",
    currency: "Valuta",
    vatTreatment: "Trattamento IVA",
    allocationMethod: "Metodo ripartizione",
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
    cancel: "Annulla",
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
  canManageCosts: boolean
): boolean {
  return canReadCosts && canManageCosts && (charge === null || charge.status === "estimated");
}

export function canConfirmSupplierBatchCharge(
  previewCurrent: boolean,
  vatTreatment: SupplierBatchVatTreatment,
  confirmationBlocked: boolean | null | undefined
): boolean {
  return previewCurrent && vatTreatment !== "unknown" && confirmationBlocked !== true;
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
  | "not_found"
  | "idempotency_conflict"
  | "invalid";

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
    "STALE_REVISION",
    "FINANCIAL_ADJUSTMENT_REQUIRED",
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
    key === "ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE"
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
    "STALE_REVISION",
    "FINANCIAL_ADJUSTMENT_REQUIRED",
    "IDEMPOTENCY_CONFLICT",
    "CHARGE_IMMUTABLE",
    "CHARGE_CANCELLED",
    "CHARGE_NOT_FOUND",
    "BATCH_NOT_FOUND",
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

export function supplierBatchDateTimeLocalToIso(input: string): SupplierBatchDateTimeLocalResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: null, value: null };
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime())
    ? { error: "invalid", value: null }
    : { error: null, value: date.toISOString() };
}

export function supplierBatchDateTimeLocalFromIso(input: string | null): string {
  if (!input) {
    return "";
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  charge: SupplierBatchCharge | null,
  lines: readonly SupplierBatchCostLineLike[]
): SupplierBatchChargeFormResult {
  const form: SupplierBatchChargeFormValues = {
    allocationMethod: charge?.allocationMethod ?? "goods_value",
    amountNet: charge ? formatCentsForInput(charge.amountNetCents) : "",
    capitalizedAmount: charge ? formatCentsForInput(charge.capitalizedAmountCents) : "",
    carrierName: charge?.carrierName ?? "",
    chargeType: charge?.chargeType ?? "transport",
    evidenceUrl: charge?.evidenceUrl ?? "",
    notes: charge?.notes ?? "",
    occurredAt: supplierBatchDateTimeLocalFromIso(charge?.occurredAt ?? null),
    reference: charge?.reference ?? "",
    vatAmount: charge ? formatCentsForInput(charge.vatAmountCents) : "",
    vatTreatment: charge?.vatTreatment ?? "unknown",
    zeroCostReason: charge?.zeroCostReason ?? "",
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
  chargeId?: string
): SupplierBatchChargePayloadBuildResult {
  const fieldErrors: Record<string, string> = {};
  const amountNet = parseSupplierBatchMoneyInput(form.amountNet);
  const vatAmount = parseSupplierBatchMoneyInput(form.vatAmount);
  const capitalizedAmount = parseSupplierBatchMoneyInput(form.capitalizedAmount);

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
    currency: "EUR",
    evidenceUrl: form.evidenceUrl.trim() || null,
    idempotencyKey: idempotencyKey.trim(),
    notes: form.notes.trim() || null,
    occurredAt: occurredAt.value,
    reference: form.reference.trim() || null,
    vatAmount: vatAmount.value,
    vatTreatment: form.vatTreatment,
    zeroCostReason: form.zeroCostReason.trim() || null,
  };

  if (mode === "edit" && chargeId) {
    // Keep the persisted identity in every preview/save/confirm payload.
    payload.chargeId = chargeId;
  }
  if (revision !== undefined) payload.revision = revision;
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
    FINANCIAL_ADJUSTMENT_REQUIRED: {
      zh: "已有成本层需要财务调整，暂不能确认。",
      it: "Serve una rettifica finanziaria prima della conferma.",
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
    ADMIN_SUPPLIER_BATCH_COST_RPC_INVALID_RESPONSE: {
      zh: "服务返回的数据无法通过校验，未更新页面成本。",
      it: "La risposta del servizio non supera i controlli; i costi visualizzati non sono stati aggiornati.",
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

type SupplierBatchMutationAction = "estimate" | "confirm";
type SupplierBatchPendingAction = "preview" | SupplierBatchMutationAction | "refresh" | null;
type SupplierBatchMutationContext = {
  action: SupplierBatchMutationAction;
  chargeId: string | null;
  idempotencyKey: string;
  payloadFingerprint: string;
  snapshotKey: string;
};

function readApiErrorCode(payload: unknown): string | null {
  if (!isRecord(payload) || !isRecord(payload.error)) return null;
  return typeof payload.error.code === "string" ? payload.error.code : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function formatCents(cents: number | null): string {
  return cents === null ? "—" : formatEuro(cents / 100);
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
  charge,
  detail,
  language,
  onCostChanged,
  onOpenChange,
  open,
}: {
  canManageCosts: boolean;
  canReadCosts: boolean;
  charge: SupplierBatchCharge | null;
  detail: SupplierBatchCostDetail;
  language: SupplierBatchCostLanguage;
  /** Re-reads the server-owned batch detail/list after a successful mutation. */
  onCostChanged: (
    batchCode: string,
    signal?: AbortSignal
  ) => Promise<SupplierBatchCostDetail>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const text = copy[language];
  const dualPermission = canReadCosts && canManageCosts;
  const chargeIsReadOnly = charge !== null && charge.status !== "estimated";
  const canUseForm = isSupplierBatchChargeFormEditable(charge, canReadCosts, canManageCosts);
  const lines = React.useMemo(() => detail.lines, [detail.lines]);
  const manualLines = React.useMemo(() => getSupplierBatchManualLines(lines), [lines]);
  const missingWeightCount = React.useMemo(() => getSupplierBatchMissingWeightCount(lines), [lines]);
  const [form, setForm] = React.useState<SupplierBatchChargeFormValues>(() => createSupplierBatchChargeForm(charge, lines).form);
  const [manualAmounts, setManualAmounts] = React.useState<Record<string, string>>(() => createSupplierBatchChargeForm(charge, lines).manualAmounts);
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
  const previewAbortRef = React.useRef<AbortController | null>(null);
  const previewRequestIdRef = React.useRef(0);
  const mutationRequestIdRef = React.useRef(0);
  const mutationActiveRef = React.useRef(false);
  const mutationAbortRef = React.useRef<AbortController | null>(null);
  const initialisedRef = React.useRef<string | null>(null);
  const openRef = React.useRef(open);
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
    setForm(createSupplierBatchChargeForm(null, []).form);
    setManualAmounts({});
    setIdempotencyKey("");
    setPreviewState(null);
    setFieldErrors({});
    setErrorCode(null);
    setPending(null);
    setPersistedKnownSuccess(null);
    setUncertainMutation(null);
  }, [invalidatePreviewRequest]);

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
      chargeId ?? "create",
      charge?.status ?? "new",
      charge?.idempotencyKey ?? "draft",
      charge?.payloadFingerprint ?? "draft",
    ].join(":");
    if (initialisedRef.current === initKey) return;
    initialisedRef.current = initKey;
    invalidatePreviewRequest();
    const next = createSupplierBatchChargeForm(charge, lines);
    const timeoutId = window.setTimeout(() => {
      if (!open || initialisedRef.current !== initKey) return;
      setForm(next.form);
      setManualAmounts(next.manualAmounts);
      setPreviewState(null);
      setFieldErrors({});
      setErrorCode(null);
      try {
        setIdempotencyKey(charge?.idempotencyKey ?? createSupplierBatchIdempotencyKey());
      } catch {
        setIdempotencyKey("");
        setErrorCode("NETWORK_ERROR");
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [charge, chargeId, detail.batch.batchCode, detail.batch.id, invalidatePreviewRequest, lines, open, persistedKnownSuccess, reset, uncertainMutation]);

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
    previewRequestIdRef.current += 1;
    setPreviewState(null);
    setErrorCode(null);
    setFieldErrors({});
  }

  function updateManualAmount(lineId: string, value: string) {
    setManualAmounts((current) => ({ ...current, [lineId]: value }));
    previewRequestIdRef.current += 1;
    setPreviewState(null);
    setErrorCode(null);
    setFieldErrors({});
  }

  function preparePayload(revision?: string) {
    const built = buildSupplierBatchChargePayload(
      form,
      manualAmounts,
      lines,
      charge ? "edit" : "create",
      idempotencyKey,
      revision,
      chargeId ?? undefined
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
    const endpoint = `/api/admin/supplier-batches/${encodeURIComponent(detail.batch.batchCode)}/charges/preview`;
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
  ): Promise<SupplierBatchCostRpcResult> {
    const endpoint = action === "estimate"
      ? `/api/admin/supplier-batches/${encodeURIComponent(detail.batch.batchCode)}/charges/estimate`
      : `/api/admin/supplier-batches/${encodeURIComponent(detail.batch.batchCode)}/charges/confirm`;
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
    let result: SupplierBatchCostRpcResult | null = null;
    try {
      result = normalizeSupplierBatchCostRpcResult(data);
    } catch {
      result = null;
    }
    if (!result) {
      throw { code: "INVALID_RESPONSE", status: response.status, unknownWrite: true } satisfies SupplierBatchCostApiError;
    }
    return result;
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
      return {
        detail: nextDetail,
        outcome: classifySupplierBatchMutationReadback(
          nextDetail,
          context.action === "confirm" ? "confirmed" : "estimated",
          detail.batch.id,
          detail.batch.batchCode,
          context.idempotencyKey,
          context.payloadFingerprint,
          context.chargeId
        ),
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
    const parsed = supplierBatchChargePreviewSchema.safeParse(payload);
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

  async function runMutation(action: SupplierBatchMutationAction) {
    if (
      !canUseForm ||
      pending !== null ||
      persistedKnownSuccess !== null ||
      mutationActiveRef.current ||
      (uncertainMutation !== null && uncertainMutation.action !== action)
    ) {
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
    if (
      action === "confirm" &&
      !canConfirmSupplierBatchCharge(
        true,
        form.vatTreatment,
        currentPreview.result.confirmationBlocked
      )
    ) {
      setErrorCode(
        form.vatTreatment === "unknown"
          ? "CONFIRM_VAT_REQUIRED"
          : "FINANCIAL_ADJUSTMENT_REQUIRED"
      );
      return;
    }

    mutationActiveRef.current = true;
    setPending(action);
    setErrorCode(null);
    setFieldErrors({});
    setUncertainMutation(null);
    const payload = preparePayload(action === "confirm" ? currentPreview.result.revision : undefined);
    if (!payload) {
      mutationActiveRef.current = false;
      setPending(null);
      return;
    }
    const parsed = action === "confirm"
      ? supplierBatchChargeConfirmSchema.safeParse(payload)
      : supplierBatchChargeEstimateSchema.safeParse(payload);
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
      const result = await postMutation(action, parsed.data, controller.signal);
      if (requestId !== mutationRequestIdRef.current) return;
      if (!isSupplierBatchMutationResultForCurrent(
        result,
        action === "confirm" ? "confirmed" : "estimated",
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
      setPersistedKnownSuccess(mutationContext);
      setPending("refresh");
      try {
        if (mutationAbortRef.current === controller) mutationAbortRef.current = null;
        const readback = await performMutationReadback(requestId, mutationContext);
        if (requestId !== mutationRequestIdRef.current) return;
        if (readback.outcome === "matched") {
          mutationActiveRef.current = false;
          reset();
          if (openRef.current) onOpenChange(false);
          return;
        }
        if (readback.outcome === "idempotency_conflict") {
          setPersistedKnownSuccess(mutationContext);
          setErrorCode("READBACK_IDEMPOTENCY_CONFLICT");
          return;
        }
        if (requestId === mutationRequestIdRef.current) {
          if (readback.outcome === "invalid") {
            setPersistedKnownSuccess(mutationContext);
            setErrorCode("READBACK_INVALID");
          } else {
            setPersistedKnownSuccess(mutationContext);
            setErrorCode("READBACK_NOT_FOUND");
          }
        }
        return;
      } catch (cause) {
        if (requestId === mutationRequestIdRef.current) {
          const failure = cause as SupplierBatchReadbackFailure;
          setPersistedKnownSuccess(mutationContext);
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
      if (readback.outcome === "matched") {
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
      if (readback.outcome === "matched") {
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
    const mutationPending = pending === "estimate" || pending === "confirm" || pending === "refresh";
    if (!nextOpen && (mutationActiveRef.current || mutationPending || persistedKnownSuccess !== null || uncertainMutation !== null)) {
      return;
    }
    if (!nextOpen) {
      initialisedRef.current = null;
      reset();
    }
    onOpenChange(nextOpen);
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
    pending === null &&
    persistedKnownSuccess === null &&
    uncertainMutation === null &&
    canConfirmSupplierBatchCharge(
      previewCurrent,
      form.vatTreatment,
      previewState?.result.confirmationBlocked
    );

  const grossCents = (() => {
    const amountNet = parseSupplierBatchMoneyInput(form.amountNet);
    const vatAmount = parseSupplierBatchMoneyInput(form.vatAmount);
    return amountNet.cents !== null && vatAmount.cents !== null
      ? amountNet.cents + vatAmount.cents
      : null;
  })();
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[94dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <DialogTitle>{charge ? text.editTitle : text.title}</DialogTitle>
          <DialogDescription>{text.description}</DialogDescription>
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

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <Field id="charge-type" label={text.chargeType} error={fieldErrorText(fieldErrors.chargeType, text)}>
                  <Select value={form.chargeType} onValueChange={(value) => updateField("chargeType", value as SupplierBatchChargeType)} disabled={actionDisabled}>
                    <SelectTrigger id="charge-type" aria-label={text.chargeType} aria-invalid={Boolean(fieldErrors.chargeType)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("charge-type", Boolean(fieldErrors.chargeType))}><SelectValue /></SelectTrigger>
                    <SelectContent>{CHARGE_TYPES.map((value) => <SelectItem key={value} value={value}>{text.typeLabels[value]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="amount-net" label={text.amountNet} error={fieldErrorText(fieldErrors.amountNet, text)}>
                  <Input id="amount-net" inputMode="decimal" value={form.amountNet} onChange={(event) => updateField("amountNet", event.target.value)} aria-invalid={Boolean(fieldErrors.amountNet)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("amount-net", Boolean(fieldErrors.amountNet))} disabled={actionDisabled} />
                </Field>
                <Field id="vat-amount" label={text.vatAmount} error={fieldErrorText(fieldErrors.vatAmount, text)}>
                  <Input id="vat-amount" inputMode="decimal" value={form.vatAmount} onChange={(event) => updateField("vatAmount", event.target.value)} aria-invalid={Boolean(fieldErrors.vatAmount)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("vat-amount", Boolean(fieldErrors.vatAmount))} disabled={actionDisabled} />
                </Field>
                <Field id="gross" label={text.gross}>
                  <Input id="gross" value={grossCents === null ? "—" : formatCents(grossCents)} readOnly tabIndex={-1} />
                </Field>
                <Field id="capitalized-amount" label={text.capitalizedAmount} error={fieldErrorText(fieldErrors.capitalizedAmount, text)}>
                  <Input id="capitalized-amount" inputMode="decimal" value={form.capitalizedAmount} onChange={(event) => updateField("capitalizedAmount", event.target.value)} aria-invalid={Boolean(fieldErrors.capitalizedAmount)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("capitalized-amount", Boolean(fieldErrors.capitalizedAmount))} disabled={actionDisabled} />
                </Field>
                <Field id="currency" label={text.currency}><Input id="currency" value="EUR" readOnly tabIndex={-1} /></Field>
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
                <Field id="carrier-name" label={text.carrierName} error={fieldErrorText(fieldErrors.carrierName, text)}><Input id="carrier-name" value={form.carrierName} onChange={(event) => updateField("carrierName", event.target.value)} aria-invalid={Boolean(fieldErrors.carrierName)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("carrier-name", Boolean(fieldErrors.carrierName))} disabled={actionDisabled} /></Field>
                <Field id="reference" label={text.reference} error={fieldErrorText(fieldErrors.reference, text)}><Input id="reference" value={form.reference} onChange={(event) => updateField("reference", event.target.value)} aria-invalid={Boolean(fieldErrors.reference)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("reference", Boolean(fieldErrors.reference))} disabled={actionDisabled} /></Field>
                <Field id="occurred-at" label={text.occurredAt} error={fieldErrorText(fieldErrors.occurredAt, text)}><Input id="occurred-at" type="datetime-local" value={form.occurredAt} onChange={(event) => updateField("occurredAt", event.target.value)} aria-invalid={Boolean(fieldErrors.occurredAt)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("occurred-at", Boolean(fieldErrors.occurredAt))} disabled={actionDisabled} /></Field>
                <Field id="evidence-url" label={text.evidenceUrl} error={fieldErrorText(fieldErrors.evidenceUrl, text)}><Input id="evidence-url" type="url" value={form.evidenceUrl} onChange={(event) => updateField("evidenceUrl", event.target.value)} aria-invalid={Boolean(fieldErrors.evidenceUrl)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("evidence-url", Boolean(fieldErrors.evidenceUrl))} disabled={actionDisabled} /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <Field id="zero-cost-reason" label={text.zeroCostReason} error={fieldErrorText(fieldErrors.zeroCostReason, text)} description={text.zeroCostHelp}>
                  <Input id="zero-cost-reason" value={form.zeroCostReason} onChange={(event) => updateField("zeroCostReason", event.target.value)} aria-invalid={Boolean(fieldErrors.zeroCostReason)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("zero-cost-reason", Boolean(fieldErrors.zeroCostReason), true)} disabled={actionDisabled} />
                </Field>
                <Field id="notes" label={text.notes} error={fieldErrorText(fieldErrors.notes, text)}><Textarea id="notes" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} aria-invalid={Boolean(fieldErrors.notes)} aria-describedby={buildSupplierBatchFieldAriaDescribedBy("notes", Boolean(fieldErrors.notes))} disabled={actionDisabled} /></Field>
              </div>

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
                  {form.vatTreatment === "unknown" ? <p className="mt-2 text-xs font-semibold text-amber-800">{text.confirmVatRequired}</p> : null}
                  <div className="mt-3 overflow-x-auto">
                    <Table className="min-w-[950px] text-xs">
                      <TableHeader><TableRow><TableHead>{text.line}</TableHead><TableHead>{text.sku}</TableHead><TableHead>{text.currentAllocation}</TableHead><TableHead>{text.candidateAllocation}</TableHead><TableHead>{text.currentLandedLine}</TableHead><TableHead>{text.projectedLandedLine}</TableHead><TableHead>{text.currentLandedUnit}</TableHead><TableHead>{text.projectedLandedUnit}</TableHead></TableRow></TableHeader>
                      <TableBody>{previewState.result.lineProjections.map((line) => (
                        <TableRow key={line.batchLineId}>
                          <TableCell className="font-mono">{line.lineNo}</TableCell>
                          <TableCell className="font-mono">{line.skuCode ?? "—"}</TableCell>
                          <TableCell>{formatCents(line.currentAllocationCents)}</TableCell>
                          <TableCell>{formatCents(line.candidateAllocationCents)}</TableCell>
                          <TableCell>{formatCents(line.currentLandedLineCostCents)}</TableCell>
                          <TableCell>{formatCents(line.projectedLandedLineCostCents)}</TableCell>
                          <TableCell>{formatSupplierBatchUnitCost(line.currentLandedUnitCost, language)}</TableCell>
                          <TableCell>{formatSupplierBatchUnitCost(line.projectedLandedUnitCost, language)}</TableCell>
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

        <DialogFooter className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending === "estimate" || pending === "confirm" || pending === "refresh" || persistedKnownSuccess !== null || uncertainMutation !== null}
          >
            {dualPermission ? text.cancel : text.close}
          </Button>
          {canUseForm ? (
            <>
              <Button variant="outline" onClick={() => void runPreview()} disabled={actionDisabled}>
                {pending === "preview" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {text.preview}
              </Button>
              {previewState ? (
                <>
                  <Button variant="outline" onClick={() => void runMutation("estimate")} disabled={!canSaveEstimate}>
                    {pending === "estimate" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {text.saveEstimate}
                  </Button>
                  <Button variant="destructive" onClick={() => void runMutation("confirm")} disabled={!canConfirm}>
                    {pending === "confirm" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    {text.confirm}
                  </Button>
                </>
              ) : null}
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <Label htmlFor={id} className="text-xs font-semibold text-slate-700">{label}</Label>
      {children}
      {description ? <p id={id ? `${id}-description` : undefined} className="text-[11px] text-slate-500">{description}</p> : null}
      {error ? <p id={id ? `${id}-error` : undefined} className="text-[11px] font-semibold text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
