alter table public.orders
  add column if not exists wallet_applied_amount numeric(12, 2) not null default 0;

alter table public.order_lines
  add column if not exists picked_qty integer not null default 0,
  add column if not exists cancelled_qty integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partspro_orders_wallet_applied_nonnegative'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint partspro_orders_wallet_applied_nonnegative
      check (wallet_applied_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'partspro_order_lines_pick_cancel_nonnegative'
      and conrelid = 'public.order_lines'::regclass
  ) then
    alter table public.order_lines
      add constraint partspro_order_lines_pick_cancel_nonnegative
      check (picked_qty >= 0 and cancelled_qty >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'partspro_order_lines_pick_cancel_within_quantity'
      and conrelid = 'public.order_lines'::regclass
  ) then
    alter table public.order_lines
      add constraint partspro_order_lines_pick_cancel_within_quantity
      check (picked_qty + cancelled_qty <= quantity);
  end if;
end
$$;

create table if not exists public.customer_wallets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  balance numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_wallets_customer_unique unique (customer_id),
  constraint customer_wallets_balance_nonnegative check (balance >= 0),
  constraint customer_wallets_currency_check check (currency = 'EUR')
);

create table if not exists public.customer_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.customer_wallets(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  order_line_id uuid references public.order_lines(id) on delete set null,
  direction text not null check (direction in ('credit', 'debit')),
  amount numeric(12, 2) not null check (amount > 0),
  balance_after numeric(12, 2) not null check (balance_after >= 0),
  reason text not null,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists customer_wallet_transactions_customer_created_idx
  on public.customer_wallet_transactions(customer_id, created_at desc);

create index if not exists customer_wallet_transactions_order_idx
  on public.customer_wallet_transactions(order_id, created_at desc)
  where order_id is not null;

alter table public.customer_wallets enable row level security;
alter table public.customer_wallet_transactions enable row level security;

grant select on public.customer_wallets to authenticated;
grant select on public.customer_wallet_transactions to authenticated;

drop policy if exists "partspro_wallet_owner_or_staff_select" on public.customer_wallets;
create policy "partspro_wallet_owner_or_staff_select"
  on public.customer_wallets
  for select
  to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1
      from public.customers as c
      where c.id = customer_wallets.customer_id
        and (
          c.user_id = (select auth.uid())
          or exists (
            select 1
            from public.customer_memberships as cm
            where cm.customer_id = c.id
              and cm.user_id = (select auth.uid())
              and cm.status = 'active'
          )
        )
    )
  );

drop policy if exists "partspro_wallet_transactions_owner_or_staff_select" on public.customer_wallet_transactions;
create policy "partspro_wallet_transactions_owner_or_staff_select"
  on public.customer_wallet_transactions
  for select
  to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1
      from public.customers as c
      where c.id = customer_wallet_transactions.customer_id
        and (
          c.user_id = (select auth.uid())
          or exists (
            select 1
            from public.customer_memberships as cm
            where cm.customer_id = c.id
              and cm.user_id = (select auth.uid())
              and cm.status = 'active'
          )
        )
    )
  );

create or replace function private.ensure_customer_wallet(p_customer_id uuid)
returns public.customer_wallets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet public.customer_wallets%rowtype;
begin
  if p_customer_id is null then
    raise exception 'Customer id is required' using errcode = '23514';
  end if;

  insert into public.customer_wallets (customer_id)
  values (p_customer_id)
  on conflict (customer_id) do update
    set updated_at = public.customer_wallets.updated_at
  returning * into v_wallet;

  return v_wallet;
end;
$$;

create or replace function private.credit_customer_wallet(
  p_customer_id uuid,
  p_amount numeric,
  p_reason text,
  p_order_id uuid default null,
  p_order_line_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_wallet public.customer_wallets%rowtype;
  v_amount numeric(12, 2) := round(coalesce(p_amount, 0), 2);
  v_balance numeric(12, 2);
  v_transaction_id uuid;
begin
  if v_amount <= 0 then
    return jsonb_build_object('amount', 0, 'transaction_id', null);
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Wallet credit reason is required' using errcode = '23514';
  end if;

  v_wallet := private.ensure_customer_wallet(p_customer_id);

  update public.customer_wallets
  set
    balance = round(balance + v_amount, 2),
    updated_at = now()
  where id = v_wallet.id
  returning balance into v_balance;

  insert into public.customer_wallet_transactions (
    wallet_id,
    customer_id,
    order_id,
    order_line_id,
    direction,
    amount,
    balance_after,
    reason,
    actor_id,
    metadata
  )
  values (
    v_wallet.id,
    p_customer_id,
    p_order_id,
    p_order_line_id,
    'credit',
    v_amount,
    v_balance,
    p_reason,
    v_actor_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'amount', v_amount,
    'balance_after', v_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

create or replace function private.debit_customer_wallet(
  p_customer_id uuid,
  p_amount numeric,
  p_reason text,
  p_order_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_wallet public.customer_wallets%rowtype;
  v_amount numeric(12, 2) := round(coalesce(p_amount, 0), 2);
  v_balance numeric(12, 2);
  v_transaction_id uuid;
begin
  if v_amount <= 0 then
    return jsonb_build_object('amount', 0, 'transaction_id', null);
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Wallet debit reason is required' using errcode = '23514';
  end if;

  v_wallet := private.ensure_customer_wallet(p_customer_id);

  update public.customer_wallets
  set
    balance = round(balance - v_amount, 2),
    updated_at = now()
  where id = v_wallet.id
    and balance >= v_amount
  returning balance into v_balance;

  if v_balance is null then
    raise exception 'Wallet balance is insufficient' using errcode = '23514';
  end if;

  insert into public.customer_wallet_transactions (
    wallet_id,
    customer_id,
    order_id,
    direction,
    amount,
    balance_after,
    reason,
    actor_id,
    metadata
  )
  values (
    v_wallet.id,
    p_customer_id,
    p_order_id,
    'debit',
    v_amount,
    v_balance,
    p_reason,
    v_actor_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_transaction_id;

  return jsonb_build_object(
    'amount', v_amount,
    'balance_after', v_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

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
  v_credit jsonb := null;
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

  if v_shortage > 0
     and v_order.payment_method = 'bank_transfer'
     and v_order.payment_status = 'paid' then
    v_credit := private.credit_customer_wallet(
      v_order.customer_id,
      greatest(v_previous_gross - v_next_gross, 0),
      '订单缺货差价入账',
      v_order.id,
      v_line.id,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'order_no', v_order.order_no,
        'sku_code', v_line.sku_code,
        'ordered_quantity', v_line.quantity,
        'actual_quantity', p_actual_quantity,
        'shortage_quantity', v_shortage,
        'unit_price', v_line.unit_price
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
      'wallet_credit', v_credit
    )
  );

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_line_id', v_line.id,
    'actual_quantity', p_actual_quantity,
    'shortage_quantity', v_shortage,
    'wallet_credit', v_credit,
    'previous_total', v_previous_gross,
    'next_total', v_next_gross
  );
end;
$$;

create or replace function public.admin_record_order_line_pick(
  p_order_id uuid,
  p_order_line_id uuid,
  p_actual_quantity integer,
  p_reason text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_record_order_line_pick(
    p_order_id,
    p_order_line_id,
    p_actual_quantity,
    p_reason,
    p_metadata
  )
$$;

revoke execute on function public.admin_record_order_line_pick(uuid, uuid, integer, text, jsonb)
  from public, anon;
grant execute on function public.admin_record_order_line_pick(uuid, uuid, integer, text, jsonb)
  to authenticated;

comment on table public.customer_wallets is
  'Per-customer EUR wallet balance for overpaid bank-transfer order differences and future order credit.';
comment on table public.customer_wallet_transactions is
  'Immutable customer wallet credit/debit ledger tied to orders and line shortage adjustments.';
comment on function public.admin_record_order_line_pick(uuid, uuid, integer, text, jsonb) is
  'Staff-only order line actual quantity confirmation. Shortages consume locked stock as physical loss and may credit wallet for paid bank-transfer orders.';

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
  v_payment_method text := case
    when lower(coalesce(p_fiscal ->> 'payment_method', p_fiscal ->> 'paymentMethod', '')) = 'cash' then 'cash'
    else 'bank_transfer'
  end;
  v_fiscal jsonb := jsonb_set(
    case
      when jsonb_typeof(p_fiscal) = 'object' then p_fiscal
      else '{}'::jsonb
    end,
    '{payment_method}',
    to_jsonb(case
      when lower(coalesce(p_fiscal ->> 'payment_method', p_fiscal ->> 'paymentMethod', '')) = 'cash' then 'cash'
      else 'bank_transfer'
    end),
    true
  );
  v_wallet_requested numeric(12, 2) := greatest(coalesce(nullif(p_fiscal ->> 'wallet_requested_amount', '')::numeric, 0), 0);
  v_wallet_available numeric(12, 2) := 0;
  v_wallet_applied numeric(12, 2) := 0;
  v_wallet_debit jsonb := null;
  v_order_gross numeric(12, 2) := 0;
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

  if not v_is_staff
    and (
      v_customer.status <> 'active'
      or coalesce(v_customer.assignment_status, 'needs_review') <> 'assigned'
    ) then
    raise exception 'Customer must be active and assigned before placing orders' using errcode = '42501';
  end if;

  if not private.is_customer_profile_complete_for_checkout(
    v_customer.company_name,
    v_customer.email,
    v_customer.phone,
    v_customer.fiscal_code,
    v_customer.billing_address,
    v_customer.shipping_address
  ) then
    raise exception 'Customer name, tax, billing and shipping profile must be completed before checkout' using errcode = '42501';
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
    payment_method,
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
    v_payment_method,
    'clear',
    0,
    0,
    coalesce(p_shipping, 0),
    coalesce(p_shipping_method, ''),
    v_fiscal,
    coalesce(p_delivery_address, ''),
    coalesce(p_customer_note, '')
  )
  returning id into v_order_id;

  for v_line in
    select
      requested.sku_code,
      requested.quantity,
      round(requested.unit_net, 2) as requested_unit_net,
      nullif(btrim(requested.price_version), '') as requested_price_version,
      p.name as product_name,
      p.quality_grade,
      pricing.effective_unit_price as allowed_unit_price,
      pricing.base_unit_price,
      pricing.discount_percent,
      pricing.price_source,
      pricing.customer_level,
      pricing.price_group_id,
      pricing.price_version,
      pricing.price_resolved_at,
      p.moq,
      p.stock_status,
      p.stock_qty,
      p.batch_code,
      p.location
    from jsonb_to_recordset(p_lines) as requested(
      sku_code text,
      quantity integer,
      unit_net numeric,
      price_version text
    )
    join public.products as p on p.sku_code = requested.sku_code
    cross join lateral private.resolve_customer_product_price(
      p.id,
      v_customer.id,
      requested.quantity
    ) as pricing
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

    if v_line.allowed_unit_price is null then
      raise exception 'SKU % has no available price for this customer', v_line.sku_code using errcode = '42501';
    end if;

    if coalesce(v_line.requested_unit_net, v_line.allowed_unit_price) < 0 then
      raise exception 'SKU % has invalid pricing', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.requested_price_version is not null
      and v_line.price_version is not null
      and v_line.requested_price_version <> v_line.price_version then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code using errcode = '40001';
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
      base_unit_price,
      discount_percent,
      price_source,
      customer_level_snapshot,
      price_group_id_snapshot,
      price_version,
      price_resolved_at,
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
      v_line.base_unit_price,
      v_line.discount_percent,
      v_line.price_source,
      v_line.customer_level,
      v_line.price_group_id,
      v_line.price_version,
      v_line.price_resolved_at,
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
  v_order_gross := round(v_total_net + v_vat + coalesce(p_shipping, 0), 2);

  if v_wallet_requested > 0 and v_order_gross > 0 then
    perform private.ensure_customer_wallet(v_customer.id);

    select balance
    into v_wallet_available
    from public.customer_wallets
    where customer_id = v_customer.id
    for update;

    v_wallet_applied := least(coalesce(v_wallet_available, 0), v_wallet_requested, v_order_gross);

    if v_wallet_applied > 0 then
      v_wallet_debit := private.debit_customer_wallet(
        v_customer.id,
        v_wallet_applied,
        '钱包余额自动抵扣订单',
        v_order_id,
        jsonb_build_object(
          'order_no', v_order_no,
          'requested_amount', v_wallet_requested,
          'order_gross', v_order_gross
        )
      );
    end if;
  end if;

  v_fiscal := jsonb_set(v_fiscal, '{wallet_applied_amount}', to_jsonb(v_wallet_applied), true);

  update public.orders
  set
    total_net = v_total_net,
    vat = v_vat,
    shipping = coalesce(p_shipping, 0),
    wallet_applied_amount = v_wallet_applied,
    payment_status = case when v_wallet_applied >= v_order_gross and v_order_gross > 0 then 'paid' else payment_status end,
    payment_received_at = case when v_wallet_applied >= v_order_gross and v_order_gross > 0 then now() else payment_received_at end,
    payment_received_by = case when v_wallet_applied >= v_order_gross and v_order_gross > 0 then v_auth_uid else payment_received_by end,
    payment_received_amount = payment_received_amount,
    fiscal = v_fiscal,
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
      'pricing_resolver', 'private.resolve_customer_product_price',
      'line_count', v_line_count,
      'customer_type', coalesce(v_customer.customer_type, 'retail'),
      'customer_level', coalesce(v_customer.level, v_customer.tier, 'bronze'),
      'price_group_id', v_customer.price_group_id,
      'shipping_method', coalesce(p_shipping_method, ''),
      'payment_method', v_payment_method,
      'wallet_applied_amount', v_wallet_applied,
      'wallet_debit', v_wallet_debit,
      'price_snapshot_validated', true
    )
  );

  return v_order_id;
end;
$$;
