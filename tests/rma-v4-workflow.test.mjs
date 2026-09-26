import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { projectRmaV4Workflow } from '../src/lib/partspro-rma-v4-rules.mjs';
import { isRmaActionAvailable } from '../src/lib/partspro-rma-rules.mjs';

const all = { manage: true, inventory: true, refund: true, adjustStock: true };
const received = { status: 'received', quantity: 3, receivedQuantity: 3, receivedAt: '2026-09-26T10:00:00Z', qcStatus: 'passed', inventoryDisposition: 'quarantine', requestedResolution: 'wallet_credit' };
const actions = (row, capabilities = all) => projectRmaV4Workflow(row, capabilities).availableActions;

test('failed or waived inspection never enables sellable restock, including after wallet approval', () => {
  for (const qcStatus of ['failed', 'not_required', 'pending']) {
    for (const status of ['received', 'refunded']) {
      const row = { ...received, status, qcStatus, resolutionAction: status === 'refunded' ? 'refund_wallet' : null, resolutionQuantity: status === 'refunded' ? 3 : null, walletRefundStatus: status === 'refunded' ? 'approved' : null };
      assert.equal(actions(row).includes('restock_return'), false);
      assert.equal(isRmaActionAvailable({ ...row, action: 'restock_return' }), false);
    }
  }
  assert.ok(actions(received).includes('restock_return'));
});

test('warehouse dispositions proceed while wallet approval is pending but do not permit closing', () => {
  const row = { ...received, walletRefundStatus: 'pending', walletRefundRequestId: 'refund', resolutionAction: 'refund_wallet' };
  assert.ok(actions(row).includes('restock_return'));
  assert.ok(actions(row).includes('mark_scrapped'));
  assert.equal(actions(row).includes('close'), false);
  assert.equal(actions(row).includes('split_request'), false);
});

test('splitting is permitted only before inspection and settlement, preserving source quantities', () => {
  assert.ok(actions({ ...received, qcStatus: 'pending' }).includes('split_request'));
  assert.ok(actions({ ...received, status: 'approved', receivedQuantity: null, receivedAt: null, qcStatus: 'pending', inventoryDisposition: 'pending' }).includes('split_request'));
  for (const override of [{ qcStatus: 'passed' }, { quantity: 1, receivedQuantity: 1 }, { walletRefundRequestId: 'pending' }, { receivedQuantity: 2 }, { inventoryDisposition: 'scrap' }]) {
    assert.equal(actions({ ...received, qcStatus: 'pending', ...override }).includes('split_request'), false);
  }
  assert.equal(actions({ ...received, qcStatus: 'pending' }, { ...all, manage: false }).includes('split_request'), false);
});

test('pending negotiation hides destructive and money actions until a recorded agreement', () => {
  const row = { ...received, negotiationStatus: 'pending' };
  assert.deepEqual(actions(row), ['resolve_negotiation']);
  assert.deepEqual(actions(row, { ...all, manage: false }), []);
});

test('agreed no-refund outcomes close only after the matching physical disposition', () => {
  for (const [outcome, disposition, action] of [['return_to_customer', 'returned_to_customer', 'return_to_customer'], ['scrap_without_refund', 'scrap', 'mark_scrapped']]) {
    const row = { ...received, negotiationStatus: 'agreed', negotiationOutcome: outcome, customerConfirmation: 'Written consent' };
    assert.deepEqual(actions(row), [action]);
    assert.deepEqual(actions({ ...row, inventoryDisposition: disposition, inventoryDispositionQuantity: 2 }), []);
    assert.deepEqual(actions({ ...row, inventoryDisposition: disposition, inventoryDispositionQuantity: 3 }), ['close']);
    assert.equal(actions(row).includes('request_wallet_refund'), false);
  }
});

test('rejected and approved customer requests keep distinct actionable stages', () => {
  const ts = createRequire(import.meta.url)('typescript');
  const source = readFileSync(new URL('../src/lib/partspro-rma-contract.ts', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('contract.ts', source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === 'customerStageForRmaStatus');
  const compiled = ts.transpileModule(fn.getText(ast).replace('export ', '') + '\nglobalThis.stage = customerStageForRmaStatus;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  const context = {}; vm.runInNewContext(compiled.outputText, context);
  assert.equal(context.stage('rejected'), 'rejected');
  assert.equal(context.stage('approved'), 'awaiting_return');
  assert.equal(context.stage('refunded'), 'refunded');
  assert.equal(context.stage('closed'), 'completed');
});


test('customer history translates canonical reasons and outcomes instead of exposing codes', () => {
  const ts = createRequire(import.meta.url)('typescript');
  const source = readFileSync(new URL('../src/i18n/dictionaries/storefront.ts', import.meta.url), 'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context={exports:{}};vm.runInNewContext(compiled,context);
  const {rmaReasonLabel,rmaResolutionLabel,storefrontItIT,storefrontZhCN}=context.exports;
  for (const dict of [storefrontItIT,storefrontZhCN]) {
    const t=key=>dict[key]??key;
    for (const reason of ['quality_defect','shipping_damage','not_as_described','wrong_item','missing_or_quantity_error','withdrawal_no_longer_needed']) assert.notEqual(rmaReasonLabel(t,reason),reason);
    for (const resolution of ['wallet_credit','replacement','refund','credit_note']) assert.notEqual(rmaResolutionLabel(t,resolution),resolution);
  }
});
