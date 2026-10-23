import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRmaV4Workflow } from '../src/lib/partspro-rma-v4-rules.mjs';
import { buildFinanceAnalysis, buildFinanceDailyTrend } from '../src/lib/partspro-finance-core.mjs';
import { buildFinanceReports } from '../src/lib/partspro-finance-reports.mjs';
const caps={manage:true,approveRefund:true,refund:true,inventory:true,adjustStock:true,qc:true};
const base={status:'approved',quantity:1,receivedQuantity:null,receivedAt:null,qcStatus:'pending',inventoryDisposition:'pending',requestedResolution:'wallet_credit',negotiationStatus:'none'};
test('submitted can be directly approved; read-only cannot decide or pay',()=>{
 assert.deepEqual(projectRmaV4Workflow({...base,status:'submitted'},caps).availableActions,['approve','reject','assign']);
 assert.deepEqual(projectRmaV4Workflow({...base,status:'submitted'},{...caps,manage:false}).availableActions,[]);
 assert.equal(projectRmaV4Workflow(base,{...caps,approveRefund:false}).availableActions.includes('execute_refund'),false);
});
test('refund before receipt and legacy missing snapshot has one money action',()=>{
 for(const extra of [{},{refundPricingVerified:false,unitPriceSnapshot:null},{walletRefundRequestId:'pending',walletRefundStatus:'pending',resolutionAction:'refund_wallet'}]) {
  const state=projectRmaV4Workflow({...base,...extra},caps);
  assert.equal(state.recommendedAction,'execute_refund');
  assert.equal(state.availableActions.includes('execute_refund'),true);
  for(const old of ['request_wallet_refund','verify_refund_snapshot','prepare_wallet_refund'])assert.equal(state.availableActions.includes(old),false);
 }
});
test('negotiation and active replacement still prevent a new financial outcome',()=>{
 for(const extra of [{replacementOrderId:'shipped'},{replacementReservedOrderId:'reserved'},{negotiationStatus:'pending'},{negotiationStatus:'agreed',negotiationOutcome:'replacement'},{walletRefundStatus:'approved'}])
  assert.equal(projectRmaV4Workflow({...base,...extra},caps).availableActions.includes('execute_refund'),false);
});
test('refunded goods remain actionable until receipt/disposition or explicit waiver',()=>{
 const refunded={...base,status:'refunded',refundCompletedAt:'2026-10-23T20:00:00Z',refundMethod:'cash',resolutionAction:'refund_cash'};
 assert.deepEqual(projectRmaV4Workflow(refunded,caps).availableActions,['mark_received','waive_return']);
 assert.deepEqual(projectRmaV4Workflow({...refunded,returnWaivedAt:'now'},caps).availableActions,['close']);
 const received={...refunded,receivedAt:'now',receivedQuantity:1,inventoryDisposition:'quarantine'};
 assert.deepEqual(projectRmaV4Workflow(received,caps).availableActions,['record_qc']);
 for(const qcStatus of ['failed','not_required'])assert.equal(projectRmaV4Workflow({...received,qcStatus},caps).availableActions.includes('restock_return'),false);
 assert.equal(projectRmaV4Workflow({...received,qcStatus:'passed'},caps).availableActions.includes('restock_return'),true);
 assert.deepEqual(projectRmaV4Workflow({...received,qcStatus:'passed',inventoryDisposition:'restock',inventoryDispositionQuantity:1},caps).availableActions,['close']);
});
test('cash and wallet reverse sales once, only cash increases recorded cash paid',()=>{
 const date='2026-10-23T12:00:00Z';
 const rows=[{type:'sale',amountNet:100,date,status:'paid'},
 {type:'refund',amountNet:10,date,status:'paid',metadata:{refundMethod:'cash',amountGross:12.2}},
 {type:'refund',amountNet:20,date,status:'paid',metadata:{refundMethod:'wallet_credit',amountGross:24.4}}];
 const report=buildFinanceReports(rows,[],'2026-10-23','2026-10-23');
 assert.equal(report.totals.salesNet,70);assert.equal(report.totals.expenseNet,0);
 assert.equal(report.totals.cashRefundsGross,12.2);assert.equal(report.totals.walletRefundsGross,24.4);
 assert.equal(report.totals.recordedPaymentsNet,10);
 assert.equal(buildFinanceAnalysis(rows,[],'2026-10-23','2026-10-23').trend[0].salesNet,70);
 assert.equal(buildFinanceDailyTrend(rows,'2026-10-23','2026-10-23')[0].salesNet,70);
});
