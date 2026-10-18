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
