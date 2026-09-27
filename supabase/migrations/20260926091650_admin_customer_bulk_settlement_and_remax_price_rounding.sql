-- Customer-level bulk settlement and one-time REMAX active-price rounding.
--
-- Settlement invariants:
--   * preview and write both require customers.read + orders.manage;
--   * every eligible order is locked and settled in one transaction;
--   * wallet credit and previously received cash are deducted before computing
--     the new amount received;
--   * a preview revision prevents settling a changed order set silently;
--   * each order keeps its normal payment event, plus one customer-level audit.

create or replace function private.admin_preview_customer_settlement(
  p_customer_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_customer_name text;
  v_payload jsonb;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('customers.read')), false)
    or not coalesce((select private.partspro_has_permission('orders.manage')), false) then
    raise exception 'customers.read and orders.manage permissions required'
      using errcode = '42501';
  end if;

  select c.company_name
  into v_customer_name
  from public.customers as c
  where c.id = p_customer_id;

  if not found then
    raise exception 'Customer does not exist'
      using errcode = '23503', detail = 'CUSTOMER_SETTLEMENT_CUSTOMER_NOT_FOUND';
  end if;

  with eligible_orders as materialized (
    select
      o.id,
      o.order_no,
      o.status,
      o.payment_status,
      o.payment_method,
      round(coalesce(o.total_net, 0) + coalesce(o.vat, 0) + coalesce(o.shipping, 0), 2) as gross_amount,
      round(greatest(coalesce(o.wallet_applied_amount, 0), 0), 2) as wallet_applied_amount,
      round(greatest(coalesce(o.payment_received_amount, 0), 0), 2) as received_amount,
      round(
        greatest(
          coalesce(o.total_net, 0) + coalesce(o.vat, 0) + coalesce(o.shipping, 0)
            - greatest(coalesce(o.wallet_applied_amount, 0), 0)
            - greatest(coalesce(o.payment_received_amount, 0), 0),
          0
        ),
        2
      ) as due_amount,
      o.created_at,
      o.updated_at
    from public.orders as o
    where o.customer_id = p_customer_id
      and o.soft_deleted_at is null
      and o.status <> 'cancelled'
      and o.payment_status <> 'paid'
  ),
  aggregate_payload as (
    select
      count(*)::integer as order_count,
      round(coalesce(sum(e.gross_amount), 0), 2) as gross_amount,
      round(coalesce(sum(e.wallet_applied_amount), 0), 2) as wallet_applied_amount,
      round(coalesce(sum(e.received_amount), 0), 2) as received_amount,
      round(coalesce(sum(e.due_amount), 0), 2) as due_amount,
      md5(
        coalesce(
          jsonb_agg(
            jsonb_build_array(
              e.id,
              e.status,
              e.payment_status,
              e.gross_amount,
              e.wallet_applied_amount,
              e.received_amount,
              e.updated_at
            )
            order by e.id
          )::text,
          '[]'
        )
      ) as revision,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'orderNo', e.order_no,
            'orderStatus', e.status,
            'paymentStatus', e.payment_status,
            'paymentMethod', e.payment_method,
            'grossAmount', e.gross_amount,
            'walletAppliedAmount', e.wallet_applied_amount,
            'receivedAmount', e.received_amount,
            'dueAmount', e.due_amount,
            'createdAt', e.created_at,
            'updatedAt', e.updated_at
          )
          order by e.created_at, e.id
        ),
        '[]'::jsonb
      ) as orders
    from eligible_orders as e
  )
  select jsonb_build_object(
    'customerId', p_customer_id,
    'customerName', v_customer_name,
    'revision', a.revision,
    'orderCount', a.order_count,
    'grossAmount', a.gross_amount,
    'walletAppliedAmount', a.wallet_applied_amount,
    'receivedAmount', a.received_amount,
    'dueAmount', a.due_amount,
    'orders', a.orders
  )
  into v_payload
  from aggregate_payload as a;

  return v_payload;
end;
$$;

create or replace function private.admin_settle_customer_orders(
  p_customer_id uuid,
  p_expected_revision text,
  p_payment_method text,
  p_received_at timestamptz default null,
  p_reference text default null,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_actor_email text;
  v_actor_role text;
  v_batch_id uuid := gen_random_uuid();
  v_expected_revision text := lower(nullif(btrim(coalesce(p_expected_revision, '')), ''));
  v_payment_method text := lower(nullif(btrim(coalesce(p_payment_method, '')), ''));
  v_received_at timestamptz := coalesce(p_received_at, now());
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_order_ids uuid[] := '{}'::uuid[];
  v_current_revision text;
  v_order_count integer := 0;
  v_gross_amount numeric(14, 2) := 0;
  v_wallet_amount numeric(14, 2) := 0;
  v_previous_received_amount numeric(14, 2) := 0;
  v_collected_amount numeric(14, 2) := 0;
  v_previous_orders jsonb := '[]'::jsonb;
  v_settled_orders jsonb := '[]'::jsonb;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('customers.read')), false)
    or not coalesce((select private.partspro_has_permission('orders.manage')), false) then
    raise exception 'customers.read and orders.manage permissions required'
      using errcode = '42501';
  end if;

  if v_expected_revision is null or v_expected_revision !~ '^[0-9a-f]{32}$' then
    raise exception 'A valid settlement preview revision is required'
      using errcode = '22023', detail = 'CUSTOMER_SETTLEMENT_REVISION_INVALID';
  end if;

  if v_payment_method is null
    or v_payment_method not in ('bank_transfer', 'cash') then
    raise exception 'Unsupported payment method %', p_payment_method
      using errcode = '22023', detail = 'CUSTOMER_SETTLEMENT_PAYMENT_METHOD_INVALID';
  end if;

  if v_reference is not null and char_length(v_reference) > 120 then
    raise exception 'Payment reference is too long'
      using errcode = '22023', detail = 'CUSTOMER_SETTLEMENT_REFERENCE_TOO_LONG';
  end if;

  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Settlement note is too long'
      using errcode = '22023', detail = 'CUSTOMER_SETTLEMENT_NOTE_TOO_LONG';
  end if;

  perform 1
  from public.customers as c
  where c.id = p_customer_id
  for update;

  if not found then
    raise exception 'Customer does not exist'
      using errcode = '23503', detail = 'CUSTOMER_SETTLEMENT_CUSTOMER_NOT_FOUND';
  end if;

  with locked_orders as materialized (
    select
      o.id,
      o.status,
      o.payment_status,
      round(coalesce(o.total_net, 0) + coalesce(o.vat, 0) + coalesce(o.shipping, 0), 2) as gross_amount,
      round(greatest(coalesce(o.wallet_applied_amount, 0), 0), 2) as wallet_applied_amount,
      round(greatest(coalesce(o.payment_received_amount, 0), 0), 2) as received_amount,
      o.updated_at
    from public.orders as o
    where o.customer_id = p_customer_id
      and o.soft_deleted_at is null
      and o.status <> 'cancelled'
      and o.payment_status <> 'paid'
    order by o.id
    for update
  )
  select
    coalesce(array_agg(o.id order by o.id), '{}'::uuid[]),
    count(*)::integer,
    md5(
      coalesce(
        jsonb_agg(
          jsonb_build_array(
            o.id,
            o.status,
            o.payment_status,
            o.gross_amount,
            o.wallet_applied_amount,
            o.received_amount,
            o.updated_at
          )
          order by o.id
        )::text,
        '[]'
      )
    ),
    round(coalesce(sum(o.gross_amount), 0), 2),
    round(coalesce(sum(o.wallet_applied_amount), 0), 2),
    round(coalesce(sum(o.received_amount), 0), 2),
    round(
      coalesce(
        sum(
          greatest(
            o.gross_amount - o.wallet_applied_amount - o.received_amount,
            0
          )
        ),
        0
      ),
      2
    )
  into
    v_order_ids,
    v_order_count,
    v_current_revision,
    v_gross_amount,
    v_wallet_amount,
    v_previous_received_amount,
    v_collected_amount
  from locked_orders as o;

  if v_order_count = 0 then
    raise exception 'Customer has no unsettled orders'
      using errcode = '23514', detail = 'CUSTOMER_SETTLEMENT_NOTHING_TO_SETTLE';
  end if;

  if v_current_revision is distinct from v_expected_revision then
    raise exception 'Customer settlement preview is stale'
      using errcode = '40001', detail = 'CUSTOMER_SETTLEMENT_STALE';
  end if;

  with previous_orders as materialized (
    select
      o.id,
      o.order_no,
      o.payment_status as previous_payment_status,
      o.payment_method as previous_payment_method,
      round(coalesce(o.total_net, 0) + coalesce(o.vat, 0) + coalesce(o.shipping, 0), 2) as gross_amount,
      round(greatest(coalesce(o.wallet_applied_amount, 0), 0), 2) as wallet_applied_amount,
      round(greatest(coalesce(o.payment_received_amount, 0), 0), 2) as previous_received_amount,
      round(
        greatest(
          coalesce(o.total_net, 0) + coalesce(o.vat, 0) + coalesce(o.shipping, 0)
            - greatest(coalesce(o.wallet_applied_amount, 0), 0)
            - greatest(coalesce(o.payment_received_amount, 0), 0),
          0
        ),
        2
      ) as collected_amount,
      o.payment_received_at as previous_received_at,
      o.payment_received_by as previous_received_by,
      o.payment_reference as previous_reference,
      o.payment_reconciliation_note as previous_note
    from public.orders as o
    where o.id = any(v_order_ids)
  ),
  updated_orders as (
    update public.orders as o
    set
      payment_status = 'paid',
      payment_method = case
        when p.collected_amount > 0 then v_payment_method
        else p.previous_payment_method
      end,
      payment_received_at = case
        when p.collected_amount > 0 then v_received_at
        else p.previous_received_at
      end,
      payment_received_by = case
        when p.collected_amount > 0 then v_auth_uid
        else p.previous_received_by
      end,
      payment_received_amount = greatest(
        p.previous_received_amount,
        round(greatest(p.gross_amount - p.wallet_applied_amount, 0), 2)
      ),
      payment_reference = case
        when p.collected_amount > 0 then coalesce(v_reference, p.previous_reference)
        else p.previous_reference
      end,
      payment_reconciliation_note = case
        when p.collected_amount > 0 then coalesce(v_note, p.previous_note)
        else p.previous_note
      end,
      updated_at = now()
    from previous_orders as p
    where o.id = p.id
    returning
      o.id,
      o.order_no,
      p.previous_payment_status,
      o.payment_status,
      p.previous_payment_method,
      o.payment_method,
      p.gross_amount,
      p.wallet_applied_amount,
      p.previous_received_amount,
      p.previous_received_at,
      p.previous_received_by,
      p.previous_reference,
      p.previous_note,
      o.payment_received_amount,
      p.collected_amount,
      o.payment_received_at,
      o.payment_received_by,
      o.payment_reference,
      o.payment_reconciliation_note
  ),
  inserted_events as (
    insert into public.order_events (
      order_id,
      event_type,
      actor_id,
      note,
      metadata
    )
    select
      u.id,
      'payment_reconciled',
      v_auth_uid,
      v_note,
      jsonb_build_object(
        'source', 'admin_customer_bulk_settlement',
        'bulk_settlement_id', v_batch_id,
        'customer_id', p_customer_id,
        'previous_payment_status', u.previous_payment_status,
        'payment_status', u.payment_status,
        'previous_payment_method', u.previous_payment_method,
        'payment_method', u.payment_method,
        'gross_amount', u.gross_amount,
        'wallet_applied_amount', u.wallet_applied_amount,
        'previous_received_amount', u.previous_received_amount,
        'previous_received_at', u.previous_received_at,
        'previous_received_by', u.previous_received_by,
        'previous_reference', u.previous_reference,
        'previous_note', u.previous_note,
        'received_amount', u.payment_received_amount,
        'collected_amount', u.collected_amount,
        'received_at', u.payment_received_at,
        'received_by', u.payment_received_by,
        'reference', u.payment_reference,
        'note', u.payment_reconciliation_note,
        'receipt_applied', u.collected_amount > 0,
        'actor_id', v_auth_uid
      )
    from updated_orders as u
    returning order_id
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'orderNo', u.order_no,
          'paymentStatus', u.previous_payment_status,
          'paymentMethod', u.previous_payment_method,
          'grossAmount', u.gross_amount,
          'walletAppliedAmount', u.wallet_applied_amount,
          'receivedAmount', u.previous_received_amount,
          'receivedAt', u.previous_received_at,
          'receivedBy', u.previous_received_by,
          'reference', u.previous_reference,
          'note', u.previous_note
        )
        order by u.order_no, u.id
      ),
      '[]'::jsonb
    ),
    coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'orderNo', u.order_no,
        'previousPaymentStatus', u.previous_payment_status,
        'paymentStatus', u.payment_status,
        'grossAmount', u.gross_amount,
        'walletAppliedAmount', u.wallet_applied_amount,
        'previousReceivedAmount', u.previous_received_amount,
        'receivedAmount', u.payment_received_amount,
        'collectedAmount', u.collected_amount
      )
      order by u.order_no, u.id
    ),
    '[]'::jsonb
  )
  into v_previous_orders, v_settled_orders
  from updated_orders as u
  join inserted_events as e on e.order_id = u.id;

  select p.email, p.role
  into v_actor_email, v_actor_role
  from public.profiles as p
  where p.id = v_auth_uid;

  insert into public.admin_audit_events (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason,
    request_metadata,
    result
  )
  values (
    v_auth_uid,
    v_actor_email,
    v_actor_role,
    'customer.orders_bulk_settled',
    'customer',
    p_customer_id::text,
    jsonb_build_object(
      'revision', v_current_revision,
      'order_ids', to_jsonb(v_order_ids),
      'order_count', v_order_count,
      'gross_amount', v_gross_amount,
      'wallet_applied_amount', v_wallet_amount,
      'received_amount', v_previous_received_amount,
      'due_amount', v_collected_amount,
      'orders', v_previous_orders
    ),
    jsonb_build_object(
      'bulk_settlement_id', v_batch_id,
      'order_count', v_order_count,
      'payment_method', v_payment_method,
      'received_at', v_received_at,
      'collected_amount', v_collected_amount,
      'orders', v_settled_orders
    ),
    v_note,
    jsonb_build_object(
      'source', 'admin_customer_bulk_settlement',
      'reference', v_reference
    ),
    'success'
  );

  return jsonb_build_object(
    'bulkSettlementId', v_batch_id,
    'customerId', p_customer_id,
    'orderCount', v_order_count,
    'grossAmount', v_gross_amount,
    'walletAppliedAmount', v_wallet_amount,
    'previousReceivedAmount', v_previous_received_amount,
    'collectedAmount', v_collected_amount,
    'paymentMethod', v_payment_method,
    'receivedAt', v_received_at,
    'reference', v_reference,
    'orders', v_settled_orders
  );
end;
$$;

create or replace function public.admin_preview_customer_settlement(
  p_customer_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_preview_customer_settlement(p_customer_id)
$$;

create or replace function public.admin_settle_customer_orders(
  p_customer_id uuid,
  p_expected_revision text,
  p_payment_method text,
  p_received_at timestamptz default null,
  p_reference text default null,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.admin_settle_customer_orders(
    p_customer_id,
    p_expected_revision,
    p_payment_method,
    p_received_at,
    p_reference,
    p_note
  )
$$;

revoke all on function private.admin_preview_customer_settlement(uuid)
  from public, anon, authenticated;
revoke all on function private.admin_settle_customer_orders(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text
) from public, anon, authenticated;
grant execute on function private.admin_preview_customer_settlement(uuid)
  to authenticated;
grant execute on function private.admin_settle_customer_orders(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text
) to authenticated;

revoke all on function public.admin_preview_customer_settlement(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_settle_customer_orders(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.admin_preview_customer_settlement(uuid)
  to authenticated;
grant execute on function public.admin_settle_customer_orders(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text
) to authenticated;

comment on function public.admin_preview_customer_settlement(uuid) is
  'Returns every non-cancelled, non-deleted, non-paid order for one customer with wallet-aware and prior-receipt-aware amounts plus a concurrency revision. Requires customers.read and orders.manage.';

comment on function public.admin_settle_customer_orders(
  uuid,
  text,
  text,
  timestamptz,
  text,
  text
) is
  'Atomically marks the exact previewed customer order set paid, preserving wallet credit, prior receipts, overpayments, per-order events, and customer-level audit history. Requires customers.read and orders.manage.';

-- Fail closed if an active product in the confirmed REMAX batch has an invalid
-- customer-facing base price. The data update below must never turn an invalid
-- price into a plausible-looking rounded value.
do $$
begin
  -- Prevent a concurrent insert/activation from appearing after the target
  -- snapshot. Reads remain available; product writes wait for this short,
  -- one-time rounding statement to finish.
  lock table public.products in share mode;

  -- Keep validation, rounding and audit insertion under the same product-row
  -- locks so a concurrent admin price edit cannot be overwritten by a stale
  -- rounding snapshot.
  perform p.id
  from public.products as p
  where upper(btrim(coalesce(p.brand, ''))) = 'REMAX'
    and p.status = 'active'
    and p.batch_code = 'REMAX-SONG-2026-07-A'
    and exists (
      select 1
      from public.supplier_batches as sb
      join public.supplier_batch_lines as sbl on sbl.batch_id = sb.id
      where sb.batch_code = 'REMAX-SONG-2026-07-A'
        and sbl.sku_code = p.sku_code
    )
  order by p.id
  for update;

  if exists (
    select 1
    from public.products as p
    where upper(btrim(coalesce(p.brand, ''))) = 'REMAX'
      and p.status = 'active'
      and p.batch_code = 'REMAX-SONG-2026-07-A'
      and exists (
        select 1
        from public.supplier_batches as sb
        join public.supplier_batch_lines as sbl on sbl.batch_id = sb.id
        where sb.batch_code = 'REMAX-SONG-2026-07-A'
          and sbl.sku_code = p.sku_code
      )
      and (coalesce(p.b2b_price, 0) <= 0 or coalesce(p.retail_price, 0) <= 0)
  ) then
    raise exception 'Active REMAX batch contains an invalid sale price'
      using errcode = '23514', detail = 'REMAX_ACTIVE_PRICE_INVALID';
  end if;

  with target_prices as materialized (
  select
    p.id,
    p.sku_code,
    p.b2b_price as previous_b2b_price,
    p.retail_price as previous_retail_price,
    round(ceil(p.b2b_price * 10) / 10, 2) as next_b2b_price,
    round(ceil(p.retail_price * 10) / 10, 2) as next_retail_price
  from public.products as p
  where upper(btrim(coalesce(p.brand, ''))) = 'REMAX'
    and p.status = 'active'
    and p.batch_code = 'REMAX-SONG-2026-07-A'
    and exists (
      select 1
      from public.supplier_batches as sb
      join public.supplier_batch_lines as sbl on sbl.batch_id = sb.id
      where sb.batch_code = 'REMAX-SONG-2026-07-A'
        and sbl.sku_code = p.sku_code
    )
),
updated_prices as (
  update public.products as p
  set
    b2b_price = t.next_b2b_price,
    retail_price = t.next_retail_price,
    updated_at = now()
  from target_prices as t
  where p.id = t.id
    and (
      p.b2b_price is distinct from t.next_b2b_price
      or p.retail_price is distinct from t.next_retail_price
    )
  returning
    p.id,
    p.sku_code,
    t.previous_b2b_price,
    p.b2b_price,
    t.previous_retail_price,
    p.retail_price
)
insert into public.admin_audit_events (
  actor_id,
  actor_email,
  actor_role,
  action,
  entity_type,
  entity_id,
  sku_code,
  before_data,
  after_data,
  reason,
  request_metadata,
  result
)
select
  null::uuid,
  null::text,
  'system',
  'product.remax_active_prices_rounded_up',
  'product',
  u.id::text,
  u.sku_code,
  jsonb_build_object(
    'b2b_price', u.previous_b2b_price,
    'retail_price', u.previous_retail_price
  ),
  jsonb_build_object(
    'b2b_price', u.b2b_price,
    'retail_price', u.retail_price
  ),
  'Round active REMAX sale prices upward to the next EUR 0.10; exact tenths remain unchanged',
  jsonb_build_object(
    'source', 'migration',
    'batch_code', 'REMAX-SONG-2026-07-A',
    'rounding_rule', 'ceil(price * 10) / 10'
  ),
  'success'
from updated_prices as u;
end;
$$;
