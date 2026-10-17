import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';
const require=createRequire(import.meta.url);
const data=fs.readFileSync(new URL('../src/lib/partspro-data.ts',import.meta.url),'utf8');
const array=data.match(/export const catalogDepartments = (\[[\s\S]*?\]) as const;/)[1];
const catalogDepartments=vm.runInNewContext(array);
function load(relative){
 const source=fs.readFileSync(new URL(relative,import.meta.url),'utf8');
 const compiled=transpileModule(source,{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2020}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,require:(name)=>name.includes('partspro-data')?{catalogDepartments}:name==='@/i18n/english-ui-copy'?load('../src/i18n/english-ui-copy.ts'):name==='./english-literals'?load('../src/i18n/english-literals.ts'):require(name)});return exports;
}
const {catalogNodeSchema,catalogMoveSchema,catalogNodeLabel,mergeCatalogDirectoryBrands}=load('../src/lib/partspro-catalog-directory.ts');
const {productPatchSchema}=load('../src/app/api/admin/products/_schemas.ts');
const node={kind:'category',value:'Custom',nameZh:'自定义',nameIt:'Personalizzata',position:1,active:true};
const move={products:[{sku:'ABC',updatedAt:'2026-10-10T08:00:00.123456Z'}],target:{department:'computer'},reason:'Move fixture'};
test('display renaming preserves canonical identity and both languages',()=>{
 const parsed=catalogNodeSchema.parse(node);assert.equal(parsed.value,'Custom');assert.equal(catalogNodeLabel(parsed,'zh-CN'),'自定义');assert.equal(catalogNodeLabel(parsed,'it'),'Personalizzata');
});
test('existing nodes require an optimistic version; departments cannot be created or disabled',()=>{
 assert.equal(catalogNodeSchema.safeParse({...node,id:'00000000-0000-4000-8000-000000000001'}).success,false);
 assert.equal(catalogNodeSchema.safeParse({...node,kind:'department',value:'phone'}).success,false);
 assert.equal(catalogNodeSchema.safeParse({...node,kind:'department',value:'phone',id:'00000000-0000-4000-8000-000000000001',version:1,active:false}).success,false);
});
test('moves retain microsecond versions and reject duplicates, null reasons and unknown targets',()=>{
 const parsed=catalogMoveSchema.parse(move);assert.equal(parsed.products[0].updatedAt,move.products[0].updatedAt);
 for(const bad of [{...move,products:[...move.products,...move.products]},{...move,reason:null},{...move,target:{stock:999}},{...move,target:{}},{...move,products:[]}]) assert.equal(catalogMoveSchema.safeParse(bad).success,false);
});
test('bulk directory moves cannot become canonical brand edits or stock writes',()=>{
 assert.equal(catalogMoveSchema.safeParse({...move,target:{brand:'OEM'}}).success,false);
 assert.equal(catalogMoveSchema.safeParse({...move,target:{department:'phone'},stock:900}).success,false);
});
test('product edits need exact versions; model and supplier remain optional',()=>{
 assert.equal(productPatchSchema.safeParse({name:'Electronic cable'}).success,false);
 assert.equal(productPatchSchema.safeParse({name:'Electronic cable',expectedUpdatedAt:'2026-10-10 08:00'}).success,false);
 const parsed=productPatchSchema.parse({name:'Electronic cable',category:'Custom',expectedUpdatedAt:move.products[0].updatedAt});
 assert.equal(parsed.expectedUpdatedAt,move.products[0].updatedAt);assert.equal(parsed.model,undefined);
});

test('universal products retain brand navigation after department moves without inventing compatibility',()=>{
 const existing=[{brand:'Apple',models:['iPhone 14'],series:[]}];
 const nodes=[{...node,kind:'brand',value:'REMAX',active:true,countsByDepartment:{computer:1}}];
 const result=mergeCatalogDirectoryBrands(existing,nodes,'computer');
 assert.equal(result.length,2);assert.equal(result[1].brand,'REMAX');assert.equal(result[1].models.length,0);
 assert.equal(mergeCatalogDirectoryBrands(existing,nodes,'tablet').length,1);
 assert.equal(mergeCatalogDirectoryBrands(result,nodes,'computer').length,2);
});

test('new nodes match the database active default and existing nodes may be disabled',()=>{
 assert.equal(catalogNodeSchema.safeParse({...node,active:false}).success,false);
 assert.equal(catalogNodeSchema.parse({...node,active:undefined}).active,true);
 assert.equal(catalogNodeSchema.safeParse({...node,id:'00000000-0000-4000-8000-000000000001',version:1,active:false}).success,true);
});
