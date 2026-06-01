-- PartsPro remote-aligned relationship and visibility hardening draft.
-- Generated locally on 2026-05-24. This migration has NOT been applied.
-- Assumes the existing remote public tables:
-- profiles, products, inventory_items, customers, orders, order_lines,
-- rma_requests, b2b_applications, price_groups, order_events.
--
-- Re-run boundary:
-- - Columns, indexes, functions, views, grants, and most constraints are
--   idempotent.
-- - Existing policies are not dropped or replaced. New policy creation is
--   skipped when a policy with the same name already exists.
-- - NOT VALID constraints are added for future enforcement without scanning
--   or blocking legacy rows during the draft apply.

create extension if not exists "pgcrypto";
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
-- Profiles and customer/company relationship.
alter table public.profiles
  add column if not exists customer_id uuid;
alter table public.b2b_applications
  add column if not exists approved_customer_id uuid;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_customer_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.b2b_applications'::regclass
      and conname = 'b2b_applications_approved_customer_id_fkey'
  ) then
    alter table public.b2b_applications
      add constraint b2b_applications_approved_customer_id_fkey
      foreign key (approved_customer_id)
      references public.customers(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_id_user_id_key'
  ) then
    alter table public.customers
      add constraint customers_id_user_id_key
      unique (id, user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_customer_user_match_fkey'
  ) then
    alter table public.orders
      add constraint orders_customer_user_match_fkey
      foreign key (customer_id, user_id)
      references public.customers(id, user_id)
      not valid;
  end if;
end $$;
with one_customer_per_user as (
  select
    user_id,
    min(id::text)::uuid as customer_id
  from public.customers
  where user_id is not null
  group by user_id
)
update public.profiles as p
set customer_id = c.customer_id
from one_customer_per_user as c
where p.id = c.user_id
  and p.customer_id is null;
create index if not exists profiles_customer_id_idx
  on public.profiles (customer_id);
create index if not exists customers_user_id_idx
  on public.customers (user_id)
  where user_id is not null;
do $$
begin
  if to_regclass('public.customers_user_id_unique_idx') is null then
    if exists (
      select 1
      from public.customers
      where user_id is not null
      group by user_id
      having count(*) > 1
    ) then
      raise notice 'Skipped customers_user_id_unique_idx because duplicate customer.user_id rows exist.';
    else
      create unique index customers_user_id_unique_idx
        on public.customers (user_id)
        where user_id is not null;
    end if;
  end if;
end $$;
create index if not exists b2b_applications_approved_customer_id_idx
  on public.b2b_applications (approved_customer_id);
comment on column public.profiles.role is
  'customer is the buyer role; sales, warehouse, purchasing, and admin are staff roles.';
comment on column public.profiles.customer_id is
  'Optional direct link from an auth profile to the B2B customer/company row. Backfilled from customers.user_id when possible.';
comment on column public.b2b_applications.approved_customer_id is
  'Set when a reviewed B2B application is converted into a customers company row.';
create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
  limit 1
$$;
create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select private.current_profile_role()) in ('sales', 'warehouse', 'purchasing', 'admin'),
    false
  )
$$;
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.current_profile_role()) = 'admin', false)
$$;
create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select p.customer_id
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.customer_id is not null
      limit 1
    ),
    (
      select c.id
      from public.customers as c
      where c.user_id = (select auth.uid())
      order by c.created_at desc
      limit 1
    )
  )
$$;
create or replace function private.current_customer_status()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.status
  from public.customers as c
  where c.id = (select private.current_customer_id())
  limit 1
$$;
create or replace function private.can_view_b2b_prices()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.is_staff()), false)
    or coalesce((select private.current_customer_status()) = 'active', false)
$$;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_customer_id() to authenticated;
grant execute on function private.current_customer_status() to authenticated;
grant execute on function private.can_view_b2b_prices() to authenticated;
-- Catalog public summary and buyer price visibility.
create or replace function private.product_b2b_price(_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when (select private.can_view_b2b_prices()) then (
      select p.b2b_price
      from public.products as p
      where p.id = _product_id
        and (p.status = 'active' or (select private.is_staff()))
      limit 1
    )
    else null::numeric
  end
$$;
create or replace function private.product_tier_prices(_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when (select private.can_view_b2b_prices()) then coalesce((
      select p.tier_prices
      from public.products as p
      where p.id = _product_id
        and (p.status = 'active' or (select private.is_staff()))
      limit 1
    ), '[]'::jsonb)
    else '[]'::jsonb
  end
$$;
grant execute on function private.product_b2b_price(uuid) to authenticated;
grant execute on function private.product_tier_prices(uuid) to authenticated;
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
  p.updated_at
from public.products as p
where p.status = 'active';
create or replace view public.catalog_buyer_prices
with (security_invoker = on)
as
select
  p.id,
  p.sku_code,
  p.moq,
  p.vat_mode,
  (select private.can_view_b2b_prices()) as can_view_b2b_prices,
  private.product_b2b_price(p.id) as b2b_price,
  private.product_tier_prices(p.id) as tier_prices
from public.products as p
where p.status = 'active'
   or (select private.is_staff());
grant select on public.catalog_public_summary to anon, authenticated;
grant select on public.catalog_buyer_prices to authenticated;
-- Narrow direct product table reads so public clients cannot fetch B2B price
-- columns directly. Apply after clients move catalog reads to the views above.
revoke select on public.products from anon;
revoke select on public.products from authenticated;
grant select (
  id,
  sku_code,
  name,
  brand,
  model,
  model_code,
  model_codes,
  category,
  quality_grade,
  color,
  frame,
  stock_status,
  stock_qty,
  location,
  moq,
  vat_mode,
  warranty_days,
  weight_gram,
  is_battery,
  is_dangerous_goods,
  msds_url,
  un38_url,
  compatibility,
  compatibility_models,
  alternative_skus,
  add_on_skus,
  highlights,
  status,
  created_at,
  updated_at,
  image_path,
  image_alt,
  gallery_image_paths
) on public.products to anon, authenticated;
-- Order integrity and atomic order creation RPC.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'partspro_orders_amounts_nonnegative'
  ) then
    alter table public.orders
      add constraint partspro_orders_amounts_nonnegative
      check (total_net >= 0 and vat >= 0 and shipping >= 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_lines'::regclass
      and conname = 'partspro_order_lines_unit_price_nonnegative'
  ) then
    alter table public.order_lines
      add constraint partspro_order_lines_unit_price_nonnegative
      check (unit_price >= 0)
      not valid;
  end if;
end $$;
create or replace function private.create_order_transaction(
  p_lines jsonb,
  p_customer_id uuid default null,
  p_delivery_address text default '',
  p_customer_note text default '',
  p_shipping_method text default '',
  p_shipping numeric default 0,
  p_fiscal jsonb default '{}'::jsonb,
  p_vat_rate numeric default 22.00
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := (select private.is_staff());
  v_customer public.customers%rowtype;
  v_order_id uuid;
  v_order_no text;
  v_expected_count integer;
  v_line_count integer := 0;
  v_total_net numeric := 0;
  v_vat numeric := 0;
  v_stock_risk text := 'clear';
  v_line record;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Order lines must be a JSON array' using errcode = '22023';
  end if;

  v_expected_count := jsonb_array_length(p_lines);

  if v_expected_count < 1 then
    raise exception 'Order must contain at least one line' using errcode = '22023';
  end if;

  if p_vat_rate < 0 then
    raise exception 'VAT rate cannot be negative' using errcode = '22023';
  end if;

  if p_shipping < 0 then
    raise exception 'Shipping cannot be negative' using errcode = '22023';
  end if;

  if v_is_staff and p_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = p_customer_id
    limit 1;
  else
    select *
    into v_customer
    from public.customers
    where id = coalesce(p_customer_id, (select private.current_customer_id()))
      and user_id = v_auth_uid
    limit 1;
  end if;

  if v_customer.id is null then
    raise exception 'No matching customer/company profile was found' using errcode = '23503';
  end if;

  if not v_is_staff and v_customer.status <> 'active' then
    raise exception 'Customer must be active before placing B2B orders' using errcode = '42501';
  end if;

  if v_is_staff and v_customer.status = 'suspended' then
    raise exception 'Suspended customers cannot receive new orders' using errcode = '42501';
  end if;

  v_order_no := 'PP-' ||
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

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
    v_customer.user_id,
    v_customer.company_name,
    v_customer.tier,
    'submitted',
    'pending',
    'clear',
    0,
    0,
    coalesce(p_shipping, 0),
    coalesce(p_shipping_method, ''),
    coalesce(p_fiscal, '{}'::jsonb),
    coalesce(p_delivery_address, ''),
    coalesce(p_customer_note, '')
  )
  returning id into v_order_id;

  for v_line in
    select
      requested.sku_code,
      requested.quantity,
      p.name as product_name,
      p.quality_grade,
      p.b2b_price,
      p.moq,
      p.stock_status,
      p.stock_qty
    from jsonb_to_recordset(p_lines) as requested(sku_code text, quantity integer)
    join public.products as p on p.sku_code = requested.sku_code
    where p.status = 'active'
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Order line quantity must be positive' using errcode = '23514';
    end if;

    if v_line.quantity < v_line.moq then
      raise exception 'Order line quantity is below MOQ for SKU %', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.stock_status = 'out_of_stock' or coalesce(v_line.stock_qty, 0) <= 0 then
      raise exception 'SKU % is out of stock', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.quantity > coalesce(v_line.stock_qty, 0) then
      raise exception 'Requested quantity exceeds stock for SKU %', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.stock_status = 'low_stock' or (coalesce(v_line.stock_qty, 0) - v_line.quantity) <= v_line.moq then
      v_stock_risk := 'low';
    end if;

    insert into public.order_lines (
      order_id,
      sku_code,
      product_name,
      quality_grade,
      quantity,
      unit_price,
      stock_status
    )
    values (
      v_order_id,
      v_line.sku_code,
      v_line.product_name,
      v_line.quality_grade,
      v_line.quantity,
      v_line.b2b_price,
      v_line.stock_status
    );

    v_total_net := v_total_net + round(v_line.b2b_price * v_line.quantity, 2);
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count <> v_expected_count then
    raise exception 'One or more order lines reference inactive or unknown SKUs' using errcode = '23503';
  end if;

  v_vat := round((v_total_net + coalesce(p_shipping, 0)) * p_vat_rate / 100, 2);

  update public.orders
  set
    total_net = v_total_net,
    vat = v_vat,
    shipping = coalesce(p_shipping, 0),
    stock_risk = v_stock_risk,
    updated_at = now()
  where id = v_order_id;

  -- Historical note: inventory reservation/decrement is implemented by
  -- 20260525210756_admin_inventory_order_rpc.sql and later order lifecycle
  -- migrations. This earlier draft only rejected out-of-stock orders.

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    v_order_id,
    'created',
    v_auth_uid,
    'Created through create_order_transaction RPC',
    jsonb_build_object('line_count', v_line_count, 'source', 'rpc')
  );

  return v_order_id;
end;
$$;
create or replace function public.create_order_transaction(
  p_lines jsonb,
  p_customer_id uuid default null,
  p_delivery_address text default '',
  p_customer_note text default '',
  p_shipping_method text default '',
  p_shipping numeric default 0,
  p_fiscal jsonb default '{}'::jsonb,
  p_vat_rate numeric default 22.00
)
returns uuid
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.create_order_transaction(
    p_lines,
    p_customer_id,
    p_delivery_address,
    p_customer_note,
    p_shipping_method,
    p_shipping,
    p_fiscal,
    p_vat_rate
  )
$$;
revoke execute on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  from public, anon;
grant execute on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  to authenticated;
grant execute on function private.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  to authenticated;
comment on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric) is
  'Authenticated RPC wrapper for atomic order header, lines, shipping, totals, stock risk, and order event creation.';
-- RMA order-line linkage, quantities, attachments, and status.
alter table public.rma_requests
  add column if not exists attachments jsonb not null default '[]'::jsonb;
update public.rma_requests
set attachments = coalesce((
  select jsonb_agg(jsonb_build_object('url', evidence_url))
  from unnest(evidence_urls) as evidence_url
), '[]'::jsonb)
where attachments = '[]'::jsonb
  and coalesce(array_length(evidence_urls, 1), 0) > 0;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'partspro_rma_status_check'
  ) then
    alter table public.rma_requests
      add constraint partspro_rma_status_check
      check (
        status in (
          'submitted',
          'under_review',
          'approved',
          'rejected',
          'received',
          'replacement_sent',
          'refunded',
          'closed'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'partspro_rma_attachments_array_check'
  ) then
    alter table public.rma_requests
      add constraint partspro_rma_attachments_array_check
      check (jsonb_typeof(attachments) = 'array')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'partspro_rma_order_line_required'
  ) then
    alter table public.rma_requests
      add constraint partspro_rma_order_line_required
      check (order_line_id is not null)
      not valid;
  end if;
end $$;
create index if not exists rma_requests_order_line_status_idx
  on public.rma_requests (order_line_id, status);
create index if not exists rma_requests_user_created_idx
  on public.rma_requests (user_id, created_at desc);
create or replace function private.enforce_rma_order_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line_qty integer;
  v_order_user_id uuid;
  v_order_no text;
  v_sku_code text;
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := (select private.is_staff());
begin
  if new.order_line_id is null then
    raise exception 'RMA request must reference an order line' using errcode = '23502';
  end if;

  select
    ol.quantity,
    o.user_id,
    o.order_no,
    ol.sku_code
  into
    v_line_qty,
    v_order_user_id,
    v_order_no,
    v_sku_code
  from public.order_lines as ol
  join public.orders as o on o.id = ol.order_id
  where ol.id = new.order_line_id
  limit 1;

  if v_line_qty is null then
    raise exception 'RMA order line does not exist' using errcode = '23503';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'RMA quantity must be positive' using errcode = '23514';
  end if;

  if new.quantity > v_line_qty then
    raise exception 'RMA quantity cannot exceed ordered line quantity' using errcode = '23514';
  end if;

  if new.attachments is null then
    new.attachments := '[]'::jsonb;
  end if;

  if jsonb_typeof(new.attachments) <> 'array' then
    raise exception 'RMA attachments must be a JSON array' using errcode = '23514';
  end if;

  if new.order_no is null or btrim(new.order_no) = '' then
    new.order_no := v_order_no;
  elsif new.order_no <> v_order_no then
    raise exception 'RMA order_no must match the referenced order line' using errcode = '23514';
  end if;

  if new.sku_code is null or btrim(new.sku_code) = '' then
    new.sku_code := v_sku_code;
  elsif new.sku_code <> v_sku_code then
    raise exception 'RMA sku_code must match the referenced order line' using errcode = '23514';
  end if;

  if not v_is_staff then
    if v_auth_uid is null then
      raise exception 'Authentication required' using errcode = '28000';
    end if;

    if v_order_user_id is distinct from v_auth_uid then
      raise exception 'RMA order line is not owned by current user' using errcode = '42501';
    end if;

    new.user_id := coalesce(new.user_id, v_auth_uid);

    if new.user_id is distinct from v_auth_uid then
      raise exception 'RMA user_id must match current user' using errcode = '42501';
    end if;

    new.status := coalesce(new.status, 'submitted');

    if new.status <> 'submitted' then
      raise exception 'Buyers can only submit new RMA requests' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.rma_requests'::regclass
      and tgname = 'partspro_rma_order_line_guard'
  ) then
    create trigger partspro_rma_order_line_guard
      before insert or update of order_line_id, quantity, status, attachments, order_no, sku_code, user_id
      on public.rma_requests
      for each row
      execute function private.enforce_rma_order_line();
  end if;
end $$;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rma_requests'
      and policyname = 'partspro_rma_insert_order_line_guard'
  ) then
    create policy "partspro_rma_insert_order_line_guard"
    on public.rma_requests
    as restrictive
    for insert
    to authenticated
    with check (
      (select private.is_staff())
      or (
        user_id = (select auth.uid())
        and status = 'submitted'
        and order_line_id is not null
        and exists (
          select 1
          from public.order_lines as ol
          join public.orders as o on o.id = ol.order_id
          where ol.id = rma_requests.order_line_id
            and o.user_id = (select auth.uid())
            and rma_requests.quantity <= ol.quantity
        )
      )
    );
  end if;
end $$;
grant execute on function private.enforce_rma_order_line() to authenticated;
comment on column public.rma_requests.attachments is
  'Structured RMA attachment metadata. Existing evidence_urls are preserved and mirrored here when possible.';
