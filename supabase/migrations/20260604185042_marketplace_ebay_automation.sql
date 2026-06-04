-- eBay marketplace automation foundation for PartsPro.
-- Adds channel state, job queue, permission seeds, and an idempotent order
-- import RPC that reuses the existing order/inventory reservation lifecycle.

create extension if not exists "pgcrypto";
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

insert into public.admin_permissions (id, label, group_name, description)
values
  ('panel.marketplace', 'Marketplace panel', 'marketplace', 'Can open the eBay marketplace automation panel.'),
  ('ebay.connect', 'Connect eBay', 'marketplace', 'Can connect or refresh the eBay seller account.'),
  ('ebay.publish', 'Publish eBay listings', 'marketplace', 'Can publish or end eBay listings.'),
  ('ebay.sync_inventory', 'Sync eBay inventory', 'marketplace', 'Can sync eBay price and stock.'),
  ('ebay.orders', 'Import eBay orders', 'marketplace', 'Can import and manage eBay order backflow.'),
  ('ebay.settings', 'Manage eBay settings', 'marketplace', 'Can manage eBay policies, category mappings, and automation rules.')
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
select 'admin', id
from public.admin_permissions
where id in (
  'panel.marketplace',
  'ebay.connect',
  'ebay.publish',
  'ebay.sync_inventory',
  'ebay.orders',
  'ebay.settings'
)
on conflict do nothing;

create table if not exists public.marketplace_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'ebay' check (provider in ('ebay')),
  marketplace_id text not null default 'EBAY_IT',
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  account_id text,
  account_label text,
  connection_status text not null default 'disconnected'
    check (connection_status in ('disconnected', 'connected', 'expired', 'error')),
  oauth_scopes text[] not null default '{}'::text[],
  access_token_ciphertext text,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  last_connected_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, marketplace_id, environment)
);

create table if not exists public.marketplace_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'ebay' check (provider in ('ebay')),
  marketplace_id text not null default 'EBAY_IT',
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  connection_id uuid references public.marketplace_connections(id) on delete set null,
  enabled boolean not null default false,
  production_enabled boolean not null default false,
  auto_publish_enabled boolean not null default false,
  auto_sync_enabled boolean not null default true,
  order_import_enabled boolean not null default true,
  operation_locale text not null default 'zh-CN',
  listing_locale text not null default 'it-IT',
  currency text not null default 'EUR',
  merchant_location_key text,
  payment_policy_id text,
  return_policy_id text,
  fulfillment_policy_id text,
  listing_duration text not null default 'GTC',
  offer_format text not null default 'FIXED_PRICE',
  default_condition_id text not null default '1000',
  default_condition_label text not null default 'Nuovo',
  stock_buffer integer not null default 1 check (stock_buffer >= 0),
  markup_percent numeric(8, 4) not null default 0 check (markup_percent >= 0),
  markup_fixed numeric(12, 2) not null default 0 check (markup_fixed >= 0),
  last_orders_synced_at timestamptz,
  notification_verification_token_hash text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, marketplace_id, environment)
);

create table if not exists public.marketplace_category_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'ebay' check (provider in ('ebay')),
  marketplace_id text not null default 'EBAY_IT',
  local_category text not null,
  brand text,
  model_series text,
  ebay_category_id text not null,
  ebay_category_tree_id text not null default '101',
  ebay_category_name text,
  condition_id text not null default '1000',
  condition_label text not null default 'Nuovo',
  aspects jsonb not null default '{}'::jsonb check (jsonb_typeof(aspects) = 'object'),
  required_aspects jsonb not null default '[]'::jsonb check (jsonb_typeof(required_aspects) = 'array'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_category_mappings_unique_scope_idx
  on public.marketplace_category_mappings (
    provider,
    marketplace_id,
    lower(local_category),
    lower(coalesce(brand, '')),
    lower(coalesce(model_series, ''))
  );

create unique index if not exists marketplace_category_mappings_raw_scope_idx
  on public.marketplace_category_mappings (
    provider,
    marketplace_id,
    local_category,
    brand,
    model_series
  )
  nulls not distinct;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'ebay' check (provider in ('ebay')),
  marketplace_id text not null default 'EBAY_IT',
  product_id uuid references public.products(id) on delete cascade,
  sku_code text not null references public.products(sku_code) on update cascade on delete cascade,
  listing_status text not null default 'draft'
    check (listing_status in ('draft', 'ready', 'queued', 'published', 'failed', 'ended', 'blocked')),
  eligibility_status text not null default 'incomplete'
    check (eligibility_status in ('eligible', 'incomplete', 'blocked')),
  sync_enabled boolean not null default true,
  ebay_offer_id text,
  ebay_listing_id text,
  ebay_inventory_item_status text,
  ebay_item_web_url text,
  ebay_category_id text,
  condition_id text,
  title text,
  description text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  currency text not null default 'EUR',
  quantity integer not null default 0 check (quantity >= 0),
  last_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(last_payload) = 'object'),
  last_error_code text,
  last_error_message text,
  last_error_at timestamptz,
  last_synced_at timestamptz,
  last_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, marketplace_id, sku_code)
);

create index if not exists marketplace_listings_status_idx
  on public.marketplace_listings (provider, marketplace_id, listing_status, updated_at desc);

create table if not exists public.marketplace_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'ebay' check (provider in ('ebay')),
  marketplace_id text not null default 'EBAY_IT',
  job_type text not null check (
    job_type in (
      'connect',
      'pull_policies',
      'pull_metadata',
      'publish_listing',
      'sync_inventory',
      'sync_price',
      'import_orders',
      'import_order',
      'update_fulfillment'
    )
  ),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  priority integer not null default 100,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  locked_by text,
  locked_at timestamptz,
  target_sku text,
  target_order_id text,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  error_code text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists marketplace_sync_jobs_idempotency_idx
  on public.marketplace_sync_jobs (provider, marketplace_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists marketplace_sync_jobs_queue_idx
  on public.marketplace_sync_jobs (status, scheduled_at, priority, created_at);

create table if not exists public.marketplace_order_links (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'ebay' check (provider in ('ebay')),
  marketplace_id text not null default 'EBAY_IT',
  external_order_id text not null,
  external_order_status text,
  local_order_id uuid references public.orders(id) on delete set null,
  local_order_no text,
  import_status text not null default 'pending'
    check (import_status in ('pending', 'imported', 'failed', 'skipped')),
  order_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(order_payload) = 'object'),
  buyer_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(buyer_snapshot) = 'object'),
  total numeric(12, 2) not null default 0 check (total >= 0),
  currency text not null default 'EUR',
  last_error text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, marketplace_id, external_order_id)
);

create index if not exists marketplace_order_links_local_order_idx
  on public.marketplace_order_links (local_order_id)
  where local_order_id is not null;

alter table public.marketplace_connections enable row level security;
alter table public.marketplace_settings enable row level security;
alter table public.marketplace_category_mappings enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_sync_jobs enable row level security;
alter table public.marketplace_order_links enable row level security;

grant select, insert, update, delete on public.marketplace_connections to authenticated;
grant select, insert, update, delete on public.marketplace_settings to authenticated;
grant select, insert, update, delete on public.marketplace_category_mappings to authenticated;
grant select, insert, update, delete on public.marketplace_listings to authenticated;
grant select, insert, update, delete on public.marketplace_sync_jobs to authenticated;
grant select, insert, update, delete on public.marketplace_order_links to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_connections'
      and policyname = 'partspro_marketplace_connections_read'
  ) then
    create policy "partspro_marketplace_connections_read"
      on public.marketplace_connections
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('panel.marketplace'))
        or (select private.partspro_has_permission('ebay.connect'))
        or (select private.partspro_has_permission('ebay.settings'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_connections'
      and policyname = 'partspro_marketplace_connections_write'
  ) then
    create policy "partspro_marketplace_connections_write"
      on public.marketplace_connections
      for all
      to authenticated
      using (
        (select private.partspro_has_permission('ebay.connect'))
        or (select private.partspro_has_permission('ebay.settings'))
      )
      with check (
        (select private.partspro_has_permission('ebay.connect'))
        or (select private.partspro_has_permission('ebay.settings'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_settings'
      and policyname = 'partspro_marketplace_settings_read'
  ) then
    create policy "partspro_marketplace_settings_read"
      on public.marketplace_settings
      for select
      to authenticated
      using ((select private.partspro_has_permission('panel.marketplace')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_settings'
      and policyname = 'partspro_marketplace_settings_write'
  ) then
    create policy "partspro_marketplace_settings_write"
      on public.marketplace_settings
      for all
      to authenticated
      using ((select private.partspro_has_permission('ebay.settings')))
      with check ((select private.partspro_has_permission('ebay.settings')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_category_mappings'
      and policyname = 'partspro_marketplace_category_mappings_read'
  ) then
    create policy "partspro_marketplace_category_mappings_read"
      on public.marketplace_category_mappings
      for select
      to authenticated
      using ((select private.partspro_has_permission('panel.marketplace')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_category_mappings'
      and policyname = 'partspro_marketplace_category_mappings_write'
  ) then
    create policy "partspro_marketplace_category_mappings_write"
      on public.marketplace_category_mappings
      for all
      to authenticated
      using ((select private.partspro_has_permission('ebay.settings')))
      with check ((select private.partspro_has_permission('ebay.settings')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_listings'
      and policyname = 'partspro_marketplace_listings_read'
  ) then
    create policy "partspro_marketplace_listings_read"
      on public.marketplace_listings
      for select
      to authenticated
      using ((select private.partspro_has_permission('panel.marketplace')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_listings'
      and policyname = 'partspro_marketplace_listings_write'
  ) then
    create policy "partspro_marketplace_listings_write"
      on public.marketplace_listings
      for all
      to authenticated
      using (
        (select private.partspro_has_permission('ebay.publish'))
        or (select private.partspro_has_permission('ebay.sync_inventory'))
      )
      with check (
        (select private.partspro_has_permission('ebay.publish'))
        or (select private.partspro_has_permission('ebay.sync_inventory'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_sync_jobs'
      and policyname = 'partspro_marketplace_sync_jobs_read'
  ) then
    create policy "partspro_marketplace_sync_jobs_read"
      on public.marketplace_sync_jobs
      for select
      to authenticated
      using ((select private.partspro_has_permission('panel.marketplace')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_sync_jobs'
      and policyname = 'partspro_marketplace_sync_jobs_write'
  ) then
    create policy "partspro_marketplace_sync_jobs_write"
      on public.marketplace_sync_jobs
      for all
      to authenticated
      using (
        (select private.partspro_has_permission('ebay.publish'))
        or (select private.partspro_has_permission('ebay.sync_inventory'))
        or (select private.partspro_has_permission('ebay.orders'))
        or (select private.partspro_has_permission('ebay.connect'))
      )
      with check (
        (select private.partspro_has_permission('ebay.publish'))
        or (select private.partspro_has_permission('ebay.sync_inventory'))
        or (select private.partspro_has_permission('ebay.orders'))
        or (select private.partspro_has_permission('ebay.connect'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_order_links'
      and policyname = 'partspro_marketplace_order_links_read'
  ) then
    create policy "partspro_marketplace_order_links_read"
      on public.marketplace_order_links
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('panel.marketplace'))
        or (select private.partspro_has_permission('orders.read'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketplace_order_links'
      and policyname = 'partspro_marketplace_order_links_write'
  ) then
    create policy "partspro_marketplace_order_links_write"
      on public.marketplace_order_links
      for all
      to authenticated
      using ((select private.partspro_has_permission('ebay.orders')))
      with check ((select private.partspro_has_permission('ebay.orders')));
  end if;
end $$;

drop trigger if exists marketplace_connections_set_updated_at on public.marketplace_connections;
create trigger marketplace_connections_set_updated_at
  before update on public.marketplace_connections
  for each row execute function public.set_updated_at();

drop trigger if exists marketplace_settings_set_updated_at on public.marketplace_settings;
create trigger marketplace_settings_set_updated_at
  before update on public.marketplace_settings
  for each row execute function public.set_updated_at();

drop trigger if exists marketplace_category_mappings_set_updated_at on public.marketplace_category_mappings;
create trigger marketplace_category_mappings_set_updated_at
  before update on public.marketplace_category_mappings
  for each row execute function public.set_updated_at();

drop trigger if exists marketplace_listings_set_updated_at on public.marketplace_listings;
create trigger marketplace_listings_set_updated_at
  before update on public.marketplace_listings
  for each row execute function public.set_updated_at();

drop trigger if exists marketplace_sync_jobs_set_updated_at on public.marketplace_sync_jobs;
create trigger marketplace_sync_jobs_set_updated_at
  before update on public.marketplace_sync_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists marketplace_order_links_set_updated_at on public.marketplace_order_links;
create trigger marketplace_order_links_set_updated_at
  before update on public.marketplace_order_links
  for each row execute function public.set_updated_at();

create or replace function private.ensure_marketplace_customer()
returns public.customers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
begin
  select *
  into v_customer
  from public.customers
  where user_id is null
    and email = 'marketplace@partspro.local'
    and company_name = 'Marketplace eBay'
  order by created_at asc
  limit 1;

  if v_customer.id is not null then
    return v_customer;
  end if;

  insert into public.customers (
    user_id,
    company_name,
    contact_name,
    email,
    fiscal_code,
    phone,
    billing_address,
    shipping_address,
    status,
    tier,
    customer_type,
    assignment_status,
    level,
    profile_completed_at
  )
  values (
    null,
    'Marketplace eBay',
    'eBay Buyer',
    'marketplace@partspro.local',
    'MARKETPLACE',
    '-',
    'Marketplace order snapshot',
    'Marketplace order snapshot',
    'active',
    'bronze',
    'retail',
    'assigned',
    'bronze',
    now()
  )
  returning * into v_customer;

  return v_customer;
end;
$$;

create or replace function public.import_marketplace_order(
  p_provider text,
  p_marketplace_id text,
  p_external_order_id text,
  p_order jsonb,
  p_lines jsonb,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_service_role boolean := coalesce(current_setting('request.jwt.claim.role', true) = 'service_role', false);
  v_customer public.customers%rowtype;
  v_existing public.marketplace_order_links%rowtype;
  v_order_id uuid;
  v_order_line_id uuid;
  v_order_no text;
  v_expected_count integer;
  v_line_count integer := 0;
  v_total_net numeric := greatest(coalesce((p_order ->> 'total_net')::numeric, 0), 0);
  v_calculated_total_net numeric := 0;
  v_shipping numeric := greatest(coalesce((p_order ->> 'shipping')::numeric, 0), 0);
  v_vat numeric := greatest(coalesce((p_order ->> 'vat')::numeric, 0), 0);
  v_stock_risk text := 'clear';
  v_line record;
  v_payment_status text := case
    when upper(coalesce(p_order ->> 'payment_status', p_order ->> 'paymentStatus', '')) in ('PAID', 'PAID_IN_FULL')
      then 'paid'
    else 'pending'
  end;
begin
  if not (v_is_service_role or (select private.partspro_has_permission('ebay.orders'))) then
    raise exception 'Missing eBay order import permission' using errcode = '42501';
  end if;

  if coalesce(nullif(btrim(p_provider), ''), '') <> 'ebay' then
    raise exception 'Unsupported marketplace provider' using errcode = '22023';
  end if;

  if coalesce(nullif(btrim(p_marketplace_id), ''), '') = '' then
    raise exception 'marketplace_id is required' using errcode = '22023';
  end if;

  if coalesce(nullif(btrim(p_external_order_id), ''), '') = '' then
    raise exception 'external_order_id is required' using errcode = '22023';
  end if;

  if jsonb_typeof(p_order) is distinct from 'object' then
    raise exception 'Order payload must be an object' using errcode = '22023';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Order lines must be an array' using errcode = '22023';
  end if;

  select *
  into v_existing
  from public.marketplace_order_links
  where provider = p_provider
    and marketplace_id = p_marketplace_id
    and external_order_id = p_external_order_id
  limit 1;

  if v_existing.local_order_id is not null then
    return v_existing.local_order_id;
  end if;

  v_expected_count := jsonb_array_length(p_lines);

  if v_expected_count < 1 then
    raise exception 'Marketplace order must contain at least one line' using errcode = '22023';
  end if;

  v_customer := private.ensure_marketplace_customer();
  v_order_no := 'EBAY-' || upper(left(regexp_replace(p_external_order_id, '[^A-Za-z0-9_-]+', '-', 'g'), 58));

  if exists (select 1 from public.orders where order_no = v_order_no) then
    select id
    into v_order_id
    from public.orders
    where order_no = v_order_no
    limit 1;

    insert into public.marketplace_order_links (
      provider,
      marketplace_id,
      external_order_id,
      external_order_status,
      local_order_id,
      local_order_no,
      import_status,
      order_payload,
      buyer_snapshot,
      total,
      currency,
      imported_at
    )
    values (
      p_provider,
      p_marketplace_id,
      p_external_order_id,
      p_order ->> 'order_status',
      v_order_id,
      v_order_no,
      'imported',
      p_order,
      coalesce(p_order -> 'buyer', '{}'::jsonb),
      greatest(coalesce((p_order ->> 'total')::numeric, 0), 0),
      coalesce(nullif(p_order ->> 'currency', ''), 'EUR'),
      now()
    )
    on conflict (provider, marketplace_id, external_order_id) do update
    set local_order_id = excluded.local_order_id,
        local_order_no = excluded.local_order_no,
        import_status = 'imported',
        order_payload = excluded.order_payload,
        buyer_snapshot = excluded.buyer_snapshot,
        total = excluded.total,
        currency = excluded.currency,
        imported_at = now(),
        updated_at = now();

    return v_order_id;
  end if;

  insert into public.orders (
    order_no,
    customer_id,
    user_id,
    customer_name,
    customer_tier,
    status,
    payment_status,
    stock_risk,
    total_net,
    vat,
    shipping,
    shipping_method,
    fiscal,
    delivery_address,
    customer_note
  )
  values (
    v_order_no,
    v_customer.id,
    null,
    'eBay Italia',
    'marketplace',
    'submitted',
    v_payment_status,
    'clear',
    0,
    0,
    v_shipping,
    coalesce(nullif(p_order ->> 'shipping_method', ''), 'eBay'),
    jsonb_build_object(
      'source', 'ebay',
      'marketplace_id', p_marketplace_id,
      'external_order_id', p_external_order_id,
      'buyer_snapshot', coalesce(p_order -> 'buyer', '{}'::jsonb),
      'raw_order', p_order
    ),
    coalesce(p_order ->> 'delivery_address', ''),
    coalesce(nullif(p_reason, ''), 'Imported from eBay order backflow.')
  )
  returning id into v_order_id;

  for v_line in
    select
      requested.sku_code,
      requested.quantity,
      round(coalesce(requested.unit_net, 0), 2) as requested_unit_net,
      requested.external_line_id,
      p.name as product_name,
      p.quality_grade,
      p.retail_price,
      p.stock_status,
      p.stock_qty,
      p.batch_code,
      p.location
    from jsonb_to_recordset(p_lines) as requested(
      sku_code text,
      quantity integer,
      unit_net numeric,
      external_line_id text
    )
    join public.products as p on p.sku_code = requested.sku_code
    where p.status = 'active'
    order by requested.sku_code
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Marketplace order line quantity must be positive' using errcode = '23514';
    end if;

    if v_line.stock_status = 'out_of_stock' or coalesce(v_line.stock_qty, 0) <= 0 then
      raise exception 'SKU % is out of stock', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.quantity > coalesce(v_line.stock_qty, 0) then
      raise exception 'Requested quantity exceeds stock for SKU %', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.stock_status = 'low_stock' then
      v_stock_risk := 'low';
    end if;

    insert into public.order_lines (
      order_id,
      sku_code,
      product_name,
      quality_grade,
      quantity,
      unit_price,
      stock_status,
      batch_code,
      location
    )
    values (
      v_order_id,
      v_line.sku_code,
      v_line.product_name,
      v_line.quality_grade,
      v_line.quantity,
      case when v_line.requested_unit_net > 0 then v_line.requested_unit_net else v_line.retail_price end,
      'pending_reservation',
      v_line.batch_code,
      v_line.location
    )
    returning id into v_order_line_id;

    perform private.reserve_order_line_inventory(v_order_line_id, v_line.sku_code, v_line.quantity);

    v_calculated_total_net := v_calculated_total_net + round((case when v_line.requested_unit_net > 0 then v_line.requested_unit_net else v_line.retail_price end) * v_line.quantity, 2);

    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count <> v_expected_count then
    raise exception 'One or more marketplace lines reference inactive or unknown SKUs' using errcode = '23503';
  end if;

  if v_total_net = 0 then
    v_total_net := v_calculated_total_net;
  end if;

  update public.orders
  set total_net = v_total_net,
      vat = v_vat,
      shipping = v_shipping,
      stock_risk = v_stock_risk,
      updated_at = now()
  where id = v_order_id;

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    v_order_id,
    'marketplace_order_imported',
    v_actor_id,
    coalesce(nullif(p_reason, ''), 'Imported from eBay order backflow.'),
    jsonb_build_object(
      'source', 'ebay',
      'marketplace_id', p_marketplace_id,
      'external_order_id', p_external_order_id,
      'line_count', v_line_count,
      'inventory_action', 'reserved'
    )
  );

  insert into public.marketplace_order_links (
    provider,
    marketplace_id,
    external_order_id,
    external_order_status,
    local_order_id,
    local_order_no,
    import_status,
    order_payload,
    buyer_snapshot,
    total,
    currency,
    imported_at
  )
  values (
    p_provider,
    p_marketplace_id,
    p_external_order_id,
    p_order ->> 'order_status',
    v_order_id,
    v_order_no,
    'imported',
    p_order,
    coalesce(p_order -> 'buyer', '{}'::jsonb),
    greatest(coalesce((p_order ->> 'total')::numeric, v_total_net + v_shipping + v_vat), 0),
    coalesce(nullif(p_order ->> 'currency', ''), 'EUR'),
    now()
  )
  on conflict (provider, marketplace_id, external_order_id) do update
  set external_order_status = excluded.external_order_status,
      local_order_id = excluded.local_order_id,
      local_order_no = excluded.local_order_no,
      import_status = 'imported',
      order_payload = excluded.order_payload,
      buyer_snapshot = excluded.buyer_snapshot,
      total = excluded.total,
      currency = excluded.currency,
      imported_at = now(),
      last_error = null,
      updated_at = now();

  return v_order_id;
end;
$$;

grant execute on function public.import_marketplace_order(text, text, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.import_marketplace_order(text, text, text, jsonb, jsonb, text) to service_role;

insert into public.marketplace_settings (
  provider,
  marketplace_id,
  environment,
  enabled,
  operation_locale,
  listing_locale,
  currency,
  stock_buffer,
  markup_percent,
  markup_fixed
)
values (
  'ebay',
  'EBAY_IT',
  'sandbox',
  false,
  'zh-CN',
  'it-IT',
  'EUR',
  1,
  0,
  0
)
on conflict (provider, marketplace_id, environment) do nothing;

notify pgrst, 'reload schema';
