-- ISOLATED EMPTY POSTGRES ONLY. Minimal fixture, not a production migration.
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
create schema private; create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt',true),''),'{}')::jsonb $$;
create table public.customers(id uuid primary key default gen_random_uuid(),user_id uuid,company_name text,email text,phone text,fiscal_code text,billing_address text,shipping_address text,customer_type text default 'retail',status text default 'active',assignment_status text default 'assigned',profile_kind text default 'customer',level text default 'bronze',tier text default 'bronze',level_source text default 'automatic',lifetime_spend_net numeric default 0,price_group_id text,promo_level text,promo_level_starts_at timestamptz,promo_level_expires_at timestamptz,promo_level_reason text,manual_level_set_by uuid,manual_level_set_at timestamptz,manual_level_reason text,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.products(id uuid primary key default gen_random_uuid(),sku_code text unique,name text,quality_grade text,brand text,category text,status text default 'active',moq integer default 1,b2b_price numeric,retail_price numeric,cost_price numeric,stock_status text,stock_qty integer,batch_code text,location text,updated_at timestamptz default now());
create table public.customer_product_prices(id uuid primary key default gen_random_uuid(),product_id uuid,customer_id uuid,min_quantity integer,unit_price numeric,starts_at timestamptz,ends_at timestamptz,updated_at timestamptz default now());
create table public.price_groups(id text primary key,discount_percent numeric);
create table public.customer_memberships(customer_id uuid,user_id uuid,status text);
create table public.admin_permissions(id text primary key,label text,group_name text,description text);
create table public.admin_role_template_permissions(role_template_id text,permission_id text,primary key(role_template_id,permission_id));
create table public.admin_audit_events(id uuid default gen_random_uuid(),created_at timestamptz default now(),actor_id uuid,entity_id text,action text,before_data jsonb,after_data jsonb,reason text);
create function private.current_customer_id() returns uuid language sql stable as $$ select id from public.customers where user_id=auth.uid() limit 1 $$;
create function private.is_staff() returns boolean language sql stable as $$ select coalesce(current_setting('test.staff',true),'false')='true' $$;
create function private.partspro_has_permission(text) returns boolean language sql stable as $$ select $1=any(string_to_array(coalesce(current_setting('test.permissions',true),''),',')) $$;
create function private.partspro_assert_permission(text) returns void language plpgsql as $$ begin if auth.uid() is null or not private.partspro_has_permission($1) then raise exception 'Permission denied' using errcode='42501'; end if; end $$;
create function private.partspro_audit_admin(text,text,text,jsonb,jsonb,text,jsonb) returns void language sql as $$ insert into public.admin_audit_events(actor_id,action,before_data,after_data,reason) values(auth.uid(),$1,$4,$5,$6) $$;
create function private.is_customer_profile_complete_for_checkout(text,text,text,text,text,text) returns boolean language sql immutable as $$ select $1 is not null and $2 is not null and $3 is not null and $4 is not null and $5 is not null and $6 is not null $$;
grant usage on schema private,public,auth to authenticated;

create or replace function private.normalize_customer_tier(_tier text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(_tier, '')))
    when 'bronze' then 'bronze'
    when 'silver' then 'silver'
    when 'gold' then 'gold'
    when 'emerald' then 'emerald'
    when 'diamond' then 'diamond'
    when 'master' then 'master'
    when 'king' then 'king'
    when 'standard' then 'bronze'
    when 'pro' then 'silver'
    when 'partner' then 'gold'
    else 'bronze'
  end
$$;
create or replace function private.customer_level_for_spend(_spend numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(_spend, 0) >= 50000 then 'king'
    when coalesce(_spend, 0) >= 40200 then 'master'
    when coalesce(_spend, 0) >= 30400 then 'diamond'
    when coalesce(_spend, 0) >= 20600 then 'emerald'
    when coalesce(_spend, 0) >= 10800 then 'gold'
    when coalesce(_spend, 0) >= 1000 then 'silver'
    else 'bronze'
  end
$$;
create or replace function private.customer_level_discount_amount(_level text)
returns numeric
language sql
immutable
as $$
  select case private.normalize_customer_tier(_level)
    when 'king' then 1.50
    when 'master' then 1.25
    when 'diamond' then 1.00
    when 'emerald' then 0.75
    when 'gold' then 0.50
    when 'silver' then 0.25
    else 0.00
  end
$$;
-- Pre-existing RPC signature: CREATE OR REPLACE must preserve every output column.
create function public.resolve_customer_catalog_prices(p_customer_id uuid,p_sku_codes text[]) returns table(id uuid,sku_code text,price numeric,effective_unit_price numeric,base_unit_price numeric,price_source text,customer_level text,price_group_id text,discount_percent numeric,level_discount_percent numeric,level_discount_amount numeric,price_group_discount_percent numeric,margin_percent numeric,price_version text,price_resolved_at timestamptz) language sql as $$ select null::uuid,null::text,null::numeric,null::numeric,null::numeric,null::text,null::text,null::text,null::numeric,null::numeric,null::numeric,null::numeric,null::numeric,null::text,null::timestamptz where false $$;
-- Historical signup promo cleared by the old manual-level RPC; migration must only seed eligibility.
insert into public.customers(id,user_id,company_name,level,tier,level_source)
values('00000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000092','Historical manual','gold','gold','manual');
insert into public.admin_audit_events(entity_id,action,before_data,after_data,created_at)
values('00000000-0000-0000-0000-000000000091','customer.level_update',
'{"promo_level":"king","promo_level_starts_at":"2026-01-31T23:00:00Z","promo_level_expires_at":"2026-04-30T23:00:00Z"}',
'{"level":"gold","promo_level":null}','2026-02-15T12:00:00Z');
-- Represent normal Data API access for the legacy invoker wrapper.
grant select on public.products to authenticated;
