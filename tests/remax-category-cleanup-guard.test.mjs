import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const nodes=['Audio','Batterie esterne','Caricatori','Cavi dati'].map((value,index)=>({id:String(index),kind:'category',value,nameZh:value,nameIt:value,position:0,active:true,version:1}));
const changes=Array.from({length:9},(_,index)=>({sku:`REMAX-${index}`,model:index===8?'RT-F13':'Fixture',updatedAt:'2026-10-17T10:00:00.123456Z',from:index===8?'Accessori':'Batterie',to:index===8?'Raffreddatori':'Batterie esterne'}));
const manifest={projectRef:'yiuxrjqexlfjtxxrkqvi',projectName:'PartsPro-V4',baselineProductCount:37,changes,nodesBefore:nodes,nodes:[...nodes,{kind:'category',value:'Raffreddatori',active:true}],productSnapshot:changes.map(row=>({sku_code:row.sku,category:row.from,updated_at:row.updatedAt}))};
function run(value,apply=false){const dir=mkdtempSync(path.join(tmpdir(),'remax-cleanup-guard-'));try{const file=path.join(dir,'manifest.json');writeFileSync(file,JSON.stringify(value));const deny=path.join(dir,'deny.mjs');writeFileSync(deny,"globalThis.fetch=()=>{throw new Error('UNEXPECTED_NETWORK')}");const env={...process.env};delete env.PARTSPRO_APPROVED_CHANGE;delete env.PARTSPRO_ADMIN_COOKIE;return spawnSync(process.execPath,['--import',deny,'scripts/apply-remax-category-cleanup.mjs',`--manifest=${file}`,...(apply?['--apply']:[])],{env,encoding:'utf8'});}finally{rmSync(dir,{recursive:true,force:true});}}
test('default mode validates and previews offline without approval or network',()=>{assert.equal(run(manifest).status,0);});
test('apply cannot reach the network without the exact approval',()=>{const result=run(manifest,true);assert.notEqual(result.status,0);assert.match(result.stderr,/must be approved/);assert.doesNotMatch(result.stderr,/UNEXPECTED_NETWORK/);});
test('another project or a widened classification scope fails before network',()=>{for(const value of [{...manifest,projectRef:'another-project'},{...manifest,changes:changes.map(row=>({...row,from:'Accessori'}))},{...manifest,nodes:manifest.nodes.map(node=>({...node,kind:'brand'}))}]){const result=run(value);assert.notEqual(result.status,0);assert.doesNotMatch(result.stderr,/UNEXPECTED_NETWORK/);}});
