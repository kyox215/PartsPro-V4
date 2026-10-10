-- Isolated database only. Synthetic fixtures; rollback all records.
begin;
insert into public.admin_permissions(id,label,group_name) values
('product.read_admin','Read','catalog'),('product.create_draft','Create','catalog'),('product.edit_content','Edit','catalog'),('product.edit_cost','Cost','catalog') on conflict do nothing;
insert into public.admin_role_templates(id,label) values ('catalog_creator','Creator'),('catalog_creator_reader','Creator reader') on conflict do nothing;
insert into public.admin_role_template_permissions(role_template_id,permission_id) values
('catalog_creator','product.create_draft'),('catalog_creator_reader','product.create_draft'),('catalog_creator_reader','product.read_admin') on conflict do nothing;
insert into auth.users(id,email) values
('00000000-0000-4000-8000-000000000301','migration-admin@fixture.invalid'),
('00000000-0000-4000-8000-000000000302','migration-creator@fixture.invalid'),
('00000000-0000-4000-8000-000000000303','migration-reader@fixture.invalid');
insert into public.profiles(id,email,role,account_type,role_template) values
('00000000-0000-4000-8000-000000000301','migration-admin@fixture.invalid','admin','employee',null),
('00000000-0000-4000-8000-000000000302','migration-creator@fixture.invalid','auditor','employee','catalog_creator'),
('00000000-0000-4000-8000-000000000303','migration-reader@fixture.invalid','auditor','employee','catalog_creator_reader')
on conflict(id) do update set role=excluded.role,account_type=excluded.account_type,role_template=excluded.role_template;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated"}',true);
set local role authenticated;
do $$ declare p public.products%rowtype; begin
  p := public.admin_create_product_draft('{"sku_code":"SAFE-LEGACY-1","name":"Legacy REMAX","brand":"REMAX","category":"Connettori"}','fixture legacy');
  if p.catalog_department <> 'general_merchandise' then raise exception 'Legacy REMAX default changed'; end if;
  p := public.admin_create_product_draft_once('{"sku_code":"SAFE-EXPLICIT","name":"Explicit REMAX","brand":"REMAX","category":"Connettori","catalog_department":"phone"}','00000000-0000-4000-8000-000000000401','fixture explicit');
  if p.catalog_department <> 'phone' then raise exception 'Explicit new assignment ignored'; end if;
  if coalesce(current_setting('partspro.explicit_catalog_department',true),'')='true' then raise exception 'Explicit flag leaked'; end if;
  p := public.admin_create_product_draft('{"sku_code":"SAFE-LEGACY-2","name":"Legacy REMAX after explicit","brand":"REMAX","category":"Connettori","catalog_department":"phone"}','fixture legacy');
  if p.catalog_department <> 'general_merchandise' then raise exception 'Legacy creation after once changed'; end if;
  raise notice 'PASS legacy -> explicit once -> legacy department behavior';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000302',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000302","role":"authenticated"}',true);
do $$ declare p public.products%rowtype; begin
  p := public.admin_create_product_draft_once('{"sku_code":"SAFE-CREATE-ONLY","name":"Create only","brand":"OEM","category":"Connettori"}','00000000-0000-4000-8000-000000000402','fixture create');
  begin perform public.admin_create_product_draft_once('{"sku_code":"SAFE-CREATE-ONLY","name":"Create only","brand":"OEM","category":"Connettori"}','00000000-0000-4000-8000-000000000402','fixture replay'); raise exception 'Replay bypassed read permission'; exception when insufficient_privilege then null; end;
  begin perform public.admin_create_product_draft_once('{"sku_code":"SAFE-FAIL","name":"Denied cost","brand":"REMAX","category":"Connettori","catalog_department":"phone","cost_price":100}','00000000-0000-4000-8000-000000000403','fixture failure'); raise exception 'Cost write allowed'; exception when insufficient_privilege then null; end;
  if coalesce(current_setting('partspro.explicit_catalog_department',true),'')='true' then raise exception 'Exception leaked explicit flag'; end if;
  raise notice 'PASS replay read gate and exception cleanup';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000303',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000303","role":"authenticated"}',true);
select (public.admin_create_product_draft_once('{"sku_code":"SAFE-REPLAY-MASK","name":"Replay mask","brand":"OEM","category":"Connettori"}','00000000-0000-4000-8000-000000000404','fixture create')).id;
reset role;
update public.products set cost_price=123 where sku_code='SAFE-REPLAY-MASK';
set local role authenticated;
do $$ declare p public.products%rowtype; begin
  p := public.admin_create_product_draft_once('{"sku_code":"SAFE-REPLAY-MASK","name":"Replay mask","brand":"OEM","category":"Connettori"}','00000000-0000-4000-8000-000000000404','fixture replay');
  if p.cost_price is not null then raise exception 'Replay leaked changed cost'; end if;
  if has_function_privilege('authenticated','private.compact_catalog_revision_events(integer)','execute') then raise exception 'Maintenance exposed'; end if;
  if has_table_privilege('anon','private.catalog_revision_events','select') then raise exception 'Events exposed'; end if;
  raise notice 'PASS cost mask and private maintenance ACL';
end $$;
reset role;
do $$ declare before_token text; removed bigint; begin
  before_token := public.catalog_directory_revision();
  removed := private.compact_catalog_revision_events(1);
  if removed <> 1 or before_token <> public.catalog_directory_revision() then raise exception 'Compaction changed revision'; end if;
  begin perform private.compact_catalog_revision_events(null); raise exception 'NULL maintenance limit accepted'; exception when check_violation then null; end;
  raise notice 'PASS atomic compaction preserves token';
end $$;
rollback;
