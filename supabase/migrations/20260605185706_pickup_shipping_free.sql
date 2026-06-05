-- Keep storefront checkout, admin logistics, and persisted order totals aligned
-- for in-store pickup orders. "Ritiro in sede" is the canonical pickup label.

create or replace function private.partspro_is_pickup_shipping_method(p_value text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select lower(btrim(coalesce(p_value, ''))) = any (array[
    'pickup',
    'pickup_milano',
    'ritiro',
    'ritiro in sede',
    'ritiro sede'
  ])
  or lower(btrim(coalesce(p_value, ''))) like '%ritiro%';
$$;

create or replace function private.partspro_normalize_pickup_order_shipping()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if private.partspro_is_pickup_shipping_method(new.shipping_method)
     or private.partspro_is_pickup_shipping_method(new.carrier) then
    new.shipping_method := 'Ritiro in sede';
    new.carrier := 'Ritiro in sede';
    new.tracking_code := null;
    new.shipping := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists partspro_orders_pickup_shipping_normalize on public.orders;

create trigger partspro_orders_pickup_shipping_normalize
before insert or update of shipping_method, carrier, tracking_code, shipping
on public.orders
for each row
execute function private.partspro_normalize_pickup_order_shipping();

create or replace function private.admin_update_order_logistics(
  p_order_id uuid,
  p_carrier text default null,
  p_tracking text default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_next_carrier text := nullif(btrim(coalesce(p_carrier, '')), '');
  v_next_tracking text := nullif(btrim(coalesce(p_tracking, '')), '');
  v_next_shipping_method text;
  v_pickup boolean;
  v_previous_shipping numeric(12, 2);
  v_next_shipping numeric(12, 2);
  v_previous_total numeric(12, 2);
  v_next_total numeric(12, 2);
  v_previous_payment_received_amount numeric(12, 2);
  v_next_payment_received_amount numeric(12, 2);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('orders.manage')), false) then
    raise exception 'orders.manage permission required' using errcode = '42501';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  v_pickup := private.partspro_is_pickup_shipping_method(v_next_carrier);
  v_previous_shipping := round(coalesce(v_order.shipping, 0), 2);
  v_previous_total := round(
    coalesce(v_order.total_net, 0) + coalesce(v_order.vat, 0) + coalesce(v_order.shipping, 0),
    2
  );
  v_previous_payment_received_amount := v_order.payment_received_amount;

  if v_pickup then
    v_next_carrier := 'Ritiro in sede';
    v_next_tracking := null;
    v_next_shipping_method := 'Ritiro in sede';
    v_next_shipping := 0;
  elsif v_next_carrier is null then
    v_next_tracking := null;
    v_next_shipping_method := null;
    v_next_shipping := v_previous_shipping;
  else
    v_next_shipping_method := case
      when private.partspro_is_pickup_shipping_method(v_order.shipping_method) then 'GLS/BRT 24-48h'
      else coalesce(nullif(btrim(coalesce(v_order.shipping_method, '')), ''), 'GLS/BRT 24-48h')
    end;
    v_next_shipping := v_previous_shipping;
  end if;

  v_next_total := round(
    coalesce(v_order.total_net, 0) + coalesce(v_order.vat, 0) + coalesce(v_next_shipping, 0),
    2
  );
  v_next_payment_received_amount := case
    when v_order.payment_status = 'paid' then v_next_total
    else v_order.payment_received_amount
  end;

  update public.orders
  set
    carrier = v_next_carrier,
    tracking_code = v_next_tracking,
    shipping_method = v_next_shipping_method,
    shipping = v_next_shipping,
    payment_received_amount = v_next_payment_received_amount,
    updated_at = now()
  where id = p_order_id;

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    p_order_id,
    'operations_updated',
    v_auth_uid,
    coalesce(v_note, 'Logistics updated'),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'operation', 'logistics_updated',
      'previous_carrier', v_order.carrier,
      'carrier', v_next_carrier,
      'previous_tracking', v_order.tracking_code,
      'tracking', v_next_tracking,
      'previous_shipping_method', v_order.shipping_method,
      'shipping_method', v_next_shipping_method,
      'previous_shipping', v_previous_shipping,
      'shipping', v_next_shipping,
      'previous_total', v_previous_total,
      'total', v_next_total,
      'previous_payment_received_amount', v_previous_payment_received_amount,
      'payment_received_amount', v_next_payment_received_amount,
      'pickup', v_pickup,
      'actor_id', v_auth_uid
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'previous_carrier', v_order.carrier,
    'carrier', v_next_carrier,
    'previous_tracking', v_order.tracking_code,
    'tracking', v_next_tracking,
    'previous_shipping_method', v_order.shipping_method,
    'shipping_method', v_next_shipping_method,
    'previous_shipping', v_previous_shipping,
    'shipping', v_next_shipping,
    'previous_total', v_previous_total,
    'total', v_next_total,
    'previous_payment_received_amount', v_previous_payment_received_amount,
    'payment_received_amount', v_next_payment_received_amount,
    'pickup', v_pickup
  );
end;
$$;

create or replace function public.admin_update_order_logistics(
  p_order_id uuid,
  p_carrier text default null,
  p_tracking text default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_update_order_logistics(
    p_order_id,
    p_carrier,
    p_tracking,
    p_note,
    p_metadata
  )
$$;

revoke execute on function public.admin_update_order_logistics(
  uuid,
  text,
  text,
  text,
  jsonb
) from public, anon;

grant execute on function public.admin_update_order_logistics(
  uuid,
  text,
  text,
  text,
  jsonb
) to authenticated;

revoke execute on function private.admin_update_order_logistics(
  uuid,
  text,
  text,
  text,
  jsonb
) from public, anon;

grant execute on function private.admin_update_order_logistics(
  uuid,
  text,
  text,
  text,
  jsonb
) to authenticated;

comment on function public.admin_update_order_logistics(
  uuid,
  text,
  text,
  text,
  jsonb
) is
  'Updates admin order logistics and reconciles pickup shipping to zero.';

create or replace function private.admin_adjust_order_shipping(
  p_order_id uuid,
  p_shipping_amount numeric,
  p_reason text,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_previous_shipping numeric(12, 2);
  v_next_shipping numeric(12, 2);
  v_previous_total numeric(12, 2);
  v_next_total numeric(12, 2);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_received_amount_for_due numeric(12, 2);
  v_next_payment_status text;
  v_next_payment_received_amount numeric(12, 2);
  v_payment_due_amount numeric(12, 2);
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('orders.manage')), false) then
    raise exception 'orders.manage permission required' using errcode = '42501';
  end if;

  if p_shipping_amount is null or p_shipping_amount < 0 then
    raise exception 'Shipping amount cannot be negative' using errcode = '23514';
  end if;

  if v_reason is null then
    raise exception 'Shipping adjustment reason is required' using errcode = '23514';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Cancelled orders cannot be adjusted for shipping' using errcode = '42501';
  end if;

  v_next_shipping := round(p_shipping_amount, 2);

  if v_next_shipping > 0
     and (
       private.partspro_is_pickup_shipping_method(v_order.shipping_method)
       or private.partspro_is_pickup_shipping_method(v_order.carrier)
     ) then
    raise exception 'Switch order logistics to courier before adding shipping fee' using errcode = '23514';
  end if;

  v_previous_shipping := round(coalesce(v_order.shipping, 0), 2);
  v_previous_total := round(
    coalesce(v_order.total_net, 0) + coalesce(v_order.vat, 0) + coalesce(v_order.shipping, 0),
    2
  );
  v_next_total := round(
    coalesce(v_order.total_net, 0) + coalesce(v_order.vat, 0) + v_next_shipping,
    2
  );
  v_received_amount_for_due := case
    when v_order.payment_received_amount is not null then round(v_order.payment_received_amount, 2)
    when v_order.payment_status = 'paid' then v_previous_total
    else 0
  end;
  v_payment_due_amount := greatest(round(v_next_total - v_received_amount_for_due, 2), 0);
  v_next_payment_status := case
    when v_order.payment_status = 'paid' and v_payment_due_amount > 0 then 'pending'
    else v_order.payment_status
  end;
  v_next_payment_received_amount := case
    when v_order.payment_status = 'paid'
      and v_order.payment_received_amount is null
      and v_payment_due_amount > 0
      then v_previous_total
    else v_order.payment_received_amount
  end;

  update public.orders
  set
    shipping = v_next_shipping,
    payment_status = v_next_payment_status,
    payment_received_amount = v_next_payment_received_amount,
    updated_at = now()
  where id = p_order_id;

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    p_order_id,
    'shipping_adjusted',
    v_auth_uid,
    coalesce(v_note, v_reason),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'operation', 'shipping_adjusted',
      'reason', v_reason,
      'previous_shipping', v_previous_shipping,
      'shipping', v_next_shipping,
      'previous_total', v_previous_total,
      'total', v_next_total,
      'previous_payment_status', v_order.payment_status,
      'payment_status', v_next_payment_status,
      'previous_payment_received_amount', v_order.payment_received_amount,
      'payment_received_amount', v_next_payment_received_amount,
      'payment_due_amount', v_payment_due_amount,
      'actor_id', v_auth_uid
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'reason', v_reason,
    'previous_shipping', v_previous_shipping,
    'shipping', v_next_shipping,
    'previous_total', v_previous_total,
    'total', v_next_total,
    'previous_payment_status', v_order.payment_status,
    'payment_status', v_next_payment_status,
    'previous_payment_received_amount', v_order.payment_received_amount,
    'payment_received_amount', v_next_payment_received_amount,
    'payment_due_amount', v_payment_due_amount
  );
end;
$$;

create or replace function public.admin_adjust_order_shipping(
  p_order_id uuid,
  p_shipping_amount numeric,
  p_reason text,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_adjust_order_shipping(
    p_order_id,
    p_shipping_amount,
    p_reason,
    p_note,
    p_metadata
  )
$$;

revoke execute on function public.admin_adjust_order_shipping(
  uuid,
  numeric,
  text,
  text,
  jsonb
) from public, anon;

grant execute on function public.admin_adjust_order_shipping(
  uuid,
  numeric,
  text,
  text,
  jsonb
) to authenticated;

revoke execute on function private.admin_adjust_order_shipping(
  uuid,
  numeric,
  text,
  text,
  jsonb
) from public, anon;

grant execute on function private.admin_adjust_order_shipping(
  uuid,
  numeric,
  text,
  text,
  jsonb
) to authenticated;

comment on function public.admin_adjust_order_shipping(
  uuid,
  numeric,
  text,
  text,
  jsonb
) is
  'Adjusts an order shipping amount independently from logistics. Requires orders.manage and records a shipping_adjusted event.';
