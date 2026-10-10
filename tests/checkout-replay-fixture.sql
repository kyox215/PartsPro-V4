-- Synthetic dependencies for executable wrapper tests, never production data.
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;end;$$;
create schema auth; create schema private;
create table auth.users(id uuid primary key);
create table public.customers(id uuid primary key,user_id uuid);
create table public.customer_memberships(customer_id uuid,user_id uuid,status text);
create table public.orders(id uuid primary key default gen_random_uuid(), order_no text, customer_id uuid, status text default 'submitted', created_at timestamptz default now(),total_net numeric default 12.50,vat numeric default 0,shipping numeric default 6.50,wallet_applied_amount numeric default 0);
create table public.order_lines(id uuid primary key default gen_random_uuid(),order_id uuid,sku_code text,quantity int,unit_price numeric);
create table public.test_effects(order_id uuid,kind text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function private.partspro_has_permission(p text) returns boolean language sql stable as $$select coalesce(p=any(string_to_array(current_setting('test.permissions',true),',')),false)$$;
create function public.create_order_transaction(p_lines jsonb,p_customer_id uuid,p_delivery_address text,p_customer_note text,p_shipping_method text,p_shipping numeric,p_fiscal jsonb,p_vat_rate numeric) returns uuid language plpgsql as $$
declare v_id uuid:=gen_random_uuid();begin
 if coalesce((p_fiscal->>'force_error')::boolean,false) then raise exception 'Synthetic business rejection' using errcode='23514';end if;
 insert into public.orders(id,order_no,customer_id,shipping,wallet_applied_amount) values(v_id,'PP-'||v_id,p_customer_id,p_shipping,coalesce((p_fiscal->>'wallet_requested_amount')::numeric,0));
 insert into public.order_lines(order_id,sku_code,quantity,unit_price) select v_id,x->>'sku_code',(x->>'quantity')::int,coalesce((x->>'unit_net')::numeric,6.25) from jsonb_array_elements(p_lines) x;
 insert into public.test_effects values(v_id,'stock-wallet-inventory');return v_id;end;$$;
create function public.create_preorder_transaction(p_lines jsonb,p_customer_id uuid,p_delivery_address text,p_customer_note text,p_shipping_method text,p_shipping numeric,p_fiscal jsonb,p_terms_accepted boolean) returns uuid language plpgsql as $$declare v_id uuid;begin
 v_id:=public.create_order_transaction(p_lines,p_customer_id,p_delivery_address,p_customer_note,p_shipping_method,p_shipping,p_fiscal,0);
 update public.test_effects set kind='preorder' where order_id=v_id;return v_id;end;$$;
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.customers values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
grant usage on schema public,auth to authenticated;
