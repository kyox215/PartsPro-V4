// Explicitly approved, version-checked directory cleanup through existing admin APIs.
// Default is offline dry-run. Never put cookies on the command line or in the manifest.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const manifestPath = process.argv.find(arg => arg.startsWith('--manifest='))?.slice(11);
assert(manifestPath, 'Pass --manifest=/absolute/path/to/reviewed-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.projectRef, 'yiuxrjqexlfjtxxrkqvi');
assert.equal(manifest.projectName, 'PartsPro-V4');
assert.equal(manifest.baselineProductCount, 37);
assert.equal(manifest.changes.length, 9);
assert.equal(manifest.changes.filter(row=>row.from==='Batterie').length,8);
assert.equal(manifest.changes.filter(row=>row.from==='Accessori'&&row.model==='RT-F13').length,1);
assert.equal(manifest.nodes.length,5);
assert.deepEqual(manifest.nodes.map(node=>node.value).sort(),['Audio','Batterie esterne','Caricatori','Cavi dati','Raffreddatori']);
for(const node of manifest.nodes){
  assert.equal(node.kind,'category');assert.equal(node.active,true);
  const old=manifest.nodesBefore.find(value=>value.id===node.id);
  if(node.id){assert(old&&old.value===node.value&&old.position===node.position&&old.version===node.version);}
  else assert.equal(node.value,'Raffreddatori');
}
assert.equal(new Set(manifest.changes.map(row => row.sku)).size, 9);
for (const row of manifest.changes) {
  assert.equal(row.to, row.from === 'Batterie' ? 'Batterie esterne' : 'Raffreddatori');
  assert(['Batterie', 'Accessori'].includes(row.from));
  assert(manifest.productSnapshot.some(product => product.sku_code === row.sku && product.category === row.from && product.updated_at === row.updatedAt));
}
console.log(JSON.stringify({target:manifest.projectName, projectRef:manifest.projectRef, mode:process.argv.includes('--apply')?'apply':'offline dry-run', categoryNodes:manifest.nodes.map(node=>({value:node.value,nameZh:node.nameZh,nameIt:node.nameIt})), changes:manifest.changes},null,2));
if (!process.argv.includes('--apply')) process.exit(0);
assert.equal(process.env.PARTSPRO_APPROVED_CHANGE, 'REMAX-CATEGORIES-20261017', 'This exact production change must be approved before applying');
assert(process.env.PARTSPRO_ADMIN_COOKIE, 'A current authorized admin session is required');
const origin = 'https://www.partspro.app';
const journalPath = manifestPath.replace(/\.json$/, '.application.json');
assert(!fs.existsSync(journalPath), 'An application journal already exists. Reconcile it before retrying; do not overwrite');
async function api(path, body) {
  const response = await fetch(origin+path, {method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Cookie:process.env.PARTSPRO_ADMIN_COOKIE,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert(response.ok, `Admin request failed (${response.status}); stop and inspect the journal before retrying`);
  return (await response.json()).data;
}
const directory=await api('/api/admin/catalog-directory');
for (const node of manifest.nodes) {
  const current=directory.nodes.find(value=>value.kind===node.kind&&value.value===node.value);
  if(node.id) assert(current?.id===node.id&&current.version===node.version, `Directory changed: ${node.value}`);
  else assert(!current, `New category already exists: ${node.value}`);
}
const before={};
for(const change of manifest.changes){
  const product=await api('/api/admin/products/'+encodeURIComponent(change.sku));
  assert.equal(product.brand.trim().toUpperCase(),'REMAX');
  assert.equal(product.category,change.from);
  // Compare parsed instants for the GET preflight; the write sends the exact microsecond string.
  assert.equal(Date.parse(product.updatedAt),Date.parse(change.updatedAt));
  before[change.sku]=product;
}
const journal={projectRef:manifest.projectRef,startedAt:new Date().toISOString(),status:'in_progress',completed:[],before};
const save=()=>fs.writeFileSync(journalPath,JSON.stringify(journal,null,2)+'\n',{mode:0o600});
save();
try{
  for(const node of manifest.nodes){await api('/api/admin/catalog-directory',node);journal.completed.push({node:node.value});save();}
  for(const target of ['Batterie esterne','Raffreddatori']){
    const changes=manifest.changes.filter(change=>change.to===target);
    await api('/api/admin/catalog-directory/move',{products:changes.map(change=>({sku:change.sku,updatedAt:change.updatedAt})),target:{category:target},reason:manifest.reason});
    journal.completed.push({moved:changes.map(change=>change.sku),target});save();
  }
  for(const change of manifest.changes){
    const after=await api('/api/admin/products/'+encodeURIComponent(change.sku));
    assert.equal(after.category,change.to);
    for(const key of ['stockQty','b2bPrice','retailPrice','model']) assert.equal(after[key],before[change.sku][key],`Protected field changed: ${change.sku} ${key}`);
  }
  const all=await api('/api/admin/products?brand=REMAX&limit=100');
  assert.equal(all.length,37);
  const counts={};
  for(const product of all) counts[product.category]=(counts[product.category]??0)+1;
  assert.deepEqual(counts,{'Cavi dati':8,'Batterie esterne':16,'Caricatori':2,'Audio':10,'Raffreddatori':1});
  assert.equal(Object.keys(counts).length,5);
  journal.verifiedCounts=counts;
  journal.status='verified';save();console.log('Category changes verified; deployment is a separate action.');
}catch(error){journal.status='needs_reconciliation';save();throw error;}
