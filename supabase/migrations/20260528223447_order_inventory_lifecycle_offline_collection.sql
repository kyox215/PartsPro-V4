-- Offline collection inventory lifecycle:
-- - carts and checkout preview do not reserve stock
-- - order creation reserves stock
-- - active operational statuses keep reservations
-- - only completed consumes stock
-- - only cancelled releases stock

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

  if p_status in ('accepted', 'picking', 'packed', 'shipped') then
    v_reserved := private.ensure_order_inventory_reserved(p_order_id);
  elsif p_status = 'completed' then
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
      'inventory_lifecycle', 'reserved_on_order_create_released_on_cancel_consumed_on_completed',
      'reserved_qty', v_reserved,
      'released_qty', v_released,
      'consumed_qty', v_consumed
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_order.status,
    'to_status', p_status,
    'inventory_lifecycle', 'reserved_on_order_create_released_on_cancel_consumed_on_completed',
    'reserved_qty', v_reserved,
    'released_qty', v_released,
    'consumed_qty', v_consumed
  );
end;
$$;

create or replace function private.admin_rollback_order_status(
  p_order_id uuid,
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
  v_previous_status text;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce(v_is_staff, false) then
    raise exception 'Staff role required' using errcode = '42501';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  v_previous_status := case v_order.status
    when 'accepted' then 'submitted'
    when 'picking' then 'accepted'
    when 'packed' then 'picking'
    else null
  end;

  if v_previous_status is null then
    raise exception 'Order status % cannot be rolled back from the admin panel', v_order.status using errcode = '42501';
  end if;

  update public.orders
  set
    status = v_previous_status,
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
    'status_rolled_back',
    v_order.status,
    v_previous_status,
    v_auth_uid,
    nullif(coalesce(p_note, ''), ''),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'rollback', true,
      'inventory_lifecycle', 'rollback_keeps_existing_reservation',
      'released_qty', 0
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_order.status,
    'to_status', v_previous_status,
    'rollback', true,
    'inventory_lifecycle', 'rollback_keeps_existing_reservation',
    'released_qty', 0
  );
end;
$$;

comment on function public.admin_transition_order_status(uuid, text, text, jsonb) is
  'Staff-only order status transition RPC. Stock is reserved on order creation, kept through shipped, released only on cancellation, and consumed only on completed.';

comment on function public.admin_rollback_order_status(uuid, text, jsonb) is
  'Staff-only order status rollback RPC. Rollback keeps existing reservations; cancellation is the only release action.';
