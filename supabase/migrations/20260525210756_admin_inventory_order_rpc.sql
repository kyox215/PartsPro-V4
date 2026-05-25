-- Admin operations and inventory reservation lifecycle.
--
-- This migration makes create_order_transaction reserve sellable stock inside
-- the same transaction, then exposes a staff-only status transition RPC for
-- order management. Stock lifecycle:
-- - submitted order creation reserves available stock
-- - cancelled releases reserved stock
-- - shipped/completed consumes reserved stock from the inventory ledger

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when lower(coalesce((auth.jwt() ->> 'email'), '')) in ('kyox120@gmail.com') then 'admin'
    else (
      select p.role
      from public.profiles as p
      where p.id = (select auth.uid())
      limit 1
    )
  end
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

grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.order_lines
  add column if not exists reserved_qty integer not null default 0,
  add column if not exists fulfilled_qty integer not null default 0,
  add column if not exists reservation_allocations jsonb not null default '[]'::jsonb;

alter table public.orders
  add column if not exists carrier text,
  add column if not exists tracking_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_lines'::regclass
      and conname = 'partspro_order_lines_reserved_qty_nonnegative'
  ) then
    alter table public.order_lines
      add constraint partspro_order_lines_reserved_qty_nonnegative
      check (reserved_qty >= 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_lines'::regclass
      and conname = 'partspro_order_lines_fulfilled_qty_nonnegative'
  ) then
    alter table public.order_lines
      add constraint partspro_order_lines_fulfilled_qty_nonnegative
      check (fulfilled_qty >= 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_lines'::regclass
      and conname = 'partspro_order_lines_reserved_fulfilled_lte_quantity'
  ) then
    alter table public.order_lines
      add constraint partspro_order_lines_reserved_fulfilled_lte_quantity
      check (reserved_qty + fulfilled_qty <= quantity)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.order_lines'::regclass
      and conname = 'partspro_order_lines_reservation_allocations_array'
  ) then
    alter table public.order_lines
      add constraint partspro_order_lines_reservation_allocations_array
      check (jsonb_typeof(reservation_allocations) = 'array')
      not valid;
  end if;
end $$;

create index if not exists order_lines_reserved_qty_idx
  on public.order_lines (order_id, reserved_qty)
  where reserved_qty > 0;

comment on column public.order_lines.reserved_qty is
  'Quantity currently reserved from products.stock_qty and inventory_items.available_qty.';

comment on column public.order_lines.fulfilled_qty is
  'Quantity consumed from reserved stock after shipment/completion.';

comment on column public.order_lines.reservation_allocations is
  'Inventory allocation metadata used to release or consume locked inventory rows.';

comment on column public.orders.carrier is
  'Operational carrier selected by staff in the admin order panel.';

comment on column public.orders.tracking_code is
  'Shipment tracking code selected by staff in the admin order panel.';

create or replace function private.partspro_stock_status(_stock_qty integer)
returns text
language sql
immutable
as $$
  select case
    when coalesce(_stock_qty, 0) <= 0 then 'out_of_stock'
    when coalesce(_stock_qty, 0) <= 5 then 'low_stock'
    else 'in_stock'
  end
$$;

create or replace function private.reserve_order_line_inventory(
  p_order_line_id uuid,
  p_sku_code text,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_order_line public.order_lines%rowtype;
  v_inventory record;
  v_remaining integer := p_quantity;
  v_take integer;
  v_has_inventory boolean := false;
  v_allocations jsonb := '[]'::jsonb;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Reservation quantity must be positive' using errcode = '23514';
  end if;

  select *
  into v_order_line
  from public.order_lines
  where id = p_order_line_id
  for update;

  if v_order_line.id is null then
    raise exception 'Order line does not exist' using errcode = '23503';
  end if;

  if v_order_line.reserved_qty + v_order_line.fulfilled_qty + p_quantity > v_order_line.quantity then
    raise exception 'Reservation exceeds order line quantity' using errcode = '23514';
  end if;

  select *
  into v_product
  from public.products
  where sku_code = p_sku_code
    and status = 'active'
  for update;

  if v_product.id is null then
    raise exception 'SKU % is inactive or unknown', p_sku_code using errcode = '23503';
  end if;

  if v_product.stock_status = 'out_of_stock' or coalesce(v_product.stock_qty, 0) <= 0 then
    raise exception 'SKU % is out of stock', p_sku_code using errcode = '23514';
  end if;

  if coalesce(v_product.stock_qty, 0) < p_quantity then
    raise exception 'Requested quantity exceeds available stock for SKU %', p_sku_code using errcode = '23514';
  end if;

  select exists (
    select 1
    from public.inventory_items
    where sku_code = p_sku_code
  )
  into v_has_inventory;

  if v_has_inventory then
    for v_inventory in
      select
        id,
        available_qty,
        batch_code,
        location
      from public.inventory_items
      where sku_code = p_sku_code
        and available_qty > 0
      order by
        case when location is not distinct from v_product.location then 0 else 1 end,
        available_qty desc,
        last_movement_at asc
      for update
    loop
      exit when v_remaining <= 0;

      v_take := least(v_remaining, v_inventory.available_qty);

      update public.inventory_items
      set
        available_qty = available_qty - v_take,
        locked_qty = locked_qty + v_take,
        last_movement_at = now()
      where id = v_inventory.id;

      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object(
        'inventory_item_id', v_inventory.id,
        'sku_code', p_sku_code,
        'quantity', v_take,
        'batch_code', v_inventory.batch_code,
        'location', v_inventory.location
      ));
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Inventory ledger cannot reserve % more unit(s) for SKU %', v_remaining, p_sku_code using errcode = '23514';
    end if;
  end if;

  update public.products
  set
    stock_qty = stock_qty - p_quantity,
    stock_status = private.partspro_stock_status(stock_qty - p_quantity),
    updated_at = now()
  where id = v_product.id;

  update public.order_lines
  set
    reserved_qty = reserved_qty + p_quantity,
    reservation_allocations = reservation_allocations || v_allocations,
    stock_status = 'reserved',
    location = coalesce(location, v_product.location),
    batch_code = coalesce(batch_code, v_product.batch_code)
  where id = p_order_line_id;

  return v_allocations;
end;
$$;

create or replace function private.release_order_line_inventory(p_order_line_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.order_lines%rowtype;
  v_allocation jsonb;
  v_inventory_id uuid;
  v_quantity integer;
  v_released integer := 0;
begin
  select *
  into v_line
  from public.order_lines
  where id = p_order_line_id
  for update;

  if v_line.id is null or v_line.reserved_qty <= 0 then
    return 0;
  end if;

  update public.products
  set
    stock_qty = stock_qty + v_line.reserved_qty,
    stock_status = private.partspro_stock_status(stock_qty + v_line.reserved_qty),
    updated_at = now()
  where sku_code = v_line.sku_code;

  for v_allocation in
    select value
    from jsonb_array_elements(coalesce(v_line.reservation_allocations, '[]'::jsonb))
  loop
    v_inventory_id := nullif(v_allocation ->> 'inventory_item_id', '')::uuid;
    v_quantity := coalesce((v_allocation ->> 'quantity')::integer, 0);

    if v_inventory_id is not null and v_quantity > 0 then
      update public.inventory_items
      set
        available_qty = available_qty + least(locked_qty, v_quantity),
        locked_qty = greatest(locked_qty - v_quantity, 0),
        last_movement_at = now()
      where id = v_inventory_id;
    end if;
  end loop;

  v_released := v_line.reserved_qty;

  update public.order_lines
  set
    reserved_qty = 0,
    reservation_allocations = '[]'::jsonb,
    stock_status = 'released'
  where id = v_line.id;

  return v_released;
end;
$$;

create or replace function private.consume_order_line_inventory(p_order_line_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line public.order_lines%rowtype;
  v_allocation jsonb;
  v_inventory_id uuid;
  v_quantity integer;
  v_consumed integer := 0;
begin
  select *
  into v_line
  from public.order_lines
  where id = p_order_line_id
  for update;

  if v_line.id is null or v_line.reserved_qty <= 0 then
    return 0;
  end if;

  for v_allocation in
    select value
    from jsonb_array_elements(coalesce(v_line.reservation_allocations, '[]'::jsonb))
  loop
    v_inventory_id := nullif(v_allocation ->> 'inventory_item_id', '')::uuid;
    v_quantity := coalesce((v_allocation ->> 'quantity')::integer, 0);

    if v_inventory_id is not null and v_quantity > 0 then
      update public.inventory_items
      set
        locked_qty = greatest(locked_qty - v_quantity, 0),
        actual_qty = greatest(actual_qty - v_quantity, 0),
        last_movement_at = now()
      where id = v_inventory_id;
    end if;
  end loop;

  v_consumed := v_line.reserved_qty;

  update public.order_lines
  set
    fulfilled_qty = fulfilled_qty + reserved_qty,
    reserved_qty = 0,
    reservation_allocations = '[]'::jsonb,
    stock_status = 'fulfilled'
  where id = v_line.id;

  return v_consumed;
end;
$$;

create or replace function private.ensure_order_inventory_reserved(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line record;
  v_to_reserve integer;
  v_reserved integer := 0;
begin
  for v_line in
    select
      id,
      sku_code,
      quantity,
      reserved_qty,
      fulfilled_qty
    from public.order_lines
    where order_id = p_order_id
    order by sku_code, id
  loop
    v_to_reserve := v_line.quantity - v_line.reserved_qty - v_line.fulfilled_qty;

    if v_to_reserve > 0 then
      perform private.reserve_order_line_inventory(v_line.id, v_line.sku_code, v_to_reserve);
      v_reserved := v_reserved + v_to_reserve;
    end if;
  end loop;

  return v_reserved;
end;
$$;

create or replace function private.release_order_inventory(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line record;
  v_released integer := 0;
begin
  for v_line in
    select id
    from public.order_lines
    where order_id = p_order_id
      and reserved_qty > 0
    order by id
  loop
    v_released := v_released + private.release_order_line_inventory(v_line.id);
  end loop;

  return v_released;
end;
$$;

create or replace function private.consume_order_inventory(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line record;
  v_consumed integer := 0;
begin
  for v_line in
    select id
    from public.order_lines
    where order_id = p_order_id
      and reserved_qty > 0
    order by id
  loop
    v_consumed := v_consumed + private.consume_order_line_inventory(v_line.id);
  end loop;

  return v_consumed;
end;
$$;

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
      p.stock_qty,
      p.batch_code,
      p.location
    from jsonb_to_recordset(p_lines) as requested(sku_code text, quantity integer)
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
      v_line.b2b_price,
      'pending_reservation',
      v_line.batch_code,
      v_line.location
    )
    returning id into v_order_line_id;

    perform private.reserve_order_line_inventory(v_order_line_id, v_line.sku_code, v_line.quantity);

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
    'Created through create_order_transaction RPC and stock reserved',
    jsonb_build_object(
      'line_count', v_line_count,
      'source', 'rpc',
      'inventory_action', 'reserved'
    )
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

create or replace function private.admin_transition_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := (select private.is_staff());
  v_order public.orders%rowtype;
  v_old_rank integer;
  v_new_rank integer;
  v_reserved integer := 0;
  v_released integer := 0;
  v_consumed integer := 0;
  v_payment_status text;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce(v_is_staff, false) then
    raise exception 'Staff role required' using errcode = '42501';
  end if;

  if p_status not in ('submitted', 'accepted', 'picking', 'packed', 'shipped', 'completed', 'cancelled') then
    raise exception 'Unsupported order status %', p_status using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  if v_order.status in ('completed', 'cancelled') and v_order.status <> p_status then
    raise exception 'Completed or cancelled orders cannot be reopened' using errcode = '42501';
  end if;

  if p_status = 'cancelled' and v_order.status = 'shipped' then
    raise exception 'Shipped orders cannot be cancelled through stock release flow' using errcode = '42501';
  end if;

  v_old_rank := case v_order.status
    when 'submitted' then 1
    when 'accepted' then 2
    when 'picking' then 3
    when 'packed' then 4
    when 'shipped' then 5
    when 'completed' then 6
    when 'cancelled' then 7
    else 0
  end;
  v_new_rank := case p_status
    when 'submitted' then 1
    when 'accepted' then 2
    when 'picking' then 3
    when 'packed' then 4
    when 'shipped' then 5
    when 'completed' then 6
    when 'cancelled' then 7
    else 0
  end;

  if p_status <> 'cancelled' and v_new_rank < v_old_rank then
    raise exception 'Order status cannot move backward from % to %', v_order.status, p_status using errcode = '42501';
  end if;

  if p_status in ('accepted', 'picking', 'packed') then
    v_reserved := private.ensure_order_inventory_reserved(p_order_id);
  elsif p_status in ('shipped', 'completed') then
    v_reserved := private.ensure_order_inventory_reserved(p_order_id);
    v_consumed := private.consume_order_inventory(p_order_id);
  elsif p_status = 'cancelled' then
    v_released := private.release_order_inventory(p_order_id);
  end if;

  v_payment_status := case
    when p_status in ('accepted', 'picking', 'packed', 'shipped', 'completed') then 'paid'
    when p_status = 'cancelled' and v_order.payment_status in ('pending', 'bank_waiting') then 'failed'
    else v_order.payment_status
  end;

  update public.orders
  set
    status = p_status,
    payment_status = v_payment_status,
    staff_note = coalesce(nullif(coalesce(p_note, ''), ''), staff_note),
    updated_at = now()
  where id = p_order_id;

  insert into public.order_events (
    order_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    note,
    metadata
  )
  values (
    p_order_id,
    'status_changed',
    v_order.status,
    p_status,
    v_auth_uid,
    nullif(coalesce(p_note, ''), ''),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'reserved_qty', v_reserved,
      'released_qty', v_released,
      'consumed_qty', v_consumed
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_order.status,
    'to_status', p_status,
    'reserved_qty', v_reserved,
    'released_qty', v_released,
    'consumed_qty', v_consumed
  );
end;
$$;

create or replace function public.admin_transition_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_transition_order_status(
    p_order_id,
    p_status,
    p_note,
    p_metadata
  )
$$;

revoke execute on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  from public, anon;
grant execute on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  to authenticated;
revoke execute on function private.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  from public, anon;
grant execute on function private.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  to authenticated;

revoke execute on function public.admin_transition_order_status(uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.admin_transition_order_status(uuid, text, text, jsonb)
  to authenticated;
revoke execute on function private.admin_transition_order_status(uuid, text, text, jsonb)
  from public, anon;
grant execute on function private.admin_transition_order_status(uuid, text, text, jsonb)
  to authenticated;

revoke execute on function private.reserve_order_line_inventory(uuid, text, integer)
  from public, anon, authenticated;
revoke execute on function private.release_order_line_inventory(uuid)
  from public, anon, authenticated;
revoke execute on function private.consume_order_line_inventory(uuid)
  from public, anon, authenticated;
revoke execute on function private.ensure_order_inventory_reserved(uuid)
  from public, anon, authenticated;
revoke execute on function private.release_order_inventory(uuid)
  from public, anon, authenticated;
revoke execute on function private.consume_order_inventory(uuid)
  from public, anon, authenticated;

comment on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric) is
  'Authenticated RPC wrapper for atomic order creation with inventory reservation.';

comment on function public.admin_transition_order_status(uuid, text, text, jsonb) is
  'Staff-only order status transition RPC. Reserves missing stock for active orders, releases reservations on cancellation, and consumes reservations on shipment/completion.';
