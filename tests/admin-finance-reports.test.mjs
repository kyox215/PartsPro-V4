import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import * as inputs from '../src/lib/admin-finance-input.mjs';
import { financeRound } from '../src/lib/partspro-finance-core.mjs';
import * as reports from '../src/lib/partspro-finance-reports.mjs';

const row = (type, amountNet, extra = {}) => ({ type, amountNet, date:'2026-10-18', category:null, status:null, currency:'EUR', ...extra });
const source = [row('sale',100),row('cogs',40),row('expense',10,{status:'paid',category:'rent'}),row('expense',5,{status:'pending',category:'rent'}),row('expense',999,{status:'cancelled'}),row('purchase',500),row('supplier_payment',200,{status:'paid'}),row('supplier_payment',40,{status:'pending'}),row('supplier_payment',888,{status:'cancelled'}),row('receivable',87)];
const build = (rows=source, previous=[]) => reports.buildFinanceReports(rows,previous,'2026-10-01','2026-10-31');

test('reports separate recognized costs, paid/pending expenses, purchases and supplier settlements without double counting',()=>{
 const report=build(),t=report.totals;
 assert.equal(t.salesNet,100);assert.equal(t.operatingCostsNet,55);assert.equal(t.operatingProfit,45);
 assert.equal(t.recordedPaymentsNet,210);assert.equal(t.pendingSupplierPaymentsNet,40);assert.equal(t.receivablesGross,87);
 assert.equal(t.purchaseNet,500);assert.equal(t.cancelledExpenseNet,999);assert.equal(t.salesOrders,1);assert.equal(t.averageOrderNet,100);
 assert.deepEqual(report.expenseCategories,[{category:'rent',amountNet:15,paidNet:10,pendingNet:5,count:2}]);
});
test('daily, weekly and calendar-month totals reconcile at cents across partial months and the year boundary',()=>{
 const rows=[row('sale',0.1,{date:'2026-12-30'}),row('sale',0.2,{date:'2027-01-01'}),row('sale',10,{date:'2027-01-02'}),row('cogs',12,{date:'2027-01-02'}),row('expense',0.3,{date:'2027-01-02',status:'pending'})];
 const report=reports.buildFinanceReports(rows,[],'2026-12-30','2027-01-03');
 for(const unit of ['day','week','month']){
  const periods=reports.bucketFinanceReport(report.daily,unit);
  for(const key of ['salesNet','cogsNet','expenseNet','operatingProfit','salesOrders'])assert.equal(financeRound(periods.reduce((sum,p)=>sum+p[key],0)),report.totals[key]);
 }
 const months=reports.bucketFinanceReport(report.daily,'month');assert.equal(months.length,2);assert.equal(months[0].date,'2026-12-30');assert.equal(months[0].dateTo,'2026-12-31');assert.equal(months[1].dateTo,'2027-01-03');assert.equal(months[1].averageOrderNet,5.1);
});
test('comparison uses equal periods, respects Rome midnight and keeps negative profit and absent baseline honest',()=>{
 const report=reports.buildFinanceReports([row('sale',10,{date:'2026-10-17T22:30:00Z'}),row('cogs',20),row('sale',999,{date:'2026-10-19'})],[row('sale',5,{date:'2026-10-17'}),row('sale',999,{date:'2026-10-16'})],'2026-10-18','2026-10-18');
 assert.equal(report.totals.salesNet,10);assert.equal(report.totals.operatingProfit,-10);assert.equal(report.previousTotals.salesNet,5);assert.equal(report.changes.salesNet,100);assert.equal(report.changes.expenseNet,null);
 assert.equal(build([]).totals.averageOrderNet,0);assert.equal(build([]).expenseCategories.length,0);
});
test('invalid dates, oversized ranges, non-finite money and mixed currencies fail instead of returning partial or false totals',()=>{
 for(const [from,to] of [['2026-02-30','2026-03-01'],['2026-11-01','2026-10-01'],['2025-01-01','2026-01-02']])assert.throws(()=>reports.buildFinanceReports([],[],from,to));
 for(const money of [NaN,Infinity])assert.throws(()=>build([row('sale',money)]));
 assert.throws(()=>build([row('sale',1,{currency:'USD'})]));assert.throws(()=>build([],[row('sale',1,{date:'2026-09-01',currency:'USD'})]));
});
function compile(path,imports) {
 const loadedModule={exports:{}};
 const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports:loadedModule.exports,module:loadedModule,Buffer,Response,Date,require:name=>{if(name in imports)return imports[name];throw Error('Unexpected import '+name);}});
 return loadedModule.exports;
}
const exporter=compile('src/lib/partspro-finance-report-export.ts',{'exceljs':ExcelJS,'./partspro-finance-reports.mjs':reports});
function document() {return {...build(),range:{dateFrom:'2026-10-01',dateTo:'2026-10-31',dateMode:'created'},summary:{accountsPayable:300,inventoryCostValue:900,vatAmbiguousPurchaseNet:0},suppliers:[],generatedAt:'2026-10-21T12:00:00Z'};}
const ledger=[{...row('expense',12.34),title:' \t=SUM(1,2)\nquoted',orderNo:null,skuCode:null,batchCode:null,supplierName:null,confidence:null}];
test('comprehensive CSV includes all sections, reconciled figures and formula-injection protection',()=>{
 const csv=exporter.buildFinanceReportCsv(document(),ledger);
 for(const name of ['Overview','ProfitLoss','Monthly','Daily','Expenses','Suppliers','Ledger'])assert.ok(csv.includes('# '+name));
 assert.ok(csv.includes('salesNet,100,0,100,'));assert.ok(csv.includes('recordedPaymentsNet,210'));assert.ok(csv.includes("' \t=SUM"));assert.ok(csv.includes('not bank cash flow'));
});
test('seven-sheet XLSX preserves numeric values and all ledger records, with frozen and formatted headers',async()=>{
 const bytes=await exporter.buildFinanceReportWorkbook(document(),ledger),workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);
 assert.equal(workbook.worksheets.length,7);assert.equal(workbook.getWorksheet('ProfitLoss').getCell('B6').value,45);assert.equal(workbook.getWorksheet('Expenses').getCell('D2').value,5);
 assert.equal(workbook.getWorksheet('Ledger').getCell('D2').value,12.34);assert.equal(workbook.getWorksheet('Ledger').getCell('C2').value,ledger[0].title);
 assert.equal(workbook.getWorksheet('Daily').rowCount,32);assert.equal(workbook.getWorksheet('Monthly').getCell('C2').value,100);assert.equal(workbook.getWorksheet('Monthly').views[0].ySplit,1);
});
const financeShared=compile('src/app/api/admin/finance/_shared.ts',{'zod':{z},'@/lib/admin-finance-input.mjs':inputs,'@/lib/partspro-api':{}});
function endpoint(path,repo,{allowed=true,exportPermission=true,audit=()=>{}}={}) {
 return compile(path,{
  'next/server':{NextResponse:Response},'zod':{z},'@/lib/partspro-repository':{...repo,auditAdminFinanceExport:audit},'exceljs':ExcelJS,
  '@/lib/partspro-finance-report-export':exporter,'@/lib/partspro-api':{apiError:(status,code,message)=>Response.json({error:{code,message}},{status})},
  '@/lib/partspro-admin-auth':{hasAdminPermission:()=>exportPermission},'../_shared':financeShared,
  '../../_shared':{requireAdminApi:async scope=>{if(!allowed)return{ok:false,response:new Response(null,{status:403})};assert.ok(['finance.read','finance.export'].includes(scope));return{ok:true,authState:{role:'staff'}};},parseAdminQuery:(search,schema)=>{const parsed=schema.safeParse(Object.fromEntries(search));return parsed.success?{ok:true,data:parsed.data}:{ok:false,response:new Response(null,{status:400})};},repositoryErrorResponse:error=>Response.json({error:{message:error.message}},{status:502})},
 });
}
const req=query=>({nextUrl:new URL('https://example.test'+query)});
test('report API gates reads, validates date filters and excludes the full private ledger from JSON',async()=>{
 let calls=0;const repo={getAdminFinanceReports:async query=>{calls++;assert.equal(query.q,'ORD');return{data:document(),ledgerRows:[{private:'secret'}],source:'supabase'};}};
 const path='src/app/api/admin/finance/reports/route.ts';
 assert.equal((await endpoint(path,repo,{allowed:false}).GET(req('?q=ORD'))).status,403);assert.equal(calls,0);
 assert.equal((await endpoint(path,repo).GET(req('?dateFrom=2026-02-30'))).status,400);assert.equal(calls,0);
 const response=await endpoint(path,repo).GET(req('?q=ORD'));assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.ok(!(await response.text()).includes('private'));assert.equal(calls,1);
});
test('comprehensive export requires both permissions, preserves filters, generates before audit and never drops pagination-independent records',async()=>{
 let audits=0,calls=0;const repo={getAdminFinanceReports:async query=>{calls++;assert.equal(query.supplier,'UTOPYA');return{data:document(),ledgerRows:ledger,source:'supabase'};}};
 const path='src/app/api/admin/finance/export/route.ts',q=req('?report=comprehensive&format=xlsx&supplier=UTOPYA&limit=1&offset=25');
 assert.equal((await endpoint(path,repo,{allowed:false}).GET(q)).status,403);assert.equal((await endpoint(path,repo,{exportPermission:false}).GET(q)).status,403);assert.equal(calls,0);
 const response=await endpoint(path,repo,{audit:meta=>{audits++;assert.equal(meta.report,'comprehensive');assert.equal(meta.total,1);}}).GET(q);
 assert.equal(response.status,200);assert.equal(audits,1);assert.equal(calls,1);assert.match(response.headers.get('content-disposition'),/\.xlsx/);assert.match(response.headers.get('cache-control'),/no-store/);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));assert.equal(workbook.getWorksheet('Ledger').rowCount,2);
});
