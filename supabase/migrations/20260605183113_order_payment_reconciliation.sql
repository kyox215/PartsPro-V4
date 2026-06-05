alter table public.orders
  add column if not exists payment_received_at timestamptz,
  add column if not exists payment_received_by uuid,
  add column if not exists payment_received_amount numeric(12, 2),
  add column if not exists payment_reference text,
  add column if not exists payment_reconciliation_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partspro_orders_payment_received_by_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint partspro_orders_payment_received_by_fkey
      foreign key (payment_received_by)
      references auth.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'partspro_orders_payment_received_amount_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint partspro_orders_payment_received_amount_nonnegative
      check (payment_received_amount is null or payment_received_amount >= 0);
  end if;
end
$$;

create index if not exists orders_payment_received_at_idx
  on public.orders(payment_received_at desc)
  where payment_received_at is not null;

update public.admin_permissions
set
  label = 'Manage orders',
  group_name = 'orders',
  description = 'Can manage order status, logistics, staff notes, and payment reconciliation.'
where id = 'orders.manage';

drop policy if exists "partspro_orders_staff_update" on public.orders;

create policy "partspro_orders_staff_update"
  on public.orders
  for update
  to authenticated
  using ((select private.partspro_has_permission('orders.manage')))
  with check ((select private.partspro_has_permission('orders.manage')));

create or replace function private.admin_reconcile_order_payment(
  p_order_id uuid,
  p_payment_status text,
  p_payment_method text default null,
  p_received_amount numeric default null,
  p_received_at timestamptz default null,
  p_reference text default null,
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
  v_next_payment_status text := nullif(coalesce(p_payment_status, ''), '');
  v_next_payment_method text;
  v_received_amount numeric(12, 2);
  v_received_at timestamptz;
  v_reference text := nullif(trim(coalesce(p_reference, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('orders.manage')), false) then
    raise exception 'orders.manage permission required' using errcode = '42501';
  end if;

  if v_next_payment_status not in ('pending', 'paid', 'bank_waiting', 'failed') then
    raise exception 'Unsupported payment status %', p_payment_status using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  if v_order.status = 'cancelled' and v_next_payment_status = 'paid' then
    raise exception 'Cancelled orders cannot be marked as paid' using errcode = '42501';
  end if;

  if v_order.payment_status = 'paid'
     and v_next_payment_status <> 'paid'
     and v_note is null then
    raise exception 'A reconciliation note is required when reversing a paid order' using errcode = '23514';
  end if;

  v_next_payment_method := coalesce(nullif(coalesce(p_payment_method, ''), ''), v_order.payment_method);

  if v_next_payment_method not in ('bank_transfer', 'cash') then
    raise exception 'Unsupported payment method %', p_payment_method using errcode = '22023';
  end if;

  if v_next_payment_status = 'paid' then
    v_received_amount := coalesce(
      p_received_amount,
      round(coalesce(v_order.total_net, 0) + coalesce(v_order.vat, 0) + coalesce(v_order.shipping, 0), 2)
    );
    v_received_at := coalesce(p_received_at, now());

    if v_received_amount < 0 then
      raise exception 'Received amount cannot be negative' using errcode = '23514';
    end if;
  else
    v_received_amount := null;
    v_received_at := null;
  end if;

  update public.orders
  set
    payment_status = v_next_payment_status,
    payment_method = v_next_payment_method,
    payment_received_at = v_received_at,
    payment_received_by = case when v_next_payment_status = 'paid' then v_auth_uid else null end,
    payment_received_amount = v_received_amount,
    payment_reference = v_reference,
    payment_reconciliation_note = v_note,
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
    'payment_reconciled',
    v_auth_uid,
    v_note,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'previous_payment_status', v_order.payment_status,
      'payment_status', v_next_payment_status,
      'previous_payment_method', v_order.payment_method,
      'payment_method', v_next_payment_method,
      'received_amount', v_received_amount,
      'received_at', v_received_at,
      'reference', v_reference,
      'actor_id', v_auth_uid
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'previous_payment_status', v_order.payment_status,
    'payment_status', v_next_payment_status,
    'previous_payment_method', v_order.payment_method,
    'payment_method', v_next_payment_method,
    'received_amount', v_received_amount,
    'received_at', v_received_at,
    'received_by', case when v_next_payment_status = 'paid' then v_auth_uid else null end,
    'reference', v_reference,
    'note', v_note
  );
end;
$$;

create or replace function public.admin_reconcile_order_payment(
  p_order_id uuid,
  p_payment_status text,
  p_payment_method text default null,
  p_received_amount numeric default null,
  p_received_at timestamptz default null,
  p_reference text default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_reconcile_order_payment(
    p_order_id,
    p_payment_status,
    p_payment_method,
    p_received_amount,
    p_received_at,
    p_reference,
    p_note,
    p_metadata
  )
$$;

revoke execute on function public.admin_reconcile_order_payment(
  uuid,
  text,
  text,
  numeric,
  timestamptz,
  text,
  text,
  jsonb
) from public, anon;

grant execute on function public.admin_reconcile_order_payment(
  uuid,
  text,
  text,
  numeric,
  timestamptz,
  text,
  text,
  jsonb
) to authenticated;

revoke execute on function private.admin_reconcile_order_payment(
  uuid,
  text,
  text,
  numeric,
  timestamptz,
  text,
  text,
  jsonb
) from public, anon;

grant execute on function private.admin_reconcile_order_payment(
  uuid,
  text,
  text,
  numeric,
  timestamptz,
  text,
  text,
  jsonb
) to authenticated;

comment on function public.admin_reconcile_order_payment(
  uuid,
  text,
  text,
  numeric,
  timestamptz,
  text,
  text,
  jsonb
) is
  'Order payment reconciliation RPC. Requires orders.manage and records collector, amount, reference, note, and audit event.';
