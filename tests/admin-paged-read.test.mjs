import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAllAdminRows} from '../src/lib/admin-paged-read.mjs';
const response = (data,total) => ({ok:true,json:async()=>({data,meta:{total}})});
test('full export continues after first 200 without dropping filtered rows',async()=>{
 const pages=[];const result=await loadAllAdminRows('/items',new URLSearchParams({q:'abc'}),{key:r=>r.id,fetcher:async url=>{const q=new URL(url,'https://test.local').searchParams;assert.equal(q.get('q'),'abc');const o=Number(q.get('offset'));pages.push(o);return response(Array.from({length:o===0?200:5},(_,i)=>({id:String(o+i)})),205)}});assert.equal(result.length,205);assert.deepEqual(pages,[0,200]);
});
test('changed or incomplete export fails instead of downloading a partial file',async()=>{
 let n=0;await assert.rejects(loadAllAdminRows('/items',new URLSearchParams(),{fetcher:async()=>response(Array.from({length:200},(_,i)=>({id:String(i)})),n++?201:205)}),/EXPORT_CHANGED/);
 await assert.rejects(loadAllAdminRows('/items',new URLSearchParams(),{fetcher:async()=>response([{id:'1'}],205)}),/EXPORT_INCOMPLETE/);
});
test('duplicate rows from moving pagination are rejected',async()=>{await assert.rejects(loadAllAdminRows('/items',new URLSearchParams(),{key:r=>r.id,fetcher:async()=>response(Array.from({length:200},()=>({id:'1'})),205)}),/EXPORT_CHANGED/)});
import { collectAdminRows } from '../src/lib/admin-paged-read.mjs';
test('complete summary reads all 1205 records beyond the old 100-row sample',async()=>{
 const original=Array.from({length:1205},(_,i)=>({id:String(i),stock:i===1204?1:0}));
 const result=await collectAdminRows(async({limit,offset})=>({rows:original.slice(offset,offset+limit),total:original.length}),{key:row=>row.id});assert.equal(result.rows.length,1205);assert.equal(result.rows.reduce((sum,r)=>sum+r.stock,0),1);
});
test('summary rejects changed counts and duplicated pages rather than presenting sample totals',async()=>{
 await assert.rejects(collectAdminRows(async({offset})=>({rows:Array.from({length:200},(_,i)=>({id:String(i)})),total:offset?201:205})),/DATASET_CHANGED/);
 await assert.rejects(collectAdminRows(async({offset})=>({rows:Array.from({length:offset?5:200},(_,i)=>({id:String(i)})),total:205}),{key:r=>r.id}),/DATASET_INCOMPLETE/);
});
