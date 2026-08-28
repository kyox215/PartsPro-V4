-- Forward-only rollback for TASK-20260828-01.
--
-- Restores the three catalog views to the latest origin/main definitions
-- before 20260828105427. This file changes view definitions only; it does not
-- alter products, device_models, compatibility links, inventory, prices,
-- orders, permissions, RLS policies, or grants. Existing view grants are
-- preserved by CREATE OR REPLACE VIEW.

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
