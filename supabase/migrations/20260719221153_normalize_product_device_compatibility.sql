create table public.device_models (
  id bigint generated always as identity primary key,
  brand text not null,
  brand_key text generated always as (lower(btrim(brand))) stored,
  canonical_name text not null,
  normalized_key text not null,
  aliases text[] not null default '{}'::text[],
  model_codes text[] not null default '{}'::text[],
  model_series text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_models_brand_not_blank
    check (nullif(btrim(brand), '') is not null),
  constraint device_models_name_not_blank
    check (nullif(btrim(canonical_name), '') is not null),
  constraint device_models_normalized_key_format
    check (
      normalized_key = lower(normalized_key)
      and normalized_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  constraint device_models_brand_key_unique
    unique (brand_key, normalized_key)
);

create table public.product_device_compatibilities (
  product_id uuid not null
    references public.products(id) on delete cascade,
  device_model_id bigint not null
    references public.device_models(id) on delete restrict,
  source_type text not null
    check (
      source_type in (
        'supplier',
        'manufacturer',
        'teardown',
        'shop_test',
        'manual'
      )
    ),
  source_supplier_id uuid
    references public.suppliers(id) on delete set null,
  source_reference text,
  confidence numeric(4, 3) not null default 0.500
    check (confidence between 0 and 1),
  review_status text not null default 'candidate'
    check (review_status in ('candidate', 'approved', 'rejected')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  note text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, device_model_id),
  constraint product_device_supplier_source_required
    check (source_type <> 'supplier' or source_supplier_id is not null),
  constraint product_device_approved_timestamp_required
    check (review_status <> 'approved' or verified_at is not null),
  constraint product_device_source_reference_not_blank
    check (
      source_reference is null
      or nullif(btrim(source_reference), '') is not null
    )
);

create table public.product_supplier_offers (
  id bigint generated always as identity primary key,
  product_id uuid not null
    references public.products(id) on delete cascade,
  supplier_id uuid not null
    references public.suppliers(id) on delete restrict,
  supplier_sku text,
  ean text,
  manufacturer_part_number text,
  quality_grade text,
  source_url text,
  source_reference text,
  unit_cost numeric(12, 4)
    check (unit_cost is null or unit_cost >= 0),
  currency text not null default 'EUR'
    check (currency = 'EUR'),
  last_seen_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_supplier_offer_identity_required
    check (
      nullif(btrim(coalesce(supplier_sku, '')), '') is not null
      or nullif(btrim(coalesce(ean, '')), '') is not null
      or nullif(btrim(coalesce(manufacturer_part_number, '')), '') is not null
    ),
  constraint product_supplier_offer_ean_format
    check (ean is null or ean ~ '^[0-9]{8,14}$')
);

comment on table public.device_models is
  'Canonical device navigation identities. Aliases and model codes never create inventory identities.';
comment on table public.product_device_compatibilities is
  'Audited device compatibility links for one canonical sellable product and its single stock identity.';
comment on table public.product_supplier_offers is
  'Supplier-specific EAN, SKU and manufacturer references mapped to a canonical product.';

create index device_models_navigation_idx
  on public.device_models (brand_key, status, model_series, canonical_name);
create index device_models_aliases_gin_idx
  on public.device_models using gin (aliases);
create index device_models_model_codes_gin_idx
  on public.device_models using gin (model_codes);

create index product_device_approved_lookup_idx
  on public.product_device_compatibilities (device_model_id, product_id)
  where review_status = 'approved';
create index product_device_source_supplier_idx
  on public.product_device_compatibilities (source_supplier_id)
  where source_supplier_id is not null;
create index product_device_verified_by_idx
  on public.product_device_compatibilities (verified_by)
  where verified_by is not null;

create index product_supplier_offers_product_idx
  on public.product_supplier_offers (product_id, supplier_id);
create unique index product_supplier_offers_supplier_sku_uidx
  on public.product_supplier_offers (supplier_id, supplier_sku)
  where nullif(btrim(coalesce(supplier_sku, '')), '') is not null;
create unique index product_supplier_offers_supplier_ean_uidx
  on public.product_supplier_offers (supplier_id, ean)
  where nullif(btrim(coalesce(ean, '')), '') is not null;

create trigger device_models_set_updated_at
  before update on public.device_models
  for each row execute function public.set_updated_at();
create trigger product_device_compatibilities_set_updated_at
  before update on public.product_device_compatibilities
  for each row execute function public.set_updated_at();
create trigger product_supplier_offers_set_updated_at
  before update on public.product_supplier_offers
  for each row execute function public.set_updated_at();

alter table public.device_models enable row level security;
alter table public.product_device_compatibilities enable row level security;
alter table public.product_supplier_offers enable row level security;

revoke all on table public.device_models from PUBLIC, anon, authenticated;
revoke all on table public.product_device_compatibilities from PUBLIC, anon, authenticated;
revoke all on table public.product_supplier_offers from PUBLIC, anon, authenticated;
revoke all on sequence public.device_models_id_seq from PUBLIC, anon, authenticated;
revoke all on sequence public.product_supplier_offers_id_seq from PUBLIC, anon, authenticated;

grant select (
  id,
  brand,
  brand_key,
  canonical_name,
  normalized_key,
  aliases,
  model_codes,
  model_series,
  status
) on table public.device_models to anon, authenticated;

grant select (
  product_id,
  device_model_id,
  review_status
) on table public.product_device_compatibilities to anon, authenticated;

grant select, insert, update on table public.product_supplier_offers to authenticated;
grant usage, select on sequence public.product_supplier_offers_id_seq to authenticated;

grant select, insert, update, delete on table public.device_models to service_role;
grant select, insert, update, delete on table public.product_device_compatibilities to service_role;
grant select, insert, update, delete on table public.product_supplier_offers to service_role;
grant usage, select on sequence public.device_models_id_seq to service_role;
grant usage, select on sequence public.product_supplier_offers_id_seq to service_role;

create policy partspro_device_models_anon_read
  on public.device_models
  for select
  to anon
  using (status = 'active');

create policy partspro_device_models_authenticated_read
  on public.device_models
  for select
  to authenticated
  using (
    status = 'active'
    or (select private.partspro_has_permission('product.read_admin'))
    or (select private.partspro_has_permission('products.read_admin'))
  );

create policy partspro_device_models_admin_insert
  on public.device_models
  for insert
  to authenticated
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy partspro_device_models_admin_update
  on public.device_models
  for update
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')))
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy partspro_product_device_compatibilities_anon_read
  on public.product_device_compatibilities
  for select
  to anon
  using (
    review_status = 'approved'
    and exists (
      select 1
      from public.products as product
      where product.id = product_id
        and product.status = 'active'
    )
    and exists (
      select 1
      from public.device_models as device
      where device.id = device_model_id
        and device.status = 'active'
    )
  );

create policy partspro_product_device_compatibilities_authenticated_read
  on public.product_device_compatibilities
  for select
  to authenticated
  using (
    (
      review_status = 'approved'
      and exists (
        select 1
        from public.products as product
        where product.id = product_id
          and product.status = 'active'
      )
      and exists (
        select 1
        from public.device_models as device
        where device.id = device_model_id
          and device.status = 'active'
      )
    )
    or (select private.partspro_has_permission('product.read_admin'))
    or (select private.partspro_has_permission('products.read_admin'))
  );

create policy partspro_product_device_compatibilities_admin_insert
  on public.product_device_compatibilities
  for insert
  to authenticated
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy partspro_product_device_compatibilities_admin_update
  on public.product_device_compatibilities
  for update
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')))
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy partspro_product_supplier_offers_staff_read
  on public.product_supplier_offers
  for select
  to authenticated
  using (
    (select private.partspro_has_permission('product.read_admin'))
    or (select private.partspro_has_permission('products.read_admin'))
  );

create policy partspro_product_supplier_offers_admin_insert
  on public.product_supplier_offers
  for insert
  to authenticated
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy partspro_product_supplier_offers_admin_update
  on public.product_supplier_offers
  for update
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')))
  with check ((select private.partspro_has_permission('product.edit_content')));

create or replace function private.partspro_sync_managed_product_compatibility(
  p_product_id uuid,
  p_product_brand text,
  p_models text[],
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_managed boolean;
  v_requested_models text[];
  v_device_model_ids bigint[];
  v_missing_models text[];
  v_rejected_models text[];
begin
  perform private.partspro_assert_permission('product.edit_content');

  select exists (
    select 1
    from public.product_device_compatibilities as compatibility
    where compatibility.product_id = p_product_id
  )
  into v_is_managed;

  if not v_is_managed then
    return;
  end if;

  select coalesce(array_agg(distinct btrim(requested.model) order by btrim(requested.model)), '{}'::text[])
  into v_requested_models
  from unnest(coalesce(p_models, '{}'::text[])) as requested(model)
  where nullif(btrim(requested.model), '') is not null;

  with requested as (
    select unnest(v_requested_models) as model
  ),
  matches as (
    select
      requested.model,
      device.id as device_model_id,
      lower(device.brand) = lower(coalesce(p_product_brand, '')) as same_brand
    from requested
    join public.device_models as device
      on device.status = 'active'
      and (
        lower(device.canonical_name) = lower(requested.model)
        or exists (
          select 1
          from unnest(device.aliases) as alias(value)
          where lower(btrim(alias.value)) = lower(requested.model)
        )
      )
  ),
  resolved as (
    select
      requested.model,
      case
        when count(matches.device_model_id) filter (where matches.same_brand) = 1
          then min(matches.device_model_id) filter (where matches.same_brand)
        when count(matches.device_model_id) = 1
          then min(matches.device_model_id)
        else null
      end as device_model_id
    from requested
    left join matches on matches.model = requested.model
    group by requested.model
  )
  select
    coalesce(
      array_agg(distinct resolved.device_model_id order by resolved.device_model_id)
        filter (where resolved.device_model_id is not null),
      '{}'::bigint[]
    ),
    coalesce(
      array_agg(distinct resolved.model order by resolved.model)
        filter (where resolved.device_model_id is null),
      '{}'::text[]
    )
  into v_device_model_ids, v_missing_models
  from resolved;

  if cardinality(v_missing_models) > 0 then
    raise exception
      'Unknown or ambiguous canonical device model(s): %',
      array_to_string(v_missing_models, ', ')
      using errcode = '23514';
  end if;

  perform 1
  from public.product_device_compatibilities as compatibility
  where compatibility.product_id = p_product_id
    and compatibility.device_model_id = any(v_device_model_ids)
  for update;

  select coalesce(
    array_agg(device.canonical_name order by device.canonical_name),
    '{}'::text[]
  )
  into v_rejected_models
  from public.product_device_compatibilities as compatibility
  join public.device_models as device
    on device.id = compatibility.device_model_id
  where compatibility.product_id = p_product_id
    and compatibility.device_model_id = any(v_device_model_ids)
    and compatibility.review_status = 'rejected';

  if cardinality(v_rejected_models) > 0 then
    raise exception
      'Rejected compatibility requires dedicated evidence review: %',
      array_to_string(v_rejected_models, ', ')
      using errcode = '23514';
  end if;

  update public.product_device_compatibilities as compatibility
  set
    review_status = 'rejected',
    verified_by = auth.uid(),
    verified_at = now(),
    note = concat_ws(
      E'\n',
      nullif(compatibility.note, ''),
      'Removed from approved compatibility in PartsPro admin.'
    ),
    metadata = compatibility.metadata || jsonb_build_object(
      'last_admin_review_at', now(),
      'last_admin_review_reason', coalesce(nullif(btrim(p_reason), ''), 'Admin compatibility update')
    )
  where compatibility.product_id = p_product_id
    and compatibility.review_status = 'approved'
    and not (compatibility.device_model_id = any(v_device_model_ids));

  insert into public.product_device_compatibilities (
    product_id,
    device_model_id,
    source_type,
    source_reference,
    confidence,
    review_status,
    verified_by,
    verified_at,
    note,
    metadata
  )
  select
    p_product_id,
    requested.device_model_id,
    'manual',
    'PartsPro admin product compatibility editor',
    1.000,
    'approved',
    auth.uid(),
    now(),
    coalesce(nullif(btrim(p_reason), ''), 'Approved in PartsPro admin compatibility editor.'),
    jsonb_build_object(
      'managed_by', 'admin_product_editor',
      'last_admin_review_at', now()
    )
  from unnest(v_device_model_ids) as requested(device_model_id)
  on conflict (product_id, device_model_id) do update
  set
    review_status = 'approved',
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    note = product_device_compatibilities.note,
    metadata = product_device_compatibilities.metadata || excluded.metadata
  where product_device_compatibilities.review_status <> 'rejected';

  if (
    select count(*)
    from public.product_device_compatibilities as compatibility
    where compatibility.product_id = p_product_id
      and compatibility.device_model_id = any(v_device_model_ids)
      and compatibility.review_status = 'approved'
  ) <> cardinality(v_device_model_ids) then
    raise exception 'Managed compatibility update did not approve every requested model'
      using errcode = '23514';
  end if;
end;
$$;

revoke execute on function private.partspro_sync_managed_product_compatibility(uuid, text, text[], text)
  from PUBLIC, anon, authenticated;
grant execute on function private.partspro_sync_managed_product_compatibility(uuid, text, text[], text)
  to service_role;

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

revoke execute on function private.partspro_admin_update_product_guarded(text, jsonb, text)
  from PUBLIC, anon;
grant execute on function private.partspro_admin_update_product_guarded(text, jsonb, text)
  to authenticated, service_role;

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
  select private.partspro_admin_update_product_guarded(p_sku_code, p_product, p_reason)
$$;

revoke execute on function public.admin_update_product(text, jsonb, text)
  from PUBLIC, anon;
grant execute on function public.admin_update_product(text, jsonb, text)
  to authenticated, service_role;

revoke execute on function private.admin_update_product(text, jsonb, text)
  from PUBLIC, anon, authenticated;
grant execute on function private.admin_update_product(text, jsonb, text)
  to service_role;

create view public.catalog_product_device_models
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
  'normalized'::text as model_source
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
  'legacy'::text as model_source
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
  option.brand,
  option.model,
  option.model_series
from public.catalog_product_device_models as option
group by option.brand, option.model, option.model_series;

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
  end as compatibility_search_terms
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

with device_seed (
  brand,
  canonical_name,
  normalized_key,
  aliases,
  model_codes,
  model_series
) as (
  values
    ('Apple', 'iPhone 8', 'iphone-8', '{}'::text[], '{}'::text[], null::text),
    ('Apple', 'iPhone SE 2nd Gen', 'iphone-se-2nd-gen', array['iPhone SE 2020', 'iPhone SE2', 'iPhone SE (2nd Gen)'], '{}'::text[], null::text),
    ('Apple', 'iPhone 12', 'iphone-12', '{}'::text[], '{}'::text[], null::text),
    ('Apple', 'iPhone 12 Pro', 'iphone-12-pro', '{}'::text[], '{}'::text[], null::text),
    ('Samsung', 'Galaxy A52 4G', 'galaxy-a52-4g', array['Galaxy A52 4G A525'], array['A525', 'A525F', 'A52'], 'Galaxy A'),
    ('Samsung', 'Galaxy A52 5G', 'galaxy-a52-5g', array['Galaxy A52 5G A526'], array['A526', 'A526B', 'A52'], 'Galaxy A'),
    ('Samsung', 'Galaxy A15 4G', 'galaxy-a15-4g', array['Galaxy A15 4G A155'], array['A155', 'A155F', 'A15'], 'Galaxy A'),
    ('Samsung', 'Galaxy A15 5G', 'galaxy-a15-5g', array['Galaxy A15 5G A156B'], array['A156', 'A156B', 'A15'], 'Galaxy A'),
    ('Samsung', 'Galaxy A13 4G', 'galaxy-a13-4g', array['Galaxy A13 4G A135', 'Galaxy A13 4G A137'], array['A13', 'A135F', 'A137F'], 'Galaxy A'),
    ('Samsung', 'Galaxy M13 4G', 'galaxy-m13-4g', array['Galaxy M13 4G M135'], array['M13', 'M135', 'M135F'], 'Galaxy M'),
    ('Samsung', 'Galaxy A14 5G', 'galaxy-a14-5g', array['Galaxy A14 5G A146P', 'Galaxy A14 5G A146U'], array['A14', 'A146P', 'A146U'], 'Galaxy A'),
    ('Samsung', 'Galaxy A17 4G', 'galaxy-a17-4g', array['Galaxy A17 4G A175'], array['A17', 'A175', 'A175F'], 'Galaxy A')
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
on conflict on constraint device_models_brand_key_unique do nothing;

with compatibility_seed (
  sku_code,
  brand,
  normalized_key,
  supplier_code,
  source_reference,
  note
) as (
  values
    ('3708114088835', 'Apple', 'iphone-8', 'MOBILAX', 'Mobilax arrival batch C9NS2AL2YZ1; EAN 3708114088835', 'Supplier title explicitly lists iPhone 8 and iPhone SE 2nd Gen.'),
    ('3708114088835', 'Apple', 'iphone-se-2nd-gen', 'MOBILAX', 'Mobilax arrival batch C9NS2AL2YZ1; EAN 3708114088835', 'Supplier title explicitly lists iPhone 8 and iPhone SE 2nd Gen.'),
    ('3708114088927', 'Apple', 'iphone-8', 'MOBILAX', 'Mobilax arrival batch C9NS2AL2YZ1; EAN 3708114088927', 'Supplier title explicitly lists iPhone 8 and iPhone SE 2nd Gen.'),
    ('3708114088927', 'Apple', 'iphone-se-2nd-gen', 'MOBILAX', 'Mobilax arrival batch C9NS2AL2YZ1; EAN 3708114088927', 'Supplier title explicitly lists iPhone 8 and iPhone SE 2nd Gen.'),
    ('3667075049395', 'Apple', 'iphone-12', 'UTOPYA', 'https://www.utopya.it/batteria-iphone-1212-pro-alta-capacita-ti-q83c.html', 'UTOPYA product identity explicitly lists iPhone 12 and iPhone 12 Pro.'),
    ('3667075049395', 'Apple', 'iphone-12-pro', 'UTOPYA', 'https://www.utopya.it/batteria-iphone-1212-pro-alta-capacita-ti-q83c.html', 'UTOPYA product identity explicitly lists iPhone 12 and iPhone 12 Pro.'),
    ('3667075005933', 'Samsung', 'galaxy-a52-4g', 'UTOPYA', 'https://www.utopya.it/catalogsearch/result/?q=3667075005933', 'UTOPYA title and EAN identify A525F and A526B variants.'),
    ('3667075005933', 'Samsung', 'galaxy-a52-5g', 'UTOPYA', 'https://www.utopya.it/catalogsearch/result/?q=3667075005933', 'UTOPYA title and EAN identify A525F and A526B variants.'),
    ('3667075127079', 'Samsung', 'galaxy-a15-4g', 'UTOPYA', 'https://www.utopya.it/catalogsearch/result/?q=3667075127079', 'UTOPYA title and EAN identify A155F and A156B variants.'),
    ('3667075127079', 'Samsung', 'galaxy-a15-5g', 'UTOPYA', 'https://www.utopya.it/catalogsearch/result/?q=3667075127079', 'UTOPYA title and EAN identify A155F and A156B variants.'),
    ('3701569300774', 'Samsung', 'galaxy-a13-4g', 'UTOPYA', 'https://www.utopya.fr/ecran-complet-galaxy-a13-a135fa137f.html', 'UTOPYA compatibility field lists Galaxy A13 4G and Galaxy M13 4G.'),
    ('3701569300774', 'Samsung', 'galaxy-m13-4g', 'UTOPYA', 'https://www.utopya.fr/ecran-complet-galaxy-a13-a135fa137f.html', 'UTOPYA compatibility field lists Galaxy A13 4G and Galaxy M13 4G.'),
    ('3701569371613', 'Samsung', 'galaxy-a14-5g', 'UTOPYA', 'https://www.utopya.it/catalogsearch/result/?q=3701569371613', 'A146P and A146U are device codes for one Galaxy A14 5G catalog node.'),
    ('3667075243373', 'Samsung', 'galaxy-a17-4g', 'UTOPYA', 'https://www.utopya.it/catalogsearch/result/?q=3667075243373', 'A175F and A17 are model codes, not separate catalog devices.')
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
  'supplier',
  supplier.id,
  seed.source_reference,
  0.990,
  'approved',
  now(),
  seed.note,
  jsonb_build_object('seed', '2026-07-19-high-confidence-pilot')
from compatibility_seed as seed
join public.products as product
  on product.sku_code = seed.sku_code
join public.device_models as device
  on device.brand_key = lower(seed.brand)
  and device.normalized_key = seed.normalized_key
join public.suppliers as supplier
  on supplier.code = seed.supplier_code
on conflict (product_id, device_model_id) do nothing;

insert into public.product_device_compatibilities (
  product_id,
  device_model_id,
  source_type,
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
  'teardown',
  'https://www.ifixit.com/Teardown/iPhone+SE+2020+Teardown/133066',
  1.000,
  'rejected',
  now(),
  'Do not merge this iPhone 8 battery into the SE 2020 entry: the connector differs.',
  jsonb_build_object('seed', '2026-07-19-negative-compatibility-evidence')
from public.products as product
join public.device_models as device
  on device.brand_key = 'apple'
  and device.normalized_key = 'iphone-se-2nd-gen'
where product.sku_code = '3667075049470'
on conflict (product_id, device_model_id) do nothing;

with offer_seed (
  sku_code,
  supplier_code,
  supplier_sku,
  ean,
  source_url,
  source_reference
) as (
  values
    ('3708114088835', 'MOBILAX', null::text, '3708114088835', 'https://www.mobilax.com', 'Mobilax arrival batch C9NS2AL2YZ1'),
    ('3708114088927', 'MOBILAX', null::text, '3708114088927', 'https://www.mobilax.com', 'Mobilax arrival batch C9NS2AL2YZ1'),
    ('3667075049395', 'UTOPYA', '627127', '3667075049395', 'https://www.utopya.it/batteria-iphone-1212-pro-alta-capacita-ti-q83c.html', 'UTOPYA arrival batch UTOPYA-7091760'),
    ('3667075005933', 'UTOPYA', 'A525INC-ECN@', '3667075005933', 'https://www.utopya.it/catalogsearch/result/?q=3667075005933', 'UTOPYA arrival batch UTOPYA-7086282'),
    ('3667075127079', 'UTOPYA', '945129', '3667075127079', 'https://www.utopya.it/catalogsearch/result/?q=3667075127079', 'UTOPYA arrival batch UTOPYA-7086282'),
    ('3701569300774', 'UTOPYA', 'A135-EC', '3701569300774', 'https://www.utopya.fr/ecran-complet-galaxy-a13-a135fa137f.html', 'UTOPYA arrival batch UTOPYA-7086282'),
    ('3701569371613', 'UTOPYA', 'A146P-ECN', '3701569371613', 'https://www.utopya.it/catalogsearch/result/?q=3701569371613', 'UTOPYA arrival batch UTOPYA-7086282'),
    ('3667075243373', 'UTOPYA', 'EC@-IN-A174G', '3667075243373', 'https://www.utopya.it/catalogsearch/result/?q=3667075243373', 'UTOPYA arrival batch UTOPYA-7086282')
)
insert into public.product_supplier_offers (
  product_id,
  supplier_id,
  supplier_sku,
  ean,
  quality_grade,
  source_url,
  source_reference,
  last_seen_at,
  metadata
)
select
  product.id,
  supplier.id,
  seed.supplier_sku,
  seed.ean,
  product.quality_grade,
  seed.source_url,
  seed.source_reference,
  '2026-07-19 00:00:00+02'::timestamptz,
  jsonb_build_object('seed', '2026-07-19-high-confidence-pilot')
from offer_seed as seed
join public.products as product
  on product.sku_code = seed.sku_code
join public.suppliers as supplier
  on supplier.code = seed.supplier_code
on conflict do nothing;

notify pgrst, 'reload schema';
