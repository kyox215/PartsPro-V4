// Isolated PostgreSQL integration harness. Never connects to linked Supabase.
// Usage: node scripts/rma-v4-db-test.mjs [dedicated-local-container]
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
const container = process.argv[2] ?? 'partspro-rma-v4-test-20260926';
if (!/^partspro-rma-v4-test-[a-z0-9-]+$/.test(container)) throw Error('Dedicated RMA test container required');
const database = `rma_v4_${Date.now()}`;
function docker(args, input) { const r=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:20*1024*1024}); if(r.status!==0) throw Error(r.stderr||r.stdout); return r.stdout; }
const state=JSON.parse(docker(['inspect',container]))[0];
if(state.HostConfig.NetworkMode!=='none'||state.Mounts.some(m=>m.Type!=='volume'||! /^[a-f0-9]{64}$/.test(m.Name))) throw Error('Test requires no network and no mounted data');
docker(['exec',container,'createdb','-U','postgres',database]);
docker(['exec',container,'psql','-U','postgres','-d',database,'-c',`alter database ${database} set search_path=public,extensions;`]);
const sql=(s)=>docker(['exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],s);
sql(`do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon; create role authenticated; create role service_role bypassrls; create role supabase_admin superuser; end if; end $$;
create schema auth; create schema storage; create schema extensions; create schema cron;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',created_at timestamptz default now(),last_sign_in_at timestamptz,phone text,deleted_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
create function auth.email() returns text language sql stable as $$ select ''::text $$;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
create function storage.extension(text) returns text language sql immutable as $$ select split_part($1,'.',2) $$;
create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
create publication supabase_realtime;
`);
let count=0;
for(const filename of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) {
 if (/^(202607(19233322|20001643)|20260808(111643|115853))_/.test(filename)) { console.log(`Skipped catalog-only production data migration ${filename}`); continue; }
 let source=readFileSync(`supabase/migrations/${filename}`,'utf8');
 // Only the scheduling extension is unavailable in vanilla PG. Its function
 // is stubbed above; all business SQL, constraints, triggers and RLS are real.
 source=source.replace(/create extension if not exists pg_cron;/gi,'');
 try { sql(source); count++; } catch(e){ console.error(`FAILED ${filename}\n${e.message}`); process.exit(1); }
}
console.log(`Applied ${count} migrations to isolated PostgreSQL database ${database}`);
if(process.env.RMA_V4_FIXTURE) { sql(readFileSync(process.env.RMA_V4_FIXTURE,'utf8')); console.log('All RMA v4 SQL integration assertions passed.'); }
if (process.env.RMA_V4_FIXTURE) {
  const fixture=readFileSync(process.env.RMA_V4_FIXTURE,'utf8');
  const setup=fixture.split('do $$ declare r uuid;')[0];
  sql(setup+`do $$ declare r uuid:=pg_temp.make_rma(); begin update public.rma_requests set rma_no='RMA-CONCURRENCY' where id=r; end $$; commit;`);
  const getId=(query)=>sql(query).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)[0];
  const rid=getId(`select id from public.rma_requests where rma_no='RMA-CONCURRENCY';`);
  const runConcurrent=(source)=>new Promise((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],{stdio:['pipe','pipe','pipe']});
    let error=''; child.stderr.on('data',d=>error+=d); child.stdout.resume(); child.on('error',reject); child.on('close',code=>code===0?resolve():reject(Error(error))); child.stdin.end(source);
  });
  const auth=`select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true); set local role authenticated;`;
  const request=`select (public.admin_perform_rma_action_v4('${rid}','request_wallet_refund','{"refund_amount":10}','concurrent-request')).id;`;
  await Promise.all([
    runConcurrent(`begin; select id from public.rma_requests where id='${rid}' for update; select pg_sleep(0.2); ${auth} ${request} commit;`),
    runConcurrent(`begin; ${auth} ${request} commit;`),
  ]);
  const wid=getId(`select id from public.wallet_refund_requests where rma_request_id='${rid}';`);
  const approve=`select public.admin_approve_wallet_refund_request('${wid}','Concurrent approval');`;
  await Promise.all([runConcurrent(`begin; ${auth} ${approve} commit;`),runConcurrent(`begin; ${auth} ${approve} commit;`)]);
  sql(`do $$ begin
    if (select count(*) from public.wallet_refund_requests where rma_request_id='${rid}')<>1 then raise exception 'Concurrent requests duplicated money request'; end if;
    if (select count(*) from public.customer_wallet_transactions where metadata->>'wallet_refund_request_id'='${wid}')<>1 then raise exception 'Concurrent approvals duplicated wallet credit'; end if;
    if (select refund_gross_amount from public.rma_requests where id='${rid}')<>10 then raise exception 'Concurrent refund amount incorrect'; end if;
  end $$;`);
  console.log('Concurrent authenticated requests and approvals produced exactly one wallet credit.');
}
console.log(`Database retained in dedicated container ${container} for follow-up checks.`);
