insert into public.admin_permissions (id, label, group_name, description)
values (
  'orders.danger',
  'Dangerous order actions',
  'orders',
  'Can void, hide, and restore completed or archived orders.'
)
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values ('admin', 'orders.danger')
on conflict do nothing;

alter table public.orders
  add column if not exists soft_deleted_at timestamptz,
  add column if not exists soft_deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists danger_action_type text,
  add column if not exists danger_action_reason text,
  add column if not exists danger_action_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partspro_orders_danger_action_metadata_object'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint partspro_orders_danger_action_metadata_object
      check (jsonb_typeof(danger_action_metadata) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'partspro_orders_danger_action_type_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint partspro_orders_danger_action_type_check
      check (
        danger_action_type is null
        or danger_action_type in ('void_and_soft_delete')
      );
  end if;
end
$$;

create index if not exists orders_soft_deleted_created_idx
  on public.orders (soft_deleted_at, created_at desc);

create or replace function private.restore_completed_order_inventory(
  p_order_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_line record;
  v_inventory_id uuid;
  v_restored integer := 0;
begin
  for v_line in
    select
      ol.id,
      ol.sku_code,
      ol.product_name,
      ol.quality_grade,
      ol.batch_code,
      ol.location,
      ol.fulfilled_qty,
      p.brand,
      p.model
    from public.order_lines as ol
    left join public.products as p on p.sku_code = ol.sku_code
    where ol.order_id = p_order_id
      and coalesce(ol.fulfilled_qty, 0) > 0
    order by ol.id
  loop
    update public.products
    set
      stock_qty = stock_qty + v_line.fulfilled_qty,
      stock_status = private.partspro_stock_status(stock_qty + v_line.fulfilled_qty),
      updated_at = now()
    where sku_code = v_line.sku_code;

    select id
    into v_inventory_id
    from public.inventory_items
    where sku_code = v_line.sku_code
      and batch_code is not distinct from v_line.batch_code
      and location is not distinct from v_line.location
    order by last_movement_at desc
    limit 1
    for update;

    if v_inventory_id is null then
      insert into public.inventory_items (
        sku_code,
        product_name,
        brand,
        model,
        quality_grade,
        batch_code,
        location,
        actual_qty,
        available_qty,
        locked_qty,
        last_movement_at
      )
      values (
        v_line.sku_code,
        v_line.product_name,
        v_line.brand,
        v_line.model,
        v_line.quality_grade,
        v_line.batch_code,
        v_line.location,
        v_line.fulfilled_qty,
        v_line.fulfilled_qty,
        0,
        now()
      );
    else
      update public.inventory_items
      set
        actual_qty = actual_qty + v_line.fulfilled_qty,
        available_qty = available_qty + v_line.fulfilled_qty,
        last_movement_at = now()
      where id = v_inventory_id;
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
      v_line.sku_code,
      p_order_id,
      v_line.id,
      'release',
      v_line.fulfilled_qty,
      v_actor_id,
      0,
      0,
      v_line.fulfilled_qty,
      0,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'danger_action', 'admin_void_restore_inventory',
        'stock_status', 'admin_void_restored',
        'batch_code', v_line.batch_code,
        'location', v_line.location
      )
    );

    update public.order_lines
    set
      fulfilled_qty = 0,
      reserved_qty = 0,
      reservation_allocations = '[]'::jsonb,
      stock_status = 'admin_void_restored'
    where id = v_line.id;

    v_restored := v_restored + v_line.fulfilled_qty;
  end loop;

  return v_restored;
end;
$$;

create or replace function private.admin_void_completed_order(
  p_order_id uuid,
  p_reason text,
  p_confirm_order_no text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_confirm_order_no text := btrim(coalesce(p_confirm_order_no, ''));
  v_restored_qty integer := 0;
  v_wallet_refund_amount numeric(12, 2) := 0;
  v_wallet_refund jsonb := null;
  v_existing_wallet_refund uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.is_admin()), false) then
    raise exception 'Admin role required for dangerous order actions' using errcode = '42501';
  end if;

  if not coalesce((select private.partspro_has_permission('orders.danger')), false) then
    raise exception 'orders.danger permission required' using errcode = '42501';
  end if;

  if v_reason is null then
    raise exception 'Danger action reason is required' using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  if v_confirm_order_no <> v_order.order_no then
    raise exception 'Order number confirmation does not match' using errcode = '22023';
  end if;

  if v_order.status not in ('completed', 'cancelled') then
    raise exception 'Only completed or cancelled read-only orders can be voided through this flow' using errcode = '42501';
  end if;

  if v_order.soft_deleted_at is not null then
    return jsonb_build_object(
      'order_id', v_order.id,
      'order_no', v_order.order_no,
      'from_status', v_order.status,
      'to_status', v_order.status,
      'noop', true,
      'soft_deleted', true,
      'restored_qty', 0,
      'wallet_refund_amount', 0,
      'wallet_refund', null
    );
  end if;

  if v_order.status = 'completed' then
    v_restored_qty := private.restore_completed_order_inventory(
      v_order.id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'order_no', v_order.order_no,
        'reason', v_reason
      )
    );
  end if;

  v_wallet_refund_amount := round(coalesce(v_order.wallet_applied_amount, 0), 2);

  if v_order.status = 'completed' and v_wallet_refund_amount > 0 then
    select id
    into v_existing_wallet_refund
    from public.customer_wallet_transactions
    where order_id = v_order.id
      and direction = 'credit'
      and metadata ->> 'danger_action' = 'void_wallet_refund'
    order by created_at asc
    limit 1;

    if v_existing_wallet_refund is null then
      v_wallet_refund := private.credit_customer_wallet(
        v_order.customer_id,
        v_wallet_refund_amount,
        '订单作废退回钱包抵扣',
        v_order.id,
        null,
        coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'danger_action', 'void_wallet_refund',
          'order_no', v_order.order_no,
          'from_status', v_order.status,
          'reason', v_reason,
          'wallet_applied_amount', v_wallet_refund_amount
        )
      );
    else
      v_wallet_refund := jsonb_build_object(
        'amount', 0,
        'transaction_id', v_existing_wallet_refund,
        'noop', true
      );
      v_wallet_refund_amount := 0;
    end if;
  else
    v_wallet_refund_amount := 0;
  end if;

  update public.orders
  set
    status = 'cancelled',
    soft_deleted_at = now(),
    soft_deleted_by = v_actor_id,
    danger_action_type = 'void_and_soft_delete',
    danger_action_reason = v_reason,
    danger_action_metadata = coalesce(danger_action_metadata, '{}'::jsonb)
      || coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'danger_action', 'void_and_soft_delete',
        'from_status', v_order.status,
        'to_status', 'cancelled',
        'restored_qty', v_restored_qty,
        'wallet_refund_amount', v_wallet_refund_amount,
        'wallet_refund', v_wallet_refund
      ),
    updated_at = now()
  where id = v_order.id;

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
    v_order.id,
    'admin_voided_soft_deleted',
    v_order.status,
    'cancelled',
    v_actor_id,
    v_reason,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'danger_action', 'void_and_soft_delete',
      'soft_deleted', true,
      'inventory_lifecycle', 'completed_order_inventory_restored',
      'restored_qty', v_restored_qty,
      'wallet_refund_amount', v_wallet_refund_amount,
      'wallet_refund', v_wallet_refund
    )
  );

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_no', v_order.order_no,
    'from_status', v_order.status,
    'to_status', 'cancelled',
    'soft_deleted', true,
    'restored_qty', v_restored_qty,
    'wallet_refund_amount', v_wallet_refund_amount,
    'wallet_refund', v_wallet_refund
  );
end;
$$;

create or replace function public.admin_void_completed_order(
  p_order_id uuid,
  p_reason text,
  p_confirm_order_no text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_void_completed_order(
    p_order_id,
    p_reason,
    p_confirm_order_no,
    p_metadata
  );
$$;

revoke execute on function public.admin_void_completed_order(uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.admin_void_completed_order(uuid, text, text, jsonb)
  to authenticated;
revoke execute on function private.restore_completed_order_inventory(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function private.admin_void_completed_order(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function private.admin_void_completed_order(uuid, text, text, jsonb)
  to authenticated;

comment on function public.admin_void_completed_order(uuid, text, text, jsonb) is
  'Highest-admin dangerous action for completed or archived orders. Soft-deletes the order, restores completed inventory, refunds wallet-applied amount once, and records order events.';
