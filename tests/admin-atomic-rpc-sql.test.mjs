// Run with PARTSPRO_PGLITE_MODULE pointing to an isolated PGlite install.
// Uses real project table definitions, synthetic auth/permission fixtures, and
// PostgreSQL execution. It does not validate Supabase JWTs or production RLS.
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(process.env.PARTSPRO_PGLITE_MODULE || '/tmp/partspro-admin-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js'));
let db;
const actor='22222222-2222-4222-8222-222222222222',customer='33333333-3333-4333-8333-333333333333',conversation='11111111-1111-4111-8111-111111111111';
const source=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
function table(sql,name){const start=sql.indexOf('create table if not exists public.'+name+' (');assert.notEqual(start,-1,name);return sql.slice(start,sql.indexOf('\n);',start)+3);}
async function permissions(value){await db.query("select set_config('test.permissions',$1,false)",[value]);}
async function call(name,args){const marks=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query(`select public.${name}(${marks}) as data`,args)).rows[0].data;}
async function scalar(sql,args=[]){return Object.values((await db.query(sql,args)).rows[0])[0];}
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
 create table auth.users(id uuid primary key); create table public.customers(id uuid primary key); create table public.products(sku_code text primary key); create table public.profiles(id uuid primary key,account_type text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create function private.partspro_assert_permission(p text) returns void language plpgsql as $$ begin if not(p=any(string_to_array(current_setting('test.permissions',true),','))) then raise exception 'Permission denied' using errcode='42501'; end if; end $$;
 grant usage on schema auth,public to authenticated;
 insert into auth.users values('${actor}'),('${customer}'); insert into public.profiles values('${actor}','employee'),('${customer}','customer');
 select set_config('test.uid','${actor}',false); select set_config('test.permissions','support.read,support.reply,support.assign,support.resolve,finance.read',false);`);
 const support=source('20260628003335_support_conversations_v1.sql'),supply=source('20260604084433_supplier_batch_management.sql'),finance=source('20260701210603_admin_finance_ledger.sql');
 for(const name of ['support_conversations','support_messages','support_conversation_events'])await db.exec(table(support,name));
 for(const name of ['suppliers','supplier_batches','supplier_batch_lines'])await db.exec(table(supply,name));
 await db.exec(table(finance,'supplier_batch_payments'));
 const marketplace=source('20260604185042_marketplace_ebay_automation.sql');await db.exec(table(marketplace,'marketplace_sync_jobs'));await db.exec("create unique index marketplace_sync_jobs_idempotency_idx on marketplace_sync_jobs(provider,marketplace_id,idempotency_key) where idempotency_key is not null");
 await db.exec(source('20261010204858_admin_support_atomic_reply.sql'));
 await db.query('insert into support_conversations(id,user_id,staff_unread_count) values($1,$2,3)',[conversation,customer]);
});
after(async()=>{await db?.close()});
test('SQL reply atomically inserts message, clears staff unread, claims conversation and emits exactly one message event; retry is idempotent',async()=>{
 const message='44444444-4444-4444-8444-444444444444';await permissions('support.reply,support.read,support.assign,support.resolve');
 await db.exec('set role authenticated');
 const first=await call('admin_send_support_message_atomic',[conversation,' Synthetic SQL reply ',message]);assert.equal(first.created,true);
 const retry=await call('admin_send_support_message_atomic',[conversation,'Synthetic SQL reply',message]);assert.equal(retry.created,false);await db.exec('reset role');
 assert.equal(await scalar('select count(*)::int from support_messages'),1);assert.equal(await scalar("select count(*)::int from support_conversation_events where event_type='staff_message'"),1);
 const state=(await db.query('select customer_unread_count,staff_unread_count,assigned_to,assigned_by,assigned_at from support_conversations where id=$1',[conversation])).rows[0];assert.equal(state.customer_unread_count,1);assert.equal(state.staff_unread_count,0);assert.equal(state.assigned_to,actor);assert.equal(state.assigned_by,actor);assert.ok(state.assigned_at);
 await assert.rejects(call('admin_send_support_message_atomic',[conversation,'Different',message]),e=>e.code==='23505');
});
test('SQL event insert failure rolls back the message and unread update together',async()=>{
 const message='55555555-5555-4555-8555-555555555555';await permissions('support.reply');
 await db.query("insert into support_conversation_events(id,conversation_id,event_type) values($1,$2,'system_note')",[message,conversation]);
 await assert.rejects(call('admin_send_support_message_atomic',[conversation,'Must rollback',message]),e=>e.code==='23505');
 assert.equal(await scalar('select count(*)::int from support_messages where id=$1',[message]),0);assert.equal(await scalar('select customer_unread_count from support_conversations where id=$1',[conversation]),1);
});
test('SQL denies anonymous, missing permission, NULL/unknown state action and unauthorized resolve/reopen without any change',async()=>{
 await permissions('support.read');
 for(const action of [null,'unknown','resolve','reopen'])await assert.rejects(call('admin_update_support_conversation_atomic',[conversation,action,null,null]),e=>['23514','42501'].includes(e.code));
 assert.equal(await scalar('select status from support_conversations where id=$1',[conversation]),'open');
 await assert.rejects(call('admin_send_support_message_atomic',[conversation,'Denied','66666666-6666-4666-8666-666666666666']),e=>e.code==='42501');
 await db.query("select set_config('test.uid','',false)");await assert.rejects(call('admin_send_support_message_atomic',[conversation,'Denied','66666666-6666-4666-8666-666666666666']),e=>e.code==='28000');await db.query("select set_config('test.uid',$1,false)",[actor]);
 const grants=await db.query("select has_function_privilege('anon','public.admin_send_support_message_atomic(uuid,text,uuid)','execute') as anon,has_function_privilege('authenticated','public.admin_send_support_message_atomic(uuid,text,uuid)','execute') as staff");assert.equal(grants.rows[0].anon,false);assert.equal(grants.rows[0].staff,true);
});
test('SQL assignment rejects non-employee, resolve/reopen require correct state, and state event failure rolls back',async()=>{
 await permissions('support.read,support.assign,support.resolve');
 await assert.rejects(call('admin_update_support_conversation_atomic',[conversation,'assign',customer,'Invalid']),e=>e.code==='23514');
 assert.equal(await scalar('select assigned_to from support_conversations where id=$1',[conversation]),actor);
 await call('admin_update_support_conversation_atomic',[conversation,'resolve',null,'Done']);assert.equal(await scalar('select status from support_conversations where id=$1',[conversation]),'resolved');
 await assert.rejects(call('admin_update_support_conversation_atomic',[conversation,'resolve',null,null]),e=>e.code==='23514');
 await permissions('support.read');await assert.rejects(call('admin_update_support_conversation_atomic',[conversation,null,null,null]),e=>e.code==='23514');assert.equal(await scalar('select status from support_conversations where id=$1',[conversation]),'resolved');
 await permissions('support.read,support.resolve');await call('admin_update_support_conversation_atomic',[conversation,'reopen',null,null]);
 await db.exec("create function public.test_reject_event() returns trigger language plpgsql as $$ begin if new.event_type='resolved' then raise exception 'Synthetic event failure'; end if; return new; end $$; create trigger test_event_failure before insert on support_conversation_events for each row execute function public.test_reject_event();");
 await assert.rejects(call('admin_update_support_conversation_atomic',[conversation,'resolve',null,null]));assert.equal(await scalar('select status from support_conversations where id=$1',[conversation]),'open');await db.exec('drop trigger test_event_failure on support_conversation_events');
});
test('finance-only SQL reader aggregates 1205 batch lines and 1205 payments completely, paginates old batches, and excludes pending payments',async()=>{
 const supplier='77777777-7777-4777-8777-777777777777',batch='88888888-8888-4888-8888-888888888888';
 await db.query("insert into suppliers(id,code,name,display_label) values($1,'SYNTHETIC','Synthetic supplier','Synthetic supplier')",[supplier]);
 await db.query("insert into supplier_batches(id,batch_code,supplier_id) values($1,'OLD-TEST',$2)",[batch,supplier]);
 await db.query("insert into supplier_batch_lines(batch_id,line_no,name,qty_received,line_total) select $1,n,'Synthetic',1,2 from generate_series(1,1205)n",[batch]);
 await db.query("insert into supplier_batch_payments(batch_id,amount_net,amount_gross,status) select $1,1,1,'paid' from generate_series(1,1205)n",[batch]);await db.query("insert into supplier_batch_payments(batch_id,amount_net,amount_gross,status) values($1,999,999,'pending')",[batch]);
 await permissions('finance.read');await db.exec('set role authenticated');const result=await call('admin_finance_supplier_batch_options',['OLD','Synthetic',20,0]);await db.exec('reset role');assert.equal(result.total,1);assert.equal(result.batches[0].paidNet,1205);assert.equal(result.batches[0].outstandingNet,1205);assert.equal(result.batches[0].costBasis,'confirmed_net');assert.equal('metadata' in result.batches[0],false);
 for(let i=0;i<24;i++)await db.query("insert into supplier_batches(batch_code,supplier_id) values($1,$2)",['NEW-'+i,supplier]);
 const page=await call('admin_finance_supplier_batch_options',[null,null,20,20]);assert.equal(page.total,25);assert.equal(page.batches.length,5);assert.equal(await scalar('select count(*)::int from supplier_batch_lines'),1205);
 await db.query("update supplier_batches set vat_mode='IVA inclusa' where id=$1",[batch]);const unknown=await call('admin_finance_supplier_batch_options',['OLD',null,20,0]);assert.equal(unknown.batches[0].outstandingNet,null);assert.equal(unknown.batches[0].costBasis,'estimated');
 await permissions('support.read');await assert.rejects(call('admin_finance_supplier_batch_options',[null,null,20,0]),e=>e.code==='42501');
});

test('existing marketplace partial unique index refuses a second logical send after completion without resetting status',async()=>{
 await db.query("insert into marketplace_sync_jobs(job_type,target_sku,idempotency_key,status) values('sync_inventory','SKU-DEMO','sync:logical-send:SKU-DEMO','succeeded')");
 await assert.rejects(db.query("insert into marketplace_sync_jobs(job_type,target_sku,idempotency_key) values('sync_inventory','SKU-DEMO','sync:logical-send:SKU-DEMO')"),e=>e.code==='23505');
 assert.equal(await scalar("select count(*)::int from marketplace_sync_jobs where idempotency_key='sync:logical-send:SKU-DEMO'"),1);assert.equal(await scalar("select status from marketplace_sync_jobs where idempotency_key='sync:logical-send:SKU-DEMO'"),'succeeded');
});
