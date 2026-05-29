-- Order lifecycle hardening:
-- - status transitions are sequential and separated from payment collection
-- - normal cancellation releases reservations only before shipment
-- - shipped force-cancellation is admin-only and keeps stock unavailable
-- - historical orders with missing reservations are checked before progressing

create or replace function private.order_reservation_issues(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  with lines as (
    select
      l.id,
      l.sku_code,
      coalesce(l.quantity, 0) as quantity,
      coalesce(l.reserved_qty, 0) as reserved_qty,
      coalesce(l.fulfilled_qty, 0) as fulfilled_qty,
      greatest(
        coalesce(l.quantity, 0) - coalesce(l.reserved_qty, 0) - coalesce(l.fulfilled_qty, 0),
        0
      ) as needed_qty
    from public.order_lines as l
    where l.order_id = p_order_id
  ),
  stock as (
    select
      lines.*,
      p.id as product_id,
      p.status as product_status,
      coalesce(p.stock_qty, 0) as product_stock_qty,
      coalesce(inv.has_inventory, false) as has_inventory,
      coalesce(inv.available_qty, 0) as inventory_available_qty
    from lines
    left join public.products as p
      on p.sku_code = lines.sku_code
    left join lateral (
      select
        count(*) > 0 as has_inventory,
        coalesce(sum(greatest(coalesce(i.available_qty, 0), 0)), 0)::integer as available_qty
      from public.inventory_items as i
      where i.sku_code = lines.sku_code
    ) as inv on true
    where lines.needed_qty > 0
  ),
  issues as (
    select
      id,
      sku_code,
      quantity,
      reserved_qty,
      fulfilled_qty,
      needed_qty,
      product_status,
      product_stock_qty,
      inventory_available_qty,
      case
        when product_id is null then 'missing_product'
        when coalesce(product_status, '') <> 'active' then 'inactive_product'
        when needed_qty > product_stock_qty then 'insufficient_product_stock'
        when has_inventory and needed_qty > inventory_available_qty then 'insufficient_inventory_ledger'
        else null
      end as reason
    from stock
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'order_line_id', id,
        'sku_code', sku_code,
        'quantity', quantity,
        'reserved_qty', reserved_qty,
        'fulfilled_qty', fulfilled_qty,
        'needed_qty', needed_qty,
        'product_status', product_status,
        'product_stock_qty', product_stock_qty,
        'inventory_available_qty', inventory_available_qty,
        'reason', reason
      )
      order by sku_code, id
    ) filter (where reason is not null),
    '[]'::jsonb
  )
  from issues
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
  v_allowed boolean := false;
  v_reserved integer := 0;
  v_released integer := 0;
  v_consumed integer := 0;
  v_reservation_issues jsonb := '[]'::jsonb;
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

  if v_order.status = p_status then
    return jsonb_build_object(
      'order_id', p_order_id,
      'from_status', v_order.status,
      'to_status', p_status,
      'noop', true,
      'inventory_lifecycle', 'unchanged'
    );
  end if;

  if v_order.status in ('completed', 'cancelled') then
    raise exception 'Completed or cancelled orders cannot be reopened' using errcode = '42501';
  end if;

  v_allowed := case v_order.status
    when 'submitted' then p_status in ('accepted', 'cancelled')
    when 'accepted' then p_status in ('picking', 'cancelled')
    when 'picking' then p_status in ('packed', 'cancelled')
    when 'packed' then p_status in ('shipped', 'cancelled')
    when 'shipped' then p_status = 'completed'
    else false
  end;

  if not v_allowed then
    raise exception 'Invalid order status transition from % to %', v_order.status, p_status using errcode = '42501';
  end if;

  if p_status in ('accepted', 'picking', 'packed', 'shipped', 'completed') then
    v_reservation_issues := private.order_reservation_issues(p_order_id);

    if jsonb_array_length(v_reservation_issues) > 0 then
      raise exception 'Order inventory cannot be reserved'
        using errcode = '23514',
          detail = v_reservation_issues::text,
          hint = 'reservation_issues';
    end if;

    v_reserved := private.ensure_order_inventory_reserved(p_order_id);
  end if;

  if p_status = 'completed' then
    v_consumed := private.consume_order_inventory(p_order_id);
  elsif p_status = 'cancelled' then
    v_released := private.release_order_inventory(p_order_id);
  end if;

  update public.orders
  set
    status = p_status,
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
      'inventory_lifecycle', 'reserved_on_order_create_released_on_pre_ship_cancel_consumed_on_completed',
      'payment_lifecycle', 'payment_status_is_explicit_only',
      'reserved_qty', v_reserved,
      'released_qty', v_released,
      'consumed_qty', v_consumed
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_order.status,
    'to_status', p_status,
    'inventory_lifecycle', 'reserved_on_order_create_released_on_pre_ship_cancel_consumed_on_completed',
    'payment_lifecycle', 'payment_status_is_explicit_only',
    'reserved_qty', v_reserved,
    'released_qty', v_released,
    'consumed_qty', v_consumed
  );
end;
$$;

create or replace function private.admin_force_cancel_shipped_order(
  p_order_id uuid,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_is_admin boolean := (select private.is_admin());
  v_order public.orders%rowtype;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_reserved_kept integer := 0;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce(v_is_admin, false) then
    raise exception 'Admin role required for shipped order force cancellation' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Force cancellation reason is required' using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  if v_order.status <> 'shipped' then
    raise exception 'Only shipped orders can be force-cancelled through this flow' using errcode = '42501';
  end if;

  select coalesce(sum(reserved_qty), 0)::integer
  into v_reserved_kept
  from public.order_lines
  where order_id = p_order_id;

  update public.order_lines
  set stock_status = 'force_cancelled_in_transit'
  where order_id = p_order_id
    and reserved_qty > 0;

  update public.orders
  set
    status = 'cancelled',
    staff_note = v_reason,
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
    'force_cancelled',
    v_order.status,
    'cancelled',
    v_auth_uid,
    v_reason,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'force_cancel', true,
      'inventory_lifecycle', 'force_cancel_keeps_reserved_stock_unavailable',
      'reserved_qty_kept', v_reserved_kept
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_order.status,
    'to_status', 'cancelled',
    'force_cancel', true,
    'inventory_lifecycle', 'force_cancel_keeps_reserved_stock_unavailable',
    'reserved_qty_kept', v_reserved_kept
  );
end;
$$;

create or replace function public.admin_force_cancel_shipped_order(
  p_order_id uuid,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_force_cancel_shipped_order(
    p_order_id,
    p_reason,
    p_metadata
  )
$$;

revoke execute on function public.admin_force_cancel_shipped_order(uuid, text, jsonb)
  from public, anon;
grant execute on function public.admin_force_cancel_shipped_order(uuid, text, jsonb)
  to authenticated;
revoke execute on function private.admin_force_cancel_shipped_order(uuid, text, jsonb)
  from public, anon;
grant execute on function private.admin_force_cancel_shipped_order(uuid, text, jsonb)
  to authenticated;
revoke execute on function private.order_reservation_issues(uuid)
  from public, anon, authenticated;

comment on function private.order_reservation_issues(uuid) is
  'Returns line-level stock issues before reserving missing inventory for historical orders.';

comment on function public.admin_transition_order_status(uuid, text, text, jsonb) is
  'Staff-only sequential order status transition RPC. Payment status is not changed unless updated explicitly by a separate operation.';

comment on function public.admin_force_cancel_shipped_order(uuid, text, jsonb) is
  'Admin-only shipped order force-cancellation RPC. It marks the order cancelled while keeping reserved stock unavailable for RMA or quality control.';

comment on column public.order_lines.stock_status is
  'Operational line stock state, including pending_reservation, reserved, released, fulfilled, and force_cancelled_in_transit.';
