-- Read-only post-migration smoke checks for TASK-20260828-01.
--
-- Execute after the display projection migration in a controlled session. This
-- script intentionally performs no INSERT/UPDATE/DELETE and does not change
-- products, compatibility relations, inventory, prices, orders, grants, or
-- RLS. The snapshot constants below are fail-closed guards from the successful
-- 2026-08-28 production read-only query; refresh the baseline deliberately if
-- business data changes before a future apply.

-- Baseline/result capture for before-vs-after comparison.
select
  (select count(*) from public.products where status = 'active') as active_product_count,
  (select coalesce(sum(stock_qty), 0) from public.products where status = 'active') as active_product_stock_qty,
  (select count(*) from public.inventory_items) as inventory_item_count,
  (select coalesce(sum(available_qty), 0) from public.inventory_items) as inventory_available_qty,
  (select coalesce(sum(locked_qty), 0) from public.inventory_items) as inventory_locked_qty,
  (select coalesce(sum(actual_qty), 0) from public.inventory_items) as inventory_actual_qty,
  (select count(*) from public.catalog_product_device_models) as projection_row_count,
  (select count(*) from public.catalog_model_options) as menu_row_count;

do $$
declare
  expected record;
  expected_menu_count integer;
  expected_projection_count integer;
  mapped_row_count integer;
  canonical_variant_count integer;
  duplicate_identity_count integer;
  active_product_count integer;
  active_product_stock_qty integer;
  inventory_item_count integer;
  inventory_available_qty integer;
  inventory_locked_qty integer;
  inventory_actual_qty integer;
  canonical_products uuid[];
  alias_products uuid[];
begin
  select count(*) into expected_projection_count
  from public.catalog_product_device_models;
  if expected_projection_count <> 885 then
    raise exception 'catalog_product_device_models count changed: expected 885, got %', expected_projection_count;
  end if;

  select count(*) into expected_menu_count
  from public.catalog_model_options;
  if expected_menu_count <> 417 then
    raise exception 'catalog_model_options count changed: expected 417, got %', expected_menu_count;
  end if;

  -- Every one of the 45 legacy whitelist rows is display-folded while its
  -- device identity remains legacy/null. The exact raw value stays searchable.
  for expected in
    select * from (values
      ('Apple', 'iPhone 16E', 'iPhone 16e'),
      ('Apple', 'iPhone 17E', 'iPhone 17e'),
      ('Honor', 'X7B', 'X7b'),
      ('Honor', 'X8A', 'X8a'),
      ('Motorola', 'Moto E7I Power', 'Moto E7i Power'),
      ('OPPO', 'A17 CPH2477', 'A17'),
      ('OPPO', 'A38 CPH2579', 'A38'),
      ('OPPO', 'A40 CPH2669', 'A40'),
      ('OPPO', 'A5 Pro 5G CPH2695', 'A5 Pro 5G'),
      ('OPPO', 'A5 Pro CPH2711', 'A5 Pro'),
      ('OPPO', 'A57 CPH2387', 'A57'),
      ('OPPO', 'A57S 4G', 'A57s 4G'),
      ('OPPO', 'A58 4G CPH2577', 'A58 4G'),
      ('OPPO', 'A78 5G CPH2483', 'A78 5G'),
      ('OPPO', 'A79 5G CPH2553', 'A79 5G'),
      ('OPPO', 'A98 5G CPH2529', 'A98 5G'),
      ('Realme', 'C21 Y', 'C21-Y'),
      ('Samsung', 'Galaxy A02 A022F', 'Galaxy A02'),
      ('Samsung', 'Galaxy A03 A035G', 'Galaxy A03'),
      ('Samsung', 'Galaxy A04E A042', 'Galaxy A04e'),
      ('Samsung', 'Galaxy A06 5G A066', 'Galaxy A06 5G'),
      ('Samsung', 'Galaxy A06 A065', 'Galaxy A06'),
      ('Samsung', 'Galaxy A12 A125', 'Galaxy A12'),
      ('Samsung', 'Galaxy A12 Nacho A127', 'Galaxy A12 Nacho'),
      ('Samsung', 'Galaxy A13 4G A135', 'Galaxy A13 4G'),
      ('Samsung', 'Galaxy A13 5G A136', 'Galaxy A13 5G'),
      ('Samsung', 'Galaxy A14 5G A146P', 'Galaxy A14 5G'),
      ('Samsung', 'Galaxy A16 4G A165', 'Galaxy A16 4G'),
      ('Samsung', 'Galaxy A16 5G A166', 'Galaxy A16 5G'),
      ('Samsung', 'Galaxy A17 4G A175', 'Galaxy A17 4G'),
      ('Samsung', 'Galaxy A17 5G A176', 'Galaxy A17 5G'),
      ('Samsung', 'Galaxy A20S A207', 'Galaxy A20s'),
      ('Samsung', 'Galaxy A22 4G A225', 'Galaxy A22 4G'),
      ('Samsung', 'Galaxy A23 4G A235', 'Galaxy A23 4G'),
      ('Samsung', 'Galaxy A23 5G A236', 'Galaxy A23 5G'),
      ('Samsung', 'Galaxy A26 5G A266', 'Galaxy A26 5G'),
      ('Samsung', 'Galaxy A31 A315', 'Galaxy A31'),
      ('Samsung', 'Galaxy A32 4G A325', 'Galaxy A32 4G'),
      ('Samsung', 'Galaxy A32 5G A326', 'Galaxy A32 5G'),
      ('Samsung', 'Galaxy A36 5G A366', 'Galaxy A36 5G'),
      ('Samsung', 'Galaxy A42 5G A426', 'Galaxy A42 5G'),
      ('Samsung', 'Galaxy A56 5G A566', 'Galaxy A56 5G'),
      ('Samsung', 'Galaxy A73 5G A736', 'Galaxy A73 5G'),
      ('Vivo', 'Y28S 5G', 'Y28s 5G'),
      ('Vivo', 'Y29S 5G', 'Y29s 5G')
    ) as whitelist(brand, raw_model, canonical_model)
  loop
    select count(*) into mapped_row_count
    from public.catalog_product_device_models as option
    where option.brand = expected.brand
      and option.model = expected.canonical_model
      and option.model_source = 'legacy'
      and option.device_model_id is null
      and option.normalized_key is null
      and option.aliases @> array[expected.raw_model]::text[];

    if mapped_row_count = 0 then
      raise exception
        'Display whitelist row is not folded/searchable: brand %, raw %, canonical %',
        expected.brand,
        expected.raw_model,
        expected.canonical_model;
    end if;
  end loop;

  -- Wiko entries are the three approved canonical-prefix display-only cases.
  for expected in
    select * from (values
      ('Wiko', 'Wiko Power U10', 'Power U10'),
      ('Wiko', 'Wiko Power U20', 'Power U20'),
      ('Wiko', 'Wiko Power U30', 'Power U30')
    ) as prefixes(brand, raw_model, display_model)
  loop
    if not exists (
      select 1
      from public.catalog_product_device_models as option
      where option.brand = expected.brand
        and option.model = expected.display_model
        and option.model_source = 'normalized'
        and option.device_model_id is not null
        and option.aliases @> array[expected.raw_model]::text[]
    ) then
      raise exception
        'Wiko prefix display projection missing: raw %, display %',
        expected.raw_model,
        expected.display_model;
    end if;
  end loop;

  -- The normalized branch must stay one row per product/device identity even
  -- when several legacy raw values aggregate to the same canonical device.
  select count(*) into duplicate_identity_count
  from (
    select option.product_id, option.device_model_id
    from public.catalog_product_device_models as option
    where option.model_source = 'normalized'
    group by option.product_id, option.device_model_id
    having count(*) > 1
  ) as duplicates;
  if duplicate_identity_count <> 0 then
    raise exception
      'normalized duplicate identity rows detected: %',
      duplicate_identity_count;
  end if;

  -- Three case-only legacy values must be inherited by normalized PDC rows,
  -- not left only on the legacy side of the projection.
  for expected in
    select * from (values
      ('OPPO', 'A57s 4G', 'A57S 4G'),
      ('Vivo', 'Y28s 5G', 'Y28S 5G'),
      ('Vivo', 'Y29s 5G', 'Y29S 5G')
    ) as normalized_aliases(brand, canonical_model, raw_model)
  loop
    if not exists (
      select 1
      from public.catalog_product_device_models as option
      where option.brand = expected.brand
        and option.model = expected.canonical_model
        and option.model_source = 'normalized'
        and option.aliases @> array[expected.raw_model]::text[]
    ) then
      raise exception
        'normalized alias inheritance missing: brand %, canonical %, raw %',
        expected.brand,
        expected.canonical_model,
        expected.raw_model;
    end if;
  end loop;

  -- Four Samsung radio variants remain four distinct menu identities and no
  -- cross-radio raw value is attached to the wrong display.
  select count(distinct option.model) into canonical_variant_count
  from public.catalog_model_options as option
  where option.brand = 'Samsung'
    and option.model in (
      'Galaxy A16 4G',
      'Galaxy A16 5G',
      'Galaxy A17 4G',
      'Galaxy A17 5G'
    );
  if canonical_variant_count <> 4 then
    raise exception 'Samsung A16/A17 radio variants collapsed unexpectedly: %', canonical_variant_count;
  end if;

  if exists (
    select 1
    from public.catalog_product_device_models as option
    where (option.model = 'Galaxy A16 4G' and option.aliases && array['Galaxy A16 5G A166']::text[])
       or (option.model = 'Galaxy A16 5G' and option.aliases && array['Galaxy A16 4G A165']::text[])
       or (option.model = 'Galaxy A17 4G' and option.aliases && array['Galaxy A17 5G A176']::text[])
       or (option.model = 'Galaxy A17 5G' and option.aliases && array['Galaxy A17 4G A175']::text[])
  ) then
    raise exception 'Samsung 4G/5G raw value crossed into the wrong canonical display';
  end if;

  -- Canonical and exact raw-alias searches return the same product set. These
  -- pairs include all four Samsung examples and three case regressions.
  for expected in
    select * from (values
      ('Samsung', 'Galaxy A16 4G', 'Galaxy A16 4G A165'),
      ('Samsung', 'Galaxy A16 5G', 'Galaxy A16 5G A166'),
      ('Samsung', 'Galaxy A17 4G', 'Galaxy A17 4G A175'),
      ('Samsung', 'Galaxy A17 5G', 'Galaxy A17 5G A176'),
      ('OPPO', 'A57s 4G', 'A57S 4G'),
      ('Vivo', 'Y28s 5G', 'Y28S 5G'),
      ('Vivo', 'Y29s 5G', 'Y29S 5G')
    ) as pairs(brand, canonical_model, alias_model)
  loop
    select coalesce(array_agg(summary.id order by summary.id), '{}'::uuid[])
      into canonical_products
    from public.catalog_public_summary as summary
    where summary.compatibility_brands @> array[expected.brand]::text[]
      and summary.compatibility_search_terms @> array[expected.canonical_model]::text[];

    select coalesce(array_agg(summary.id order by summary.id), '{}'::uuid[])
      into alias_products
    from public.catalog_public_summary as summary
    where summary.compatibility_brands @> array[expected.brand]::text[]
      and summary.compatibility_search_terms @> array[expected.alias_model]::text[];

    if cardinality(canonical_products) = 0
      or canonical_products is distinct from alias_products then
        raise exception
        'same_product_set mismatch for brand %, canonical %, alias %',
        expected.brand,
        expected.canonical_model,
        expected.alias_model;
    end if;
  end loop;

  -- A known unmatched legacy value remains visible and cannot acquire a device
  -- identity through this projection.
  if not exists (
    select 1
    from public.catalog_model_options
    where brand = 'REMAX'
      and model = 'CA10'
  ) then
    raise exception 'Unmatched REMAX CA10 disappeared from the menu';
  end if;

  if not exists (
    select 1
    from public.catalog_product_device_models
    where brand = 'REMAX'
      and model = 'CA10'
      and model_source = 'legacy'
      and device_model_id is null
      and normalized_key is null
      and aliases @> array['CA10']::text[]
  ) then
    raise exception 'unmatched_not_mapped guard failed for REMAX CA10';
  end if;

  -- Snapshot inventory/product invariants: a view-only migration must leave
  -- these values unchanged. Any intentional data drift requires a new baseline.
  select count(*), coalesce(sum(stock_qty), 0)
    into active_product_count, active_product_stock_qty
  from public.products
  where status = 'active';
  select count(*), coalesce(sum(available_qty), 0), coalesce(sum(locked_qty), 0), coalesce(sum(actual_qty), 0)
    into inventory_item_count, inventory_available_qty, inventory_locked_qty, inventory_actual_qty
  from public.inventory_items;

  if active_product_count <> 678
     or active_product_stock_qty <> 1702
     or inventory_item_count <> 17961
     or inventory_available_qty <> 1705
     or inventory_locked_qty <> 38
     or inventory_actual_qty <> 1743 then
    raise exception
      'Product/inventory snapshot changed: products %/%; inventory %/%/%/%',
      active_product_count,
      active_product_stock_qty,
      inventory_item_count,
      inventory_available_qty,
      inventory_locked_qty,
      inventory_actual_qty;
  end if;
end
$$;
