// Dedicated offline Docker fixture only; never accepts a linked/production URL.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
const container=process.argv[2] || 'partspro-catalog-migration-20261010';
if(container!=='partspro-catalog-migration-20261010') throw new Error('Unexpected fixture container');
const args=['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','catalog_final','-v','ON_ERROR_STOP=1'];
function sql(query) {const r=spawnSync('docker',args,{input:query,encoding:'utf8'});if(r.status)throw new Error(r.stderr);return r.stdout.trim();}
function background(query,marker) {
  const child=spawn('docker',args);let stdout='',stderr='',resolveReady;const ready=new Promise(r=>resolveReady=r);
  child.stdout.on('data',b=>{stdout+=b.toString();if(stdout.includes(marker))resolveReady();});child.stderr.on('data',b=>stderr+=b.toString());
  const done=new Promise((resolve,reject)=>child.on('close',code=>code?reject(new Error(stderr)):resolve(stdout)));
  child.stdin.end(query);return {ready:Promise.race([ready,done.then(()=>{throw new Error('Missing fixture marker');})]),done};
}
sql("insert into public.products(sku_code,name,brand,category,catalog_department,status,stock_qty,location,quality_grade) values ('SAFE-LOCK-A','Synthetic lock A','OEM','Connettori','phone','draft',1,'Milano','A'),('SAFE-LOCK-B','Synthetic lock B','OEM','Connettori','phone','draft',1,'Milano','A');");
const before=BigInt(sql('select public.catalog_directory_revision();'));
const a=background("begin; set local lock_timeout='4s'; select id from public.products where sku_code='SAFE-LOCK-A' for update; update public.products set stock_qty=stock_qty+1 where sku_code='SAFE-LOCK-A';\n\\echo A_UPDATED\nselect pg_sleep(1.5); select id from public.products where sku_code='SAFE-LOCK-B' for update; update public.products set stock_qty=stock_qty+1 where sku_code='SAFE-LOCK-B'; commit;",'A_UPDATED');
await a.ready;
assert.equal(BigInt(sql('select public.catalog_directory_revision();')),before,'uncommitted revision stays invisible');
const b=background("begin; set local lock_timeout='4s'; select id from public.products where sku_code='SAFE-LOCK-B' for update; update public.products set stock_qty=stock_qty+1 where sku_code='SAFE-LOCK-B'; commit;\n\\echo B_DONE",'B_DONE');
await b.done;
assert.equal(BigInt(sql('select public.catalog_directory_revision();')),before+1n,'only committed writer counted');
await a.done;
assert.equal(BigInt(sql('select public.catalog_directory_revision();')),before+3n,'all committed statements counted');
const compactBefore=BigInt(sql('select public.catalog_directory_revision();'));
const compact=background("begin; select private.compact_catalog_revision_events(10000);\n\\echo COMPACTED\nselect pg_sleep(1.5); commit;",'COMPACTED');
await compact.ready;
sql("begin; set local lock_timeout='1s'; update public.products set stock_qty=stock_qty+1 where sku_code='SAFE-LOCK-A'; commit;");
assert.equal(BigInt(sql('select public.catalog_directory_revision();')),compactBefore+1n,'writer does not wait for compaction');
await compact.done;
assert.equal(BigInt(sql('select public.catalog_directory_revision();')),compactBefore+1n,'compaction preserves concurrent token');
const result={environment:'Offline Docker with current production schema, synthetic data only',uncommittedInvisible:true,productRowAndRevisionDeadlockAvoided:true,compactionAllowsConcurrentWrites:true,compactionTokenPreserved:true};
await fs.mkdir('outputs/catalog/2026-10-10',{recursive:true});
await fs.writeFile('outputs/catalog/2026-10-10/migration-concurrency.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
