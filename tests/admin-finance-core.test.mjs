import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFinanceMoney, validFinanceDate, financeDay, shiftFinanceDay, financeRomeLocalToIso, financeLocalInput, buildFinanceAnalysis } from '../src/lib/partspro-finance-core.mjs';

test('money accepts Italian and plain decimals without converting missing values into zero',()=>{
 for(const [input,expected] of [['123,45',123.45],['1.234,56',1234.56],['1,234.56',1234.56],['0',0],[' 14.20 ',14.2],[123.45,123.45]])assert.equal(parseFinanceMoney(input),expected);
 for(const input of ['',null,undefined,NaN,Infinity,'1,234','1.234','1 000','1e3','-1',-1,0.001,'1,2,3',{},true,1e10])assert.equal(parseFinanceMoney(input),null,String(input));
});
test('calendar dates reject rollover and respect Rome midnight',()=>{
 assert.equal(validFinanceDate('2026-02-30'),false);assert.equal(validFinanceDate('2024-02-29'),true);assert.equal(validFinanceDate('2026-02-29'),false);
 assert.equal(financeDay('2026-10-17T22:30:00Z'),'2026-10-18');assert.equal(financeDay('2026-10-18'),'2026-10-18');assert.equal(shiftFinanceDay('2026-03-29',1),'2026-03-30');
});
test('Rome payment time conversion does not depend on browser timezone; DST ambiguity fails closed',()=>{
 assert.equal(financeRomeLocalToIso('2026-10-18T15:35'),'2026-10-18T13:35:00.000Z');
 assert.equal(financeRomeLocalToIso('2026-01-18T15:35'),'2026-01-18T14:35:00.000Z');
 assert.equal(financeRomeLocalToIso('2026-03-29T02:30'),null);assert.equal(financeRomeLocalToIso('2026-10-25T02:30'),null);
 assert.equal(financeRomeLocalToIso('2026-10-18T25:00'),null);assert.equal(financeLocalInput('2026-10-18T13:35:00Z'),'2026-10-18T15:35');
});
const row=(type,amountNet,extra={})=>({type,amountNet,date:'2026-10-18T12:00:00Z',category:null,status:null,...extra});
test('analysis reconciles sales minus COGS minus paid and pending expenses; cancelled expenses excluded',()=>{
 const result=buildFinanceAnalysis([row('sale',100),row('cogs',60),row('expense',10,{status:'paid',category:'rent'}),row('expense',5,{status:'pending',category:'rent'}),row('expense',999,{status:'cancelled'}),row('receivable',400),row('supplier_payment',500)], [row('sale',50),row('cogs',30)], '2026-10-17','2026-10-18');
 assert.equal(result.trend.length,2);assert.equal(result.trend[0].salesNet,0);assert.equal(result.trend[1].operatingProfit,25);assert.equal(result.trend[1].grossProfit,40);
 assert.deepEqual(result.expenses,[{category:'rent',amountNet:15}]);assert.equal(result.changes.salesNet,100);assert.equal(result.changes.expenseNet,null);
});
test('negative profit and net corrections stay visible; all-zero baseline is not infinity',()=>{
 const result=buildFinanceAnalysis([row('sale',-20),row('cogs',40),row('expense',0.1),row('expense',0.2)],[],'2026-10-18','2026-10-18');
 assert.equal(result.trend[0].operatingProfit,-60.3);assert.equal(result.trend[0].expenseNet,0.3);assert.equal(result.changes.operatingProfit,null);
});

test('prior daily points use equal period and Rome boundaries, week buckets preserve cents and partial weeks',async()=>{
 const {bucketFinanceTrend}=await import('../src/lib/partspro-finance-core.mjs');
 const rows=[row('sale',0.1,{date:'2026-10-24T22:30:00Z'}),row('sale',0.2,{date:'2026-11-01T12:00:00Z'}),row('cogs',1,{date:'2026-11-01'})];
 const prior=[row('sale',10,{date:'2026-10-16'}),row('sale',20,{date:'2026-10-24'})];
 const result=buildFinanceAnalysis(rows,prior,'2026-10-25','2026-11-02');
 assert.equal(result.previousTrend.length,9);assert.equal(result.previousTrend[0].date,'2026-10-16');assert.equal(result.previousTrend.at(-1).date,'2026-10-24');
 const weeks=bucketFinanceTrend(result.trend,result.previousTrend,'week');assert.equal(weeks.length,2);assert.equal(weeks[0].dateTo,'2026-10-31');assert.equal(weeks[1].dateTo,'2026-11-02');
 assert.equal(weeks[0].salesNet,0.1);assert.equal(weeks[1].salesNet,0.2);assert.equal(weeks[1].previousSalesNet,20);assert.equal(weeks[1].grossProfit,-0.8);
 assert.equal(Math.round(weeks.reduce((n,p)=>n+p.salesNet,0)*100),30);
});
test('supplier groups reconcile all batches with overpayments without merging supplier IDs',async()=>{
 const {buildFinanceSupplierAnalysis}=await import('../src/lib/partspro-finance-core.mjs');
 const result=buildFinanceSupplierAnalysis([{supplierId:'a',supplierName:'Same name',amountNet:100,paidNet:120,outstandingNet:0},{supplierId:'a',supplierName:'Same name',amountNet:30,paidNet:5,outstandingNet:25},{supplierId:'b',supplierName:'Same name',amountNet:50,paidNet:10,outstandingNet:40},{supplierId:null,supplierName:null,amountNet:2,paidNet:0,outstandingNet:2}]);
 assert.equal(result.length,3);assert.equal(result[0].key,'id:b');const a=result.find(p=>p.key==='id:a');assert.equal(a.batches,2);assert.equal(a.paidNet,125);assert.equal(a.appliedPaidNet,105);assert.equal(a.outstandingNet,25);assert.equal(result.reduce((n,p)=>n+p.outstandingNet,0),67);
});
