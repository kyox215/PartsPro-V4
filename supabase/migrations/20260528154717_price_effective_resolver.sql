-- Centralize customer-facing price resolution so catalog, cart, and order
-- validation all use the same formula.

insert into public.price_groups (id, name, description, discount_percent)
values
  ('standard_b2b', 'Standard wholesale', 'Default wholesale price group.', 0),
  ('repair_shop', 'Repair shop', 'Repair partner price group.', 2),
  ('reseller', 'Reseller', 'Reseller price group.', 4),
  ('key_account', 'Key account', 'Strategic accounts managed through customer-specific prices.', 0)
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  discount_percent = excluded.discount_percent,
  updated_at = now();

create table if not exists public.customer_product_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  min_quantity integer not null default 1 check (min_quantity > 0),
  currency text not null default 'EUR',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_product_prices_window_check check (
    ends_at is null or ends_at > starts_at
  )
);

create unique index if not exists customer_product_prices_unique_window_idx
  on public.customer_product_prices (customer_id, product_id, min_quantity, starts_at);

create index if not exists customer_product_prices_lookup_idx
  on public.customer_product_prices (customer_id, product_id, min_quantity desc, starts_at desc)
  where ends_at is null;

alter table public.customer_product_prices enable row level security;

grant select on public.customer_product_prices to authenticated;
grant insert, update, delete on public.customer_product_prices to authenticated;

drop policy if exists "partspro_customer_product_prices_staff_read"
  on public.customer_product_prices;

create policy "partspro_customer_product_prices_staff_read"
  on public.customer_product_prices
  for select
  to authenticated
  using ((select private.is_staff()));

drop policy if exists "partspro_customer_product_prices_staff_write"
  on public.customer_product_prices;

create policy "partspro_customer_product_prices_staff_write"
  on public.customer_product_prices
  for all
  to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

drop trigger if exists customer_product_prices_set_updated_at
  on public.customer_product_prices;

create trigger customer_product_prices_set_updated_at
  before update on public.customer_product_prices
  for each row
  execute function public.set_updated_at();

create or replace function private.can_view_b2b_prices()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.is_staff()), false)
    or exists (
      select 1
      from public.customers as c
      where c.id = (select private.current_customer_id())
        and c.status = 'active'
        and coalesce(c.customer_type, 'retail') = 'wholesale'
        and coalesce(c.assignment_status, 'needs_review') = 'assigned'
    )
$$;

alter table public.order_lines
  add column if not exists base_unit_price numeric(12, 2),
  add column if not exists discount_percent numeric(6, 2),
  add column if not exists price_source text,
  add column if not exists customer_level_snapshot text,
  add column if not exists price_group_id_snapshot text,
  add column if not exists price_version text,
  add column if not exists price_resolved_at timestamptz;

create or replace function private.resolve_customer_product_price(
  _product_id uuid,
  _customer_id uuid default null,
  _quantity integer default 1
)
returns table (
  product_id uuid,
  sku_code text,
  customer_id uuid,
  customer_type text,
  customer_level text,
  price_group_id text,
  base_unit_price numeric,
  level_discount_percent numeric,
  price_group_discount_percent numeric,
  discount_percent numeric,
  effective_unit_price numeric,
  price_source text,
  margin_percent numeric,
  price_version text,
  price_resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_customer public.customers%rowtype;
  v_customer_price public.customer_product_prices%rowtype;
  v_requested_customer_id uuid := _customer_id;
  v_auth_uid uuid := (select auth.uid());
  v_current_customer_id uuid := (select private.current_customer_id());
  v_is_staff boolean := coalesce((select private.is_staff()), false);
  v_can_view boolean := false;
  v_customer_type text := 'wholesale';
  v_level text := 'bronze';
  v_group_id text;
  v_group_discount_percent numeric := 0;
  v_level_discount_percent numeric := 0;
  v_combined_discount_percent numeric := 0;
  v_base_unit_price numeric;
  v_raw_unit_price numeric;
  v_effective_unit_price numeric;
  v_margin_floor numeric;
  v_price_source text := 'hidden';
  v_resolved_at timestamptz := now();
begin
  select *
  into v_product
  from public.products
  where id = _product_id
    and (status = 'active' or v_is_staff)
  limit 1;

  if v_product.id is null then
    return;
  end if;

  if v_requested_customer_id is null then
    v_requested_customer_id := v_current_customer_id;
  end if;

  if v_requested_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = v_requested_customer_id
    limit 1;
  end if;

  if v_customer.id is not null then
    v_customer_type := coalesce(v_customer.customer_type, 'retail');
    v_level := private.normalize_customer_tier(coalesce(v_customer.level, v_customer.tier, 'bronze'));
    v_group_id := v_customer.price_group_id;
    v_can_view :=
      v_is_staff
      or (
        v_customer.status = 'active'
        and coalesce(v_customer.customer_type, 'retail') = 'wholesale'
        and coalesce(v_customer.assignment_status, 'needs_review') = 'assigned'
        and (
          v_customer.user_id = v_auth_uid
          or exists (
            select 1
            from public.customer_memberships as cm
            where cm.customer_id = v_customer.id
              and cm.user_id = v_auth_uid
              and cm.status = 'active'
          )
        )
      );
  else
    v_can_view := v_is_staff;
  end if;

  if v_can_view then
    v_base_unit_price := case
      when v_customer.id is not null and v_customer_type = 'retail'
        then coalesce(v_product.retail_price, v_product.b2b_price, 0)
      else coalesce(v_product.b2b_price, v_product.retail_price, 0)
    end;

    select *
    into v_customer_price
    from public.customer_product_prices as cpp
    where cpp.customer_id = v_customer.id
      and cpp.product_id = v_product.id
      and cpp.min_quantity <= greatest(coalesce(_quantity, 1), 1)
      and cpp.starts_at <= v_resolved_at
      and (cpp.ends_at is null or cpp.ends_at > v_resolved_at)
    order by cpp.min_quantity desc, cpp.starts_at desc
    limit 1;

    if v_customer_price.id is not null then
      v_raw_unit_price := v_customer_price.unit_price;
      v_price_source := 'customer_product_price';
    else
      v_level_discount_percent :=
        round(coalesce(private.customer_level_discount(v_level), 0) * 100, 2);

      if v_customer.id is not null and v_customer_type = 'wholesale' and v_group_id is not null then
        select least(greatest(coalesce(pg.discount_percent, 0), 0), 100)
        into v_group_discount_percent
        from public.price_groups as pg
        where pg.id = v_group_id;

        v_group_discount_percent := coalesce(v_group_discount_percent, 0);
      end if;

      v_combined_discount_percent := round(
        (
          1
          - (
            (1 - coalesce(v_level_discount_percent, 0) / 100)
            * (1 - coalesce(v_group_discount_percent, 0) / 100)
          )
        ) * 100,
        2
      );
      v_raw_unit_price := round(
        coalesce(v_base_unit_price, 0) * (1 - v_combined_discount_percent / 100),
        2
      );
      v_price_source := case
        when v_group_discount_percent > 0 and v_level_discount_percent > 0 then 'level_price_group'
        when v_group_discount_percent > 0 then 'price_group'
        when v_level_discount_percent > 0 then 'customer_level'
        when v_customer.id is not null and v_customer_type = 'retail' then 'retail_price'
        else 'b2b_price'
      end;
    end if;

    v_margin_floor := case
      when coalesce(v_product.cost_price, 0) > 0
        then least(coalesce(v_base_unit_price, 0), round(v_product.cost_price / 0.85, 2))
      else 0
    end;
    v_effective_unit_price := greatest(coalesce(v_raw_unit_price, 0), coalesce(v_margin_floor, 0));

    if v_effective_unit_price > coalesce(v_raw_unit_price, 0) then
      v_price_source := v_price_source || '_margin_floor';
    end if;
  end if;

  return query
  select
    v_product.id,
    v_product.sku_code,
    case when v_customer.id is null then null::uuid else v_customer.id end,
    case when v_can_view then v_customer_type else null::text end,
    case when v_can_view then v_level else null::text end,
    case when v_can_view then v_group_id else null::text end,
    case when v_can_view then round(v_base_unit_price, 2) else null::numeric end,
    case when v_can_view then v_level_discount_percent else null::numeric end,
    case when v_can_view then v_group_discount_percent else null::numeric end,
    case
      when v_can_view and v_base_unit_price > 0
        then round((1 - (v_effective_unit_price / v_base_unit_price)) * 100, 2)
      when v_can_view then 0::numeric
      else null::numeric
    end,
    case when v_can_view then round(v_effective_unit_price, 2) else null::numeric end,
    v_price_source,
    case
      when v_can_view and v_effective_unit_price > 0
        then round(((v_effective_unit_price - coalesce(v_product.cost_price, 0)) / v_effective_unit_price) * 100, 2)
      when v_can_view then null::numeric
      else null::numeric
    end,
    case
      when v_can_view then md5(concat_ws(
        '|',
        v_product.id::text,
        coalesce(v_product.updated_at::text, ''),
        coalesce(v_customer.id::text, ''),
        coalesce(v_customer.updated_at::text, ''),
        coalesce(v_customer_price.id::text, ''),
        coalesce(v_customer_price.updated_at::text, ''),
        coalesce(v_group_id, ''),
        coalesce(v_group_discount_percent::text, '0'),
        coalesce(v_effective_unit_price::text, '0')
      ))
      else null::text
    end,
    case when v_can_view then v_resolved_at else null::timestamptz end;
end;
$$;

grant execute on function private.resolve_customer_product_price(uuid, uuid, integer)
  to authenticated;

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
  private.product_tier_prices(p.id) as tier_prices,
  resolved.effective_unit_price as price,
  resolved.effective_unit_price,
  resolved.base_unit_price,
  resolved.price_source,
  resolved.customer_level,
  resolved.price_group_id,
  resolved.discount_percent,
  resolved.level_discount_percent,
  resolved.price_group_discount_percent,
  resolved.margin_percent,
  resolved.price_version,
  resolved.price_resolved_at
from public.products as p
left join lateral private.resolve_customer_product_price(p.id, null, p.moq) as resolved
  on true
where p.status = 'active'
   or (select private.is_staff());

grant select on public.catalog_buyer_prices to authenticated;

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
  v_order_line_id uuid;
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
    select c.*
    into v_customer
    from public.customers as c
    where c.id = coalesce(p_customer_id, (select private.current_customer_id()))
      and (
        c.user_id = v_auth_uid
        or exists (
          select 1
          from public.customer_memberships as cm
          where cm.customer_id = c.id
            and cm.user_id = v_auth_uid
            and cm.status = 'active'
        )
      )
    limit 1;
  end if;

  if v_customer.id is null then
    raise exception 'No matching customer profile was found' using errcode = '23503';
  end if;

  if not v_is_staff and v_customer.status <> 'active' then
    raise exception 'Customer must be active before placing orders' using errcode = '42501';
  end if;

  if not v_is_staff
    and (
      coalesce(v_customer.customer_type, 'retail') <> 'wholesale'
      or coalesce(v_customer.assignment_status, 'needs_review') <> 'assigned'
    ) then
    raise exception 'Customer wholesale price list must be assigned before checkout' using errcode = '42501';
  end if;

  if coalesce(v_customer.contact_name, '') = ''
    or coalesce(v_customer.email, '') = ''
    or coalesce(v_customer.phone, '') = ''
    or coalesce(v_customer.billing_address, '') = ''
    or coalesce(v_customer.shipping_address, '') = '' then
    raise exception 'Customer contact, billing and shipping profile must be completed before checkout' using errcode = '42501';
  end if;

  if coalesce(v_customer.customer_type, 'retail') = 'retail'
    and coalesce(nullif(v_customer.fiscal_code, ''), nullif(v_customer.vat_number, ''), '') = '' then
    raise exception 'Retail customer fiscal code or VAT number is required before checkout' using errcode = '42501';
  end if;

  if coalesce(v_customer.customer_type, 'retail') = 'wholesale'
    and (
      coalesce(v_customer.company_name, '') = ''
      or coalesce(v_customer.vat_number, '') = ''
      or coalesce(v_customer.fiscal_code, '') = ''
      or coalesce(nullif(v_customer.pec, ''), nullif(v_customer.sdi, ''), '') = ''
    ) then
    raise exception 'Wholesale customer company and tax profile must be completed before checkout' using errcode = '42501';
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
    coalesce(v_customer.level, v_customer.tier, 'bronze'),
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
      round(requested.unit_net, 2) as requested_unit_net,
      nullif(btrim(requested.price_version), '') as requested_price_version,
      p.name as product_name,
      p.quality_grade,
      pricing.effective_unit_price as allowed_unit_price,
      pricing.base_unit_price,
      pricing.discount_percent,
      pricing.price_source,
      pricing.customer_level,
      pricing.price_group_id,
      pricing.price_version,
      pricing.price_resolved_at,
      p.moq,
      p.stock_status,
      p.stock_qty,
      p.batch_code,
      p.location
    from jsonb_to_recordset(p_lines) as requested(
      sku_code text,
      quantity integer,
      unit_net numeric,
      price_version text
    )
    join public.products as p on p.sku_code = requested.sku_code
    cross join lateral private.resolve_customer_product_price(
      p.id,
      v_customer.id,
      requested.quantity
    ) as pricing
    where p.status = 'active'
    order by requested.sku_code
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

    if v_line.allowed_unit_price is null then
      raise exception 'SKU % has no available price for this customer', v_line.sku_code using errcode = '42501';
    end if;

    if coalesce(v_line.requested_unit_net, v_line.allowed_unit_price) < 0 then
      raise exception 'SKU % has invalid pricing', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.requested_price_version is not null
      and v_line.price_version is not null
      and v_line.requested_price_version <> v_line.price_version then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code using errcode = '40001';
    end if;

    if v_line.requested_unit_net is not null
      and abs(v_line.requested_unit_net - v_line.allowed_unit_price) > 0.01 then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code using errcode = '40001';
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
      base_unit_price,
      discount_percent,
      price_source,
      customer_level_snapshot,
      price_group_id_snapshot,
      price_version,
      price_resolved_at,
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
      coalesce(v_line.requested_unit_net, v_line.allowed_unit_price),
      v_line.base_unit_price,
      v_line.discount_percent,
      v_line.price_source,
      v_line.customer_level,
      v_line.price_group_id,
      v_line.price_version,
      v_line.price_resolved_at,
      'pending_reservation',
      v_line.batch_code,
      v_line.location
    )
    returning id into v_order_line_id;

    perform private.reserve_order_line_inventory(v_order_line_id, v_line.sku_code, v_line.quantity);

    v_total_net := v_total_net + round(coalesce(v_line.requested_unit_net, v_line.allowed_unit_price) * v_line.quantity, 2);
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

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    v_order_id,
    'order_created',
    v_auth_uid,
    coalesce(p_customer_note, ''),
    jsonb_build_object(
      'source', 'create_order_transaction',
      'pricing_resolver', 'private.resolve_customer_product_price',
      'line_count', v_line_count,
      'customer_type', coalesce(v_customer.customer_type, 'retail'),
      'customer_level', coalesce(v_customer.level, v_customer.tier, 'bronze'),
      'price_group_id', v_customer.price_group_id,
      'shipping_method', coalesce(p_shipping_method, ''),
      'price_snapshot_validated', true
    )
  );

  return v_order_id;
end;
$$;

comment on function private.resolve_customer_product_price(uuid, uuid, integer) is
  'Authoritative PartsPro effective price resolver for customer-specific prices, customer levels, price groups, and margin guard.';
