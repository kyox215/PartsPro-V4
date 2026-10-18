"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { translateFinanceStatic } from "./finance-ui-copy";
import type { FinanceAnalysis } from "@/lib/partspro-finance-core.mjs";
import { formatMoney } from "@/i18n/format";
import type { Locale } from "@/i18n/config";

export function FinanceCharts({ analysis, locale, labels }: { analysis: FinanceAnalysis; locale: Locale; labels: { trend: string; sales: string; gross: string; composition: string; expenses: string; operating: string; categories: string; empty: string }; }) {
  const money = (value: number) => formatMoney(value, locale);
  const composition = [{ name: labels.sales, value: analysis.trend.reduce((n,p)=>n+p.salesNet,0), color:'#2563eb' }, { name:'COGS',value:analysis.trend.reduce((n,p)=>n+p.cogsNet,0),color:'#94a3b8' }, { name:labels.expenses,value:analysis.trend.reduce((n,p)=>n+p.expenseNet,0),color:'#f59e0b' }, { name:labels.operating,value:analysis.trend.reduce((n,p)=>n+p.operatingProfit,0),color:'#059669' }];
  return <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-slate-950">{labels.trend}</h2><div className="flex gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-blue-600" />{labels.sales}</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-500" />{labels.gross}</span></div></div>
      <div className="h-64 min-w-0" role="img" aria-label={labels.trend}>
        <ResponsiveContainer width="100%" height="100%"><AreaChart data={analysis.trend} margin={{top:8,right:4,bottom:0,left:0}}>
          <defs><linearGradient id="financeSalesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.18}/><stop offset="100%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 5" vertical={false}/><XAxis dataKey="date" tickFormatter={v=>String(v).slice(5)} minTickGap={32} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/><YAxis width={48} tickFormatter={v=>Math.abs(v)>=1000?`${(v/1000).toFixed(1)}k`:String(v)} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/>
          <Tooltip formatter={v=>money(Number(v))} contentStyle={{borderRadius:12,borderColor:'#e2e8f0',fontSize:12}}/><Area name={labels.sales} type="monotone" dataKey="salesNet" stroke="#2563eb" strokeWidth={2.5} fill="url(#financeSalesFill)" isAnimationActive={false}/><Area name={labels.gross} type="monotone" dataKey="grossProfit" stroke="#10b981" strokeWidth={2} fill="transparent" isAnimationActive={false}/>
        </AreaChart></ResponsiveContainer>
      </div>
    </div>
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="mb-5 font-bold text-slate-950">{labels.composition}</h2><div className="h-64" role="img" aria-label={labels.composition}><ResponsiveContainer width="100%" height="100%"><BarChart data={composition} layout="vertical" margin={{left:0,right:12}}><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={88} tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#64748b'}}/><Tooltip formatter={v=>money(Number(v))}/><Bar dataKey="value" radius={[0,5,5,0]} barSize={22} isAnimationActive={false}>{composition.map(p=><Cell key={p.name} fill={p.color}/>)}</Bar></BarChart></ResponsiveContainer></div></div>
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 xl:col-span-2"><h2 className="mb-4 font-bold text-slate-950">{labels.categories}</h2>{analysis.expenses.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{analysis.expenses.map(item=><div key={item.category}><div className="mb-2 flex justify-between gap-2 text-sm"><span>{expenseLabel(item.category,locale)}</span><span className="font-semibold tabular-nums">{money(item.amountNet)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{width:`${Math.min(100,Math.max(0,item.amountNet/Math.max(...analysis.expenses.map(p=>p.amountNet),1)*100))}%`}}/></div></div>)}</div> : <p className="py-4 text-sm text-slate-500">{labels.empty}</p>}</div>
  </div>;
}

export function expenseLabel(category:string,locale:string) {
  const labels:Record<string,[string,string]>={rent:['房租','Affitto'],salary:['薪资','Stipendi'],shipping:['物流运输','Spedizioni'],platform_fee:['平台费用','Commissioni piattaforma'],utilities:['水电杂费','Utenze'],tax:['税费','Imposte'],supplier_fee:['供应商费用','Spese fornitore'],bank_fee:['银行手续费','Commissioni bancarie'],other:['其他费用','Altre spese']};
  return translateFinanceStatic(labels[category]?.[locale.startsWith('zh')?0:1] ?? category, locale);
}
