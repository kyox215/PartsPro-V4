-- Owner-approved shared-screen navigation for one stocked Mobilax product.
-- Compatibility-only: product identity and inventory/commercial fields are immutable.

set local statement_timeout = '30s';

do $$
declare
  v_product_count integer;
  v_supplier_count integer;
  v_batch_count integer;
  v_existing_relation_count integer;
  v_archived_device_count integer;
  v_inventory_rows integer;
  v_inventory_available integer;
  v_inventory_actual integer;
  v_inventory_locked integer;
  v_product_stock integer;
begin
  select count(*)
  into v_product_count
  from public.products
  where sku_code = '3000000202050';

  if v_product_count <> 1 then
    raise exception 'Expected exactly one target product, found %', v_product_count;
  end if;

  if exists (
    select 1
    from public.products
    where sku_code = '3000000202050'
      and (
        name is distinct from 'OEM Display Touchscreen OnePlus Nord CE 3 Lite 5G OPPO A98 5G (CPH2529) Black'
        or status <> 'active'
        or category <> 'Schermi'
        or supplier is distinct from 'Mobilax ChinaTech'
        or batch_code is distinct from 'C9NS2AL2YZ1'
      )
  ) then
    raise exception 'Target product identity precondition failed';
  end if;

  select count(*)
  into v_supplier_count
  from public.suppliers
  where code = 'MOBILAX'
    and name = 'Mobilax ChinaTech'
    and display_label = 'Mobilax ChinaTech'
    and status = 'active';

  if v_supplier_count <> 1 then
    raise exception 'Expected one active Mobilax ChinaTech supplier, found %', v_supplier_count;
  end if;

  select count(*)
  into v_batch_count
  from public.supplier_batches as batch
  join public.suppliers as supplier on supplier.id = batch.supplier_id
  where batch.batch_code = 'C9NS2AL2YZ1'
    and supplier.code = 'MOBILAX'
    and supplier.name = 'Mobilax ChinaTech';

  if v_batch_count <> 1 then
    raise exception 'Expected one Mobilax batch C9NS2AL2YZ1, found %', v_batch_count;
  end if;

  select count(*)
  into v_existing_relation_count
  from public.product_device_compatibilities as compatibility
  join public.products as product on product.id = compatibility.product_id
  where product.sku_code = '3000000202050';

  if v_existing_relation_count <> 0 then
    raise exception 'Target product already has % compatibility rows; migration is fail-closed', v_existing_relation_count;
  end if;

  select count(*)
  into v_archived_device_count
  from public.device_models
  where status = 'archived'
    and (
      (brand_key = 'oneplus' and normalized_key = 'nord-ce-3-lite-5g')
      or (brand_key = 'oppo' and normalized_key = 'a98-5g')
    );

  if v_archived_device_count <> 0 then
    raise exception 'Archived target device identity conflict found: %', v_archived_device_count;
  end if;

  if exists (
    select 1
    from public.device_models
    where status = 'active'
      and (
        (brand_key = 'oneplus' and normalized_key = 'nord-ce-3-lite-5g'
          and canonical_name is distinct from 'Nord CE 3 Lite 5G')
        or (brand_key = 'oppo' and normalized_key = 'a98-5g'
          and canonical_name is distinct from 'A98 5G')
      )
  ) then
    raise exception 'Active target device identity has an unexpected canonical name';
  end if;

  select
    count(*)::integer,
    coalesce(sum(available_qty), 0)::integer,
    coalesce(sum(actual_qty), 0)::integer,
    coalesce(sum(locked_qty), 0)::integer
  into
    v_inventory_rows,
    v_inventory_available,
    v_inventory_actual,
    v_inventory_locked
  from public.inventory_items
  where sku_code = '3000000202050';

  select stock_qty
  into v_product_stock
  from public.products
  where sku_code = '3000000202050';

  if v_inventory_rows <> 1
     or v_inventory_available <> 1
     or v_inventory_actual <> 1
     or v_inventory_locked <> 0
     or v_product_stock <> 1 then
    raise exception
      'Target inventory baseline must remain product=1 available=1 actual=1 locked=0 (rows %, product %, inventory %/%/%)',
      v_inventory_rows,
      v_product_stock,
      v_inventory_available,
      v_inventory_actual,
      v_inventory_locked;
  end if;
end;
$$;

-- Seed canonical navigation identities. Existing active identities retain their
-- canonical row while aliases, model codes, and a missing series are merged.
with device_seed (
  brand,
  canonical_name,
  normalized_key,
  aliases,
  model_codes,
  model_series
) as (
  values
    ('OnePlus', 'Nord CE 3 Lite 5G', 'nord-ce-3-lite-5g', '{}'::text[], '{}'::text[], private.partspro_model_series('OnePlus', 'Nord CE 3 Lite 5G')),
    ('OPPO', 'A98 5G', 'a98-5g', array['A98 5G CPH2529']::text[], array['CPH2529']::text[], private.partspro_model_series('OPPO', 'A98 5G'))
)
insert into public.device_models (
  brand,
  canonical_name,
  normalized_key,
  aliases,
  model_codes,
  model_series
)
select
  seed.brand,
  seed.canonical_name,
  seed.normalized_key,
  seed.aliases,
  seed.model_codes,
  seed.model_series
from device_seed as seed
on conflict on constraint device_models_brand_key_unique do update set
  aliases = (
    select coalesce(array_agg(distinct value order by value), '{}'::text[])
    from unnest(
      coalesce(device_models.aliases, '{}'::text[])
      || coalesce(excluded.aliases, '{}'::text[])
    ) as merged(value)
    where nullif(btrim(value), '') is not null
  ),
  model_codes = (
    select coalesce(array_agg(distinct value order by value), '{}'::text[])
    from unnest(
      coalesce(device_models.model_codes, '{}'::text[])
      || coalesce(excluded.model_codes, '{}'::text[])
    ) as merged(value)
    where nullif(btrim(value), '') is not null
  ),
  model_series = coalesce(device_models.model_series, excluded.model_series);

-- Two manually approved links point to the same existing product/SKU and share
-- one inventory pool. Supplier provenance remains null for manual evidence.
with relation_seed (brand, canonical_name, normalized_key) as (
  values
    ('OnePlus', 'Nord CE 3 Lite 5G', 'nord-ce-3-lite-5g'),
    ('OPPO', 'A98 5G', 'a98-5g')
)
insert into public.product_device_compatibilities (
  product_id,
  device_model_id,
  source_type,
  source_supplier_id,
  source_reference,
  confidence,
  review_status,
  verified_at,
  note,
  metadata
)
select
  product.id,
  device.id,
  'manual',
  null,
  'current_catalog_title: OEM Display Touchscreen OnePlus Nord CE 3 Lite 5G OPPO A98 5G (CPH2529) Black; owner blanket approval 2026-08-08',
  0.950,
  'approved',
  timestamptz '2026-08-08 00:00:00+00',
  'Owner blanket approval 2026-08-08; shared-screen compatibility; inventory_action=none.',
  jsonb_build_object(
    'review_batch', '2026-08-08-oneplus-oppo-shared-screen-navigation',
    'approval_decision', 'approved',
    'approved_by', 'Owner blanket approval 2026-08-08',
    'inventory_action', 'none',
    'evidence_source', 'current_catalog_title',
    'supplier_code', 'MOBILAX',
    'batch_code', 'C9NS2AL2YZ1'
  )
from relation_seed as seed
join public.products as product
  on product.sku_code = '3000000202050'
join public.device_models as device
  on device.brand_key = lower(seed.brand)
 and device.normalized_key = seed.normalized_key
 and device.status = 'active';

-- Keep the legacy projection exact and ordered as the approved owner ledger.
update public.products
set compatibility_models = array['Nord CE 3 Lite 5G', 'A98 5G']::text[]
where sku_code = '3000000202050'
  and compatibility_models is distinct from array['Nord CE 3 Lite 5G', 'A98 5G']::text[];

do $$
declare
  v_product_count integer;
  v_relation_count integer;
  v_device_count integer;
  v_menu_count integer;
  v_summary_count integer;
  v_inventory_rows integer;
  v_inventory_available integer;
  v_inventory_actual integer;
  v_inventory_locked integer;
  v_product_stock integer;
begin
  select count(*)
  into v_product_count
  from public.products
  where sku_code = '3000000202050'
    and name = 'OEM Display Touchscreen OnePlus Nord CE 3 Lite 5G OPPO A98 5G (CPH2529) Black'
    and status = 'active'
    and category = 'Schermi'
    and supplier = 'Mobilax ChinaTech'
    and batch_code = 'C9NS2AL2YZ1'
    and compatibility_models = array['Nord CE 3 Lite 5G', 'A98 5G']::text[];

  if v_product_count <> 1 then
    raise exception 'Target product postcondition failed';
  end if;

  select count(*)
  into v_relation_count
  from public.product_device_compatibilities as compatibility
  join public.products as product on product.id = compatibility.product_id
  where product.sku_code = '3000000202050'
    and compatibility.review_status = 'approved';

  if v_relation_count <> 2 then
    raise exception 'Expected exactly two approved target relations, found %', v_relation_count;
  end if;

  if exists (
    select 1
    from public.product_device_compatibilities as compatibility
    join public.products as product on product.id = compatibility.product_id
    where product.sku_code = '3000000202050'
      and (
        compatibility.review_status <> 'approved'
        or compatibility.source_type <> 'manual'
        or compatibility.source_supplier_id is not null
        or compatibility.confidence <> 0.950
        or compatibility.verified_at is distinct from timestamptz '2026-08-08 00:00:00+00'
        or compatibility.source_reference is distinct from 'current_catalog_title: OEM Display Touchscreen OnePlus Nord CE 3 Lite 5G OPPO A98 5G (CPH2529) Black; owner blanket approval 2026-08-08'
        or compatibility.metadata ->> 'evidence_source' <> 'current_catalog_title'
        or compatibility.metadata ->> 'approved_by' <> 'Owner blanket approval 2026-08-08'
        or compatibility.metadata ->> 'inventory_action' <> 'none'
      )
  ) then
    raise exception 'Target compatibility evidence postcondition failed';
  end if;

  if exists (
    with expected (brand, canonical_name, normalized_key) as (
      values
        ('OnePlus', 'Nord CE 3 Lite 5G', 'nord-ce-3-lite-5g'),
        ('OPPO', 'A98 5G', 'a98-5g')
    ), actual as (
      select device.brand, device.canonical_name, device.normalized_key
      from public.product_device_compatibilities as compatibility
      join public.products as product on product.id = compatibility.product_id
      join public.device_models as device on device.id = compatibility.device_model_id
      where product.sku_code = '3000000202050'
        and compatibility.review_status = 'approved'
    )
    select 1
    from expected
    left join actual using (brand, canonical_name, normalized_key)
    where actual.brand is null
  ) then
    raise exception 'Target brand/model relation mapping is incomplete';
  end if;

  select count(*)
  into v_device_count
  from public.device_models
  where status = 'active'
    and (
      (brand_key = 'oneplus' and canonical_name = 'Nord CE 3 Lite 5G' and normalized_key = 'nord-ce-3-lite-5g')
      or (brand_key = 'oppo' and canonical_name = 'A98 5G' and normalized_key = 'a98-5g')
    );

  if v_device_count <> 2 then
    raise exception 'Expected two active canonical target devices, found %', v_device_count;
  end if;

  if not exists (
    select 1
    from public.device_models
    where brand_key = 'oppo'
      and normalized_key = 'a98-5g'
      and 'CPH2529' = any(model_codes)
      and status = 'active'
  ) then
    raise exception 'OPPO A98 5G must retain model code CPH2529';
  end if;

  select count(distinct (option.brand, option.model))
  into v_menu_count
  from public.catalog_product_device_models as option
  join public.products as product
    on product.id = option.product_id
  where product.sku_code = '3000000202050'
    and option.model_source = 'normalized'
    and (
      (option.brand = 'OnePlus' and option.model = 'Nord CE 3 Lite 5G')
      or (option.brand = 'OPPO' and option.model = 'A98 5G')
    );

  if v_menu_count <> 2 then
    raise exception 'Expected both target entries in catalog menu, found %', v_menu_count;
  end if;

  select count(*)
  into v_summary_count
  from public.catalog_public_summary as summary
  where summary.sku_code = '3000000202050'
    and summary.category = 'Schermi'
    and summary.stock_qty = 1
    and summary.compatibility_models = array['A98 5G', 'Nord CE 3 Lite 5G']::text[];

  if v_summary_count <> 1 then
    raise exception 'Public catalog summary compatibility postcondition failed';
  end if;

  select
    count(*)::integer,
    coalesce(sum(available_qty), 0)::integer,
    coalesce(sum(actual_qty), 0)::integer,
    coalesce(sum(locked_qty), 0)::integer
  into
    v_inventory_rows,
    v_inventory_available,
    v_inventory_actual,
    v_inventory_locked
  from public.inventory_items
  where sku_code = '3000000202050';

  select stock_qty
  into v_product_stock
  from public.products
  where sku_code = '3000000202050';

  if v_inventory_rows <> 1
     or v_inventory_available <> 1
     or v_inventory_actual <> 1
     or v_inventory_locked <> 0
     or v_product_stock <> 1 then
    raise exception
      'Target inventory/product stock changed: product %, inventory %/%/% (rows %)',
      v_product_stock,
      v_inventory_available,
      v_inventory_actual,
      v_inventory_locked,
      v_inventory_rows;
  end if;
end;
$$;

notify pgrst, 'reload schema';
