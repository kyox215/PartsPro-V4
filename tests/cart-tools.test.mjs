import test from 'node:test';import assert from 'node:assert/strict';import {parseCartBatch,restoreRemovedCartItems} from '../src/lib/partspro-cart-tools.mjs';
test('batch accepts CSV/TSV/space, combines duplicate SKU and rejects malformed quantities',()=>{assert.deepEqual(parseCartBatch('SKU-001 2\nSKU-001,3\nSKU-002\t1'),{items:[{sku:'SKU-001',quantity:5},{sku:'SKU-002',quantity:1}],errors:[]});assert.deepEqual(parseCartBatch('SKU-001 0\nSKU-001 2.5\nSKU-001 999\nSKU-001 1').errors,['1','2','4']);assert.deepEqual(parseCartBatch(Array(101).fill('SKU-001 1').join('\n')).errors,['limit']);});
test('undo preserves later edits and restores removed SKU without old price snapshots',()=>{assert.deepEqual(restoreRemovedCartItems([{sku:'SKU-001',quantity:3},{sku:'SKU-003',quantity:1}],[{sku:'SKU-001',quantity:2},{sku:'SKU-002',quantity:4,snapshot:{price:10}}]),[{sku:'SKU-001',quantity:3},{sku:'SKU-003',quantity:1},{sku:'SKU-002',quantity:4}]);});

import {classifyCheckoutRpcError} from '../src/lib/partspro-checkout-result.mjs';
test('known PostgreSQL business rollbacks differ from transport and conflicting receipts',()=>{
 assert.deepEqual(classifyCheckoutRpcError({code:'23514'}),{status:422,code:'ORDER_STOCK_INVALID',transactionRolledBack:true});
 assert.deepEqual(classifyCheckoutRpcError({code:'40001',message:'Price changed'}),{status:409,code:'ORDER_PRICE_CHANGED',transactionRolledBack:true});
 assert.equal(classifyCheckoutRpcError({code:'40001',message:'preorder ETA changed'}).code,'PREORDER_OFFER_CHANGED');
 assert.equal(classifyCheckoutRpcError({code:'PGRST202'}).transactionRolledBack,false);assert.equal(classifyCheckoutRpcError({code:'22023'}).transactionRolledBack,false);
});
