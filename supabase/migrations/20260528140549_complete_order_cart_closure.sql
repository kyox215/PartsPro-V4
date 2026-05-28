-- Complete cart/order closure:
-- - customer membership users can submit orders for their active customer
-- - order RPC validates the UI price snapshot instead of silently recalculating
-- - order-line reservation/release/consume changes are auditable as stock movements

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  sku_code text not null,
  order_id uuid references public.orders(id) on delete cascade,
  order_line_id uuid references public.order_lines(id) on delete cascade,
  movement_type text not null check (movement_type in ('reserve', 'release', 'consume')),
  quantity integer not null check (quantity > 0),
  actor_id uuid references auth.users(id) on delete set null,
  before_reserved_qty integer,
  after_reserved_qty integer,
  before_fulfilled_qty integer,
  after_fulfilled_qty integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_order_idx
  on public.stock_movements (order_id, created_at desc);

create index if not exists stock_movements_sku_idx
  on public.stock_movements (sku_code, created_at desc);

alter table public.stock_movements enable row level security;

grant select on public.stock_movements to authenticated;

drop policy if exists "partspro_stock_movements_staff_or_customer_read"
  on public.stock_movements;

create policy "partspro_stock_movements_staff_or_customer_read"
  on public.stock_movements
  for select
  using (
    (select private.is_staff())
    or exists (
      select 1
      from public.orders as o
      where o.id = public.stock_movements.order_id
        and (
          o.user_id = (select auth.uid())
          or o.customer_id = (select private.current_customer_id())
        )
    )
  );

create or replace function private.record_order_line_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reserved_delta integer := 0;
  v_fulfilled_delta integer := 0;
  v_movement_type text;
  v_quantity integer;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.reserved_qty, 0) <= 0 then
      return new;
    end if;

    v_movement_type := 'reserve';
    v_quantity := new.reserved_qty;
  else
    v_reserved_delta := coalesce(new.reserved_qty, 0) - coalesce(old.reserved_qty, 0);
    v_fulfilled_delta := coalesce(new.fulfilled_qty, 0) - coalesce(old.fulfilled_qty, 0);
  end if;

  if v_movement_type is not null then
    null;
  elsif v_reserved_delta > 0 then
    v_movement_type := 'reserve';
    v_quantity := v_reserved_delta;
  elsif v_fulfilled_delta > 0 then
    v_movement_type := 'consume';
    v_quantity := v_fulfilled_delta;
  elsif v_reserved_delta < 0 and v_fulfilled_delta <= 0 then
    v_movement_type := 'release';
    v_quantity := abs(v_reserved_delta);
  else
    return new;
  end if;

  insert into public.stock_movements (
    sku_code,
    order_id,
    order_line_id,
    movement_type,
    quantity,
    actor_id,
    before_reserved_qty,
    after_reserved_qty,
    before_fulfilled_qty,
    after_fulfilled_qty,
    metadata
  )
  values (
    new.sku_code,
    new.order_id,
    new.id,
    v_movement_type,
    v_quantity,
    (select auth.uid()),
    case when tg_op = 'INSERT' then 0 else coalesce(old.reserved_qty, 0) end,
    coalesce(new.reserved_qty, 0),
    case when tg_op = 'INSERT' then 0 else coalesce(old.fulfilled_qty, 0) end,
    coalesce(new.fulfilled_qty, 0),
    jsonb_build_object(
      'stock_status', new.stock_status,
      'batch_code', new.batch_code,
      'location', new.location,
      'reservation_allocations', coalesce(new.reservation_allocations, '[]'::jsonb)
    )
  );

  return new;
end;
$$;

drop trigger if exists partspro_order_lines_stock_movement_audit
  on public.order_lines;

create trigger partspro_order_lines_stock_movement_audit
  after insert or update of reserved_qty, fulfilled_qty, stock_status
  on public.order_lines
  for each row
  execute function private.record_order_line_stock_movement();

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
      p.name as product_name,
      p.quality_grade,
      round(
        (
          case
            when coalesce(v_customer.customer_type, 'retail') = 'wholesale'
              then coalesce(p.b2b_price, p.retail_price, 0)
            else coalesce(p.retail_price, p.b2b_price, 0)
          end
        ) * (1 - private.customer_level_discount(coalesce(v_customer.level, v_customer.tier, 'bronze'))),
        2
      ) as allowed_unit_price,
      p.moq,
      p.stock_status,
      p.stock_qty,
      p.batch_code,
      p.location
    from jsonb_to_recordset(p_lines) as requested(
      sku_code text,
      quantity integer,
      unit_net numeric
    )
    join public.products as p on p.sku_code = requested.sku_code
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

    if coalesce(v_line.requested_unit_net, v_line.allowed_unit_price) < 0 then
      raise exception 'SKU % has invalid pricing', v_line.sku_code using errcode = '23514';
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
      'line_count', v_line_count,
      'customer_type', coalesce(v_customer.customer_type, 'retail'),
      'customer_level', coalesce(v_customer.level, v_customer.tier, 'bronze'),
      'shipping_method', coalesce(p_shipping_method, ''),
      'price_snapshot_validated', true
    )
  );

  return v_order_id;
end;
$$;
