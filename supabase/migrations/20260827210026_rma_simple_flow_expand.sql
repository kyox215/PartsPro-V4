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
  add column if not exists unit_price_snapshot numeric(12, 2),
  add column if not exists refund_approved_quantity integer,
  add column if not exists replacement_quantity integer,
  add column if not exists inventory_disposition_quantity integer,
  add column if not exists replacement_order_id uuid references public.orders(id) on delete set null,
  add column if not exists idempotency_key text,
  add column if not exists submit_payload_fingerprint text;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_policy_scope_check'
  ) then
    alter table public.rma_requests drop constraint rma_requests_policy_scope_check;
  end if;

  alter table public.rma_requests
    add constraint rma_requests_policy_scope_check
    check (policy_scope in (
      'legacy_unverified',
      'statutory_b2c_withdrawal',
      'b2c_statutory_withdrawal',
      'b2c_warranty',
      'b2b_commercial'
    ));

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
      and conname = 'rma_requests_replacement_quantity_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_replacement_quantity_check
      check (replacement_quantity is null or (replacement_quantity >= 1 and replacement_quantity <= quantity));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_submit_payload_fingerprint_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_submit_payload_fingerprint_check
      check (submit_payload_fingerprint is null or submit_payload_fingerprint ~ '^[a-f0-9]{32,64}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_unit_price_snapshot_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_unit_price_snapshot_check
      check (unit_price_snapshot is null or unit_price_snapshot >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_refund_approved_quantity_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_refund_approved_quantity_check
      check (refund_approved_quantity is null or (refund_approved_quantity >= 0 and refund_approved_quantity <= quantity));
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
      and conname = 'rma_requests_inventory_disposition_quantity_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_inventory_disposition_quantity_check
      check (
        inventory_disposition_quantity is null
        or (inventory_disposition_quantity >= 1 and inventory_disposition_quantity <= quantity)
      );
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

create unique index if not exists rma_requests_replacement_order_unique
  on public.rma_requests (replacement_order_id)
  where replacement_order_id is not null;

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
    'statutory_b2c_withdrawal',
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

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_drafts'::regclass
      and conname = 'rma_drafts_policy_scope_check'
  ) then
    alter table public.rma_drafts drop constraint rma_drafts_policy_scope_check;
  end if;

  alter table public.rma_drafts
    add constraint rma_drafts_policy_scope_check
    check (policy_scope in (
      'legacy_unverified',
      'statutory_b2c_withdrawal',
      'b2c_statutory_withdrawal',
      'b2c_warranty',
      'b2b_commercial'
    ));
end
$$;

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
  constraint rma_attachments_status_check check (status in ('pending', 'verified', 'committed', 'rejected', 'expired', 'cancelled')),
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
  payload_fingerprint text not null default md5(''),
  actor_id uuid not null references auth.users(id) on delete restrict,
  execution_status text not null default 'started',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rma_action_executions_status_check check (execution_status in ('started', 'succeeded', 'failed')),
  constraint rma_action_executions_result_object_check check (jsonb_typeof(result) = 'object'),
  constraint rma_action_executions_idempotency_key_length check (length(btrim(idempotency_key)) between 8 and 160),
  constraint rma_action_executions_payload_fingerprint_check check (length(payload_fingerprint) between 1 and 64),
  constraint rma_action_executions_unique_key unique (rma_request_id, action, idempotency_key)
);

alter table public.rma_action_executions
  add column if not exists payload_fingerprint text not null default md5('');

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_attachments'::regclass
      and conname = 'rma_attachments_status_check'
  ) then
    alter table public.rma_attachments drop constraint rma_attachments_status_check;
  end if;

  alter table public.rma_attachments
    add constraint rma_attachments_status_check
    check (status in ('pending', 'verified', 'committed', 'rejected', 'expired', 'cancelled'));
end
$$;

create unique index if not exists rma_action_executions_terminal_disposition_unique
  on public.rma_action_executions (rma_request_id)
  where execution_status = 'succeeded'
    and action in ('restock_return', 'mark_scrapped', 'supplier_return');

-- The action ledger makes commercial settlement and QC exactly-once even when
-- two admin tabs use different idempotency keys. A replacement and a wallet
-- outcome can never both succeed for one RMA.
create unique index if not exists rma_action_executions_commercial_outcome_unique
  on public.rma_action_executions (rma_request_id)
  where execution_status = 'succeeded'
    and action in ('request_wallet_refund', 'mark_replacement_sent');

create unique index if not exists rma_action_executions_qc_unique
  on public.rma_action_executions (rma_request_id)
  where execution_status = 'succeeded'
    and action = 'record_qc';

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

create unique index if not exists wallet_refund_requests_rma_return_active_unique
  on public.wallet_refund_requests (rma_request_id)
  where rma_request_id is not null
    and request_type = 'rma_return'
    and status in ('pending', 'approved');

-- Migration A deliberately does not alter storage.buckets. The existing
-- rma-evidence bucket remains private with its historical 20 MiB image/video
-- allowance for the legacy bridge. The new RPCs enforce 4 MiB/images; bucket
-- tightening is a separately gated Migration B change.

-- The historical trigger reads a JSON metadata rma_request_id. Keep it for
-- order_void/order_line_shortage requests, but make rma_return use the new
-- relation-aware sync trigger below exactly once.
drop trigger if exists wallet_refund_requests_sync_rma_status
  on public.wallet_refund_requests;
create trigger wallet_refund_requests_sync_rma_status
  after update of status
  on public.wallet_refund_requests
  for each row
  when (new.request_type <> 'rma_return')
  execute function private.sync_rma_wallet_refund_status();

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
      'qc_recorded',
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
comment on column public.rma_requests.inventory_disposition_quantity is
  'V1 records one complete inventory disposition per RMA; split quantity ledgers are deferred.';

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

-- The order-line returnable quantity is one shared compatibility rule. Older
-- shipped rows may have fulfilled_qty = 0, so they fall back to the net
-- ordered quantity; once fulfillment is recorded, never exceed that amount.
create or replace function private.rma_order_line_returnable_quantity(
  p_order_line_id uuid
)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
  select case
    when coalesce(ol.fulfilled_qty, 0) > 0 then least(
      greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0),
      coalesce(ol.fulfilled_qty, 0)
    )
    else greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0)
  end
  from public.order_lines as ol
  where ol.id = p_order_line_id
$$;

-- Customer ownership is deliberately explicit and shared by draft + submit.
-- A normal customer needs an active membership; orders.user_id is only a
-- historical field and must never grant access. Employees use only their
-- employee_self profile and never inherit a customer membership.
create or replace function private.rma_user_can_access_order(
  p_auth_uid uuid,
  p_customer_id uuid,
  p_order_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_account_type text;
  v_profile_customer_id uuid;
begin
  if p_auth_uid is null or p_customer_id is null or p_order_id is null then
    return false;
  end if;

  select coalesce(p.account_type, 'customer'), p.customer_id
  into v_account_type, v_profile_customer_id
  from public.profiles as p
  where p.id = p_auth_uid;

  if v_account_type = 'employee' then
    return exists (
      select 1
      from public.orders as o
      join public.customers as c on c.id = o.customer_id
      where o.id = p_order_id
        and o.customer_id = p_customer_id
        and c.id = p_customer_id
        and c.id = v_profile_customer_id
        and c.user_id = p_auth_uid
        and c.profile_kind = 'employee_self'
        and c.status = 'active'
    );
  end if;

  return exists (
    select 1
    from public.orders as o
    join public.customers as c on c.id = o.customer_id
    join public.customer_memberships as cm on cm.customer_id = c.id
    where o.id = p_order_id
      and o.customer_id = p_customer_id
      and c.id = p_customer_id
      and c.status = 'active'
      and coalesce(c.profile_kind, 'customer') = 'customer'
      and cm.user_id = p_auth_uid
      and cm.status = 'active'
      and v_account_type = 'customer'
  );
end;
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
  v_customer public.customers%rowtype;
  v_draft_id uuid;
  v_idempotency_key text := nullif(btrim(p_idempotency_key), '');
  v_open_draft_count integer;
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

  if v_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      format('rma-draft-user:%s:%s', v_auth_uid, v_idempotency_key),
      0
    ));
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
  where o.id = v_line.order_id;

  if v_order.id is null then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  v_customer_id := v_order.customer_id;

  select *
  into v_customer
  from public.customers as c
  where c.id = v_customer_id;

  if v_customer.id is null or v_customer.status <> 'active' then
    raise exception 'Inactive customers cannot start an RMA' using errcode = '42501';
  end if;

  if v_order.status not in ('shipped', 'completed', 'delivered') then
    raise exception 'RMA is available only for shipped, completed, or delivered orders' using errcode = '23514';
  end if;

  if not private.rma_user_can_access_order(v_auth_uid, v_customer_id, v_order.id) then
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
        raise exception 'Draft idempotency key is bound to another order line' using errcode = 'P0001';
      end if;
      return v_existing.id;
    end if;
  end if;

  select count(*)
  into v_open_draft_count
  from public.rma_drafts as d
  where d.user_id = v_auth_uid
    and d.status = 'open';

  if v_open_draft_count >= 10 then
    raise exception 'Too many open RMA drafts; cancel or submit an existing draft first' using errcode = '22003';
  end if;

  insert into public.rma_drafts (
    user_id,
    customer_id,
    order_id,
    order_line_id,
    policy_scope,
    policy_version,
    idempotency_key
  )
  values (
    v_auth_uid,
    v_customer_id,
    v_order.id,
    v_line.id,
    'b2b_commercial',
    'partspro-b2b-v1',
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
  v_user_active_count integer;
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

  -- Serialize all open drafts for this user, expire stale rows first, then
  -- count only active, unexpired attachments. This is the 24-file quota lock.
  perform pg_advisory_xact_lock(hashtextextended(format('rma-upload-user:%s', v_auth_uid), 0));

  update public.rma_attachments as a
  set status = 'expired',
      updated_at = now()
  from public.rma_drafts as d
  where d.id = a.draft_id
    and a.user_id = v_auth_uid
    and d.status = 'open'
    and a.status in ('pending', 'verified')
    and a.expires_at <= now();

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
    and a.status in ('pending', 'verified', 'committed')
    and a.expires_at > now();

  if v_existing_count >= 6 then
    raise exception 'An RMA draft can contain at most six images' using errcode = '22003';
  end if;

  select count(*)
  into v_user_active_count
  from public.rma_attachments as a
  join public.rma_drafts as d on d.id = a.draft_id
  where a.user_id = v_auth_uid
    and d.status = 'open'
    and a.status in ('pending', 'verified', 'committed')
    and a.expires_at > now();

  if v_user_active_count >= 24 then
    raise exception 'This account has reached the active RMA image limit' using errcode = '22003';
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

  select a.*
  into v_attachment
  from public.rma_attachments as a
  join public.rma_drafts as d on d.id = a.draft_id
  where a.id = p_attachment_id
    and a.user_id = v_auth_uid
    and d.user_id = v_auth_uid
    and d.status = 'open'
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
    -- Do not UPDATE then RAISE: PostgreSQL rolls that update back. The
    -- caller can invoke rma_cancel_attachment to release the quota, while a
    -- later GC marks stale pending rows expired.
    raise exception 'RMA attachment upload ticket expired; cancel it before retrying' using errcode = '57014';
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

create or replace function public.rma_cancel_attachment(
  p_attachment_id uuid,
  p_draft_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_attachment public.rma_attachments%rowtype;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select a.*
  into v_attachment
  from public.rma_attachments as a
  join public.rma_drafts as d on d.id = a.draft_id
  where a.id = p_attachment_id
    and a.user_id = v_auth_uid
    and (p_draft_id is null or a.draft_id = p_draft_id)
    and d.user_id = v_auth_uid
    and d.status = 'open'
  for update;

  if v_attachment.id is null then
    raise exception 'RMA attachment not found' using errcode = 'P0002';
  end if;

  if v_attachment.status = 'committed' then
    raise exception 'Committed RMA attachments cannot be cancelled' using errcode = '23514';
  end if;

  if v_attachment.status <> 'cancelled' then
    update public.rma_attachments
    set status = 'cancelled',
        updated_at = now()
    where id = v_attachment.id;
  end if;

  return true;
end;
$$;

-- Maintenance-only GC marks stale database rows and returns only the private
-- paths that a service-role worker may remove from Storage. No browser role
-- can execute it; scheduling the worker remains a separately gated task.
create or replace function public.rma_gc_expired_attachments(
  p_limit integer default 100
)
returns table(attachment_id uuid, bucket text, storage_path text)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if (select auth.uid()) is not null then
    raise exception 'RMA attachment GC is maintenance-only' using errcode = '42501';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid RMA attachment GC limit' using errcode = '22023';
  end if;

  return query
  with stale as (
    select a.id
    from public.rma_attachments as a
    join public.rma_drafts as d on d.id = a.draft_id
    where a.status in ('pending', 'verified')
      and a.rma_request_id is null
      and a.expires_at <= now()
      and d.status in ('open', 'submitted', 'abandoned', 'expired')
    order by a.expires_at asc, a.created_at asc
    limit p_limit
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
  v_order_line_returnable_quantity integer;
  v_reason text := nullif(lower(btrim(coalesce(p_reason_code, ''))), '');
  v_resolution text := lower(btrim(coalesce(p_requested_resolution, '')));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_policy_scope text;
  v_attachment_fingerprint text;
  v_payload_fingerprint text;
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

  if v_attachment_count <> (
    select count(distinct attachment_id)::integer
    from unnest(coalesce(p_attachment_ids, '{}'::uuid[])) as attachment_id
  ) then
    raise exception 'RMA attachment IDs must be unique' using errcode = '23514';
  end if;

  select coalesce(string_agg(attachment_id::text, ',' order by attachment_id::text), '')
  into v_attachment_fingerprint
  from (
    select distinct attachment_id
    from unnest(coalesce(p_attachment_ids, '{}'::uuid[])) as attachment_id
  ) as attachment_ids;

  v_payload_fingerprint := md5(concat_ws(
    chr(31),
    p_draft_id::text,
    p_order_line_id::text,
    p_quantity::text,
    coalesce(v_reason, ''),
    v_resolution,
    coalesce(v_note, ''),
    v_attachment_fingerprint
  ));

  -- Serialise same-user retries before reading the idempotency row. This
  -- converts concurrent duplicate inserts into a deterministic replay or a
  -- typed payload conflict, never a raw unique-constraint error.
  perform pg_advisory_xact_lock(hashtextextended(
    format('rma-submit-user:%s:%s', v_auth_uid, v_idempotency_key),
    0
  ));

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

  if v_draft.status <> 'open'
    and not (v_draft.status = 'submitted' and v_draft.submitted_rma_id is not null)
  then
    raise exception 'RMA draft is no longer open' using errcode = '23514';
  end if;

  v_policy_scope := v_draft.policy_scope;
  if v_reason is null then
    if v_policy_scope <> 'statutory_b2c_withdrawal' then
      raise exception 'A reason is required unless the draft is a statutory B2C withdrawal' using errcode = '22023';
    end if;
  elsif v_reason not in (
    'quality_defect',
    'shipping_damage',
    'not_as_described',
    'wrong_item',
    'missing_or_quantity_error',
    'withdrawal_no_longer_needed'
  ) then
    raise exception 'Invalid RMA reason code' using errcode = '22023';
  end if;

  if v_draft.status = 'submitted' and v_draft.submitted_rma_id is not null then
    select *
    into v_existing
    from public.rma_requests as r
    where r.id = v_draft.submitted_rma_id
    for update;

    if v_existing.id is null
      or v_existing.submit_payload_fingerprint is distinct from v_payload_fingerprint
    then
      raise exception 'RMA draft is already submitted with a different payload' using errcode = 'P0001';
    end if;
    return v_draft.submitted_rma_id;
  end if;

  select *
  into v_existing
  from public.rma_requests as r
  where r.user_id = v_auth_uid
    and r.idempotency_key = v_idempotency_key
  for update;

  if v_existing.id is not null then
    if v_existing.submit_payload_fingerprint is distinct from v_payload_fingerprint
      or v_existing.order_line_id <> p_order_line_id
      or v_existing.quantity <> p_quantity
      or v_existing.reason_code is distinct from v_reason
      or v_existing.requested_resolution <> v_resolution
    then
      raise exception 'RMA idempotency key is bound to a different request' using errcode = 'P0001';
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

  if v_draft.order_id is distinct from v_order.id
    or v_draft.customer_id is distinct from v_order.customer_id
  then
    raise exception 'RMA draft ownership snapshot does not match the order line' using errcode = '42501';
  end if;

  v_customer_id := v_order.customer_id;

  if v_order.status not in ('shipped', 'completed', 'delivered') then
    raise exception 'RMA is available only for shipped, completed, or delivered orders' using errcode = '23514';
  end if;

  select *
  into v_customer
  from public.customers as c
  where c.id = v_customer_id;

  if v_customer.id is null or v_customer.status <> 'active' then
    raise exception 'Inactive customers cannot submit an RMA' using errcode = '42501';
  end if;

  if not private.rma_user_can_access_order(v_auth_uid, v_customer_id, v_order.id) then
    raise exception 'Order line does not belong to the authenticated customer' using errcode = '42501';
  end if;

  -- v_line is already locked above. Use the same net quantity helper as the
  -- historical trigger and refund guards so fulfilled/cancelled lines cannot
  -- drift into a different RMA eligibility calculation.
  v_order_line_returnable_quantity := private.rma_order_line_returnable_quantity(v_line.id);
  if coalesce(v_order_line_returnable_quantity, 0) < 1 then
    raise exception 'No quantity remains eligible for this order line' using errcode = '22003';
  end if;

  select coalesce(sum(r.quantity), 0)
  into v_requested_count
  from public.rma_requests as r
  where r.order_line_id = v_line.id
    and r.status <> 'rejected';

  if p_quantity + v_requested_count > v_order_line_returnable_quantity then
    raise exception 'RMA quantity exceeds the remaining order-line quantity' using errcode = '22003';
  end if;

  select count(*)
  into v_eligible_count
  from public.rma_attachments as a
  where a.id = any(coalesce(p_attachment_ids, '{}'))
    and a.draft_id = v_draft.id
    and a.user_id = v_auth_uid
    and a.customer_id = v_customer_id
    and a.order_line_id = v_line.id
    and a.rma_request_id is null
    and a.status = 'verified';

  if v_eligible_count <> v_attachment_count then
    raise exception 'Every submitted RMA image must be a verified attachment from this draft' using errcode = '42501';
  end if;

  if v_attachment_count < 1
    and not (
      v_policy_scope = 'statutory_b2c_withdrawal'
      and (v_reason is null or v_reason = 'withdrawal_no_longer_needed')
    )
  then
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
    unit_price_snapshot,
    idempotency_key,
    submit_payload_fingerprint,
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
    v_policy_scope,
    case
      when v_policy_scope = 'b2b_commercial' then coalesce(v_draft.policy_version, 'partspro-b2b-v1')
      else v_draft.policy_version
    end,
    null,
    v_line.unit_price,
    v_idempotency_key,
    v_payload_fingerprint,
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
      'policy_scope', v_policy_scope,
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
    format('/rma?requestId=%s', v_rma_id),
    'rma_requests',
    v_rma_id::text,
    v_rma_id,
    'customer_submit',
    jsonb_build_object('rma_no', v_rma_no)
  );

  return v_rma_id;
end;
$$;

-- Keep the historical PATCH endpoint usable, but make it review-only. Receipt,
-- QC, commercial outcomes, inventory dispositions and closing belong to v3.
create or replace function public.admin_update_rma_request(
  p_request_id uuid,
  p_status text default null,
  p_customer_visible_note text default null,
  p_internal_note text default null,
  p_lab_result text default null,
  p_resolution_note text default null,
  p_refund_amount numeric default null
)
returns public.rma_requests
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_before public.rma_requests%rowtype;
  v_after public.rma_requests%rowtype;
  v_next_status text;
  v_event_note text;
  v_customer_visible boolean := false;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('rma.manage')), false) then
    raise exception 'RMA manage permission required' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'RMA request id is required' using errcode = '23502';
  end if;

  if p_refund_amount is not null and p_refund_amount < 0 then
    raise exception 'Refund amount cannot be negative' using errcode = '23514';
  end if;

  select *
  into v_before
  from public.rma_requests as r
  where r.id = p_request_id
  for update;

  if v_before.id is null then
    raise exception 'RMA request not found' using errcode = 'P0002';
  end if;

  v_next_status := coalesce(nullif(btrim(p_status), ''), v_before.status);
  if v_next_status not in ('submitted', 'under_review', 'approved', 'rejected') then
    raise exception 'Review endpoint cannot change the RMA beyond approval' using errcode = '23514';
  end if;

  if v_next_status <> v_before.status
    and not (
      (v_before.status = 'submitted' and v_next_status = 'under_review')
      or (v_before.status = 'under_review' and v_next_status in ('approved', 'rejected'))
    )
  then
    raise exception 'Invalid RMA review transition from % to %', v_before.status, v_next_status using errcode = '23514';
  end if;

  v_customer_visible := v_before.status is distinct from v_next_status
    or nullif(btrim(coalesce(p_customer_visible_note, '')), '') is not null
    or nullif(btrim(coalesce(p_lab_result, '')), '') is not null
    or nullif(btrim(coalesce(p_resolution_note, '')), '') is not null;
  v_event_note := coalesce(
    nullif(btrim(coalesce(p_customer_visible_note, '')), ''),
    nullif(btrim(coalesce(p_resolution_note, '')), ''),
    nullif(btrim(coalesce(p_lab_result, '')), ''),
    nullif(btrim(coalesce(p_internal_note, '')), ''),
    ''
  );

  if p_refund_amount is not null then
    -- Keep the old RPC signature, but never let review PATCH confirm money.
    -- The amount is intentionally ignored; only the wallet/refund action can
    -- establish a payable result after receipt and QC.
    v_event_note := coalesce(
      nullif(v_event_note, ''),
      'Legacy review refund amount ignored; use the authorized refund action.'
    );
  end if;

  update public.rma_requests
  set status = v_next_status,
      customer_visible_note = coalesce(nullif(btrim(p_customer_visible_note), ''), customer_visible_note),
      internal_note = coalesce(nullif(btrim(p_internal_note), ''), internal_note),
      lab_result = coalesce(nullif(btrim(p_lab_result), ''), lab_result),
      resolution_note = coalesce(nullif(btrim(p_resolution_note), ''), resolution_note),
      reviewed_at = case when v_next_status in ('under_review', 'approved', 'rejected') then coalesce(reviewed_at, now()) else reviewed_at end,
      reviewed_by = case when v_next_status in ('under_review', 'approved', 'rejected') then v_auth_uid else reviewed_by end,
      updated_at = now()
  where id = v_before.id
  returning * into v_after;

  if v_before.status is distinct from v_after.status
    or v_event_note <> ''
    or p_refund_amount is not null
  then
    insert into public.rma_request_events (
      rma_request_id,
      actor_id,
      event_type,
      from_status,
      to_status,
      note,
      customer_visible,
      metadata
    )
    values (
      v_after.id,
      v_auth_uid,
      'status_changed',
      v_before.status,
      v_after.status,
      v_event_note,
      v_customer_visible,
      jsonb_build_object(
        'customer_visible', v_customer_visible,
        'review_only', true,
        'review_refund_amount_ignored', p_refund_amount is not null
      )
    );
  end if;

  return v_after;
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
  p_replacement_order_id uuid default null,
  p_qc_status text default null,
  p_qc_note text default null
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
  v_qc_status text := nullif(lower(btrim(coalesce(p_qc_status, ''))), '');
  v_payload_fingerprint text;
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
  v_line_unit_price numeric(12, 2);
  v_line_refund_cap numeric(12, 2);
  v_existing_refunded_amount numeric(12, 2);
  v_order_line_returnable_quantity integer;
  v_stock_quantity integer;
  v_replacement_quantity integer;
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
    'record_qc',
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
  elsif v_action = 'record_qc' then
    if not (
      coalesce((select private.partspro_has_permission('rma.manage')), false)
      or coalesce((select private.partspro_has_permission('rma.inventory')), false)
    ) then
      raise exception 'RMA QC permission required' using errcode = '42501';
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

  if v_action in (
    'mark_received',
    'request_wallet_refund',
    'restock_return',
    'mark_scrapped',
    'supplier_return',
    'mark_replacement_sent'
  ) then
    if p_quantity is not null and p_quantity <> v_before.quantity then
      raise exception 'RMA V1 actions must process the complete RMA quantity' using errcode = '22003';
    end if;
    v_stock_quantity := v_before.quantity;
  end if;

  v_idempotency_key := coalesce(
    v_idempotency_key,
    format('legacy:%s:%s', v_action, v_before.id)
  );

  if length(v_idempotency_key) not between 8 and 160 then
    raise exception 'Invalid RMA action idempotency key' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    format('rma-action:%s:%s:%s:%s', v_auth_uid, v_before.id, v_action, v_idempotency_key),
    0
  ));

  v_payload_fingerprint := md5(concat_ws(
    '|',
    v_action,
    coalesce(p_assigned_to::text, ''),
    coalesce(p_customer_visible_note, ''),
    coalesce(p_internal_note, ''),
    coalesce(p_reason, ''),
    coalesce(p_refund_amount::text, ''),
    coalesce(
      p_quantity::text,
      case
        when v_action in ('mark_received', 'request_wallet_refund', 'restock_return', 'mark_scrapped', 'supplier_return', 'mark_replacement_sent')
          then v_before.quantity::text
        else ''
      end
    ),
    coalesce(p_batch_code, ''),
    coalesce(p_supplier, ''),
    coalesce(p_location, ''),
    coalesce(p_replacement_order_id::text, ''),
    coalesce(v_qc_status, ''),
    coalesce(p_qc_note, '')
  ));

  select *
  into v_execution
  from public.rma_action_executions as e
  where e.rma_request_id = v_before.id
    and e.action = v_action
    and e.idempotency_key = v_idempotency_key
  for update;

  if v_execution.id is not null then
    if coalesce(v_execution.payload_fingerprint, '') <> v_payload_fingerprint then
      raise exception 'RMA action idempotency key was reused with a different payload' using errcode = 'P0001';
    end if;

    if v_execution.execution_status = 'succeeded' then
      return v_before;
    end if;

    if v_execution.execution_status = 'started' then
      raise exception 'RMA action is already executing' using errcode = '55P03';
    end if;

    if v_execution.execution_status = 'failed' then
      update public.rma_action_executions
      set execution_status = 'started',
          actor_id = v_auth_uid,
          updated_at = now()
      where id = v_execution.id;
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
    raise exception 'RMA inventory disposition has already been completed' using errcode = '23514';
  end if;

  if v_execution.id is null then
    insert into public.rma_action_executions (
    rma_request_id,
    action,
    idempotency_key,
    actor_id,
    payload_fingerprint,
    execution_status,
    result
  )
  values (
    v_before.id,
    v_action,
    v_idempotency_key,
    v_auth_uid,
    v_payload_fingerprint,
    'started',
    '{}'::jsonb
  )
    returning * into v_execution;
  end if;

  if v_action = 'record_qc' and v_before.qc_status <> 'pending' then
    raise exception 'RMA QC has already been recorded; use an explicit correction action in a future migration' using errcode = '23514';
  end if;

  select *
  into v_line
  from public.order_lines as ol
  where ol.id = v_before.order_line_id
  for update;

  if v_line.id is not null then
    select *
    into v_order
    from public.orders as o
    where o.id = v_line.order_id
    for update;
  elsif v_before.order_id is not null then
    select *
    into v_order
    from public.orders as o
    where o.id = v_before.order_id
    for update;
  elsif nullif(btrim(coalesce(v_before.order_no, '')), '') is not null then
    select *
    into v_order
    from public.orders as o
    where o.order_no = v_before.order_no
    for update;
  end if;

  v_next_status := v_before.status;
  v_resolution_action := v_before.resolution_action;
  v_inventory_disposition := coalesce(v_before.inventory_disposition, 'pending');
  v_sku_code := coalesce(v_line.sku_code, v_before.sku_code);

  if v_action = 'assign' then
    if v_before.status in ('closed', 'rejected') then
      raise exception 'Closed or rejected RMAs cannot be assigned' using errcode = '23514';
    end if;
    v_assigned_to := coalesce(p_assigned_to, v_auth_uid);
    v_event_type := 'assigned';
    v_event_note := coalesce(v_event_note, 'RMA assigned');

  elsif v_action = 'record_qc' then
    if v_before.status <> 'received' then
      raise exception 'QC can only be recorded after the RMA is received' using errcode = '23514';
    end if;

    if v_qc_status not in ('passed', 'failed', 'not_required') then
      raise exception 'QC status must be passed, failed, or not_required' using errcode = '23514';
    end if;

    v_event_type := 'qc_recorded';
    v_event_note := coalesce(nullif(btrim(p_qc_note), ''), 'RMA QC result recorded');
    v_customer_visible := false;

  elsif v_action = 'mark_received' then
    if v_before.status <> 'approved' then
      raise exception 'Only approved RMAs can be received' using errcode = '23514';
    end if;

    v_stock_quantity := v_before.quantity;
    if v_stock_quantity < 1 or v_stock_quantity <> v_before.quantity then
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

    if v_before.status <> 'received' or v_before.qc_status not in ('passed', 'failed', 'not_required') then
      raise exception 'RMA wallet refund requires receipt and an explicit QC result' using errcode = '23514';
    end if;

    if v_before.resolution_action = 'replacement'
      or v_before.replacement_order_id is not null
      or v_before.status = 'replacement_sent'
      or exists (
        select 1
        from public.rma_action_executions as e
        where e.rma_request_id = v_before.id
          and e.action = 'mark_replacement_sent'
          and e.execution_status = 'succeeded'
      )
    then
      raise exception 'RMA already has a replacement outcome; wallet refund is not available' using errcode = '23514';
    end if;

    if v_before.wallet_refund_request_id is not null
      or exists (
        select 1
        from public.wallet_refund_requests as wr
        where wr.rma_request_id = v_before.id
          and wr.status in ('pending', 'approved')
      )
    then
      raise exception 'RMA wallet refund request already exists' using errcode = '23514';
    end if;

    if v_before.received_quantity is null
      or v_before.received_quantity <> v_before.quantity
    then
      raise exception 'Refund requires the complete RMA quantity to be received' using errcode = '22003';
    end if;

    -- The action payload is the only amount authority. A historical
    -- rma_requests.refund_amount (including a legacy review PATCH value) is
    -- never silently reused for a payable wallet request.
    v_refund_amount := round(nullif(p_refund_amount, 0), 2);
    if v_refund_amount is null or v_refund_amount <= 0 then
      raise exception 'Refund amount must be explicitly confirmed before requesting a wallet refund' using errcode = '23514';
    end if;

    if v_before.unit_price_snapshot is null then
      raise exception 'RMA has no immutable unit-price snapshot for refund approval' using errcode = '23514';
    end if;
    v_line_unit_price := v_before.unit_price_snapshot;
    v_stock_quantity := v_before.quantity;
    v_order_line_returnable_quantity := private.rma_order_line_returnable_quantity(v_before.order_line_id);
    if coalesce(v_order_line_returnable_quantity, 0) < v_stock_quantity then
      raise exception 'Refund quantity exceeds the order-line returnable quantity' using errcode = '22003';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(
      format('rma-refund-line:%s', v_before.order_line_id),
      0
    ));
    v_line_refund_cap := round(v_line_unit_price * v_stock_quantity, 2);
    select coalesce(sum(coalesce(r.refund_net_amount, r.refund_amount, 0)), 0)
    into v_existing_refunded_amount
    from public.rma_requests as r
    where r.order_line_id = v_before.order_line_id
      and r.id <> v_before.id
      and r.status in ('refunded', 'closed')
      and coalesce(r.refund_net_amount, r.refund_amount, 0) > 0;
    v_line_refund_cap := least(
      v_line_refund_cap,
      greatest(
        round(v_line_unit_price * v_order_line_returnable_quantity, 2)
          - coalesce(v_existing_refunded_amount, 0),
        0
      )
    );
    v_refundable_amount := coalesce(private.order_wallet_refundable_amount(v_order.id), 0);
    v_refundable_amount := least(v_refundable_amount, v_line_refund_cap);
    if v_refund_amount > v_refundable_amount then
      raise exception 'Refund amount exceeds the remaining order-line refundable balance' using errcode = '22003';
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
        'refund_quantity', v_stock_quantity,
        'amount_scope', 'explicit_line_amount_only',
        'tax_and_shipping_included', false
      )
    )
    on conflict (idempotency_key) do update
      set updated_at = public.wallet_refund_requests.updated_at
    returning * into v_refund_request;

    v_next_status := v_before.status;
    v_resolution_action := 'refund_wallet';
    v_event_type := 'refund_requested';
    v_event_note := coalesce(v_event_note, 'Wallet refund request created');
    v_customer_visible := true;

  elsif v_action = 'restock_return' then
    if v_before.status not in ('received', 'refunded', 'replacement_sent') or v_inventory_disposition <> 'quarantine' then
      raise exception 'RMA must be received and quarantined before restock' using errcode = '23514';
    end if;

    if v_before.qc_status not in ('passed', 'failed', 'not_required') then
      raise exception 'RMA inventory disposition requires an explicit QC result' using errcode = '23514';
    end if;

    if v_before.received_quantity is distinct from v_before.quantity then
      raise exception 'RMA inventory disposition requires the complete RMA quantity to be received' using errcode = '22003';
    end if;

    if nullif(btrim(coalesce(p_batch_code, '')), '') is null
      or nullif(btrim(coalesce(p_location, '')), '') is null
    then
      raise exception 'Restock requires an explicit batch code and location' using errcode = '23514';
    end if;

    if not coalesce((select private.partspro_has_permission('product.adjust_stock')), false) then
      raise exception 'Restock requires product.adjust_stock permission' using errcode = '42501';
    end if;

    v_stock_quantity := v_before.quantity;
    if v_stock_quantity < 1 or v_stock_quantity <> v_before.quantity then
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

    v_inventory_disposition := 'restock';
    v_next_status := v_before.status;
    v_event_type := 'stock_adjusted';
    v_event_note := coalesce(v_event_note, 'Returned item restocked once');

  elsif v_action in ('mark_scrapped', 'supplier_return') then
    if v_before.status not in ('received', 'refunded', 'replacement_sent') or v_inventory_disposition <> 'quarantine' then
      raise exception 'RMA must be received and quarantined before inventory disposition' using errcode = '23514';
    end if;

    if v_before.qc_status not in ('passed', 'failed', 'not_required') then
      raise exception 'RMA inventory disposition requires an explicit QC result' using errcode = '23514';
    end if;

    if v_before.received_quantity is distinct from v_before.quantity then
      raise exception 'RMA inventory disposition requires the complete RMA quantity to be received' using errcode = '22003';
    end if;

    if nullif(btrim(coalesce(p_batch_code, '')), '') is null
      or nullif(btrim(coalesce(p_location, '')), '') is null
    then
      raise exception 'Inventory disposition requires an explicit batch code and location' using errcode = '23514';
    end if;

    v_stock_quantity := v_before.quantity;
    if v_stock_quantity < 1 or v_stock_quantity <> v_before.quantity then
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
        'batch_code', p_batch_code,
        'location', p_location,
        'supplier', p_supplier
      )
    );

    v_inventory_disposition := case when v_action = 'mark_scrapped' then 'scrap' else 'supplier_return' end;
    v_next_status := v_before.status;
    v_event_type := 'inventory_disposition';
    v_event_note := coalesce(v_event_note, 'RMA inventory disposition recorded from quarantine');

  elsif v_action = 'mark_replacement_sent' then
    if p_replacement_order_id is null then
      raise exception 'A shipped replacement order is required' using errcode = '23514';
    end if;

    if v_before.resolution_action = 'refund_wallet'
      or v_before.wallet_refund_request_id is not null
      or v_before.status = 'refunded'
      or exists (
        select 1
        from public.wallet_refund_requests as wr
        where wr.rma_request_id = v_before.id
          and wr.status in ('pending', 'approved')
      )
    then
      raise exception 'RMA already has a wallet refund outcome; replacement is not available' using errcode = '23514';
    end if;

    select *
    into v_replacement_order
    from public.orders as o
    where o.id = p_replacement_order_id
    for update;

    if v_replacement_order.id is null
      or v_replacement_order.status <> 'shipped'
      or v_replacement_order.customer_id is distinct from v_order.customer_id
      or v_replacement_order.id = v_order.id
    then
      raise exception 'Replacement order must be different, belong to the same customer, and be shipped' using errcode = '23514';
    end if;

    if v_before.status <> 'received' or v_before.qc_status not in ('passed', 'failed', 'not_required') then
      raise exception 'Replacement requires receipt and an explicit QC result' using errcode = '23514';
    end if;

    if v_before.received_quantity is distinct from v_before.quantity
    then
      raise exception 'Replacement requires the complete RMA quantity to be received' using errcode = '22003';
    end if;

    v_stock_quantity := v_before.quantity;

    if v_sku_code is null then
      raise exception 'RMA has no SKU for replacement validation' using errcode = '23503';
    end if;

    select coalesce(sum(greatest(ol.quantity - coalesce(ol.cancelled_qty, 0), 0)), 0)
    into v_replacement_quantity
    from public.order_lines as ol
    where ol.order_id = v_replacement_order.id
      and ol.sku_code = v_sku_code;

    if v_replacement_quantity < v_stock_quantity then
      raise exception 'Replacement order does not contain enough of the returned SKU' using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.rma_requests as r
      where r.replacement_order_id = v_replacement_order.id
        and r.id <> v_before.id
    ) then
      raise exception 'Replacement order is already associated with another RMA' using errcode = '23514';
    end if;

    v_next_status := 'replacement_sent';
    v_resolution_action := 'replacement';
    v_replacement_quantity := v_stock_quantity;
    v_event_type := 'replacement_sent';
    v_event_note := coalesce(v_event_note, 'Replacement order shipped');
    v_customer_visible := true;

  elsif v_action = 'close' then
    if v_before.status = 'closed' then
      v_next_status := 'closed';
    elsif v_before.status = 'rejected' and v_before.received_at is null then
      -- A rejected request that never entered the warehouse has no second
      -- axis to settle.
      v_next_status := 'closed';
    elsif v_before.status in ('refunded', 'replacement_sent')
      and v_before.received_at is not null
      and v_before.received_quantity = v_before.quantity
      and v_before.qc_status in ('passed', 'failed', 'not_required')
      and v_before.resolution_action in ('refund_wallet', 'replacement')
      and v_inventory_disposition in ('restock', 'scrap', 'supplier_return')
      and v_before.inventory_disposition_quantity = v_before.quantity
      and (
        (v_before.status = 'refunded' and v_before.refund_approved_quantity = v_before.quantity)
        or (v_before.status = 'replacement_sent' and v_before.replacement_quantity = v_before.quantity)
      )
    then
      v_next_status := 'closed';
    else
      -- Received RMAs must have both a terminal commercial outcome and a
      -- terminal inventory disposition before they can close.
      raise exception 'RMA cannot be closed in its current state' using errcode = '23514';
    end if;

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
      qc_status = case when v_action = 'record_qc' then v_qc_status else qc_status end,
      qc_notes = case when v_action = 'record_qc' then nullif(btrim(p_qc_note), '') else qc_notes end,
      qc_by = case when v_action = 'record_qc' then v_auth_uid else qc_by end,
      qc_at = case when v_action = 'record_qc' then now() else qc_at end,
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
      refund_approved_quantity = case when v_action = 'request_wallet_refund' then v_stock_quantity else refund_approved_quantity end,
      replacement_order_id = case when v_action = 'mark_replacement_sent' then p_replacement_order_id else replacement_order_id end,
      replacement_quantity = case when v_action = 'mark_replacement_sent' then v_replacement_quantity else replacement_quantity end,
      inventory_disposition_quantity = case
        when v_action in ('restock_return', 'mark_scrapped', 'supplier_return') then v_stock_quantity
        else inventory_disposition_quantity
      end,
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
      'quantity', case when v_action in ('mark_received', 'request_wallet_refund', 'mark_replacement_sent', 'restock_return', 'mark_scrapped', 'supplier_return') then v_stock_quantity else null end,
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
      format('/rma?requestId=%s', v_after.id),
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

-- Re-check the immutable line-price cap immediately before wallet approval.
-- The approval flow already enforces the order-level balance; this trigger
-- closes the race where two pending RMA refunds target the same order line.
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
  perform pg_advisory_xact_lock(hashtextextended(format('rma-refund-line:%s', coalesce(v_rma.order_line_id, new.order_line_id)), 0));

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
  v_order_refundable_amount := coalesce(private.order_wallet_refundable_amount(v_order.id), 0);
  v_line_cap := least(v_line_cap, v_order_refundable_amount);
  if coalesce(new.approved_amount, 0) > v_line_cap then
    raise exception 'Approved wallet refund exceeds the remaining order-line cap' using errcode = '22003';
  end if;

  return new;
end;
$$;

drop trigger if exists rma_wallet_refund_line_cap on public.wallet_refund_requests;
create trigger rma_wallet_refund_line_cap
  before update of status, approved_amount on public.wallet_refund_requests
  for each row
  when (new.request_type = 'rma_return' and new.status = 'approved')
  execute function private.assert_rma_wallet_refund_line_cap();

-- Synchronize the actual approved wallet amount back to the RMA. This keeps
-- the commercial result axis explicit; inventory disposition remains separate
-- and never closes the RMA by itself.
create or replace function private.sync_rma_wallet_refund_approval()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_rma public.rma_requests%rowtype;
  v_auth_uid uuid := (select auth.uid());
  v_actor_id uuid := coalesce(new.approved_by, (select auth.uid()));
  v_approved_quantity integer;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if new.request_type <> 'rma_return'
    or new.status <> 'approved'
    or old.status is not distinct from new.status
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
    return new;
  end if;

  if v_rma.status <> 'received'
    or v_rma.resolution_action <> 'refund_wallet'
    or v_rma.replacement_order_id is not null
    or v_rma.wallet_refund_request_id is distinct from new.id
  then
    raise exception 'Wallet approval cannot settle this RMA commercial outcome' using errcode = '23514';
  end if;

  if nullif(new.metadata ->> 'refund_quantity', '') is not null then
    if new.metadata ->> 'refund_quantity' !~ '^[1-9][0-9]{0,8}$' then
      raise exception 'Wallet approval refund quantity metadata is invalid' using errcode = '22023';
    end if;
    v_approved_quantity := (new.metadata ->> 'refund_quantity')::integer;
  else
    v_approved_quantity := v_rma.refund_approved_quantity;
  end if;

  update public.rma_requests
  set status = 'refunded',
      resolution_action = 'refund_wallet',
      wallet_refund_request_id = new.id,
      refund_amount = new.approved_amount,
      refund_net_amount = new.approved_amount,
      refund_approved_quantity = v_approved_quantity,
      refund_method = 'wallet_credit',
      refund_currency = coalesce(new.currency, 'EUR'),
      resolved_at = coalesce(resolved_at, now()),
      updated_at = now()
  where id = v_rma.id;

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
    v_rma.id,
    v_actor_id,
    'refund_approved',
    v_rma.status,
    'refunded',
    'Wallet refund approved',
    true,
    'wallet_refund_approved',
    jsonb_build_object(
      'wallet_refund_request_id', new.id,
      'requested_amount', new.requested_amount,
      'approved_amount', new.approved_amount,
      'approved_quantity', v_approved_quantity,
      'tax_and_shipping_included', false
    )
  );

  if v_rma.user_id is not null then
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
      v_rma.user_id,
      v_actor_id,
      'customer',
      'rma_status_updated',
      'RMA refund approved',
      format('The wallet refund for RMA %s was approved.', coalesce(v_rma.rma_no, v_rma.id::text)),
      format('/rma?requestId=%s', v_rma.id),
      'rma_requests',
      v_rma.id::text,
      v_rma.id,
      'wallet_refund_approved',
      jsonb_build_object('status', 'refunded', 'approved_amount', new.approved_amount)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists rma_wallet_refund_approval_sync on public.wallet_refund_requests;
create trigger rma_wallet_refund_approval_sync
  after update of status, approved_amount on public.wallet_refund_requests
  for each row
  when (new.request_type = 'rma_return' and new.status = 'approved' and old.status is distinct from new.status)
  execute function private.sync_rma_wallet_refund_approval();

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
    null,
    null,
    null
  );

  return v_result;
end;
$$;

revoke all on function private.rma_attachment_extension(text)
  from public, anon, authenticated;

revoke all on function private.rma_user_can_access_order(uuid, uuid, uuid)
  from public, anon, authenticated;

revoke all on function private.assert_rma_wallet_refund_line_cap()
  from public, anon, authenticated;
revoke all on function private.sync_rma_wallet_refund_approval()
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

revoke all on function public.rma_cancel_attachment(uuid, uuid)
  from public, anon;
grant execute on function public.rma_cancel_attachment(uuid, uuid)
  to authenticated;

revoke all on function public.rma_gc_expired_attachments(integer)
  from public, anon, authenticated;
grant execute on function public.rma_gc_expired_attachments(integer)
  to service_role;

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
  uuid,
  text,
  text
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
  uuid,
  text,
  text
) to authenticated;

revoke all on function public.admin_update_rma_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric
) from public, anon;
grant execute on function public.admin_update_rma_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric
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

-- Keep the historical direct-write trigger on the same ownership and net
-- quantity source as the new draft/submit RPCs. The trigger name/signature is
-- defined by 20260524133225_harden_partspro_relations.sql and is replaced here
-- without removing its existing grant or trigger.
create or replace function private.enforce_rma_order_line()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_line_qty integer;
  v_returnable_quantity integer;
  v_existing_requested_quantity integer;
  v_current_rma_id uuid;
  v_order_id uuid;
  v_order_customer_id uuid;
  v_order_no text;
  v_sku_code text;
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := (select private.is_staff());
begin
  if tg_op = 'UPDATE' then
    v_current_rma_id := old.id;
  end if;

  if new.order_line_id is null then
    raise exception 'RMA request must reference an order line' using errcode = '23502';
  end if;

  select
    ol.quantity,
    o.id,
    o.customer_id,
    o.order_no,
    ol.sku_code
  into
    v_line_qty,
    v_order_id,
    v_order_customer_id,
    v_order_no,
    v_sku_code
  from public.order_lines as ol
  join public.orders as o on o.id = ol.order_id
  where ol.id = new.order_line_id
  for update;

  if v_line_qty is null then
    raise exception 'RMA order line does not exist' using errcode = '23503';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'RMA quantity must be positive' using errcode = '23514';
  end if;

  v_returnable_quantity := private.rma_order_line_returnable_quantity(new.order_line_id);
  select coalesce(sum(greatest(r.quantity, 0)), 0)
  into v_existing_requested_quantity
  from public.rma_requests as r
  where r.order_line_id = new.order_line_id
    and r.status <> 'rejected'
    and r.id is distinct from v_current_rma_id
    and r.id is distinct from new.id;

  if v_returnable_quantity is null
    or (
      coalesce(new.status, 'submitted') <> 'rejected'
      and coalesce(v_existing_requested_quantity, 0) + new.quantity > v_returnable_quantity
    )
  then
    raise exception 'RMA quantity cannot exceed the order-line returnable quantity' using errcode = '23514';
  end if;

  if new.attachments is null then
    new.attachments := '[]'::jsonb;
  end if;

  if jsonb_typeof(new.attachments) <> 'array' then
    raise exception 'RMA attachments must be a JSON array' using errcode = '23514';
  end if;

  if new.order_id is null then
    new.order_id := v_order_id;
  elsif new.order_id is distinct from v_order_id then
    raise exception 'RMA order_id must match the referenced order line' using errcode = '23514';
  end if;

  if new.customer_id is null then
    new.customer_id := v_order_customer_id;
  elsif new.customer_id is distinct from v_order_customer_id then
    raise exception 'RMA customer_id must match the referenced order line' using errcode = '23514';
  end if;

  if new.order_no is null or btrim(new.order_no) = '' then
    new.order_no := v_order_no;
  elsif new.order_no <> v_order_no then
    raise exception 'RMA order_no must match the referenced order line' using errcode = '23514';
  end if;

  if new.sku_code is null or btrim(new.sku_code) = '' then
    new.sku_code := v_sku_code;
  elsif new.sku_code <> v_sku_code then
    raise exception 'RMA sku_code must match the referenced order line' using errcode = '23514';
  end if;

  if not v_is_staff then
    if v_auth_uid is null then
      raise exception 'Authentication required' using errcode = '28000';
    end if;

    if not private.rma_user_can_access_order(v_auth_uid, v_order_customer_id, v_order_id) then
      raise exception 'RMA order line is not owned by the authenticated customer' using errcode = '42501';
    end if;

    new.user_id := coalesce(new.user_id, v_auth_uid);
    if new.user_id is distinct from v_auth_uid then
      raise exception 'RMA user_id must match current user' using errcode = '42501';
    end if;

    new.status := coalesce(new.status, 'submitted');
    if new.status <> 'submitted' then
      raise exception 'Buyers can only submit new RMA requests' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Replace both historical INSERT policies while retaining the original grants.
-- The shared helper contains the explicit ordinary-membership and
-- employee-self branches, so orders.user_id/current_customer_id cannot act as
-- a fallback owner proof.
drop policy if exists "partspro_rma_self_submit" on public.rma_requests;
create policy "partspro_rma_self_submit"
on public.rma_requests
for insert
to authenticated
with check (
  (select private.is_staff())
  or (
    user_id = (select auth.uid())
    and status = 'submitted'
    and order_line_id is not null
    and exists (
      select 1
      from public.order_lines as ol
      join public.orders as o on o.id = ol.order_id
      join public.customers as c on c.id = o.customer_id
      where ol.id = rma_requests.order_line_id
        and (rma_requests.customer_id is null or rma_requests.customer_id = o.customer_id)
        and rma_requests.quantity <= case
          when coalesce(ol.fulfilled_qty, 0) > 0 then least(
            greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0),
            coalesce(ol.fulfilled_qty, 0)
          )
          else greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0)
        end
        and (
          (
            exists (
              select 1
              from public.profiles as p
              where p.id = (select auth.uid())
                and coalesce(p.account_type, 'customer') = 'customer'
            )
            and c.status = 'active'
            and coalesce(c.profile_kind, 'customer') = 'customer'
            and exists (
              select 1
              from public.customer_memberships as cm
              where cm.customer_id = c.id
                and cm.user_id = (select auth.uid())
                and cm.status = 'active'
            )
          )
          or (
            exists (
              select 1
              from public.profiles as p
              where p.id = (select auth.uid())
                and p.account_type = 'employee'
                and p.customer_id = c.id
            )
            and c.user_id = (select auth.uid())
            and c.status = 'active'
            and c.profile_kind = 'employee_self'
          )
        )
    )
  )
);

drop policy if exists "partspro_rma_insert_order_line_guard" on public.rma_requests;
create policy "partspro_rma_insert_order_line_guard"
on public.rma_requests
as restrictive
for insert
to authenticated
with check (
  (select private.is_staff())
  or (
    user_id = (select auth.uid())
    and status = 'submitted'
    and order_line_id is not null
    and exists (
      select 1
      from public.order_lines as ol
      join public.orders as o on o.id = ol.order_id
      join public.customers as c on c.id = o.customer_id
      where ol.id = rma_requests.order_line_id
        and (rma_requests.customer_id is null or rma_requests.customer_id = o.customer_id)
        and rma_requests.quantity <= case
          when coalesce(ol.fulfilled_qty, 0) > 0 then least(
            greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0),
            coalesce(ol.fulfilled_qty, 0)
          )
          else greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0)
        end
        and (
          (
            exists (
              select 1
              from public.profiles as p
              where p.id = (select auth.uid())
                and coalesce(p.account_type, 'customer') = 'customer'
            )
            and c.status = 'active'
            and coalesce(c.profile_kind, 'customer') = 'customer'
            and exists (
              select 1
              from public.customer_memberships as cm
              where cm.customer_id = c.id
                and cm.user_id = (select auth.uid())
                and cm.status = 'active'
            )
          )
          or (
            exists (
              select 1
              from public.profiles as p
              where p.id = (select auth.uid())
                and p.account_type = 'employee'
                and p.customer_id = c.id
            )
            and c.user_id = (select auth.uid())
            and c.status = 'active'
            and c.profile_kind = 'employee_self'
          )
        )
    )
  )
);

revoke all on function private.rma_order_line_returnable_quantity(uuid)
  from public, anon, authenticated;
revoke all on function private.enforce_rma_order_line()
  from public, anon, authenticated;
