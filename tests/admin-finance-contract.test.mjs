import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
import * as core from '../src/lib/partspro-finance-core.mjs';
import * as inputs from '../src/lib/admin-finance-input.mjs';
const repository=readFileSync(new URL('../src/lib/partspro-repository.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('repository.ts',repository,ts.ScriptTarget.Latest,true);
const functions=ast.statements.filter(ts.isFunctionDeclaration).map(node=>node.getText(ast).replace(/^export\s+/,''));
const errorClass=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='RepositoryWriteError').getText(ast).replace(/^export\s+/,'');
const code=ts.transpileModule(errorClass+'\n'+functions.join('\n')+'\nexports.api={summarizeAdminFinance, buildAdminFinanceLedgerRows, readFinanceRows, getAdminFinanceAnalysis};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},...core,toPublicSku:value=>value,console};
vm.runInNewContext(code,context);
const {summarizeAdminFinance,buildAdminFinanceLedgerRows,readFinanceRows}=context.exports.api;
const schemaSource=readFileSync(new URL('../src/app/api/admin/finance/_shared.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/^export \{ parseAdminJsonBody \}.*;$/gm,'').replace(/^export \{.*\} from .*;$/gm,'');
const schemaContext={exports:{},z,...core,...inputs};
vm.runInNewContext(ts.transpileModule(schemaSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,schemaContext);
const {financeQuerySchema}=schemaContext.exports;
const {financeExpenseCreateSchema,supplierPaymentCreateSchema}=inputs;
const dataset=()=>({orders:[],orderLines:[],suppliers:[],supplierBatches:[],supplierBatchLines:[],costLayers:[],allocations:[],expenses:[],payments:[]});
const query={dateMode:'created',dateFrom:'2026-10-01',dateTo:'2026-10-31',limit:25,offset:0};
test('server rejects null/string/empty amounts, invalid calendar dates and reversed ranges',()=>{
 for(const amountNet of [null,'',true,'12,34',-1,1.001])assert.equal(financeExpenseCreateSchema.safeParse({amountNet,category:'other',description:'test'}).success,false);
 assert.equal(financeExpenseCreateSchema.safeParse({amountNet:12.34,category:'other',description:'test'}).success,true);
 assert.equal(financeQuerySchema.safeParse({dateFrom:'2026-02-30'}).success,false);
 assert.equal(financeQuerySchema.safeParse({dateFrom:'2026-10-18',dateTo:'2026-10-01'}).success,false);
 assert.equal(supplierPaymentCreateSchema.safeParse({amountNet:3}).success,false);
 assert.doesNotThrow(()=>financeQuerySchema.safeExtend({format:z.enum(['csv','xlsx'])}));
});
test('repository profit, partial gross receivable, historical batch payments and inventory reconcile',()=>{
 const d=dataset();
 d.orders=[{id:'paid',order_no:'ORD-1',payment_status:'paid',status:'delivered',total_net:100,vat:22,shipping:5,created_at:'2026-10-18T12:00:00Z'}, {id:'partial',order_no:'ORD-2',payment_status:'pending',status:'processing',total_net:100,vat:22,shipping:5,payment_received_amount:40,created_at:'2026-10-18T12:00:00Z'}, {id:'cancel',payment_status:'paid',status:'cancelled',total_net:1000,created_at:'2026-10-18T12:00:00Z'},{id:'deleted',payment_status:'paid',status:'delivered',total_net:1000,soft_deleted_at:'2026-10-18',created_at:'2026-10-18T12:00:00Z'}, {id:'refunded',payment_status:'refunded',status:'delivered',total_net:1000,created_at:'2026-10-18T12:00:00Z'}];
 d.supplierBatches=[{id:'batch',batch_code:'B-1',vat_mode:'excluded',created_at:'2026-10-18T12:00:00Z'}];d.supplierBatchLines=[{id:'line',batch_id:'batch',line_total:200}];
 d.costLayers=[{id:'layer',supplier_batch_id:'batch',received_qty:10,consumed_qty:3,unit_cost_net:20,created_at:'2026-09-01'}];
 d.allocations=[{id:'allocation',order_id:'paid',sku_code:'SKU-1',cost_layer_id:'layer',quantity:3,unit_cost_net:20,total_cost_net:60,status:'consumed',confidence:'exact',recognized_at:'2026-10-18T12:00:00Z'}, {id:'reversed',order_id:'paid',sku_code:'SKU-1',total_cost_net:999,status:'reversed',recognized_at:'2026-10-18T12:00:00Z'}];
 d.expenses=[{id:'exp1',description:'Rent',amount_net:10,status:'pending',occurred_at:'2026-10-18'},{id:'exp2',description:'Cancelled',amount_net:999,status:'cancelled',occurred_at:'2026-10-18'}];
 d.payments=[{id:'old',batch_id:'batch',amount_net:50,status:'paid',paid_at:'2026-09-01',created_at:'2026-09-01'}, {id:'cancelled',batch_id:'batch',amount_net:999,status:'cancelled',created_at:'2026-10-18'}];
 const result=summarizeAdminFinance(d,query);
 assert.equal(result.salesNet,100);assert.equal(result.cogsNet,60);assert.equal(result.expenseNet,10);assert.equal(result.grossProfit,40);assert.equal(result.operatingProfit,30);assert.equal(result.pendingReceivables,87);assert.equal(result.accountsPayable,150);assert.equal(result.inventoryCostValue,140);
 const rows=buildAdminFinanceLedgerRows(d,query);assert.equal(rows.filter(r=>r.type==='cogs').length,1);assert.equal(rows.filter(r=>r.type==='receivable').length,1);
 const trend=core.buildFinanceAnalysis(rows,[],query.dateFrom,query.dateTo);assert.equal(trend.trend.reduce((n,p)=>n+p.operatingProfit,0),result.operatingProfit);
});
test('finance read refuses truncation, uses stable order and detects an incomplete response',async()=>{
 let ordered=false;
 const client=(count,data)=>({from(){return {select(){return {order(column){ordered=column==='id';return {async range(){return {count,data,error:null};}}}}}}}});
 await assert.rejects(readFinanceRows(client(50001,[]),'orders','id',50000),/limit/);
 assert.equal(ordered,true);
 await assert.rejects(readFinanceRows(client(3,[{id:'1'}]),'orders','id',50000),/incomplete/);
 const rows=await readFinanceRows(client(1,[{id:'1'}]),'orders','id',50000);assert.equal(rows.length,1);
});

test('CSV and workbook retain complete rows, summary totals and date/confidence metadata', async()=>{
 const source=readFileSync(new URL('../src/app/api/admin/finance/export/route.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('export.ts',source,ts.ScriptTarget.Latest,true);
 const relevant=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&['buildFinanceCsv','buildFinanceWorkbook','escapeCsvCell'].includes(node.name?.text)||ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)==='exportHeaders')).map(node=>node.getText(ast)).join('\n');
 const {default:ExcelJS}=await import('exceljs');
 const target={exports:{},ExcelJS,Buffer};
 vm.runInNewContext(ts.transpileModule(relevant+'\nexports.api={buildFinanceCsv,buildFinanceWorkbook};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,target);
 const d=dataset();d.expenses=[{id:'e',description:'=SUM(1,2)\nquoted',amount_net:12.34,status:'paid',occurred_at:'2026-10-18'}];
 const rows=buildAdminFinanceLedgerRows(d,query),summary=summarizeAdminFinance(d,query);
 const csv=target.exports.api.buildFinanceCsv(rows,summary);
 assert.ok(csv.includes('# summary,expenseNet,12.34'));assert.ok(csv.includes('# range,2026-10-01,2026-10-31,created,Europe/Rome'));assert.ok(csv.includes('confidence'));assert.ok(csv.includes("'=SUM"));
 const bytes=await target.exports.api.buildFinanceWorkbook(rows,summary);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes);
 assert.equal(workbook.getWorksheet('Ledger').getCell('D2').value,12.34);
 const metrics=workbook.getWorksheet('Summary').getSheetValues().filter(Boolean).map(row=>[row[1],row[2]]);
 assert.equal(metrics.find(([key])=>key==='expenseNet')[1],12.34);assert.equal(metrics.find(([key])=>key==='timezone')[1],'Europe/Rome');
});

test('analysis and batch-option API gate reads before calling the repository', async()=>{
 for(const endpoint of ['analysis','batch-options']){
  let allowed=false,calls=0;
  const source=readFileSync(new URL(`../src/app/api/admin/finance/${endpoint}/route.ts`,import.meta.url),'utf8');
  const result={exports:{},require:name=>{
   if(name==='next/server')return {NextResponse:{json:body=>body}};
   if(name==='@/lib/partspro-repository')return {getAdminFinanceAnalysis:async()=>{calls++;return {data:{summary:{}},source:'supabase'};},listAdminFinanceBatchOptions:async()=>{calls++;return {data:[],total:0,source:'supabase'};}};
   if(name==='../_shared')return {financeQuerySchema};
   if(name==='../../_shared')return {requireAdminApi:async permission=>{assert.equal(permission,'finance.read');return allowed?{ok:true}:{ok:false,response:{status:403}};},parseAdminQuery:(params,schema)=>{const parsed=schema.safeParse(Object.fromEntries(params));return parsed.success?{ok:true,data:parsed.data}:{ok:false,response:{status:400}};},repositoryErrorResponse:()=>({status:500})};
   throw new Error(name);
  }};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,result);
  const request=search=>({nextUrl:{searchParams:new URLSearchParams(search)}});
  assert.equal((await result.exports.GET(request(''))).status,403);assert.equal(calls,0);
  allowed=true;assert.equal((await result.exports.GET(request('dateFrom=2026-02-30'))).status,400);assert.equal(calls,0);
  const response=await result.exports.GET(request('limit=25&offset=25'));assert.equal(calls,1);assert.equal(response.meta.source,'supabase');
 }
});


test('EUR totals fail explicitly instead of mixing native foreign-currency purchases or inventory',()=>{
 const d=dataset();d.supplierBatches=[{id:'b',batch_code:'USD-1',currency:'USD',created_at:'2026-10-18'}];d.supplierBatchLines=[{id:'l',batch_id:'b',line_total:100}];
 assert.throws(()=>summarizeAdminFinance(d,query),/currency reconciliation/);
 const stock=dataset();stock.costLayers=[{id:'l',currency:'CNY',received_qty:1,unit_cost_net:100}];
 assert.throws(()=>summarizeAdminFinance(stock,query),/currency reconciliation/);
});


test('historical foreign-currency payments and prior-period purchases cannot enter EUR comparisons',async()=>{
 const d=dataset();d.supplierBatches=[{id:'batch',batch_code:'B-1',currency:'EUR',created_at:'2026-10-18'}];d.supplierBatchLines=[{id:'line',batch_id:'batch',line_total:100}];d.payments=[{id:'old',batch_id:'batch',amount_net:50,currency:'USD',status:'paid',created_at:'2026-09-01'}];
 assert.throws(()=>summarizeAdminFinance(d,query),/non-EUR batch payments/);
 const previous=dataset();previous.supplierBatches=[{id:'b',batch_code:'USD-PREV',currency:'USD',created_at:'2026-10-17'}];previous.supplierBatchLines=[{id:'l',batch_id:'b',line_total:100}];
 const originalContext=context.requireSupabaseContext,originalRead=context.readAdminFinanceDataSet;
 context.requireSupabaseContext=async()=>({client:{}});context.readAdminFinanceDataSet=async()=>previous;
 try{await assert.rejects(context.exports.api.getAdminFinanceAnalysis({dateFrom:'2026-10-18',dateTo:'2026-10-18'}),/comparison period/);}finally{context.requireSupabaseContext=originalContext;context.readAdminFinanceDataSet=originalRead;}
});
