alter table public.products
  add column if not exists model_series text;

create or replace function private.partspro_model_series(_brand text, _model text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when nullif(btrim(coalesce(_brand, '')), '') is null
      or nullif(btrim(coalesce(_model, '')), '') is null
      or lower(btrim(_brand)) = 'apple'
      then null
    when lower(btrim(_brand)) = 'samsung' then
      case
        when btrim(_model) ~* '\mgalaxy\s+z\M' then 'Galaxy Z'
        when btrim(_model) ~* '\mgalaxy\s+note\M' then 'Galaxy Note'
        when btrim(_model) ~* '\mgalaxy\s+xcover\M' then 'Galaxy XCover'
        when btrim(_model) ~* '\mgalaxy\s+s\s*\d' then 'Galaxy S'
        when btrim(_model) ~* '\mgalaxy\s+a\s*\d' then 'Galaxy A'
        when btrim(_model) ~* '\mgalaxy\s+m\s*\d' then 'Galaxy M'
        when btrim(_model) ~* '\mgalaxy\s+j\s*\d' then 'Galaxy J'
        else 'Galaxy Other'
      end
    when lower(btrim(_brand)) = 'xiaomi' then
      case
        when btrim(_model) ~* '^redmi\s+note\M' then 'Redmi Note'
        when btrim(_model) ~* '^redmi\M' then 'Redmi'
        when btrim(_model) ~* '^(poco|pocophone)\M' then 'POCO'
        when btrim(_model) ~* '^black\s+shark\M' then 'Black Shark'
        when btrim(_model) ~* '^mi\s+(mix|max)\M' then 'Mi Mix / Max'
        when btrim(_model) ~* '^mi\M' then 'Mi'
        else 'Xiaomi'
      end
    when lower(btrim(_brand)) = 'honor' then
      case
        when btrim(_model) ~* '\mmagic\M' then 'Honor Magic'
        when btrim(_model) ~* '\mplay\M' then 'Honor Play'
        when btrim(_model) ~* '\mview\M' then 'Honor View'
        when btrim(_model) ~* '\mx\s*\d' then 'Honor X'
        when btrim(_model) ~* '\d' then 'Honor Number'
        else 'Honor Other'
      end
    when lower(btrim(_brand)) = 'oppo' then
      case
        when btrim(_model) ~* '\mfind\M' then 'Find'
        when btrim(_model) ~* '\mreno\M' then 'Reno'
        when btrim(_model) ~* '\ma\s*\d' then 'A'
        when btrim(_model) ~* '\mf\s*\d' then 'F'
        when btrim(_model) ~* '\mrx\s*\d' then 'RX'
        else 'OPPO Other'
      end
    when lower(btrim(_brand)) = 'realme' then
      case
        when btrim(_model) ~* '\mnarzo\M' then 'Narzo'
        when btrim(_model) ~* '\mnote\M' then 'Note'
        when btrim(_model) ~* '\mgt\M' then 'GT'
        when btrim(_model) ~* '\mc\s*\d' then 'C'
        when btrim(_model) ~* '\mx\s*\d' then 'X'
        when btrim(_model) ~* '\mp\s*\d' then 'P'
        when btrim(_model) ~* '\d' then 'Realme Number'
        else 'Realme Other'
      end
    when lower(btrim(_brand)) = 'motorola' then
      case
        when btrim(_model) ~* '\medge\M' then 'Edge'
        when btrim(_model) ~* '\mrazr\M' then 'Razr'
        when btrim(_model) ~* '\mmoto\s+g\M' then 'Moto G'
        when btrim(_model) ~* '\mmoto\s+e\M' then 'Moto E'
        when btrim(_model) ~* '\mmoto\s+[xz]\M' then 'Moto X/Z'
        when btrim(_model) ~* '\m(one|defy|moto\s+c)\M' then 'One/C/Defy'
        else 'Motorola Other'
      end
    when lower(btrim(_brand)) = 'vivo' then
      case
        when btrim(_model) ~* '\miqoo\M' then 'iQOO'
        when btrim(_model) ~* '\mv\s*\d' then 'Vivo V'
        when btrim(_model) ~* '\mx\s*\d' then 'Vivo X'
        when btrim(_model) ~* '\my\s*\d' then 'Vivo Y'
        when btrim(_model) ~* '\mt\s*\d' then 'Vivo T'
        when btrim(_model) ~* '\ms\s*\d' then 'Vivo S'
        else 'Vivo'
      end
    when lower(btrim(_brand)) = 'tcl' then
      case
        when btrim(_model) ~* '\mnxtpaper\M' then 'TCL NXTPAPER'
        else 'TCL'
      end
    else initcap(lower(btrim(_brand))) || ' Other'
  end
$$;

create or replace function private.partspro_products_model_series_default()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT'
    or new.model_series is distinct from old.model_series then
    new.model_series := coalesce(
      nullif(btrim(new.model_series), ''),
      private.partspro_model_series(new.brand, new.model)
    );
  elsif new.brand is distinct from old.brand
    or new.model is distinct from old.model
    or nullif(btrim(coalesce(new.model_series, '')), '') is null then
    new.model_series := private.partspro_model_series(new.brand, new.model);
  end if;

  return new;
end;
$$;

drop trigger if exists partspro_products_model_series_default on public.products;
create trigger partspro_products_model_series_default
  before insert or update of brand, model, model_series
  on public.products
  for each row
  execute function private.partspro_products_model_series_default();

update public.products
set model_series = private.partspro_model_series(brand, model)
where nullif(btrim(coalesce(model_series, '')), '') is null
  and lower(btrim(coalesce(brand, ''))) <> 'apple';

create index if not exists products_brand_model_series_idx
  on public.products (brand, model_series, status, name);

create or replace view public.catalog_public_summary
with (security_invoker = on)
as
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
  p.color,
  p.frame,
  p.stock_status,
  p.stock_qty,
  p.location,
  p.moq,
  p.vat_mode,
  p.warranty_days,
  p.weight_gram,
  p.is_battery,
  p.is_dangerous_goods,
  p.msds_url,
  p.un38_url,
  p.compatibility,
  p.compatibility_models,
  p.alternative_skus,
  p.add_on_skus,
  p.highlights,
  p.image_path,
  p.image_alt,
  p.gallery_image_paths,
  p.updated_at,
  p.model_series
from public.products as p
where p.status = 'active';

create or replace view public.catalog_model_options
with (security_invoker = on)
as
select
  p.brand,
  model_option.model,
  private.partspro_model_series(p.brand, model_option.model) as model_series
from public.products as p
cross join lateral unnest(p.compatibility_models) as model_option(model)
where p.status = 'active'
  and nullif(btrim(p.brand), '') is not null
  and nullif(btrim(model_option.model), '') is not null
group by p.brand, model_option.model;

grant select on public.catalog_public_summary to anon, authenticated;
grant select on public.catalog_model_options to anon, authenticated;

grant select (
  model_series
) on public.products to anon, authenticated;

drop function if exists public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text);
drop function if exists private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text);

create or replace function private.admin_list_products(
  p_limit integer default 20,
  p_offset integer default 0,
  p_q text default null,
  p_brand text default null,
  p_model text default null,
  p_model_series text default null,
  p_category text default null,
  p_catalog_status text default null,
  p_stock_status text default null,
  p_warehouse text default null,
  p_grade text default null,
  p_sort text default 'updated_desc'
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
        or p.model_series ilike '%' || btrim(p_q) || '%'
        or p.model_code ilike '%' || btrim(p_q) || '%')
      and (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = p_brand)
      and (nullif(btrim(coalesce(p_model_series, '')), '') is null
        or p.model_series = p_model_series
        or exists (
          select 1
          from unnest(p.compatibility_models) as model_option(model)
          where private.partspro_model_series(p.brand, model_option.model) = p_model_series
        ))
      and (nullif(btrim(coalesce(p_category, '')), '') is null or p.category = p_category)
      and (nullif(btrim(coalesce(p_catalog_status, '')), '') is null or p.status = p_catalog_status)
      and (nullif(btrim(coalesce(p_stock_status, '')), '') is null or p.stock_status = p_stock_status)
      and (nullif(btrim(coalesce(p_warehouse, '')), '') is null or p.location = p_warehouse)
      and (nullif(btrim(coalesce(p_grade, '')), '') is null or p.quality_grade = p_grade)
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
        or p.model_series ilike '%' || btrim(p_q) || '%'
        or p.model_code ilike '%' || btrim(p_q) || '%')
      and (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = p_brand)
      and (nullif(btrim(coalesce(p_model_series, '')), '') is null
        or p.model_series = p_model_series
        or exists (
          select 1
          from unnest(p.compatibility_models) as model_option(model)
          where private.partspro_model_series(p.brand, model_option.model) = p_model_series
        ))
      and (nullif(btrim(coalesce(p_category, '')), '') is null or p.category = p_category)
      and (nullif(btrim(coalesce(p_catalog_status, '')), '') is null or p.status = p_catalog_status)
      and (nullif(btrim(coalesce(p_stock_status, '')), '') is null or p.stock_status = p_stock_status)
      and (nullif(btrim(coalesce(p_warehouse, '')), '') is null or p.location = p_warehouse)
      and (nullif(btrim(coalesce(p_grade, '')), '') is null or p.quality_grade = p_grade)
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
  p_model_series text default null,
  p_category text default null,
  p_catalog_status text default null,
  p_stock_status text default null,
  p_warehouse text default null,
  p_grade text default null,
  p_sort text default 'updated_desc'
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
    p_model_series,
    p_category,
    p_catalog_status,
    p_stock_status,
    p_warehouse,
    p_grade,
    p_sort
  )
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

create or replace function public.admin_get_product(p_sku_code text)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_get_product(p_sku_code)
$$;

revoke execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text) to authenticated;

revoke execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text) to authenticated;
