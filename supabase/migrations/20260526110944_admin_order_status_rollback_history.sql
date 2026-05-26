-- Add a staff-only, inventory-aware rollback action for order states that are
-- safe to reverse from the admin detail panel.

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

create or replace function public.admin_rollback_order_status(
  p_order_id uuid,
  p_note text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_rollback_order_status(
    p_order_id,
    p_note,
    p_metadata
  )
$$;

revoke execute on function public.admin_rollback_order_status(uuid, text, jsonb)
  from public, anon;
grant execute on function public.admin_rollback_order_status(uuid, text, jsonb)
  to authenticated;
revoke execute on function private.admin_rollback_order_status(uuid, text, jsonb)
  from public, anon;
grant execute on function private.admin_rollback_order_status(uuid, text, jsonb)
  to authenticated;
