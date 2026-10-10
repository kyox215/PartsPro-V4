-- Execute only in an isolated test database. Uses synthetic users/products and rolls back all data.
begin;
-- Seed permission catalog only in the isolated fixture; real databases already contain these rows.
insert into public.admin_permissions(id,label,group_name) values ('product.read_admin','Read','catalog'),('product.edit_content','Edit','catalog'),('product.create_draft','Create','catalog') on conflict(id) do nothing;
insert into public.admin_role_templates(id,label) values ('auditor','Auditor') on conflict(id) do nothing;
insert into public.admin_role_template_permissions(role_template_id,permission_id) values ('auditor','product.read_admin') on conflict do nothing;
insert into auth.users(id,email) values ('00000000-0000-4000-8000-000000000101','catalog-admin@fixture.invalid'),('00000000-0000-4000-8000-000000000102','catalog-reader@fixture.invalid');
insert into public.profiles(id,email,role,account_type) values
('00000000-0000-4000-8000-000000000101','catalog-admin@fixture.invalid','admin','employee'),
('00000000-0000-4000-8000-000000000102','catalog-reader@fixture.invalid','auditor','employee')
on conflict(id) do update set role=excluded.role,account_type=excluded.account_type;
insert into public.products(sku_code,name,brand,category,catalog_department,status,location,quality_grade,stock_status,b2b_price,retail_price,stock_qty,updated_at) values
('CAT-TEST-1','Synthetic cable','REMAX','Connettori','general_merchandise','active','Milano','A','in_stock',10,15,8,'2026-10-10T08:00:00.123456Z'),
('CAT-TEST-2','Synthetic battery','OEM','Batterie','phone','draft','Milano','A','in_stock',20,30,8,'2026-10-10T08:00:01.234567Z'),
('CAT-TEST-3','Synthetic film','OEM','Pellicole Protettive','phone','hidden','Milano','A','in_stock',5,8,8,'2026-10-10T08:00:02.345678Z');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated","email":"catalog-admin@fixture.invalid"}',true);
set local role authenticated;
do $$
declare v_doc jsonb; v_node jsonb; v_saved public.products%rowtype; v_revision text; v_audit bigint; v_items jsonb;
begin
  -- Public snapshots exclude drafts and never expose private node tables or admin functions.
  v_doc := public.catalog_directory_public();
  if (select sum((n->>'count')::integer) from jsonb_array_elements(v_doc->'nodes') n where n->>'kind'='department') <> 1 then raise exception 'Public counts leaked non-active products'; end if;
  if has_table_privilege('anon','private.catalog_directory_nodes','select') then raise exception 'Private node table exposed'; end if;
  if has_function_privilege('anon','public.admin_save_catalog_node(jsonb)','execute') then raise exception 'Anonymous management exposed'; end if;
  v_doc := public.admin_catalog_directory();
  if (select sum((n->>'count')::integer) from jsonb_array_elements(v_doc->'nodes') n where n->>'kind'='department') <> 3 then raise exception 'Admin counts omitted draft'; end if;
  v_node := (select n from jsonb_array_elements(v_doc->'nodes') n where n->>'kind'='department' and n->>'value'='general_merchandise');
  v_node := v_node - 'count' - 'countsByDepartment';
  v_doc := public.admin_save_catalog_node(v_node || '{"nameZh":"测试显示名称","nameIt":"Nome prova"}');
  if not exists(select 1 from jsonb_array_elements(v_doc->'nodes') n where n->>'nameIt'='Nome prova') then raise exception 'Saved metadata readback missing'; end if;
  begin perform public.admin_save_catalog_node(v_node); raise exception 'Stale node update accepted'; exception when serialization_failure then null; end;
  begin perform public.admin_save_catalog_node(v_node || '{"active":false,"version":2}'); raise exception 'Department disabled'; exception when check_violation then null; end;
  -- Exact microsecond timestamp succeeds. A stale timestamp must be rejected without updates.
  v_saved := public.admin_update_product_versioned('CAT-TEST-1','{"catalog_department":"computer"}','2026-10-10T08:00:00.123456Z','fixture move');
  if v_saved.catalog_department is distinct from 'computer' or v_saved.brand <> 'REMAX' or v_saved.b2b_price <> 10 then raise exception 'REMAX move reverted or changed price/brand'; end if;
  begin perform public.admin_update_product_versioned('CAT-TEST-1','{"name":"Bad overwrite"}','2026-10-10T08:00:00.123456Z','stale'); raise exception 'Stale product accepted'; exception when serialization_failure then null; end;
  -- Last-product conflict rolls back all previous updates in the same batch.
  v_items := jsonb_build_array(jsonb_build_object('sku','CAT-TEST-1','updatedAt',v_saved.updated_at),jsonb_build_object('sku','CAT-TEST-2','updatedAt','2020-01-01T00:00:00Z'));
  v_revision := public.catalog_directory_revision();
  begin perform public.admin_move_catalog_products(v_items,'{"department":"tablet"}','fixture bulk'); raise exception 'Stale batch accepted'; exception when serialization_failure then null; end;
  if (public.admin_list_products_catalog(p_q=>'CAT-TEST-1')->'products'->0->>'catalog_department') is distinct from 'computer' then raise exception 'Partial batch persisted'; end if;
  if public.catalog_directory_revision() <> v_revision then raise exception 'Failed transaction changed revision'; end if;
  v_items := jsonb_build_array(jsonb_build_object('sku','CAT-TEST-1','updatedAt',v_saved.updated_at));
  begin perform public.admin_move_catalog_products(v_items,'{"department":"tablet"}',null); raise exception 'NULL reason accepted'; exception when check_violation then null; end;
  begin perform public.admin_move_catalog_products(null,'{"department":"tablet"}','fixture null'); raise exception 'NULL products accepted'; exception when check_violation then null; end;
  begin perform public.admin_move_catalog_products(v_items,'{"department":null}','fixture null'); raise exception 'NULL target accepted'; exception when check_violation then null; end;
  begin perform public.admin_move_catalog_products(v_items,'{"brand":"OEM"}','fixture brand'); raise exception 'Brand review bypass'; exception when check_violation then null; end;
  begin perform public.admin_move_catalog_products(v_items,'{"category":"Pellicole Protettive"}','fixture category'); raise exception 'Discount rule crossed'; exception when check_violation then null; end;
  v_doc := public.admin_move_catalog_products(v_items,'{"department":"tablet"}','fixture success');
  if (v_doc->>'moved')::integer <> 1 or (public.admin_list_products_catalog(p_q=>'CAT-TEST-1')->'products'->0->>'catalog_department') is distinct from 'tablet' then raise exception 'Move readback incorrect'; end if;
  if (select n->'countsByDepartment'->>'tablet' from jsonb_array_elements(v_doc->'directory'->'nodes') n where n->>'kind'='brand' and n->>'value'='REMAX') is distinct from '1' then raise exception 'Moved universal brand missing from navigation counts'; end if;
  if public.catalog_directory_revision() = v_revision then raise exception 'Successful transaction did not invalidate catalog'; end if;
  v_doc := public.admin_save_catalog_node('{"kind":"category","value":"Test empty category","nameZh":"空分类","nameIt":"Categoria vuota","position":1,"active":true}');
  v_node := (select n from jsonb_array_elements(v_doc->'nodes') n where n->>'value'='Test empty category');
  perform public.admin_save_catalog_node((v_node - 'count' - 'countsByDepartment') || '{"active":false}');
  begin perform public.admin_update_product_versioned('CAT-TEST-1','{"category":"Test empty category"}',v_saved.updated_at,'fixture inactive'); raise exception 'Inactive assignment accepted'; exception when check_violation then null; end;
  v_doc := public.admin_list_products_catalog(p_department=>'tablet');
  if (v_doc->>'total')::integer <> 1 or (v_doc->'products'->0->>'sku_code') is distinct from 'CAT-TEST-1' then raise exception 'Department pagination/summary wrong'; end if;
  v_items := jsonb_build_array(jsonb_build_object('sku','CAT-TEST-3','updatedAt','2026-10-10T08:00:02.345678Z'));
  begin perform public.admin_move_catalog_products(v_items,'{"category":"Protective Films"}','fixture translation'); raise exception 'Italian-to-English discount bypass'; exception when check_violation then null; end;
  v_saved := public.admin_update_product_versioned('CAT-TEST-3','{"category":"Protective Films"}','2026-10-10T08:00:02.345678Z','fixture setup');
  v_items := jsonb_build_array(jsonb_build_object('sku','CAT-TEST-3','updatedAt',v_saved.updated_at));
  begin perform public.admin_move_catalog_products(v_items,'{"category":"Pellicole Protettive"}','fixture translation'); raise exception 'English-to-Italian discount bypass'; exception when check_violation then null; end;
  v_saved := public.admin_create_product_draft_once('{"sku_code":"CAT-IDEMPOTENT","name":"Synthetic retry draft","brand":"OEM","category":"Connettori","catalog_department":"phone"}','00000000-0000-4000-8000-000000000201','fixture create');
  if (public.admin_create_product_draft_once('{"sku_code":"CAT-IDEMPOTENT","name":"Synthetic retry draft","brand":"OEM","category":"Connettori","catalog_department":"phone"}','00000000-0000-4000-8000-000000000201','fixture retry')).id is distinct from v_saved.id then raise exception 'Creation retry duplicated product'; end if;
  begin perform public.admin_create_product_draft_once('{"name":"Changed payload"}','00000000-0000-4000-8000-000000000201','fixture replay'); raise exception 'Idempotency key reused with changed content'; exception when serialization_failure then null; end;
  raise notice 'PASS: metadata, public visibility, ACL, stale versions, REMAX move, atomic batch, rollback revision, review gates, inactive assignment, filtered listing';
end;
$$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated","email":"catalog-reader@fixture.invalid"}',true);
do $$ begin
  perform public.admin_catalog_directory();
  begin perform public.admin_save_catalog_node('{"kind":"brand","value":"Unauthorized","nameZh":"越权","nameIt":"Non autorizzato","position":0}'); raise exception 'Read-only employee could write'; exception when insufficient_privilege then null; end;
  raise notice 'PASS: read-only employee can read but cannot write';
end; $$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ begin
  begin perform public.admin_catalog_directory(); raise exception 'Missing identity accepted'; exception when invalid_authorization_specification then null; end;
  raise notice 'PASS: missing identity denied';
end; $$;
rollback;
