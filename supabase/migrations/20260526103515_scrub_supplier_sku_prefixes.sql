-- Remove source-supplier tokens from customer-facing product identifiers and
-- historical order snapshots. Product SKU is the canonical source, so child
-- tables with ON UPDATE CASCADE follow the products.sku_code change.

create or replace function pg_temp.partspro_scrub_supplier_token(value text)
returns text
language sql
immutable
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(coalesce(value, ''), 'MOBILAX[-_[:space:]]*', '', 'gi'),
        '[-_[:space:]]{2,}',
        '-',
        'g'
      ),
      '-_ '
    ),
    ''
  )
$$;

create or replace function pg_temp.partspro_scrub_supplier_json(value jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when value is null then null
    else regexp_replace(value::text, 'MOBILAX[-_[:space:]]*', '', 'gi')::jsonb
  end
$$;

do $$
begin
  if exists (
    select 1
    from public.products
    where sku_code ~* 'mobilax'
      and pg_temp.partspro_scrub_supplier_token(sku_code) is null
  ) then
    raise exception 'Cannot scrub supplier token: at least one product SKU would become empty.';
  end if;

  if exists (
    with supplier_skus as (
      select
        id,
        pg_temp.partspro_scrub_supplier_token(sku_code) as clean_sku
      from public.products
      where sku_code ~* 'mobilax'
    )
    select 1
    from supplier_skus
    group by clean_sku
    having count(*) > 1
  ) then
    raise exception 'Cannot scrub supplier token: duplicate cleaned product SKU values detected.';
  end if;

  if exists (
    with supplier_skus as (
      select
        id,
        pg_temp.partspro_scrub_supplier_token(sku_code) as clean_sku
      from public.products
      where sku_code ~* 'mobilax'
    )
    select 1
    from supplier_skus as source
    join public.products as existing
      on existing.sku_code = source.clean_sku
     and existing.id <> source.id
  ) then
    raise exception 'Cannot scrub supplier token: cleaned product SKU collides with an existing SKU.';
  end if;
end $$;

update public.products
set
  sku_code = pg_temp.partspro_scrub_supplier_token(sku_code),
  batch_code = pg_temp.partspro_scrub_supplier_token(batch_code),
  supplier = case
    when supplier ~* 'mobilax' then 'External Supplier'
    else pg_temp.partspro_scrub_supplier_token(supplier)
  end,
  highlights = coalesce(
    array(
      select scrubbed
      from unnest(highlights) as highlight(value)
      cross join lateral (
        select pg_temp.partspro_scrub_supplier_token(highlight.value) as scrubbed
      ) as normalized
      where scrubbed is not null
    ),
    '{}'::text[]
  ),
  image_path = nullif(replace(coalesce(image_path, ''), 'products/mobilax/', 'products/imported/'), ''),
  gallery_image_paths = coalesce(
    array(
      select replace(path, 'products/mobilax/', 'products/imported/')
      from unnest(gallery_image_paths) as path
    ),
    '{}'::text[]
  ),
  updated_at = now()
where
  sku_code ~* 'mobilax'
  or coalesce(batch_code, '') ~* 'mobilax'
  or coalesce(supplier, '') ~* 'mobilax'
  or exists (select 1 from unnest(highlights) as value where value ~* 'mobilax')
  or coalesce(image_path, '') ilike 'products/mobilax/%'
  or exists (select 1 from unnest(gallery_image_paths) as value where value ilike 'products/mobilax/%');

update public.inventory_items
set
  sku_code = pg_temp.partspro_scrub_supplier_token(sku_code),
  batch_code = pg_temp.partspro_scrub_supplier_token(batch_code),
  supplier = case
    when supplier ~* 'mobilax' then 'External Supplier'
    else pg_temp.partspro_scrub_supplier_token(supplier)
  end
where
  sku_code ~* 'mobilax'
  or coalesce(batch_code, '') ~* 'mobilax'
  or coalesce(supplier, '') ~* 'mobilax';

update public.order_lines
set
  sku_code = pg_temp.partspro_scrub_supplier_token(sku_code),
  batch_code = pg_temp.partspro_scrub_supplier_token(batch_code)
where
  sku_code ~* 'mobilax'
  or coalesce(batch_code, '') ~* 'mobilax';

update public.rma_requests
set
  sku_code = pg_temp.partspro_scrub_supplier_token(sku_code),
  problem_type = pg_temp.partspro_scrub_supplier_token(problem_type),
  description = pg_temp.partspro_scrub_supplier_token(description)
where
  coalesce(sku_code, '') ~* 'mobilax'
  or coalesce(problem_type, '') ~* 'mobilax'
  or coalesce(description, '') ~* 'mobilax';

update public.orders
set
  customer_note = pg_temp.partspro_scrub_supplier_token(customer_note),
  staff_note = pg_temp.partspro_scrub_supplier_token(staff_note),
  fiscal = pg_temp.partspro_scrub_supplier_json(fiscal)
where
  coalesce(customer_note, '') ~* 'mobilax'
  or coalesce(staff_note, '') ~* 'mobilax'
  or fiscal::text ~* 'mobilax';

update public.order_events
set
  note = pg_temp.partspro_scrub_supplier_token(note),
  metadata = pg_temp.partspro_scrub_supplier_json(metadata)
where
  coalesce(note, '') ~* 'mobilax'
  or metadata::text ~* 'mobilax';

do $$
begin
  if to_regclass('public.admin_audit_events') is not null then
    execute $sql$
      update public.admin_audit_events
      set
        entity_id = pg_temp.partspro_scrub_supplier_token(entity_id),
        sku_code = pg_temp.partspro_scrub_supplier_token(sku_code),
        before_data = pg_temp.partspro_scrub_supplier_json(before_data),
        after_data = pg_temp.partspro_scrub_supplier_json(after_data),
        reason = pg_temp.partspro_scrub_supplier_token(reason),
        request_metadata = pg_temp.partspro_scrub_supplier_json(request_metadata)
      where
        coalesce(entity_id, '') ~* 'mobilax'
        or coalesce(sku_code, '') ~* 'mobilax'
        or before_data::text ~* 'mobilax'
        or after_data::text ~* 'mobilax'
        or coalesce(reason, '') ~* 'mobilax'
        or request_metadata::text ~* 'mobilax'
    $sql$;
  end if;
end $$;

do $$
declare
  v_storage_collision boolean;
begin
  if to_regclass('storage.objects') is not null then
    execute $sql$
      select exists (
        select 1
        from storage.objects as source
        join storage.objects as existing
          on existing.bucket_id = source.bucket_id
         and existing.name = replace(source.name, 'products/mobilax/', 'products/imported/')
         and existing.name <> source.name
        where source.bucket_id = 'product-images'
          and source.name ilike 'products/mobilax/%'
      )
    $sql$ into v_storage_collision;

    if v_storage_collision then
      raise exception 'Cannot scrub supplier token: product image storage path collision detected.';
    end if;

    execute $sql$
      update storage.objects
      set name = replace(name, 'products/mobilax/', 'products/imported/'),
          updated_at = now()
      where bucket_id = 'product-images'
        and name ilike 'products/mobilax/%'
    $sql$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_sku_code_no_source_supplier_token'
  ) then
    alter table public.products
      add constraint products_sku_code_no_source_supplier_token
      check (sku_code !~* 'mobilax');
  end if;
end $$;
