-- Catalog department navigation.
--
-- The existing `category` column remains the accessory/product type (screen,
-- battery, cable, and so on). `catalog_department` is the storefront's top
-- navigation level. Existing catalog data is phone-oriented except REMAX,
-- which belongs to general merchandise.

alter table public.products
  add column if not exists catalog_department text not null default 'phone';

update public.products
set catalog_department = case
  when lower(btrim(coalesce(brand, ''))) = 'remax' then 'general_merchandise'
  else coalesce(catalog_department, 'phone')
end
where catalog_department is null
   or (
     lower(btrim(coalesce(brand, ''))) = 'remax'
     and catalog_department is distinct from 'general_merchandise'
   );

alter table public.products
  alter column catalog_department set default 'phone';

alter table public.products
  add constraint products_catalog_department_check
  check (catalog_department in (
    'phone',
    'tablet',
    'computer',
    'general_merchandise'
  )) not valid;

alter table public.products
  validate constraint products_catalog_department_check;

alter table public.products
  alter column catalog_department set not null;

create or replace function private.partspro_products_catalog_department_default()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if lower(btrim(coalesce(new.brand, ''))) = 'remax' then
    new.catalog_department := 'general_merchandise';
  elsif new.catalog_department is null then
    new.catalog_department := 'phone';
  else
    new.catalog_department := lower(btrim(new.catalog_department));
  end if;

  return new;
end;
$$;

revoke all on function private.partspro_products_catalog_department_default()
  from PUBLIC, anon, authenticated;

drop trigger if exists partspro_products_catalog_department_default on public.products;
create trigger partspro_products_catalog_department_default
  before insert or update of brand, catalog_department
  on public.products
  for each row
  execute function private.partspro_products_catalog_department_default();

create index if not exists products_active_catalog_department_stock_idx
  on public.products (catalog_department, stock_qty desc, name)
  where status = 'active';

create index if not exists products_active_catalog_department_brand_stock_idx
  on public.products (catalog_department, brand, stock_qty desc, name)
  where status = 'active';

-- Preserve the existing public column allowlist. These catalog views are
-- security-invoker views, so callers also need SELECT on the new base column.
grant select (catalog_department) on table public.products to anon, authenticated;

create or replace view public.catalog_product_device_models
with (security_invoker = on)
as
select
  product.id as product_id,
  device.id as device_model_id,
  device.brand,
  device.canonical_name as model,
  device.normalized_key,
  device.aliases,
  device.model_codes,
  device.model_series,
  'normalized'::text as model_source,
  product.catalog_department
from public.products as product
join public.product_device_compatibilities as compatibility
  on compatibility.product_id = product.id
join public.device_models as device
  on device.id = compatibility.device_model_id
where product.status = 'active'
  and compatibility.review_status = 'approved'
  and device.status = 'active'

union all

select
  product.id as product_id,
  null::bigint as device_model_id,
  product.brand,
  legacy.model,
  null::text as normalized_key,
  '{}'::text[] as aliases,
  coalesce(product.model_codes, '{}'::text[]) as model_codes,
  private.partspro_model_series(product.brand, legacy.model) as model_series,
  'legacy'::text as model_source,
  product.catalog_department
from public.products as product
cross join lateral unnest(coalesce(product.compatibility_models, '{}'::text[])) as legacy(model)
where product.status = 'active'
  and nullif(btrim(legacy.model), '') is not null
  and not exists (
    select 1
    from public.product_device_compatibilities as compatibility
    join public.device_models as device
      on device.id = compatibility.device_model_id
    where compatibility.product_id = product.id
      and compatibility.review_status = 'approved'
      and device.status = 'active'
  );

revoke all on table public.catalog_product_device_models from PUBLIC, anon, authenticated;
grant select on table public.catalog_product_device_models to anon, authenticated, service_role;

create or replace view public.catalog_model_options
with (security_invoker = on)
as
select
  case
    when product.catalog_department = 'general_merchandise' then product.brand
    else coalesce(option.brand, product.brand)
  end as brand,
  option.model,
  option.model_series,
  product.catalog_department
from public.products as product
left join public.catalog_product_device_models as option
  on option.product_id = product.id
where product.status = 'active'
  and nullif(btrim(product.brand), '') is not null
group by
  case
    when product.catalog_department = 'general_merchandise' then product.brand
    else coalesce(option.brand, product.brand)
  end,
  option.model,
  option.model_series,
  product.catalog_department;

revoke all on table public.catalog_model_options from PUBLIC, anon, authenticated;
grant select on table public.catalog_model_options to anon, authenticated, service_role;

create or replace view public.catalog_public_summary
with (security_invoker = on)
as
select
  product.id,
  product.sku_code,
  product.name,
  product.brand,
  product.model,
  product.model_code,
  product.model_codes,
  product.category,
  product.quality_grade,
  product.color,
  product.frame,
  product.stock_status,
  product.stock_qty,
  product.location,
  product.moq,
  product.vat_mode,
  product.warranty_days,
  product.weight_gram,
  product.is_battery,
  product.is_dangerous_goods,
  product.msds_url,
  product.un38_url,
  product.compatibility,
  case
    when cardinality(compatibility.models) > 0 then compatibility.models
    else coalesce(product.compatibility_models, '{}'::text[])
  end as compatibility_models,
  product.alternative_skus,
  product.add_on_skus,
  product.highlights,
  product.image_path,
  product.image_alt,
  product.gallery_image_paths,
  product.updated_at,
  product.model_series,
  case
    when cardinality(compatibility.brands) > 0 then compatibility.brands
    else array_remove(array[product.brand], null)
  end as compatibility_brands,
  case
    when cardinality(compatibility.model_series) > 0 then compatibility.model_series
    else array_remove(array[product.model_series], null)
  end as compatibility_model_series,
  case
    when cardinality(compatibility.search_terms) > 0 then compatibility.search_terms
    else
      coalesce(product.compatibility_models, '{}'::text[])
      || coalesce(product.model_codes, '{}'::text[])
      || array_remove(array[product.model, product.model_code], null)
  end as compatibility_search_terms,
  product.catalog_department
from public.products as product
left join lateral (
  select
    coalesce(array_agg(distinct option.brand order by option.brand), '{}'::text[]) as brands,
    coalesce(array_agg(distinct option.model order by option.model), '{}'::text[]) as models,
    coalesce(
      array_agg(distinct option.model_series order by option.model_series)
        filter (where option.model_series is not null),
      '{}'::text[]
    ) as model_series,
    coalesce(
      array_agg(distinct term.value order by term.value)
        filter (where nullif(btrim(term.value), '') is not null),
      '{}'::text[]
    ) as search_terms
  from public.catalog_product_device_models as option
  left join lateral unnest(
    array[option.model]
    || coalesce(option.aliases, '{}'::text[])
    || coalesce(option.model_codes, '{}'::text[])
  ) as term(value)
    on true
  where option.product_id = product.id
) as compatibility
  on true
where product.status = 'active';

revoke all on table public.catalog_public_summary from PUBLIC, anon, authenticated;
grant select on table public.catalog_public_summary to anon, authenticated, service_role;

-- Keep the existing admin write signatures stable while adding the new field
-- to their JSON payload contracts.
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
  v_sku text := private.partspro_admin_clean_sku(p_product ->> 'sku_code');
  v_sku_source text := 'explicit';
  v_stock_qty integer := greatest(coalesce((p_product ->> 'stock_qty')::integer, 0), 0);
begin
  perform private.partspro_assert_permission('product.create_draft');

  if not private.partspro_admin_sku_is_valid(v_sku) then
    select candidate.sku, candidate.source
    into v_sku, v_sku_source
    from private.partspro_admin_product_sku_candidate(p_product) as candidate;
  end if;

  if not private.partspro_admin_sku_is_valid(v_sku) then
    raise exception 'sku_code could not be generated' using errcode = '23514';
  end if;

  if v_sku_source = 'internal' then
    v_sku := private.partspro_admin_unique_product_sku(v_sku);
  elsif exists (
    select 1
    from public.products as product
    where product.sku_code = v_sku
  ) then
    raise exception 'SKU % already exists', v_sku using errcode = '23505';
  end if;

  insert into public.products (
    sku_code,
    name,
    brand,
    model,
    model_code,
    model_codes,
    category,
    catalog_department,
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
    coalesce(nullif(lower(btrim(p_product ->> 'catalog_department')), ''), 'phone'),
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
    jsonb_build_object(
      'inventory_action', 'initial_stock',
      'sku_source', v_sku_source
    )
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
    'catalog_department',
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
    catalog_department = case when p_product ? 'catalog_department' then lower(btrim(p_product ->> 'catalog_department')) else catalog_department end,
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

create or replace function private.partspro_admin_update_product_guarded(
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
  v_product public.products%rowtype;
  v_unsupported_keys text[];
  v_allowed_keys constant text[] := array[
    'name',
    'brand',
    'model',
    'model_code',
    'model_codes',
    'category',
    'catalog_department',
    'quality_grade',
    'moq',
    'cost_price',
    'retail_price',
    'b2b_price',
    'vat_mode',
    'warranty_days',
    'weight_gram',
    'location',
    'batch_code',
    'supplier',
    'compatibility_models',
    'highlights',
    'image_path',
    'image_alt',
    'gallery_image_paths'
  ];
begin
  if p_product is null
     or jsonb_typeof(p_product) <> 'object'
     or p_product = '{}'::jsonb then
    raise exception 'Product update payload must be a non-empty JSON object'
      using errcode = '23514';
  end if;

  select coalesce(array_agg(payload_key order by payload_key), '{}'::text[])
  into v_unsupported_keys
  from jsonb_object_keys(p_product) as payload(payload_key)
  where not (payload_key = any(v_allowed_keys));

  if cardinality(v_unsupported_keys) > 0 then
    raise exception
      'Unsupported product update field(s): %',
      array_to_string(v_unsupported_keys, ', ')
      using errcode = '23514';
  end if;

  v_product := private.admin_update_product(p_sku_code, p_product, p_reason);

  if p_product ? 'compatibility_models' then
    perform private.partspro_sync_managed_product_compatibility(
      v_product.id,
      v_product.brand,
      array(
        select jsonb_array_elements_text(p_product -> 'compatibility_models')
      ),
      p_reason
    );
  end if;

  return v_product;
end;
$$;

create or replace function private.admin_get_product(p_sku_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product jsonb;
begin
  perform private.partspro_assert_admin_product_read();

  with inventory_summary as (
    select
      i.sku_code,
      coalesce(sum(i.actual_qty), 0) as actual_qty,
      coalesce(sum(i.available_qty), 0) as available_qty,
      coalesce(sum(i.locked_qty), 0) as locked_qty
    from public.inventory_items as i
    group by i.sku_code
  ),
  product_row as (
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
      p.catalog_department,
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
      coalesce(inv.actual_qty, p.stock_qty::bigint) as actual_qty,
      coalesce(inv.available_qty, p.stock_qty::bigint) as available_qty,
      coalesce(inv.locked_qty, 0) as locked_qty
    from public.products as p
    left join inventory_summary as inv on inv.sku_code = p.sku_code
    where p.sku_code = upper(btrim(p_sku_code))
    limit 1
  )
  select to_jsonb(product_row)
  into v_product
  from product_row;

  return v_product;
end;
$$;

-- Keep the existing 16-argument admin list RPC signature stable. The drawer
-- reuses these rows directly, so the department must be present in its JSON
-- result rather than inferred from the brand after every list refresh.
create or replace function private.admin_list_products(
  p_limit integer default 20,
  p_offset integer default 0,
  p_q text default null,
  p_brand text default null,
  p_model text default null,
  p_category text default null,
  p_catalog_status text default null,
  p_stock_status text default null,
  p_warehouse text default null,
  p_grade text default null,
  p_sort text default 'updated_desc',
  p_model_series text default null,
  p_supplier text default null,
  p_batch_code text default null,
  p_active_restock_only boolean default false,
  p_issue_filter text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'updated_desc');
  v_issue_filter text := nullif(btrim(coalesce(p_issue_filter, '')), '');
  v_products jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
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
$$;

comment on column public.products.catalog_department is
  'Top-level storefront department: phone, tablet, computer, or general_merchandise.';

comment on function private.partspro_products_catalog_department_default() is
  'Normalizes catalog departments and forces every REMAX product into general merchandise.';

-- CREATE OR REPLACE preserves function ACLs, but reassert the intended private
-- execution boundary so this migration is self-auditing.
revoke execute on function private.admin_create_product_draft(jsonb, text)
  from PUBLIC, anon, authenticated;
grant execute on function private.admin_create_product_draft(jsonb, text)
  to service_role;

revoke execute on function private.admin_update_product(text, jsonb, text)
  from PUBLIC, anon, authenticated;
grant execute on function private.admin_update_product(text, jsonb, text)
  to service_role;

revoke execute on function private.partspro_admin_update_product_guarded(text, jsonb, text)
  from PUBLIC, anon;
grant execute on function private.partspro_admin_update_product_guarded(text, jsonb, text)
  to authenticated, service_role;

revoke execute on function private.admin_get_product(text)
  from PUBLIC, anon;
grant execute on function private.admin_get_product(text)
  to authenticated;

revoke execute on function private.admin_list_products(
  integer, integer, text, text, text, text, text, text, text, text, text, text,
  text, text, boolean, text
) from PUBLIC, anon;
grant execute on function private.admin_list_products(
  integer, integer, text, text, text, text, text, text, text, text, text, text,
  text, text, boolean, text
) to authenticated;

notify pgrst, 'reload schema';

-- Post-apply verification (run separately; do not turn these into writes):
--
-- select catalog_department, count(*) as products,
--        count(*) filter (where status = 'active') as active_products
-- from public.products
-- group by catalog_department
-- order by catalog_department;
--
-- select count(*) as invalid_products
-- from public.products
-- where catalog_department is null
--    or catalog_department not in ('phone', 'tablet', 'computer', 'general_merchandise')
--    or (
--      lower(btrim(coalesce(brand, ''))) = 'remax'
--      and catalog_department <> 'general_merchandise'
--    );
--
-- select catalog_department, brand, count(*)
-- from public.catalog_model_options
-- group by catalog_department, brand
-- order by catalog_department, brand;
--
-- select
--   has_column_privilege('anon', 'public.products', 'catalog_department', 'select')
--     as anon_can_select_department,
--   has_column_privilege('authenticated', 'public.products', 'catalog_department', 'select')
--     as authenticated_can_select_department;
--
-- select c.relname, c.reloptions
-- from pg_class as c
-- join pg_namespace as n on n.oid = c.relnamespace
-- where n.nspname = 'public'
--   and c.relname in (
--     'catalog_product_device_models',
--     'catalog_model_options',
--     'catalog_public_summary'
--   )
-- order by c.relname;
--
-- Rollback risk: restore the prior view/function definitions first, then drop
-- the trigger, indexes, constraint, and column. Dropping the column discards
-- the new classifications, although no pre-existing product field is changed.
