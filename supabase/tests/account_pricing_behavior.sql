-- Run only in an isolated database with the migration installed. All checks roll back.
begin;
do $$
declare t timestamptz:='2026-09-27 12:00:00+00'; got text;
begin
 assert exists(select 1 from private.signup_pricing_grants where user_id='00000000-0000-0000-0000-000000000092' and level='king' and granted_at='2026-01-31T23:00:00Z' and expires_at='2026-04-30T23:00:00Z'),'historical before_data seeded';
 assert exists(select 1 from public.customers where id='00000000-0000-0000-0000-000000000091' and level='gold' and level_source='manual' and promo_level is null),'ledger seed leaves customer entitlement unchanged';
 assert private.customer_base_level('king','king',0,'automatic','customer')='bronze','automatic tier follows paid spend';
 assert private.customer_base_level('gold','gold',50000,'manual','customer')='gold','manual tier is the base even below spend tier';
 assert private.customer_base_level('invalid','invalid',10800,'manual','customer')='gold','invalid manual falls back to spend';
 assert private.customer_base_level('master','master',0,'automatic','employee_self')='master','employee stored level retained';
 assert private.customer_effective_level('gold','gold',0,'king',t-interval '1 month',t+interval '1 month',t,'manual','customer')='king','active promo raises manual base';
 assert private.customer_effective_level('king','king',0,'silver',t-interval '1 month',t+interval '1 month',t,'manual','customer')='king','promo never lowers base';
 assert private.customer_effective_level('gold','gold',0,'king',t-interval '4 months',t,t,'manual','customer')='gold','expiry restores manual at exact boundary';
 assert private.customer_effective_level('king','king',1000,'king',t-interval '4 months',t,t,'automatic','customer')='silver','expiry restores automatic spend';
 assert private.customer_effective_level('king','king',0,'king',t+interval '1 hour',t+interval '1 month',t,'automatic','customer')='bronze','future promo inactive';
 assert private.customer_level_for_spend(999.99)='bronze';
 assert private.customer_level_for_spend(1000)='silver';
 assert private.customer_level_for_spend(10800)='gold';
 assert private.customer_level_for_spend(20600)='emerald';
 assert private.customer_level_for_spend(30400)='diamond';
 assert private.customer_level_for_spend(40200)='master';
 assert private.customer_level_for_spend(50000)='king';
 assert private.customer_level_discount_amount('king')=1.50;
 assert private.customer_level_discount_amount('master')=1.25;
 assert private.customer_level_discount_amount('diamond')=1;
 assert private.customer_level_discount_amount('emerald')=.75;
 assert private.customer_level_discount_amount('gold')=.50;
 assert private.customer_level_discount_amount('silver')=.25;
 assert not has_function_privilege('anon','public.resolve_customer_product_quotes(uuid,jsonb)','execute'),'anonymous quote ACL';
 assert not has_function_privilege('anon','public.admin_update_signup_pricing_campaign(boolean,text,integer,timestamptz,timestamptz,text)','execute'),'anonymous policy ACL';
 assert not has_table_privilege('authenticated','private.signup_pricing_grants','select'),'claim ledger hidden';
 assert not has_table_privilege('authenticated','private.signup_pricing_campaign','update'),'policy direct update denied';
 assert (select count(*)=1 from public.admin_role_template_permissions where permission_id='pricing.manage_policy' and role_template_id='admin'),'owner policy grant';
 assert not exists(select 1 from public.admin_role_template_permissions where permission_id='pricing.manage_policy' and role_template_id<>'admin'),'no low-role policy grant';
 assert ((('2026-01-31 23:00:00+00'::timestamptz at time zone 'UTC')+make_interval(months=>3)) at time zone 'UTC')='2026-04-30 23:00:00+00'::timestamptz,'UTC month-end clamp';
 begin perform public.resolve_customer_product_quotes(null,'[]'); raise exception 'unauthenticated quotes accepted'; exception when insufficient_privilege then null; end;
end $$;

-- Quantity boundaries, stable versions, exemption and exact margin floor.
insert into public.customers(id,user_id,company_name,email,phone,fiscal_code,billing_address,shipping_address,customer_type,level,level_source) values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000011','Test','test@example.invalid','123','123','Test','Test','wholesale','gold','manual');
insert into public.products(id,sku_code,name,brand,category,b2b_price,retail_price,cost_price) values
('00000000-0000-0000-0000-000000000002','TEST-Q','Test','PartsPro','Screen',10,15,8),
('00000000-0000-0000-0000-000000000003','TEST-R','Test','REMAX','Accessory',10,15,20),
('00000000-0000-0000-0000-000000000004','TEST-F','Test','PartsPro','Pellicole Protettive',10,15,8);
insert into public.customer_product_prices(product_id,customer_id,min_quantity,unit_price,starts_at) values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',10,9,now()-interval '1 day');
select set_config('test.uid','00000000-0000-0000-0000-000000000011',true);
do $$
declare q record; ver text; result jsonb;
begin
 select * into q from public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[{"sku":"TEST-Q","quantity":4},{"sku":"test-q","quantity":6}]');
 assert q.quoted_quantity=10 and q.effective_unit_price=9.41 and q.price_source='customer_product_price_margin_floor','quantity aggregation and unchanged cost / .85 floor';
 ver:=q.price_version;
 select * into q from public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[{"sku":"TEST-Q","quantity":10}]');
 assert q.price_version=ver,'stable quote version';
 assert not (to_jsonb(q) ? 'margin_percent') and not(to_jsonb(q) ? 'cost_price'),'safe public DTO';
 select * into q from public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[{"sku":"TEST-R","quantity":1}]');
 assert q.price=10 and q.price_source='b2b_price_discount_exempt','REMAX retains base even high cost';
 select * into q from public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[{"sku":"TEST-F","quantity":1}]');
 assert q.price=10,'film exemption';
 select * into q from public.resolve_customer_catalog_prices('00000000-0000-0000-0000-000000000001',array['TEST-Q']);
 assert q.price=9.50 and q.level_discount_amount=.50,'legacy MOQ quote and fixed-discount output preserved';
 assert q.margin_percent is null and not(to_jsonb(q)?'cost_price'),'legacy margin redacted';
 assert (select count(*)=15 from jsonb_object_keys(to_jsonb(q))),'legacy column count preserved';
 select * into q from private.resolve_customer_product_price('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',1);
 assert q.margin_percent is null,'underlying resolver redacts old view margin';
 perform set_config('test.jwt','{"is_anonymous":true}',true);
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[]'); raise exception 'anonymous identity accepted'; exception when insufficient_privilege then null; end;
 perform set_config('test.jwt','{}',true);
 update public.customers set status='suspended' where id='00000000-0000-0000-0000-000000000001';
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[]'); raise exception 'inactive accepted'; exception when insufficient_privilege then null; end;
 update public.customers set status='active',phone=null where id='00000000-0000-0000-0000-000000000001';
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[]'); raise exception 'incomplete accepted'; exception when insufficient_privilege then null; end;
 update public.customers set phone='123' where id='00000000-0000-0000-0000-000000000001';
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[{"sku":"TEST-Q","quantity":0}]'); raise exception 'invalid quantity accepted'; exception when invalid_parameter_value then null; end;
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[{"sku":"TEST-Q","quantity":1.5}]'); raise exception 'fraction accepted'; exception when invalid_parameter_value then null; end;
 perform set_config('test.uid','00000000-0000-0000-0000-000000000012',true);
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[]'); raise exception 'cross customer accepted'; exception when insufficient_privilege then null; end;
 perform set_config('test.permissions','customers.read',true); perform set_config('test.staff','true',true);
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[]'); raise exception 'read-only staff accepted'; exception when insufficient_privilege then null; end;
 perform set_config('test.permissions','customers.read,orders.manage',true);
 select * into q from public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[{"sku":"TEST-Q","quantity":10}]');
 assert q.price=9.41,'authorized delegated quote';
 perform set_config('test.permissions','customers.read,customers.classify',true); perform set_config('test.staff','true',true);
 result:=public.admin_preview_customer_classification('00000000-0000-0000-0000-000000000001','retail','[{"sku":"TEST-Q","quantity":10}]');
 assert (result#>>'{items,0,before,price}')::numeric=9.41 and (result#>>'{items,0,after,price}')::numeric=14.50,'classification preview';
 assert (select customer_type='wholesale' from public.customers where id='00000000-0000-0000-0000-000000000001'),'preview leaves customer unchanged';
 perform set_config('test.permissions','customers.read,pricing.manage_policy',true);
 perform public.admin_update_signup_pricing_campaign(false,'king',3,null,null,'Test disabled');
 assert (public.admin_get_signup_pricing_campaign()->>'enabled')::boolean=false;
 assert jsonb_array_length(public.admin_get_signup_pricing_campaign_audit())=1;
 update public.customers set promo_level='king',promo_level_starts_at=now()-interval '1 day',promo_level_expires_at=now()+interval '1 month' where id='00000000-0000-0000-0000-000000000001';
 result:=public.admin_get_pricing_anomalies();
 assert not exists(select 1 from jsonb_array_elements(result) x where x->>'kind'='manual_effective_mismatch' and x->>'customer_id'='00000000-0000-0000-0000-000000000001'),'active promo above manual base is not anomaly';
 update public.customers set promo_level=null,promo_level_starts_at=null,promo_level_expires_at=null where id='00000000-0000-0000-0000-000000000001';
end $$;

-- The production trigger is retained; install its equivalent in the minimal fixture.
create trigger account_pricing_test_signup before insert on public.customers for each row execute function private.apply_customer_signup_king_promo();
do $$
declare c public.customers; end_at timestamptz;
begin
 perform set_config('test.permissions','pricing.manage_policy,customers.manage_level',true);
 perform public.admin_update_signup_pricing_campaign(true,'king',3,null,null,'Enable');
 insert into public.customers(id,user_id,company_name) values('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000031','Signup') returning * into c;
 assert c.promo_level='king'; end_at:=c.promo_level_expires_at;
 insert into public.customers(id,user_id,company_name) values('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000031','Repeat') returning * into c;
 assert c.promo_level is null,'same identity cannot reclaim';
 insert into public.customers(id,user_id,company_name,profile_kind) values('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000033','Employee','employee_self') returning * into c;
 assert c.promo_level is null,'employee excluded';
 insert into public.customers(user_id,company_name) values('00000000-0000-0000-0000-000000000092','Historical retry') returning * into c;
 assert c.promo_level is null,'historical manual-clear cannot reclaim';
 c:=public.admin_update_customer_level('00000000-0000-0000-0000-000000000021','gold','Manual');
 assert c.level='gold' and c.level_source='manual' and c.promo_level_expires_at=end_at,'manual preserves promo';
 c:=public.admin_restore_customer_automatic_level('00000000-0000-0000-0000-000000000021','Restore');
 assert c.level='bronze' and c.level_source='automatic' and c.promo_level_expires_at=end_at,'automatic restore preserves promo';
end $$;

-- Exercise wrapper execution as the actual authenticated database role.
select set_config('test.uid','00000000-0000-0000-0000-000000000011',true);
select set_config('test.permissions','',true);
select set_config('test.staff','false',true);
set local role authenticated;
do $$ declare q record; begin
 select * into q from public.resolve_customer_catalog_prices('00000000-0000-0000-0000-000000000001',array['TEST-Q']);
 assert q.margin_percent is null and q.level_discount_amount=.50;
 select * into q from public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000001','[{"sku":"TEST-Q","quantity":10}]');
 assert q.price=9.41;
end $$;
reset role;
rollback;
