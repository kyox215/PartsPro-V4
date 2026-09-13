-- Repair the customer RMA flow and its terminal commercial/inventory closure.
--
-- This migration intentionally contains no production-data backfill. Stale
-- open drafts are expired lazily, under the owning user's create-draft lock,
-- so rollout does not rewrite unrelated customer records.

-- The original SQL literal used `\\.`. With standard_conforming_strings on,
-- PostgreSQL's regex engine received two backslashes and rejected every
-- normal generated `.jpg`/`.png` path. `[.]` is unambiguous in both layers.
alter table public.rma_attachments
  drop constraint if exists rma_attachments_path_contract_check;

alter table public.rma_attachments
  add constraint rma_attachments_path_contract_check
  check (
    storage_path ~ '^rma/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp|heic|heif)$'
  ) not valid;

alter table public.rma_attachments
  validate constraint rma_attachments_path_contract_check;

-- A closed request that was rejected before entering the warehouse does not
-- consume physical return quantity. Keep this one predicate shared by the
-- submit RPC, the relation trigger, and the server projection.
create or replace function private.rma_request_consumes_return_quantity(
  p_status text,
  p_received_at timestamptz,
  p_resolution_action text
)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog, public, private, pg_temp
as $$
  select not (
    coalesce(p_status, 'submitted') = 'rejected'
    or (
      coalesce(p_status, 'submitted') = 'closed'
      and p_received_at is null
      and p_resolution_action is null
    )
  )
$$;

revoke all on function private.rma_request_consumes_return_quantity(text, timestamptz, text)
  from public, anon, authenticated, service_role;

-- Move the already-audited implementations behind small public wrappers.
-- The wrappers add current-access and stale-draft gates without duplicating
-- hundreds of lines of established submission validation.
alter function public.rma_create_draft(uuid, text)
  rename to rma_create_draft_v1_impl;
alter function public.rma_create_draft_v1_impl(uuid, text)
  set schema private;
revoke all on function private.rma_create_draft_v1_impl(uuid, text)
  from public, anon, authenticated, service_role;

create function public.rma_create_draft(
  p_order_line_id uuid,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_stale_draft_id uuid;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- One lock covers expiry, quota counting, and insertion even when the
  -- caller omitted an idempotency key or opened several browser tabs.
  perform pg_advisory_xact_lock(hashtextextended(
    format('rma-draft-user:%s', v_auth_uid),
    0
  ));

  -- Preserve a same-key retry, but release abandoned browser-memory drafts
  -- after 24 hours. Their objects are eligible for the maintenance GC below.
  -- Lock each draft before touching its evidence. Submission and explicit
  -- abandonment use the same draft -> attachment order, so a concurrent
  -- submit can never commit evidence that this expiry pass has claimed.
  for v_stale_draft_id in
    select d.id
    from public.rma_drafts as d
    where d.user_id = v_auth_uid
      and d.status = 'open'
      and d.created_at < now() - interval '24 hours'
      and (
        v_idempotency_key is null
        or d.idempotency_key is distinct from v_idempotency_key
      )
    order by d.created_at, d.id
    for update of d
  loop
    update public.rma_attachments as a
    set status = 'expired',
        updated_at = now()
    where a.draft_id = v_stale_draft_id
      and a.user_id = v_auth_uid
      and a.rma_request_id is null
      and a.status in ('pending', 'verified');

    update public.rma_drafts as d
    set status = 'expired',
        updated_at = now()
    where d.id = v_stale_draft_id;
  end loop;

  return private.rma_create_draft_v1_impl(
    p_order_line_id,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.rma_create_draft(uuid, text)
  from public, anon;
grant execute on function public.rma_create_draft(uuid, text)
  to authenticated;

alter function public.rma_submit_request(uuid, uuid, integer, text, text, text, uuid[], text)
  rename to rma_submit_request_v1_impl;
alter function public.rma_submit_request_v1_impl(uuid, uuid, integer, text, text, text, uuid[], text)
  set schema private;
revoke all on function private.rma_submit_request_v1_impl(uuid, uuid, integer, text, text, text, uuid[], text)
  from public, anon, authenticated, service_role;

-- The previous implementation and relation trigger each had one exact
-- quantity predicate. Patch those known definitions fail-closed: migration
-- application aborts if a prior schema drift changed either body.
do $migration$
declare
  v_definition text;
  v_submit_old text := '    and r.status <> ''rejected'';';
  v_submit_new text := '    and private.rma_request_consumes_return_quantity(r.status, r.received_at, r.resolution_action);';
  v_trigger_existing_old text := '    and r.status <> ''rejected''';
  v_trigger_existing_new text := '    and private.rma_request_consumes_return_quantity(r.status, r.received_at, r.resolution_action)';
  v_trigger_current_old text := '      coalesce(new.status, ''submitted'') <> ''rejected''';
  v_trigger_current_new text := '      private.rma_request_consumes_return_quantity(new.status, new.received_at, new.resolution_action)';
begin
  v_definition := pg_get_functiondef(
    'private.rma_submit_request_v1_impl(uuid,uuid,integer,text,text,text,uuid[],text)'::regprocedure
  );
  if (
    length(v_definition) - length(replace(v_definition, v_submit_old, ''))
  ) / length(v_submit_old) <> 1
  then
    raise exception 'Unexpected rma_submit_request quantity predicate';
  end if;
  execute replace(v_definition, v_submit_old, v_submit_new);

  v_definition := pg_get_functiondef(
    'private.enforce_rma_order_line()'::regprocedure
  );
  if (
    length(v_definition) - length(replace(v_definition, v_trigger_existing_old, ''))
  ) / length(v_trigger_existing_old) <> 1
    or (
      length(v_definition) - length(replace(v_definition, v_trigger_current_old, ''))
    ) / length(v_trigger_current_old) <> 1
  then
    raise exception 'Unexpected enforce_rma_order_line quantity predicate';
  end if;
  v_definition := replace(
    v_definition,
    v_trigger_existing_old,
    v_trigger_existing_new
  );
  execute replace(
    v_definition,
    v_trigger_current_old,
    v_trigger_current_new
  );
end;
$migration$;

create function public.rma_submit_request(
  p_draft_id uuid,
  p_order_line_id uuid,
  p_quantity integer,
  p_reason_code text,
  p_requested_resolution text,
  p_note text default null,
  p_attachment_ids uuid[] default '{}',
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_draft public.rma_drafts%rowtype;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into v_draft
  from public.rma_drafts as d
  where d.id = p_draft_id
    and d.user_id = v_auth_uid;

  if v_draft.id is null then
    raise exception 'RMA draft not found' using errcode = 'P0002';
  end if;

  if v_draft.order_line_id is distinct from p_order_line_id
    or not private.rma_user_can_access_order(
      v_auth_uid,
      v_draft.customer_id,
      v_draft.order_id
    )
  then
    -- This gate deliberately runs before either idempotent replay return.
    raise exception 'RMA order access is no longer active' using errcode = '42501';
  end if;

  return private.rma_submit_request_v1_impl(
    p_draft_id,
    p_order_line_id,
    p_quantity,
    p_reason_code,
    p_requested_resolution,
    p_note,
    p_attachment_ids,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.rma_submit_request(uuid, uuid, integer, text, text, text, uuid[], text)
  from public, anon;
grant execute on function public.rma_submit_request(uuid, uuid, integer, text, text, text, uuid[], text)
  to authenticated;

-- Explicitly abandoning a draft is a different capability from automatic
-- failed-ticket compensation. It may cancel verified evidence only while the
-- owning draft is still open and has never been committed to an RMA.
create or replace function public.rma_abandon_draft(
  p_draft_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_draft public.rma_drafts%rowtype;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into v_draft
  from public.rma_drafts as d
  where d.id = p_draft_id
    and d.user_id = v_auth_uid
  for update;

  if v_draft.id is null then
    raise exception 'RMA draft not found' using errcode = 'P0002';
  end if;

  if v_draft.status in ('abandoned', 'expired') then
    return true;
  end if;

  if v_draft.status <> 'open'
    or v_draft.submitted_rma_id is not null
    or exists (
      select 1
      from public.rma_attachments as a
      where a.draft_id = v_draft.id
        and (
          a.rma_request_id is not null
          or a.status = 'committed'
        )
    )
  then
    raise exception 'A submitted RMA draft cannot be abandoned' using errcode = '23514';
  end if;

  update public.rma_attachments as a
  set status = 'cancelled',
      updated_at = now()
  where a.draft_id = v_draft.id
    and a.user_id = v_auth_uid
    and a.rma_request_id is null
    and a.status in ('pending', 'verified');

  update public.rma_drafts
  set status = 'abandoned',
      abandoned_at = coalesce(abandoned_at, now()),
      updated_at = now()
  where id = v_draft.id;

  return true;
end;
$$;

revoke all on function public.rma_abandon_draft(uuid)
  from public, anon;
grant execute on function public.rma_abandon_draft(uuid)
  to authenticated;

-- Include cancelled and already-expired rows in the service-role GC backstop.
-- An expired row is returned until Storage deletion is acknowledged, so a
-- transient Storage failure never makes the object unreachable to retries.
create or replace function public.rma_gc_expired_attachments(
  p_limit integer default 100
)
returns table(attachment_id uuid, bucket text, storage_path text)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_draft_id uuid;
  v_marked integer;
  v_remaining integer := p_limit;
begin
  if (select auth.uid()) is not null then
    raise exception 'RMA attachment GC is maintenance-only' using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid RMA attachment GC limit' using errcode = '22023';
  end if;

  -- Lock parent drafts in a PL/pgSQL cursor before any attachment update.
  -- Submit and abandon use the same order; SKIP LOCKED makes an in-flight
  -- submission invisible to this maintenance pass instead of waiting for it.
  for v_draft_id in
    select d.id
    from public.rma_drafts as d
    where d.status in ('open', 'submitted', 'abandoned', 'expired')
      and exists (
        select 1
        from public.rma_attachments as candidate
        where candidate.draft_id = d.id
          and candidate.status in ('pending', 'verified', 'cancelled', 'expired')
          and candidate.rma_request_id is null
          and candidate.expires_at <= now()
      )
    order by d.updated_at, d.id
    limit p_limit
    for update of d skip locked
  loop
    return query
    with stale as (
      select a.id
      from public.rma_attachments as a
      where a.draft_id = v_draft_id
        and a.status in ('pending', 'verified', 'cancelled', 'expired')
        and a.rma_request_id is null
        and a.expires_at <= now()
      order by a.expires_at asc, a.created_at asc
      limit v_remaining
      for update of a skip locked
    ), marked as (
      update public.rma_attachments as a
      set status = 'expired', updated_at = now()
      from stale
      where a.id = stale.id
      returning a.id, a.bucket, a.storage_path
    )
    select marked.id, marked.bucket, marked.storage_path
    from marked;

    get diagnostics v_marked = row_count;
    v_remaining := v_remaining - v_marked;
    exit when v_remaining <= 0;
  end loop;
end;
$$;

revoke all on function public.rma_gc_expired_attachments(integer)
  from public, anon, authenticated;
grant execute on function public.rma_gc_expired_attachments(integer)
  to service_role;

create or replace function public.rma_acknowledge_attachment_cleanup(
  p_attachment_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_deleted integer := 0;
begin
  if (select auth.uid()) is not null then
    raise exception 'RMA attachment cleanup acknowledgement is maintenance-only'
      using errcode = '42501';
  end if;

  if coalesce(cardinality(p_attachment_ids), 0) > 1000 then
    raise exception 'Too many RMA attachment cleanup acknowledgements'
      using errcode = '22023';
  end if;

  delete from public.rma_attachments as a
  where a.id = any(coalesce(p_attachment_ids, '{}'::uuid[]))
    and a.rma_request_id is null
    and a.status = 'expired'
    and a.expires_at <= now();

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.rma_acknowledge_attachment_cleanup(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.rma_acknowledge_attachment_cleanup(uuid[])
  to service_role;

-- The wallet approval transaction creates the exact credit before updating
-- wallet_refund_requests. Validate that transaction, then add only its amount
-- back to the already-netted order balance for this BEFORE trigger check.
create or replace function private.assert_rma_wallet_refund_line_cap()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_rma public.rma_requests%rowtype;
  v_line public.order_lines%rowtype;
  v_order public.orders%rowtype;
  v_existing_refunded numeric(12, 2);
  v_current_wallet_credit numeric(12, 2);
  v_unit_price numeric(12, 2);
  v_line_cap numeric(12, 2);
  v_order_refundable_amount numeric(12, 2);
  v_order_line_returnable_quantity integer;
  v_approved_quantity integer;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if new.request_type <> 'rma_return'
    or new.status <> 'approved'
    or new.rma_request_id is null
  then
    return new;
  end if;

  select *
  into v_rma
  from public.rma_requests as r
  where r.id = new.rma_request_id
  for update;

  if v_rma.id is null then
    raise exception 'RMA request does not exist for wallet refund approval' using errcode = '23503';
  end if;

  if v_rma.status <> 'received'
    or v_rma.received_at is null
    or v_rma.qc_status not in ('passed', 'failed', 'not_required')
    or v_rma.requested_resolution not in ('refund', 'wallet_credit', 'credit_note')
    or v_rma.resolution_action <> 'refund_wallet'
    or v_rma.replacement_order_id is not null
    or v_rma.wallet_refund_request_id is distinct from new.id
  then
    raise exception 'Wallet approval is not available for this RMA commercial outcome' using errcode = '23514';
  end if;

  if nullif(new.metadata ->> 'refund_quantity', '') is not null then
    if new.metadata ->> 'refund_quantity' !~ '^[1-9][0-9]{0,8}$' then
      raise exception 'Wallet approval refund quantity metadata is invalid' using errcode = '22023';
    end if;
    v_approved_quantity := (new.metadata ->> 'refund_quantity')::integer;
  else
    v_approved_quantity := v_rma.refund_approved_quantity;
  end if;

  if v_approved_quantity is null
    or v_rma.received_quantity is null
    or v_rma.received_quantity is distinct from v_rma.quantity
    or v_approved_quantity < 1
    or v_approved_quantity <> v_rma.quantity
  then
    raise exception 'Wallet approval requires the complete RMA quantity to be received and approved' using errcode = '22003';
  end if;

  select *
  into v_line
  from public.order_lines as ol
  where ol.id = v_rma.order_line_id
  for update;

  select *
  into v_order
  from public.orders as o
  where o.id = v_line.order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist for wallet refund approval' using errcode = '23503';
  end if;

  if v_rma.unit_price_snapshot is null then
    raise exception 'RMA has no immutable unit-price snapshot for wallet approval' using errcode = '23514';
  end if;
  v_unit_price := v_rma.unit_price_snapshot;
  perform pg_advisory_xact_lock(hashtextextended(
    format('rma-refund-line:%s', coalesce(v_rma.order_line_id, new.order_line_id)),
    0
  ));

  v_order_line_returnable_quantity := private.rma_order_line_returnable_quantity(v_rma.order_line_id);
  if coalesce(v_order_line_returnable_quantity, 0) < v_approved_quantity then
    raise exception 'Approved wallet refund quantity exceeds the order-line returnable quantity' using errcode = '22003';
  end if;

  select coalesce(sum(coalesce(r.refund_net_amount, r.refund_amount, 0)), 0)
  into v_existing_refunded
  from public.rma_requests as r
  where r.order_line_id = v_rma.order_line_id
    and r.id <> v_rma.id
    and r.status in ('refunded', 'closed')
    and coalesce(r.refund_net_amount, r.refund_amount, 0) > 0;

  v_line_cap := least(
    round(v_unit_price * v_approved_quantity, 2),
    greatest(
      round(v_unit_price * v_order_line_returnable_quantity, 2)
        - coalesce(v_existing_refunded, 0),
      0
    )
  );

  select t.amount
  into v_current_wallet_credit
  from public.customer_wallet_transactions as t
  where t.id = new.wallet_transaction_id
    and t.customer_id = v_rma.customer_id
    and t.order_id = v_order.id
    and t.order_line_id = v_rma.order_line_id
    and t.direction = 'credit'
    and t.amount = new.approved_amount
    and t.metadata ->> 'wallet_refund_request_id' = new.id::text;

  if v_current_wallet_credit is null then
    raise exception 'RMA wallet approval is not linked to its exact wallet credit' using errcode = '23514';
  end if;

  v_order_refundable_amount := round(
    coalesce(private.order_wallet_refundable_amount(v_order.id), 0)
      + v_current_wallet_credit,
    2
  );
  v_line_cap := least(v_line_cap, v_order_refundable_amount);
  if coalesce(new.approved_amount, 0) > v_line_cap then
    raise exception 'Approved wallet refund exceeds the remaining order-line cap' using errcode = '22003';
  end if;

  return new;
end;
$$;

-- Customer order history never needs the internal stock ledger. RMA rows in
-- this table include supplier, batch, warehouse location and actor metadata.
drop policy if exists "partspro_stock_movements_staff_or_customer_read"
  on public.stock_movements;

create policy "partspro_stock_movements_staff_read"
  on public.stock_movements
  for select
  to authenticated
  using ((select private.is_staff()));

notify pgrst, 'reload schema';
