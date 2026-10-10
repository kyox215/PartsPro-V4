// Real multi-connection PostgreSQL test in a task-owned, network-none container.
// Dependencies/auth are synthetic; this is not a production JWT/payment test.
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFile,spawn} from 'node:child_process';import {promisify} from 'node:util';
const run=promisify(execFile),container='partspro-checkout-ux-sql-20261011',testDb=`partspro_checkout_${process.pid}`;
async function sql(query){return (await run('docker',['exec','-i',container,'psql','-U','postgres','-d',testDb,'-v','ON_ERROR_STOP=1','-At','-c',query],{maxBuffer:1024*1024})).stdout.trim();}
const actor='11111111-1111-4111-8111-111111111111',customer='33333333-3333-4333-8333-333333333333',id='88888888-8888-4888-8888-888888888888';
const intent=JSON.stringify({companyId:customer,items:[{sku:'SKU-001',quantity:2}],paymentMethod:'bank_transfer',preorderTermsAccepted:true});
const payload=JSON.stringify({p_customer_id:customer,p_lines:[{sku_code:'SKU-001',quantity:2}],p_shipping:6.5,p_fiscal:{wallet_requested_amount:3}});
const call=`select public.create_checkout_order_once('${id}','${intent}'::jsonb,'stock','${payload}'::jsonb)`;
before(async()=>{await run('docker',['exec',container,'createdb','-U','postgres',testDb]);await sql(readFileSync(new URL('./checkout-replay-fixture.sql',import.meta.url),'utf8'));await sql(readFileSync(new URL('../supabase/migrations/20261010215007_checkout_request_replay.sql',import.meta.url),'utf8'));});
test('one in-flight transaction reports pending; four concurrent retries wait and replay one order',async()=>{
 let output='';const first=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',testDb,'-v','ON_ERROR_STOP=1','-At','-c',`begin;select set_config('test.uid','${actor}',false);${call};select pg_sleep(3);commit;`]);first.stdout.on('data',chunk=>output+=chunk);const completion=new Promise((resolve,reject)=>{first.on('error',reject);first.on('exit',code=>code===0?resolve():reject(new Error('First transaction failed')));});
 let ready=false;for(let i=0;i<40;i++){if(Number(await sql("select count(*) from pg_locks where locktype='advisory' and granted"))>0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}assert.equal(ready,true);
 const pending=await sql(`select set_config('test.uid','${actor}',false);select public.checkout_submission_result('${id}',null)`);assert.match(pending,/"state": "pending"/);
 const replies=await Promise.all(Array.from({length:4},()=>sql(`select set_config('test.uid','${actor}',false);${call}`)));await completion;
 for(const reply of replies)assert.match(reply,/"replayed": true/);
 assert.equal(await sql('select count(*) from orders'), '1');assert.equal(await sql('select count(*) from test_effects'),'1');assert.equal(await sql('select count(*) from private.checkout_submissions'),'1');
});

after(async()=>{await run('docker',['exec',container,'dropdb','-U','postgres',testDb]);});

test('cancel waits for an in-flight create and returns the committed receipt',async()=>{
 const request='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',statement=call.replaceAll(id,request);
 const first=sql(`begin;select set_config('test.uid','${actor}',false);${statement};select pg_sleep(2);commit;`);
 let ready=false;for(let i=0;i<40;i++){if(Number(await sql("select count(*) from pg_locks where locktype='advisory' and granted"))>0){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,50));}assert.equal(ready,true);
 const cancelled=await sql(`select set_config('test.uid','${actor}',false);select public.cancel_checkout_submission('${request}','${intent}'::jsonb)`);await first;assert.match(cancelled,/"state": "created"/);assert.equal(await sql(`select count(*) from private.checkout_cancellations where request_id='${request}'`),'0');
});
test('committed stop marker prevents late preflight create on another connection',async()=>{
 const request='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',before=await sql('select count(*) from orders');
 const stopped=await sql(`select set_config('test.uid','${actor}',false);select public.cancel_checkout_submission('${request}','${intent}'::jsonb)`);assert.match(stopped,/"state": "cancelled"/);
 await assert.rejects(sql(`select set_config('test.uid','${actor}',false);${call.replaceAll(id,request)}`),e=>e.stderr.includes('Submission cancelled'));
 assert.equal(await sql('select count(*) from orders'),before);assert.equal(await sql('select count(*) from test_effects'),before);
});
