-- Catalog model display projection (reversible, display/search scope only).
--
-- The whitelist below is frozen from the 2026-08-28 Owner review snapshot. It
-- contains 45 exact legacy values and three canonical Wiko values whose
-- display-only prefix is removed. New values must not be inferred at runtime;
-- they remain legacy values until separately reviewed and added deliberately.
--
-- Legacy rows intentionally keep device_model_id and normalized_key NULL. A
-- display projection is not an approved product_device_compatibilities link.
-- This migration does not update products, product_device_compatibilities,
-- device_models, inventory, prices, orders, permissions, RLS policies, or
-- grants.
--
-- Rollback: execute
-- supabase/rollbacks/20260828105427_catalog_model_display_projection_rollback.sql
-- to restore the latest origin/main catalog view definitions.

create or replace view public.catalog_product_device_models
with (security_invoker = on)
as
with display_whitelist(brand, raw_model, canonical_name, display_model, map_kind) as (
  values
    ('Apple', 'iPhone 16E', 'iPhone 16e', 'iPhone 16e', 'legacy'),
    ('Apple', 'iPhone 17E', 'iPhone 17e', 'iPhone 17e', 'legacy'),
    ('Honor', 'X7B', 'X7b', 'X7b', 'legacy'),
    ('Honor', 'X8A', 'X8a', 'X8a', 'legacy'),
    ('Motorola', 'Moto E7I Power', 'Moto E7i Power', 'Moto E7i Power', 'legacy'),
    ('OPPO', 'A17 CPH2477', 'A17', 'A17', 'legacy'),
    ('OPPO', 'A38 CPH2579', 'A38', 'A38', 'legacy'),
    ('OPPO', 'A40 CPH2669', 'A40', 'A40', 'legacy'),
    ('OPPO', 'A5 Pro 5G CPH2695', 'A5 Pro 5G', 'A5 Pro 5G', 'legacy'),
    ('OPPO', 'A5 Pro CPH2711', 'A5 Pro', 'A5 Pro', 'legacy'),
    ('OPPO', 'A57 CPH2387', 'A57', 'A57', 'legacy'),
    ('OPPO', 'A57S 4G', 'A57s 4G', 'A57s 4G', 'legacy'),
    ('OPPO', 'A58 4G CPH2577', 'A58 4G', 'A58 4G', 'legacy'),
    ('OPPO', 'A78 5G CPH2483', 'A78 5G', 'A78 5G', 'legacy'),
    ('OPPO', 'A79 5G CPH2553', 'A79 5G', 'A79 5G', 'legacy'),
    ('OPPO', 'A98 5G CPH2529', 'A98 5G', 'A98 5G', 'legacy'),
    ('Realme', 'C21 Y', 'C21-Y', 'C21-Y', 'legacy'),
    ('Samsung', 'Galaxy A02 A022F', 'Galaxy A02', 'Galaxy A02', 'legacy'),
    ('Samsung', 'Galaxy A03 A035G', 'Galaxy A03', 'Galaxy A03', 'legacy'),
    ('Samsung', 'Galaxy A04E A042', 'Galaxy A04e', 'Galaxy A04e', 'legacy'),
    ('Samsung', 'Galaxy A06 5G A066', 'Galaxy A06 5G', 'Galaxy A06 5G', 'legacy'),
    ('Samsung', 'Galaxy A06 A065', 'Galaxy A06', 'Galaxy A06', 'legacy'),
    ('Samsung', 'Galaxy A12 A125', 'Galaxy A12', 'Galaxy A12', 'legacy'),
    ('Samsung', 'Galaxy A12 Nacho A127', 'Galaxy A12 Nacho', 'Galaxy A12 Nacho', 'legacy'),
    ('Samsung', 'Galaxy A13 4G A135', 'Galaxy A13 4G', 'Galaxy A13 4G', 'legacy'),
    ('Samsung', 'Galaxy A13 5G A136', 'Galaxy A13 5G', 'Galaxy A13 5G', 'legacy'),
    ('Samsung', 'Galaxy A14 5G A146P', 'Galaxy A14 5G', 'Galaxy A14 5G', 'legacy'),
    ('Samsung', 'Galaxy A16 4G A165', 'Galaxy A16 4G', 'Galaxy A16 4G', 'legacy'),
    ('Samsung', 'Galaxy A16 5G A166', 'Galaxy A16 5G', 'Galaxy A16 5G', 'legacy'),
    ('Samsung', 'Galaxy A17 4G A175', 'Galaxy A17 4G', 'Galaxy A17 4G', 'legacy'),
    ('Samsung', 'Galaxy A17 5G A176', 'Galaxy A17 5G', 'Galaxy A17 5G', 'legacy'),
    ('Samsung', 'Galaxy A20S A207', 'Galaxy A20s', 'Galaxy A20s', 'legacy'),
    ('Samsung', 'Galaxy A22 4G A225', 'Galaxy A22 4G', 'Galaxy A22 4G', 'legacy'),
    ('Samsung', 'Galaxy A23 4G A235', 'Galaxy A23 4G', 'Galaxy A23 4G', 'legacy'),
    ('Samsung', 'Galaxy A23 5G A236', 'Galaxy A23 5G', 'Galaxy A23 5G', 'legacy'),
    ('Samsung', 'Galaxy A26 5G A266', 'Galaxy A26 5G', 'Galaxy A26 5G', 'legacy'),
    ('Samsung', 'Galaxy A31 A315', 'Galaxy A31', 'Galaxy A31', 'legacy'),
    ('Samsung', 'Galaxy A32 4G A325', 'Galaxy A32 4G', 'Galaxy A32 4G', 'legacy'),
    ('Samsung', 'Galaxy A32 5G A326', 'Galaxy A32 5G', 'Galaxy A32 5G', 'legacy'),
    ('Samsung', 'Galaxy A36 5G A366', 'Galaxy A36 5G', 'Galaxy A36 5G', 'legacy'),
    ('Samsung', 'Galaxy A42 5G A426', 'Galaxy A42 5G', 'Galaxy A42 5G', 'legacy'),
    ('Samsung', 'Galaxy A56 5G A566', 'Galaxy A56 5G', 'Galaxy A56 5G', 'legacy'),
    ('Samsung', 'Galaxy A73 5G A736', 'Galaxy A73 5G', 'Galaxy A73 5G', 'legacy'),
    ('Vivo', 'Y28S 5G', 'Y28s 5G', 'Y28s 5G', 'legacy'),
    ('Vivo', 'Y29S 5G', 'Y29s 5G', 'Y29s 5G', 'legacy'),
    ('Wiko', 'Wiko Power U10', 'Wiko Power U10', 'Power U10', 'brand_prefix'),
  ('Wiko', 'Wiko Power U20', 'Wiko Power U20', 'Power U20', 'brand_prefix'),
  ('Wiko', 'Wiko Power U30', 'Wiko Power U30', 'Power U30', 'brand_prefix')
), approved_legacy_aliases(brand, canonical_name, aliases) as (
  -- Collapse all approved raw values for a canonical device before joining
  -- normalized rows; this keeps one product/device row per PDC identity.
  select
    brand,
    canonical_name,
    array_agg(raw_model order by raw_model)::text[] as aliases
  from display_whitelist
  where map_kind = 'legacy'
  group by brand, canonical_name
)
select
  product.id as product_id,
  device.id as device_model_id,
  device.brand,
  coalesce(display.display_model, device.canonical_name) as model,
  device.normalized_key,
  case
    when display.display_model is null and legacy_aliases.aliases is null
      then coalesce(device.aliases, '{}'::text[])
    else (
      select coalesce(
        array_agg(distinct alias_value.value order by alias_value.value)
          filter (where nullif(btrim(alias_value.value), '') is not null),
        '{}'::text[]
      )
      from unnest(
        coalesce(device.aliases, '{}'::text[])
        || array[device.canonical_name]
        || coalesce(legacy_aliases.aliases, '{}'::text[])
      ) as alias_value(value)
    )
  end as aliases,
  device.model_codes,
  device.model_series,
  'normalized'::text as model_source,
  product.catalog_department
from public.products as product
join public.product_device_compatibilities as compatibility
  on compatibility.product_id = product.id
join public.device_models as device
  on device.id = compatibility.device_model_id
left join display_whitelist as display
  on display.map_kind = 'brand_prefix'
  and display.brand = device.brand
  and display.raw_model = device.canonical_name
  and display.canonical_name = device.canonical_name
left join approved_legacy_aliases as legacy_aliases
  on legacy_aliases.brand = device.brand
  and legacy_aliases.canonical_name = device.canonical_name
where product.status = 'active'
  and compatibility.review_status = 'approved'
  and device.status = 'active'

union all

select
  product.id as product_id,
  null::bigint as device_model_id,
  product.brand,
  coalesce(display.display_model, legacy.model) as model,
  null::text as normalized_key,
  array[legacy.model]::text[] as aliases,
  coalesce(product.model_codes, '{}'::text[]) as model_codes,
  private.partspro_model_series(
    product.brand,
    coalesce(display.display_model, legacy.model)
  ) as model_series,
  'legacy'::text as model_source,
  product.catalog_department
from public.products as product
cross join lateral unnest(
  coalesce(product.compatibility_models, '{}'::text[])
) as legacy(model)
left join display_whitelist as display
  on display.map_kind = 'legacy'
  and display.brand = product.brand
  and display.raw_model = legacy.model
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
