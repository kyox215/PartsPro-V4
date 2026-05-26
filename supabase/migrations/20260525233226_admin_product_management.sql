-- Production product administration boundary: permissions, audit trail,
-- controlled product state transitions, image metadata, and stock adjustments.

do $$
begin
  alter table public.profiles drop constraint if exists profiles_role_check;

  alter table public.profiles
    add constraint profiles_role_check
    check (
      role in (
        'customer',
        'sales',
        'warehouse',
        'purchasing',
        'admin',
        'catalog_manager',
        'pricing_manager',
        'inventory_manager',
        'sales_support',
        'auditor'
      )
    );
end $$;

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  sku_code text,
  before_data jsonb not null default '{}'::jsonb check (jsonb_typeof(before_data) = 'object'),
  after_data jsonb not null default '{}'::jsonb check (jsonb_typeof(after_data) = 'object'),
  reason text,
  request_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(request_metadata) = 'object'),
  result text not null default 'success' check (result in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_events_entity_created_idx
  on public.admin_audit_events (entity_type, sku_code, created_at desc);

create index if not exists admin_audit_events_actor_created_idx
  on public.admin_audit_events (actor_id, created_at desc);

alter table public.admin_audit_events enable row level security;

grant select on public.admin_audit_events to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_events'
      and policyname = 'partspro_admin_audit_staff_read'
  ) then
    create policy "partspro_admin_audit_staff_read"
      on public.admin_audit_events
      for select
      to authenticated
      using ((select private.is_staff()));
  end if;
end $$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select private.current_profile_role()) in (
      'sales',
      'warehouse',
      'purchasing',
      'admin',
      'catalog_manager',
      'pricing_manager',
      'inventory_manager',
      'sales_support',
      'auditor'
    ),
    false
  )
$$;

create or replace function private.partspro_has_permission(_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with role_context as (
    select coalesce((select private.current_profile_role()), '') as role
  )
  select case
    when role = 'admin' then true
    when role = 'catalog_manager' then _permission = any(array[
      'product.read_admin',
      'product.create_draft',
      'product.edit_content',
      'product.hide',
      'product.restore_draft',
      'product.image_manage'
    ])
    when role = 'pricing_manager' then _permission = any(array[
      'product.read_admin',
      'product.edit_price',
      'product.edit_cost'
    ])
    when role in ('inventory_manager', 'warehouse') then _permission = any(array[
      'product.read_admin',
      'product.adjust_stock'
    ])
    when role = 'purchasing' then _permission = any(array[
      'product.read_admin',
      'product.create_draft',
      'product.edit_content'
    ])
    when role in ('sales', 'sales_support', 'auditor') then _permission = 'product.read_admin'
    else false
  end
  from role_context
$$;

create or replace function private.partspro_assert_permission(_permission text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce((select private.partspro_has_permission(_permission)), false) then
    raise exception 'Missing product admin permission: %', _permission using errcode = '42501';
  end if;
end;
$$;

grant execute on function private.partspro_has_permission(text) to authenticated;
grant execute on function private.partspro_assert_permission(text) to authenticated;

create or replace function private.partspro_stock_status(_stock_qty integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(_stock_qty, 0) <= 0 then 'out_of_stock'
    when coalesce(_stock_qty, 0) <= 5 then 'low_stock'
    else 'in_stock'
  end
$$;

create or replace function private.partspro_product_publish_issues(_product public.products)
returns text[]
language plpgsql
immutable
as $$
declare
  v_issues text[] := '{}'::text[];
begin
  if nullif(btrim(coalesce(_product.sku_code, '')), '') is null then
    v_issues := array_append(v_issues, 'sku_code');
  end if;

  if nullif(btrim(coalesce(_product.name, '')), '') is null then
    v_issues := array_append(v_issues, 'name');
  end if;

  if nullif(btrim(coalesce(_product.brand, '')), '') is null then
    v_issues := array_append(v_issues, 'brand');
  end if;

  if nullif(btrim(coalesce(_product.category, '')), '') is null then
    v_issues := array_append(v_issues, 'category');
  end if;

  if coalesce(_product.moq, 0) <= 0 then
    v_issues := array_append(v_issues, 'moq');
  end if;

  if coalesce(_product.b2b_price, 0) <= 0 then
    v_issues := array_append(v_issues, 'b2b_price');
  end if;

  if nullif(btrim(coalesce(_product.vat_mode, '')), '') is null then
    v_issues := array_append(v_issues, 'vat_mode');
  end if;

  if coalesce(_product.warranty_days, 0) <= 0 then
    v_issues := array_append(v_issues, 'warranty_days');
  end if;

  if nullif(btrim(coalesce(_product.location, '')), '') is null then
    v_issues := array_append(v_issues, 'location');
  end if;

  if nullif(btrim(coalesce(_product.supplier, '')), '') is null then
    v_issues := array_append(v_issues, 'supplier');
  end if;

  if cardinality(coalesce(_product.compatibility_models, '{}'::text[])) = 0 then
    v_issues := array_append(v_issues, 'compatibility_models');
  end if;

  if nullif(btrim(coalesce(_product.image_path, '')), '') is null then
    v_issues := array_append(v_issues, 'image_path');
  end if;

  return v_issues;
end;
$$;

create or replace function private.partspro_audit_product(
  _action text,
  _before public.products,
  _after public.products,
  _reason text default '',
  _metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_email text := nullif(coalesce((auth.jwt() ->> 'email'), ''), '');
  v_actor_role text := (select private.current_profile_role());
  v_before_json jsonb := case when _before is null then '{}'::jsonb else to_jsonb(_before) end;
  v_after_json jsonb := case when _after is null then '{}'::jsonb else to_jsonb(_after) end;
  v_sku text := coalesce(_after.sku_code, _before.sku_code);
  v_id text := coalesce(_after.id::text, _before.id::text);
begin
  insert into public.admin_audit_events (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    sku_code,
    before_data,
    after_data,
    reason,
    request_metadata
  )
  values (
    v_actor_id,
    v_actor_email,
    v_actor_role,
    _action,
    'product',
    v_id,
    v_sku,
    v_before_json,
    v_after_json,
    nullif(btrim(coalesce(_reason, '')), ''),
    coalesce(_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.admin_create_product_draft(
  p_product jsonb,
  p_reason text default ''
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.products%rowtype;
  v_sku text := upper(btrim(coalesce(p_product ->> 'sku_code', '')));
  v_stock_qty integer := greatest(coalesce((p_product ->> 'stock_qty')::integer, 0), 0);
begin
  perform private.partspro_assert_permission('product.create_draft');

  if v_sku = '' then
    raise exception 'sku_code is required' using errcode = '23514';
  end if;

  insert into public.products (
    sku_code,
    name,
    brand,
    model,
    model_code,
    model_codes,
    category,
    quality_grade,
    stock_status,
    moq,
    cost_price,
    retail_price,
    b2b_price,
    vat_mode,
    warranty_days,
    weight_gram,
    stock_qty,
    location,
    batch_code,
    supplier,
    compatibility_models,
    highlights,
    status,
    image_path,
    image_alt,
    gallery_image_paths
  )
  values (
    v_sku,
    nullif(btrim(coalesce(p_product ->> 'name', '')), ''),
    coalesce(nullif(btrim(p_product ->> 'brand'), ''), 'PartsPro'),
    nullif(btrim(p_product ->> 'model'), ''),
    nullif(btrim(p_product ->> 'model_code'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product -> 'model_codes', '[]'::jsonb))), '{}'::text[]),
    nullif(btrim(coalesce(p_product ->> 'category', '')), ''),
    coalesce(nullif(btrim(p_product ->> 'quality_grade'), ''), 'A'),
    private.partspro_stock_status(v_stock_qty),
    greatest(coalesce((p_product ->> 'moq')::integer, 1), 1),
    greatest(coalesce((p_product ->> 'cost_price')::numeric, 0), 0),
    greatest(coalesce((p_product ->> 'retail_price')::numeric, 0), 0),
    greatest(coalesce((p_product ->> 'b2b_price')::numeric, 0), 0),
    coalesce(nullif(btrim(p_product ->> 'vat_mode'), ''), 'IVA esclusa'),
    greatest(coalesce((p_product ->> 'warranty_days')::integer, 180), 0),
    greatest(coalesce((p_product ->> 'weight_gram')::integer, 0), 0),
    v_stock_qty,
    nullif(btrim(p_product ->> 'location'), ''),
    nullif(btrim(p_product ->> 'batch_code'), ''),
    nullif(btrim(p_product ->> 'supplier'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product -> 'compatibility_models', '[]'::jsonb))), '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product -> 'highlights', '[]'::jsonb))), '{}'::text[]),
    'draft',
    nullif(btrim(p_product ->> 'image_path'), ''),
    nullif(btrim(p_product ->> 'image_alt'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product -> 'gallery_image_paths', '[]'::jsonb))), '{}'::text[])
  )
  returning * into v_row;

  insert into public.inventory_items (
    sku_code,
    product_name,
    brand,
    model,
    quality_grade,
    batch_code,
    location,
    actual_qty,
    available_qty,
    locked_qty,
    supplier,
    last_movement_at
  )
  values (
    v_row.sku_code,
    v_row.name,
    v_row.brand,
    v_row.model,
    v_row.quality_grade,
    v_row.batch_code,
    v_row.location,
    v_row.stock_qty,
    v_row.stock_qty,
    0,
    v_row.supplier,
    now()
  );

  perform private.partspro_audit_product(
    'product.create_draft',
    null,
    v_row,
    p_reason,
    jsonb_build_object('inventory_action', 'initial_stock')
  );

  return v_row;
end;
$$;

create or replace function private.admin_update_product(
  p_sku_code text,
  p_product jsonb,
  p_reason text default ''
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.products%rowtype;
  v_after public.products%rowtype;
begin
  if p_product ? 'sku_code' or p_product ? 'sku' then
    raise exception 'SKU cannot be changed through product PATCH' using errcode = '23514';
  end if;

  if p_product ? 'stock_qty' or p_product ? 'stock' or p_product ? 'stock_status' then
    raise exception 'Stock must be adjusted through admin_adjust_product_stock' using errcode = '23514';
  end if;

  if p_product ? 'status' or p_product ? 'catalog_status' then
    raise exception 'Catalog status must be changed through product action RPCs' using errcode = '23514';
  end if;

  if p_product ?| array['b2b_price', 'retail_price', 'tier_prices', 'vat_mode'] then
    perform private.partspro_assert_permission('product.edit_price');
  end if;

  if p_product ? 'cost_price' then
    perform private.partspro_assert_permission('product.edit_cost');
  end if;

  if p_product ?| array['image_path', 'image_alt', 'gallery_image_paths'] then
    perform private.partspro_assert_permission('product.image_manage');
  end if;

  if p_product ?| array[
    'name',
    'brand',
    'model',
    'model_code',
    'model_codes',
    'category',
    'quality_grade',
    'moq',
    'warranty_days',
    'weight_gram',
    'location',
    'batch_code',
    'supplier',
    'compatibility_models',
    'highlights'
  ] then
    perform private.partspro_assert_permission('product.edit_content');
  end if;

  select *
  into v_before
  from public.products
  where sku_code = upper(btrim(p_sku_code))
  for update;

  if v_before.id is null then
    raise exception 'Product % was not found', p_sku_code using errcode = '23503';
  end if;

  update public.products
  set
    name = case when p_product ? 'name' then nullif(btrim(p_product ->> 'name'), '') else name end,
    brand = case when p_product ? 'brand' then nullif(btrim(p_product ->> 'brand'), '') else brand end,
    model = case when p_product ? 'model' then nullif(btrim(p_product ->> 'model'), '') else model end,
    model_code = case when p_product ? 'model_code' then nullif(btrim(p_product ->> 'model_code'), '') else model_code end,
    model_codes = case when p_product ? 'model_codes' then coalesce(array(select jsonb_array_elements_text(p_product -> 'model_codes')), '{}'::text[]) else model_codes end,
    category = case when p_product ? 'category' then nullif(btrim(p_product ->> 'category'), '') else category end,
    quality_grade = case when p_product ? 'quality_grade' then nullif(btrim(p_product ->> 'quality_grade'), '') else quality_grade end,
    moq = case when p_product ? 'moq' then greatest((p_product ->> 'moq')::integer, 1) else moq end,
    cost_price = case when p_product ? 'cost_price' then greatest((p_product ->> 'cost_price')::numeric, 0) else cost_price end,
    retail_price = case when p_product ? 'retail_price' then greatest((p_product ->> 'retail_price')::numeric, 0) else retail_price end,
    b2b_price = case when p_product ? 'b2b_price' then greatest((p_product ->> 'b2b_price')::numeric, 0) else b2b_price end,
    vat_mode = case when p_product ? 'vat_mode' then coalesce(nullif(btrim(p_product ->> 'vat_mode'), ''), vat_mode) else vat_mode end,
    warranty_days = case when p_product ? 'warranty_days' then greatest((p_product ->> 'warranty_days')::integer, 0) else warranty_days end,
    weight_gram = case when p_product ? 'weight_gram' then greatest((p_product ->> 'weight_gram')::integer, 0) else weight_gram end,
    location = case when p_product ? 'location' then nullif(btrim(p_product ->> 'location'), '') else location end,
    batch_code = case when p_product ? 'batch_code' then nullif(btrim(p_product ->> 'batch_code'), '') else batch_code end,
    supplier = case when p_product ? 'supplier' then nullif(btrim(p_product ->> 'supplier'), '') else supplier end,
    compatibility_models = case when p_product ? 'compatibility_models' then coalesce(array(select jsonb_array_elements_text(p_product -> 'compatibility_models')), '{}'::text[]) else compatibility_models end,
    highlights = case when p_product ? 'highlights' then coalesce(array(select jsonb_array_elements_text(p_product -> 'highlights')), '{}'::text[]) else highlights end,
    image_path = case when p_product ? 'image_path' then nullif(btrim(p_product ->> 'image_path'), '') else image_path end,
    image_alt = case when p_product ? 'image_alt' then nullif(btrim(p_product ->> 'image_alt'), '') else image_alt end,
    gallery_image_paths = case when p_product ? 'gallery_image_paths' then coalesce(array(select jsonb_array_elements_text(p_product -> 'gallery_image_paths')), '{}'::text[]) else gallery_image_paths end,
    updated_at = now()
  where id = v_before.id
  returning * into v_after;

  update public.inventory_items
  set
    product_name = v_after.name,
    brand = v_after.brand,
    model = v_after.model,
    quality_grade = v_after.quality_grade,
    batch_code = coalesce(batch_code, v_after.batch_code),
    location = coalesce(location, v_after.location),
    supplier = coalesce(supplier, v_after.supplier),
    last_movement_at = now()
  where sku_code = v_after.sku_code;

  perform private.partspro_audit_product('product.update', v_before, v_after, p_reason, p_product);
  return v_after;
end;
$$;

create or replace function private.admin_set_product_status(
  p_sku_code text,
  p_status text,
  p_reason text default ''
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_issues text[];
  v_action text;
begin
  if p_status = 'active' then
    perform private.partspro_assert_permission('product.publish');
  elsif p_status = 'hidden' then
    perform private.partspro_assert_permission('product.hide');
  elsif p_status = 'blocked' then
    perform private.partspro_assert_permission('product.block');
  elsif p_status = 'draft' then
    perform private.partspro_assert_permission('product.restore_draft');
  else
    raise exception 'Invalid product status %', p_status using errcode = '23514';
  end if;

  select *
  into v_before
  from public.products
  where sku_code = upper(btrim(p_sku_code))
  for update;

  if v_before.id is null then
    raise exception 'Product % was not found', p_sku_code using errcode = '23503';
  end if;

  if p_status = 'active' then
    v_issues := private.partspro_product_publish_issues(v_before);
    if cardinality(v_issues) > 0 then
      raise exception 'Product is not publishable: %', array_to_string(v_issues, ', ') using errcode = '23514';
    end if;
  end if;

  update public.products
  set
    status = p_status,
    stock_status = case when p_status = 'hidden' then stock_status else private.partspro_stock_status(stock_qty) end,
    updated_at = now()
  where id = v_before.id
  returning * into v_after;

  v_action := case p_status
    when 'active' then 'product.publish'
    when 'hidden' then 'product.hide'
    when 'blocked' then 'product.block'
    else 'product.restore_draft'
  end;

  perform private.partspro_audit_product(v_action, v_before, v_after, p_reason, jsonb_build_object('status', p_status));
  return v_after;
end;
$$;

create or replace function private.admin_adjust_product_stock(
  p_sku_code text,
  p_action text,
  p_quantity integer,
  p_reason text,
  p_location text default null,
  p_batch_code text default null,
  p_supplier text default null
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_inventory public.inventory_items%rowtype;
  v_delta integer;
  v_next_stock integer;
begin
  perform private.partspro_assert_permission('product.adjust_stock');

  if p_quantity is null or p_quantity < 0 then
    raise exception 'Stock quantity must be non-negative' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Stock adjustment reason is required' using errcode = '23514';
  end if;

  select *
  into v_before
  from public.products
  where sku_code = upper(btrim(p_sku_code))
  for update;

  if v_before.id is null then
    raise exception 'Product % was not found', p_sku_code using errcode = '23503';
  end if;

  if p_action in ('receive', 'rma_return', 'release') then
    v_delta := p_quantity;
    v_next_stock := v_before.stock_qty + v_delta;
  elsif p_action = 'scrap' then
    v_delta := -p_quantity;
    v_next_stock := v_before.stock_qty + v_delta;
  elsif p_action = 'cycle_count' then
    v_next_stock := p_quantity;
    v_delta := v_next_stock - v_before.stock_qty;
  else
    raise exception 'Invalid stock adjustment action %', p_action using errcode = '23514';
  end if;

  if v_next_stock < 0 then
    raise exception 'Stock adjustment would make product stock negative' using errcode = '23514';
  end if;

  update public.products
  set
    stock_qty = v_next_stock,
    stock_status = private.partspro_stock_status(v_next_stock),
    location = coalesce(nullif(btrim(p_location), ''), location),
    batch_code = coalesce(nullif(btrim(p_batch_code), ''), batch_code),
    supplier = coalesce(nullif(btrim(p_supplier), ''), supplier),
    updated_at = now()
  where id = v_before.id
  returning * into v_after;

  select *
  into v_inventory
  from public.inventory_items
  where sku_code = v_after.sku_code
    and (p_location is null or location is not distinct from p_location)
    and (p_batch_code is null or batch_code is not distinct from p_batch_code)
  order by last_movement_at desc
  limit 1
  for update;

  if v_inventory.id is null then
    insert into public.inventory_items (
      sku_code,
      product_name,
      brand,
      model,
      quality_grade,
      batch_code,
      location,
      actual_qty,
      available_qty,
      locked_qty,
      supplier,
      last_movement_at
    )
    values (
      v_after.sku_code,
      v_after.name,
      v_after.brand,
      v_after.model,
      v_after.quality_grade,
      coalesce(nullif(btrim(p_batch_code), ''), v_after.batch_code),
      coalesce(nullif(btrim(p_location), ''), v_after.location),
      greatest(v_delta, 0),
      greatest(v_delta, 0),
      0,
      coalesce(nullif(btrim(p_supplier), ''), v_after.supplier),
      now()
    );
  elsif p_action = 'cycle_count' then
    update public.inventory_items
    set
      actual_qty = v_next_stock + locked_qty,
      available_qty = v_next_stock,
      product_name = v_after.name,
      brand = v_after.brand,
      model = v_after.model,
      quality_grade = v_after.quality_grade,
      supplier = coalesce(nullif(btrim(p_supplier), ''), supplier, v_after.supplier),
      last_movement_at = now()
    where id = v_inventory.id;
  else
    update public.inventory_items
    set
      actual_qty = greatest(actual_qty + v_delta, locked_qty),
      available_qty = greatest(available_qty + v_delta, 0),
      product_name = v_after.name,
      brand = v_after.brand,
      model = v_after.model,
      quality_grade = v_after.quality_grade,
      supplier = coalesce(nullif(btrim(p_supplier), ''), supplier, v_after.supplier),
      last_movement_at = now()
    where id = v_inventory.id;
  end if;

  perform private.partspro_audit_product(
    'product.stock_adjust',
    v_before,
    v_after,
    p_reason,
    jsonb_build_object(
      'action', p_action,
      'quantity', p_quantity,
      'delta', v_delta,
      'location', p_location,
      'batch_code', p_batch_code,
      'supplier', p_supplier
    )
  );

  return v_after;
end;
$$;

create or replace function private.admin_set_product_images(
  p_sku_code text,
  p_image_path text,
  p_image_alt text,
  p_gallery_image_paths text[],
  p_reason text default ''
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_prefix text := 'products/' || lower(upper(btrim(p_sku_code))) || '/';
  v_path text;
begin
  perform private.partspro_assert_permission('product.image_manage');

  if p_image_path is not null and p_image_path <> '' and lower(p_image_path) not like v_prefix || '%' then
    raise exception 'Product image path must live under %', v_prefix using errcode = '23514';
  end if;

  foreach v_path in array coalesce(p_gallery_image_paths, '{}'::text[]) loop
    if v_path <> '' and lower(v_path) not like v_prefix || '%' then
      raise exception 'Gallery image path % must live under %', v_path, v_prefix using errcode = '23514';
    end if;
  end loop;

  select *
  into v_before
  from public.products
  where sku_code = upper(btrim(p_sku_code))
  for update;

  if v_before.id is null then
    raise exception 'Product % was not found', p_sku_code using errcode = '23503';
  end if;

  update public.products
  set
    image_path = nullif(btrim(coalesce(p_image_path, '')), ''),
    image_alt = nullif(btrim(coalesce(p_image_alt, '')), ''),
    gallery_image_paths = coalesce(p_gallery_image_paths, '{}'::text[]),
    updated_at = now()
  where id = v_before.id
  returning * into v_after;

  perform private.partspro_audit_product(
    'product.images_update',
    v_before,
    v_after,
    p_reason,
    jsonb_build_object('image_path', p_image_path, 'gallery_count', cardinality(coalesce(p_gallery_image_paths, '{}'::text[])))
  );

  return v_after;
end;
$$;

create or replace function public.admin_create_product_draft(
  p_product jsonb,
  p_reason text default ''
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_create_product_draft(p_product, p_reason)
$$;

create or replace function public.admin_update_product(
  p_sku_code text,
  p_product jsonb,
  p_reason text default ''
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_update_product(p_sku_code, p_product, p_reason)
$$;

create or replace function public.admin_publish_product(
  p_sku_code text,
  p_reason text default ''
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_set_product_status(p_sku_code, 'active', p_reason)
$$;

create or replace function public.admin_hide_product(
  p_sku_code text,
  p_reason text default ''
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_set_product_status(p_sku_code, 'hidden', p_reason)
$$;

create or replace function public.admin_block_product(
  p_sku_code text,
  p_reason text default ''
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_set_product_status(p_sku_code, 'blocked', p_reason)
$$;

create or replace function public.admin_restore_product_draft(
  p_sku_code text,
  p_reason text default ''
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_set_product_status(p_sku_code, 'draft', p_reason)
$$;

create or replace function public.admin_adjust_product_stock(
  p_sku_code text,
  p_action text,
  p_quantity integer,
  p_reason text,
  p_location text default null,
  p_batch_code text default null,
  p_supplier text default null
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_adjust_product_stock(
    p_sku_code,
    p_action,
    p_quantity,
    p_reason,
    p_location,
    p_batch_code,
    p_supplier
  )
$$;

create or replace function public.admin_set_product_images(
  p_sku_code text,
  p_image_path text,
  p_image_alt text,
  p_gallery_image_paths text[],
  p_reason text default ''
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_set_product_images(
    p_sku_code,
    p_image_path,
    p_image_alt,
    p_gallery_image_paths,
    p_reason
  )
$$;

revoke execute on function public.admin_create_product_draft(jsonb, text) from anon;
revoke execute on function public.admin_update_product(text, jsonb, text) from anon;
revoke execute on function public.admin_publish_product(text, text) from anon;
revoke execute on function public.admin_hide_product(text, text) from anon;
revoke execute on function public.admin_block_product(text, text) from anon;
revoke execute on function public.admin_restore_product_draft(text, text) from anon;
revoke execute on function public.admin_adjust_product_stock(text, text, integer, text, text, text, text) from anon;
revoke execute on function public.admin_set_product_images(text, text, text, text[], text) from anon;

grant execute on function public.admin_create_product_draft(jsonb, text) to authenticated;
grant execute on function public.admin_update_product(text, jsonb, text) to authenticated;
grant execute on function public.admin_publish_product(text, text) to authenticated;
grant execute on function public.admin_hide_product(text, text) to authenticated;
grant execute on function public.admin_block_product(text, text) to authenticated;
grant execute on function public.admin_restore_product_draft(text, text) to authenticated;
grant execute on function public.admin_adjust_product_stock(text, text, integer, text, text, text, text) to authenticated;
grant execute on function public.admin_set_product_images(text, text, text, text[], text) to authenticated;

do $$
begin
  drop policy if exists "partspro_product_images_staff_insert" on storage.objects;
  drop policy if exists "partspro_product_images_staff_select" on storage.objects;
  drop policy if exists "partspro_product_images_staff_update" on storage.objects;
  drop policy if exists "partspro_product_images_staff_delete" on storage.objects;

  create policy "partspro_product_images_staff_select"
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'product-images'
      and name like 'products/%'
      and (select private.is_staff())
    );

  create policy "partspro_product_images_staff_insert"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'product-images'
      and name like 'products/%'
      and (select private.partspro_has_permission('product.image_manage'))
    );

  create policy "partspro_product_images_staff_update"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'product-images'
      and name like 'products/%'
      and (select private.partspro_has_permission('product.image_manage'))
    )
    with check (
      bucket_id = 'product-images'
      and name like 'products/%'
      and (select private.partspro_has_permission('product.image_manage'))
    );

  create policy "partspro_product_images_staff_delete"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'product-images'
      and name like 'products/%'
      and (select private.partspro_has_permission('product.image_manage'))
    );
end $$;
