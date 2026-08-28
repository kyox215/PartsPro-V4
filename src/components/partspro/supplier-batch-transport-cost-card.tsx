"use client";

import * as React from "react";
import { AlertTriangle, FileSpreadsheet, FileText, LockKeyhole, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type {
  SupplierBatchCharge,
  SupplierBatchChargeStatus,
  SupplierBatchCostStatus,
  SupplierBatchCostSummary,
  SupplierBatchLineCost,
} from "@/lib/partspro-supplier-batch-cost-core.mjs";
import {
  formatSupplierBatchCents,
  formatSupplierBatchDateTime,
  formatSupplierBatchDualCents,
  formatSupplierBatchMoney,
  formatSupplierBatchUnitMoney,
  normalizeSupplierBatchCurrency,
  type SupplierBatchCurrency,
} from "@/lib/partspro-supplier-batch-money";

export type SupplierBatchCostLanguage = "zh" | "it";
export type SupplierBatchCostExportFormat = "csv" | "xlsx";

export type SupplierBatchChargeView = Omit<SupplierBatchCharge, "currency"> & {
  currency: string;
  fxRateToEur?: number | null;
  fxRateDate?: string | null;
  fxRateSource?: string | null;
  fxEvidenceUrl?: string | null;
  baseAmountNetCents?: number | null;
  baseVatAmountCents?: number | null;
  baseAmountGrossCents?: number | null;
  baseCapitalizedAmountCents?: number | null;
  revision?: string | null;
  correctionChain?: unknown[] | null;
  audit?: unknown[] | null;
  effective?: boolean;
  superseded?: boolean;
  correction?: {
    correctionId: string | null;
    originalChargeId: string | null;
    replacementChargeId: string | null;
    status: string | null;
    financeAdjustmentRequired: boolean | null;
  } | null;
  allocations?: SupplierBatchAllocationView[];
};

export type SupplierBatchHistoryEntry = {
  id?: string | null;
  batchId?: string | null;
  batchCode?: string | null;
  action?: string | null;
  eventType?: string | null;
  status?: string | null;
  reason?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  revision?: string | null;
  idempotencyKey?: string | null;
  payloadFingerprint?: string | null;
  effective?: boolean;
  superseded?: boolean;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt?: string | null;
  chargeId?: string | null;
  correctionId?: string | null;
  correctionOfChargeId?: string | null;
  linkedChargeId?: string | null;
  links?: {
    originalChargeId: string | null;
    replacementChargeId: string | null;
    correctionId: string | null;
  } | null;
  financeAdjustmentRequired?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

export type SupplierBatchAllocationView = {
  allocationId?: string | null;
  chargeId?: string | null;
  batchLineId: string;
  currency?: string | null;
  lineNo: number | null;
  skuCode: string | null;
  allocatedAmountCents: number;
  allocatedAmount?: number | null;
  baseAllocatedAmountCents?: number | null;
  baseAllocatedAmount?: number | null;
  goodsCostSnapshotCents?: number | null;
  goodsCostSnapshot?: number | null;
  goodsCostSnapshotEurCents?: number | null;
  allocatedAmountEurCents?: number | null;
  allocatedUnitAmount?: number | null;
  allocatedUnitAmountEur?: number | null;
  basisValue?: number | null;
  shareRatio?: number | null;
  weightGramSnapshot?: number | null;
  qtyReceivedSnapshot?: number | null;
  landedLineCostCents?: number | null;
  landedLineCost?: number | null;
  landedLineCostEurCents?: number | null;
  landedUnitCost?: number | null;
  landedUnitCostEur?: number | null;
  roundingAdjustmentEurCents?: number | null;
  originalCurrencyComparable?: boolean | null;
  roundingAdjustmentCents: number;
  roundingAdjustment?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type SupplierBatchCostSummaryView = SupplierBatchCostSummary & {
  fxRateToEur?: number | null;
  fxRateDate?: string | null;
  fxRateSource?: string | null;
  goodsValueBaseCents?: number | null;
  estimatedNetBaseCents?: number | null;
  estimatedVatBaseCents?: number | null;
  estimatedGrossBaseCents?: number | null;
  estimatedCapitalizedBaseCents?: number | null;
  confirmedNetBaseCents?: number | null;
  confirmedVatBaseCents?: number | null;
  confirmedGrossBaseCents?: number | null;
  confirmedCapitalizedBaseCents?: number | null;
  confirmedLandedTotalBaseCents?: number | null;
  projectedLandedTotalBaseCents?: number | null;
  goodsValueFxEvidenceUrl?: string | null;
};

export type SupplierBatchLineCostView = SupplierBatchLineCost & {
  goodsCostEurCents?: number | null;
  confirmedInboundEurCents?: number | null;
  landedLineCostEurCents?: number | null;
  landedUnitCostEur?: number | null;
  originalCurrencyComparable?: boolean;
};

export type SupplierBatchCostDetail = {
  batch: {
    id: string;
    batchCode: string;
    currency: string;
    totalCost: number;
    costSummary: SupplierBatchCostSummaryView | null;
    goodsValueEur?: number | null;
    goodsValueFxRateToEur?: number | null;
    goodsValueFxDate?: string | null;
    goodsValueFxSource?: string | null;
    goodsValueFxEvidenceUrl?: string | null;
  };
  lines: Array<{
    id: string;
    lineNo: number;
    skuCode: string | null;
    name: string;
    qtyReceived: number;
    product: { weightGram: number | null } | null;
    costs: SupplierBatchLineCostView | null;
  }>;
  charges: SupplierBatchChargeView[];
  allocations?: SupplierBatchAllocationView[];
  history?: SupplierBatchHistoryEntry[];
};

export type SupplierBatchCostSummaryDisplay = {
  status: SupplierBatchCostStatus | "unavailable";
  goodsValueCents: number | null;
  confirmedTransportCents: number | null;
  estimatedTransportCents: number | null;
  confirmedLandedCents: number | null;
  projectedLandedCents: number | null;
  hasConfirmed: boolean;
  hasEstimate: boolean;
  currency: SupplierBatchCurrency;
  goodsValueBaseCents: number | null;
  confirmedTransportBaseCents: number | null;
  estimatedTransportBaseCents: number | null;
  confirmedLandedBaseCents: number | null;
  projectedLandedBaseCents: number | null;
  fxRateToEur: number | null;
  fxRateDate: string | null;
  fxRateSource: string | null;
  fxEvidenceUrl: string | null;
  goodsValueFxEvidenceUrl: string | null;
  originalTotalsComparable: boolean;
  baseFxAvailable: boolean;
};

/**
 * Keep display semantics separate from JSX so every surface uses the same
 * unavailable/unrecorded/confirmed-zero/estimated rules.
 */
export function getSupplierBatchCostSummaryDisplay(
  summary: SupplierBatchCostSummary | null
): SupplierBatchCostSummaryDisplay {
  if (summary === null) {
    return {
      status: "unavailable",
      goodsValueCents: null,
      confirmedTransportCents: null,
      estimatedTransportCents: null,
      confirmedLandedCents: null,
      projectedLandedCents: null,
      hasConfirmed: false,
      hasEstimate: false,
      currency: "EUR",
      goodsValueBaseCents: null,
      confirmedTransportBaseCents: null,
      estimatedTransportBaseCents: null,
      confirmedLandedBaseCents: null,
      projectedLandedBaseCents: null,
      fxRateToEur: null,
      fxRateDate: null,
      fxRateSource: null,
      fxEvidenceUrl: null,
      goodsValueFxEvidenceUrl: null,
      originalTotalsComparable: true,
      baseFxAvailable: true,
    };
  }

  const hasConfirmed = summary.confirmedCount > 0;
  const hasEstimate = summary.estimatedCount > 0;
  const hasRecordedCost = hasConfirmed || hasEstimate;
  const view = summary as SupplierBatchCostSummaryView;
  const goodsValueBaseCents = view.goodsValueBaseCents ?? view.goodsValueEurCents ?? null;
  const confirmedCapitalizedBaseCents =
    view.confirmedCapitalizedBaseCents ?? view.confirmedCapitalizedEurCents ?? null;
  const estimatedCapitalizedBaseCents =
    view.estimatedCapitalizedBaseCents ?? view.estimatedCapitalizedEurCents ?? null;
  const confirmedLandedTotalBaseCents =
    view.confirmedLandedTotalBaseCents ?? view.confirmedLandedTotalEurCents ?? null;
  const projectedLandedTotalBaseCents =
    view.projectedLandedTotalBaseCents ?? view.projectedLandedTotalEurCents ?? null;
  const currency = summary.currency === "USD" || summary.currency === "CNY"
    ? summary.currency
    : "EUR";

  return {
    status: summary.costStatus,
    goodsValueCents: summary.goodsValueCents,
    confirmedTransportCents: hasConfirmed ? summary.confirmedCapitalizedCents : null,
    estimatedTransportCents: hasEstimate ? summary.estimatedCapitalizedCents : null,
    confirmedLandedCents: hasConfirmed ? summary.confirmedLandedTotalCents : null,
    projectedLandedCents: hasRecordedCost ? summary.projectedLandedTotalCents : null,
    hasConfirmed,
    hasEstimate,
    currency,
    goodsValueBaseCents,
    confirmedTransportBaseCents: hasConfirmed
      ? confirmedCapitalizedBaseCents
      : null,
    estimatedTransportBaseCents: hasEstimate
      ? estimatedCapitalizedBaseCents
      : null,
    confirmedLandedBaseCents: hasConfirmed
      ? confirmedLandedTotalBaseCents
      : null,
    projectedLandedBaseCents: hasRecordedCost
      ? projectedLandedTotalBaseCents
      : null,
    // Summary FX is the independent batch-goods snapshot. Charge FX is
    // rendered per charge and must never be reused as the goods valuation.
    fxRateToEur: view.goodsValueFxRateToEur ?? null,
    fxRateDate: view.goodsValueFxDate ?? null,
    fxRateSource: view.goodsValueFxSource ?? null,
    fxEvidenceUrl: null,
    goodsValueFxEvidenceUrl: view.goodsValueFxEvidenceUrl ?? null,
    originalTotalsComparable: view.originalTotalsComparable ?? true,
    baseFxAvailable: view.baseFxAvailable ?? (currency === "EUR"),
  };
}

type CostCopy = {
  status: Record<SupplierBatchCostStatus, string>;
  chargeStatus: Record<SupplierBatchChargeStatus, string>;
  reviewCodes: Record<string, string>;
  title: string;
  description: string;
  goodsValue: string;
  transportShort: string;
  landedShort: string;
  confirmedShort: string;
  estimatedShort: string;
  confirmedTransport: string;
  estimatedTransport: string;
  confirmedLanded: string;
  projectedLanded: string;
  currencyHint: string;
  fxSnapshot: string;
  fxPending: string;
  review: string;
  charges: string;
  noCharges: string;
  history: string;
  noHistory: string;
  allocations: string;
  noAllocations: string;
  allocationCount: string;
  evidence: string;
  actor: string;
  createdBy: string;
  updatedBy: string;
  confirmedBy: string;
  auditFingerprint: string;
  audit: string;
  cancelEstimate: string;
  correctCharge: string;
  cancelEstimateConfirm: string;
  correctionUnavailable: string;
  correctionApplied: string;
  correctionPending: string;
  correctionLink: string;
  correctionReplacement: string;
  pendingReplacement: string;
  readOnly: string;
  unavailable: string;
  statusLabel: string;
  type: string;
  net: string;
  vat: string;
  gross: string;
  capitalized: string;
  allocation: string;
  carrier: string;
  reference: string;
  date: string;
  exportCharges: string;
  addCharge: string;
  editCharge: string;
  exportCsv: string;
  exportXlsx: string;
  readOnlyCharge: string;
  estimatedCharge: string;
  editableCharge: string;
  allocationMethods: Record<string, string>;
  chargeTypes: Record<string, string>;
  goods: string;
  inbound: string;
  landedUnit: string;
  landedLine: string;
  line: string;
};

const COPY: Record<SupplierBatchCostLanguage, CostCopy> = {
  zh: {
    status: {
      unrecorded: "未登记",
      estimated: "预估",
      confirmed_zero: "€0 已确认",
      confirmed: "已确认",
      needs_review: "需复核",
    },
    chargeStatus: {
      estimated: "预估",
      confirmed: "已确认",
      cancelled: "已取消",
    },
    reviewCodes: {
      NON_EUR_BATCH: "批次币种不是 EUR",
      MIXED_CURRENCY: "存在多种原币；汇总仅按 EUR 本位币显示",
      PRODUCT_MAPPING_REQUIRED: "存在未映射商品",
      WEIGHT_REQUIRED_FOR_ESTIMATE: "重量分摊缺可靠重量",
      FINANCIAL_ADJUSTMENT_REQUIRED: "已有成本层需要财务调整",
      FINANCE_ADJUSTMENT_REQUIRED: "已有成本层需要财务调整",
      BATCH_FX_RATE_REQUIRED: "缺少批次商品货值 EUR 汇率快照",
    },
    title: "运输与落地成本",
    description: "运输费用与商品货值分开记录；这里只展示已返回并通过校验的数据。",
    goodsValue: "商品货值",
    transportShort: "运输",
    landedShort: "落地",
    confirmedShort: "已确认",
    estimatedShort: "预估",
    confirmedTransport: "已确认资本化运输",
    estimatedTransport: "预估资本化运输",
    confirmedLanded: "已确认落地合计",
    projectedLanded: "预计落地合计",
    currencyHint: "原币 / EUR 本位币",
    fxSnapshot: "汇率快照",
    fxPending: "待汇率 / 不可确认",
    review: "复核提示",
    charges: "费用记录",
    noCharges: "尚未登记运输费用。",
    history: "成本历史与审计",
    noHistory: "暂无成本历史记录。",
    allocations: "分摊明细",
    noAllocations: "暂无分摊明细。",
    allocationCount: "{count} 行分摊",
    evidence: "证据",
    actor: "操作者",
    createdBy: "创建",
    updatedBy: "更新",
    confirmedBy: "确认",
    auditFingerprint: "指纹",
    audit: "审计",
    cancelEstimate: "取消预估",
    correctCharge: "发起纠错",
    cancelEstimateConfirm: "确定取消这笔预估费用吗？",
    correctionUnavailable: "该费用需由更高权限发起纠错。",
    correctionApplied: "冲正已应用 / 替代记录",
    correctionPending: "待财务调整 / 未改历史成本",
    correctionLink: "原记录 → 替代记录",
    correctionReplacement: "替代记录；可继续发起纠错，不可作为普通费用编辑",
    pendingReplacement: "待财务调整（暂无替代记录）",
    readOnly: "成本只读；需要成本管理权限才能登记或确认。",
    unavailable: "成本暂不可用",
    statusLabel: "状态",
    type: "类型",
    net: "净额",
    vat: "IVA",
    gross: "含税额",
    capitalized: "资本化",
    allocation: "分摊",
    carrier: "承运商",
    reference: "参考号",
    date: "日期",
    exportCharges: "导出费用",
    addCharge: "添加费用",
    editCharge: "编辑预估",
    exportCsv: "CSV",
    exportXlsx: "Excel",
    readOnlyCharge: "只读",
    estimatedCharge: "预估费用；可在有权限时编辑",
    editableCharge: "可编辑预估费用",
    allocationMethods: {
      goods_value: "商品金额占比",
      received_qty: "实际到货数量",
      weight: "重量",
      manual: "手工分摊",
    },
    chargeTypes: {
      transport: "运输",
      insurance: "保险",
      customs: "关税",
      handling: "处理费",
      other: "其他",
    },
    goods: "商品",
    inbound: "已确认运输",
    landedUnit: "落地单价",
    landedLine: "落地行金额",
    line: "行号",
  },
  it: {
    status: {
      unrecorded: "Non registrato",
      estimated: "Stimato",
      confirmed_zero: "Confermato €0",
      confirmed: "Confermato",
      needs_review: "Da verificare",
    },
    chargeStatus: {
      estimated: "Stimato",
      confirmed: "Confermato",
      cancelled: "Annullato",
    },
    reviewCodes: {
      NON_EUR_BATCH: "Lotto non in EUR",
      MIXED_CURRENCY: "Valute originali miste; i totali usano solo la base EUR",
      PRODUCT_MAPPING_REQUIRED: "Prodotto non mappato",
      WEIGHT_REQUIRED_FOR_ESTIMATE: "Peso affidabile mancante",
      FINANCIAL_ADJUSTMENT_REQUIRED: "Serve rettifica finanziaria",
      FINANCE_ADJUSTMENT_REQUIRED: "Serve rettifica finanziaria",
      BATCH_FX_RATE_REQUIRED: "Manca lo snapshot cambio EUR del valore merce",
    },
    title: "Costo trasporto e costo sbarcato",
    description: "Il trasporto resta separato dal valore merce; qui sono mostrati solo dati validati.",
    goodsValue: "Valore merce",
    transportShort: "Trasporto",
    landedShort: "Sbarcato",
    confirmedShort: "Confermato",
    estimatedShort: "Stimato",
    confirmedTransport: "Trasporto capitalizzato confermato",
    estimatedTransport: "Trasporto capitalizzato stimato",
    confirmedLanded: "Totale sbarcato confermato",
    projectedLanded: "Totale sbarcato previsto",
    currencyHint: "Valuta originale / base EUR",
    fxSnapshot: "Snapshot cambio",
    fxPending: "Cambio mancante / non confermabile",
    review: "Da verificare",
    charges: "Costi registrati",
    noCharges: "Nessun costo trasporto registrato.",
    history: "Storico e audit costi",
    noHistory: "Nessuno storico costi disponibile.",
    allocations: "Dettaglio allocazioni",
    noAllocations: "Nessuna allocazione disponibile.",
    allocationCount: "{count} righe allocate",
    evidence: "Evidenza",
    actor: "Operatore",
    createdBy: "Creato",
    updatedBy: "Aggiornato",
    confirmedBy: "Confermato",
    auditFingerprint: "Fingerprint",
    audit: "Audit",
    cancelEstimate: "Annulla stima",
    correctCharge: "Avvia rettifica",
    cancelEstimateConfirm: "Annullare questo costo stimato?",
    correctionUnavailable: "La rettifica richiede un permesso superiore.",
    correctionApplied: "Rettifica applicata / record sostitutivo",
    correctionPending: "Adeguamento finanziario richiesto / storico invariato",
    correctionLink: "Record originale → sostitutivo",
    correctionReplacement: "Record sostitutivo; correggibile, non modificabile come costo ordinario",
    pendingReplacement: "Adeguamento finanziario richiesto (nessun sostitutivo)",
    readOnly: "Costi in sola lettura; serve il permesso di gestione costi per registrare o confermare.",
    unavailable: "Costo non disponibile",
    statusLabel: "Stato",
    type: "Tipo",
    net: "Netto",
    vat: "IVA",
    gross: "Lordo",
    capitalized: "Capitalizzato",
    allocation: "Allocazione",
    carrier: "Vettore",
    reference: "Riferimento",
    date: "Data",
    exportCharges: "Esporta costi",
    addCharge: "Aggiungi costo",
    editCharge: "Modifica stima",
    exportCsv: "CSV",
    exportXlsx: "Excel",
    readOnlyCharge: "Sola lettura",
    estimatedCharge: "Costo stimato; modificabile con il permesso",
    editableCharge: "Stima modificabile",
    allocationMethods: {
      goods_value: "Valore merce",
      received_qty: "Quantita ricevuta",
      weight: "Peso",
      manual: "Manuale",
    },
    chargeTypes: {
      transport: "Trasporto",
      insurance: "Assicurazione",
      customs: "Dogana",
      handling: "Gestione",
      other: "Altro",
    },
    goods: "Merce",
    inbound: "Trasporto confermato",
    landedUnit: "Costo unitario sbarcato",
    landedLine: "Costo riga sbarcato",
    line: "Riga",
  },
};

function formatCents(
  cents: number | null,
  currency: string | null | undefined = "EUR",
  language: SupplierBatchCostLanguage = "zh"
): string {
  return formatSupplierBatchCents(cents, currency, language === "it" ? "it-IT" : "zh-CN");
}

function currencyLabel(currency: SupplierBatchCurrency, language: SupplierBatchCostLanguage): string {
  return language === "it" ? currency : `${currency} 原币`;
}

function formatSummaryValue(
  cents: number | null,
  currency: SupplierBatchCurrency,
  baseAmountCents: number | null,
  language: SupplierBatchCostLanguage,
  originalTotalsComparable = true
): string {
  const locale = language === "it" ? "it-IT" : "zh-CN";
  if (!originalTotalsComparable) {
    return baseAmountCents === null
      ? "—"
      : formatSupplierBatchCents(baseAmountCents, "EUR", locale);
  }
  return formatSupplierBatchDualCents(
    cents,
    currency,
    currency === "EUR" ? null : baseAmountCents,
    locale
  );
}

function formatChargeAmount(
  charge: SupplierBatchChargeView,
  field: "amountNetCents" | "vatAmountCents" | "amountGrossCents" | "capitalizedAmountCents",
  language: SupplierBatchCostLanguage
): string {
  const currency = normalizeSupplierBatchCurrency(charge.currency);
  const amountCents = charge[field];
  const baseField = {
    amountNetCents: "baseAmountNetCents",
    vatAmountCents: "baseVatAmountCents",
    amountGrossCents: "baseAmountGrossCents",
    capitalizedAmountCents: "baseCapitalizedAmountCents",
  }[field] as keyof SupplierBatchChargeView;
  const baseEurField = {
    amountNetCents: "amountNetEurCents",
    vatAmountCents: "vatAmountEurCents",
    amountGrossCents: "amountGrossEurCents",
    capitalizedAmountCents: "capitalizedAmountEurCents",
  }[field] as keyof SupplierBatchChargeView;
  const base = typeof charge[baseField] === "number"
    ? charge[baseField] as number
    : typeof charge[baseEurField] === "number"
      ? charge[baseEurField] as number
      : null;
  return formatSupplierBatchDualCents(
    amountCents,
    currency,
    currency === "EUR" ? null : base,
    language === "it" ? "it-IT" : "zh-CN"
  );
}

export function formatSupplierBatchUnitCost(
  value: number | null,
  language: SupplierBatchCostLanguage,
  currency = "EUR"
): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return formatSupplierBatchUnitMoney(value, currency, language === "it" ? "it-IT" : "zh-CN");
}

function statusClass(status: SupplierBatchCostStatus | "unavailable"): string {
  return status === "confirmed" || status === "confirmed_zero"
    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "estimated"
      ? "border border-blue-200 bg-blue-50 text-blue-700"
      : status === "needs_review"
        ? "border border-amber-200 bg-amber-50 text-amber-700"
        : "border border-slate-200 bg-slate-100 text-slate-600";
}

function chargeStatusClass(status: SupplierBatchChargeStatus): string {
  return status === "confirmed"
    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "estimated"
      ? "border border-blue-200 bg-blue-50 text-blue-700"
      : "border border-slate-200 bg-slate-100 text-slate-600";
}

function statusText(summary: SupplierBatchCostSummary | null, copy: CostCopy): string {
  return summary ? copy.status[summary.costStatus] : copy.unavailable;
}

function formatDate(value: string | null, language: SupplierBatchCostLanguage): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(language === "it" ? "it-IT" : "zh-CN");
}

export function SupplierBatchCostSummaryCompact({
  summary,
  language,
  canReadCosts,
}: {
  summary: SupplierBatchCostSummary | null;
  language: SupplierBatchCostLanguage;
  canReadCosts: boolean;
}) {
  const copy = COPY[language];
  const display = getSupplierBatchCostSummaryDisplay(summary);
  const primaryLine = display.hasConfirmed
    ? `${copy.confirmedShort} ${copy.transportShort} ${formatSummaryValue(display.confirmedTransportCents, display.currency, display.confirmedTransportBaseCents, language, display.originalTotalsComparable)} · ${copy.landedShort} ${formatSummaryValue(display.confirmedLandedCents, display.currency, display.confirmedLandedBaseCents, language, display.originalTotalsComparable)}`
    : display.hasEstimate
      ? `${copy.estimatedShort} ${copy.transportShort} ${formatSummaryValue(display.estimatedTransportCents, display.currency, display.estimatedTransportBaseCents, language, display.originalTotalsComparable)} · ${copy.landedShort} ${formatSummaryValue(display.projectedLandedCents, display.currency, display.projectedLandedBaseCents, language, display.originalTotalsComparable)}`
      : `${copy.transportShort} — · ${copy.landedShort} —`;
  const estimateLine = display.hasConfirmed && display.hasEstimate
    ? `${copy.estimatedShort} ${copy.transportShort} ${formatSummaryValue(display.estimatedTransportCents, display.currency, display.estimatedTransportBaseCents, language, display.originalTotalsComparable)} · ${copy.landedShort} ${formatSummaryValue(display.projectedLandedCents, display.currency, display.projectedLandedBaseCents, language, display.originalTotalsComparable)}`
    : null;

  return (
    <div className="space-y-0.5 text-xs leading-tight">
      {canReadCosts ? (
        <>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Badge className={statusClass(display.status)}>{statusText(summary, copy)}</Badge>
            <span className="font-semibold text-slate-700">{primaryLine}</span>
          </div>
          <div className="text-[11px] text-slate-500">
            {display.originalTotalsComparable
              ? currencyLabel(display.currency, language)
              : language === "it" ? "Base EUR (valute originali separate)" : "EUR 本位币（原币分组）"}
            {display.currency !== "EUR" && display.fxRateToEur !== null
              ? ` · 1 ${display.currency} = ${display.fxRateToEur} EUR`
              : ""}
          </div>
          {estimateLine ? <div className="text-[11px] text-blue-700">{estimateLine}</div> : null}
          {display.currency !== "EUR" && display.fxRateToEur === null ? (
            <div className="text-[11px] font-semibold text-amber-700">待汇率 / 不可确认</div>
          ) : null}
        </>
      ) : (
        <div className="flex items-start gap-1 text-slate-500">
          <LockKeyhole className="mt-0.5 size-3 shrink-0" />
          <span>{copy.readOnly}</span>
        </div>
      )}
    </div>
  );
}

export function SupplierBatchLineCostCompact({
  costs,
  summary,
  language,
  canReadCosts,
}: {
  costs: SupplierBatchLineCostView | null;
  summary: SupplierBatchCostSummary | null;
  language: SupplierBatchCostLanguage;
  canReadCosts: boolean;
}) {
  const copy = COPY[language];
  const display = getSupplierBatchCostSummaryDisplay(summary);
  const visible = canReadCosts && display.hasConfirmed && costs !== null;
  const originalComparable =
    display.originalTotalsComparable && costs?.originalCurrencyComparable !== false;

  const money = (cents: number | null, eurCents?: number | null) =>
    originalComparable
      ? formatCents(cents, display.currency, language)
      : formatCents(eurCents ?? null, "EUR", language);
  return (
    <div className="space-y-0.5 text-xs">
      <CostLine label={copy.goods} value={visible ? money(costs.goodsCostCents, costs.goodsCostEurCents) : "—"} strong />
      <CostLine label={copy.inbound} value={visible ? money(costs.confirmedInboundCents, costs.confirmedInboundEurCents) : "—"} strong />
      <CostLine label={copy.landedUnit} value={visible
        ? originalComparable
          ? formatSupplierBatchUnitMoney(costs.landedUnitCost, display.currency, language === "it" ? "it-IT" : "zh-CN")
          : formatSupplierBatchUnitMoney(costs.landedUnitCostEur ?? null, "EUR", language === "it" ? "it-IT" : "zh-CN")
        : "—"} strong />
      <CostLine label={copy.landedLine} value={visible ? money(costs.landedLineCostCents, costs.landedLineCostEurCents) : "—"} strong />
    </div>
  );
}

// Kept as aliases for the existing admin panel wiring while exposing the
// compact names used by new consumers.
export function SupplierBatchCostSummaryCell(props: React.ComponentProps<typeof SupplierBatchCostSummaryCompact>) {
  return <SupplierBatchCostSummaryCompact {...props} />;
}

export function SupplierBatchLineCostCell(props: React.ComponentProps<typeof SupplierBatchLineCostCompact>) {
  return <SupplierBatchLineCostCompact {...props} />;
}

export function SupplierBatchTransportCostCard({
  detail,
  language,
  canReadCosts,
  canReadHistory = false,
  canManageCosts,
  canEstimateCosts = canManageCosts,
  canCorrectCosts = false,
  canExportCosts = canManageCosts,
  onAddCharge,
  onEditCharge,
  onCancelCharge,
  onCorrectCharge,
  onExportCharges,
}: {
  detail: SupplierBatchCostDetail;
  language: SupplierBatchCostLanguage;
  canReadCosts: boolean;
  canReadHistory?: boolean;
  canManageCosts: boolean;
  canEstimateCosts?: boolean;
  canConfirmCosts?: boolean;
  canCorrectCosts?: boolean;
  canExportCosts?: boolean;
  onAddCharge?: () => void;
  onEditCharge?: (charge: SupplierBatchChargeView) => void;
  onCancelCharge?: (charge: SupplierBatchChargeView) => void;
  onCorrectCharge?: (charge: SupplierBatchChargeView) => void;
  onExportCharges?: (format: SupplierBatchCostExportFormat) => void;
}) {
  const copy = COPY[language];
  // `canManageCosts` is a legacy estimate-only alias. Keep the render gates
  // on the explicit capability so confirmation/correction/export cannot be
  // accidentally unlocked by the legacy permission.
  const canEstimate = canReadCosts && canEstimateCosts;
  const canExport = canReadCosts && canExportCosts;
  const summary = detail.batch.costSummary;
  const display = getSupplierBatchCostSummaryDisplay(summary);
  const hasReviewCodes = summary !== null && summary.reviewCodes.length > 0;
  const locale = language === "it" ? "it-IT" : "zh-CN";
  const currency = normalizeSupplierBatchCurrency(detail.batch.currency ?? display.currency);
  const goodsFxRate = detail.batch.goodsValueFxRateToEur ?? display.fxRateToEur;
  const goodsFxDate = detail.batch.goodsValueFxDate ?? display.fxRateDate;
  const goodsFxSource = detail.batch.goodsValueFxSource ?? display.fxRateSource;
  const goodsFxEvidenceUrl = detail.batch.goodsValueFxEvidenceUrl ?? display.goodsValueFxEvidenceUrl;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3" aria-label={copy.title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-950">{copy.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{copy.description}</p>
        </div>
        {canEstimate || canExport ? (
          <div className="flex flex-wrap items-center gap-2">
            {canEstimate && onAddCharge ? (
              <Button size="sm" className="h-8" onClick={onAddCharge}>
                <Plus className="size-3.5" />
                {copy.addCharge}
              </Button>
            ) : null}
            {onExportCharges && canExport ? (
              <SupplierBatchCostExportMenu copy={copy} onExport={onExportCharges} />
            ) : null}
          </div>
        ) : (
          <div className="flex items-start gap-1 text-xs text-slate-500">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
            <span>{copy.readOnly}</span>
          </div>
        )}
      </div>

      {canReadCosts ? (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <CostMetric
              label={copy.goodsValue}
              value={display.goodsValueCents === null
                ? formatSupplierBatchMoney(detail.batch.totalCost, currency, locale)
                : formatSummaryValue(display.goodsValueCents, display.currency, display.goodsValueBaseCents, language)}
            />
            <CostMetric label={copy.confirmedTransport} value={formatSummaryValue(display.confirmedTransportCents, display.currency, display.confirmedTransportBaseCents, language)} />
            <CostMetric label={copy.estimatedTransport} value={formatSummaryValue(display.estimatedTransportCents, display.currency, display.estimatedTransportBaseCents, language)} />
            <CostMetric label={copy.confirmedLanded} value={formatSummaryValue(display.confirmedLandedCents, display.currency, display.confirmedLandedBaseCents, language)} />
            <CostMetric
              label={copy.projectedLanded}
              value={display.hasEstimate ? `${formatSummaryValue(display.projectedLandedCents, display.currency, display.projectedLandedBaseCents, language)} · ${language === "zh" ? "含预估" : "stimato"}` : formatSummaryValue(display.projectedLandedCents, display.currency, display.projectedLandedBaseCents, language)}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span>{copy.currencyHint}: {display.originalTotalsComparable ? currency : (language === "it" ? "base EUR (valute separate)" : "EUR 本位币（原币分组）")}</span>
            {display.currency !== "EUR" ? (
              <span>
                {copy.fxSnapshot}: {goodsFxRate === null
                  ? copy.fxPending
                  : `1 ${display.currency} = ${goodsFxRate} EUR${goodsFxDate ? ` · ${formatSupplierBatchDateTime(goodsFxDate, locale, "Europe/Rome")}` : ""}${goodsFxSource ? ` · ${goodsFxSource}` : ""}`}
              </span>
            ) : null}
            {goodsFxEvidenceUrl ? <span className="break-all">{copy.evidence}: {goodsFxEvidenceUrl}</span> : null}
          </div>
          <div className="mt-2">
            <Badge className={statusClass(display.status)}>{statusText(summary, copy)}</Badge>
          </div>
          {hasReviewCodes ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900" role="status">
              <div className="flex items-center gap-1 font-bold"><AlertTriangle className="size-3.5" />{copy.review}</div>
              <ul className="mt-1 list-disc pl-5">
                {summary?.reviewCodes.map((code) => <li key={code}>{copy.reviewCodes[code] ?? code}</li>)}
              </ul>
            </div>
          ) : null}
          {summary === null ? <div className="mt-2 text-xs text-slate-500">{copy.unavailable}</div> : null}
        </>
      ) : null}

      {canReadCosts ? (
        <div className="mt-4 overflow-x-auto">
          <div className="mb-2 text-sm font-black text-slate-950">{copy.charges}</div>
          {detail.charges.length > 0 ? (
            <Table className="hidden min-w-[1120px] text-xs sm:table">
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.statusLabel}</TableHead>
                  <TableHead>{copy.type}</TableHead>
                  <TableHead>{copy.net}</TableHead>
                  <TableHead>{copy.vat}</TableHead>
                  <TableHead>{copy.gross}</TableHead>
                  <TableHead>{copy.capitalized}</TableHead>
                  <TableHead>{copy.allocation}</TableHead>
                  <TableHead>{copy.carrier}</TableHead>
                  <TableHead>{copy.reference}</TableHead>
                  <TableHead>{copy.date}</TableHead>
                  <TableHead>{copy.audit}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.charges.map((charge) => (
                  <TableRow key={charge.chargeId}>
                    <TableCell>
                      <div className="flex min-w-[150px] flex-col items-start gap-1">
                        <Badge className={chargeStatusClass(charge.status)}>{copy.chargeStatus[charge.status]}</Badge>
                        <span className="text-[11px] text-slate-500">
                          {isSupplierBatchCorrectionReplacement(charge)
                            ? copy.correctionReplacement
                            : charge.status === "estimated"
                            ? canEstimate
                              ? copy.editableCharge
                              : copy.estimatedCharge
                            : copy.readOnlyCharge}
                        </span>
                        {charge.status === "estimated" && canEstimateCosts && onEditCharge ? (
                          <Button
                            size="xs"
                            variant="outline"
                            className="h-7 bg-white"
                            onClick={() => onEditCharge(charge)}
                          >
                            <Pencil className="size-3" />
                            {copy.editCharge}
                          </Button>
                        ) : null}
                        {charge.status === "estimated" && canEstimateCosts && onCancelCharge ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-7 text-amber-700"
                            onClick={() => onCancelCharge(charge)}
                          >
                            {copy.cancelEstimate}
                          </Button>
                        ) : null}
                        {isSupplierBatchCorrectionEligible(charge) && canCorrectCosts && onCorrectCharge ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-7 text-amber-700"
                            onClick={() => onCorrectCharge(charge)}
                          >
                            {copy.correctCharge}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{copy.chargeTypes[charge.chargeType] ?? charge.chargeType}</TableCell>
                    <TableCell>{formatChargeAmount(charge, "amountNetCents", language)}</TableCell>
                    <TableCell>{formatChargeAmount(charge, "vatAmountCents", language)}</TableCell>
                    <TableCell>{formatChargeAmount(charge, "amountGrossCents", language)}</TableCell>
                    <TableCell>{formatChargeAmount(charge, "capitalizedAmountCents", language)}</TableCell>
            <TableCell>{copy.allocationMethods[charge.allocationMethod] ?? charge.allocationMethod}</TableCell>
            <TableCell>{charge.carrierName ?? "—"}</TableCell>
            <TableCell>{charge.reference ?? "—"}</TableCell>
            <TableCell>{formatDate(charge.occurredAt, language)}</TableCell>
            <TableCell>
              <ChargeAuditMeta charge={charge} copy={copy} language={language} />
            </TableCell>
          </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-500">{copy.noCharges}</div>
          )}
          {detail.charges.length > 0 ? (
            <div className="mt-2 space-y-2 sm:hidden">
              {detail.charges.map((charge) => (
                <article key={`mobile-${charge.chargeId}`} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={chargeStatusClass(charge.status)}>{copy.chargeStatus[charge.status]}</Badge>
                      {isSupplierBatchCorrectionReplacement(charge) ? <span className="text-[11px] text-slate-500">{copy.correctionReplacement}</span> : null}
                      <span className="font-semibold text-slate-900">{copy.chargeTypes[charge.chargeType] ?? charge.chargeType}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{formatDate(charge.occurredAt, language)}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    <MobileChargeField label={copy.net} value={formatChargeAmount(charge, "amountNetCents", language)} />
                    <MobileChargeField label={copy.vat} value={formatChargeAmount(charge, "vatAmountCents", language)} />
                    <MobileChargeField label={copy.gross} value={formatChargeAmount(charge, "amountGrossCents", language)} />
                    <MobileChargeField label={copy.capitalized} value={formatChargeAmount(charge, "capitalizedAmountCents", language)} />
                    <MobileChargeField label={copy.allocation} value={copy.allocationMethods[charge.allocationMethod] ?? charge.allocationMethod} />
                    <MobileChargeField label={copy.carrier} value={charge.carrierName ?? "—"} />
                  </dl>
                  <div className="mt-2 border-t border-slate-200 pt-2">
                    <ChargeAuditMeta charge={charge} copy={copy} language={language} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {charge.status === "estimated" && canEstimateCosts && onEditCharge ? <Button size="xs" variant="outline" className="bg-white" onClick={() => onEditCharge(charge)}>{copy.editCharge}</Button> : null}
                    {charge.status === "estimated" && canEstimateCosts && onCancelCharge ? <Button size="xs" variant="ghost" className="text-amber-700" onClick={() => onCancelCharge(charge)}>{copy.cancelEstimate}</Button> : null}
                    {isSupplierBatchCorrectionEligible(charge) && canCorrectCosts && onCorrectCharge ? <Button size="xs" variant="ghost" className="text-amber-700" onClick={() => onCorrectCharge(charge)}>{copy.correctCharge}</Button> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {canReadCosts ? (
        <SupplierBatchAllocationsSection allocations={detail.allocations ?? []} copy={copy} language={language} />
      ) : null}
      {canReadHistory ? (
        <SupplierBatchHistorySection history={detail.history ?? []} copy={copy} language={language} />
      ) : null}
    </section>
  );
}

function CostLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${strong ? "font-semibold" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className={strong ? "font-black text-slate-950" : "font-semibold text-slate-900"}>{value}</span>
    </div>
  );
}

function CostMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-2">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black text-slate-950">{value}</div>
    </div>
  );
}

function MobileChargeField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="truncate font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function ChargeAuditMeta({
  charge,
  copy,
  language,
}: {
  charge: SupplierBatchChargeView;
  copy: CostCopy;
  language: SupplierBatchCostLanguage;
}) {
  const locale = language === "it" ? "it-IT" : "zh-CN";
  const fingerprint = charge.payloadFingerprint?.trim() ?? "";
  const fingerprintLabel = fingerprint
    ? `${fingerprint.slice(0, 16)}${fingerprint.length > 16 ? "…" : ""}`
    : "—";
  const correctionOf = charge.correction?.originalChargeId ?? null;
  return (
    <div className="max-w-[260px] space-y-0.5 text-[11px] text-slate-500">
      <div>{copy.createdBy}: {charge.createdBy ?? "—"} · {formatSupplierBatchDateTime(charge.createdAt, locale)}</div>
      {charge.confirmedAt || charge.confirmedBy ? (
        <div>{copy.confirmedBy}: {charge.confirmedBy ?? "—"} · {formatSupplierBatchDateTime(charge.confirmedAt, locale)}</div>
      ) : null}
      <div>{copy.updatedBy}: {charge.updatedBy ?? "—"} · {formatSupplierBatchDateTime(charge.updatedAt, locale)}</div>
      <div title={fingerprint || undefined}>{copy.auditFingerprint}: {fingerprintLabel}</div>
      {isSafeSupplierBatchEvidenceHref(charge.evidenceUrl) ? (
        <a
          className="block break-all text-blue-700 underline"
          href={charge.evidenceUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
        >
          {copy.evidence}: {charge.evidenceUrl}
        </a>
      ) : charge.evidenceUrl ? (
        <div>{copy.evidence}: {charge.evidenceUrl}</div>
      ) : null}
      {correctionOf ? <div className="break-all font-mono">{copy.correctCharge}: {correctionOf}</div> : null}
    </div>
  );
}

function isSafeSupplierBatchEvidenceHref(value: string | null | undefined): boolean {
  return typeof value === "string" && /^(?:https?):\/\/\S+$/i.test(value.trim());
}

/**
 * A replacement is an immutable correction output, not an ordinary confirmed
 * charge. Superseded originals are historical-only; the current replacement
 * remains eligible for a further dedicated correction.
 */
export function isSupplierBatchCorrectionReplacement(
  charge: Pick<SupplierBatchChargeView, "status" | "correction">
): boolean {
  if (charge.correction?.replacementChargeId) {
    return charge.correction.originalChargeId !== charge.correction.replacementChargeId;
  }
  return false;
}

/** A superseded original is historical-only; the current replacement remains correctable. */
function isSupplierBatchCorrectionEligible(
  charge: SupplierBatchChargeView
): boolean {
  return charge.status === "confirmed" && charge.superseded !== true;
}

function supplierBatchHistoryStatusLabel(
  status: string | null | undefined,
  language: SupplierBatchCostLanguage
) {
  const key = status?.trim().toLowerCase();
  if (key === "pending_finance_adjustment" || key === "finance_adjustment_required") {
    return language === "it" ? "Adeguamento finanziario richiesto" : "需财务调整";
  }
  if (key === "corrected" || key === "applied") {
    return language === "it" ? "Rettificato" : "已纠正";
  }
  if (key === "confirmed") {
    return language === "it" ? "Confermato" : "已确认";
  }
  if (key === "estimated") {
    return language === "it" ? "Stimato" : "预估";
  }
  return status ?? "—";
}

function SupplierBatchAllocationsSection({
  allocations,
  copy,
  language,
}: {
  allocations: SupplierBatchAllocationView[];
  copy: CostCopy;
  language: SupplierBatchCostLanguage;
}) {
  const locale = language === "it" ? "it-IT" : "zh-CN";
  return (
    <section className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3" aria-label={copy.allocations}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-950">{copy.allocations}</h3>
        <span className="text-xs font-semibold text-slate-500">{copy.allocationCount.replace("{count}", String(allocations.length))}</span>
      </div>
      {allocations.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{copy.noAllocations}</p>
      ) : (
        <>
          <div className="mt-2 hidden overflow-x-auto sm:block">
            <Table className="min-w-[680px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>{copy.line}</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>{copy.capitalized} ({language === "it" ? "valuta originale" : "原币金额（按币种）"})</TableHead>
                  <TableHead>EUR</TableHead>
                  <TableHead>±</TableHead>
                  <TableHead>{copy.date}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((allocation, index) => (
                  <TableRow key={allocation.allocationId ?? `${allocation.batchLineId}-${index}`}>
                    <TableCell>{allocation.lineNo ?? "—"}</TableCell>
                    <TableCell className="font-mono">{allocation.skuCode ?? "—"}</TableCell>
                    <TableCell>{formatSupplierBatchCents(allocation.allocatedAmountCents, allocation.currency, locale)}</TableCell>
                    <TableCell>{allocation.baseAllocatedAmountCents === null || allocation.baseAllocatedAmountCents === undefined
                      ? "—"
                      : formatSupplierBatchCents(allocation.baseAllocatedAmountCents, "EUR", locale)}</TableCell>
                    <TableCell>{formatSupplierBatchCents(allocation.roundingAdjustmentCents, allocation.currency, locale)}</TableCell>
                    <TableCell>{formatSupplierBatchDateTime(allocation.createdAt, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-2 space-y-2 sm:hidden">
            {allocations.map((allocation, index) => (
              <article key={`mobile-${allocation.allocationId ?? `${allocation.batchLineId}-${index}`}`} className="rounded-md border border-slate-200 bg-white p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{copy.line} {allocation.lineNo ?? "—"} · {allocation.skuCode ?? "—"}</span>
                  <span className="text-[11px] text-slate-500">{formatSupplierBatchDateTime(allocation.createdAt, locale)}</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  <MobileChargeField label={copy.capitalized} value={formatSupplierBatchCents(allocation.allocatedAmountCents, allocation.currency, locale)} />
                  <MobileChargeField label="EUR" value={allocation.baseAllocatedAmountCents === null || allocation.baseAllocatedAmountCents === undefined ? "—" : formatSupplierBatchCents(allocation.baseAllocatedAmountCents, "EUR", locale)} />
                  <MobileChargeField label="±" value={formatSupplierBatchCents(allocation.roundingAdjustmentCents, allocation.currency, locale)} />
                  <MobileChargeField label={copy.date} value={formatSupplierBatchDateTime(allocation.updatedAt ?? allocation.createdAt, locale)} />
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function SupplierBatchHistorySection({
  history,
  copy,
  language,
}: {
  history: SupplierBatchHistoryEntry[];
  copy: CostCopy;
  language: SupplierBatchCostLanguage;
}) {
  const locale = language === "it" ? "it-IT" : "zh-CN";
  return (
    <section className="mt-4 rounded-md border border-slate-200 bg-white p-3" aria-label={copy.history}>
      <h3 className="text-sm font-black text-slate-950">{copy.history}</h3>
      {history.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{copy.noHistory}</p>
      ) : null}
      {history.length > 0 ? (
        <ol className="mt-3 space-y-3 border-l border-slate-200 pl-4">
          {history.map((entry, index) => {
            const actor = entry.actorName ?? entry.actorEmail ?? entry.actorId ?? "—";
            const originalChargeId = entry.links?.originalChargeId ?? entry.correctionOfChargeId ?? null;
            const replacementChargeId = entry.links?.replacementChargeId ?? null;
            const correctionId = entry.links?.correctionId ?? entry.correctionId;
            const normalizedStatus = entry.status?.trim().toLowerCase();
            const isAppliedCorrection = normalizedStatus === "corrected" || normalizedStatus === "applied";
            const isPendingCorrection = entry.financeAdjustmentRequired === true || normalizedStatus === "pending_finance_adjustment" || normalizedStatus === "finance_adjustment_required";
            return (
              <li key={entry.id ?? `${entry.chargeId ?? "event"}-${index}`} className="relative text-xs">
                <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-slate-400" aria-hidden="true" />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-bold text-slate-950">{entry.action ?? entry.status ?? "—"}</span>
                  {entry.status ? <Badge className={entry.status === "confirmed" || isAppliedCorrection ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : isPendingCorrection ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-slate-200 bg-slate-100 text-slate-600"}>{supplierBatchHistoryStatusLabel(entry.status, language)}</Badge> : null}
                  <span className="text-slate-500">{formatSupplierBatchDateTime(entry.createdAt, locale)}</span>
                </div>
                <div className="mt-1 text-slate-600">{copy.actor}: {actor}</div>
                {entry.reason ? <div className="mt-1 text-slate-600">{entry.reason}</div> : null}
                {isAppliedCorrection ? <div className="mt-1 font-semibold text-emerald-700">{copy.correctionApplied}</div> : null}
                {isPendingCorrection ? <div className="mt-1 font-semibold text-amber-700">{copy.correctionPending}</div> : null}
                {originalChargeId || replacementChargeId || correctionId ? (
                  <div className="mt-1 break-all font-mono text-[11px] text-slate-500">
                    {copy.correctionLink}: {originalChargeId ?? "—"} → {replacementChargeId ?? (isPendingCorrection ? copy.pendingReplacement : "—")}
                    {correctionId ? ` · ${correctionId}` : ""}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function SupplierBatchCostExportMenu({
  copy,
  onExport,
}: {
  copy: CostCopy;
  onExport: (format: SupplierBatchCostExportFormat) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 bg-white">
          <FileText className="size-3.5" />
          {copy.exportCharges}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport("csv")}>
          <FileText className="size-4" />
          {copy.exportCsv}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport("xlsx")}>
          <FileSpreadsheet className="size-4" />
          {copy.exportXlsx}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
