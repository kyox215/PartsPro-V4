import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),storage=new Map();
const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
const loadedModule={exports:{}};const source=ts.transpileModule(readFileSync(new URL('../src/components/partspro/cart-state.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const dependencies={'react':{createContext:()=>({})},'@/lib/partspro-data':{products:[]},'@/lib/partspro-shipping':{calculateShippingCents:()=>0},'@/lib/partspro-preorder-contract':{getProductPurchaseKind:()=> 'stock',isProductOrderable:()=>true},'@/lib/partspro-sku':{toPublicSku:value=>value}};
vm.runInNewContext(source,{module:loadedModule,exports:loadedModule.exports,require:name=>{assert.ok(dependencies[name],name);return dependencies[name]},window:{localStorage,dispatchEvent(){}},Event,URLSearchParams,Map,Set,console});const cart=loadedModule.exports;
test('a delayed response never clears a newer persisted cart or a changed owner',()=>{
 cart.setCartStorageOwner('account-A');cart.replaceStoredCartItems([{sku:'SKU-001',quantity:1}]);const signature=cart.serializeCartItems(cart.readClientStoredCartItems());
 cart.replaceStoredCartItems([{sku:'SKU-001',quantity:2},{sku:'SKU-002',quantity:1}]);assert.equal(cart.clearStoredCartIfSignature(signature,'account-A'),false);assert.equal(cart.readClientStoredCartItems().length,2);
 cart.setCartStorageOwner('account-B');cart.replaceStoredCartItems([{sku:'SKU-003',quantity:1}]);assert.equal(cart.clearStoredCartIfSignature(cart.serializeCartItems(cart.readClientStoredCartItems()),'account-A'),false);assert.equal(cart.readClientStoredCartItems()[0].sku,'SKU-003');
 const matching=cart.serializeCartItems(cart.readClientStoredCartItems());assert.equal(cart.clearStoredCartIfSignature(matching,'account-B'),true);assert.equal(cart.readClientStoredCartItems().length,0);
});
