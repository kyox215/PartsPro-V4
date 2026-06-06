insert into public.admin_permissions (id, label, group_name, description)
values
  (
    'wallet_refunds.request',
    'Request wallet refunds',
    'wallet_refunds',
    'Can create pending wallet refund requests for order shortages and voided orders.'
  ),
  (
    'wallet_refunds.approve',
    'Approve wallet refunds',
    'wallet_refunds',
    'Can approve pending wallet refund requests and credit customer wallets.'
  )
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'wallet_refunds.request'),
  ('admin', 'wallet_refunds.approve'),
  ('sales', 'wallet_refunds.request'),
  ('sales_support', 'wallet_refunds.request')
on conflict do nothing;

create table if not exists public.wallet_refund_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_line_id uuid references public.order_lines(id) on delete set null,
  request_type text not null,
  status text not null default 'pending',
  requested_amount numeric(12, 2) not null,
  approved_amount numeric(12, 2),
  currency text not null default 'EUR',
  reason text not null,
  requested_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  decision_note text,
  wallet_transaction_id uuid references public.customer_wallet_transactions(id) on delete set null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  decision_metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint wallet_refund_requests_request_type_check
    check (request_type in ('order_line_shortage', 'order_void')),
  constraint wallet_refund_requests_status_check
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint wallet_refund_requests_requested_amount_positive
    check (requested_amount > 0),
  constraint wallet_refund_requests_approved_amount_valid
    check (
      approved_amount is null
      or (approved_amount >= 0 and approved_amount <= requested_amount)
    ),
  constraint wallet_refund_requests_currency_check
    check (currency = 'EUR'),
  constraint wallet_refund_requests_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint wallet_refund_requests_decision_metadata_object
    check (jsonb_typeof(decision_metadata) = 'object'),
  constraint wallet_refund_requests_approved_state_check
    check (
      (
        status = 'approved'
        and approved_amount is not null
        and approved_amount > 0
        and approved_at is not null
        and wallet_transaction_id is not null
      )
      or (status <> 'approved' and wallet_transaction_id is null)
    ),
  constraint wallet_refund_requests_idempotency_key_unique unique (idempotency_key)
);

create index if not exists wallet_refund_requests_pending_idx
  on public.wallet_refund_requests (requested_at asc)
  where status = 'pending';

create index if not exists wallet_refund_requests_order_idx
  on public.wallet_refund_requests (order_id, requested_at desc);

create unique index if not exists wallet_refund_requests_wallet_transaction_unique
  on public.wallet_refund_requests (wallet_transaction_id)
  where wallet_transaction_id is not null;

create unique index if not exists customer_wallet_transactions_refund_request_unique
  on public.customer_wallet_transactions ((metadata ->> 'wallet_refund_request_id'))
  where direction = 'credit'
    and metadata ? 'wallet_refund_request_id';

alter table public.wallet_refund_requests enable row level security;

grant select on public.wallet_refund_requests to authenticated;

drop policy if exists "partspro_wallet_refund_requests_staff_select"
  on public.wallet_refund_requests;

create policy "partspro_wallet_refund_requests_staff_select"
  on public.wallet_refund_requests
  for select
  to authenticated
  using (
    (select private.partspro_has_permission('wallet_refunds.request'))
    or (select private.partspro_has_permission('wallet_refunds.approve'))
    or (select private.partspro_has_permission('orders.read'))
  );

create or replace function private.wallet_refunded_amount_for_order(
  p_order_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(coalesce(sum(t.amount), 0), 2)
  from public.customer_wallet_transactions as t
  where t.order_id = p_order_id
    and t.direction = 'credit'
$$;

create or replace function private.order_wallet_refundable_amount(
  p_order_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select round(greatest(
    coalesce(o.payment_received_amount, 0)
      + coalesce(o.wallet_applied_amount, 0)
      - coalesce(private.wallet_refunded_amount_for_order(o.id), 0),
    0
  ), 2)
  from public.orders as o
  where o.id = p_order_id
$$;

create or replace function private.create_wallet_refund_request(
  p_customer_id uuid,
  p_order_id uuid,
  p_order_line_id uuid,
  p_request_type text,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text,
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
  v_amount numeric(12, 2) := round(coalesce(p_amount, 0), 2);
  v_available_amount numeric(12, 2);
  v_requested_amount numeric(12, 2);
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_idempotency_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_request public.wallet_refund_requests%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('wallet_refunds.request')), false) then
    raise exception 'wallet_refunds.request permission required' using errcode = '42501';
  end if;

  if p_request_type not in ('order_line_shortage', 'order_void') then
    raise exception 'Unsupported wallet refund request type %', p_request_type using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'Wallet refund request reason is required' using errcode = '23514';
  end if;

  if v_idempotency_key is null then
    raise exception 'Wallet refund request idempotency key is required' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) is distinct from 'object' then
    raise exception 'Wallet refund request metadata must be an object' using errcode = '22023';
  end if;

  if v_amount <= 0 then
    return jsonb_build_object('amount', 0, 'request_id', null, 'status', null);
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  if v_order.customer_id is distinct from p_customer_id then
    raise exception 'Wallet refund customer does not match order customer' using errcode = '23514';
  end if;

  v_available_amount := coalesce(private.order_wallet_refundable_amount(v_order.id), 0);
  v_requested_amount := least(v_amount, v_available_amount);

  if v_requested_amount <= 0 then
    return jsonb_build_object(
      'amount', 0,
      'request_id', null,
      'status', null,
      'refundable_amount', v_available_amount
    );
  end if;

  insert into public.wallet_refund_requests (
    customer_id,
    order_id,
    order_line_id,
    request_type,
    requested_amount,
    reason,
    requested_by,
    idempotency_key,
    metadata
  )
  values (
    p_customer_id,
    p_order_id,
    p_order_line_id,
    p_request_type,
    v_requested_amount,
    v_reason,
    v_actor_id,
    v_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'requested_amount_before_cap', v_amount,
      'refundable_amount_at_request', v_available_amount
    )
  )
  on conflict (idempotency_key) do update
  set updated_at = public.wallet_refund_requests.updated_at
  returning * into v_request;

  return jsonb_build_object(
    'amount', v_request.requested_amount,
    'request_id', v_request.id,
    'status', v_request.status,
    'request_type', v_request.request_type,
    'idempotency_key', v_request.idempotency_key
  );
end;
$$;

revoke execute on function private.wallet_refunded_amount_for_order(uuid)
  from public, anon, authenticated;
revoke execute on function private.order_wallet_refundable_amount(uuid)
  from public, anon, authenticated;

create or replace function public.admin_create_wallet_refund_request(
  p_order_id uuid,
  p_amount numeric,
  p_reason text,
  p_request_type text default 'order_void',
  p_order_line_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.wallet_refund_requests
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_result jsonb;
  v_request_id uuid;
  v_request public.wallet_refund_requests%rowtype;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  v_result := private.create_wallet_refund_request(
    v_order.customer_id,
    v_order.id,
    p_order_line_id,
    p_request_type,
    p_amount,
    p_reason,
    concat_ws(
      ':',
      'manual_wallet_refund',
      v_order.id,
      coalesce(p_order_line_id::text, 'order'),
      p_request_type,
      round(coalesce(p_amount, 0), 2)::text,
      md5(coalesce(p_reason, ''))
    ),
    coalesce(p_metadata, '{}'::jsonb)
  );

  v_request_id := nullif(v_result ->> 'request_id', '')::uuid;

  if v_request_id is null then
    raise exception 'Wallet refund request has no refundable amount' using errcode = '23514';
  end if;

  select *
  into v_request
  from public.wallet_refund_requests
  where id = v_request_id;

  return v_request;
end;
$$;

revoke execute on function public.admin_create_wallet_refund_request(uuid, numeric, text, text, uuid, jsonb)
  from public, anon;
grant execute on function public.admin_create_wallet_refund_request(uuid, numeric, text, text, uuid, jsonb)
  to authenticated;

create or replace function private.admin_approve_wallet_refund_request(
  p_request_id uuid,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_request public.wallet_refund_requests%rowtype;
  v_order public.orders%rowtype;
  v_available_amount numeric(12, 2);
  v_approved_amount numeric(12, 2);
  v_order_gross numeric(12, 2);
  v_credit jsonb;
  v_transaction_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('wallet_refunds.approve')), false) then
    raise exception 'wallet_refunds.approve permission required' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) is distinct from 'object' then
    raise exception 'Wallet refund approval metadata must be an object' using errcode = '22023';
  end if;

  select *
  into v_request
  from public.wallet_refund_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Wallet refund request does not exist' using errcode = '23503';
  end if;

  if v_request.status = 'approved' then
    return jsonb_build_object(
      'request_id', v_request.id,
      'status', v_request.status,
      'amount', coalesce(v_request.approved_amount, 0),
      'transaction_id', v_request.wallet_transaction_id,
      'noop', true
    );
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Only pending wallet refund requests can be approved' using errcode = '42501';
  end if;

  select *
  into v_order
  from public.orders
  where id = v_request.order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  v_order_gross := round(
    coalesce(v_order.total_net, 0) + coalesce(v_order.vat, 0) + coalesce(v_order.shipping, 0),
    2
  );

  if v_request.request_type = 'order_line_shortage' then
    v_available_amount := round(greatest(
      coalesce(v_order.payment_received_amount, 0)
        + coalesce(v_order.wallet_applied_amount, 0)
        - v_order_gross
        - coalesce(private.wallet_refunded_amount_for_order(v_order.id), 0),
      0
    ), 2);
  else
    v_available_amount := coalesce(private.order_wallet_refundable_amount(v_order.id), 0);
  end if;
  v_approved_amount := least(v_request.requested_amount, v_available_amount);

  if v_approved_amount <= 0 then
    raise exception 'Order has no refundable wallet amount remaining' using errcode = '23514';
  end if;

  v_credit := private.credit_customer_wallet(
    v_request.customer_id,
    v_approved_amount,
    coalesce(v_note, v_request.reason),
    v_request.order_id,
    v_request.order_line_id,
    coalesce(v_request.metadata, '{}'::jsonb)
      || coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'wallet_refund_request_id', v_request.id,
        'wallet_refund_type', v_request.request_type,
        'requested_amount', v_request.requested_amount,
        'approved_amount', v_approved_amount,
        'approved_by', v_actor_id
      )
  );

  v_transaction_id := nullif(v_credit ->> 'transaction_id', '')::uuid;

  update public.wallet_refund_requests
  set
    status = 'approved',
    approved_amount = v_approved_amount,
    approved_by = v_actor_id,
    approved_at = now(),
    decision_note = v_note,
    wallet_transaction_id = v_transaction_id,
    decision_metadata = coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'refundable_amount_at_approval', v_available_amount,
        'wallet_credit', v_credit
      ),
    updated_at = now()
  where id = v_request.id
  returning * into v_request;

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    v_request.order_id,
    'wallet_refund_approved',
    v_actor_id,
    v_note,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'wallet_refund_request_id', v_request.id,
      'wallet_refund_type', v_request.request_type,
      'requested_amount', v_request.requested_amount,
      'approved_amount', v_approved_amount,
      'wallet_transaction_id', v_transaction_id
    )
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'status', v_request.status,
    'amount', v_approved_amount,
    'transaction_id', v_transaction_id,
    'wallet_credit', v_credit
  );
end;
$$;

create or replace function public.admin_approve_wallet_refund_request(
  p_request_id uuid,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_approve_wallet_refund_request(
    p_request_id,
    p_note,
    p_metadata
  )
$$;

revoke execute on function public.admin_approve_wallet_refund_request(uuid, text, jsonb)
  from public, anon;
grant execute on function public.admin_approve_wallet_refund_request(uuid, text, jsonb)
  to authenticated;

revoke execute on function private.create_wallet_refund_request(
  uuid,
  uuid,
  uuid,
  text,
  numeric,
  text,
  text,
  jsonb
) from public, anon, authenticated;

revoke execute on function private.admin_approve_wallet_refund_request(uuid, text, jsonb)
  from public, anon;
grant execute on function private.admin_approve_wallet_refund_request(uuid, text, jsonb)
  to authenticated;

create or replace function private.admin_record_order_line_pick(
  p_order_id uuid,
  p_order_line_id uuid,
  p_actual_quantity integer,
  p_reason text default '',
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
  v_line public.order_lines%rowtype;
  v_previous_gross numeric(12, 2);
  v_next_total_net numeric(12, 2);
  v_next_vat numeric(12, 2);
  v_next_gross numeric(12, 2);
  v_vat_rate numeric := 0;
  v_shortage integer;
  v_reserved_shortage integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_allocation jsonb;
  v_inventory_id uuid;
  v_alloc_qty integer;
  v_take integer;
  v_remaining integer;
  v_next_allocations jsonb := '[]'::jsonb;
  v_refund_request jsonb := null;
  v_refund_amount numeric(12, 2) := 0;
begin
  if v_actor_id is null then
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

  if v_order.status in ('shipped', 'completed', 'cancelled') then
    raise exception 'Order lines cannot be adjusted after shipment, completion, or cancellation' using errcode = '42501';
  end if;

  select *
  into v_line
  from public.order_lines
  where id = p_order_line_id
    and order_id = p_order_id
  for update;

  if v_line.id is null then
    raise exception 'Order line does not exist' using errcode = '23503';
  end if;

  if p_actual_quantity is null or p_actual_quantity < 0 or p_actual_quantity > v_line.quantity then
    raise exception 'Actual quantity must be between 0 and ordered quantity' using errcode = '23514';
  end if;

  v_shortage := v_line.quantity - p_actual_quantity;

  if v_shortage > 0 and v_reason is null then
    raise exception 'A reason is required when an order line is short-picked' using errcode = '23514';
  end if;

  if v_shortage > 0
     and not coalesce((select private.partspro_has_permission('wallet_refunds.request')), false) then
    raise exception 'wallet_refunds.request permission required' using errcode = '42501';
  end if;

  if v_shortage < coalesce(v_line.cancelled_qty, 0) then
    raise exception 'Recorded shortages cannot be reversed through this flow' using errcode = '42501';
  end if;

  if p_actual_quantity < coalesce(v_line.fulfilled_qty, 0) then
    raise exception 'Actual quantity cannot be below already fulfilled quantity' using errcode = '23514';
  end if;

  v_reserved_shortage := greatest(v_shortage - coalesce(v_line.cancelled_qty, 0), 0);
  v_reserved_shortage := least(v_reserved_shortage, coalesce(v_line.reserved_qty, 0));
  v_remaining := v_reserved_shortage;

  if v_reserved_shortage > 0 then
    for v_allocation in
      select value
      from jsonb_array_elements(coalesce(v_line.reservation_allocations, '[]'::jsonb))
    loop
      v_inventory_id := nullif(v_allocation ->> 'inventory_item_id', '')::uuid;
      v_alloc_qty := greatest(coalesce((v_allocation ->> 'quantity')::integer, 0), 0);
      v_take := least(v_remaining, v_alloc_qty);

      if v_inventory_id is not null and v_take > 0 then
        update public.inventory_items
        set
          locked_qty = greatest(locked_qty - v_take, 0),
          actual_qty = greatest(actual_qty - v_take, 0),
          last_movement_at = now()
        where id = v_inventory_id;
      end if;

      if v_alloc_qty - v_take > 0 then
        v_next_allocations := v_next_allocations || jsonb_build_array(
          jsonb_set(v_allocation, '{quantity}', to_jsonb(v_alloc_qty - v_take), true)
        );
      end if;

      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Reservation allocation is insufficient for shortage adjustment' using errcode = '23514';
    end if;
  else
    v_next_allocations := coalesce(v_line.reservation_allocations, '[]'::jsonb);
  end if;

  v_previous_gross := round(
    coalesce(v_order.total_net, 0) + coalesce(v_order.vat, 0) + coalesce(v_order.shipping, 0),
    2
  );
  if coalesce(v_order.total_net, 0) + coalesce(v_order.shipping, 0) > 0 then
    v_vat_rate := coalesce(v_order.vat, 0) / (coalesce(v_order.total_net, 0) + coalesce(v_order.shipping, 0));
  end if;

  v_next_total_net := round(greatest(
    coalesce(v_order.total_net, 0)
      - greatest(v_shortage - coalesce(v_line.cancelled_qty, 0), 0) * coalesce(v_line.unit_price, 0),
    0
  ), 2);
  v_next_vat := round((v_next_total_net + coalesce(v_order.shipping, 0)) * v_vat_rate, 2);
  v_next_gross := round(v_next_total_net + v_next_vat + coalesce(v_order.shipping, 0), 2);

  update public.order_lines
  set
    picked_qty = p_actual_quantity,
    cancelled_qty = v_shortage,
    reserved_qty = greatest(reserved_qty - v_reserved_shortage, 0),
    reservation_allocations = v_next_allocations,
    stock_status = case
      when v_shortage = 0 then 'pick_confirmed'
      when p_actual_quantity = 0 then 'shortage_cancelled'
      else 'partial_shortage'
    end
  where id = v_line.id;

  update public.orders
  set
    total_net = v_next_total_net,
    vat = v_next_vat,
    stock_risk = case when v_shortage > 0 then 'blocked' else stock_risk end,
    updated_at = now()
  where id = v_order.id;

  v_refund_amount := least(
    greatest(v_previous_gross - v_next_gross, 0),
    greatest(
      coalesce(v_order.payment_received_amount, 0)
        + coalesce(v_order.wallet_applied_amount, 0)
        - v_next_gross
        - coalesce(private.wallet_refunded_amount_for_order(v_order.id), 0),
      0
    )
  );

  if v_shortage > 0 and v_refund_amount > 0 then
    v_refund_request := private.create_wallet_refund_request(
      v_order.customer_id,
      v_order.id,
      v_line.id,
      'order_line_shortage',
      v_refund_amount,
      '订单缺货差价钱包退款申请',
      concat(
        'order_line_shortage:',
        v_line.id::text,
        ':',
        coalesce(v_line.cancelled_qty, 0)::text,
        ':',
        v_shortage::text
      ),
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'order_no', v_order.order_no,
        'sku_code', v_line.sku_code,
        'ordered_quantity', v_line.quantity,
        'actual_quantity', p_actual_quantity,
        'previous_shortage_quantity', coalesce(v_line.cancelled_qty, 0),
        'shortage_quantity', v_shortage,
        'unit_price', v_line.unit_price,
        'previous_total', v_previous_gross,
        'next_total', v_next_gross,
        'refund_basis', 'payment_received_amount_plus_wallet_applied_less_wallet_credits'
      )
    );
  end if;

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    v_order.id,
    case when v_shortage > 0 then 'order_line_shortage' else 'order_line_pick_confirmed' end,
    v_actor_id,
    coalesce(v_reason, '订单商品实给数量已确认'),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'order_line_id', v_line.id,
      'sku_code', v_line.sku_code,
      'ordered_quantity', v_line.quantity,
      'actual_quantity', p_actual_quantity,
      'shortage_quantity', v_shortage,
      'previous_total', v_previous_gross,
      'next_total', v_next_gross,
      'wallet_credit', null,
      'wallet_refund_request', v_refund_request
    )
  );

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_line_id', v_line.id,
    'actual_quantity', p_actual_quantity,
    'shortage_quantity', v_shortage,
    'wallet_credit', null,
    'wallet_refund_request', v_refund_request,
    'previous_total', v_previous_gross,
    'next_total', v_next_gross
  );
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
  v_wallet_refund_request jsonb := null;
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

  if not coalesce((select private.partspro_has_permission('wallet_refunds.request')), false) then
    raise exception 'wallet_refunds.request permission required' using errcode = '42501';
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
      'wallet_refund', null,
      'wallet_refund_request', null
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

  v_wallet_refund_amount := coalesce(private.order_wallet_refundable_amount(v_order.id), 0);

  if v_wallet_refund_amount > 0 then
    v_wallet_refund_request := private.create_wallet_refund_request(
      v_order.customer_id,
      v_order.id,
      null,
      'order_void',
      v_wallet_refund_amount,
      '订单作废钱包退款申请',
      concat('order_void:', v_order.id::text),
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'danger_action', 'void_wallet_refund_request',
        'order_no', v_order.order_no,
        'from_status', v_order.status,
        'reason', v_reason,
        'payment_received_amount', coalesce(v_order.payment_received_amount, 0),
        'wallet_applied_amount', coalesce(v_order.wallet_applied_amount, 0),
        'already_wallet_refunded_amount', private.wallet_refunded_amount_for_order(v_order.id),
        'refund_basis', 'payment_received_amount_plus_wallet_applied_less_wallet_credits'
      )
    );
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
        'wallet_refund_amount', coalesce(v_wallet_refund_request ->> 'amount', '0')::numeric,
        'wallet_refund', null,
        'wallet_refund_request', v_wallet_refund_request
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
      'wallet_refund_amount', coalesce(v_wallet_refund_request ->> 'amount', '0')::numeric,
      'wallet_refund', null,
      'wallet_refund_request', v_wallet_refund_request
    )
  );

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_no', v_order.order_no,
    'from_status', v_order.status,
    'to_status', 'cancelled',
    'soft_deleted', true,
    'restored_qty', v_restored_qty,
    'wallet_refund_amount', coalesce(v_wallet_refund_request ->> 'amount', '0')::numeric,
    'wallet_refund', null,
    'wallet_refund_request', v_wallet_refund_request
  );
end;
$$;

comment on table public.wallet_refund_requests is
  'Pending and approved wallet refund requests. Requests are created by staff actions, but wallets are credited only when an approver approves a pending request.';
comment on function public.admin_approve_wallet_refund_request(uuid, text, jsonb) is
  'Approves one pending wallet refund request, credits the customer wallet once, and returns a noop for already-approved requests.';
comment on function public.admin_record_order_line_pick(uuid, uuid, integer, text, jsonb) is
  'Staff-only order line actual quantity confirmation. Shortages create pending wallet refund requests instead of immediately crediting the wallet.';
comment on function public.admin_void_completed_order(uuid, text, text, jsonb) is
  'Highest-admin dangerous action for completed or archived orders. Soft-deletes the order, restores completed inventory, and creates a pending wallet refund request instead of immediately crediting the wallet.';
