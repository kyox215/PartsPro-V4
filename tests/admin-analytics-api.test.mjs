import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/partspro-vercel-analytics.ts',import.meta.url),'utf8').replace('import "server-only";','');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {readWebsiteAnalytics}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('period visitor count comes from the ungrouped total, not the sum of daily uniques',async()=>{
 const previousFetch=globalThis.fetch; const keys=['VERCEL_ANALYTICS_TOKEN','PARTSPRO_VERCEL_PROJECT_ID','PARTSPRO_VERCEL_TEAM_ID']; const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 keys.forEach(key=>process.env[key]='synthetic-fixture'); const requests=[];
 try {
  globalThis.fetch=async url=>{const query=new URL(url).searchParams;requests.push(query.get('by'));return {ok:true,json:async()=>({data:query.get('by')==='[]'?{pageviews:100,visitors:10}:query.get('by')==='day'?[{timestamp:'2026-10-09T00:00:00Z',pageviews:50,visitors:8},{timestamp:'2026-10-10T00:00:00Z',pageviews:50,visitors:8}]:[]})}};
  const snapshot=await readWebsiteAnalytics(7);assert.equal(snapshot.visitors,10);assert.equal(snapshot.daily.reduce((sum,row)=>sum+row.visitors,0),16);assert.equal(snapshot.pageviews,100);assert.ok(requests.includes('[]'));
  globalThis.fetch=async()=>({ok:true,json:async()=>({data:[{timestamp:'2026-10-10',visitors:10}]})});await assert.rejects(readWebsiteAnalytics(30),/missing or invalid/);
 } finally {globalThis.fetch=previousFetch; for(const key of keys) { if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]; }}
});
