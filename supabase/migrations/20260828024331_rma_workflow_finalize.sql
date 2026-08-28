-- Migration B candidate: finalize the server-owned RMA workbench contract.
--
-- This file is intentionally generated but not applied in this batch. It
-- tightens browser grants and the private evidence bucket after the new
-- client is live. A linked dry-run and owner approval are still required.
-- Legacy POST/evidence handlers return RMA_CLIENT_UPGRADE_REQUIRED and do not
-- write direct rows or Storage objects; their route code is deployed with
-- this candidate migration.

create extension if not exists "pgcrypto";

-- Keep historical evidence objects, but make all future writes obey the new
-- opaque draft contract: 4 MiB images only.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'rma-evidence',
  'rma-evidence',
  false,
  4194304,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Once the draft/submit and RPC action paths are live, browser roles cannot
-- read, insert, or mutate RMA rows/events directly. All customer and staff
-- reads go through server-owned routes (service role after server-side scope
-- checks); all writes go through guarded RPCs. Revoking SELECT is required in
-- addition to dropping the historical policies because RLS cannot redact
-- sensitive columns from a table response.
revoke select, insert, update on public.rma_requests from public, anon, authenticated;
revoke select, insert on public.rma_request_events from public, anon, authenticated;
-- The server-owned repository reads these tables with the service role after
-- performing the user/employee scope checks. Grant the minimum read
-- capability explicitly instead of relying on a platform-default role ACL.
grant select on public.rma_requests to service_role;
grant select on public.rma_request_events to service_role;

drop policy if exists "partspro_rma_self_submit" on public.rma_requests;
drop policy if exists "partspro_rma_insert_order_line_guard" on public.rma_requests;
drop policy if exists "partspro_rma_self_or_staff_read" on public.rma_requests;
drop policy if exists "partspro_rma_events_read" on public.rma_request_events;
drop policy if exists "partspro_rma_events_staff_insert" on public.rma_request_events;

-- The capability RPC is intentionally a no-data readiness probe. New server
-- code uses it before any Migration-B-only read/action path, so an A -> code
-- -> B rollout returns a stable 503 instead of a generic 500/502 or a partly
-- executable UI.
create or replace function public.rma_workflow_capabilities()
returns table(
  ready boolean,
  contract_version text
)
language sql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  select true, 'rma-workflow-b1'::text;
$$;

revoke all on function public.rma_workflow_capabilities() from public, anon;
grant execute on function public.rma_workflow_capabilities() to authenticated;

-- First action claim is a small trigger around the existing v3 RPC. It does
-- not copy the action implementation: the RPC remains the state/stock/money
-- authority, while this trigger supplies one auditable owner assignment.
create or replace function private.auto_claim_rma_first_action()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
begin
  if v_auth_uid is null
    or new.assigned_to is not null
    or old.assigned_to is not null
    or not coalesce((select private.is_staff()), false)
  then
    return new;
  end if;

  if not (
    old.status is distinct from new.status
    or old.received_at is distinct from new.received_at
    or old.qc_status is distinct from new.qc_status
    or old.resolution_action is distinct from new.resolution_action
    or old.replacement_order_id is distinct from new.replacement_order_id
    or old.wallet_refund_request_id is distinct from new.wallet_refund_request_id
    or old.inventory_disposition is distinct from new.inventory_disposition
    or old.inventory_disposition_quantity is distinct from new.inventory_disposition_quantity
    or old.refund_amount is distinct from new.refund_amount
    or old.closed_at is distinct from new.closed_at
  ) then
    return new;
  end if;

  new.assigned_to := v_auth_uid;
  new.assigned_by := v_auth_uid;
  new.assigned_at := coalesce(old.assigned_at, now());

  insert into public.rma_request_events (
    rma_request_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    note,
    customer_visible,
    source_action,
    metadata
  )
  values (
    new.id,
    v_auth_uid,
    'assigned',
    old.status,
    new.status,
    'RMA automatically claimed by the first staff action',
    false,
    'auto_claim_first_action',
    jsonb_build_object('auto_claim', true, 'actor_id', v_auth_uid)
  );

  return new;
end;
$$;

revoke all on function private.auto_claim_rma_first_action()
  from public, anon, authenticated;

drop trigger if exists rma_auto_claim_first_action on public.rma_requests;
create trigger rma_auto_claim_first_action
  before update of status, received_at, qc_status, resolution_action,
    replacement_order_id, wallet_refund_request_id, inventory_disposition,
    inventory_disposition_quantity, refund_amount, closed_at
  on public.rma_requests
  for each row
  execute function private.auto_claim_rma_first_action();

-- Review notifications are emitted only for the three review transitions.
-- The existing v3 RPC owns receipt/QC/refund/replacement/close notifications;
-- this narrow trigger avoids duplicating those customer messages.
create or replace function private.notify_rma_review_status_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if new.user_id is null
    or old.status is not distinct from new.status
    or not (
      (old.status = 'submitted' and new.status = 'under_review')
      or (old.status = 'under_review' and new.status in ('approved', 'rejected'))
    )
  then
    return new;
  end if;

  insert into public.notification_events (
    recipient_user_id,
    actor_user_id,
    audience,
    event_type,
    title,
    body,
    target_path,
    source_table,
    source_id,
    rma_request_id,
    source_action,
    payload
  )
  values (
    new.user_id,
    (select auth.uid()),
    'customer',
    'rma_status_updated',
    'RMA status updated',
    case new.status
      when 'under_review' then 'Your RMA is now under review.'
      when 'approved' then 'Your RMA was approved. You can now send it back.'
      else 'Your RMA was rejected.'
    end,
    format('/rma?requestId=%s', new.id),
    'rma_requests',
    new.id::text,
    new.id,
    'review_status_change',
    jsonb_build_object(
      'rma_no', new.rma_no,
      'from_status', old.status,
      'status', new.status
    )
  );

  return new;
end;
$$;

revoke all on function private.notify_rma_review_status_change()
  from public, anon, authenticated;

drop trigger if exists rma_review_status_notification on public.rma_requests;
create trigger rma_review_status_notification
  after update of status
  on public.rma_requests
  for each row
  execute function private.notify_rma_review_status_change();

-- One-click customer return declaration. Ownership is checked against the
-- active customer membership/employee-self helper, not merely user_id, so a
-- current member can act for the same customer while cross-account requests
-- remain invisible. The row lock and existing timestamp make retries safe.
-- The return contract is deliberately narrow: the browser never receives a
-- full public.rma_requests row from this RPC.
drop function if exists public.rma_mark_customer_shipped(uuid, text, text);
create function public.rma_mark_customer_shipped(
  p_request_id uuid,
  p_return_carrier text default null,
  p_return_tracking_code text default null
)
returns table(
  request_id uuid,
  status text,
  customer_shipped_at timestamptz,
  return_carrier text,
  return_tracking_code text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_before public.rma_requests%rowtype;
  v_after public.rma_requests%rowtype;
  v_carrier text := nullif(btrim(coalesce(p_return_carrier, '')), '');
  v_tracking text := nullif(btrim(coalesce(p_return_tracking_code, '')), '');
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_request_id is null then
    raise exception 'RMA request id is required' using errcode = '22023';
  end if;

  if length(coalesce(v_carrier, '')) > 120
    or length(coalesce(v_tracking, '')) > 160
  then
    raise exception 'Return shipment details are too long' using errcode = '22023';
  end if;

  select *
  into v_before
  from public.rma_requests as r
  where r.id = p_request_id
  for update;

  if v_before.id is null then
    raise exception 'RMA request not found' using errcode = 'P0002';
  end if;

  if not private.rma_user_can_access_order(
    v_auth_uid,
    v_before.customer_id,
    v_before.order_id
  ) then
    raise exception 'RMA request is not owned by the authenticated customer' using errcode = '42501';
  end if;

  if v_before.customer_shipped_at is not null then
    -- Once the declaration exists, retries remain idempotent even if staff
    -- has already received the parcel and advanced the RMA status.
    return query select
      v_before.id,
      v_before.status,
      v_before.customer_shipped_at,
      v_before.return_carrier,
      v_before.return_tracking_code;
    return;
  end if;

  if v_before.status <> 'approved' then
    raise exception 'Only approved RMAs can be marked as shipped' using errcode = '23514';
  end if;

  update public.rma_requests
  set customer_shipped_at = now(),
      return_carrier = v_carrier,
      return_tracking_code = v_tracking,
      updated_at = now()
  where id = v_before.id
  returning * into v_after;

  insert into public.rma_request_events (
    rma_request_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    note,
    customer_visible,
    source_action,
    metadata
  )
  values (
    v_after.id,
    v_auth_uid,
    'status_changed',
    v_after.status,
    v_after.status,
    'Return shipment declared by customer',
    true,
    'customer_mark_shipped',
    jsonb_build_object(
      'customer_visible', true,
      'customer_shipped_at', v_after.customer_shipped_at,
      'carrier', v_after.return_carrier,
      'tracking_present', v_after.return_tracking_code is not null
    )
  );

  return query select
    v_after.id,
    v_after.status,
    v_after.customer_shipped_at,
    v_after.return_carrier,
    v_after.return_tracking_code;
end;
$$;

revoke all on function public.rma_mark_customer_shipped(uuid, text, text)
  from public, anon;
grant execute on function public.rma_mark_customer_shipped(uuid, text, text)
  to authenticated;

-- Review actions use a small dedicated RPC so the action route cannot turn a
-- PATCH or a generic v3 action into an unguarded status write. PATCH remains a
-- compatibility reader/writer, but its existing review-transition guard and
-- this notification trigger still apply.
create or replace function public.admin_perform_rma_review_action(
  p_request_id uuid,
  p_action text,
  p_customer_visible_note text default null,
  p_internal_note text default null,
  p_idempotency_key text default null
)
returns public.rma_requests
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_key text := nullif(btrim(p_idempotency_key), '');
  v_before public.rma_requests%rowtype;
  v_after public.rma_requests%rowtype;
  v_execution public.rma_action_executions%rowtype;
  v_next_status text;
  v_fingerprint text;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.is_staff()), false)
    or not (
      coalesce((select private.partspro_has_permission('rma.manage')), false)
      or coalesce((select private.partspro_has_permission('orders.manage')), false)
    )
  then
    raise exception 'RMA manage permission required' using errcode = '42501';
  end if;

  if p_request_id is null
    or v_action not in ('start_review', 'approve', 'reject')
  then
    raise exception 'Invalid RMA review action' using errcode = '23514';
  end if;

  select *
  into v_before
  from public.rma_requests as r
  where r.id = p_request_id
  for update;

  if v_before.id is null then
    raise exception 'RMA request not found' using errcode = 'P0002';
  end if;

  v_next_status := case v_action
    when 'start_review' then 'under_review'
    when 'approve' then 'approved'
    else 'rejected'
  end;
  v_key := coalesce(v_key, format('rma-review:%s:%s', v_action, v_before.id));
  if length(v_key) not between 8 and 160 then
    raise exception 'Invalid RMA review action idempotency key' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    format('rma-review:%s:%s:%s', v_auth_uid, v_before.id, v_key),
    0
  ));

  v_fingerprint := md5(concat_ws('|', v_action, coalesce(p_customer_visible_note, ''), coalesce(p_internal_note, '')));

  select *
  into v_execution
  from public.rma_action_executions as e
  where e.rma_request_id = v_before.id
    and e.action = v_action
    and e.idempotency_key = v_key
  for update;

  if v_execution.id is not null then
    if v_execution.payload_fingerprint <> v_fingerprint then
      raise exception 'RMA review idempotency key was reused with a different payload' using errcode = 'P0001';
    end if;
    if v_execution.execution_status = 'succeeded' then
      select *
      into v_after
      from public.rma_requests as r
      where r.id = v_before.id;
      return v_after;
    end if;
    if v_execution.execution_status = 'started' then
      raise exception 'RMA review action is already executing' using errcode = '55P03';
    end if;
    update public.rma_action_executions
    set execution_status = 'started',
        actor_id = v_auth_uid,
        updated_at = now()
    where id = v_execution.id;
  else
    insert into public.rma_action_executions (
      rma_request_id,
      action,
      idempotency_key,
      payload_fingerprint,
      actor_id,
      execution_status,
      result
    )
    values (
      v_before.id,
      v_action,
      v_key,
      v_fingerprint,
      v_auth_uid,
      'started',
      '{}'::jsonb
    )
    returning * into v_execution;
  end if;

  if v_action = 'start_review' and v_before.status <> 'submitted' then
    raise exception 'RMA review must start from submitted' using errcode = '23514';
  elsif v_action in ('approve', 'reject') and v_before.status <> 'under_review' then
    raise exception 'RMA decision requires an under-review request' using errcode = '23514';
  end if;

  update public.rma_requests
  set status = v_next_status,
      customer_visible_note = coalesce(nullif(btrim(p_customer_visible_note), ''), customer_visible_note),
      internal_note = coalesce(nullif(btrim(p_internal_note), ''), internal_note),
      reviewed_at = coalesce(reviewed_at, now()),
      reviewed_by = v_auth_uid,
      updated_at = now()
  where id = v_before.id
  returning * into v_after;

  insert into public.rma_request_events (
    rma_request_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    note,
    customer_visible,
    source_action,
    idempotency_key,
    rma_action_execution_id,
    metadata
  )
  values (
    v_after.id,
    v_auth_uid,
    'status_changed',
    v_before.status,
    v_after.status,
    coalesce(nullif(btrim(p_customer_visible_note), ''), ''),
    true,
    v_action,
    v_key,
    v_execution.id,
    jsonb_build_object('customer_visible', true, 'review_action', v_action)
  );

  update public.rma_action_executions
  set execution_status = 'succeeded',
      result = jsonb_build_object('rma_request_id', v_after.id, 'status', v_after.status),
      updated_at = now()
  where id = v_execution.id;

  return v_after;
end;
$$;

revoke all on function public.admin_perform_rma_review_action(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.admin_perform_rma_review_action(uuid, text, text, text, text)
  to authenticated;

-- Staff-only exact refund preview. The immutable unit-price snapshot is the
-- sole price source; tax and shipping are deliberately excluded. Existing
-- settled RMA refunds on the same order line and the order wallet balance cap
-- the result. A missing snapshot never falls back to a mutable catalog price.
create or replace function public.admin_rma_refund_preview(
  p_request_id uuid
)
returns table(
  available boolean,
  blocked_reason text,
  currency text,
  max_refund_amount numeric,
  quantity integer,
  tax_and_shipping_included boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_rma public.rma_requests%rowtype;
  v_line public.order_lines%rowtype;
  v_order public.orders%rowtype;
  v_order_line_returnable_quantity integer;
  v_existing_refunds numeric(12, 2) := 0;
  v_wallet_balance numeric(12, 2) := 0;
  v_max numeric(12, 2) := 0;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.is_staff()), false)
    or not (
      coalesce((select private.partspro_has_permission('rma.refund')), false)
      or coalesce((select private.partspro_has_permission('rma.manage')), false)
      or coalesce((select private.partspro_has_permission('orders.manage')), false)
      or coalesce((select private.partspro_has_permission('wallet_refunds.request')), false)
    )
  then
    raise exception 'RMA refund preview permission required' using errcode = '42501';
  end if;

  select *
  into v_rma
  from public.rma_requests as r
  where r.id = p_request_id;

  if v_rma.id is null then
    raise exception 'RMA request not found' using errcode = 'P0002';
  end if;

  -- Keep preview availability exactly aligned with the v3 wallet-refund
  -- action. A preview is not a promise to pay: it must fail closed for a
  -- mismatched requested resolution, an existing replacement/wallet outcome,
  -- incomplete receipt, missing receipt timestamp, pending wallet request,
  -- or missing QC result.
  if v_rma.requested_resolution not in ('refund', 'wallet_credit', 'credit_note')
    or (v_rma.resolution_action is not null and v_rma.resolution_action <> 'refund_wallet')
    or v_rma.replacement_order_id is not null
    or v_rma.status in ('refunded', 'replacement_sent', 'replaced')
    or exists (
      select 1
      from public.rma_action_executions as e
      where e.rma_request_id = v_rma.id
        and e.action = 'mark_replacement_sent'
        and e.execution_status = 'succeeded'
    )
  then
    return query select false, 'invalid_snapshot', coalesce(v_rma.refund_currency, 'EUR'), 0::numeric, coalesce(v_rma.quantity, 0), false;
    return;
  end if;

  if v_rma.status <> 'received'
    or v_rma.received_at is null
    or v_rma.qc_status not in ('passed', 'failed', 'not_required')
    or v_rma.received_quantity is distinct from v_rma.quantity
    or (
      v_rma.wallet_refund_request_id is not null
      and not exists (
        select 1
        from public.wallet_refund_requests as linked
        where linked.id = v_rma.wallet_refund_request_id
          and linked.rma_request_id = v_rma.id
          and linked.request_type = 'rma_return'
          and linked.status = 'rejected'
      )
    )
    or exists (
      select 1
      from public.wallet_refund_requests as wr
      where wr.rma_request_id = v_rma.id
        and wr.status <> 'rejected'
    )
  then
    return query select false, 'invalid_snapshot', coalesce(v_rma.refund_currency, 'EUR'), 0::numeric, coalesce(v_rma.quantity, 0), false;
    return;
  end if;

  if v_rma.unit_price_snapshot is null
    or v_rma.quantity is null
    or v_rma.quantity < 1
  then
    return query select false, 'missing_unit_price_snapshot', 'EUR', 0::numeric, 0, false;
    return;
  end if;

  select * into v_line
  from public.order_lines as ol
  where ol.id = v_rma.order_line_id;

  select * into v_order
  from public.orders as o
  -- The line is the canonical commercial scope. Legacy order_id values can
  -- be stale or malformed; using them first would make preview amounts drift
  -- from the v3 action, which locks and resolves the order through the line.
  where o.id = v_line.order_id;

  if v_line.id is null or v_order.id is null then
    return query select false, 'invalid_snapshot', coalesce(v_rma.refund_currency, 'EUR'), 0::numeric, 0, false;
    return;
  end if;

  v_order_line_returnable_quantity := private.rma_order_line_returnable_quantity(v_line.id);
  if coalesce(v_order_line_returnable_quantity, 0) < v_rma.quantity then
    return query select false, 'invalid_snapshot', coalesce(v_rma.refund_currency, 'EUR'), 0::numeric, v_rma.quantity, false;
    return;
  end if;

  select coalesce(sum(coalesce(r.refund_net_amount, r.refund_amount, 0)), 0)
  into v_existing_refunds
  from public.rma_requests as r
  where r.order_line_id = v_rma.order_line_id
    and r.id <> v_rma.id
    and r.status in ('refunded', 'closed')
    and coalesce(r.refund_net_amount, r.refund_amount, 0) > 0;

  v_wallet_balance := coalesce(private.order_wallet_refundable_amount(v_order.id), 0);
  v_max := greatest(
    least(
      round(v_rma.unit_price_snapshot * v_rma.quantity, 2),
      greatest(round(v_rma.unit_price_snapshot * v_order_line_returnable_quantity, 2) - v_existing_refunds, 0),
      v_wallet_balance
    ),
    0
  );

  return query select
    v_max > 0,
    case when v_max > 0 then null else 'wallet_balance_exhausted' end,
    coalesce(v_rma.refund_currency, 'EUR'),
    v_max,
    v_rma.quantity,
    false;
end;
$$;

revoke all on function public.admin_rma_refund_preview(uuid)
  from public, anon;
grant execute on function public.admin_rma_refund_preview(uuid)
  to authenticated;

-- Replacement candidates are selected server-side so staff never copies a
-- UUID. A candidate belongs to the same customer, is a different shipped
-- order, contains enough of the RMA SKU, and has never been associated with
-- another RMA. This matches the v3 action and the unique index: any non-null
-- replacement_order_id is a conflict, including legacy/rejected rows.
create or replace function public.admin_rma_replacement_candidates(
  p_request_id uuid
)
returns table(
  id uuid,
  order_number text,
  shipped_at timestamptz,
  quantity integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_rma public.rma_requests%rowtype;
  v_customer_id uuid;
  v_sku_code text;
  v_original_order_id uuid;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.is_staff()), false)
    or not (
      coalesce((select private.partspro_has_permission('rma.read')), false)
      or coalesce((select private.partspro_has_permission('orders.read')), false)
    )
  then
    raise exception 'RMA replacement candidate permission required' using errcode = '42501';
  end if;

  select * into v_rma
  from public.rma_requests as r
  where r.id = p_request_id;

  if v_rma.id is null then
    raise exception 'RMA request not found' using errcode = 'P0002';
  end if;

  v_customer_id := v_rma.customer_id;
  v_sku_code := v_rma.sku_code;
  select ol.order_id
  into v_original_order_id
  from public.order_lines as ol
  where ol.id = v_rma.order_line_id;
  -- Match the v3 action's line-first order resolution for malformed legacy
  -- rows. The fallback is only for rows whose order line is unavailable.
  v_original_order_id := coalesce(v_original_order_id, v_rma.order_id);

  if v_customer_id is null
    or v_sku_code is null
    or v_rma.quantity is null
    or v_original_order_id is null
  then
    return;
  end if;

  return query
  select
    o.id,
    o.order_no,
    coalesce(shipped_event.shipped_at, o.updated_at) as shipped_at,
    sum(greatest(ol.quantity - coalesce(ol.cancelled_qty, 0), 0))::integer as quantity
  from public.orders as o
  join public.order_lines as ol on ol.order_id = o.id
  left join lateral (
    select oe.created_at as shipped_at
    from public.order_events as oe
    where oe.order_id = o.id
      and oe.to_status = 'shipped'
    order by oe.created_at asc
    limit 1
  ) as shipped_event on true
  where o.customer_id = v_customer_id
    and o.id is distinct from v_original_order_id
    and o.status = 'shipped'
    and ol.sku_code = v_sku_code
    and not exists (
      select 1
      from public.rma_requests as other_rma
      where other_rma.id <> v_rma.id
        and other_rma.replacement_order_id = o.id
    )
  group by o.id, o.order_no, shipped_event.shipped_at, o.updated_at
  having sum(greatest(ol.quantity - coalesce(ol.cancelled_qty, 0), 0)) >= v_rma.quantity
  order by shipped_at desc, o.order_no;
end;
$$;

revoke all on function public.admin_rma_replacement_candidates(uuid)
  from public, anon;
grant execute on function public.admin_rma_replacement_candidates(uuid)
  to authenticated;
