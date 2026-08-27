-- RMA simple-flow expansion (Migration A).
--
-- This migration is intentionally additive. It keeps the historical
-- rma_requests/rma_request_events grants and policies in place for the
-- compatibility read path. Migration B will own any final direct-write
-- revocation after the new clients are live.

create extension if not exists "pgcrypto";

create sequence if not exists public.rma_request_no_seq;

alter table public.rma_requests
  add column if not exists rma_no text,
  add column if not exists draft_id uuid,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists order_id uuid references public.orders(id) on delete set null,
  add column if not exists reason_code text,
  add column if not exists policy_scope text not null default 'legacy_unverified',
  add column if not exists policy_version text,
  add column if not exists eligible_until timestamptz,
  add column if not exists customer_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists order_line_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists product_name_snapshot text,
  add column if not exists return_address_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists return_carrier text,
  add column if not exists return_tracking_code text,
  add column if not exists customer_shipped_at timestamptz,
  add column if not exists received_quantity integer,
  add column if not exists received_condition text,
  add column if not exists received_by uuid references auth.users(id) on delete set null,
  add column if not exists qc_status text not null default 'pending',
  add column if not exists qc_notes text,
  add column if not exists qc_by uuid references auth.users(id) on delete set null,
  add column if not exists qc_at timestamptz,
  add column if not exists refund_method text,
  add column if not exists refund_currency text not null default 'EUR',
  add column if not exists refund_net_amount numeric(12, 2),
  add column if not exists refund_tax_amount numeric(12, 2),
  add column if not exists refund_shipping_amount numeric(12, 2),
  add column if not exists replacement_order_id uuid references public.orders(id) on delete set null,
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_policy_scope_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_policy_scope_check
      check (policy_scope in (
        'legacy_unverified',
        'b2c_statutory_withdrawal',
        'b2c_warranty',
        'b2b_commercial'
      ));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_qc_status_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_qc_status_check
      check (qc_status in ('pending', 'passed', 'failed', 'not_required'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_refund_method_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_refund_method_check
      check (refund_method is null or refund_method in ('original_payment', 'wallet_credit', 'credit_note'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_snapshot_object_checks'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_snapshot_object_checks
      check (jsonb_typeof(customer_snapshot) = 'object' and jsonb_typeof(order_line_snapshot) = 'object' and jsonb_typeof(return_address_snapshot) = 'object');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_received_quantity_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_received_quantity_check
      check (received_quantity is null or (received_quantity >= 0 and received_quantity <= quantity));
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_requested_resolution_check'
  ) then
    alter table public.rma_requests drop constraint rma_requests_requested_resolution_check;
  end if;

  alter table public.rma_requests
    add constraint rma_requests_requested_resolution_check
    check (requested_resolution in ('replacement', 'refund', 'credit_note', 'wallet_credit'));

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_resolution_action_check'
  ) then
    alter table public.rma_requests drop constraint rma_requests_resolution_action_check;
  end if;

  alter table public.rma_requests
    add constraint rma_requests_resolution_action_check
    check (
      resolution_action is null
      or resolution_action in (
        'replacement',
        'refund_wallet',
        'credit_note',
        'no_fault',
        'scrap',
        'return_to_stock',
        'supplier_return'
      )
    );
end
$$;

create unique index if not exists rma_requests_rma_no_unique
  on public.rma_requests (rma_no)
  where rma_no is not null;

create unique index if not exists rma_requests_user_idempotency_unique
  on public.rma_requests (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists rma_requests_customer_id_idx
  on public.rma_requests (customer_id, created_at desc)
  where customer_id is not null;

create table if not exists public.rma_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_line_id uuid not null references public.order_lines(id) on delete restrict,
  status text not null default 'open',
  policy_scope text not null default 'legacy_unverified',
  policy_version text,
  eligible_until timestamptz,
  reason_code text,
  requested_resolution text,
  note text,
  idempotency_key text,
  submitted_rma_id uuid references public.rma_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  abandoned_at timestamptz,
  constraint rma_drafts_status_check check (status in ('open', 'submitted', 'abandoned', 'expired')),
  constraint rma_drafts_policy_scope_check check (policy_scope in (
    'legacy_unverified',
    'b2c_statutory_withdrawal',
    'b2c_warranty',
    'b2b_commercial'
  )),
  constraint rma_drafts_reason_code_check check (
    reason_code is null
    or reason_code in (
      'quality_defect',
      'shipping_damage',
      'not_as_described',
      'wrong_item',
      'missing_or_quantity_error',
      'withdrawal_no_longer_needed'
    )
  ),
  constraint rma_drafts_requested_resolution_check check (
    requested_resolution is null
    or requested_resolution in ('replacement', 'refund', 'wallet_credit')
  ),
  constraint rma_drafts_idempotency_key_length check (idempotency_key is null or length(btrim(idempotency_key)) between 8 and 128)
);

create unique index if not exists rma_drafts_user_idempotency_unique
  on public.rma_drafts (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists rma_drafts_user_status_idx
  on public.rma_drafts (user_id, status, updated_at desc);

create table if not exists public.rma_attachments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.rma_drafts(id) on delete cascade,
  rma_request_id uuid references public.rma_requests(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_line_id uuid not null references public.order_lines(id) on delete restrict,
  bucket text not null default 'rma-evidence',
  storage_path text not null unique,
  verification_token uuid not null default gen_random_uuid(),
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null,
  sha256 text,
  status text not null default 'pending',
  evidence_kind text not null default 'product',
  uploaded_at timestamptz,
  verified_at timestamptz,
  committed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rma_attachments_bucket_check check (bucket = 'rma-evidence'),
  constraint rma_attachments_content_type_check check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  constraint rma_attachments_size_check check (size_bytes > 0 and size_bytes <= 4194304),
  constraint rma_attachments_sha256_check check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  constraint rma_attachments_status_check check (status in ('pending', 'verified', 'committed', 'rejected', 'expired')),
  constraint rma_attachments_evidence_kind_check check (evidence_kind in ('product', 'packaging', 'label', 'other')),
  constraint rma_attachments_original_name_check check (length(btrim(original_name)) between 1 and 180 and original_name !~ '[\\/]'),
  constraint rma_attachments_path_contract_check check (storage_path ~ '^rma/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|png|webp|heic|heif)$')
);

alter table public.rma_attachments
  add column if not exists verification_token uuid not null default gen_random_uuid();

create index if not exists rma_attachments_draft_status_idx
  on public.rma_attachments (draft_id, status, created_at);

create index if not exists rma_attachments_rma_idx
  on public.rma_attachments (rma_request_id, created_at)
  where rma_request_id is not null;

create table if not exists public.rma_action_executions (
  id uuid primary key default gen_random_uuid(),
  rma_request_id uuid not null references public.rma_requests(id) on delete cascade,
  action text not null,
  idempotency_key text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  execution_status text not null default 'started',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rma_action_executions_status_check check (execution_status in ('started', 'succeeded', 'failed')),
  constraint rma_action_executions_result_object_check check (jsonb_typeof(result) = 'object'),
  constraint rma_action_executions_idempotency_key_length check (length(btrim(idempotency_key)) between 8 and 160),
  constraint rma_action_executions_unique_key unique (rma_request_id, action, idempotency_key)
);

create unique index if not exists rma_action_executions_terminal_disposition_unique
  on public.rma_action_executions (rma_request_id)
  where execution_status = 'succeeded'
    and action in ('restock_return', 'mark_scrapped', 'supplier_return');

create index if not exists rma_action_executions_request_idx
  on public.rma_action_executions (rma_request_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_draft_id_fkey'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_draft_id_fkey
      foreign key (draft_id) references public.rma_drafts(id) on delete set null;
  end if;
end
$$;

alter table public.rma_request_events
  add column if not exists customer_visible boolean not null default false,
  add column if not exists source_action text,
  add column if not exists idempotency_key text,
  add column if not exists rma_action_execution_id uuid references public.rma_action_executions(id) on delete set null;

alter table public.wallet_refund_requests
  add column if not exists rma_request_id uuid references public.rma_requests(id) on delete set null,
  add column if not exists rma_action_execution_id uuid references public.rma_action_executions(id) on delete set null;

alter table public.stock_movements
  add column if not exists rma_request_id uuid references public.rma_requests(id) on delete set null,
  add column if not exists rma_action_execution_id uuid references public.rma_action_executions(id) on delete set null,
  add column if not exists source_type text;

alter table public.notification_events
  add column if not exists rma_request_id uuid references public.rma_requests(id) on delete set null,
  add column if not exists source_action text;

create index if not exists wallet_refund_requests_rma_idx
  on public.wallet_refund_requests (rma_request_id, requested_at desc)
  where rma_request_id is not null;

create index if not exists stock_movements_rma_idx
  on public.stock_movements (rma_request_id, created_at desc)
  where rma_request_id is not null;

create index if not exists notification_events_rma_idx
  on public.notification_events (rma_request_id, created_at desc)
  where rma_request_id is not null;

-- V1 accepts compressed still images only. The bucket remains private and the
-- signed URL is returned only as a one-shot upload capability by the route.
update storage.buckets
set public = false,
    file_size_limit = 4194304,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]::text[]
where id = 'rma-evidence';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.wallet_refund_requests'::regclass
      and conname = 'wallet_refund_requests_request_type_check'
  ) then
    alter table public.wallet_refund_requests
      drop constraint wallet_refund_requests_request_type_check;
  end if;

  alter table public.wallet_refund_requests
    add constraint wallet_refund_requests_request_type_check
    check (request_type in ('order_line_shortage', 'order_void', 'rma_return'));

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stock_movements'::regclass
      and conname = 'stock_movements_movement_type_check'
  ) then
    alter table public.stock_movements
      drop constraint stock_movements_movement_type_check;
  end if;

  alter table public.stock_movements
    add constraint stock_movements_movement_type_check
    check (movement_type in (
      'reserve',
      'release',
      'consume',
      'rma_quarantine',
      'rma_restock',
      'rma_disposition'
    ));

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_request_events'::regclass
      and conname = 'rma_request_events_type_check'
  ) then
    alter table public.rma_request_events
      drop constraint rma_request_events_type_check;
  end if;

  alter table public.rma_request_events
    add constraint rma_request_events_type_check
    check (event_type in (
      'created',
      'status_changed',
      'note_added',
      'assigned',
      'received',
      'refund_requested',
      'refund_approved',
      'inventory_disposition',
      'stock_adjusted',
      'resolved',
      'closed',
      'draft_created',
      'attachment_verified',
      'submitted',
      'quarantine_recorded',
      'replacement_sent',
      'action_completed'
    ));

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notification_events'::regclass
      and conname = 'notification_events_type_check'
  ) then
    alter table public.notification_events
      drop constraint notification_events_type_check;
  end if;

  alter table public.notification_events
    add constraint notification_events_type_check
    check (event_type in (
      'admin_test',
      'customer_test',
      'new_order',
      'order_status_updated',
      'order_shipping_updated',
      'support_customer_message',
      'support_staff_reply',
      'support_assigned',
      'rma_submitted',
      'rma_status_updated',
      'rma_action_required'
    ));
end
$$;

-- New tables are RPC-only. In particular, never grant a browser role direct
-- insert/update access to the attachment or action ledger tables.
alter table public.rma_drafts enable row level security;
alter table public.rma_attachments enable row level security;
alter table public.rma_action_executions enable row level security;

revoke all on table public.rma_drafts from public, anon, authenticated;
revoke all on table public.rma_attachments from public, anon, authenticated;
revoke all on table public.rma_action_executions from public, anon, authenticated;

grant select, insert, update, delete on table public.rma_drafts to service_role;
grant select, insert, update, delete on table public.rma_attachments to service_role;
grant select, insert, update, delete on table public.rma_action_executions to service_role;

comment on table public.rma_drafts is
  'Server-owned customer RMA draft bound to one authenticated order line.';
comment on table public.rma_attachments is
  'Private, opaque-ID RMA evidence ledger; files are verified before commit.';
comment on table public.rma_action_executions is
  'Append-only/idempotent admin RMA action execution ledger.';
comment on column public.rma_requests.policy_scope is
  'Policy family only; legacy_unverified never rejects a request by an unconfirmed product-day setting.';
comment on column public.rma_requests.eligible_until is
  'Nullable until Italian B2C/B2B policy is approved; not enforced for legacy_unverified.';

create or replace function private.rma_attachment_extension(p_content_type text)
returns text
language sql
immutable
set search_path = pg_catalog, public, private, pg_temp
as $$
  select case lower(btrim(coalesce(p_content_type, '')))
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    when 'image/heic' then 'heic'
    when 'image/heif' then 'heif'
    else null
  end
$$;

create or replace function public.rma_create_draft(
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
  v_customer_id uuid;
  v_existing public.rma_drafts%rowtype;
  v_line public.order_lines%rowtype;
  v_order public.orders%rowtype;
  v_draft_id uuid;
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_order_line_id is null then
    raise exception 'Order line is required' using errcode = '23514';
  end if;

  if v_idempotency_key is not null and length(v_idempotency_key) not between 8 and 128 then
    raise exception 'Invalid draft idempotency key' using errcode = '23514';
  end if;

  select *
  into v_line
  from public.order_lines as ol
  where ol.id = p_order_line_id;

  if v_line.id is null then
    raise exception 'Order line not found' using errcode = 'P0002';
  end if;

  select *
  into v_order
  from public.orders as o
  where o.id = v_line.order_id;

  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  v_customer_id := v_order.customer_id;

  if not (
    v_order.user_id = v_auth_uid
    or v_customer_id = (select private.current_customer_id())
  ) then
    raise exception 'Order line does not belong to the authenticated customer' using errcode = '42501';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Cancelled orders cannot start an RMA' using errcode = '23514';
  end if;

  if v_idempotency_key is not null then
    select *
    into v_existing
    from public.rma_drafts as d
    where d.user_id = v_auth_uid
      and d.idempotency_key = v_idempotency_key
    for update;

    if v_existing.id is not null then
      if v_existing.order_line_id <> p_order_line_id then
        raise exception 'Draft idempotency key is bound to another order line' using errcode = '23505';
      end if;
      return v_existing.id;
    end if;
  end if;

  insert into public.rma_drafts (
    user_id,
    customer_id,
    order_id,
    order_line_id,
    policy_scope,
    idempotency_key
  )
  values (
    v_auth_uid,
    v_customer_id,
    v_order.id,
    v_line.id,
    'legacy_unverified',
    v_idempotency_key
  )
  returning id into v_draft_id;

  return v_draft_id;
end;
$$;

create or replace function public.rma_prepare_attachment_upload(
  p_draft_id uuid,
  p_original_name text,
  p_content_type text,
  p_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_draft public.rma_drafts%rowtype;
  v_attachment_id uuid := gen_random_uuid();
  v_content_type text := lower(btrim(coalesce(p_content_type, '')));
  v_extension text := private.rma_attachment_extension(p_content_type);
  v_existing_count integer;
  v_storage_path text;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_draft_id is null then
    raise exception 'RMA draft is required' using errcode = '23514';
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 or p_size_bytes > 4194304 then
    raise exception 'RMA image must be between 1 byte and 4 MiB' using errcode = '22003';
  end if;

  if v_extension is null then
    raise exception 'Only JPEG, PNG, WebP, HEIC, and HEIF images are supported' using errcode = '22023';
  end if;

  if p_original_name is null
    or length(btrim(p_original_name)) not between 1 and 180
    or p_original_name ~ '[\\/]'
  then
    raise exception 'Invalid RMA image file name' using errcode = '22023';
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

  if v_draft.status <> 'open' then
    raise exception 'RMA draft is no longer open' using errcode = '23514';
  end if;

  select count(*)
  into v_existing_count
  from public.rma_attachments as a
  where a.draft_id = v_draft.id
    and a.status <> 'rejected';

  if v_existing_count >= 6 then
    raise exception 'An RMA draft can contain at most six images' using errcode = '22003';
  end if;

  v_storage_path := format(
    'rma/%s/%s/%s.%s',
    v_auth_uid,
    v_draft.id,
    v_attachment_id,
    v_extension
  );

  insert into public.rma_attachments (
    id,
    draft_id,
    user_id,
    customer_id,
    order_line_id,
    bucket,
    storage_path,
    original_name,
    content_type,
    size_bytes,
    status,
    expires_at
  )
  values (
    v_attachment_id,
    v_draft.id,
    v_auth_uid,
    v_draft.customer_id,
    v_draft.order_line_id,
    'rma-evidence',
    v_storage_path,
    btrim(p_original_name),
    v_content_type,
    p_size_bytes,
    'pending',
    now() + interval '2 hours'
  );

  return v_attachment_id;
end;
$$;

create or replace function public.rma_complete_attachment(
  p_attachment_id uuid,
  p_sha256 text,
  p_size_bytes bigint,
  p_verification_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_attachment public.rma_attachments%rowtype;
  v_sha256 text := lower(btrim(coalesce(p_sha256, '')));
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if v_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Attachment sha256 is invalid' using errcode = '22023';
  end if;

  if p_verification_token is null then
    raise exception 'Attachment verification token is required' using errcode = '42501';
  end if;

  select *
  into v_attachment
  from public.rma_attachments as a
  where a.id = p_attachment_id
    and a.user_id = v_auth_uid
  for update;

  if v_attachment.id is null then
    raise exception 'RMA attachment not found' using errcode = 'P0002';
  end if;

  if v_attachment.verification_token is distinct from p_verification_token then
    raise exception 'Attachment verification token is invalid' using errcode = '42501';
  end if;

  if v_attachment.status in ('verified', 'committed')
    and v_attachment.sha256 = v_sha256
    and v_attachment.size_bytes = p_size_bytes
  then
    return true;
  end if;

  if v_attachment.status <> 'pending' then
    raise exception 'RMA attachment is not awaiting verification' using errcode = '23514';
  end if;

  if now() > v_attachment.expires_at then
    update public.rma_attachments
    set status = 'expired', updated_at = now()
    where id = v_attachment.id;
    raise exception 'RMA attachment upload ticket expired' using errcode = '57014';
  end if;

  if p_size_bytes is null or p_size_bytes <> v_attachment.size_bytes then
    raise exception 'Uploaded image size does not match the upload ticket' using errcode = '22003';
  end if;

  update public.rma_attachments
  set sha256 = v_sha256,
      status = 'verified',
      uploaded_at = coalesce(uploaded_at, now()),
      verified_at = now(),
      updated_at = now()
  where id = v_attachment.id;

  return true;
end;
$$;

create or replace function public.rma_submit_request(
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
  v_customer_id uuid;
  v_draft public.rma_drafts%rowtype;
  v_existing public.rma_requests%rowtype;
  v_line public.order_lines%rowtype;
  v_order public.orders%rowtype;
  v_customer public.customers%rowtype;
  v_rma_id uuid;
  v_rma_no text;
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_attachment_count integer := coalesce(array_length(p_attachment_ids, 1), 0);
  v_requested_count integer;
  v_eligible_count integer;
  v_reason text := lower(btrim(coalesce(p_reason_code, '')));
  v_resolution text := lower(btrim(coalesce(p_requested_resolution, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_draft_id is null or p_order_line_id is null then
    raise exception 'RMA draft and order line are required' using errcode = '23514';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'RMA quantity must be positive' using errcode = '22003';
  end if;

  if v_note is not null and length(v_note) > 2000 then
    raise exception 'RMA note is too long' using errcode = '22023';
  end if;

  if v_reason not in (
    'quality_defect',
    'shipping_damage',
    'not_as_described',
    'wrong_item',
    'missing_or_quantity_error',
    'withdrawal_no_longer_needed'
  ) then
    raise exception 'Invalid RMA reason code' using errcode = '22023';
  end if;

  if v_resolution not in ('replacement', 'refund', 'wallet_credit') then
    raise exception 'Invalid RMA resolution' using errcode = '22023';
  end if;

  if v_attachment_count > 6 then
    raise exception 'An RMA can contain at most six images' using errcode = '22003';
  end if;

  if v_idempotency_key is null then
    v_idempotency_key := concat('rma-submit:', p_draft_id::text);
  elsif length(v_idempotency_key) not between 8 and 128 then
    raise exception 'Invalid RMA idempotency key' using errcode = '23514';
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

  if v_draft.order_line_id <> p_order_line_id then
    raise exception 'RMA draft is bound to another order line' using errcode = '42501';
  end if;

  if v_draft.status = 'submitted' and v_draft.submitted_rma_id is not null then
    return v_draft.submitted_rma_id;
  end if;

  select *
  into v_existing
  from public.rma_requests as r
  where r.user_id = v_auth_uid
    and r.idempotency_key = v_idempotency_key
  for update;

  if v_existing.id is not null then
    if v_existing.order_line_id <> p_order_line_id
      or v_existing.quantity <> p_quantity
      or v_existing.reason_code <> v_reason
      or v_existing.requested_resolution <> v_resolution
    then
      raise exception 'RMA idempotency key is bound to a different request' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;

  select *
  into v_line
  from public.order_lines as ol
  where ol.id = p_order_line_id
  for update;

  if v_line.id is null then
    raise exception 'Order line not found' using errcode = 'P0002';
  end if;

  select *
  into v_order
  from public.orders as o
  where o.id = v_line.order_id
  for update;

  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  v_customer_id := v_order.customer_id;

  if not (
    v_order.user_id = v_auth_uid
    or v_customer_id = (select private.current_customer_id())
  ) then
    raise exception 'Order line does not belong to the authenticated customer' using errcode = '42501';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Cancelled orders cannot be submitted for RMA' using errcode = '23514';
  end if;

  select coalesce(sum(r.quantity), 0)
  into v_requested_count
  from public.rma_requests as r
  where r.order_line_id = v_line.id
    and r.status <> 'rejected';

  if p_quantity + v_requested_count > v_line.quantity then
    raise exception 'RMA quantity exceeds the remaining order-line quantity' using errcode = '22003';
  end if;

  select count(*)
  into v_eligible_count
  from public.rma_attachments as a
  where a.id = any(coalesce(p_attachment_ids, '{}'))
    and a.draft_id = v_draft.id
    and a.user_id = v_auth_uid
    and a.order_line_id = v_line.id
    and a.status = 'verified';

  if v_eligible_count <> v_attachment_count then
    raise exception 'Every submitted RMA image must be a verified attachment from this draft' using errcode = '42501';
  end if;

  if v_reason <> 'withdrawal_no_longer_needed' and v_attachment_count < 1 then
    raise exception 'This RMA reason requires at least one verified image' using errcode = '23514';
  end if;

  select *
  into v_customer
  from public.customers as c
  where c.id = v_customer_id;

  v_rma_no := format(
    'PP-RMA-%s-%s',
    to_char(now(), 'YYYYMMDD'),
    lpad(nextval('public.rma_request_no_seq')::text, 6, '0')
  );

  insert into public.rma_requests (
    rma_no,
    draft_id,
    user_id,
    customer_id,
    order_id,
    order_no,
    sku_code,
    order_line_id,
    quantity,
    status,
    problem_type,
    reason_code,
    description,
    requested_resolution,
    has_physical_damage,
    customer_snapshot,
    order_line_snapshot,
    product_name_snapshot,
    return_address_snapshot,
    policy_scope,
    policy_version,
    eligible_until,
    idempotency_key,
    attachments,
    customer_visible_note
  )
  values (
    v_rma_no,
    v_draft.id,
    v_auth_uid,
    v_customer_id,
    v_order.id,
    v_order.order_no,
    v_line.sku_code,
    v_line.id,
    p_quantity,
    'submitted',
    v_reason,
    v_reason,
    coalesce(v_note, ''),
    v_resolution,
    v_reason = 'shipping_damage',
    jsonb_build_object(
      'id', v_customer.id,
      'company_name', v_customer.company_name,
      'contact_name', v_customer.contact_name,
      'customer_type', v_customer.customer_type
    ),
    jsonb_build_object(
      'id', v_line.id,
      'order_id', v_order.id,
      'sku_code', v_line.sku_code,
      'product_name', v_line.product_name,
      'quantity', v_line.quantity,
      'unit_price', v_line.unit_price
    ),
    v_line.product_name,
    jsonb_build_object('delivery_address', v_order.delivery_address),
    'legacy_unverified',
    null,
    null,
    v_idempotency_key,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'attachment_id', a.id,
        'name', a.original_name,
        'content_type', a.content_type,
        'size_bytes', a.size_bytes,
        'sha256', a.sha256,
        'uploaded_at', a.uploaded_at,
        'verified_at', a.verified_at,
        'status', a.status
      ) order by a.created_at)
      from public.rma_attachments as a
      where a.id = any(coalesce(p_attachment_ids, '{}'))
        and a.draft_id = v_draft.id
        and a.user_id = v_auth_uid
        and a.status = 'verified'
    ), '[]'::jsonb),
    coalesce(v_note, '')
  )
  returning id into v_rma_id;

  update public.rma_attachments
  set rma_request_id = v_rma_id,
      committed_at = now(),
      status = 'committed',
      updated_at = now()
  where id = any(coalesce(p_attachment_ids, '{}'))
    and draft_id = v_draft.id
    and user_id = v_auth_uid;

  update public.rma_drafts
  set status = 'submitted',
      reason_code = v_reason,
      requested_resolution = v_resolution,
      note = coalesce(v_note, ''),
      idempotency_key = v_idempotency_key,
      submitted_rma_id = v_rma_id,
      submitted_at = now(),
      updated_at = now()
  where id = v_draft.id;

  insert into public.rma_request_events (
    rma_request_id,
    actor_id,
    event_type,
    to_status,
    note,
    customer_visible,
    source_action,
    idempotency_key,
    metadata
  )
  values (
    v_rma_id,
    v_auth_uid,
    'submitted',
    'submitted',
    coalesce(v_note, 'RMA submitted'),
    true,
    'customer_submit',
    v_idempotency_key,
    jsonb_build_object(
      'customer_visible', true,
      'policy_scope', 'legacy_unverified',
      'attachment_count', v_attachment_count
    )
  );

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
    v_auth_uid,
    v_auth_uid,
    'customer',
    'rma_submitted',
    'RMA submitted',
    format('Your RMA %s was submitted for review.', v_rma_no),
    format('/rma/%s', v_rma_id),
    'rma_requests',
    v_rma_id::text,
    v_rma_id,
    'customer_submit',
    jsonb_build_object('rma_no', v_rma_no)
  );

  return v_rma_id;
end;
$$;

-- The v3 action function owns the lock and the action ledger. The legacy
-- function below keeps its historical 11-argument RPC shape and delegates to
-- this implementation, so existing admin callers receive the same safeguards.
create or replace function public.admin_perform_rma_action_v3(
  p_request_id uuid,
  p_action text,
  p_assigned_to uuid default null,
  p_customer_visible_note text default null,
  p_internal_note text default null,
  p_reason text default null,
  p_refund_amount numeric default null,
  p_quantity integer default null,
  p_batch_code text default null,
  p_supplier text default null,
  p_location text default null,
  p_idempotency_key text default null,
  p_replacement_order_id uuid default null
)
returns public.rma_requests
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_before public.rma_requests%rowtype;
  v_after public.rma_requests%rowtype;
  v_execution public.rma_action_executions%rowtype;
  v_line public.order_lines%rowtype;
  v_order public.orders%rowtype;
  v_replacement_order public.orders%rowtype;
  v_refund_request public.wallet_refund_requests%rowtype;
  v_assigned_to uuid;
  v_next_status text;
  v_resolution_action text;
  v_inventory_disposition text;
  v_event_type text := 'action_completed';
  v_event_note text := nullif(btrim(coalesce(p_customer_visible_note, p_reason, p_internal_note, '')), '');
  v_customer_visible boolean := false;
  v_refund_amount numeric(12, 2);
  v_refundable_amount numeric(12, 2);
  v_stock_quantity integer;
  v_sku_code text;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.is_staff()), false) then
    raise exception 'Only staff can process RMA actions' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'RMA request id is required' using errcode = '22023';
  end if;

  if v_action not in (
    'assign',
    'request_wallet_refund',
    'mark_received',
    'restock_return',
    'mark_scrapped',
    'supplier_return',
    'mark_replacement_sent',
    'close'
  ) then
    raise exception 'Invalid RMA action %', p_action using errcode = '23514';
  end if;

  if v_action = 'request_wallet_refund' then
    if not (
      coalesce((select private.partspro_has_permission('rma.refund')), false)
      or coalesce((select private.partspro_has_permission('wallet_refunds.request')), false)
    ) then
      raise exception 'RMA refund permission required' using errcode = '42501';
    end if;
  elsif v_action in ('mark_received', 'restock_return', 'mark_scrapped', 'supplier_return') then
    if not (
      coalesce((select private.partspro_has_permission('rma.inventory')), false)
      or coalesce((select private.partspro_has_permission('product.adjust_stock')), false)
      or coalesce((select private.partspro_has_permission('inventory.manage')), false)
    ) then
      raise exception 'RMA inventory permission required' using errcode = '42501';
    end if;
  else
    if not (
      coalesce((select private.partspro_has_permission('rma.manage')), false)
      or coalesce((select private.partspro_has_permission('orders.manage')), false)
    ) then
      raise exception 'RMA manage permission required' using errcode = '42501';
    end if;
  end if;

  select *
  into v_before
  from public.rma_requests as r
  where r.id = p_request_id
  for update;

  if v_before.id is null then
    raise exception 'RMA request not found' using errcode = 'P0002';
  end if;

  v_idempotency_key := coalesce(
    v_idempotency_key,
    format('legacy:%s:%s', v_action, v_before.id)
  );

  if length(v_idempotency_key) not between 8 and 160 then
    raise exception 'Invalid RMA action idempotency key' using errcode = '23514';
  end if;

  select *
  into v_execution
  from public.rma_action_executions as e
  where e.rma_request_id = v_before.id
    and e.action = v_action
    and e.idempotency_key = v_idempotency_key
  for update;

  if v_execution.id is not null then
    if v_execution.execution_status = 'succeeded' then
      return v_before;
    end if;

    if v_execution.execution_status = 'started' then
      raise exception 'RMA action is already executing' using errcode = '55P03';
    end if;
  end if;

  if v_action in ('restock_return', 'mark_scrapped', 'supplier_return')
    and exists (
      select 1
      from public.rma_action_executions as e
      where e.rma_request_id = v_before.id
        and e.action in ('restock_return', 'mark_scrapped', 'supplier_return')
        and e.execution_status = 'succeeded'
    )
  then
    raise exception 'RMA inventory disposition has already been completed' using errcode = '23505';
  end if;

  insert into public.rma_action_executions (
    rma_request_id,
    action,
    idempotency_key,
    actor_id,
    execution_status,
    result
  )
  values (
    v_before.id,
    v_action,
    v_idempotency_key,
    v_auth_uid,
    'started',
    '{}'::jsonb
  )
  returning * into v_execution;

  select *
  into v_line
  from public.order_lines as ol
  where ol.id = v_before.order_line_id;

  if v_line.id is not null then
    select *
    into v_order
    from public.orders as o
    where o.id = v_line.order_id;
  elsif v_before.order_id is not null then
    select *
    into v_order
    from public.orders as o
    where o.id = v_before.order_id;
  elsif nullif(btrim(coalesce(v_before.order_no, '')), '') is not null then
    select *
    into v_order
    from public.orders as o
    where o.order_no = v_before.order_no;
  end if;

  v_next_status := v_before.status;
  v_resolution_action := v_before.resolution_action;
  v_inventory_disposition := coalesce(v_before.inventory_disposition, 'pending');
  v_sku_code := coalesce(v_line.sku_code, v_before.sku_code);

  if v_action = 'assign' then
    v_assigned_to := coalesce(p_assigned_to, v_auth_uid);
    v_event_type := 'assigned';
    v_event_note := coalesce(v_event_note, 'RMA assigned');

  elsif v_action = 'mark_received' then
    if v_before.status not in ('submitted', 'under_review', 'approved') then
      raise exception 'RMA can only be received from an active review state' using errcode = '23514';
    end if;

    v_stock_quantity := coalesce(p_quantity, v_before.quantity);
    if v_stock_quantity < 1 or v_stock_quantity > v_before.quantity then
      raise exception 'Invalid received RMA quantity' using errcode = '23514';
    end if;

    v_next_status := 'received';
    v_inventory_disposition := 'quarantine';
    v_event_type := 'quarantine_recorded';
    v_event_note := coalesce(v_event_note, 'Returned item received into quarantine');
    v_customer_visible := true;

    insert into public.stock_movements (
      sku_code,
      order_id,
      order_line_id,
      movement_type,
      quantity,
      actor_id,
      rma_request_id,
      rma_action_execution_id,
      source_type,
      metadata
    )
    values (
      coalesce(v_sku_code, 'RMA-UNKNOWN'),
      v_order.id,
      v_before.order_line_id,
      'rma_quarantine',
      v_stock_quantity,
      v_auth_uid,
      v_before.id,
      v_execution.id,
      'rma_receive',
      jsonb_build_object('available_qty_delta', 0, 'disposition', 'quarantine')
    );

  elsif v_action = 'request_wallet_refund' then
    if v_order.id is null or v_order.customer_id is null then
      raise exception 'RMA order could not be resolved for wallet refund' using errcode = '23503';
    end if;

    if v_before.status not in ('submitted', 'under_review', 'approved', 'received') then
      raise exception 'RMA is not eligible for a wallet refund request in its current state' using errcode = '23514';
    end if;

    v_refund_amount := round(coalesce(nullif(p_refund_amount, 0), nullif(v_before.refund_amount, 0)), 2);
    if v_refund_amount is null or v_refund_amount <= 0 then
      raise exception 'Refund amount must be explicitly confirmed before requesting a wallet refund' using errcode = '23514';
    end if;

    v_refundable_amount := coalesce(private.order_wallet_refundable_amount(v_order.id), 0);
    if v_refund_amount > v_refundable_amount then
      raise exception 'Refund amount exceeds the order refundable balance' using errcode = '22003';
    end if;

    if v_before.wallet_refund_request_id is not null then
      raise exception 'RMA wallet refund request already exists' using errcode = '23505';
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
      rma_request_id,
      rma_action_execution_id,
      metadata
    )
    values (
      v_order.customer_id,
      v_order.id,
      v_before.order_line_id,
      'rma_return',
      v_refund_amount,
      coalesce(nullif(btrim(p_reason), ''), 'RMA wallet refund'),
      v_auth_uid,
      concat('rma-return:', v_before.id::text, ':', v_idempotency_key),
      v_before.id,
      v_execution.id,
      jsonb_build_object(
        'source', 'rma_admin_action_v3',
        'rma_request_id', v_before.id,
        'requested_amount', v_refund_amount,
        'amount_scope', 'explicit_line_amount_only',
        'tax_and_shipping_included', false
      )
    )
    on conflict (idempotency_key) do update
      set updated_at = public.wallet_refund_requests.updated_at
    returning * into v_refund_request;

    v_next_status := case
      when v_before.status in ('submitted', 'under_review') then 'approved'
      else v_before.status
    end;
    v_resolution_action := 'refund_wallet';
    v_event_type := 'refund_requested';
    v_event_note := coalesce(v_event_note, 'Wallet refund request created');
    v_customer_visible := true;

  elsif v_action = 'restock_return' then
    if v_before.status <> 'received' or v_inventory_disposition <> 'quarantine' then
      raise exception 'RMA must be received and quarantined before restock' using errcode = '23514';
    end if;

    if not coalesce((select private.partspro_has_permission('product.adjust_stock')), false) then
      raise exception 'Restock requires product.adjust_stock permission' using errcode = '42501';
    end if;

    v_stock_quantity := coalesce(p_quantity, coalesce(v_before.received_quantity, v_before.quantity));
    if v_stock_quantity < 1 or v_stock_quantity > coalesce(v_before.received_quantity, v_before.quantity) then
      raise exception 'Invalid RMA restock quantity' using errcode = '23514';
    end if;

    if v_sku_code is null then
      raise exception 'RMA has no SKU to restock' using errcode = '23503';
    end if;

    perform private.admin_adjust_product_stock(
      v_sku_code,
      'rma_return',
      v_stock_quantity,
      coalesce(nullif(btrim(p_reason), ''), 'RMA returned item restocked'),
      p_location,
      p_batch_code,
      p_supplier
    );

    insert into public.stock_movements (
      sku_code,
      order_id,
      order_line_id,
      movement_type,
      quantity,
      actor_id,
      rma_request_id,
      rma_action_execution_id,
      source_type,
      metadata
    )
    values (
      v_sku_code,
      v_order.id,
      v_before.order_line_id,
      'rma_restock',
      v_stock_quantity,
      v_auth_uid,
      v_before.id,
      v_execution.id,
      'rma_restock',
      jsonb_build_object('available_qty_delta', v_stock_quantity, 'disposition', 'restock')
    );

    v_resolution_action := 'return_to_stock';
    v_inventory_disposition := 'restock';
    v_next_status := case
      when v_before.wallet_refund_request_id is null then 'closed'
      else v_before.status
    end;
    v_event_type := 'stock_adjusted';
    v_event_note := coalesce(v_event_note, 'Returned item restocked once');

  elsif v_action in ('mark_scrapped', 'supplier_return') then
    if v_before.status <> 'received' or v_inventory_disposition <> 'quarantine' then
      raise exception 'RMA must be received and quarantined before inventory disposition' using errcode = '23514';
    end if;

    v_stock_quantity := coalesce(p_quantity, coalesce(v_before.received_quantity, v_before.quantity));
    if v_stock_quantity < 1 or v_stock_quantity > coalesce(v_before.received_quantity, v_before.quantity) then
      raise exception 'Invalid RMA disposition quantity' using errcode = '23514';
    end if;

    insert into public.stock_movements (
      sku_code,
      order_id,
      order_line_id,
      movement_type,
      quantity,
      actor_id,
      rma_request_id,
      rma_action_execution_id,
      source_type,
      metadata
    )
    values (
      coalesce(v_sku_code, 'RMA-UNKNOWN'),
      v_order.id,
      v_before.order_line_id,
      'rma_disposition',
      v_stock_quantity,
      v_auth_uid,
      v_before.id,
      v_execution.id,
      case when v_action = 'mark_scrapped' then 'rma_scrap' else 'rma_supplier_return' end,
      jsonb_build_object(
        'available_qty_delta', 0,
        'disposition', case when v_action = 'mark_scrapped' then 'scrap' else 'supplier_return' end,
        'supplier', p_supplier
      )
    );

    v_resolution_action := case when v_action = 'mark_scrapped' then 'scrap' else 'supplier_return' end;
    v_inventory_disposition := case when v_action = 'mark_scrapped' then 'scrap' else 'supplier_return' end;
    v_next_status := case
      when v_before.wallet_refund_request_id is null then 'closed'
      else v_before.status
    end;
    v_event_type := 'inventory_disposition';
    v_event_note := coalesce(v_event_note, 'RMA inventory disposition recorded from quarantine');

  elsif v_action = 'mark_replacement_sent' then
    if p_replacement_order_id is null then
      raise exception 'A shipped replacement order is required' using errcode = '23514';
    end if;

    select *
    into v_replacement_order
    from public.orders as o
    where o.id = p_replacement_order_id;

    if v_replacement_order.id is null
      or v_replacement_order.status <> 'shipped'
      or v_replacement_order.customer_id is distinct from v_order.customer_id
    then
      raise exception 'Replacement order must belong to the same customer and be shipped' using errcode = '23514';
    end if;

    if v_before.status not in ('approved', 'received') then
      raise exception 'RMA is not ready to mark a replacement as shipped' using errcode = '23514';
    end if;

    v_next_status := 'replacement_sent';
    v_resolution_action := 'replacement';
    v_event_type := 'replacement_sent';
    v_event_note := coalesce(v_event_note, 'Replacement order shipped');
    v_customer_visible := true;

  elsif v_action = 'close' then
    if v_before.status = 'received' and v_inventory_disposition not in ('restock', 'scrap', 'supplier_return') then
      raise exception 'Received RMA requires a completed inventory disposition before closing' using errcode = '23514';
    end if;

    if v_before.status not in ('approved', 'received', 'rejected', 'refunded', 'replacement_sent', 'closed') then
      raise exception 'RMA cannot be closed in its current state' using errcode = '23514';
    end if;

    v_next_status := 'closed';
    v_event_type := 'closed';
    v_event_note := coalesce(v_event_note, 'RMA closed');
    v_customer_visible := true;
  end if;

  update public.rma_requests
  set status = v_next_status,
      customer_visible_note = coalesce(nullif(btrim(p_customer_visible_note), ''), customer_visible_note),
      internal_note = coalesce(nullif(btrim(p_internal_note), ''), internal_note),
      assigned_to = case when v_action = 'assign' then v_assigned_to else assigned_to end,
      assigned_by = case when v_action = 'assign' then v_auth_uid else assigned_by end,
      assigned_at = case when v_action = 'assign' then now() else assigned_at end,
      reviewed_at = case
        when v_next_status in ('under_review', 'approved', 'rejected') and reviewed_at is null then now()
        else reviewed_at
      end,
      reviewed_by = case
        when v_action <> 'assign' then v_auth_uid
        else reviewed_by
      end,
      received_at = case when v_action = 'mark_received' then coalesce(received_at, now()) else received_at end,
      received_quantity = case when v_action = 'mark_received' then v_stock_quantity else received_quantity end,
      received_by = case when v_action = 'mark_received' then v_auth_uid else received_by end,
      resolved_at = case
        when v_next_status in ('replacement_sent', 'refunded', 'closed', 'rejected') then coalesce(resolved_at, now())
        else resolved_at
      end,
      closed_at = case when v_next_status = 'closed' then coalesce(closed_at, now()) else closed_at end,
      resolution_action = v_resolution_action,
      inventory_disposition = v_inventory_disposition,
      wallet_refund_request_id = coalesce(v_refund_request.id, wallet_refund_request_id),
      refund_amount = case when v_action = 'request_wallet_refund' then v_refund_amount else refund_amount end,
      refund_method = case when v_action = 'request_wallet_refund' then 'wallet_credit' else refund_method end,
      refund_currency = case when v_action = 'request_wallet_refund' then 'EUR' else refund_currency end,
      refund_net_amount = case when v_action = 'request_wallet_refund' then v_refund_amount else refund_net_amount end,
      replacement_order_id = case when v_action = 'mark_replacement_sent' then p_replacement_order_id else replacement_order_id end,
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
    v_event_type,
    v_before.status,
    v_after.status,
    coalesce(v_event_note, 'RMA action completed'),
    v_customer_visible,
    v_action,
    v_idempotency_key,
    v_execution.id,
    jsonb_build_object(
      'action', v_action,
      'customer_visible', v_customer_visible,
      'inventory_disposition', v_after.inventory_disposition,
      'wallet_refund_request_id', v_after.wallet_refund_request_id,
      'replacement_order_id', v_after.replacement_order_id,
      'quantity', case when v_action in ('mark_received', 'restock_return', 'mark_scrapped', 'supplier_return') then v_stock_quantity else null end,
      'tax_and_shipping_included', false
    )
  );

  if v_customer_visible and v_after.user_id is not null then
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
      v_after.user_id,
      v_auth_uid,
      'customer',
      'rma_status_updated',
      'RMA status updated',
      left(coalesce(v_event_note, format('RMA %s status updated.', coalesce(v_after.rma_no, v_after.id::text))), 240),
      format('/rma/%s', v_after.id),
      'rma_requests',
      v_after.id::text,
      v_after.id,
      v_action,
      jsonb_build_object('rma_no', v_after.rma_no, 'status', v_after.status)
    );
  end if;

  update public.rma_action_executions
  set execution_status = 'succeeded',
      result = jsonb_build_object(
        'rma_request_id', v_after.id,
        'status', v_after.status,
        'inventory_disposition', v_after.inventory_disposition
      ),
      updated_at = now()
  where id = v_execution.id;

  return v_after;
end;
$$;

create or replace function public.admin_perform_rma_action(
  p_request_id uuid,
  p_action text,
  p_assigned_to uuid default null,
  p_customer_visible_note text default null,
  p_internal_note text default null,
  p_reason text default null,
  p_refund_amount numeric default null,
  p_quantity integer default null,
  p_batch_code text default null,
  p_supplier text default null,
  p_location text default null
)
returns public.rma_requests
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_result public.rma_requests;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into v_result
  from public.admin_perform_rma_action_v3(
    p_request_id,
    p_action,
    p_assigned_to,
    p_customer_visible_note,
    p_internal_note,
    p_reason,
    p_refund_amount,
    p_quantity,
    p_batch_code,
    p_supplier,
    p_location,
    null,
    null
  );

  return v_result;
end;
$$;

revoke all on function private.rma_attachment_extension(text)
  from public, anon, authenticated;

revoke all on function public.rma_create_draft(uuid, text)
  from public, anon;
grant execute on function public.rma_create_draft(uuid, text)
  to authenticated;

revoke all on function public.rma_prepare_attachment_upload(uuid, text, text, bigint)
  from public, anon;
grant execute on function public.rma_prepare_attachment_upload(uuid, text, text, bigint)
  to authenticated;

revoke all on function public.rma_complete_attachment(uuid, text, bigint, uuid)
  from public, anon;
grant execute on function public.rma_complete_attachment(uuid, text, bigint, uuid)
  to authenticated;

revoke all on function public.rma_submit_request(uuid, uuid, integer, text, text, text, uuid[], text)
  from public, anon;
grant execute on function public.rma_submit_request(uuid, uuid, integer, text, text, text, uuid[], text)
  to authenticated;

revoke all on function public.admin_perform_rma_action_v3(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  numeric,
  integer,
  text,
  text,
  text,
  text,
  uuid
) from public, anon;
grant execute on function public.admin_perform_rma_action_v3(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  numeric,
  integer,
  text,
  text,
  text,
  text,
  uuid
) to authenticated;

revoke all on function public.admin_perform_rma_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  numeric,
  integer,
  text,
  text,
  text
) from public, anon;
grant execute on function public.admin_perform_rma_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  numeric,
  integer,
  text,
  text,
  text
) to authenticated;
