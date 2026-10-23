// Isolated PostgreSQL 17 integration/concurrency tests. Never uses linked config or production credentials.
// EMBEDDED_PG_MODULE points to an optional embedded-postgres@17 installation outside project dependencies.
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
const { default: EmbeddedPostgres } = await import(process.env.EMBEDDED_PG_MODULE || 'embedded-postgres');
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const databaseDir = `/private/tmp/partspro-rma-pg17-${process.pid}`;
const logs=[];
const pg = new EmbeddedPostgres({ databaseDir, port, user:'postgres', password:'synthetic-local-test-only',
  persistent:false, postgresFlags:['-h','127.0.0.1','-k',databaseDir],
  onLog: message => logs.push(String(message)), onError: message => logs.push(String(message)) });
const clients=[];
try {
 await pg.initialise(); await pg.start();
 const client = pg.getPgClient('postgres','127.0.0.1');clients.push(client);await client.connect();
 const version=(await client.query('show server_version_num')).rows[0].server_version_num;
 assert.equal(String(version).slice(0,2),'17','match production PostgreSQL major');
 const harness=readFileSync('scripts/rma-v4-db-test.mjs','utf8');
 await client.query(harness.split('sql(`')[1].split('`);')[0]);
 await client.query('set search_path=public,extensions');
 let count=0;
 for(const filename of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) {
  if (/^(202607(19233322|20001643)|20260808(111643|115853))_/.test(filename)) continue;
  if (filename.includes('simplify_rma_refunds_and_customer_wallets')) {
    await client.query(`insert into public.customers(id,company_name,status,customer_type,assignment_status)
      values('90000000-0000-4000-8000-000000000001','Existing balance fixture','active','wholesale','assigned'),
            ('90000000-0000-4000-8000-000000000002','Missing wallet fixture','active','wholesale','assigned');
      insert into public.customer_wallets(customer_id,balance) values('90000000-0000-4000-8000-000000000001',42);`);
  }
  const source=readFileSync(`supabase/migrations/${filename}`,'utf8').replace(/create extension if not exists pg_cron;/gi,'');
  try { await client.query(source); count++; } catch(error) {throw new Error(`Migration ${filename}: ${error.message}`);}
 }
 console.log(`Applied ${count} migrations to isolated PostgreSQL ${version}`);
 const opening=(await client.query("select customer_id,balance from public.customer_wallets where customer_id::text like '90000000-%' order by customer_id")).rows;
 assert.deepEqual(opening.map(row=>Number(row.balance)),[42,0],'backfill preserves existing balance and creates zero opening wallet');
 assert.equal(Number((await client.query("select count(*) n from public.customer_wallet_transactions where customer_id::text like '90000000-%'")).rows[0].n),0,'backfill creates no fictitious funds');
 const setup=readFileSync('tests/rma-v4-database-integration.sql','utf8').split('do $$ declare r uuid;')[0];
 await client.query(setup+readFileSync('tests/rma-simple-refund-integration.sql','utf8'));
 console.log('Refund, receipt, waiver, permission, historical compatibility and rollback assertions passed');
 await client.query(setup+'commit;');
 const actor='10000000-0000-4000-8000-000000000001';
 const connection = async () => {const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();return c;};
 const first=await connection(),second=await connection();
 const authenticated=async(c,sql,args=[])=>{
  try {await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await c.query('set local role authenticated');
   const result=await c.query(sql,args);await c.query('commit');return result;
  } catch(error) {await c.query('rollback');throw error;}
 };
 const make=async()=>{await client.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);return (await client.query("select pg_temp.make_rma(1,'pending','wallet_credit','approved') id")).rows[0].id;};
 const execute='select (public.admin_perform_rma_simple_action_v1($1,\'execute_refund\',$2::jsonb,$3)).id';
 const wallet=JSON.stringify({refund_method:'wallet_credit',refund_amount:10});
 const cash=JSON.stringify({refund_method:'cash',refund_amount:10,cash_paid:true});
 let r=await make();
 await Promise.all([authenticated(first,execute,[r,wallet,'concurrent-same-key']),authenticated(second,execute,[r,wallet,'concurrent-same-key'])]);
 assert.equal(Number((await client.query("select count(*) n from public.customer_wallet_transactions where metadata->>'rma_request_id'=$1",[r])).rows[0].n),1,'same-key concurrent refund credits once');
 r=await make();
 const race=await Promise.allSettled([authenticated(first,execute,[r,cash,'concurrent-cash-key']),authenticated(second,execute,[r,wallet,'concurrent-wallet-key'])]);
 assert.equal(race.filter(x=>x.status==='fulfilled').length,1,'only one cash/wallet outcome wins');
 const row=(await client.query('select refund_method,refund_gross_amount from public.rma_requests where id=$1',[r])).rows[0];
 assert.equal(Number(row.refund_gross_amount),10);
 const creditCount=Number((await client.query("select count(*) n from public.customer_wallet_transactions where metadata->>'rma_request_id'=$1",[r])).rows[0].n);
 assert.equal(creditCount,row.refund_method==='cash'?0:1);
 assert.equal(Number((await client.query("select count(*) n from public.admin_audit_events where action='rma.execute_refund' and entity_id=$1",[r])).rows[0].n),1,'exactly one audit settlement');
 // An old approval racing the unified action must never create two financial outcomes.
 r=(await client.query("select pg_temp.make_rma(1,'failed','wallet_credit','received') id")).rows[0].id;
 await authenticated(first,"select public.admin_perform_rma_action_v4($1,'request_wallet_refund','{\"refund_amount\":10}','legacy-pending-race')",[r]);
 const pending=(await client.query('select wallet_refund_request_id id from public.rma_requests where id=$1',[r])).rows[0].id;
 await Promise.allSettled([
  authenticated(first,"select public.admin_approve_wallet_refund_request($1,'Synthetic old approval')",[pending]),
  authenticated(second,execute,[r,cash,'new-cash-vs-legacy']),
 ]);
 const outcome=(await client.query('select refund_method,refund_completed_at from public.rma_requests where id=$1',[r])).rows[0];
 const countCredits=Number((await client.query("select count(*) n from public.customer_wallet_transactions where order_line_id=(select order_line_id from public.rma_requests where id=$1) and direction='credit'",[r])).rows[0].n);
 assert.equal(countCredits,outcome.refund_method==='cash'?0:1,'legacy approval and unified cash cannot both pay');
 console.log('Two authenticated connections: same-key retry credits once; cash/wallet and legacy-approval races produce one settlement');
} catch(error) { console.error(error.message); console.error(logs.slice(-6).join('\n')); process.exitCode=1;
} finally { await Promise.allSettled(clients.map(c=>c.end())); await pg.stop(); }
