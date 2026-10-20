"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Download, FileBarChart2, Loader2 } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { bucketFinanceReport, type FinanceReportTotals } from "@/lib/partspro-finance-reports.mjs";
import { financeDay, financeRound, shiftFinanceDay } from "@/lib/partspro-finance-core.mjs";
import type { AdminFinanceReport } from "@/lib/partspro-repository";
import type { Locale } from "@/i18n/config";
import { formatMoney } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { expenseLabel, type FinanceDrill } from "./admin-finance-charts";
import { financeVisualText } from "./finance-ui-copy";

type Props = {
  report: AdminFinanceReport;
  locale: Locale;
  query: string;
  canExport: boolean;
  onDrill: (drill: FinanceDrill) => void;
  onRange: (from: string, to: string) => void;
  onNavigate: (tab: string) => void;
};
const card = "min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function AdminFinanceReports({ report, locale, query, canExport, onDrill, onRange, onNavigate }: Props) {
  const t = (zh: string, it: string, en: string) => financeVisualText(locale, zh, it, en);
  const money = (value: number) => formatMoney(value, locale);
  const [unit, setUnit] = React.useState<"day" | "week" | "month">("month");
  const [exporting, setExporting] = React.useState("");
  const [exportError, setExportError] = React.useState("");
  const periods = React.useMemo(() => bucketFinanceReport(report.daily, unit), [report.daily, unit]);
  const totals = report.totals;
  const labels = {
    salesNet: t("销售收入", "Ricavi di vendita", "Sales income"),
    cogsNet: t("销售成本", "Costo del venduto", "Cost of goods sold"),
    grossProfit: t("销售毛利", "Margine lordo", "Gross profit"),
    expenseNet: t("经营费用", "Spese operative", "Operating expenses"),
    operatingProfit: t("经营利润", "Risultato operativo", "Operating profit"),
    operatingCostsNet: t("成本与费用", "Costi e spese", "Costs and expenses"),
  };
  const statements: { key: keyof typeof labels; kind: FinanceDrill["kind"] }[] = [
    { key: "salesNet", kind: "sale" }, { key: "cogsNet", kind: "cogs" }, { key: "grossProfit", kind: "gross" },
    { key: "expenseNet", kind: "expense" }, { key: "operatingProfit", kind: "operating" },
  ];
  const change = (key: keyof FinanceReportTotals) => report.changes[key] === null ? "—" : `${report.changes[key]! > 0 ? "+" : ""}${report.changes[key]}%`;
  function drillPeriod(index: number) {
    const period = periods[index];
    if (period) onDrill({ kind: "operating", title: `${labels.operatingProfit} · ${period.date} — ${period.dateTo}`, dateFrom: period.date, dateTo: period.dateTo });
  }
  async function download(format: "csv" | "xlsx") {
    if (exporting) return;
    setExporting(format); setExportError("");
    try {
      const response = await fetch(`/api/admin/finance/export?${query}&report=comprehensive&format=${format}`, { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json()).error?.message ?? `HTTP ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `partspro-report-${report.range.dateFrom}-${report.range.dateTo}.${format}`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(t("报表导出失败，请重试。", "Esportazione non riuscita. Riprova.", "Report export failed. Please retry.") + (error instanceof Error ? ` ${error.message}` : ""));
    } finally { setExporting(""); }
  }
  const today = financeDay();
  const monthStart = today.slice(0, 7) + "-01";
  const previousEnd = shiftFinanceDay(monthStart, -1);
  const quarterMonth = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;

  return <div className="min-w-0 space-y-3 sm:space-y-4" aria-label={t("综合收支报表", "Report economico completo", "Comprehensive financial report")}>
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-slate-900 p-4 text-white sm:p-5">
      <div className="min-w-0"><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold tracking-wider text-blue-200"><FileBarChart2 className="size-3.5"/>PARTSPRO / {t("经营报表", "REPORT FINANZIARI", "FINANCIAL REPORTS")}</div>
        <h2 className="text-lg font-bold">{t("综合收支报表", "Report economico completo", "Comprehensive financial report")}</h2>
        <p className="mt-1 text-[11px] text-slate-300">{report.range.dateFrom} — {report.range.dateTo} · EUR · Europe/Rome</p></div>
      {canExport && <div className="flex gap-2">{(["csv", "xlsx"] as const).map(format => <Button key={format} size="sm" variant="outline" disabled={!!exporting} aria-label={t(`导出综合报表 ${format.toUpperCase()}`, `Esporta report ${format.toUpperCase()}`, `Export report ${format.toUpperCase()}`)} onClick={() => void download(format)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">{exporting === format ? <Loader2 className="size-3.5 animate-spin"/> : <Download className="size-3.5"/>}{format.toUpperCase()}</Button>)}</div>}
    </div>
    {exportError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{exportError}</p>}
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-slate-500">{t("报表期间", "Periodo del report", "Report period")}</span>
      {[
        { label: t("上月", "Mese scorso", "Last month"), from: previousEnd.slice(0, 7) + "-01", to: previousEnd },
        { label: t("本季", "Trimestre", "This quarter"), from: `${today.slice(0, 4)}-${String(quarterMonth).padStart(2, "0")}-01`, to: today },
        { label: t("本年", "Anno corrente", "This year"), from: today.slice(0, 4) + "-01-01", to: today },
      ].map(range => <button type="button" key={range.label} className={cn("rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 hover:border-blue-300", focus)} onClick={() => onRange(range.from, range.to)}>{range.label}</button>)}
    </div>
    <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
      {[
        { label: labels.salesNet, value: totals.salesNet, hint: `${totals.salesOrders} ${t("笔已付款订单", "ordini pagati", "paid orders")}`, color: "text-blue-700", icon: ArrowDownLeft, kind: "sale" as const },
        { label: labels.operatingCostsNet, value: totals.operatingCostsNet, hint: t("销售成本 + 经营费用", "COGS + spese operative", "COGS + operating expenses"), color: "text-rose-700", icon: ArrowUpRight },
        { label: labels.operatingProfit, value: totals.operatingProfit, hint: `${t("较上期", "Vs precedente", "Vs previous")} ${change("operatingProfit")}`, color: totals.operatingProfit < 0 ? "text-rose-700" : "text-emerald-700", icon: FileBarChart2, kind: "operating" as const },
        { label: t("已登记付款净额", "Pagamenti registrati netti", "Recorded payments, net"), value: totals.recordedPaymentsNet, hint: t("供应商付款 + 已付费用", "Fornitori + spese pagate", "Supplier payments + paid expenses"), color: "text-violet-700", icon: ArrowUpRight },
      ].map(metric => <div key={metric.label} className={card}><div className="flex items-start justify-between gap-1 text-[11px] text-slate-500"><span>{metric.label}</span><metric.icon className="size-3.5 shrink-0"/></div><div className={cn("mt-2 break-all text-xl font-bold tabular-nums sm:text-2xl", metric.color)}>{metric.kind ? <button className={cn("rounded text-left", focus)} onClick={() => onDrill({ kind: metric.kind!, title: metric.kind === "sale" ? labels.salesNet : labels.operatingProfit })}>{money(metric.value)}</button> : money(metric.value)}</div><p className="mt-1 text-[10px] leading-4 text-slate-400">{metric.hint}</p></div>)}
    </div>

    <section className={card} aria-label={t("收入成本利润表", "Conto economico", "Income statement")}>
      <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-bold">{t("收入 · 成本 · 利润", "Ricavi · costi · risultato", "Income · costs · profit")}</h3><span className="text-[10px] text-slate-400">{t("对比上期", "Confronto precedente", "Previous period")}: {report.previousRange.dateFrom} — {report.previousRange.dateTo}</span></div>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-xs"><thead className="border-b text-[10px] text-slate-400"><tr>{[t("项目", "Voce", "Metric"), t("本期净额", "Netto attuale", "Current net"), t("上期净额", "Netto precedente", "Previous net"), t("增减额", "Variazione", "Difference"), t("增减率", "Variazione %", "Change %")].map((text, index) => <th key={text} className={cn("p-2 font-medium", index > 0 && "text-right")}>{text}</th>)}</tr></thead><tbody>{statements.map(item => <tr key={item.key} className={cn("border-b border-slate-100", item.key === "operatingProfit" && "bg-blue-50/60 font-bold")}><td className="p-2"><button className={cn("rounded text-blue-700 underline decoration-blue-200 underline-offset-4", focus)} onClick={() => onDrill({ kind: item.kind, title: labels[item.key] })}>{labels[item.key]}</button></td><td className="p-2 text-right font-semibold tabular-nums">{money(totals[item.key])}</td><td className="p-2 text-right tabular-nums text-slate-400">{money(report.previousTotals[item.key])}</td><td className="p-2 text-right tabular-nums">{money(financeRound(totals[item.key] - report.previousTotals[item.key]))}</td><td className="p-2 text-right tabular-nums">{change(item.key)}</td></tr>)}</tbody></table></div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500"><span>{t("净额客单价", "Valore medio netto ordine", "Average net order")}: <strong className="text-slate-800">{money(totals.averageOrderNet)}</strong></span><span>{t("经营利润率", "Margine operativo", "Operating margin")}: <strong className="text-slate-800">{totals.salesNet > 0 ? `${financeRound(totals.operatingProfit / totals.salesNet * 100)}%` : "—"}</strong></span></div>
    </section>

    <section className={card} aria-label={t("收支趋势报表", "Andamento ricavi e costi", "Income and cost trend")}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">{t("收支与利润趋势", "Andamento economico", "Income and profit trend")}</h3><div className="flex rounded-lg bg-slate-100 p-1">{(["day", "week", "month"] as const).map(value => <button key={value} aria-pressed={unit === value} onClick={() => setUnit(value)} className={cn("rounded-md px-3 py-1.5 text-[11px]", focus, unit === value && "bg-white font-semibold text-blue-700 shadow-sm")}>{value === "day" ? t("按日", "Giorni", "Daily") : value === "week" ? t("按周", "Settimane", "Weekly") : t("按月", "Mesi", "Monthly")}</button>)}</div></div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">{[{ key: "salesNet" as const, color: "bg-blue-500" }, { key: "operatingCostsNet" as const, color: "bg-rose-300" }, { key: "operatingProfit" as const, color: "bg-emerald-500" }].map(item => <span key={item.key}><i className={cn("mr-1 inline-block size-2 rounded-sm", item.color)}/>{labels[item.key]}</span>)}</div>
      <div className="mt-3 h-56 sm:h-72" role="img" aria-label={t("点击图表或期间查看经营明细", "Seleziona il grafico o il periodo per i dettagli", "Select the chart or a period to view entries")}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={periods} margin={{ top: 10, right: 8, left: 0, bottom: 0 }} onClick={state => { if (state.activeTooltipIndex != null) drillPeriod(Number(state.activeTooltipIndex)); }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#e8edf4" strokeDasharray="3 5"/><XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} minTickGap={26} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }}/><YAxis width={44} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }}/>
          <Tooltip formatter={(value, name) => [money(Number(value)), labels[String(name) as keyof typeof labels] ?? String(name)]} labelFormatter={(_label, payload) => { const period = payload?.[0]?.payload; return period ? `${period.date} — ${period.dateTo}` : ""; }}/>
          <Bar onClick={(_data,index,event)=>{event.stopPropagation();drillPeriod(index);}} isAnimationActive={false} dataKey="salesNet" fill="#4775f5" radius={[3, 3, 0, 0]} maxBarSize={42}/><Bar onClick={(_data,index,event)=>{event.stopPropagation();drillPeriod(index);}} isAnimationActive={false} dataKey="operatingCostsNet" fill="#f3a1ae" radius={[3, 3, 0, 0]} maxBarSize={42}/><Line dataKey="operatingProfit" stroke="#10a386" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}/>
        </ComposedChart></ResponsiveContainer>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{t("点击图表或下方期间打开明细；周汇总从所选首日分7天，月汇总按日历月，首尾可不足整期。", "Seleziona grafico o periodo. Settimane di 7 giorni dall’inizio; mesi di calendario, anche parziali.", "Select the chart or a period for entries. Weeks start at the range boundary; calendar months may be partial.")}</p>
      <div className="mt-3 max-h-80 overflow-auto"><table className="w-full min-w-[580px] text-xs"><thead className="text-left text-[10px] text-slate-400"><tr>{[t("期间", "Periodo", "Period"), labels.salesNet, labels.cogsNet, labels.expenseNet, labels.operatingProfit].map((text, index) => <th key={text} className={cn("p-2 font-medium", index > 0 && "text-right")}>{text}</th>)}</tr></thead><tbody>{periods.map((period, index) => <tr key={period.date} className="border-t border-slate-100"><td className="whitespace-nowrap p-2"><button className={cn("rounded text-blue-700 underline underline-offset-2", focus)} onClick={() => drillPeriod(index)}>{period.date}{period.date !== period.dateTo ? ` — ${period.dateTo}` : ""}</button></td>{(["salesNet", "cogsNet", "expenseNet", "operatingProfit"] as const).map(key => <td key={key} className={cn("p-2 text-right tabular-nums", key === "operatingProfit" && (period[key] < 0 ? "text-rose-700" : "font-semibold text-emerald-700"))}>{money(period[key])}</td>)}</tr>)}</tbody><tfoot className="border-t bg-slate-50 font-bold"><tr><td className="p-2 text-left">{t("合计", "Totale", "Total")}</td>{(["salesNet", "cogsNet", "expenseNet", "operatingProfit"] as const).map(key => <td key={key} className="p-2 text-right tabular-nums">{money(totals[key])}</td>)}</tr></tfoot></table></div>
    </section>

    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
      <section className={card} aria-label={t("费用分类报表", "Report categorie di spesa", "Expense category report")}>
        <h3 className="text-sm font-bold">{t("费用分类与支付状态", "Spese per categoria e stato", "Expenses by category and status")}</h3>
        <div className="my-3 grid grid-cols-2 gap-2">{[{ label: t("已付费用净额", "Spese pagate nette", "Paid expenses, net"), value: totals.paidExpenseNet, color: "text-emerald-700" }, { label: t("待付费用净额", "Spese da pagare nette", "Pending expenses, net"), value: totals.pendingExpenseNet, color: "text-amber-700" }].map(item => <div key={item.label} className="rounded-lg bg-slate-50 p-3"><p className="text-[10px] text-slate-500">{item.label}</p><strong className={cn("mt-1 block break-all text-lg tabular-nums", item.color)}>{money(item.value)}</strong></div>)}</div>
        {report.expenseCategories.length === 0 ? <p className="py-6 text-center text-xs text-slate-400">{t("所选期间暂无有效费用", "Nessuna spesa valida nel periodo", "No active expenses in this period")}</p> : <div className="space-y-3">{report.expenseCategories.map(row => <button key={row.category} className={cn("block w-full rounded-lg border border-slate-100 p-3 text-left hover:border-blue-200", focus)} onClick={() => onDrill({ kind: "expense", category: row.category, title: expenseLabel(row.category, locale) })}><div className="flex items-start justify-between gap-2 text-xs"><span className="font-medium">{expenseLabel(row.category, locale)} <span className="text-[10px] text-slate-400">· {row.count}</span></span><strong className="tabular-nums">{money(row.amountNet)}</strong></div><div className="my-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, row.amountNet / Math.max(0.01, totals.expenseNet) * 100))}%` }}/></div><p className="text-[10px] text-slate-400">{t("已付", "Pagato", "Paid")} {money(row.paidNet)} · {t("待付", "Da pagare", "Pending")} {money(row.pendingNet)}</p></button>)}</div>}
        <p className="mt-3 text-[10px] text-slate-400">{t("取消费用不计入利润", "Spese annullate escluse dal risultato", "Cancelled expenses excluded from profit")}: {money(totals.cancelledExpenseNet)}</p>
      </section>
      <section className={card} aria-label={t("采购与往来报表", "Acquisti e saldi aperti", "Purchases and open balances")}>
        <h3 className="text-sm font-bold">{t("采购、付款与往来", "Acquisti, pagamenti e saldi", "Purchases, payments and balances")}</h3>
        <dl className="mt-3 divide-y divide-slate-100 text-xs">{[
          { label: t("期间采购净额", "Acquisti netti nel periodo", "Period purchases, net"), value: totals.purchaseNet },
          { label: t("期间供应商已付净额", "Fornitori pagati nel periodo, netto", "Period supplier payments, net"), value: totals.supplierPaymentsNet, tab: "payments" },
          { label: t("期间待付付款登记净额", "Pagamenti in attesa nel periodo, netto", "Pending payment records, net"), value: totals.pendingSupplierPaymentsNet, tab: "payments" },
          { label: t("期间订单当前应收 · 含税运费", "Crediti attuali ordini · IVA e spedizione", "Current order receivables, incl. VAT/shipping"), value: report.summary.pendingReceivables, tab: "receivables" },
          { label: t("期间批次当前应付净额", "Debiti attuali lotti del periodo, netto", "Current period-batch payables, net"), value: report.summary.accountsPayable, tab: "payables" },
          { label: t("当前库存成本 · 不随期间变化", "Costo scorte attuali · indipendente dal periodo", "Current inventory cost, not historical"), value: report.summary.inventoryCostValue },
        ].map(item => <div key={item.label} className="flex items-start justify-between gap-4 py-3"><dt className="max-w-[65%] leading-5 text-slate-500">{item.label}</dt><dd className="shrink-0 pt-0.5 font-semibold tabular-nums">{item.tab ? <button onClick={() => onNavigate(item.tab!)} className={cn("rounded text-blue-700 underline decoration-blue-200 underline-offset-4", focus)}>{money(item.value)}</button> : money(item.value)}</dd></div>)}</dl>
        {report.summary.vatAmbiguousPurchaseNet > 0 && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{t("采购税额口径待核对", "Base IVA acquisti da verificare", "Purchase VAT basis requires review")}: {money(report.summary.vatAmbiguousPurchaseNet)}</p>}
      </section>
    </div>
    <p className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] leading-5 text-slate-600">{t("口径：销售按已付款订单净额；经营费用包含已付和待付，取消项目除外。采购和供应商付款单列，不重复扣减利润。已登记付款为净额统计，不是银行现金流；客户逐笔收款流水、期初现金余额及售后退款尚未完整汇总。往来和库存为当前余额。搜索等筛选仅汇总匹配账目。", "Criteri: ricavi netti degli ordini pagati; spese pagate e da pagare, escluse annullate. Acquisti e pagamenti fornitori non riducono di nuovo il risultato. Pagamenti registrati netti, non flusso bancario; incassi analitici, saldo iniziale e rimborsi RMA non completamente riepilogati. Saldi e scorte attuali. I filtri selezionano singoli movimenti.", "Basis: net sales from paid orders; expenses include paid and pending, excluding cancelled. Purchases and supplier payments are separate and are not deducted from profit again. Recorded net payments are not bank cash flow; itemized customer receipts, opening cash and RMA refunds are not fully reconciled. Balances and inventory are current snapshots. Filters select individual entries.")}</p>
  </div>;
}
