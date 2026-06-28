-- RMA admin workflow v2: private evidence storage, staff workflow fields,
-- customer-visible history, and staff-only status update RPC.

insert into public.admin_permissions (id, label, group_name, description)
values
  ('rma.read', 'Read RMA requests', 'rma', 'Can read after-sales and RMA requests.'),
  ('rma.manage', 'Manage RMA workflow', 'rma', 'Can assign and update after-sales workflow state.'),
  ('rma.refund', 'Request RMA wallet refunds', 'rma', 'Can create wallet refund requests from RMA decisions.'),
  ('rma.inventory', 'Process RMA inventory', 'rma', 'Can mark returned RMA stock as restocked or scrapped.')
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'rma.read'),
  ('admin', 'rma.manage'),
  ('admin', 'rma.refund'),
  ('admin', 'rma.inventory'),
  ('sales', 'rma.read'),
  ('sales', 'rma.manage'),
  ('sales', 'rma.refund'),
  ('sales_support', 'rma.read'),
  ('sales_support', 'rma.manage'),
  ('auditor', 'rma.read'),
  ('inventory_manager', 'rma.read'),
  ('inventory_manager', 'rma.inventory'),
  ('warehouse', 'rma.read'),
  ('warehouse', 'rma.inventory')
on conflict do nothing;

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
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/quicktime'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.rma_requests
  add column if not exists customer_visible_note text not null default '',
  add column if not exists internal_note text not null default '',
  add column if not exists lab_result text not null default '',
  add column if not exists resolution_note text not null default '',
  add column if not exists refund_amount numeric(12, 2) not null default 0,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists received_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists due_at timestamptz default (now() + interval '2 days'),
  add column if not exists closed_at timestamptz,
  add column if not exists resolution_action text,
  add column if not exists inventory_disposition text not null default 'pending',
  add column if not exists wallet_refund_request_id uuid references public.wallet_refund_requests(id) on delete set null;

update public.rma_requests
set due_at = coalesce(due_at, created_at + interval '2 days')
where due_at is null
  and status not in ('closed', 'refunded', 'rejected', 'replacement_sent');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_refund_amount_nonnegative'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_refund_amount_nonnegative
      check (refund_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_resolution_action_check'
  ) then
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
          'return_to_stock'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rma_requests'::regclass
      and conname = 'rma_requests_inventory_disposition_check'
  ) then
    alter table public.rma_requests
      add constraint rma_requests_inventory_disposition_check
      check (
        inventory_disposition in (
          'pending',
          'quarantine',
          'restock',
          'scrap',
          'supplier_return'
        )
      );
  end if;
end;
$$;

create index if not exists rma_requests_status_updated_idx
  on public.rma_requests (status, updated_at desc);

create index if not exists rma_requests_assignee_status_idx
  on public.rma_requests (assigned_to, status, due_at);

create index if not exists rma_requests_refund_request_idx
  on public.rma_requests (wallet_refund_request_id)
  where wallet_refund_request_id is not null;

create table if not exists public.rma_request_events (
  id uuid primary key default gen_random_uuid(),
  rma_request_id uuid not null references public.rma_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  note text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint rma_request_events_type_check check (
    event_type in (
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
      'closed'
    )
  ),
  constraint rma_request_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

do $$
begin
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
    check (
      event_type in (
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
        'closed'
      )
    );
end;
$$;

create index if not exists rma_request_events_request_created_idx
  on public.rma_request_events (rma_request_id, created_at desc);

alter table public.rma_request_events enable row level security;

grant select, insert on public.rma_request_events to authenticated;

drop policy if exists "partspro_rma_events_read" on public.rma_request_events;
create policy "partspro_rma_events_read"
on public.rma_request_events
for select
to authenticated
using (
  (select private.is_staff())
  or (
    (metadata ->> 'customer_visible') = 'true'
    and exists (
      select 1
      from public.rma_requests as r
      left join public.order_lines as ol on ol.id = r.order_line_id
      left join public.orders as o on o.id = ol.order_id
      where r.id = rma_request_events.rma_request_id
        and (
          r.user_id = (select auth.uid())
          or o.user_id = (select auth.uid())
          or o.customer_id = (select private.current_customer_id())
        )
    )
  )
);

drop policy if exists "partspro_rma_events_staff_insert" on public.rma_request_events;
create policy "partspro_rma_events_staff_insert"
on public.rma_request_events
for insert
to authenticated
with check ((select private.is_staff()));

drop policy if exists "partspro_rma_self_or_staff_read" on public.rma_requests;
create policy "partspro_rma_self_or_staff_read"
on public.rma_requests
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_staff())
  or exists (
    select 1
    from public.order_lines as ol
    join public.orders as o on o.id = ol.order_id
    where ol.id = rma_requests.order_line_id
      and (
        o.user_id = (select auth.uid())
        or o.customer_id = (select private.current_customer_id())
      )
  )
);

create or replace function private.record_rma_request_created_event()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  insert into public.rma_request_events (
    rma_request_id,
    actor_id,
    event_type,
    to_status,
    note,
    metadata
  )
  values (
    new.id,
    new.user_id,
    'created',
    new.status,
    'Richiesta assistenza inviata',
    jsonb_build_object('customer_visible', true)
  );

  return new;
end;
$$;

drop trigger if exists rma_requests_created_event on public.rma_requests;
create trigger rma_requests_created_event
  after insert on public.rma_requests
  for each row
  execute function private.record_rma_request_created_event();

create or replace function public.admin_update_rma_request(
  p_request_id uuid,
  p_status text,
  p_customer_visible_note text default null,
  p_internal_note text default null,
  p_lab_result text default null,
  p_resolution_note text default null,
  p_refund_amount numeric default null
)
returns public.rma_requests
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := coalesce((select private.is_staff()), false);
  v_before public.rma_requests%rowtype;
  v_after public.rma_requests%rowtype;
  v_event_note text;
  v_customer_visible boolean := false;
  v_event_type text := 'note_added';
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not v_is_staff then
    raise exception 'Only staff can update RMA workflow state' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'RMA request id is required' using errcode = '23502';
  end if;

  if p_status not in (
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'received',
    'replacement_sent',
    'refunded',
    'closed'
  ) then
    raise exception 'Invalid RMA status' using errcode = '23514';
  end if;

  if p_refund_amount is not null and p_refund_amount < 0 then
    raise exception 'Refund amount cannot be negative' using errcode = '23514';
  end if;

  select *
  into v_before
  from public.rma_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'RMA request not found' using errcode = 'P0002';
  end if;

  update public.rma_requests
  set
    status = p_status,
    customer_visible_note = coalesce(nullif(btrim(p_customer_visible_note), ''), customer_visible_note),
    internal_note = coalesce(nullif(btrim(p_internal_note), ''), internal_note),
    lab_result = coalesce(nullif(btrim(p_lab_result), ''), lab_result),
    resolution_note = coalesce(nullif(btrim(p_resolution_note), ''), resolution_note),
    refund_amount = coalesce(p_refund_amount, refund_amount),
    reviewed_at = case
      when p_status in ('under_review', 'approved', 'rejected') and reviewed_at is null then now()
      else reviewed_at
    end,
    reviewed_by = v_auth_uid,
    received_at = case
      when p_status = 'received' and received_at is null then now()
      else received_at
    end,
    resolved_at = case
      when p_status in ('replacement_sent', 'refunded', 'closed', 'rejected') and resolved_at is null then now()
      else resolved_at
    end,
    closed_at = case
      when p_status = 'closed' and closed_at is null then now()
      else closed_at
    end,
    updated_at = now()
  where id = p_request_id
  returning * into v_after;

  v_customer_visible :=
    v_before.status is distinct from v_after.status
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

  if v_before.status is distinct from v_after.status then
    v_event_type := case
      when v_after.status = 'received' then 'received'
      when v_after.status in ('replacement_sent', 'refunded', 'closed', 'rejected') then 'resolved'
      else 'status_changed'
    end;
  end if;

  if
    v_before.status is distinct from v_after.status
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
      metadata
    )
    values (
      v_after.id,
      v_auth_uid,
      v_event_type,
      v_before.status,
      v_after.status,
      v_event_note,
      jsonb_build_object(
        'customer_visible', v_customer_visible,
        'refund_amount', p_refund_amount,
        'internal_note_present', nullif(btrim(coalesce(p_internal_note, '')), '') is not null
      )
    );
  end if;

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
set search_path = public, private, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_before public.rma_requests%rowtype;
  v_after public.rma_requests%rowtype;
  v_line public.order_lines%rowtype;
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_assigned_to uuid;
  v_customer_note text := nullif(btrim(coalesce(p_customer_visible_note, '')), '');
  v_internal_note text := nullif(btrim(coalesce(p_internal_note, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_event_type text := 'note_added';
  v_event_note text := '';
  v_customer_visible boolean := false;
  v_next_status text;
  v_resolution_action text;
  v_inventory_disposition text;
  v_wallet_refund_request_id uuid;
  v_refund_request public.wallet_refund_requests%rowtype;
  v_refund_amount numeric(12, 2);
  v_refundable_amount numeric(12, 2);
  v_stock_quantity integer;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.is_staff()), false) then
    raise exception 'Only staff can process RMA actions' using errcode = '42501';
  end if;

  if v_action not in (
    'assign',
    'request_wallet_refund',
    'mark_received',
    'restock_return',
    'mark_scrapped',
    'close'
  ) then
    raise exception 'Invalid RMA action %', p_action using errcode = '23514';
  end if;

  if v_action = 'request_wallet_refund' then
    if not (
      coalesce((select private.partspro_has_permission('wallet_refunds.request')), false)
      or coalesce((select private.partspro_has_permission('rma.refund')), false)
    ) then
      raise exception 'RMA refund permission required' using errcode = '42501';
    end if;
  elsif v_action = 'restock_return' then
    if not coalesce((select private.partspro_has_permission('product.adjust_stock')), false) then
      raise exception 'RMA inventory permission required' using errcode = '42501';
    end if;
  elsif v_action = 'mark_scrapped' then
    if not (
      coalesce((select private.partspro_has_permission('product.adjust_stock')), false)
      or coalesce((select private.partspro_has_permission('rma.inventory')), false)
    ) then
      raise exception 'RMA inventory permission required' using errcode = '42501';
    end if;
  else
    if not (
      coalesce((select private.partspro_has_permission('orders.manage')), false)
      or coalesce((select private.partspro_has_permission('rma.manage')), false)
    ) then
      raise exception 'RMA manage permission required' using errcode = '42501';
    end if;
  end if;

  select *
  into v_before
  from public.rma_requests
  where id = p_request_id
  for update;

  if v_before.id is null then
    raise exception 'RMA request not found' using errcode = 'P0002';
  end if;

  select *
  into v_line
  from public.order_lines
  where id = v_before.order_line_id;

  if v_line.id is not null then
    select *
    into v_order
    from public.orders
    where id = v_line.order_id;
  elsif nullif(btrim(coalesce(v_before.order_no, '')), '') is not null then
    select *
    into v_order
    from public.orders
    where order_no = v_before.order_no;
  end if;

  v_next_status := v_before.status;
  v_resolution_action := v_before.resolution_action;
  v_inventory_disposition := v_before.inventory_disposition;
  v_wallet_refund_request_id := v_before.wallet_refund_request_id;
  v_event_note := coalesce(v_customer_note, v_reason, v_internal_note, '');

  if v_action = 'assign' then
    v_assigned_to := coalesce(p_assigned_to, v_auth_uid);
    v_event_type := 'assigned';
    v_event_note := coalesce(v_event_note, 'RMA assigned');
  elsif v_action = 'mark_received' then
    v_next_status := 'received';
    v_inventory_disposition := 'quarantine';
    v_event_type := 'received';
    v_event_note := coalesce(v_event_note, 'Returned item received for inspection');
    v_customer_visible := true;
  elsif v_action = 'request_wallet_refund' then
    if v_order.id is null then
      raise exception 'RMA order could not be resolved for wallet refund' using errcode = '23503';
    end if;

    v_refund_amount := round(coalesce(
      nullif(p_refund_amount, 0),
      nullif(v_before.refund_amount, 0),
      nullif(v_line.unit_price * greatest(v_before.quantity, 1), 0),
      0
    ), 2);

    if v_refund_amount <= 0 then
      raise exception 'RMA refund amount must be greater than zero' using errcode = '23514';
    end if;

    if v_wallet_refund_request_id is null then
      v_refundable_amount := coalesce(private.order_wallet_refundable_amount(v_order.id), 0);
      v_refund_amount := least(v_refund_amount, v_refundable_amount);

      if v_refund_amount <= 0 then
        raise exception 'Wallet refund request has no refundable amount' using errcode = '23514';
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
        v_order.customer_id,
        v_order.id,
        v_before.order_line_id,
        'order_void',
        v_refund_amount,
        coalesce(v_reason, v_customer_note, 'RMA wallet refund'),
        v_auth_uid,
        concat_ws(':', 'rma_wallet_refund', v_before.id::text, round(v_refund_amount, 2)::text),
        jsonb_build_object(
          'source', 'rma_admin_action',
          'rma_request_id', v_before.id,
          'order_no', v_order.order_no,
          'sku_code', coalesce(v_line.sku_code, v_before.sku_code),
          'quantity', v_before.quantity,
          'requested_amount_before_cap', coalesce(p_refund_amount, v_before.refund_amount),
          'refundable_amount_at_request', v_refundable_amount
        )
      )
      on conflict (idempotency_key) do update
      set updated_at = public.wallet_refund_requests.updated_at
      returning * into v_refund_request;

      v_wallet_refund_request_id := v_refund_request.id;
      v_refund_amount := v_refund_request.requested_amount;
    end if;

    v_next_status := case
      when v_before.status in ('submitted', 'under_review') then 'approved'
      else v_before.status
    end;
    v_resolution_action := 'refund_wallet';
    v_event_type := 'refund_requested';
    v_event_note := coalesce(v_event_note, 'Wallet refund request created');
    v_customer_visible := true;
  elsif v_action = 'restock_return' then
    if v_before.status <> 'received' then
      raise exception 'RMA must be received before returned stock can be restocked' using errcode = '23514';
    end if;

    v_stock_quantity := coalesce(p_quantity, v_before.quantity);

    if v_stock_quantity <= 0 or v_stock_quantity > v_before.quantity then
      raise exception 'Invalid RMA restock quantity' using errcode = '23514';
    end if;

    select *
    into v_product
    from private.admin_adjust_product_stock(
      coalesce(v_line.sku_code, v_before.sku_code),
      'rma_return',
      v_stock_quantity,
      coalesce(v_reason, 'RMA returned item restocked'),
      p_location,
      p_batch_code,
      p_supplier
    );

    v_resolution_action := 'return_to_stock';
    v_inventory_disposition := 'restock';
    v_next_status := case
      when v_before.wallet_refund_request_id is null or v_before.status = 'refunded' then 'closed'
      else v_before.status
    end;
    v_event_type := 'stock_adjusted';
    v_event_note := coalesce(v_event_note, 'Returned item restocked');
  elsif v_action = 'mark_scrapped' then
    if v_before.status <> 'received' then
      raise exception 'RMA must be received before returned stock can be scrapped' using errcode = '23514';
    end if;

    v_resolution_action := 'scrap';
    v_inventory_disposition := 'scrap';
    v_next_status := case
      when v_before.wallet_refund_request_id is null or v_before.status = 'refunded' then 'closed'
      else v_before.status
    end;
    v_event_type := 'inventory_disposition';
    v_event_note := coalesce(v_event_note, 'Returned item marked as scrapped');
  elsif v_action = 'close' then
    v_next_status := 'closed';
    v_event_type := 'closed';
    v_event_note := coalesce(v_event_note, 'RMA closed');
    v_customer_visible := true;
  end if;

  update public.rma_requests
  set
    status = v_next_status,
    customer_visible_note = coalesce(v_customer_note, customer_visible_note),
    internal_note = coalesce(v_internal_note, internal_note),
    assigned_to = case when v_action = 'assign' then v_assigned_to else assigned_to end,
    assigned_by = case when v_action = 'assign' then v_auth_uid else assigned_by end,
    assigned_at = case when v_action = 'assign' then now() else assigned_at end,
    reviewed_at = case
      when v_next_status in ('under_review', 'approved', 'rejected') and reviewed_at is null then now()
      else reviewed_at
    end,
    reviewed_by = case
      when v_action in ('request_wallet_refund', 'mark_received', 'restock_return', 'mark_scrapped', 'close') then v_auth_uid
      else reviewed_by
    end,
    received_at = case
      when v_action = 'mark_received' and received_at is null then now()
      else received_at
    end,
    resolved_at = case
      when v_next_status in ('replacement_sent', 'refunded', 'closed', 'rejected') and resolved_at is null then now()
      else resolved_at
    end,
    closed_at = case
      when v_next_status = 'closed' and closed_at is null then now()
      else closed_at
    end,
    resolution_action = v_resolution_action,
    inventory_disposition = v_inventory_disposition,
    wallet_refund_request_id = v_wallet_refund_request_id,
    refund_amount = case
      when v_action = 'request_wallet_refund' then coalesce(v_refund_amount, refund_amount)
      else refund_amount
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
    metadata
  )
  values (
    v_after.id,
    v_auth_uid,
    v_event_type,
    v_before.status,
    v_after.status,
    v_event_note,
    jsonb_build_object(
      'action', v_action,
      'customer_visible', v_customer_visible,
      'assigned_to', case when v_action = 'assign' then v_after.assigned_to else null end,
      'wallet_refund_request_id', v_after.wallet_refund_request_id,
      'refund_amount', case when v_action = 'request_wallet_refund' then v_after.refund_amount else null end,
      'inventory_disposition', v_after.inventory_disposition,
      'stock_quantity', case when v_action = 'restock_return' then v_stock_quantity else null end,
      'internal_note_present', v_internal_note is not null
    )
  );

  return v_after;
end;
$$;

create or replace function private.sync_rma_wallet_refund_status()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_rma_id_text text;
  v_rma_id uuid;
  v_before_status text;
  v_after public.rma_requests%rowtype;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status <> 'approved' or old.status is not distinct from new.status then
    return new;
  end if;

  v_rma_id_text := new.metadata ->> 'rma_request_id';

  if v_rma_id_text is null
    or v_rma_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return new;
  end if;

  v_rma_id := v_rma_id_text::uuid;

  select status
  into v_before_status
  from public.rma_requests
  where id = v_rma_id
  for update;

  if v_before_status is null then
    return new;
  end if;

  update public.rma_requests
  set
    status = 'refunded',
    resolution_action = 'refund_wallet',
    wallet_refund_request_id = new.id,
    refund_amount = round(coalesce(new.approved_amount, new.requested_amount, refund_amount), 2),
    resolved_at = coalesce(resolved_at, now()),
    updated_at = now()
  where id = v_rma_id
  returning * into v_after;

  if v_before_status is distinct from v_after.status then
    insert into public.rma_request_events (
      rma_request_id,
      actor_id,
      event_type,
      from_status,
      to_status,
      note,
      metadata
    )
    values (
      v_after.id,
      new.approved_by,
      'refund_approved',
      v_before_status,
      v_after.status,
      'Wallet refund approved',
      jsonb_build_object(
        'customer_visible', true,
        'wallet_refund_request_id', new.id,
        'refund_amount', v_after.refund_amount
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists wallet_refund_requests_sync_rma_status
  on public.wallet_refund_requests;
create trigger wallet_refund_requests_sync_rma_status
  after update of status
  on public.wallet_refund_requests
  for each row
  execute function private.sync_rma_wallet_refund_status();

revoke all on function public.admin_update_rma_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric
) from public;

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
) from public;

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

comment on table public.rma_request_events is
  'Customer-visible and internal workflow history for PartsPro RMA requests.';
comment on column public.rma_requests.customer_visible_note is
  'Latest staff note that can be shown to the customer in the RMA flow.';
comment on column public.rma_requests.internal_note is
  'Latest internal-only staff note for the RMA request.';
comment on column public.rma_requests.lab_result is
  'Latest laboratory inspection result for the RMA request.';
comment on column public.rma_requests.resolution_note is
  'Latest final resolution note for the RMA request.';
comment on column public.rma_requests.refund_amount is
  'Approved refund amount for the RMA request, if any.';
comment on column public.rma_requests.assigned_to is
  'Staff user currently responsible for the RMA request.';
comment on column public.rma_requests.inventory_disposition is
  'Current physical disposition for returned RMA stock: pending, quarantine, restock, scrap, or supplier_return.';
comment on column public.rma_requests.wallet_refund_request_id is
  'Linked wallet refund request created from the RMA decision.';
comment on function public.admin_perform_rma_action(
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
) is
  'Staff-only RMA action RPC for assignment, receipt, wallet refund request creation, restock, scrap, and closure.';
