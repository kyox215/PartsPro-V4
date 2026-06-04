-- Keep admin operation notes in order_events.note only.
-- Staff notes remain a manually edited order field.

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
  v_released integer := 0;
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

  if v_order.status = 'accepted' then
    v_released := private.release_order_inventory(p_order_id);
  end if;

  update public.orders
  set
    status = v_previous_status,
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
      'released_qty', v_released
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_order.status,
    'to_status', v_previous_status,
    'rollback', true,
    'released_qty', v_released
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

with generated_staff_notes as (
  select id
  from public.orders
  where staff_note is not null
    and btrim(staff_note) <> ''
    and (
      lower(btrim(staff_note)) in (
        lower('取消订单'),
        lower('Annulla ordine'),
        lower('Cancel order'),
        lower('Admin order update'),
        lower('Admin order status rollback'),
        lower('员工备注已更新'),
        lower('Nota staff aggiornata'),
        lower('Staff note updated')
      )
      or btrim(staff_note) ~* '^(新订单|已接单|拣货中|已打包|已发货|已完成|已取消|submitted|accepted|picking|packed|shipped|completed|cancelled|Nuovo ordine|Accettato|Picking|Imballato|Spedito|Completato|Annullato)[[:space:]]*->[[:space:]]*(新订单|已接单|拣货中|已打包|已发货|已完成|已取消|submitted|accepted|picking|packed|shipped|completed|cancelled|Nuovo ordine|Accettato|Picking|Imballato|Spedito|Completato|Annullato)$'
      or btrim(staff_note) ~* '^(回滚状态|Ripristina stato|Rollback status)[[:space:]]*:[[:space:]]*(新订单|已接单|拣货中|已打包|已发货|已完成|已取消|submitted|accepted|picking|packed|shipped|completed|cancelled|Nuovo ordine|Accettato|Picking|Imballato|Spedito|Completato|Annullato)[[:space:]]*->[[:space:]]*(新订单|已接单|拣货中|已打包|已发货|已完成|已取消|submitted|accepted|picking|packed|shipped|completed|cancelled|Nuovo ordine|Accettato|Picking|Imballato|Spedito|Completato|Annullato)$'
      or lower(btrim(staff_note)) like 'carrier:%'
      or lower(btrim(staff_note)) like 'corriere:%'
      or btrim(staff_note) like '运输公司:%'
      or btrim(staff_note) like '配送服务:%'
      or btrim(staff_note) like '物流单号:%'
      or lower(btrim(staff_note)) like 'tracking:%'
      or lower(btrim(staff_note)) like 'codice tracking:%'
      or lower(btrim(staff_note)) like 'numero tracking:%'
    )
)
update public.orders as o
set staff_note = null
from generated_staff_notes as g
where o.id = g.id;
