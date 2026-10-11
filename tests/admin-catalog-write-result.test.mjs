import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(fetch) {
  const exports = {};
  const source = readFileSync(new URL('../src/components/partspro/admin-catalog-directory.tsx',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:()=>({}),fetch,AbortSignal,Error});
  return exports;
}
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const draft={id:'fixture',version:1};
test('catalog save network, 5xx and malformed success results stay unknown',async()=>{
  for(const fetch of [async()=>{throw Error('Synthetic network failure');},async()=>response({error:{message:'Synthetic 5xx'}},503),async()=>response({data:{nodes:[]}})]) {
    const {catalogRequest,CatalogWriteUnknownError}=load(fetch);
    await assert.rejects(()=>catalogRequest('/api/admin/catalog-directory',draft),CatalogWriteUnknownError);
  }
});
test('explicit version conflict remains a refusal and confirmed directory returns its snapshot',async()=>{
  const {catalogRequest,CatalogWriteUnknownError}=load(async()=>response({error:{message:'Synthetic conflict'}},409));
  await assert.rejects(()=>catalogRequest('/api/admin/catalog-directory',draft),e=>!(e instanceof CatalogWriteUnknownError)&&e.message.startsWith('409:'));
  const ok=load(async()=>response({data:{nodes:[],revision:'2'}}));
  assert.equal((await ok.catalogRequest('/api/admin/catalog-directory',draft)).revision,'2');
});
test('move success requires the exact submitted count and a returned directory snapshot',async()=>{
  const body={products:[{sku:'FIX-A'},{sku:'FIX-B'}]};
  for(const data of [undefined,{moved:1,directory:{nodes:[],revision:'2'}},{moved:2,directory:{nodes:[]}}]) {
    const {catalogRequest,CatalogWriteUnknownError}=load(async()=>response({data}));
    await assert.rejects(()=>catalogRequest('/api/admin/catalog-directory/move',body),CatalogWriteUnknownError);
  }
  const ok=load(async()=>response({data:{moved:2,directory:{nodes:[],revision:'2'}}}));
  assert.equal((await ok.catalogRequest('/api/admin/catalog-directory/move',body)).moved,2);
});
test('readback is GET without a write body and read failures never become confirmed writes',async()=>{
  let observed;
  const {catalogRequest,CatalogWriteUnknownError}=load(async(url,options)=>{observed=options;return response({error:{message:'Synthetic read failure'}},503);});
  await assert.rejects(()=>catalogRequest('/api/admin/catalog-directory'),e=>!(e instanceof CatalogWriteUnknownError));
  assert.equal(observed.method,'GET');assert.equal(observed.body,undefined);
});
