"use client";

import * as React from "react";
import { financeVisualText, financeText, translateFinanceStatic } from "./finance-ui-copy";
import { englishUiCopy } from "@/i18n/english-ui-copy";
import { AdminActionButton, AdminErrorSummary, AdminNotice } from "./admin-feedback";
import { financeEditableId, financeGross, parseFinanceMoney as parseLegacyFinanceMoney, isFinanceDate } from "@/lib/admin-finance-input.mjs";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Download, HandCoins, Plus, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/i18n/format";
import { financeDay, shiftFinanceDay, validFinanceDate, financeLocalInput, financeRomeLocalToIso as financeLocalDateTimeToIso, type FinanceAnalysis, type FinanceSupplierAnalysis } from "@/lib/partspro-finance-core.mjs";
import type { AdminFinanceSummary, AdminFinanceLedgerRow, AdminFinanceCostAllocation } from "@/lib/partspro-repository";
import { useI18n } from "./i18n-provider";
import { FinanceCharts, FinanceSparkline, expenseLabel, type FinanceDrill } from "./admin-finance-charts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Filters = { supplierKey?:string;dateFrom:string;dateTo:string;dateMode:string;q:string;supplier:string;confidence:string;category:string };
type Analysis = FinanceAnalysis & { suppliers:FinanceSupplierAnalysis[];summary:AdminFinanceSummary;previousRange:{dateFrom:string;dateTo:string};payables:(AdminFinanceLedgerRow & {paidNet:number;outstandingNet:number})[];payablesTotal:number };
type Page<T>={data:T[];meta:{total:number}};
type Editor={kind:'expense'|'supplier-payment';row?:AdminFinanceLedgerRow};
const categories=['rent','salary','shipping','platform_fee','utilities','tax','supplier_fee','bank_fee','other'];
const pageSize=25;
const initialFilters=():Filters=>({dateFrom:shiftFinanceDay(financeDay(),-29),dateTo:financeDay(),dateMode:'created',q:'',supplier:'',confidence:'all',category:'all'});
function params(filters:Filters) { const query=new URLSearchParams(); for(const [key,value] of Object.entries(filters)) if(value && value!=='all') query.set(key,value); return query; }

function useFinanceRequest<T>(url:string|null,revision:number) {
  const [result,setResult]=React.useState<{key:string;data?:T;error?:string}>({key:''});
  const key=`${url}:${revision}`;
  React.useEffect(()=>{
    if(!url) return;
    const controller=new AbortController();
    void (async()=>{try {
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
      if(!controller.signal.aborted) setResult({key,data:body});
    } catch(error) {if(!controller.signal.aborted) setResult({key,error:error instanceof Error?error.message:'Request failed'});} })();
    return ()=>controller.abort();
  },[url,key]);
  return {data:result.key===key?result.data:undefined,error:result.key===key?result.error:undefined,loading:!!url && result.key!==key};
}

export function AdminFinancePanel(props: {permissions:string[];currentUserId?:string}) { return <AdminFinancePanelContent key={props.currentUserId ?? "finance-user"} {...props}/>; }
function AdminFinancePanelContent({permissions}:{permissions:string[];currentUserId?:string}) {
  const {locale}=useI18n();
  const it=!locale.startsWith('zh');
  const t=(zh:string,italian:string)=>financeText(zh,italian,locale);
  const money=(value:number)=>formatMoney(value,locale);
  const [filters,setFilters]=React.useState<Filters>(initialFilters);
  const [draft,setDraft]=React.useState<Filters>(initialFilters);
  const [tab,setTab]=React.useState('overview');
  const [salesType,setSalesType]=React.useState('sale');
  const [paymentHistoryBatch,setPaymentHistoryBatch]=React.useState('');
  const [page,setPage]=React.useState(0);
  const [revision,setRevision]=React.useState(0);
  const [editor,setEditor]=React.useState<Editor|null>(null);
  const [notice,setNotice]=React.useState('');
  const [filterError,setFilterError]=React.useState('');
  const [filtersOpen,setFiltersOpen]=React.useState(false);
  const [drill,setDrill]=React.useState<FinanceDrill|null>(null);
  const [drillPart,setDrillPart]=React.useState('sale');
  const [drillPage,setDrillPage]=React.useState(0);
  const drillTrigger=React.useRef<HTMLElement|null>(null);
  const v=(zh:string,it:string,en:string)=>financeVisualText(locale,zh,it,en);
  const manage=permissions.includes('finance.manage');
  const canExport=permissions.includes('finance.export');
  const base=params(filters).toString();
  const overview=useFinanceRequest<{data:Analysis}>(`/api/admin/finance/analysis?${base}&limit=${pageSize}&offset=${tab==='payables'?page*pageSize:0}`,revision);
  const ledgerBase=tab==='payments'&&paymentHistoryBatch?params({...filters,dateFrom:'',dateTo:'',q:paymentHistoryBatch,supplier:'',confidence:'all',category:'all'}).toString():base;
  const type=tab==='sales'?salesType:tab==='receivables'?'receivable':tab==='expenses'?'expense':'supplier_payment';
  const ledger=useFinanceRequest<Page<AdminFinanceLedgerRow>>(['sales','receivables','expenses','payments'].includes(tab)&&!(tab==='sales'&&salesType==='allocations')?`/api/admin/finance/ledger?${ledgerBase}&type=${type}&limit=${pageSize}&offset=${page*pageSize}`:null,revision);
  const cogs=useFinanceRequest<Page<AdminFinanceCostAllocation>>(tab==='sales'&&salesType==='allocations'?`/api/admin/finance/cogs?${base}&limit=${pageSize}&offset=${page*pageSize}`:null,revision);
  const analysis=overview.data?.data;
  const summary=analysis?.summary;
  const drillFilters={...filters,...(drill?.dateFrom?{dateFrom:drill.dateFrom,dateTo:drill.dateTo!}:{}),...(drill?.category?{category:drill.category}:{}),...(drill?.confidence?{confidence:drill.confidence}:{}),...(drill?.supplierKey?{supplierKey:drill.supplierKey}:{})};
  const drillParams=params(drillFilters).toString();
  const drillType=drill?.kind==='gross'||drill?.kind==='operating'?drillPart:drill?.kind;
  const drillLedger=useFinanceRequest<Page<AdminFinanceLedgerRow>>(drill&&drill.kind!=='payable'?`/api/admin/finance/ledger?${drillParams}&type=${drillType}&limit=${pageSize}&offset=${drillPage*pageSize}`:null,revision);
  const drillPayables=useFinanceRequest<{data:Analysis}>(drill?.kind==='payable'?`/api/admin/finance/analysis?${drillParams}&limit=${pageSize}&offset=${drillPage*pageSize}`:null,revision);
  const drillTrend=(analysis?[...analysis.previousTrend,...analysis.trend]:[]).filter(p=>p.date>=drillFilters.dateFrom&&p.date<=drillFilters.dateTo)??[];
  const drillTotal=(key:'salesNet'|'cogsNet'|'expenseNet'|'grossProfit'|'operatingProfit')=>drillTrend.reduce((n,p)=>n+p[key],0);
  function openDrill(next:FinanceDrill){drillTrigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setDrill(next);setDrillPart('sale');setDrillPage(0);}
  function openFullLedger(){
    if(!drill)return;
    apply(drillFilters);
    const target=drill.kind==='payable'?'payables':drill.kind==='receivable'?'receivables':drill.kind==='expense'?'expenses':'sales';
    changeTab(target);if(target==='sales')setSalesType(drill.kind==='cogs'?'cogs':drillPart);
    setDrill(null);
  }
  function changeTab(value:string){setTab(value);setSalesType('sale');setPage(0);setPaymentHistoryBatch('');}
  function apply(next:Filters){
    const length=(Date.parse(next.dateTo)-Date.parse(next.dateFrom))/86400000;
    if(!validFinanceDate(next.dateFrom)||!validFinanceDate(next.dateTo)||length<0||length>365){setFilterError(t('请选择有效日期，范围为1至366天。','Scegli un intervallo valido da 1 a 366 giorni.'));return;}
    setFilters(next);setDraft(next);setPage(0);setFilterError('');setPaymentHistoryBatch('');
  }
  function saved(){setEditor(null);setRevision(n=>n+1);setNotice(t('已保存。正在刷新统计；如刷新失败，请仅重试读取。','Salvato. Aggiornamento in corso; in caso di errore riprova solo la lettura.'));}
  const tabs=[['overview',t('经营总览','Panoramica')],['sales',t('销售与成本','Vendite e costi')],['receivables',t('客户应收','Crediti clienti')],['payables',t('供应商应付','Debiti fornitori')],['payments',t('付款记录','Pagamenti')],['expenses',t('费用账本','Spese')],['export',t('导出 / 核对','Esporta / verifica')]];
  const labels={trend:t('销售与毛利趋势','Andamento vendite e margine'),sales:t('销售净额','Vendite nette'),gross:t('毛利','Margine lordo'),composition:t('利润构成 · EUR','Composizione risultato · EUR'),expenses:t('经营费用','Spese operative'),operating:t('经营利润','Risultato operativo'),categories:t('费用分类','Spese per categoria'),empty:t('所选期间暂无费用','Nessuna spesa nel periodo')};
  return <section className="min-w-0 space-y-4 pb-6" aria-label={t('财务管理','Gestione finanziaria')}>
    <header className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/20 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-blue-600"><BarChart3 className="size-4"/>PARTSPRO / {t('经营财务','FINANZA')}</div><h1 className="text-2xl font-bold tracking-tight text-slate-950">{t('财务管理','Gestione finanziaria')}</h1><p className="mt-1.5 text-sm text-slate-500">{t('看清经营表现，掌握每一笔收支。','Controlla risultati, crediti e spese della tua attività.')}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" aria-label={t('刷新数据','Aggiorna dati')} onClick={()=>{setNotice('');setRevision(n=>n+1);}}><RefreshCw className={cn('size-4',overview.loading&&'animate-spin')}/>{t('刷新','Aggiorna')}</Button>{manage&&<><Button variant="outline" size="sm" onClick={()=>setEditor({kind:'supplier-payment'})}><HandCoins className="size-4"/>{t('登记付款','Registra pagamento')}</Button><Button size="sm" onClick={()=>setEditor({kind:'expense'})}><Plus className="size-4"/>{t('新增费用','Nuova spesa')}</Button></>}</div></div>
      <form className="mt-4 border-t border-slate-100 pt-3" onSubmit={event=>{event.preventDefault();apply(draft);}}>
        <div className="flex flex-wrap items-center gap-2"><div className="mr-auto flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">{[7,30,0].map(days=>{const to=financeDay();const from=days?shiftFinanceDay(to,-days+1):to.slice(0,7)+'-01';const selected=filters.dateFrom===from&&filters.dateTo===to;return <button key={days} type="button" aria-pressed={selected} onClick={()=>apply({...draft,dateFrom:from,dateTo:to})} className={cn('rounded-md px-3 py-1.5 text-xs font-semibold',selected?'bg-white text-blue-700 shadow-sm':'text-slate-500 hover:text-slate-900')}>{days?t(`近${days}天`,`${days} giorni`):t('本月','Questo mese')}</button>;})}</div><button type="button" aria-expanded={filtersOpen} aria-controls="finance-filter-panel" onClick={()=>setFiltersOpen(v=>!v)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"><SlidersHorizontal className="size-3.5"/>{v("筛选与日期","Filtri e date","Filters and dates")}</button></div><div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400"><span>{filters.dateFrom} — {filters.dateTo}</span><span>EUR · Europe/Rome</span></div><div id="finance-filter-panel" hidden={!filtersOpen}>
        <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-[1fr_1fr_1fr_1.3fr_auto]">
          <div><Label htmlFor="finance-date-from" className="mb-1 block text-xs text-slate-500">{t('开始日期','Dal')}</Label><Input id="finance-date-from" type="date" value={draft.dateFrom} onChange={e=>setDraft({...draft,dateFrom:e.target.value})}/></div>
          <div><Label htmlFor="finance-date-to" className="mb-1 block text-xs text-slate-500">{t('结束日期','Al')}</Label><Input id="finance-date-to" type="date" value={draft.dateTo} onChange={e=>setDraft({...draft,dateTo:e.target.value})}/></div>
          <div><Label htmlFor="finance-date-mode" className="mb-1 block text-xs text-slate-500">{t('日期口径','Criterio data')}</Label><Select value={draft.dateMode} onValueChange={v=>setDraft({...draft,dateMode:v})}><SelectTrigger id="finance-date-mode" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[['created',t('创建日期','Creazione')],['paid',t('付款日期','Pagamento')],['received',t('到货日期','Ricezione')],['invoice',t('发票日期','Fattura')],['recognized',t('确认日期','Riconoscimento')],['occurred',t('发生日期','Competenza')]].map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="finance-search" className="mb-1 block text-xs text-slate-500">{t('搜索明细','Cerca movimenti')}</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400"/><Input id="finance-search" className="pl-9" placeholder={t('订单、SKU、批次…','Ordine, SKU, lotto…')} value={draft.q} maxLength={160} onChange={e=>setDraft({...draft,q:e.target.value})}/></div></div>
          <Button type="submit" variant="outline" className="col-span-2 self-end xl:col-span-1">{t('应用筛选','Applica filtri')}</Button>
        </div>
        <details className="mt-3"><summary className="w-fit cursor-pointer text-xs font-medium text-slate-500">{t('更多筛选','Altri filtri')}</summary><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><Label htmlFor="finance-supplier">{t('供应商','Fornitore')}</Label><Input id="finance-supplier" value={draft.supplier} maxLength={160} onChange={e=>setDraft({...draft,supplier:e.target.value})}/></div><div><Label htmlFor="finance-confidence">{t('成本可信度','Attendibilità costi')}</Label><Select value={draft.confidence} onValueChange={v=>setDraft({...draft,confidence:v})}><SelectTrigger id="finance-confidence" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{['all','exact','estimated','unmatched'].map(v=><SelectItem key={v} value={v}>{confidenceLabel(v,it,locale)}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="finance-category">{t('账目分类','Categoria')}</Label><Select value={draft.category} onValueChange={v=>setDraft({...draft,category:v})}><SelectTrigger id="finance-category" className="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{t('全部','Tutte')}</SelectItem>{['sales','receivable','purchase','cogs','supplier_payment',...categories].map(v=><SelectItem key={v} value={v}>{categories.includes(v)?expenseLabel(v,locale):typeLabel(v,it,locale)}</SelectItem>)}</SelectContent></Select></div></div></details>
        </div>{filterError&&<p role="alert" className="mt-2 text-sm text-red-600">{filterError}</p>}
      </form>
    </header>
    {(filters.confidence!=='all'||filters.category!=='all'||!!filters.q||!!filters.supplier||!!filters.supplierKey)&&<p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{t('当前搜索、供应商、分类或可信度筛选作用于单条账目，汇总仅代表匹配账目，不代表完整订单利润；查看整体经营表现请清除此筛选。','I filtri ricerca, fornitore, categoria e attendibilità selezionano singoli movimenti: il risultato filtrato non rappresenta il margine completo degli ordini. Rimuovili per il totale operativo.')}<button type="button" onClick={()=>apply({...filters,q:'',supplier:'',supplierKey:undefined,confidence:'all',category:'all'})} className="ml-2 font-semibold underline">{v('清除条件','Rimuovi filtri','Clear filters')}</button></p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {overview.error&&<ErrorPanel message={overview.error} retry={()=>setRevision(n=>n+1)} it={it}/>}
    <Tabs value={tab} onValueChange={changeTab} className="min-w-0"><div className="min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"><TabsList className="h-auto w-max min-w-full justify-start gap-1 bg-transparent">{tabs.map(([value,label])=><TabsTrigger key={value} value={value} className="flex-none whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-semibold data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none sm:text-sm">{label}</TabsTrigger>)}</TabsList></div>
      <TabsContent value="overview" className="mt-4 min-w-0 space-y-4">
        {overview.loading?<Loading it={it}/>:summary&&analysis?<>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{filters.dateFrom} — {filters.dateTo} · {t('经营期间','Periodo operativo')}</span><span>{t('环比','Confronto')}: {analysis.previousRange.dateFrom} — {analysis.previousRange.dateTo}</span></div>
          <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-5">{[
            {label:labels.sales,value:summary.salesNet,key:'salesNet' as const,kind:'sale' as const},
            {label:'COGS',value:summary.cogsNet,key:'cogsNet' as const,kind:'cogs' as const},
            {label:labels.gross,value:summary.grossProfit,key:'grossProfit' as const,kind:'gross' as const},
            {label:labels.expenses,value:summary.expenseNet,key:'expenseNet' as const,kind:'expense' as const},
            {label:labels.operating,value:summary.operatingProfit,key:'operatingProfit' as const,kind:'operating' as const}
          ].map((metric,index)=><button type="button" key={metric.key} onClick={()=>openDrill({kind:metric.kind,title:metric.label})} className={cn('min-w-0 rounded-2xl border p-4 text-left shadow-sm shadow-slate-200/20 transition hover:-translate-y-0.5 motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',index===0?'border-blue-600 bg-blue-600 text-white':'border-slate-200/80 bg-white hover:border-blue-300',index===4&&'col-span-2 xl:col-span-1')}>
            <div className={cn('flex items-center justify-between gap-1 text-[11px] font-medium',index===0?'text-blue-100':'text-slate-500')}>{metric.label}<ArrowUpRight className="size-3 shrink-0"/></div>
            <div className={cn('mt-3 break-all text-[23px] font-bold tracking-tight tabular-nums',index===0?'text-white':metric.value<0?'text-rose-600':index===2||index===4?'text-emerald-700':'text-slate-950')}>{money(metric.value)}</div>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-1"><div className={cn('text-[10px]',index===0?'text-blue-100':'text-slate-400')}>{metric.key==='grossProfit'?`${summary.salesNet>0?summary.grossMarginRate.toFixed(1)+'%':'—'} ${t('毛利率','margine')}`:analysis.changes[metric.key]===null?t('无可比基期','Base non confrontabile'):`${analysis.changes[metric.key]!>0?'+':''}${analysis.changes[metric.key]}% ${t('较上期','vs precedente')}`}</div><FinanceSparkline values={analysis.trend.map(p=>p[metric.key])} color={index===0?'#bfdbfe':index===2||index===4?'#14987e':'#9cafd0'}/></div>
          </button>)}</div>
          <FinanceCharts analysis={analysis} locale={locale} onDrill={openDrill}/>
          <div className="grid min-w-0 gap-3 sm:grid-cols-3">{[{title:t('客户待收款','Crediti da incassare'),value:summary.pendingReceivables,icon:ArrowDownLeft,color:'text-amber-700',target:'receivables',hint:t('期间内订单 · 含税及运费余额','Ordini nel periodo · IVA e spedizione incluse')},{title:t('供应商应付','Debiti fornitori'),value:summary.accountsPayable,icon:ArrowUpRight,color:'text-rose-700',target:'payables',hint:t('期间内批次 · 扣除历史已付款','Lotti nel periodo · al netto di tutti i pagamenti')},{title:t('库存成本价值','Valore scorte al costo'),value:summary.inventoryCostValue,icon:Wallet,color:'text-slate-950',target:'sales',hint:t('当前剩余成本层 · 不随日期筛选','Scorte attuali · indipendenti dalle date')}].map(item=><button disabled={item.icon===Wallet} key={item.target+item.title} onClick={()=>openDrill({kind:item.target==='receivables'?'receivable':'payable',title:item.title})} className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-blue-300"><div className="flex items-center justify-between text-xs text-slate-500">{item.title}<item.icon className="size-4"/></div><div className={cn('mt-2 text-2xl font-bold tabular-nums',item.color)}>{money(item.value)}</div><p className="mt-2 text-[11px] leading-5 text-slate-500">{item.hint}</p></button>)}</div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="size-4 text-blue-600"/>{t('成本与数据核对','Verifica costi e dati')}</div><p className="mt-1 text-[10px] text-slate-400">{v('按成本记录数量统计，不代表金额占比','Quote per numero di registrazioni, non per importo','Shares are based on record counts, not amounts')}</p><div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">{Object.entries(summary.confidence).map(([key,value])=><i key={key} className={key==='exact'?'bg-emerald-500':key==='estimated'?'bg-amber-400':'bg-rose-400'} style={{width:`${value/Math.max(1,Object.values(summary.confidence).reduce((n,p)=>n+p,0))*100}%`}}/>)}</div><div className="mt-3 flex flex-wrap gap-2">{Object.entries(summary.confidence).map(([key,value])=><button key={key} aria-label={`${confidenceLabel(key,it,locale)} ${value} ${v('条记录','registrazioni','records')} ${Math.round(value/Math.max(1,Object.values(summary.confidence).reduce((n,p)=>n+p,0))*100)}%`} onClick={()=>openDrill({kind:'cogs',title:confidenceLabel(key,it,locale),confidence:key})} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><Confidence value={key} it={it}/> <strong className="ml-2 tabular-nums">{value}</strong><span className="ml-1 text-slate-400">{Math.round(value/Math.max(1,Object.values(summary.confidence).reduce((n,p)=>n+p,0))*100)}%</span></button>)}</div>{summary.vatAmbiguousPurchaseNet>0&&<p className="mt-3 text-xs text-amber-700">{t('采购税额待核对','IVA acquisti da verificare')}: {money(summary.vatAmbiguousPurchaseNet)}</p>}<p className="mt-3 text-xs leading-5 text-slate-500">{t('销售按已付款订单确认，费用含待付项目；成本仅计已消耗分配。售后退款尚未独立汇总，请结合售后记录核对利润。','Vendite riconosciute su ordini pagati; spese anche da pagare; COGS solo per allocazioni consumate. I rimborsi post-vendita non sono riepilogati separatamente: verifica anche le pratiche RMA.')}</p></div>
        </>:null}
      </TabsContent>
      {['sales','receivables','expenses','payments'].map(name=><TabsContent key={name} value={name} className="mt-4 min-w-0 space-y-3">{name==='payments'&&paymentHistoryBatch&&<p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{t('全历史付款 · 不限当前日期筛选','Pagamenti storici · tutte le date')}: {paymentHistoryBatch} <button className="ml-3 underline" onClick={()=>{setPaymentHistoryBatch('');setPage(0);}}>{t('返回期间记录','Torna al periodo')}</button></p>}{name==='sales'&&<div className="flex flex-wrap gap-2">{[['sale',t('销售明细','Vendite')],['cogs',t('已确认成本','COGS riconosciuti')],['allocations',t('成本追溯','Tracciabilità costi')]].map(([value,label])=><Button key={value} size="sm" variant={salesType===value?'default':'outline'} onClick={()=>{setSalesType(value);setPage(0);}}>{label}</Button>)}</div>}
        <p className="text-xs leading-5 text-slate-500">{name==='receivables'?t('所选期间订单的当前待收余额，包含税费与运费；收款请进入对应订单。','Saldo attuale degli ordini nel periodo, IVA e spedizione incluse. Registra gli incassi nell’ordine.'):name==='expenses'?t('待付与已付费用计入经营费用；取消项目保留记录，不计利润。','Spese da pagare e pagate incluse nel risultato; quelle annullate restano nello storico.'):t('所选日期口径适用于有对应日期的账目，其余沿用创建或发生日期；成本使用确认日期。','Il criterio usa la data disponibile; gli altri movimenti usano creazione o competenza. I costi usano il riconoscimento.')}</p>
        {name==='sales'&&salesType==='allocations'?<>{cogs.error?<ErrorPanel message={cogs.error} retry={()=>setRevision(n=>n+1)} it={it}/>:<CostTable rows={cogs.data?.data??[]} loading={cogs.loading} it={it} money={money}/>}<Pager page={page} total={cogs.data?.meta.total??0} loading={cogs.loading} onChange={setPage} it={it}/></>:<>{ledger.error?<ErrorPanel message={ledger.error} retry={()=>setRevision(n=>n+1)} it={it}/>:<LedgerTable rows={ledger.data?.data??[]} loading={ledger.loading} it={it} money={money} onEdit={manage?setEditor:undefined}/>}<Pager page={page} total={ledger.data?.meta.total??0} loading={ledger.loading} onChange={setPage} it={it}/></>}
      </TabsContent>)}
      <TabsContent value="payables" className="mt-4 min-w-0 space-y-3"><p className="text-xs leading-5 text-slate-500">{t('应付为所选期间批次采购额减去关联批次全部历史已付款。超付不产生负应付；未关联批次付款不自动抵扣。','Debiti dei lotti nel periodo meno tutti i pagamenti collegati. Eccedenze e pagamenti senza lotto non riducono altri debiti.')}</p>{overview.loading?<Loading it={it}/>:analysis?<PayablesList rows={analysis.payables} it={it} money={money} onHistory={code=>{changeTab('payments');setPaymentHistoryBatch(code);}}/>:null}<Pager page={page} total={analysis?.payablesTotal??0} loading={overview.loading} onChange={setPage} it={it}/></TabsContent>
      <TabsContent value="export" className="mt-4"><div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8"><Download className="mb-4 size-8 text-blue-600"/><h2 className="text-lg font-bold">{t('导出与核对','Esportazione e verifica')}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t('按当前筛选导出完整账本及汇总，包含日期口径与成本可信度。导出不受当前明细页码限制。','Esporta tutti i movimenti filtrati e il riepilogo, con criterio data e attendibilità dei costi. La pagina corrente non limita l’esportazione.')}</p><p className="my-4 text-xs text-slate-500">{filters.dateFrom} — {filters.dateTo} · EUR · Europe/Rome</p>{canExport?<div className="flex gap-2">{['csv','xlsx'].map(format=><Button asChild key={format} variant={format==='xlsx'?'default':'outline'}><a href={`/api/admin/finance/export?${base}&format=${format}`}><Download className="size-4"/>{format.toUpperCase()}</a></Button>)}</div>:<p className="text-sm text-amber-700">{t('此账号没有财务导出权限。','Questo account non dispone del permesso di esportazione.')}</p>}</div></TabsContent>
    </Tabs>
    <Sheet open={!!drill} onOpenChange={open=>{if(!open)setDrill(null);}}><SheetContent onCloseAutoFocus={event=>{if(drillTrigger.current?.isConnected){event.preventDefault();drillTrigger.current.focus();}}} className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-3xl" showCloseButton>
      <SheetHeader className="border-b border-slate-100 p-5 pr-14"><p className="mb-2 text-[10px] font-semibold tracking-wider text-blue-600">PARTSPRO / {v('经营明细','DETTAGLI','ENTRY DETAILS')}</p><SheetTitle className="text-xl font-bold">{drill?.title}</SheetTitle><SheetDescription className="mt-1 text-xs">{drillFilters.dateFrom} — {drillFilters.dateTo} · EUR · Europe/Rome</SheetDescription></SheetHeader>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-4 sm:p-5">
        {(drill?.kind==='gross'||drill?.kind==='operating')&&<><div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{[{label:labels.sales,value:drillTotal('salesNet')},{label:'COGS',value:drillTotal('cogsNet')},...(drill.kind==='operating'?[{label:labels.expenses,value:drillTotal('expenseNet')}]:[])].map(p=><div key={p.label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] text-slate-400">{p.label}</p><p className="mt-1 font-bold tabular-nums">{money(p.value)}</p></div>)}</div><p className="mb-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">{drill.kind==='gross'?v('毛利 = 销售净额 − 已确认成本','Margine = vendite nette − COGS','Gross profit = net sales − recognized COGS'):v('经营利润 = 销售净额 − 已确认成本 − 经营费用','Risultato = vendite nette − COGS − spese','Operating profit = net sales − COGS − expenses')} <strong className="ml-2">{money(drillTotal(drill.kind==='gross'?'grossProfit':'operatingProfit'))}</strong></p><div className="mb-3 flex flex-wrap gap-2">{[['sale',labels.sales],['cogs','COGS'],...(drill.kind==='operating'?[['expense',labels.expenses]]:[])].map(([key,label])=><Button key={key} variant={drillPart===key?'default':'outline'} size="sm" aria-pressed={drillPart===key} onClick={()=>{setDrillPart(key);setDrillPage(0);}}>{label}</Button>)}</div></>}
        <p className="mb-3 text-[11px] leading-5 text-slate-500">{drill?.kind==='payable'?t('应付为所选期间批次采购额减去关联批次全部历史已付款。超付不产生负应付；未关联批次付款不自动抵扣。','Debiti dei lotti nel periodo meno tutti i pagamenti collegati. Eccedenze e pagamenti senza lotto non riducono altri debiti.'):drill?.kind==='receivable'?t('所选期间订单的当前待收余额，包含税费与运费；收款请进入对应订单。','Saldo attuale degli ordini nel periodo, IVA e spedizione incluse. Registra gli incassi nell’ordine.'):v('明细沿用当前筛选，关闭后返回原总览。','I dettagli mantengono i filtri; chiudi per tornare alla panoramica.','Entries use the current filters. Close to return to the overview.')}</p>
        {drill?.kind==='payable'?<>{drillPayables.error?<ErrorPanel message={drillPayables.error} retry={()=>setRevision(n=>n+1)} it={it}/>:drillPayables.loading?<Loading it={it}/>:drillPayables.data?<><div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm"><span className="text-slate-500">{v('待付净额','Residuo netto','Outstanding net')}</span><strong className="text-lg text-rose-700">{money(drillPayables.data.data.summary.accountsPayable)}</strong></div><PayablesList rows={drillPayables.data.data.payables} it={it} money={money} onHistory={code=>{setDrill(null);changeTab('payments');setPaymentHistoryBatch(code);}}/></>:null}<Pager page={drillPage} total={drillPayables.data?.data.payablesTotal??0} loading={drillPayables.loading} onChange={setDrillPage} it={it}/></>:<>{drillLedger.error?<ErrorPanel message={drillLedger.error} retry={()=>setRevision(n=>n+1)} it={it}/>:<LedgerTable rows={drillLedger.data?.data??[]} loading={drillLedger.loading} it={it} money={money}/>}<div className="mt-3"><Pager page={drillPage} total={drillLedger.data?.meta.total??0} loading={drillLedger.loading} onChange={setDrillPage} it={it}/></div></>}
      </div><SheetFooter className="border-t border-slate-100 bg-white p-4"><Button onClick={openFullLedger}>{v('进入完整账本','Apri registro completo','Open full ledger')}<ArrowUpRight className="size-4"/></Button></SheetFooter>
    </SheetContent></Sheet>
    {editor&&<FinanceEntryDialog key={`${editor.kind}:${editor.row?.id??'new'}`} type={editor.kind==='expense'?'expense':'supplier_payment'} row={editor.row} copy={financeCopy(locale)} onClose={()=>setEditor(null)} onSaved={saved}/>}
  </section>;
}

function confidenceLabel(value:string,it:boolean,locale:string){return translateFinanceStatic(({all:['全部','Tutte'],exact:['精确','Esatto'],estimated:['估算','Stimato'],unmatched:['未匹配','Non abbinato']} as Record<string,string[]>)[value]?.[it?1:0]??value,locale);}
function typeLabel(value:string,it:boolean,locale:string){return translateFinanceStatic(({sale:['销售','Vendita'],sales:['销售','Vendite'],receivable:['应收','Credito'],purchase:['采购','Acquisto'],cogs:['销售成本','COGS'],expense:['费用','Spesa'],supplier_payment:['供应商付款','Pagamento fornitore']} as Record<string,string[]>)[value]?.[it?1:0]??value,locale);}
function Confidence({value,it}:{value:string;it:boolean}){const {locale}=useI18n();return <span className={cn('text-xs font-medium',value==='exact'?'text-emerald-700':value==='estimated'?'text-amber-700':'text-rose-700')}>{confidenceLabel(value,it,locale)}</span>;}
function Loading({it}:{it:boolean}){const {locale:providerLocale}=useI18n();const locale=it?providerLocale:"zh-CN";return <div role="status" aria-busy="true" className="animate-pulse rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">{financeText('正在加载财务数据…','Caricamento…',locale)}</div>;}
function ErrorPanel({message,retry,it}:{message:string;retry:()=>void;it:boolean}){const {locale:providerLocale}=useI18n();const locale=it?providerLocale:"zh-CN";return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{message}</p><Button variant="outline" size="sm" onClick={retry} className="mt-2">{financeText('重试读取','Riprova lettura',locale)}</Button></div>;}
function Pager({page,total,loading,onChange,it}:{page:number;total:number;loading:boolean;onChange:(page:number)=>void;it:boolean}){const {locale:providerLocale}=useI18n();const locale=it?providerLocale:"zh-CN";return <div className="flex items-center justify-between gap-2 text-xs text-slate-500"><span>{total?`${page*pageSize+1}–${Math.min((page+1)*pageSize,total)} / ${total}`:financeText('0 条记录','0 movimenti',locale)}</span><div className="flex gap-2"><Button aria-label={financeText('上一页','Pagina precedente',locale)} size="sm" variant="outline" disabled={loading||page===0} onClick={()=>onChange(page-1)}><ChevronLeft className="size-4"/></Button><Button aria-label={financeText('下一页','Pagina successiva',locale)} size="sm" variant="outline" disabled={loading||(page+1)*pageSize>=total} onClick={()=>onChange(page+1)}><ChevronRight className="size-4"/></Button></div></div>;}
function PayablesList({rows,it,money,onHistory}:{rows:Analysis['payables'];it:boolean;money:(n:number)=>string;onHistory:(code:string)=>void}) {const {locale}=useI18n();
  const headings=it?['Costo acquisto','Pagato storico','Residuo netto']:['采购净成本','历史已付','待付净额'];
  return <><div className="space-y-3 sm:hidden">{rows.length?rows.map(row=><article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><div><button type="button" onClick={()=>onHistory(row.batchCode??'')} className="text-sm font-semibold text-blue-700 underline underline-offset-4">{row.batchCode}</button><p className="mt-1 text-xs text-slate-500">{row.supplierName}</p></div><ArrowUpRight className="size-4 text-slate-400"/></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">{[row.amountNet,row.paidNet,row.outstandingNet].map((value,index)=><div key={index}><p className="text-[10px] text-slate-500">{translateFinanceStatic(headings[index],locale)}</p><p className={cn('mt-1 text-sm font-semibold tabular-nums',index===2?'text-rose-700':'text-slate-900')}>{money(value)}</p></div>)}</div></article>):<p className="rounded-xl border bg-white p-6 text-sm text-slate-500">{financeText('暂无记录','Nessun movimento',locale)}</p>}</div>
  <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white sm:block"><Table><TableHeader><TableRow><TableHead>{financeText('批次 / 供应商','Lotto / fornitore',locale)}</TableHead>{headings.map(label=><TableHead key={label}>{translateFinanceStatic(label,locale)}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length?rows.map(row=><TableRow key={row.id}><TableCell><button type="button" onClick={()=>onHistory(row.batchCode??'')} className="font-semibold text-blue-700 underline underline-offset-4">{row.batchCode}</button><p className="text-xs text-slate-500">{row.supplierName}</p></TableCell><TableCell className="tabular-nums">{money(row.amountNet)}</TableCell><TableCell className="tabular-nums">{money(row.paidNet)}</TableCell><TableCell className="font-bold tabular-nums text-rose-700">{money(row.outstandingNet)}</TableCell></TableRow>):<TableRow><TableCell colSpan={4} className="h-28 text-center text-slate-500">{financeText('暂无记录','Nessun movimento',locale)}</TableCell></TableRow>}</TableBody></Table></div></>;
}

function LedgerTable({rows,loading,it,money,onEdit}:{rows:AdminFinanceLedgerRow[];loading:boolean;it:boolean;money:(n:number)=>string;onEdit?: (editor:Editor)=>void}){const {locale}=useI18n();
  if(loading)return <Loading it={it}/>;
  return <><div className="space-y-3 sm:hidden">{rows.length?rows.map(row=><article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-slate-500">{typeLabel(row.type,it,locale)} · {financeDay(row.date)}</p><h3 className="mt-2 text-sm font-semibold">{row.type==='expense'?row.title:typeLabel(row.type,it,locale)}</h3></div><strong className="shrink-0 text-base tabular-nums">{money(row.amountNet)}</strong></div><p className="mt-2 text-xs text-slate-500">{[row.supplierName,row.batchCode,row.skuCode].filter(Boolean).join(' · ')}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><div className="text-xs text-slate-500">{row.orderNo??(row.status==='paid'?(financeText('已付','Pagato',locale)):row.status==='pending'?(financeText('待付','Da pagare',locale)):row.status==='cancelled'?(financeText('已取消','Annullato',locale)):row.status)} {row.confidence&&<Confidence value={row.confidence} it={it}/>}</div>{onEdit&&['expense','supplier_payment'].includes(row.type)?<Button size="sm" variant="outline" onClick={()=>onEdit({kind:row.type==='expense'?'expense':'supplier-payment',row})}>{financeText('修改','Modifica',locale)}</Button>:row.orderId?<Button size="sm" variant="outline" asChild><Link href={`/admin?panel=orders&orderId=${encodeURIComponent(row.orderId)}`}>{financeText('查看订单','Apri ordine',locale)}</Link></Button>:null}</div></article>):<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{financeText('当前筛选暂无记录。','Nessun movimento per questi filtri.',locale)}</div>}</div><div className="hidden min-w-0 overflow-x-auto sm:block rounded-2xl border border-slate-200 bg-white"><Table><TableHeader><TableRow>{(it?['Data','Tipo / stato','Descrizione','Riferimento','Importo · EUR','Costi','Azioni']:['日期','类型 / 状态','说明','关联单据','金额 · EUR','成本可信度','操作']).map(label=><TableHead key={label}>{translateFinanceStatic(label,locale)}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length?rows.map(row=><TableRow key={row.id}><TableCell className="whitespace-nowrap text-xs tabular-nums">{financeDay(row.date)}</TableCell><TableCell className="whitespace-nowrap"><Badge variant="outline">{typeLabel(row.type,it,locale)}</Badge><p className="mt-1 text-xs text-slate-500">{row.status==='paid'?(financeText('已付','Pagato',locale)):row.status==='pending'?(financeText('待付','Da pagare',locale)):row.status==='cancelled'?(financeText('已取消','Annullato',locale)):row.status}</p></TableCell><TableCell className="min-w-44"><span className="font-medium">{['expense'].includes(row.type)?row.title:typeLabel(row.type,it,locale)}</span><p className="text-xs text-slate-500">{row.supplierName}</p></TableCell><TableCell className="text-xs">{row.orderId?<Link href={`/admin?panel=orders&orderId=${encodeURIComponent(row.orderId)}`} className="whitespace-nowrap text-blue-700 underline underline-offset-4">{row.orderNo}</Link>:row.batchCode??'—'}{row.skuCode&&<p className="mt-1 font-mono">{row.skuCode}</p>}</TableCell><TableCell className="whitespace-nowrap text-right font-semibold tabular-nums">{money(row.amountNet)}</TableCell><TableCell>{row.confidence?<Confidence value={row.confidence} it={it}/>: '—'}</TableCell><TableCell>{onEdit&&['expense','supplier_payment'].includes(row.type)?<Button size="sm" variant="outline" onClick={()=>onEdit({kind:row.type==='expense'?'expense':'supplier-payment',row})}>{financeText('修改','Modifica',locale)}</Button>:row.orderId?<Button size="sm" variant="ghost" asChild><Link href={`/admin?panel=orders&orderId=${encodeURIComponent(row.orderId)}`}>{financeText('查看订单','Apri ordine',locale)}</Link></Button>:'—'}</TableCell></TableRow>):<TableRow><TableCell colSpan={7} className="h-32 text-center text-slate-500">{financeText('当前筛选暂无记录。','Nessun movimento per questi filtri.',locale)}</TableCell></TableRow>}</TableBody></Table></div></>;
}
function CostTable({rows,loading,it,money}:{rows:AdminFinanceCostAllocation[];loading:boolean;it:boolean;money:(n:number)=>string}){const {locale}=useI18n();if(loading)return <Loading it={it}/>;return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><Table><TableHeader><TableRow>{(it?['Ordine / SKU','Lotto','Quantità','Costo unitario','Costo totale','Stato','Attendibilità']:['订单 / SKU','批次','数量','单位成本','总成本','分配状态','可信度']).map(label=><TableHead key={label}>{translateFinanceStatic(label,locale)}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.length?rows.map(row=><TableRow key={row.id}><TableCell className="min-w-44"><p className="text-xs">{row.orderNo}</p><p className="font-mono text-xs">{row.skuCode}</p><p className="text-xs text-slate-500">{row.productName}</p></TableCell><TableCell>{row.batchCode??'—'}</TableCell><TableCell>{row.quantity}</TableCell><TableCell>{money(row.unitCostNet)}</TableCell><TableCell className="font-semibold">{money(row.totalCostNet)}</TableCell><TableCell>{row.status}</TableCell><TableCell><Confidence value={row.confidence} it={it}/></TableCell></TableRow>):<TableRow><TableCell colSpan={7} className="h-28 text-center text-slate-500">{financeText('暂无成本分配','Nessuna allocazione',locale)}</TableCell></TableRow>}</TableBody></Table></div>;}

type ApiListResponse<T> = {
  data: T[];
  meta?: {
    total?: number;
    returned?: number;
    limit?: number;
    offset?: number;
    summary?: AdminFinanceSummary;
  };
};

type ApiItemResponse<T> = {
  data: T;
};

const expenseCategories = [
  "rent",
  "salary",
  "shipping",
  "platform_fee",
  "utilities",
  "tax",
  "supplier_fee",
  "bank_fee",
  "other",
] as const;

type EditableFinanceEntry = {
  id: string; currency: string; amountNet: number; vatAmount: number; amountGross: number; status: "pending" | "paid" | "cancelled";
  category?: string; description?: string; occurredAt?: string; paidAt?: string | null; notes?: string | null; note?: string | null;
  batchId?: string | null; batchCode?: string | null; supplierName?: string | null; version: string;
};

type FinanceBatchOption = {
  id: string; batchCode: string; supplierName: string | null; currency: string; paidNet: number | null;
  outstandingNet: number | null; latestPaidAt: string | null; costBasis: "confirmed_net" | "estimated" | "unknown";
};

type FinanceEntryForm = {
  amountNet: string; vatAmount: string; category: string; description: string; occurredAt: string;
  paidAt: string; note: string; batchId: string; status: "pending" | "paid" | "cancelled"; correctionReason: string;
};

function emptyEntryForm(now = new Date()): FinanceEntryForm {
  return { amountNet: "", vatAmount: "0", category: "other", description: "", occurredAt: todayDate(),
    paidAt: localFinanceDateTime(now), note: "", batchId: "", status: "paid", correctionReason: "" };
}

function FinanceEntryDialog({ type, copy, onSaved, row, onClose }: {
  type: "expense" | "supplier_payment"; copy: FinanceCopy; onSaved: () => void; row?: AdminFinanceLedgerRow; onClose: () => void;
}) {
  const { locale } = useI18n();
  const id = React.useId();
  const [open, setOpen] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [uncertain, setUncertain] = React.useState(false);
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = React.useState(0);
  const [initialPaidAt, setInitialPaidAt] = React.useState(() => new Date());
  const [form, setForm] = React.useState<FinanceEntryForm>(() => emptyEntryForm(initialPaidAt));
  const [loadedForm, setLoadedForm] = React.useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== loadedForm;
  const [original, setOriginal] = React.useState<EditableFinanceEntry | null>(null);
  const [entryLoading, setEntryLoading] = React.useState(false);
  const [detailReload, setDetailReload] = React.useState(0);
  const [batchSearch, setBatchSearch] = React.useState({ q: "", supplier: "", page: 0 });
  const [batchData, setBatchData] = React.useState<ApiListResponse<FinanceBatchOption> | null>(null);
  const [batchLoading, setBatchLoading] = React.useState(false);
  const [batchError, setBatchError] = React.useState("");
  const [selectedBatch, setSelectedBatch] = React.useState<FinanceBatchOption | null>(null);
  const isExpense = type === "expense";
  const editing = Boolean(row);
  const currency = original?.currency ?? "EUR";
  const recordId = row ? financeEditableId(type, row.id) : null;
  const net = parseLegacyFinanceMoney(form.amountNet);
  const vat = parseLegacyFinanceMoney(form.vatAmount);
  const previewGross = net.ok && vat.ok ? financeGross(net.value, vat.value) : null;
  const title = editing ? copy.edit : isExpense ? copy.addExpense : copy.addPayment;
  const updateField = <K extends keyof FinanceEntryForm>(key: K, value: FinanceEntryForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "", ...((key === "amountNet" || key === "vatAmount") ? { amountGross: "" } : {}), ...(key === "note" ? { notes: "" } : {}) }));
  };
  const fieldProps = (key: string) => {
    const keys = [key, ...(key === "amountNet" ? ["amountGross"] : key === "note" ? ["notes"] : [])].filter(field => Boolean(fieldErrors[field]));
    return { id: `${id}-${key}`, "aria-invalid": keys.length > 0, "aria-describedby": keys.length ? keys.map(field => `${id}-${field}-error`).join(" ") : undefined };
  };
  const visibleFields = ["amountNet", "vatAmount", "note", ...(isExpense ? ["category", "description", "occurredAt"] : ["paidAt", ...(!editing ? ["batchId"] : [])]), ...(editing ? ["status", "correctionReason"] : [])];
  const summaryMessages = Object.entries(fieldErrors).reduce<Record<string, string[]>>((messages, [key, message]) => {
    const target = key === "amountGross" ? "amountNet" : key === "notes" ? "note" : key;
    if (message && visibleFields.includes(target)) messages[target] = [...new Set([...(messages[target] ?? []), message])];
    return messages;
  }, {});
  const detailLoadError = React.useEffectEvent(() => copy.loadError);
  const fieldError = (key: string) => fieldErrors[key] ? <p id={`${id}-${key}-error`} className="text-xs text-red-700">{fieldErrors[key]}</p> : null;

  React.useEffect(() => {
    if (!open || !recordId) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setEntryLoading(true); setOriginal(null); setError(""); } });
    void (async () => {
      try {
        const payload = await fetchFinanceJson<ApiItemResponse<EditableFinanceEntry>>(`/api/admin/finance/entries/${type}/${recordId}`, detailLoadError(), controller.signal);
        if (!controller.signal.aborted) {
          const entry = payload.data;
          setOriginal(entry);
          const loaded: FinanceEntryForm = { amountNet: entry.amountNet.toFixed(2), vatAmount: entry.vatAmount.toFixed(2), category: entry.category ?? "other",
            description: entry.description ?? "", occurredAt: entry.occurredAt ?? todayDate(),
            paidAt: entry.paidAt ? localFinanceDateTime(new Date(entry.paidAt)) : "", note: entry.notes ?? entry.note ?? "",
            batchId: entry.batchId ?? "", status: entry.status, correctionReason: "" };
          setForm(loaded); setLoadedForm(JSON.stringify(loaded));
        }
      } catch (failure) { if (!controller.signal.aborted) setError(financeErrorMessage(failure, detailLoadError())); }
      finally { if (!controller.signal.aborted) setEntryLoading(false); }
    })();
    return () => controller.abort();
  }, [detailReload, open, recordId, type]);

  React.useEffect(() => {
    if (!open || isExpense || editing) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "20", offset: String(batchSearch.page * 20) });
    if (batchSearch.q.trim()) params.set("q", batchSearch.q.trim());
    if (batchSearch.supplier.trim()) params.set("supplier", batchSearch.supplier.trim());
    queueMicrotask(() => { if (!controller.signal.aborted) { setBatchLoading(true); setBatchError(""); } });
    const timer = window.setTimeout(() => {
      void fetchFinanceJson<ApiListResponse<FinanceBatchOption>>(`/api/admin/finance/supplier-batch-options?${params}`, copy.loadError, controller.signal)
        .then((payload) => { if (!controller.signal.aborted) setBatchData(payload); })
        .catch((failure) => { if (!controller.signal.aborted) setBatchError(financeErrorMessage(failure, copy.loadError)); })
        .finally(() => { if (!controller.signal.aborted) setBatchLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [batchSearch, copy.loadError, detailReload, editing, isExpense, open]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || uncertain) return;
    const issues: Record<string, string> = {};
    if (!net.ok) issues.amountNet = copy.invalidMoney;
    if (!vat.ok) issues.vatAmount = copy.invalidMoney;
    if (isExpense && !form.description.trim()) issues.description = copy.required;
    if (isExpense && !isFinanceDate(form.occurredAt)) issues.occurredAt = copy.invalidDate;
    if (!isExpense && !form.batchId && !editing) issues.batchId = copy.required;
    if (!isExpense && form.status === "paid" && !form.paidAt) issues.paidAt = copy.required;
    const paidAt = form.paidAt ? financeLocalDateTimeToIso(form.paidAt) : null;
    if (!isExpense && form.paidAt && !paidAt) issues.paidAt = copy.invalidDate;
    if (editing && !form.correctionReason.trim()) issues.correctionReason = copy.required;
    if (editing && !original) issues.correctionReason = copy.loadError;
    if (Object.keys(issues).length || !net.ok || !vat.ok) { setFieldErrors(issues); setValidationAttempt(attempt => attempt + 1); return; }
    const body = isExpense ? {
      amountNet: net.value, vatAmount: vat.value, category: form.category, description: form.description.trim(),
      occurredAt: form.occurredAt, status: form.status, notes: form.note.trim() || null,
    } : {
      amountNet: net.value, vatAmount: vat.value, amountGross: financeGross(net.value, vat.value),
      ...(!editing ? { batchId: form.batchId } : {}), paidAt: original?.paidAt && form.paidAt === localFinanceDateTime(new Date(original.paidAt)) ? original.paidAt : !editing && form.paidAt === localFinanceDateTime(initialPaidAt) ? initialPaidAt.toISOString() : paidAt, note: form.note.trim() || null, status: form.status,
    };
    const editPayload = editing ? { correctionReason: form.correctionReason.trim(), expectedUpdatedAt: original?.version } : {};
    setError(""); setFieldErrors({}); setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/finance/${isExpense ? "expenses" : "supplier-payments"}${editing ? `/${recordId}` : ""}`, {
        body: JSON.stringify({ ...body, ...editPayload }), headers: { "Content-Type": "application/json" }, method: editing ? "PATCH" : "POST",
      });
      if (!response.ok) {
        const failure = await financeResponseError(response, copy.saveError);
        setFieldErrors(Object.fromEntries(Object.entries(failure.fields).map(([field, message]) => [field,
          ["amountNet", "vatAmount", "amountGross"].includes(field) ? copy.invalidMoney : message])));
        if (Object.keys(failure.fields).length) setValidationAttempt(attempt => attempt + 1);
        throw failure;
      }
      // A successful write is final. Report refresh failures in the panel; never replay it.
      setOpen(false); setOriginal(null); const nextPaidAt = new Date(); setInitialPaidAt(nextPaidAt); setForm(emptyEntryForm(nextPaidAt)); setLoadedForm(JSON.stringify(emptyEntryForm(nextPaidAt))); setSelectedBatch(null); onSaved();
    } catch (failure) {
      if (!(failure instanceof FinanceApiError)) setUncertain(true);
      setError(financeErrorMessage(failure, copy.saveError));
    } finally { setIsSaving(false); }
  }

  React.useEffect(() => { const protect = (event: BeforeUnloadEvent) => { if (open && (dirty || isSaving)) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect); }, [open, dirty, isSaving]);
  const close = (value: boolean) => {
    if (isSaving) return;
    if (!value && dirty) {
      if (!window.confirm((locale.startsWith("en") ? englishUiCopy("Scartare i dati contabili non salvati?") : locale.startsWith("zh") ? "放弃未保存记账内容？" : "Scartare i dati contabili non salvati?"))) return;
      const reset = emptyEntryForm(new Date()); setForm(reset); setLoadedForm(JSON.stringify(reset)); setUncertain(false); setError("");
    }
    setOpen(value); if (!value) onClose();
  };
  return <Dialog open={open} onOpenChange={close}>

    <DialogContent data-admin-dirty={open && dirty ? "true" : "false"} data-admin-mutating={isSaving ? "true" : "false"} scrollLayout="body" className="admin-ui-panel sm:max-w-xl">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{editing ? copy.correctionDescription : copy.dialogDescription}</DialogDescription></DialogHeader>
      <form onSubmit={submit} noValidate className="contents">
        <DialogBody className="space-y-4">
          {error && !uncertain ? <AdminNotice tone="error" message={error} action={editing && !original ? <Button variant="outline" type="button" onClick={() => setDetailReload((value) => value + 1)}>{copy.retry}</Button> : undefined} /> : null}
          {uncertain ? <AdminNotice tone="warning" title={(locale.startsWith("en") ? englishUiCopy("Esito da verificare") : locale.startsWith("it") ? "Esito da verificare" : "结果需要核对")} message={<>{copy.uncertain}{error && <p className="mt-1">{error}</p>}</>} action={<Button type="button" variant="outline" className="h-auto whitespace-normal" onClick={() => { setUncertain(false); setError(""); }}>{copy.allowRetryAfterReview}</Button>} /> : null}
          <AdminErrorSummary focusKey={validationAttempt} title={(locale.startsWith("en") ? englishUiCopy("Controlla i campi indicati") : locale.startsWith("it") ? "Controlla i campi indicati" : "请检查以下字段")} issues={Object.entries(summaryMessages).map(([key, messages]) => ({ id: `${id}-${key}`, message: messages.join(" · ") }))} />
          {entryLoading ? <p role="status">{copy.loading}</p> : null}
          {original ? <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
            <strong>{copy.original} · {original.id}</strong><p>{original.description ?? original.batchCode ?? copy.addPayment} · {original.occurredAt ?? original.paidAt ?? "--"} · {formatFinanceMoney(original.amountNet, locale, original.currency)} + IVA {formatFinanceMoney(original.vatAmount, locale, original.currency)} = {formatFinanceMoney(original.amountGross, locale, original.currency)} · {original.status}</p>
          </div> : null}
          <fieldset disabled={isSaving || entryLoading || (editing && !original) || uncertain} className="space-y-3 disabled:opacity-70">
            {isExpense ? <>
              <div className="grid gap-2"><Label htmlFor={`${id}-category`}>{copy.expenseCategory}</Label>
                <Select value={form.category} onValueChange={(value) => updateField("category", value)}><SelectTrigger {...fieldProps("category")} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{expenseCategories.map((category) => <SelectItem key={category} value={category}>{expenseCategoryLabel(category, locale)}</SelectItem>)}</SelectContent></Select>{fieldError("category")}</div>
              <div className="grid gap-2"><Label htmlFor={`${id}-description`}>{copy.description}</Label><Input {...fieldProps("description")} maxLength={240} value={form.description} onChange={(event) => updateField("description", event.target.value)} />{fieldError("description")}</div>
            </> : editing ? <p className="text-sm">{copy.batch}: {original?.batchCode ?? row?.batchCode ?? "--"} / {original?.supplierName ?? row?.supplierName ?? "--"}</p> : <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor={`${id}-batch-search`}>{copy.searchPlaceholder}</Label><Input id={`${id}-batch-search`} value={batchSearch.q} onChange={(event) => setBatchSearch((current) => ({ ...current, q: event.target.value, page: 0 }))} /></div>
                <div className="grid gap-2"><Label htmlFor={`${id}-supplier-search`}>{copy.supplierPlaceholder}</Label><Input id={`${id}-supplier-search`} value={batchSearch.supplier} onChange={(event) => setBatchSearch((current) => ({ ...current, supplier: event.target.value, page: 0 }))} /></div></div>
              <Label htmlFor={`${id}-batchId`}>{copy.batch}</Label>
              <Select value={form.batchId} onValueChange={(value) => { updateField("batchId", value); setSelectedBatch(batchData?.data.find((batch) => batch.id === value) ?? null); }}>
                <SelectTrigger {...fieldProps("batchId")} disabled={batchLoading || Boolean(batchError)} className="w-full"><SelectValue placeholder={selectedBatch ? `${selectedBatch.batchCode} / ${selectedBatch.supplierName}` : copy.batchPlaceholder} /></SelectTrigger>
                <SelectContent>{selectedBatch && !batchData?.data.some((batch) => batch.id === selectedBatch.id) ? <SelectItem value={selectedBatch.id}>{selectedBatch.batchCode} / {selectedBatch.supplierName}</SelectItem> : null}
                  {batchData?.data.map((batch) => <SelectItem key={batch.id} value={batch.id}>{batch.batchCode} / {batch.supplierName}{batch.outstandingNet !== null ? ` / ${formatFinanceMoney(batch.outstandingNet, locale, batch.currency)}` : ""}</SelectItem>)}</SelectContent></Select>
              {fieldError("batchId")}
              {batchLoading ? <p role="status" className="text-xs text-slate-500">{copy.loading}</p> : batchError ? <AdminNotice tone="error" message={batchError} action={<Button type="button" variant="outline" onClick={() => setDetailReload((value) => value + 1)}>{copy.retry}</Button>} /> : batchData?.data.length === 0 ? <p className="text-xs text-slate-500">{copy.empty}</p> : null}
              <FinancePagination copy={copy} meta={batchData?.meta} page={batchSearch.page} setPage={(update) => setBatchSearch((current) => ({ ...current, page: typeof update === "function" ? update(current.page) : update }))} loading={batchLoading || Boolean(batchError)} />
              {selectedBatch ? <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p>{copy.paymentCurrency}: EUR · {copy.batch}: {selectedBatch.currency}</p>
                {copy.payables}: {selectedBatch.outstandingNet === null ? copy.balanceUnknown : formatFinanceMoney(selectedBatch.outstandingNet, locale, selectedBatch.currency)} · {copy.alreadyPaid}: {selectedBatch.paidNet === null ? copy.balanceUnknown : formatFinanceMoney(selectedBatch.paidNet, locale, selectedBatch.currency)}
                <p>{copy.latestPayment}: {selectedBatch.latestPaidAt ? new Date(selectedBatch.latestPaidAt).toLocaleString(locale) : "--"}</p>
                {selectedBatch.costBasis !== "confirmed_net" ? <p className="text-amber-800">{copy.estimatedBalance}</p> : null}
                {selectedBatch.outstandingNet !== null && selectedBatch.currency === currency && net.ok && form.status === "paid" ? <p>{copy.balanceAfter}: {formatMoney(Math.max(0, financeGross(selectedBatch.outstandingNet, -net.value)), locale)}{net.value > selectedBatch.outstandingNet ? ` · ${copy.overpayment}` : ""}</p> : null}
              </div> : null}
            </div>}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2"><Label htmlFor={`${id}-amountNet`}>{copy.amountNet}</Label><Input {...fieldProps("amountNet")} inputMode="decimal" value={form.amountNet} onChange={(event) => updateField("amountNet", event.target.value)} />{fieldError("amountNet")}</div>
              <div className="grid gap-2"><Label htmlFor={`${id}-vatAmount`}>IVA</Label><Input {...fieldProps("vatAmount")} inputMode="decimal" value={form.vatAmount} onChange={(event) => updateField("vatAmount", event.target.value)} />{fieldError("vatAmount")}</div>
              <div className="grid gap-2"><Label htmlFor={`${id}-${isExpense ? "occurredAt" : "paidAt"}`}>{copy.date}</Label><Input {...fieldProps(isExpense ? "occurredAt" : "paidAt")} type={isExpense ? "date" : "datetime-local"} value={isExpense ? form.occurredAt : form.paidAt} onChange={(event) => updateField(isExpense ? "occurredAt" : "paidAt", event.target.value)} />{fieldError(isExpense ? "occurredAt" : "paidAt")}</div>
            </div>
            <p role="status" className="rounded-lg bg-slate-50 p-3 text-sm">{copy.preview}: {net.ok ? formatFinanceMoney(net.value, locale, currency) : "--"} + IVA {vat.ok ? formatFinanceMoney(vat.value, locale, currency) : "--"} = {previewGross !== null ? formatFinanceMoney(previewGross, locale, currency) : "--"}</p>{fieldError("amountGross")}
            {editing ? <div className="grid gap-2"><Label htmlFor={`${id}-status`}>{copy.status}</Label><Select value={form.status} onValueChange={(value) => updateField("status", value as FinanceEntryForm["status"])}><SelectTrigger {...fieldProps("status")} className="w-full"><SelectValue /></SelectTrigger><SelectContent>{(["pending", "paid", "cancelled"] as const).map((value) => <SelectItem key={value} value={value}>{copy.statuses[value]}</SelectItem>)}</SelectContent></Select><p className="text-xs text-slate-500">{isExpense ? copy.expenseStatusMeaning : copy.statusMeaning}</p>{fieldError("status")}</div> : null}
            <div className="grid gap-2"><Label htmlFor={`${id}-note`}>{copy.note}</Label><Textarea {...fieldProps("note")} maxLength={500} value={form.note} onChange={(event) => updateField("note", event.target.value)} />{fieldError("note")}{fieldError("notes")}</div>
            {editing ? <div className="grid gap-2"><Label htmlFor={`${id}-correctionReason`}>{copy.reason}</Label><Textarea {...fieldProps("correctionReason")} maxLength={500} value={form.correctionReason} onChange={(event) => updateField("correctionReason", event.target.value)} />{fieldError("correctionReason")}</div> : null}
          </fieldset>
        </DialogBody>
        <DialogFooter><AdminActionButton type="submit" pending={isSaving} pendingLabel={copy.saving} disabled={isSaving || entryLoading || (editing && !original) || uncertain}>{copy.save}</AdminActionButton></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

class FinanceApiError extends Error {
  constructor(message: string, readonly fields: Record<string, string> = {}) { super(message); }
}

function financeErrorMessage(failure: unknown, fallback: string) { return failure instanceof Error ? failure.message : fallback; }

async function financeResponseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: { message?: string; code?: string; details?: { issues?: { path: string; message: string }[] } } } | null;
  const fields: Record<string, string> = {};
  for (const issue of payload?.error?.details?.issues ?? []) fields[issue.path] = issue.message;
  return new FinanceApiError(payload?.error?.message || fallback, fields);
}

async function fetchFinanceJson<T>(url: string, fallback: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw await financeResponseError(response, fallback);
  const payload = await response.json() as { data?: unknown };
  if (!payload || typeof payload !== "object" || payload.data === undefined || payload.data === null || typeof payload.data !== "object") throw new FinanceApiError(fallback);
  return payload as T;
}

function formatFinanceMoney(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function expenseCategoryLabel(category: string, locale: string) {
  const labels: Record<string, [string, string]> = { rent: ["租金", "Affitto"], salary: ["工资", "Stipendi"], shipping: ["运输", "Spedizioni"], platform_fee: ["平台费", "Commissioni piattaforma"], utilities: ["水电", "Utenze"], tax: ["税费", "Imposte"], supplier_fee: ["供应商费用", "Costi fornitore"], bank_fee: ["银行费用", "Commissioni bancarie"], other: ["其他", "Altro"], purchase: ["采购", "Acquisti"], supplier_payment: ["供应商付款", "Pagamento fornitore"] };
  return (locale.startsWith("en") ? englishUiCopy(labels[category]?.[1]) : labels[category]?.[locale.startsWith("zh") ? 0 : 1]) ?? category;
}

type FinanceCopy = ReturnType<typeof financeCopy>;

function baseFinanceCopy(locale: string) {
  const isItalian = locale.startsWith("it");

  if (isItalian) {
    return {
      locale, dateFrom: "Dal", dateTo: "Al", dateBasis: "Data di riferimento", saved: "Registrazione salvata. Se l’aggiornamento fallisce, riprova la lettura senza registrare di nuovo.", readOnly: "Solo lettura: manca il permesso di registrazione.", exportDenied: "Manca il permesso di export.",
      edit: "Correggi", retry: "Riprova", previous: "Precedente", next: "Successiva", showing: "Voci", narrowFilters: "Restringi i filtri o esporta per continuare.",
      stale: "Risultati precedenti: non ancora aggiornati ai filtri / alla lettura corrente.", invalidMoney: "Inserisci un importo positivo o zero, con massimo 2 decimali (12,50 o 12.50).", invalidDate: "Inserisci una data/ora locale valida.", required: "Campo obbligatorio.",
      preview: "Netto + IVA = Totale", original: "Registrazione originale", reason: "Motivo della correzione", status: "Stato", statuses: { pending: "In sospeso", paid: "Pagato", cancelled: "Annullato" },
      statusMeaning: "Pagato conta come pagamento; annullato esclude la voce dalla contabilità. La correzione resta nell’audit.", correctionDescription: "Aggiorna questa registrazione e conserva la sua identità e l’audit. Inserisci il motivo; verifica i valori originali e la nuova anteprima.",
      expenseStatusMeaning: "In sospeso / pagato resta un costo; annullato esclude la spesa dal totale. La correzione resta nell’audit.",
      paymentCurrency: "Valuta pagamento", allowRetryAfterReview: "Ho verificato il ledger: nessun duplicato, riabilita invio",
      uncertain: "Esito non confermato. Controlla il ledger aggiornato prima di registrare di nuovo.", balanceUnknown: "Da verificare", estimatedBalance: "Saldo indicativo: base costo / IVA da verificare.", alreadyPaid: "Già pagato (netto)", latestPayment: "Ultimo pagamento", balanceAfter: "Residuo netto dopo il pagamento", overpayment: "L’importo supera il residuo",
      addExpense: "Aggiungi spesa",
      addPayment: "Registra pagamento",
      allCategories: "Tutte le categorie",
      allConfidence: "Tutte le confidence",
      amountNet: "Netto",
      batch: "Batch",
      cogsDetail: "Dettaglio COGS",
      costConfidence: "Confidence costi",
      date: "Data",
      dateModes: {
        created: "Creato",
        invoice: "Fattura",
        paid: "Pagato",
        received: "Ricevuto",
        recognized: "Riconosciuto",
      },
      description: "Descrizione",
      dialogDescription: "Operazione registrata nel ledger e audit admin.",
      empty: "Nessun dato",
      expenseCategory: "Categoria",
      expenses: "Spese",
      exportTitle: "Export",
      grossProfit: "Margine lordo",
      inventoryCost: "Valore costo stock",
      loadError: "Dati finanza non disponibili.",
      loading: "Caricamento...",
      netChart: "Netto operativo",
      batchPlaceholder: "Seleziona batch",
      note: "Nota",
      operatingProfit: "Utile operativo",
      payables: "Debiti fornitori",
      purchaseNet: "Costo acquisti",
      receivables: "Da incassare",
      refresh: "Aggiorna",
      salesNet: "Vendite nette",
      save: "Salva",
      saveError: "Salvataggio non riuscito.",
      saving: "Salvataggio...",
      searchPlaceholder: "Ordine, SKU, batch...",
      subtitle: "Vendite, COGS, acquisti, spese e riconciliazione costi",
      supplierPlaceholder: "Fornitore",
      table: {
        amount: "Importo",
        batch: "Batch",
        confidence: "Confidence",
        date: "Data",
        qty: "Qta",
        ref: "Ref",
        supplier: "Fornitore",
        title: "Voce",
        type: "Tipo",
        unitCost: "Costo unit.",
      },
      tabs: {
        expenses: "Spese",
        export: "Export",
        margin: "Vendite e margine",
        overview: "Panoramica",
        purchases: "Acquisti e debiti",
      },
      title: "Finanza",
      vatReview: "IVA da verificare",
    };
  }

  return {
    locale, dateFrom: "开始日期", dateTo: "结束日期", dateBasis: "日期依据", saved: "记账已保存。若刷新读取失败，请重试读取，无需再次登记。", readOnly: "只读：没有记账权限。", exportDenied: "没有财务导出权限。",
    edit: "更正", retry: "重试读取", previous: "上一页", next: "下一页", showing: "记录", narrowFilters: "请缩小筛选范围或导出后继续查阅。",
    stale: "当前显示此前结果，尚未更新到本次筛选或读取状态。", invalidMoney: "请输入非负金额，最多两位小数（12,50 或 12.50）。", invalidDate: "请输入有效的本地日期/时间。", required: "此字段必填。",
    preview: "净额 + IVA = 总额", original: "原记录", reason: "更正原因", status: "状态", statuses: { pending: "待支付", paid: "已支付", cancelled: "已取消" },
    statusMeaning: "已支付计入付款；已取消不计入核算。更正会保留审计记录。", correctionDescription: "原位更新这条记录并保留记录编号与审计。请填写原因，核对原值与新的金额预览。",
    expenseStatusMeaning: "待支付和已支付费用均计入成本；取消后不计入费用总额。更正保留审计。",
    paymentCurrency: "记账币种", allowRetryAfterReview: "已核对账本无重复记录，恢复提交",
    uncertain: "提交结果尚未确认。请先刷新账本核对，不要重复登记。", balanceUnknown: "待核对", estimatedBalance: "余额为估算，成本或IVA口径尚待核对。", alreadyPaid: "已付净额", latestPayment: "最近付款", balanceAfter: "付款后剩余净额", overpayment: "付款额超过剩余金额",
    addExpense: "新增费用",
    addPayment: "登记供应商付款",
    allCategories: "全部分类",
    allConfidence: "全部可信度",
    amountNet: "净额",
    batch: "批次",
    cogsDetail: "COGS 明细",
    costConfidence: "成本可信度",
    date: "日期",
    dateModes: {
      created: "创建",
      invoice: "发票",
      paid: "付款",
      received: "到货",
      recognized: "确认",
    },
    description: "说明",
    dialogDescription: "操作会写入账本并记录后台审计。",
    empty: "暂无数据",
    expenseCategory: "费用分类",
    expenses: "费用",
    exportTitle: "导出",
    grossProfit: "毛利",
    inventoryCost: "库存成本价值",
    loadError: "财务数据暂时不可用。",
    loading: "加载中...",
    netChart: "经营净额",
    batchPlaceholder: "选择批次",
    note: "备注",
    operatingProfit: "经营利润",
    payables: "应付供应商",
    purchaseNet: "进货净成本",
    receivables: "待收款",
    refresh: "刷新",
    salesNet: "销售净额",
    save: "保存",
    saveError: "保存失败。",
    saving: "保存中...",
    searchPlaceholder: "订单、SKU、批次...",
    subtitle: "销售、COGS、采购、费用与成本核对",
    supplierPlaceholder: "供应商",
    table: {
      amount: "金额",
      batch: "批次",
      confidence: "可信度",
      date: "日期",
      qty: "数量",
      ref: "引用",
      supplier: "供应商",
      title: "项目",
      type: "类型",
      unitCost: "单位成本",
    },
    tabs: {
      expenses: "费用账本",
      export: "导出/核对",
      margin: "销售与毛利",
      overview: "总览",
      purchases: "进货与应付",
    },
    title: "财务",
    vatReview: "IVA 待核对",
  };
}

function todayDate() {
  return localFinanceDate();
}
function financeCopy(locale: string) { return locale.startsWith("en") ? englishUiCopy(baseFinanceCopy("it-IT")) : baseFinanceCopy(locale); }
function localFinanceDateTime(date = new Date()) { return financeLocalInput(date.toISOString()); }
function localFinanceDate() { return financeDay(); }

function FinancePagination({ copy, meta, page, setPage, loading }: { copy: FinanceCopy; meta?: ApiListResponse<unknown>["meta"]; page: number; setPage: React.Dispatch<React.SetStateAction<number>>; loading: boolean }) {
  if (!meta) return null;
  const offset = meta.offset ?? 0; const returned = meta.returned ?? 0; const total = meta.total ?? returned; const limit = meta.limit ?? 50;
  return <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-slate-600">
    <span>{copy.showing} {returned ? offset + 1 : 0}–{offset + returned} / {total}</span><div className="flex gap-2">
      <Button type="button" variant="outline" size="sm" disabled={loading || page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>{copy.previous}</Button>
      <Button type="button" variant="outline" size="sm" disabled={loading || offset + returned >= total || returned === 0 || offset + limit > 5000} onClick={() => setPage((value) => value + 1)}>{copy.next}</Button>
    </div>{offset + limit > 5000 && offset + returned < total ? <span>{copy.narrowFilters}</span> : null}
  </div>;
}