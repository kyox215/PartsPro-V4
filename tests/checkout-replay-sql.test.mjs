import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PARTSPRO_PGLITE_MODULE||'/private/tmp/partspro-admin-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js'));
let db;const actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',customer='33333333-3333-4333-8333-333333333333';
const intent={companyId:customer,items:[{sku:'SKU-001',quantity:2}],paymentMethod:'bank_transfer',preorderTermsAccepted:true};
const payload={p_customer_id:customer,p_lines:[{sku_code:'SKU-001',quantity:2,unit_net:6.25}],p_shipping:6.5,p_shipping_method:'express',p_fiscal:{wallet_requested_amount:3}};
async function create(id,kind='stock',i=intent,p=payload){return (await db.query('select public.create_checkout_order_once($1,$2,$3,$4) as result',[id,i,kind,p])).rows[0].result;}
async function read(id,i=null){return (await db.query('select public.checkout_submission_result($1,$2) as result',[id,i])).rows[0].result;}
async function count(table){return (await db.query(`select count(*)::int as n from ${table}`)).rows[0].n;}
async function uid(id){await db.query("select set_config('test.uid',$1,false)",[id??'']);}
before(async()=>{db=new PGlite();await db.exec(readFileSync(new URL('./checkout-replay-fixture.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../supabase/migrations/20261010215007_checkout_request_replay.sql',import.meta.url),'utf8'));await uid(actor);});
after(async()=>{await db?.close()});
test('same frozen request replays original receipt and business side effect exactly once',async()=>{
 const id='44444444-4444-4444-8444-444444444444';const first=await create(id);const replay=await create(id,'stock',{...intent},{...payload,p_shipping:99,p_fiscal:{wallet_requested_amount:0}});
 assert.equal(first.replayed,false);assert.equal(replay.replayed,true);assert.deepEqual(replay.data,first.data);assert.equal(first.data.totals.total.cents,1900);assert.equal(first.data.payableAmount,16);assert.equal(first.data.lines[0].quantity,2);assert.equal(await count('orders'),1);assert.equal(await count('test_effects'),1);
 assert.deepEqual((await read(id,intent)).data,first.data);
 await assert.rejects(create(id,'stock',{...intent,paymentMethod:'cash'}),e=>e.code==='22023');
 await assert.rejects(read(id,{...intent,paymentMethod:'cash'}),e=>e.code==='22023');
});
test('business or receipt insertion failure rolls back order and side effects atomically',async()=>{
 const id='55555555-5555-4555-8555-555555555555',before=await count('orders');
 await assert.rejects(create(id,'stock',intent,{...payload,p_fiscal:{force_error:true}}),e=>e.code==='23514');assert.equal(await count('orders'),before);assert.equal((await read(id)).state,'not_found');
 await db.exec("create function fail_receipt() returns trigger language plpgsql as $$begin raise exception 'Synthetic receipt failure';end;$$;create trigger fail_receipt before insert on private.checkout_submissions for each row execute function fail_receipt();");
 await assert.rejects(create(id));assert.equal(await count('orders'),before);assert.equal(await count('test_effects'),before);await db.exec('drop trigger fail_receipt on private.checkout_submissions');
 assert.equal((await create(id)).state,'created');
});
test('actor scope, exact staff permissions, and private table ACL fail closed',async()=>{
 const id='44444444-4444-4444-8444-444444444444';await uid(other);assert.equal((await read(id)).state,'not_found');
 await assert.rejects(create('66666666-6666-4666-8666-666666666666'),e=>e.code==='42501');
 await db.exec("select set_config('test.permissions','orders.manage',false)");await assert.rejects(create('66666666-6666-4666-8666-666666666666'),e=>e.code==='42501');
 await db.exec("select set_config('test.permissions','orders.manage,customers.read',false)");assert.equal((await create('66666666-6666-4666-8666-666666666666')).state,'created');await db.exec("select set_config('test.permissions','',false)");await assert.rejects(read('66666666-6666-4666-8666-666666666666'),e=>e.code==='42501');
 await uid(actor);await db.exec('set role authenticated');await assert.rejects(db.query('select * from private.checkout_submissions'),e=>e.code==='42501');assert.equal((await read(id)).state,'created');await db.exec('reset role;set role anon');await assert.rejects(read(id),e=>e.code==='42501');await db.exec('reset role');await uid(null);await assert.rejects(read(id),e=>e.code==='42501');await uid(actor);
});
test('customer or line mismatch and missing preorder terms reject before creation',async()=>{
 const before=await count('orders');const id='77777777-7777-4777-8777-777777777777';
 await assert.rejects(create(id,'stock',{...intent,companyId:other}),e=>e.code==='22023');await assert.rejects(create(id,'stock',{...intent,items:[{sku:'SKU-001',quantity:3}]}),e=>e.code==='22023');await assert.rejects(create(id,'preorder',{...intent,preorderTermsAccepted:false}),e=>e.code==='22023');assert.equal(await count('orders'),before);
 const pre=await create(id,'preorder');assert.equal(pre.data.orderKind,'preorder');assert.equal((await create(id,'preorder')).replayed,true);
});

test('terminal stop before delayed preflight blocks every late original create; existing success cannot be stopped',async()=>{
 const id='99999999-9999-4999-8999-999999999999',before=await count('orders');
 const stop=await db.query('select public.cancel_checkout_submission($1,$2) as result',[id,intent]);assert.equal(stop.rows[0].result.state,'cancelled');
 await assert.rejects(create(id),e=>e.code==='P0002');assert.equal(await count('orders'),before);assert.equal((await read(id)).state,'cancelled');
 const saved=await db.query('select public.cancel_checkout_submission($1,$2) as result',['44444444-4444-4444-8444-444444444444',intent]);assert.equal(saved.rows[0].result.state,'created');
 await uid(other);await assert.rejects(db.query('select public.cancel_checkout_submission($1,$2)',[id,intent]),e=>e.code==='42501');await uid(actor);
});
