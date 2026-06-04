drop function if exists public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text);
drop function if exists private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text);

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
  p_batch_code text default null,
  p_supplier text default null
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
  v_total bigint := 0;
  v_products jsonb := '[]'::jsonb;
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
  filtered_products as (
    select
      p.id,
      p.sku_code,
      p.name,
      p.brand,
      p.model,
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
      coalesce(inv.actual_qty, p.stock_qty::bigint) as actual_qty,
      coalesce(inv.available_qty, p.stock_qty::bigint) as available_qty,
      coalesce(inv.locked_qty, 0) as locked_qty
    from public.products as p
    left join inventory_summary as inv on inv.sku_code = p.sku_code
    where (nullif(btrim(coalesce(p_q, '')), '') is null
        or p.name ilike '%' || btrim(p_q) || '%'
        or p.sku_code ilike '%' || btrim(p_q) || '%'
        or p.brand ilike '%' || btrim(p_q) || '%'
        or p.category ilike '%' || btrim(p_q) || '%'
        or p.model ilike '%' || btrim(p_q) || '%'
        or p.model_code ilike '%' || btrim(p_q) || '%'
        or p.batch_code ilike '%' || btrim(p_q) || '%'
        or p.supplier ilike '%' || btrim(p_q) || '%')
      and (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = p_brand)
      and (nullif(btrim(coalesce(p_category, '')), '') is null or p.category = p_category)
      and (nullif(btrim(coalesce(p_catalog_status, '')), '') is null or p.status = p_catalog_status)
      and (nullif(btrim(coalesce(p_stock_status, '')), '') is null or p.stock_status = p_stock_status)
      and (nullif(btrim(coalesce(p_warehouse, '')), '') is null or p.location = p_warehouse)
      and (nullif(btrim(coalesce(p_grade, '')), '') is null or p.quality_grade = p_grade)
      and (nullif(btrim(coalesce(p_batch_code, '')), '') is null or p.batch_code ilike '%' || btrim(p_batch_code) || '%')
      and (nullif(btrim(coalesce(p_supplier, '')), '') is null or p.supplier ilike '%' || btrim(p_supplier) || '%')
      and (
        nullif(btrim(coalesce(p_model, '')), '') is null
        or p.model = p_model
        or p_model = any(p.model_codes)
        or p.compatibility_models @> array[p_model]::text[]
      )
  )
  select count(*) into v_total
  from filtered_products;

  with inventory_summary as (
    select
      i.sku_code,
      coalesce(sum(i.actual_qty), 0) as actual_qty,
      coalesce(sum(i.available_qty), 0) as available_qty,
      coalesce(sum(i.locked_qty), 0) as locked_qty
    from public.inventory_items as i
    group by i.sku_code
  ),
  filtered_products as (
    select
      p.id,
      p.sku_code,
      p.name,
      p.brand,
      p.model,
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
      coalesce(inv.actual_qty, p.stock_qty::bigint) as actual_qty,
      coalesce(inv.available_qty, p.stock_qty::bigint) as available_qty,
      coalesce(inv.locked_qty, 0) as locked_qty
    from public.products as p
    left join inventory_summary as inv on inv.sku_code = p.sku_code
    where (nullif(btrim(coalesce(p_q, '')), '') is null
        or p.name ilike '%' || btrim(p_q) || '%'
        or p.sku_code ilike '%' || btrim(p_q) || '%'
        or p.brand ilike '%' || btrim(p_q) || '%'
        or p.category ilike '%' || btrim(p_q) || '%'
        or p.model ilike '%' || btrim(p_q) || '%'
        or p.model_code ilike '%' || btrim(p_q) || '%'
        or p.batch_code ilike '%' || btrim(p_q) || '%'
        or p.supplier ilike '%' || btrim(p_q) || '%')
      and (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = p_brand)
      and (nullif(btrim(coalesce(p_category, '')), '') is null or p.category = p_category)
      and (nullif(btrim(coalesce(p_catalog_status, '')), '') is null or p.status = p_catalog_status)
      and (nullif(btrim(coalesce(p_stock_status, '')), '') is null or p.stock_status = p_stock_status)
      and (nullif(btrim(coalesce(p_warehouse, '')), '') is null or p.location = p_warehouse)
      and (nullif(btrim(coalesce(p_grade, '')), '') is null or p.quality_grade = p_grade)
      and (nullif(btrim(coalesce(p_batch_code, '')), '') is null or p.batch_code ilike '%' || btrim(p_batch_code) || '%')
      and (nullif(btrim(coalesce(p_supplier, '')), '') is null or p.supplier ilike '%' || btrim(p_supplier) || '%')
      and (
        nullif(btrim(coalesce(p_model, '')), '') is null
        or p.model = p_model
        or p_model = any(p.model_codes)
        or p.compatibility_models @> array[p_model]::text[]
      )
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
  )
  select coalesce(jsonb_agg(to_jsonb(page_products)), '[]'::jsonb)
  into v_products
  from page_products;

  return jsonb_build_object(
    'products', coalesce(v_products, '[]'::jsonb),
    'total', coalesce(v_total, 0)
  );
end;
$$;

create or replace function public.admin_list_products(
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
  p_batch_code text default null,
  p_supplier text default null
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_list_products(
    p_limit,
    p_offset,
    p_q,
    p_brand,
    p_model,
    p_category,
    p_catalog_status,
    p_stock_status,
    p_warehouse,
    p_grade,
    p_sort,
    p_batch_code,
    p_supplier
  )
$$;

revoke execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

revoke execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
