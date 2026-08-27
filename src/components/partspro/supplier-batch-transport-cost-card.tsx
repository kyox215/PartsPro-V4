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
import { formatEuro } from "@/lib/partspro-data";
import type {
  SupplierBatchCharge,
  SupplierBatchChargeStatus,
  SupplierBatchCostStatus,
  SupplierBatchCostSummary,
  SupplierBatchLineCost,
} from "@/lib/partspro-supplier-batch-cost-core.mjs";

export type SupplierBatchCostLanguage = "zh" | "it";
export type SupplierBatchCostExportFormat = "csv" | "xlsx";

export type SupplierBatchCostDetail = {
  batch: {
    id: string;
    batchCode: string;
    currency: string;
    totalCost: number;
    costSummary: SupplierBatchCostSummary | null;
  };
  lines: Array<{
    id: string;
    lineNo: number;
    skuCode: string | null;
    name: string;
    qtyReceived: number;
    product: { weightGram: number | null } | null;
    costs: SupplierBatchLineCost | null;
  }>;
  charges: SupplierBatchCharge[];
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
    };
  }

  const hasConfirmed = summary.confirmedCount > 0;
  const hasEstimate = summary.estimatedCount > 0;
  const hasRecordedCost = hasConfirmed || hasEstimate;

  return {
    status: summary.costStatus,
    goodsValueCents: summary.goodsValueCents,
    confirmedTransportCents: hasConfirmed ? summary.confirmedCapitalizedCents : null,
    estimatedTransportCents: hasEstimate ? summary.estimatedCapitalizedCents : null,
    confirmedLandedCents: hasConfirmed ? summary.confirmedLandedTotalCents : null,
    projectedLandedCents: hasRecordedCost ? summary.projectedLandedTotalCents : null,
    hasConfirmed,
    hasEstimate,
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
  review: string;
  charges: string;
  noCharges: string;
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
      PRODUCT_MAPPING_REQUIRED: "存在未映射商品",
      WEIGHT_REQUIRED_FOR_ESTIMATE: "重量分摊缺可靠重量",
      FINANCIAL_ADJUSTMENT_REQUIRED: "已有成本层需要财务调整",
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
    review: "复核提示",
    charges: "费用记录",
    noCharges: "尚未登记运输费用。",
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
      PRODUCT_MAPPING_REQUIRED: "Prodotto non mappato",
      WEIGHT_REQUIRED_FOR_ESTIMATE: "Peso affidabile mancante",
      FINANCIAL_ADJUSTMENT_REQUIRED: "Serve rettifica finanziaria",
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
    review: "Da verificare",
    charges: "Costi registrati",
    noCharges: "Nessun costo trasporto registrato.",
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
  },
};

function formatCents(cents: number | null): string {
  return cents === null ? "—" : formatEuro(cents / 100);
}

export function formatSupplierBatchUnitCost(
  value: number | null,
  language: SupplierBatchCostLanguage
): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat(language === "it" ? "it-IT" : "zh-CN", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
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
    ? `${copy.confirmedShort} ${copy.transportShort} ${formatCents(display.confirmedTransportCents)} · ${copy.landedShort} ${formatCents(display.confirmedLandedCents)}`
    : display.hasEstimate
      ? `${copy.estimatedShort} ${copy.transportShort} ${formatCents(display.estimatedTransportCents)} · ${copy.landedShort} ${formatCents(display.projectedLandedCents)}`
      : `${copy.transportShort} — · ${copy.landedShort} —`;
  const estimateLine = display.hasConfirmed && display.hasEstimate
    ? `${copy.estimatedShort} ${copy.transportShort} ${formatCents(display.estimatedTransportCents)} · ${copy.landedShort} ${formatCents(display.projectedLandedCents)}`
    : null;

  return (
    <div className="space-y-0.5 text-xs leading-tight">
      {canReadCosts ? (
        <>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Badge className={statusClass(display.status)}>{statusText(summary, copy)}</Badge>
            <span className="font-semibold text-slate-700">{primaryLine}</span>
          </div>
          {estimateLine ? <div className="text-[11px] text-blue-700">{estimateLine}</div> : null}
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
  costs: SupplierBatchLineCost | null;
  summary: SupplierBatchCostSummary | null;
  language: SupplierBatchCostLanguage;
  canReadCosts: boolean;
}) {
  const copy = COPY[language];
  const display = getSupplierBatchCostSummaryDisplay(summary);
  const visible = canReadCosts && display.hasConfirmed && costs !== null;

  return (
    <div className="space-y-0.5 text-xs">
      <CostLine label={copy.goods} value={visible ? formatCents(costs.goodsCostCents) : "—"} strong />
      <CostLine label={copy.inbound} value={visible ? formatCents(costs.confirmedInboundCents) : "—"} strong />
      <CostLine label={copy.landedUnit} value={visible ? formatSupplierBatchUnitCost(costs.landedUnitCost, language) : "—"} strong />
      <CostLine label={copy.landedLine} value={visible ? formatCents(costs.landedLineCostCents) : "—"} strong />
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
  canManageCosts,
  onAddCharge,
  onEditCharge,
  onExportCharges,
}: {
  detail: SupplierBatchCostDetail;
  language: SupplierBatchCostLanguage;
  canReadCosts: boolean;
  canManageCosts: boolean;
  onAddCharge?: () => void;
  onEditCharge?: (charge: SupplierBatchCharge) => void;
  onExportCharges?: (format: SupplierBatchCostExportFormat) => void;
}) {
  const copy = COPY[language];
  const canManage = canReadCosts && canManageCosts;
  const summary = detail.batch.costSummary;
  const display = getSupplierBatchCostSummaryDisplay(summary);
  const hasReviewCodes = summary !== null && summary.reviewCodes.length > 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3" aria-label={copy.title}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black text-slate-950">{copy.title}</h2>
          <p className="mt-1 text-xs text-slate-500">{copy.description}</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {onAddCharge ? (
              <Button size="sm" className="h-8" onClick={onAddCharge}>
                <Plus className="size-3.5" />
                {copy.addCharge}
              </Button>
            ) : null}
            {onExportCharges ? (
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
              value={display.goodsValueCents === null ? formatEuro(detail.batch.totalCost) : formatCents(display.goodsValueCents)}
            />
            <CostMetric label={copy.confirmedTransport} value={formatCents(display.confirmedTransportCents)} />
            <CostMetric label={copy.estimatedTransport} value={formatCents(display.estimatedTransportCents)} />
            <CostMetric label={copy.confirmedLanded} value={formatCents(display.confirmedLandedCents)} />
            <CostMetric
              label={copy.projectedLanded}
              value={display.hasEstimate ? `${formatCents(display.projectedLandedCents)} · ${language === "zh" ? "含预估" : "stimato"}` : formatCents(display.projectedLandedCents)}
            />
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
            <Table className="min-w-[1120px] text-xs">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.charges.map((charge) => (
                  <TableRow key={charge.chargeId}>
                    <TableCell>
                      <div className="flex min-w-[150px] flex-col items-start gap-1">
                        <Badge className={chargeStatusClass(charge.status)}>{copy.chargeStatus[charge.status]}</Badge>
                        <span className="text-[11px] text-slate-500">
                          {charge.status === "estimated"
                            ? canManage
                              ? copy.editableCharge
                              : copy.estimatedCharge
                            : copy.readOnlyCharge}
                        </span>
                        {charge.status === "estimated" && canManage && onEditCharge ? (
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
                      </div>
                    </TableCell>
                    <TableCell>{copy.chargeTypes[charge.chargeType] ?? charge.chargeType}</TableCell>
                    <TableCell>{formatCents(charge.amountNetCents)}</TableCell>
                    <TableCell>{formatCents(charge.vatAmountCents)}</TableCell>
                    <TableCell>{formatCents(charge.amountGrossCents)}</TableCell>
                    <TableCell>{formatCents(charge.capitalizedAmountCents)}</TableCell>
                    <TableCell>{copy.allocationMethods[charge.allocationMethod] ?? charge.allocationMethod}</TableCell>
                    <TableCell>{charge.carrierName ?? "—"}</TableCell>
                    <TableCell>{charge.reference ?? "—"}</TableCell>
                    <TableCell>{formatDate(charge.occurredAt, language)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-500">{copy.noCharges}</div>
          )}
        </div>
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
