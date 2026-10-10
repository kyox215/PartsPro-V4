-- Display metadata keeps canonical brand/category values stable for pricing and compatibility.
create table private.catalog_directory_nodes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('department','brand','category')),
  value text not null check (length(btrim(value)) between 1 and 80 and value = btrim(value)),
  name_zh text not null check (length(btrim(name_zh)) between 1 and 120),
  name_it text not null check (length(btrim(name_it)) between 1 and 120),
  position integer not null default 0 check (position between 0 and 10000),
  active boolean not null default true,
  version bigint not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  check (kind <> 'department' or (active and value in ('phone','tablet','computer','general_merchandise')))
);
create unique index catalog_directory_identity on private.catalog_directory_nodes (kind, lower(value));
alter table private.catalog_directory_nodes enable row level security;
revoke all on private.catalog_directory_nodes from public, anon, authenticated;
create table private.catalog_revision (singleton boolean primary key default true check (singleton), revision bigint not null default 1);
insert into private.catalog_revision default values;
-- Append-only invalidation avoids a global row lock while product transactions
-- hold inventory rows. Token reads count only events visible in their MVCC snapshot.
create table private.catalog_revision_events (id bigint generated always as identity primary key);
alter table private.catalog_revision_events enable row level security;
revoke all on private.catalog_revision_events from public, anon, authenticated;
revoke all on sequence private.catalog_revision_events_id_seq from public, anon, authenticated;
alter table private.catalog_revision enable row level security;
revoke all on private.catalog_revision from public, anon, authenticated;

insert into private.catalog_directory_nodes(kind,value,name_zh,name_it,position) values
('department','phone','手机','Smartphone',0),
('department','tablet','平板','Tablet',1),
('department','computer','电脑','Computer',2),
('department','general_merchandise','电子产品·高端产品','Elettronica e prodotti premium',3);
insert into private.catalog_directory_nodes(kind,value,name_zh,name_it)
select 'brand', btrim(brand), btrim(brand), btrim(brand) from public.products where nullif(btrim(brand),'') is not null group by btrim(brand)
on conflict do nothing;
insert into private.catalog_directory_nodes(kind,value,name_zh,name_it)
select 'category', btrim(category), btrim(category), btrim(category) from public.products where nullif(btrim(category),'') is not null group by btrim(category)
on conflict do nothing;

create function private.bump_catalog_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin insert into private.catalog_revision_events default values; return null; end;
$$;
revoke all on function private.bump_catalog_revision() from public, anon, authenticated;
create trigger catalog_product_revision after insert or update or delete on public.products
for each statement execute function private.bump_catalog_revision();
create trigger catalog_directory_revision after insert or update or delete on private.catalog_directory_nodes
for each statement execute function private.bump_catalog_revision();

create function public.catalog_directory_revision() returns text
language sql stable security definer set search_path = '' as $$
select (revision + (select count(*) from private.catalog_revision_events))::text from private.catalog_revision where singleton;
$$;
revoke all on function public.catalog_directory_revision() from public, anon, authenticated;
grant execute on function public.catalog_directory_revision() to anon, authenticated;

-- Maintenance only: call in a standalone postgres transaction when events grow.
-- Do not invoke from product writes or public/admin RPCs. No cron is installed.
create function private.compact_catalog_revision_events(p_limit integer default 10000) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_removed bigint;
begin
  if p_limit is null or p_limit not between 1 and 100000 then raise exception 'Invalid compaction limit' using errcode='23514'; end if;
  perform 1 from private.catalog_revision where singleton for update;
  with removed as (
    delete from private.catalog_revision_events where id in
      (select id from private.catalog_revision_events order by id limit p_limit)
    returning id
  ) select count(*) into v_removed from removed;
  update private.catalog_revision set revision=revision+v_removed where singleton;
  return v_removed;
end;
$$;
revoke all on function private.compact_catalog_revision_events(integer) from public, anon, authenticated;

create function private.catalog_directory_snapshot(p_admin boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
select jsonb_build_object('revision', public.catalog_directory_revision(), 'nodes', coalesce(jsonb_agg(
  jsonb_build_object('id',n.id,'kind',n.kind,'value',n.value,'nameZh',n.name_zh,'nameIt',n.name_it,
    'position',n.position,'active',n.active,'version',n.version,'count',coalesce(c.total,0),
    'countsByDepartment',coalesce(c.by_department,'{}'::jsonb)) order by n.kind,n.position,n.value
), '[]'::jsonb))
from private.catalog_directory_nodes n
left join lateral (
  select sum(t.qty) as total,jsonb_object_agg(t.department,t.qty) as by_department from (
    select p.catalog_department as department, count(*) as qty from public.products p
    where (p_admin or p.status='active') and case n.kind
      when 'department' then p.catalog_department=n.value
      when 'brand' then lower(btrim(p.brand))=lower(n.value)
      when 'category' then lower(btrim(p.category))=lower(n.value) end
    group by p.catalog_department
  ) t
) c on true
where p_admin or (n.active and (n.kind='department' or coalesce(c.total,0)>0));
$$;
revoke all on function private.catalog_directory_snapshot(boolean) from public, anon, authenticated;
create function public.catalog_directory_public() returns jsonb
language sql stable security definer set search_path = '' as $$
select private.catalog_directory_snapshot(false);
$$;
revoke all on function public.catalog_directory_public() from public, anon, authenticated;
grant execute on function public.catalog_directory_public() to anon, authenticated;
create function public.admin_catalog_directory() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_permission('product.read_admin');
  return private.catalog_directory_snapshot(true);
end;
$$;
revoke all on function public.admin_catalog_directory() from public, anon, authenticated;
grant execute on function public.admin_catalog_directory() to authenticated;

create function public.admin_save_catalog_node(p_node jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_old private.catalog_directory_nodes%rowtype; v_new private.catalog_directory_nodes%rowtype;
v_id uuid := nullif(p_node->>'id','')::uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_permission('product.edit_content');
  if p_node is null or jsonb_typeof(p_node) <> 'object' or nullif(btrim(p_node->>'kind'),'') is null or nullif(btrim(p_node->>'value'),'') is null or nullif(btrim(p_node->>'nameZh'),'') is null or nullif(btrim(p_node->>'nameIt'),'') is null or p_node->>'position' is null then
    raise exception 'Directory node fields required' using errcode='23514'; end if;
  if v_id is not null then
    select * into v_old from private.catalog_directory_nodes where id=v_id for update;
    if not found then raise exception 'Directory node missing' using errcode='P0002'; end if;
    if v_old.kind is distinct from p_node->>'kind' or v_old.value is distinct from btrim(p_node->>'value') then
      raise exception 'Canonical directory identity cannot be changed' using errcode='23514';
    end if;
    if v_old.version is distinct from (p_node->>'version')::bigint then
      raise exception 'Directory changed; reload before saving' using errcode='40001';
    end if;
    if coalesce((p_node->>'active')::boolean,true)=false and exists (
      select 1 from public.products p where case v_old.kind
        when 'department' then p.catalog_department=v_old.value
        when 'brand' then lower(btrim(p.brand))=lower(v_old.value)
        when 'category' then lower(btrim(p.category))=lower(v_old.value) end
    ) then raise exception 'Move all associated products before disabling this node' using errcode='23514'; end if;
    update private.catalog_directory_nodes set name_zh=btrim(p_node->>'nameZh'),name_it=btrim(p_node->>'nameIt'),
      position=(p_node->>'position')::integer,active=(p_node->>'active')::boolean,
      version=version+1,updated_at=clock_timestamp() where id=v_id returning * into v_new;
  else
    if p_node->>'kind' not in ('brand','category') then
      raise exception 'Only brands and categories can be created' using errcode='23514';
    end if;
    if p_node->>'kind'='category' and length(btrim(p_node->>'value'))<2 then
      raise exception 'Category codes need at least two characters' using errcode='23514'; end if;
    insert into private.catalog_directory_nodes(kind,value,name_zh,name_it,position)
    values(p_node->>'kind',btrim(p_node->>'value'),btrim(p_node->>'nameZh'),btrim(p_node->>'nameIt'),(p_node->>'position')::integer)
    returning * into v_new;
  end if;
  insert into public.admin_audit_events(actor_id,actor_role,action,entity_type,entity_id,before_data,after_data,reason)
  values(auth.uid(),private.current_profile_role(),'catalog.node.save','catalog_directory',v_new.id::text,
    coalesce(to_jsonb(v_old),'{}'),to_jsonb(v_new),'Directory display metadata update');
  return private.catalog_directory_snapshot(true);
end;
$$;
revoke all on function public.admin_save_catalog_node(jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_catalog_node(jsonb) to authenticated;

update private.catalog_directory_nodes set name_zh = case value
when 'Schermi' then '屏幕' when 'Batterie' then '电池' when 'Connettori' then '尾插'
when 'Fotocamere' then '摄像头' when 'Speaker' then '扬声器' when 'Back Cover' then '后盖'
when 'Flat Cable' then '排线' when 'Frame' then '中框' when 'Pellicole Protettive' then '保护膜'
when 'Protective Films' then '保护膜' else name_zh end where kind='category';

-- Register legacy/import values without changing canonical identity. Block assignments to disabled nodes.
create function private.validate_product_directory() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text; v_value text; v_active boolean;
begin
  for v_kind,v_value in select 'brand',btrim(new.brand) union all select 'category',btrim(new.category) loop
    if nullif(v_value,'') is null then continue; end if;
    if not exists (select 1 from private.catalog_directory_nodes where kind=v_kind and lower(value)=lower(v_value)) then
      insert into private.catalog_directory_nodes(kind,value,name_zh,name_it) values(v_kind,v_value,v_value,v_value) on conflict do nothing;
    end if;
    select active into v_active from private.catalog_directory_nodes where kind=v_kind and lower(value)=lower(v_value) for share;
    if not v_active then raise exception 'Directory node is disabled: %',v_value using errcode='23514'; end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.validate_product_directory() from public, anon, authenticated;
create trigger validate_product_directory before insert or update of brand,category,catalog_department on public.products
for each row execute function private.validate_product_directory();

-- Existing explicit assignments survive; REMAX gets a default only on creation.
create or replace function private.partspro_products_catalog_department_default() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' and lower(btrim(coalesce(new.brand,'')))='remax'
     and coalesce(nullif(lower(btrim(new.catalog_department)),''),'phone')='phone'
     and coalesce(current_setting('partspro.explicit_catalog_department',true),'') <> 'true' then
    new.catalog_department := 'general_merchandise';
  else new.catalog_department := coalesce(nullif(lower(btrim(new.catalog_department)),''),'phone'); end if;
  return new;
end;
$$;
revoke all on function private.partspro_products_catalog_department_default() from public, anon, authenticated;

create function public.admin_update_product_versioned(p_sku_code text,p_product jsonb,p_expected_updated_at timestamptz,p_reason text default '') returns public.products
language plpgsql security definer set search_path = '' as $$
declare v_product public.products%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_permission('product.read_admin');
  select * into v_product from public.products where sku_code=p_sku_code for update;
  if not found then raise exception 'Product not found' using errcode='P0002'; end if;
  if p_expected_updated_at is null or v_product.updated_at is distinct from p_expected_updated_at then
    raise exception 'Product changed; reload before saving' using errcode='40001';
  end if;
  return public.admin_update_product(p_sku_code,p_product,p_reason);
end;
$$;
revoke all on function public.admin_update_product_versioned(text,jsonb,timestamptz,text) from public, anon, authenticated;
grant execute on function public.admin_update_product_versioned(text,jsonb,timestamptz,text) to authenticated;

create function public.admin_move_catalog_products(p_products jsonb,p_target jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_before public.products%rowtype; v_after public.products%rowtype; v_item jsonb; v_seen text[] := '{}'; v_payload jsonb := '{}';
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_permission('product.edit_content');
  if p_products is null or jsonb_typeof(p_products) <> 'array' then
    raise exception 'Product array required' using errcode='23514'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 3 and 500 or jsonb_array_length(p_products) not between 1 and 100 then
    raise exception 'Choose 1-100 products and provide a reason' using errcode='23514'; end if;
  if p_target is null or jsonb_typeof(p_target) <> 'object' then
    raise exception 'Target object required' using errcode='23514'; end if;
  if p_target='{}'::jsonb or exists(select 1 from jsonb_object_keys(p_target) k where k not in ('department','category','brand')) then
    raise exception 'Invalid target directory' using errcode='23514'; end if;
  if exists(select 1 from jsonb_each(p_target) x where jsonb_typeof(x.value) <> 'string' or length(btrim(x.value #>> '{}')) not between 1 and 80) then
    raise exception 'Invalid target value' using errcode='23514'; end if;
  if p_target ? 'department' then v_payload := v_payload || jsonb_build_object('catalog_department',p_target->>'department'); end if;
  if p_target ? 'brand' then v_payload := v_payload || jsonb_build_object('brand',p_target->>'brand'); end if;
  if p_target ? 'category' then v_payload := v_payload || jsonb_build_object('category',p_target->>'category'); end if;
  if v_payload='{}' then raise exception 'Target directory required' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_products) x where jsonb_typeof(x)<>'object' or nullif(btrim(x->>'sku'),'') is null or nullif(btrim(x->>'updatedAt'),'') is null) then
    raise exception 'Every product needs SKU and exact version' using errcode='23514'; end if;
  for v_item in select value from jsonb_array_elements(p_products) order by value->>'sku' loop
    if v_item->>'sku'=any(v_seen) then raise exception 'Duplicate SKU' using errcode='23514'; end if;
    v_seen := array_append(v_seen,v_item->>'sku');
    select * into v_before from public.products where sku_code=v_item->>'sku' for update;
    if not found then raise exception 'Product missing' using errcode='P0002'; end if;
    if v_before.updated_at is distinct from (v_item->>'updatedAt')::timestamptz then
      raise exception 'Product changed; reload selection' using errcode='40001'; end if;
    -- Canonical brand changes use the existing compatibility review workflow, never bulk directory moves.
    if p_target ? 'brand' and v_before.brand is distinct from p_target->>'brand' then
      raise exception 'Use product editing and compatibility review to change the actual brand' using errcode='23514';
    end if;
    if p_target ? 'category' and
       (lower(btrim(coalesce(v_before.category,''))) = 'pellicole protettive') is distinct from
       (lower(btrim(coalesce(p_target->>'category',''))) = 'pellicole protettive') then
      raise exception 'This category change affects discount rules; use the dedicated product/pricing workflow' using errcode='23514';
    end if;
    v_after := public.admin_update_product(v_before.sku_code,v_payload,p_reason);
  end loop;
  return jsonb_build_object('moved',cardinality(v_seen),'directory',private.catalog_directory_snapshot(true));
end;
$$;
revoke all on function public.admin_move_catalog_products(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.admin_move_catalog_products(jsonb,jsonb,text) to authenticated;
-- Rollback: restore the former department trigger from the prior migration; remove new functions/triggers/table only after reverting dependent code.

-- Preserve the verified remote listing contract, adding a department predicate before summary/pagination.
CREATE OR REPLACE FUNCTION public.admin_list_products_catalog(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_q text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_model text DEFAULT NULL::text, p_category text DEFAULT NULL::text, p_catalog_status text DEFAULT NULL::text, p_stock_status text DEFAULT NULL::text, p_warehouse text DEFAULT NULL::text, p_grade text DEFAULT NULL::text, p_sort text DEFAULT 'updated_desc'::text, p_model_series text DEFAULT NULL::text, p_supplier text DEFAULT NULL::text, p_batch_code text DEFAULT NULL::text, p_active_restock_only boolean DEFAULT false, p_issue_filter text DEFAULT NULL::text, p_department text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'updated_desc');
  v_issue_filter text := nullif(btrim(coalesce(p_issue_filter, '')), '');
  v_products jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_admin_product_read();

  with inventory_summary as (
    select
      private.partspro_admin_public_sku(i.sku_code) as sku_code,
      coalesce(sum(i.actual_qty), 0) as actual_qty,
      coalesce(sum(i.available_qty), 0) as available_qty,
      coalesce(sum(i.locked_qty), 0) as locked_qty
    from public.inventory_items as i
    group by private.partspro_admin_public_sku(i.sku_code)
  ),
  restock_summary as (
    select
      private.partspro_admin_public_sku(r.sku_code) as sku_code,
      count(*)::bigint as active_restock_request_count
    from public.product_restock_requests as r
    where r.status = 'active'
    group by private.partspro_admin_public_sku(r.sku_code)
  ),
  sold_summary as (
    select
      private.partspro_admin_public_sku(ol.sku_code) as sku_code,
      sum(greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0))::bigint as sold_qty
    from public.order_lines as ol
    join public.orders as o on o.id = ol.order_id
    where v_issue_filter in ('zero_stock_unsold', 'zero_stock_sold')
      and nullif(btrim(coalesce(ol.sku_code, '')), '') is not null
      and coalesce(o.soft_deleted_at, null) is null
      and o.status in ('shipped', 'completed')
      and greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0) > 0
    group by private.partspro_admin_public_sku(ol.sku_code)
  ),
  filtered_products as (
    select
      p.id,
      p.sku_code,
      p.name,
      p.brand,
      p.model,
      p.model_series,
      p.model_code,
      p.model_codes,
      p.category,
      p.quality_grade,
      p.stock_status,
      p.moq,
      p.cost_price,
      p.retail_price,
      p.b2b_price,
      p.vat_mode,
      p.warranty_days,
      p.weight_gram,
      p.stock_qty,
      p.location,
      p.batch_code,
      p.supplier,
      p.compatibility_models,
      p.highlights,
      p.status,
      p.updated_at,
      p.image_path,
      p.image_alt,
      p.gallery_image_paths,
      p.created_at,
      p.catalog_department,
      coalesce(inv.actual_qty, p.stock_qty::bigint) as actual_qty,
      coalesce(inv.available_qty, p.stock_qty::bigint) as available_qty,
      coalesce(inv.locked_qty, 0) as locked_qty,
      coalesce(restock.active_restock_request_count, 0) as active_restock_request_count,
      coalesce(sold.sold_qty, 0) as sold_qty
    from public.products as p
    left join inventory_summary as inv
      on inv.sku_code = private.partspro_admin_public_sku(p.sku_code)
    left join restock_summary as restock
      on restock.sku_code = private.partspro_admin_public_sku(p.sku_code)
    left join sold_summary as sold
      on sold.sku_code = private.partspro_admin_public_sku(p.sku_code)
    where (nullif(btrim(coalesce(p_q, '')), '') is null
        or p.name ilike '%' || btrim(p_q) || '%'
        or p.sku_code ilike '%' || btrim(p_q) || '%'
        or p.brand ilike '%' || btrim(p_q) || '%'
        or p.category ilike '%' || btrim(p_q) || '%'
        or p.model ilike '%' || btrim(p_q) || '%'
        or p.model_code ilike '%' || btrim(p_q) || '%'
        or p.model_series ilike '%' || btrim(p_q) || '%'
        or p.batch_code ilike '%' || btrim(p_q) || '%'
        or p.supplier ilike '%' || btrim(p_q) || '%'
        or exists (
          select 1
          from unnest(coalesce(p.alternative_skus, '{}'::text[])) as alternative_sku(value)
          where alternative_sku.value ilike '%' || btrim(p_q) || '%'
        ))
      and (p_department is null or p.catalog_department = p_department)
      and (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = p_brand)
      and (nullif(btrim(coalesce(p_category, '')), '') is null or p.category = p_category)
      and (nullif(btrim(coalesce(p_catalog_status, '')), '') is null or p.status = p_catalog_status)
      and (nullif(btrim(coalesce(p_stock_status, '')), '') is null or p.stock_status = p_stock_status)
      and (nullif(btrim(coalesce(p_warehouse, '')), '') is null or p.location = p_warehouse)
      and (nullif(btrim(coalesce(p_grade, '')), '') is null or p.quality_grade = p_grade)
      and (nullif(btrim(coalesce(p_batch_code, '')), '') is null or p.batch_code ilike '%' || btrim(p_batch_code) || '%')
      and (nullif(btrim(coalesce(p_supplier, '')), '') is null or p.supplier ilike '%' || btrim(p_supplier) || '%')
      and (not coalesce(p_active_restock_only, false) or coalesce(restock.active_restock_request_count, 0) > 0)
      and (
        v_issue_filter is null
        or (
          v_issue_filter = 'missing_price'
          and coalesce(p.b2b_price, 0) <= 0
        )
        or (
          v_issue_filter = 'missing_image'
          and nullif(btrim(coalesce(p.image_path, '')), '') is null
        )
        or (
          v_issue_filter = 'zero_stock_unsold'
          and coalesce(inv.available_qty, p.stock_qty::bigint, 0) <= 0
          and coalesce(sold.sold_qty, 0) = 0
        )
        or (
          v_issue_filter = 'zero_stock_sold'
          and coalesce(inv.available_qty, p.stock_qty::bigint, 0) <= 0
          and coalesce(sold.sold_qty, 0) > 0
        )
      )
      and (nullif(btrim(coalesce(p_model_series, '')), '') is null
        or p.model_series = p_model_series
        or exists (
          select 1
          from unnest(coalesce(p.model_codes, '{}'::text[]) || coalesce(p.compatibility_models, '{}'::text[])) as model_option(model)
          where private.partspro_model_series(p.brand, model_option.model) = p_model_series
        ))
      and (
        nullif(btrim(coalesce(p_model, '')), '') is null
        or p.model = p_model
        or p_model = any(p.model_codes)
        or p.compatibility_models @> array[p_model]::text[]
      )
  ),
  summary as (
    select
      count(*)::bigint as total,
      count(*) filter (where status = 'active') as active,
      count(*) filter (where status = 'draft') as draft,
      count(*) filter (where status = 'hidden') as hidden,
      count(*) filter (where status = 'blocked') as blocked,
      count(*) filter (where status = 'active' and stock_status in ('low_stock', 'Low Stock')) as active_low_stock,
      count(*) filter (where status = 'active' and stock_status in ('out_of_stock', 'Out of Stock')) as active_out_of_stock,
      count(*) filter (where coalesce(available_qty, stock_qty::bigint, 0) > 0 and coalesce(available_qty, stock_qty::bigint, 0) < 10) as low_stock,
      count(*) filter (where nullif(btrim(coalesce(image_path, '')), '') is null) as missing_image,
      count(*) filter (where coalesce(b2b_price, 0) <= 0) as missing_price,
      coalesce(sum(active_restock_request_count), 0)::bigint as restock_requests
    from filtered_products
  ),
  page_products as (
    select *
    from filtered_products
    order by
      case when v_sort = 'stock_desc' then stock_qty end desc nulls last,
      case when v_sort = 'created_desc' then created_at end desc nulls last,
      case when v_sort = 'name' then name end asc nulls last,
      case when v_sort not in ('stock_desc', 'created_desc', 'name') then updated_at end desc nulls last,
      sku_code asc
    limit v_limit
    offset v_offset
  ),
  page_json as (
    select coalesce(jsonb_agg(to_jsonb(page_products)), '[]'::jsonb) as products
    from page_products
  )
  select
    page_json.products,
    jsonb_build_object(
      'total', coalesce(summary.total, 0),
      'active', coalesce(summary.active, 0),
      'draft', coalesce(summary.draft, 0),
      'hidden', coalesce(summary.hidden, 0),
      'blocked', coalesce(summary.blocked, 0),
      'lowStock', coalesce(summary.low_stock, 0),
      'activeLowStock', coalesce(summary.active_low_stock, 0),
      'activeOutOfStock', coalesce(summary.active_out_of_stock, 0),
      'restockRequests', coalesce(summary.restock_requests, 0),
      'missingImage', coalesce(summary.missing_image, 0),
      'missingPrice', coalesce(summary.missing_price, 0)
    )
  into v_products, v_summary
  from page_json
  cross join summary;

  return jsonb_build_object(
    'products', coalesce(v_products, '[]'::jsonb),
    'total', coalesce((v_summary->>'total')::bigint, 0),
    'summary', coalesce(v_summary, '{}'::jsonb)
  );
end;
$function$;

revoke all on function public.admin_list_products_catalog(integer,integer,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text) from public, anon, authenticated;
grant execute on function public.admin_list_products_catalog(integer,integer,text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text) to authenticated;

-- Retry a lost draft-creation response without creating another SKU.
create table private.catalog_product_creations (
  actor_id uuid not null,
  request_id uuid not null,
  payload jsonb not null,
  product_id uuid references public.products(id),
  primary key(actor_id,request_id)
);
alter table private.catalog_product_creations enable row level security;
revoke all on private.catalog_product_creations from public, anon, authenticated;
create function public.admin_create_product_draft_once(p_product jsonb,p_request_id uuid,p_reason text default '') returns public.products
language plpgsql security definer set search_path = '' as $$
declare v_request private.catalog_product_creations%rowtype; v_product public.products%rowtype; v_previous_explicit text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_permission('product.create_draft');
  if p_request_id is null or p_product is null or jsonb_typeof(p_product)<>'object' then
    raise exception 'Request identity and product object required' using errcode='23514'; end if;
  insert into private.catalog_product_creations(actor_id,request_id,payload) values(auth.uid(),p_request_id,p_product) on conflict do nothing;
  select * into v_request from private.catalog_product_creations where actor_id=auth.uid() and request_id=p_request_id for update;
  if v_request.payload is distinct from p_product then
    raise exception 'Creation request already used with different content; reload and verify the existing draft' using errcode='40001'; end if;
  if v_request.product_id is not null then
    perform private.partspro_assert_permission('product.read_admin');
    select * into v_product from public.products where id=v_request.product_id;
    if not found then raise exception 'Created draft is no longer available' using errcode='P0002'; end if;
    if not private.partspro_has_permission('product.edit_cost') then v_product.cost_price := null; end if;
    return v_product;
  end if;
  v_previous_explicit := coalesce(current_setting('partspro.explicit_catalog_department',true),'');
  begin
    if coalesce(p_product->>'catalog_department',p_product->>'catalogDepartment') in ('phone','tablet','computer','general_merchandise') then
      perform set_config('partspro.explicit_catalog_department','true',true);
    end if;
    v_product := public.admin_create_product_draft(p_product,p_reason);
    perform set_config('partspro.explicit_catalog_department',v_previous_explicit,true);
  exception when others then
    perform set_config('partspro.explicit_catalog_department',v_previous_explicit,true);
    raise;
  end;
  update private.catalog_product_creations set product_id=v_product.id where actor_id=auth.uid() and request_id=p_request_id;
  return v_product;
end;
$$;
revoke all on function public.admin_create_product_draft_once(jsonb,uuid,text) from public, anon, authenticated;
grant execute on function public.admin_create_product_draft_once(jsonb,uuid,text) to authenticated;
