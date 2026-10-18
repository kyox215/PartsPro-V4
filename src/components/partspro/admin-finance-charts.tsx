"use client";

import * as React from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, CircleHelp, Table2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { financeVisualText, translateFinanceStatic } from "./finance-ui-copy";
import { bucketFinanceTrend, financeRound, type FinanceAnalysis, type FinanceSupplierAnalysis } from "@/lib/partspro-finance-core.mjs";
import { formatMoney } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export type FinanceDrill = {
  kind: "sale" | "cogs" | "expense" | "gross" | "operating" | "receivable" | "payable";
  title: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  confidence?: string;
  supplierKey?: string;
};
type Metric = "salesNet" | "grossProfit" | "operatingProfit";
type Props = { analysis: FinanceAnalysis & { suppliers: FinanceSupplierAnalysis[] }; locale: Locale; onDrill: (drill: FinanceDrill) => void };
const colors = ["#3563f6", "#16a18c", "#f5a648", "#9075e5", "#ef798a", "#7a96b4", "#cad4e1", "#97b2ed", "#98c5bf"];
const card = "min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20 sm:p-5";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export function FinanceSparkline({ values, color = "currentColor" }: { values: number[]; color?: string }) {
  if (!values.length) return null;
  const low = Math.min(0, ...values), high = Math.max(1, ...values), span = high - low;
  const points = values.map((v, i) => `${i * 96 / Math.max(1, values.length - 1)},${24 - (v - low) / span * 21}`).join(" ");
  return <svg viewBox="0 0 96 28" className="h-7 w-24 opacity-70" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg>;
}

export function FinanceCharts({ analysis, locale, onDrill }: Props) {
  const t = (zh: string, it: string, en: string) => financeVisualText(locale, zh, it, en);
  const money = (v: number) => formatMoney(v, locale);
  const [unit, setUnit] = React.useState<"day" | "week">("day");
  const [metric, setMetric] = React.useState<Metric>("salesNet");
  const [showCurrent, setShowCurrent] = React.useState(true);
  const [showPrevious, setShowPrevious] = React.useState(true);
  const [showTable, setShowTable] = React.useState(false);
  const [allSuppliers, setAllSuppliers] = React.useState(false);
  const id = React.useId();
  const points = React.useMemo(() => bucketFinanceTrend(analysis.trend, analysis.previousTrend, unit), [analysis.trend, analysis.previousTrend, unit]);
  const metrics: { key: Metric; title: string; kind: FinanceDrill["kind"]; color: string }[] = [
    { key: "salesNet", title: t("销售净额", "Vendite nette", "Net sales"), kind: "sale", color: "#3563f6" },
    { key: "grossProfit", title: t("毛利", "Margine lordo", "Gross profit"), kind: "gross", color: "#14987e" },
    { key: "operatingProfit", title: t("经营利润", "Risultato operativo", "Operating profit"), kind: "operating", color: "#7563cd" },
  ];
  const selected = metrics.find(m => m.key === metric)!;
  const previousKey = `previous${metric[0].toUpperCase()}${metric.slice(1)}`;
  const totals = analysis.trend.reduce((total, p) => ({ salesNet: financeRound(total.salesNet + p.salesNet), cogsNet: financeRound(total.cogsNet + p.cogsNet), expenseNet: financeRound(total.expenseNet + p.expenseNet), grossProfit: financeRound(total.grossProfit + p.grossProfit), operatingProfit: financeRound(total.operatingProfit + p.operatingProfit) }), { salesNet: 0, cogsNet: 0, expenseNet: 0, grossProfit: 0, operatingProfit: 0 });
  const suppliers = allSuppliers ? analysis.suppliers : analysis.suppliers.slice(0, 5);
  const expenseTotal = totals.expenseNet;
  const positiveExpenses = expenseTotal > 0 && analysis.expenses.every(item => item.amountNet >= 0);
  function drillPoint(index: number, usePrevious = !showCurrent) {
    const point = points[index];
    if (point) {
      const from=usePrevious?point.previousDate:point.date;
      const to=usePrevious?point.previousDateTo:point.dateTo;
      if(from&&to)onDrill({kind:selected.kind,title:`${selected.title} · ${from}${from!==to?` — ${to}`:""}`,dateFrom:from,dateTo:to});
    }
  }
  return <>
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <section className={card} aria-label={t("经营趋势", "Andamento operativo", "Performance trend")}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-950">{t("经营趋势", "Andamento operativo", "Performance trend")}</h2><p className="mt-1 text-[11px] text-slate-400">{t("看变化，也看变化的原因", "Risultati e variazioni nel tempo", "Track the movement behind the numbers")}</p></div><div className="flex rounded-lg bg-slate-100 p-0.5">{(["day", "week"] as const).map(value => <button key={value} type="button" aria-pressed={unit === value} onClick={() => setUnit(value)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium", focus, unit === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500")}>{value === "day" ? t("按日", "Giorni", "Daily") : t("按周", "Settimane", "Weekly")}</button>)}</div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1">{metrics.map(m => <button key={m.key} type="button" aria-pressed={metric === m.key} onClick={() => setMetric(m.key)} className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", focus, metric === m.key ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50")}>{m.title}</button>)}</div><div className="flex gap-3 text-[11px]">{[{ label: t("本期", "Periodo", "Current"), active: showCurrent, toggle: () => { if (showPrevious) setShowCurrent(v => !v); }, dashed: false }, { label: t("上期", "Precedente", "Previous"), active: showPrevious, toggle: () => { if (showCurrent) setShowPrevious(v => !v); }, dashed: true }].map(item => <button type="button" key={item.label} aria-pressed={item.active} onClick={item.toggle} className={cn("flex items-center gap-1.5 rounded", focus, item.active ? "text-slate-600" : "text-slate-300")}><i className={cn("w-4 border-t-2", item.dashed && "border-dashed")} style={{ borderColor: item.dashed ? "#abb9d0" : selected.color }} />{item.label}</button>)}</div></div>
        <div className="mt-5 h-60 sm:h-64" role="img" aria-label={t("经营趋势图，明细可通过下方数据表查看", "Grafico operativo; dettagli nella tabella seguente", "Performance chart; details available in the data table below")}>
          <ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 10, right: 12, bottom: 0, left: 0 }} onClick={state => { const index = Number(state.activeTooltipIndex); if (state.activeTooltipIndex != null && Number.isInteger(index)) drillPoint(index); }} accessibilityLayer>
            <CartesianGrid stroke="#e8edf4" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="date" tickFormatter={v => String(v).slice(5)} minTickGap={30} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis width={45} tickFormatter={v => Math.abs(v) >= 1000 ? `${financeRound(v / 1000)}k` : String(v)} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <Tooltip content={({ active, payload }) => { const point = payload?.[0]?.payload as (typeof points)[number] | undefined; return active && point ? <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg"><p className="font-semibold">{showCurrent?point.date:point.previousDate}{unit === "week" ? ` — ${showCurrent?point.dateTo:point.previousDateTo}` : ""}</p><p className="mt-2">{selected.title}: <strong>{money(showCurrent?point[metric]:Number(point[previousKey as keyof typeof point]))}</strong></p>{showCurrent && showPrevious && <p className="mt-1 text-slate-500">{point.previousDate}{unit === "week" ? ` — ${point.previousDateTo}` : ""}: {money(Number(point[previousKey as keyof typeof point]))}</p>}<p className="mt-1 text-slate-500">{t("毛利率", "Margine %", "Gross margin")}: {(showCurrent?point.salesNet:point.previousSalesNet)>0?`${financeRound((showCurrent?point.grossProfit:point.previousGrossProfit)/(showCurrent?point.salesNet:point.previousSalesNet)*100)}%`:'—'}</p><p className="mt-2 text-blue-600">{t("点击查看构成明细", "Clicca per i dettagli", "Click to inspect entries")}</p></div> : null; }} />
            {showPrevious && <Line dataKey={previousKey} type="linear" stroke="#b6c3d8" strokeDasharray="4 5" strokeWidth={1.6} dot={false} activeDot={false} isAnimationActive={false} />}
            {showCurrent && <Line dataKey={metric} type="linear" stroke={selected.color} strokeWidth={2.4} dot={false} activeDot={{ r: 4, stroke: "white", strokeWidth: 2 }} isAnimationActive={false} />}
          </LineChart></ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400"><span>{unit === "week" ? t("自所选首日起每7天合计，末段可不足7天", "Totali di 7 giorni dall’inizio; ultimo intervallo parziale", "7-day buckets from the start; the last may be shorter") : t("上期按等长期间的第N天对齐", "Confronto per posizione in periodi della stessa durata", "Prior period aligned by day in equally long periods")}</span><button type="button" aria-expanded={showTable} aria-controls={`${id}-trend-table`} className={cn("flex items-center gap-1 rounded text-blue-600", focus)} onClick={() => setShowTable(v => !v)}><Table2 className="size-3" />{showTable ? t("收起数据表", "Nascondi tabella", "Hide data table") : t("查看数据表", "Mostra tabella", "View data table")}</button></div>
        {showTable && <div id={`${id}-trend-table`} className="mt-3 max-h-64 overflow-auto"><table className="w-full text-left text-xs"><caption className="sr-only">{selected.title}</caption><thead className="text-slate-400"><tr><th className="p-2">{t("期间", "Periodo", "Period")}</th><th className="p-2 text-right">{t("本期", "Attuale", "Current")}</th><th className="p-2 text-right">{t("上期", "Precedente", "Previous")}</th></tr></thead><tbody>{points.map((point, index) => <tr key={point.date} className="border-t border-slate-100"><td className="p-2"><button type="button" onClick={() => drillPoint(index,false)} className={cn("rounded text-blue-600 underline underline-offset-2", focus)}>{point.date}{unit === "week" ? ` — ${point.dateTo}` : ""}</button></td><td className="p-2 text-right tabular-nums">{money(point[metric])}</td><td className="p-2 text-right tabular-nums">{money(Number(point[previousKey as keyof typeof point]))}</td></tr>)}</tbody></table></div>}
      </section>
      <ProfitWaterfall totals={totals} locale={locale} onDrill={onDrill} />
    </div>
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <section className={card} aria-label={t("费用结构", "Struttura spese", "Expense mix")}><div className="flex justify-between gap-3"><div><h2 className="text-sm font-bold">{t("费用结构", "Struttura spese", "Expense mix")}</h2><p className="mt-1 text-[11px] text-slate-400">{t("按净额占比 · 含待付费用", "Quote nette · incluse spese da pagare", "Net shares · includes pending expenses")}</p></div><span className="text-sm font-bold tabular-nums">{money(expenseTotal)}</span></div>
        {analysis.expenses.length ? <div className="mt-5 flex flex-col items-center gap-6 min-[420px]:flex-row"><div className="relative size-36 shrink-0"><svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true"><circle cx="60" cy="60" r="46" fill="none" stroke="#f1f5f9" strokeWidth="14" />{positiveExpenses && analysis.expenses.map((item, i) => { const start = analysis.expenses.slice(0, i).reduce((n, p) => n + p.amountNet, 0) / expenseTotal * 289; return <circle key={item.category} onClick={()=>onDrill({kind:"expense",title:expenseLabel(item.category,locale),category:item.category})} style={{cursor:"pointer"}} cx="60" cy="60" r="46" fill="none" stroke={colors[i % colors.length]} strokeWidth="14" strokeDasharray={`${item.amountNet / expenseTotal * 289} 289`} strokeDashoffset={-start} />; })}</svg><div className="absolute inset-0 grid place-content-center text-center"><span className="text-xl font-bold">{analysis.expenses.length}</span><span className="mt-1 text-[10px] text-slate-400">{t("费用类别", "Categorie", "Categories")}</span></div></div><div className="w-full min-w-0 space-y-1.5">{analysis.expenses.map((item, i) => <button type="button" key={item.category} onClick={() => onDrill({ kind: "expense", title: expenseLabel(item.category, locale), category: item.category })} className={cn("flex w-full items-center gap-2 rounded-lg p-1.5 text-xs hover:bg-slate-50", focus)}><i className="size-2 shrink-0 rounded-full" style={{ background: colors[i % colors.length] }} /><span className="min-w-0 flex-1 text-left text-slate-600">{expenseLabel(item.category, locale)}</span><span className="font-semibold tabular-nums">{money(item.amountNet)}</span><span className="w-10 text-right text-[10px] text-slate-400">{positiveExpenses ? `${financeRound(item.amountNet / expenseTotal * 100)}%` : "—"}</span><ArrowUpRight className="size-3 text-slate-300" /></button>)}</div></div> : <div className="flex min-h-36 items-center justify-center gap-4 text-slate-400"><div className="grid size-16 place-content-center rounded-full border-8 border-slate-100"><span className="text-sm">0</span></div><p className="text-xs">{t("所选期间暂无费用", "Nessuna spesa nel periodo", "No expenses in this period")}</p></div>}
      </section>
      <section className={card} aria-label={t("供应商应付分布", "Debiti per fornitore", "Supplier payables")}><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-sm font-bold">{t("供应商应付分布", "Debiti per fornitore", "Supplier payables")}</h2><p className="mt-1 text-[11px] text-slate-400">{t("期间内批次 · 扣除全部历史关联付款", "Lotti nel periodo · meno i pagamenti storici", "Batches in period · less all historical linked payments")}</p></div><span className="text-[10px] text-slate-400">EUR</span></div><div className="mt-5 space-y-3.5">{suppliers.length ? suppliers.map(item => <button type="button" key={item.key} onClick={() => onDrill({ kind: "payable", title: item.supplierName || t("未知供应商", "Fornitore sconosciuto", "Unknown supplier"), supplierKey: item.key })} className={cn("block w-full rounded-lg text-left", focus)}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-700">{item.supplierName || t("未知供应商", "Fornitore sconosciuto", "Unknown supplier")} <span className="ml-1 text-[10px] font-normal text-slate-400">{item.batches} {t("批", "lotti", "batches")}</span></span><span className="shrink-0 font-semibold tabular-nums">{money(item.outstandingNet)} <ArrowUpRight className="ml-1 inline size-3 text-slate-400" /></span></div><div className="flex h-2 overflow-hidden rounded-full bg-slate-100">{item.purchaseNet > 0 && <><i className="bg-blue-100" style={{ width: `${item.appliedPaidNet / item.purchaseNet * 100}%` }} /><i className="bg-blue-500" style={{ width: `${item.outstandingNet / item.purchaseNet * 100}%` }} /></>}</div><div className="mt-1.5 flex justify-between text-[10px] text-slate-400"><span>{t("采购", "Acquisti", "Purchased")} {money(item.purchaseNet)}</span><span>{t("历史已付", "Pagato storico", "Historically paid")} {money(item.paidNet)}</span></div></button>) : <p className="py-8 text-center text-xs text-slate-400">{t("期间内暂无采购批次", "Nessun lotto nel periodo", "No purchase batches in this period")}</p>}</div><div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400"><span><i className="mr-1 inline-block size-2 rounded bg-blue-100" />{t("已抵扣付款", "Pagamenti applicati", "Applied payments")}<i className="mr-1 ml-3 inline-block size-2 rounded bg-blue-500" />{t("待付净额", "Residuo netto", "Outstanding net")}</span>{analysis.suppliers.length > 5 && <button type="button" onClick={() => setAllSuppliers(v => !v)} aria-expanded={allSuppliers} className={cn("flex items-center text-blue-600", focus)}>{allSuppliers ? t("收起", "Riduci", "Show less") : t("查看全部", "Mostra tutti", "View all")}{allSuppliers ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}</button>}</div></section>
    </div>
  </>;
}

function ProfitWaterfall({ totals, locale, onDrill }: { totals: { salesNet: number; cogsNet: number; expenseNet: number; grossProfit: number; operatingProfit: number }; locale: Locale; onDrill: Props["onDrill"] }) {
  const t = (zh: string, it: string, en: string) => financeVisualText(locale, zh, it, en);
  const money = (v: number) => formatMoney(v, locale);
  const steps: { label: string; start: number; end: number; value: number; color: string; kind: FinanceDrill["kind"] }[] = [
    { label: t("销售", "Vendite", "Sales"), start: 0, end: totals.salesNet, value: totals.salesNet, color: "#3563f6", kind: "sale" },
    { label: "COGS", start: totals.salesNet, end: totals.grossProfit, value: -totals.cogsNet, color: "#a8b8d1", kind: "cogs" },
    { label: t("费用", "Spese", "Expenses"), start: totals.grossProfit, end: totals.operatingProfit, value: -totals.expenseNet, color: "#f5b15c", kind: "expense" },
    { label: t("经营利润", "Risultato", "Profit"), start: 0, end: totals.operatingProfit, value: totals.operatingProfit, color: totals.operatingProfit >= 0 ? "#159b82" : "#df6272", kind: "operating" },
  ];
  const high = Math.max(1, ...steps.flatMap(p => [p.start, p.end])), low = Math.min(0, ...steps.flatMap(p => [p.start, p.end]));
  const y = (value: number) => 210 - (value - low) / (high - low) * 165;
  return <section className={card} aria-label={t("利润构成", "Composizione risultato", "Profit bridge")}><div className="flex items-start justify-between gap-2"><div><h2 className="text-sm font-bold">{t("利润构成", "Composizione risultato", "Profit bridge")}</h2><p className="mt-1 text-[11px] text-slate-400">{t("从销售收入，到最终经营利润", "Dalle vendite al risultato operativo", "From net sales to operating profit")}</p></div><CircleHelp className="size-4 shrink-0 text-slate-300" aria-hidden="true" /></div><div className="mt-5 flex items-baseline gap-2"><strong className={cn("text-2xl font-bold tracking-tight tabular-nums", totals.operatingProfit < 0 ? "text-rose-600" : "text-emerald-700")}>{money(totals.operatingProfit)}</strong><span className="text-[10px] text-slate-400">{t("经营利润", "Risultato operativo", "Operating profit")}</span></div><svg viewBox="0 0 340 238" className="mt-2 w-full" aria-hidden="true"><line x1="12" x2="328" y1={y(0)} y2={y(0)} stroke="#e2e8f0" strokeDasharray="3 4" />{steps.map((p, i) => <g key={p.kind} onClick={()=>onDrill({kind:p.kind,title:p.label})} style={{cursor:"pointer"}}><rect x={23 + i * 80} y={Math.min(y(p.start), y(p.end))} width="48" height={Math.max(2, Math.abs(y(p.start) - y(p.end)))} rx="4" fill={p.color} />{i < 2 && <line x1={71 + i * 80} x2={103 + i * 80} y1={y(p.end)} y2={y(p.end)} stroke="#cbd5e1" strokeDasharray="3 3" />}<text x={47 + i * 80} y="232" textAnchor="middle" fontSize="10" fill="#94a3b8">{p.label}</text></g>)}</svg><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">{steps.map(p => <button type="button" key={p.kind} onClick={() => onDrill({ kind: p.kind, title: p.label })} className={cn("flex items-center justify-between gap-1 rounded py-1 text-[11px]", focus)}><span className="text-slate-500"><i className="mr-1.5 inline-block size-1.5 rounded-full" style={{ background: p.color }} />{p.label}</span><span className="font-semibold tabular-nums">{money(p.value)}</span></button>)}</div></section>;
}

export function expenseLabel(category: string, locale: string) {
  const labels: Record<string, [string, string]> = { rent: ['房租', 'Affitto'], salary: ['薪资', 'Stipendi'], shipping: ['物流运输', 'Spedizioni'], platform_fee: ['平台费用', 'Commissioni piattaforma'], utilities: ['水电杂费', 'Utenze'], tax: ['税费', 'Imposte'], supplier_fee: ['供应商费用', 'Spese fornitore'], bank_fee: ['银行手续费', 'Commissioni bancarie'], other: ['其他费用', 'Altre spese'] };
  return translateFinanceStatic(labels[category]?.[locale.startsWith('zh') ? 0 : 1] ?? category, locale);
}
