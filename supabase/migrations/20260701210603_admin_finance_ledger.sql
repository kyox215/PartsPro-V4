-- Admin finance ledger v1: finance permissions, cost layers, COGS
-- snapshots, expense entries, supplier payments, RLS, audit hooks, and
-- historical confidence tagging.

insert into public.admin_permissions (id, label, group_name, description)
values
  ('panel.finance', 'Finance panel', 'finance', 'Can open the admin finance panel.'),
  ('finance.read', 'Read finance ledger', 'finance', 'Can read finance summaries, ledgers, COGS, and payable data.'),
  ('finance.manage', 'Manage finance ledger', 'finance', 'Can create and update expenses and supplier payment records.'),
  ('finance.export', 'Export finance ledger', 'finance', 'Can export finance ledger data.'),
  ('finance.cost_reconcile', 'Reconcile finance costs', 'finance', 'Can reconcile order cost allocations and cost confidence.')
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'panel.finance'),
  ('admin', 'finance.read'),
  ('admin', 'finance.manage'),
  ('admin', 'finance.export'),
  ('admin', 'finance.cost_reconcile'),
  ('auditor', 'panel.finance'),
  ('auditor', 'finance.read'),
  ('auditor', 'finance.export')
on conflict do nothing;

create table if not exists public.finance_cost_layers (
  id uuid primary key default gen_random_uuid(),
  supplier_batch_line_id uuid references public.supplier_batch_lines(id) on delete set null,
  supplier_batch_id uuid references public.supplier_batches(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  sku_code text not null references public.products(sku_code) on update cascade,
  batch_code text,
  received_qty integer not null default 0,
  allocated_qty integer not null default 0,
  consumed_qty integer not null default 0,
  unit_cost_net numeric(12, 4) not null default 0,
  total_cost_net numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  vat_mode text,
  vat_treatment text not null default 'unknown',
  confidence text not null default 'exact',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_cost_layers_qty_nonnegative
    check (received_qty >= 0 and allocated_qty >= 0 and consumed_qty >= 0),
  constraint finance_cost_layers_cost_nonnegative
    check (unit_cost_net >= 0 and total_cost_net >= 0),
  constraint finance_cost_layers_currency_check
    check (currency in ('EUR')),
  constraint finance_cost_layers_vat_treatment_check
    check (vat_treatment in ('excluded', 'included', 'unknown')),
  constraint finance_cost_layers_confidence_check
    check (confidence in ('exact', 'estimated', 'unmatched')),
  constraint finance_cost_layers_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists finance_cost_layers_supplier_line_uidx
  on public.finance_cost_layers (supplier_batch_line_id)
  where supplier_batch_line_id is not null;

create index if not exists finance_cost_layers_sku_batch_idx
  on public.finance_cost_layers (sku_code, batch_code, created_at desc);

create index if not exists finance_cost_layers_supplier_idx
  on public.finance_cost_layers (supplier_id, supplier_batch_id);

create table if not exists public.finance_order_line_cost_allocations (
  id uuid primary key default gen_random_uuid(),
  allocation_key text,
  order_id uuid references public.orders(id) on delete cascade,
  order_line_id uuid references public.order_lines(id) on delete cascade,
  cost_layer_id uuid references public.finance_cost_layers(id) on delete set null,
  supplier_batch_line_id uuid references public.supplier_batch_lines(id) on delete set null,
  inventory_item_id uuid references public.inventory_items(id) on delete set null,
  sku_code text not null,
  batch_code text,
  quantity integer not null,
  unit_cost_net numeric(12, 4) not null default 0,
  total_cost_net numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  status text not null default 'reserved',
  confidence text not null default 'unmatched',
  source text not null default 'manual',
  recognized_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_allocations_quantity_positive check (quantity > 0),
  constraint finance_allocations_cost_nonnegative
    check (unit_cost_net >= 0 and total_cost_net >= 0),
  constraint finance_allocations_currency_check
    check (currency in ('EUR')),
  constraint finance_allocations_status_check
    check (status in ('reserved', 'consumed', 'released', 'reversed', 'backfilled')),
  constraint finance_allocations_confidence_check
    check (confidence in ('exact', 'estimated', 'unmatched')),
  constraint finance_allocations_source_check
    check (source in ('reservation', 'consume', 'release', 'backfill', 'manual', 'current_product_cost', 'batch_average')),
  constraint finance_allocations_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists finance_allocations_key_uidx
  on public.finance_order_line_cost_allocations (allocation_key)
  where allocation_key is not null;

create index if not exists finance_allocations_order_line_idx
  on public.finance_order_line_cost_allocations (order_line_id, status);

create index if not exists finance_allocations_order_idx
  on public.finance_order_line_cost_allocations (order_id, recognized_at desc);

create index if not exists finance_allocations_sku_batch_idx
  on public.finance_order_line_cost_allocations (sku_code, batch_code, confidence);

create table if not exists public.finance_expense_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  description text not null,
  amount_net numeric(12, 2) not null,
  vat_amount numeric(12, 2) not null default 0,
  amount_gross numeric(12, 2) generated always as (round(amount_net + vat_amount, 2)) stored,
  currency text not null default 'EUR',
  status text not null default 'paid',
  occurred_at date not null default current_date,
  paid_at timestamptz,
  counterparty_name text,
  payment_method text,
  reference text,
  evidence_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_expenses_category_check
    check (category in ('rent', 'salary', 'shipping', 'platform_fee', 'utilities', 'tax', 'supplier_fee', 'bank_fee', 'other')),
  constraint finance_expenses_amount_nonnegative
    check (amount_net >= 0 and vat_amount >= 0),
  constraint finance_expenses_currency_check
    check (currency in ('EUR')),
  constraint finance_expenses_status_check
    check (status in ('pending', 'paid', 'cancelled')),
  constraint finance_expenses_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists finance_expenses_date_status_idx
  on public.finance_expense_entries (occurred_at desc, status);

create index if not exists finance_expenses_category_idx
  on public.finance_expense_entries (category, occurred_at desc);

create table if not exists public.supplier_batch_payments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.supplier_batches(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  amount_net numeric(12, 2) not null,
  vat_amount numeric(12, 2) not null default 0,
  amount_gross numeric(12, 2) not null,
  currency text not null default 'EUR',
  status text not null default 'paid',
  paid_at timestamptz,
  due_at date,
  payment_method text,
  reference text,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_batch_payments_amount_nonnegative
    check (amount_net >= 0 and vat_amount >= 0 and amount_gross >= 0),
  constraint supplier_batch_payments_currency_check
    check (currency in ('EUR')),
  constraint supplier_batch_payments_status_check
    check (status in ('pending', 'paid', 'cancelled')),
  constraint supplier_batch_payments_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists supplier_batch_payments_batch_idx
  on public.supplier_batch_payments (batch_id, status, paid_at desc);

create index if not exists supplier_batch_payments_supplier_idx
  on public.supplier_batch_payments (supplier_id, status, paid_at desc);

comment on table public.finance_cost_layers is
  'Accounting cost layers generated from supplier batch lines. Historical or VAT-ambiguous layers carry estimated/unmatched confidence instead of pretending exact COGS.';

comment on table public.finance_order_line_cost_allocations is
  'Immutable-ish order line cost snapshots used for COGS. One order line may allocate across multiple supplier batches.';

comment on table public.finance_expense_entries is
  'Manual operating expense ledger for management reporting. Not a statutory accounting system.';

comment on table public.supplier_batch_payments is
  'Payments against supplier purchase batches for payable tracking.';

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'finance_cost_layers_set_updated_at') then
    create trigger finance_cost_layers_set_updated_at
      before update on public.finance_cost_layers
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'finance_allocations_set_updated_at') then
    create trigger finance_allocations_set_updated_at
      before update on public.finance_order_line_cost_allocations
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'finance_expenses_set_updated_at') then
    create trigger finance_expenses_set_updated_at
      before update on public.finance_expense_entries
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'supplier_batch_payments_set_updated_at') then
    create trigger supplier_batch_payments_set_updated_at
      before update on public.supplier_batch_payments
      for each row execute function public.set_updated_at();
  end if;
end
$$;

alter table public.finance_cost_layers enable row level security;
alter table public.finance_order_line_cost_allocations enable row level security;
alter table public.finance_expense_entries enable row level security;
alter table public.supplier_batch_payments enable row level security;

grant select on public.finance_cost_layers to authenticated;
grant select on public.finance_order_line_cost_allocations to authenticated;
grant select, insert, update, delete on public.finance_expense_entries to authenticated;
grant select, insert, update, delete on public.supplier_batch_payments to authenticated;
grant insert, update, delete on public.finance_cost_layers to authenticated;
grant insert, update, delete on public.finance_order_line_cost_allocations to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_cost_layers'
      and policyname = 'partspro_finance_cost_layers_read'
  ) then
    create policy "partspro_finance_cost_layers_read"
      on public.finance_cost_layers
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('finance.read'))
        or (select private.partspro_has_permission('finance.manage'))
        or (select private.partspro_has_permission('finance.cost_reconcile'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_cost_layers'
      and policyname = 'partspro_finance_cost_layers_reconcile_insert'
  ) then
    create policy "partspro_finance_cost_layers_reconcile_insert"
      on public.finance_cost_layers
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_cost_layers'
      and policyname = 'partspro_finance_cost_layers_reconcile_update'
  ) then
    create policy "partspro_finance_cost_layers_reconcile_update"
      on public.finance_cost_layers
      for update
      to authenticated
      using ((select private.partspro_has_permission('finance.cost_reconcile')))
      with check ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_cost_layers'
      and policyname = 'partspro_finance_cost_layers_reconcile_delete'
  ) then
    create policy "partspro_finance_cost_layers_reconcile_delete"
      on public.finance_cost_layers
      for delete
      to authenticated
      using ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_order_line_cost_allocations'
      and policyname = 'partspro_finance_allocations_read'
  ) then
    create policy "partspro_finance_allocations_read"
      on public.finance_order_line_cost_allocations
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('finance.read'))
        or (select private.partspro_has_permission('finance.manage'))
        or (select private.partspro_has_permission('finance.cost_reconcile'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_order_line_cost_allocations'
      and policyname = 'partspro_finance_allocations_reconcile_insert'
  ) then
    create policy "partspro_finance_allocations_reconcile_insert"
      on public.finance_order_line_cost_allocations
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_order_line_cost_allocations'
      and policyname = 'partspro_finance_allocations_reconcile_update'
  ) then
    create policy "partspro_finance_allocations_reconcile_update"
      on public.finance_order_line_cost_allocations
      for update
      to authenticated
      using ((select private.partspro_has_permission('finance.cost_reconcile')))
      with check ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_order_line_cost_allocations'
      and policyname = 'partspro_finance_allocations_reconcile_delete'
  ) then
    create policy "partspro_finance_allocations_reconcile_delete"
      on public.finance_order_line_cost_allocations
      for delete
      to authenticated
      using ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_expense_entries'
      and policyname = 'partspro_finance_expenses_read'
  ) then
    create policy "partspro_finance_expenses_read"
      on public.finance_expense_entries
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('finance.read'))
        or (select private.partspro_has_permission('finance.manage'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_expense_entries'
      and policyname = 'partspro_finance_expenses_manage_insert'
  ) then
    create policy "partspro_finance_expenses_manage_insert"
      on public.finance_expense_entries
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_expense_entries'
      and policyname = 'partspro_finance_expenses_manage_update'
  ) then
    create policy "partspro_finance_expenses_manage_update"
      on public.finance_expense_entries
      for update
      to authenticated
      using ((select private.partspro_has_permission('finance.manage')))
      with check ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_expense_entries'
      and policyname = 'partspro_finance_expenses_manage_delete'
  ) then
    create policy "partspro_finance_expenses_manage_delete"
      on public.finance_expense_entries
      for delete
      to authenticated
      using ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_payments'
      and policyname = 'partspro_supplier_batch_payments_read'
  ) then
    create policy "partspro_supplier_batch_payments_read"
      on public.supplier_batch_payments
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('finance.read'))
        or (select private.partspro_has_permission('finance.manage'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_payments'
      and policyname = 'partspro_supplier_batch_payments_manage_insert'
  ) then
    create policy "partspro_supplier_batch_payments_manage_insert"
      on public.supplier_batch_payments
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_payments'
      and policyname = 'partspro_supplier_batch_payments_manage_update'
  ) then
    create policy "partspro_supplier_batch_payments_manage_update"
      on public.supplier_batch_payments
      for update
      to authenticated
      using ((select private.partspro_has_permission('finance.manage')))
      with check ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_payments'
      and policyname = 'partspro_supplier_batch_payments_manage_delete'
  ) then
    create policy "partspro_supplier_batch_payments_manage_delete"
      on public.supplier_batch_payments
      for delete
      to authenticated
      using ((select private.partspro_has_permission('finance.manage')));
  end if;
end
$$;

insert into public.finance_cost_layers (
  supplier_batch_line_id,
  supplier_batch_id,
  supplier_id,
  sku_code,
  batch_code,
  received_qty,
  unit_cost_net,
  total_cost_net,
  currency,
  vat_mode,
  vat_treatment,
  confidence,
  metadata,
  created_at,
  updated_at
)
select
  sbl.id,
  sb.id,
  sb.supplier_id,
  sbl.sku_code,
  nullif(btrim(sb.batch_code), ''),
  greatest(coalesce(sbl.qty_received, 0), 0),
  round(coalesce(
    case
      when coalesce(sbl.qty_received, 0) > 0 then nullif(sbl.line_total, 0) / nullif(sbl.qty_received, 0)
      else null
    end,
    sbl.unit_cost,
    0
  ), 4),
  round(coalesce(sbl.line_total, coalesce(sbl.unit_cost, 0) * greatest(coalesce(sbl.qty_received, 0), 0), 0), 2),
  coalesce(nullif(btrim(sb.currency), ''), 'EUR'),
  nullif(btrim(sb.vat_mode), ''),
  case
    when lower(coalesce(sb.vat_mode, '')) like '%esclus%' or lower(coalesce(sb.vat_mode, '')) like '%excluded%' then 'excluded'
    when lower(coalesce(sb.vat_mode, '')) like '%inclus%' or lower(coalesce(sb.vat_mode, '')) like '%included%' then 'included'
    else 'unknown'
  end,
  case
    when sbl.line_total is null or sbl.unit_cost is null or coalesce(sbl.qty_received, 0) <= 0 then 'estimated'
    when lower(coalesce(sb.vat_mode, '')) like '%inclus%' or lower(coalesce(sb.vat_mode, '')) like '%included%' then 'estimated'
    when nullif(btrim(sb.vat_mode), '') is null then 'estimated'
    else 'exact'
  end,
  jsonb_build_object(
    'source', 'supplier_batch_lines',
    'vat_mode_requires_review',
    not (lower(coalesce(sb.vat_mode, '')) like '%esclus%' or lower(coalesce(sb.vat_mode, '')) like '%excluded%'),
    'supplier_batch_code', sb.batch_code,
    'supplier_display_label', sup.display_label
  ),
  coalesce(sbl.created_at, sb.created_at, now()),
  now()
from public.supplier_batch_lines as sbl
join public.supplier_batches as sb on sb.id = sbl.batch_id
left join public.suppliers as sup on sup.id = sb.supplier_id
where nullif(btrim(coalesce(sbl.sku_code, '')), '') is not null
on conflict (supplier_batch_line_id) where supplier_batch_line_id is not null do update
set supplier_batch_id = excluded.supplier_batch_id,
    supplier_id = excluded.supplier_id,
    sku_code = excluded.sku_code,
    batch_code = excluded.batch_code,
    received_qty = excluded.received_qty,
    unit_cost_net = excluded.unit_cost_net,
    total_cost_net = excluded.total_cost_net,
    currency = excluded.currency,
    vat_mode = excluded.vat_mode,
    vat_treatment = excluded.vat_treatment,
    confidence = excluded.confidence,
    metadata = public.finance_cost_layers.metadata || excluded.metadata,
    updated_at = now();

create or replace function private.finance_insert_order_line_cost_allocation(
  p_order_id uuid,
  p_order_line_id uuid,
  p_sku_code text,
  p_batch_code text,
  p_inventory_item_id uuid,
  p_quantity integer,
  p_status text,
  p_source text,
  p_allocation_key text,
  p_recognized_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cost_layer_id uuid;
  v_supplier_batch_line_id uuid;
  v_layer_batch_code text;
  v_unit_cost_net numeric(12, 4);
  v_layer_confidence text;
  v_product_cost numeric(12, 4);
  v_confidence text;
  v_quantity integer := greatest(coalesce(p_quantity, 0), 0);
  v_batch_code text := nullif(btrim(coalesce(p_batch_code, '')), '');
begin
  if v_quantity <= 0 or nullif(btrim(coalesce(p_sku_code, '')), '') is null then
    return;
  end if;

  select
    fcl.id,
    fcl.supplier_batch_line_id,
    fcl.batch_code,
    fcl.unit_cost_net,
    fcl.confidence
  into
    v_cost_layer_id,
    v_supplier_batch_line_id,
    v_layer_batch_code,
    v_unit_cost_net,
    v_layer_confidence
  from public.finance_cost_layers as fcl
  where upper(fcl.sku_code) = upper(p_sku_code)
    and (
      v_batch_code is null
      or fcl.batch_code = v_batch_code
      or fcl.batch_code is null
    )
  order by
    case when v_batch_code is not null and fcl.batch_code = v_batch_code then 0 else 1 end,
    fcl.created_at desc
  limit 1;

  if v_unit_cost_net is null then
    select cost_price
    into v_product_cost
    from public.products
    where upper(sku_code) = upper(p_sku_code)
    order by updated_at desc
    limit 1;

    v_unit_cost_net := round(coalesce(v_product_cost, 0), 4);
    v_confidence := case when coalesce(v_product_cost, 0) > 0 then 'estimated' else 'unmatched' end;
  else
    v_confidence := coalesce(v_layer_confidence, 'exact');
  end if;

  insert into public.finance_order_line_cost_allocations (
    allocation_key,
    order_id,
    order_line_id,
    cost_layer_id,
    supplier_batch_line_id,
    inventory_item_id,
    sku_code,
    batch_code,
    quantity,
    unit_cost_net,
    total_cost_net,
    status,
    confidence,
    source,
    recognized_at,
    metadata
  )
  values (
    nullif(btrim(coalesce(p_allocation_key, '')), ''),
    p_order_id,
    p_order_line_id,
    v_cost_layer_id,
    v_supplier_batch_line_id,
    p_inventory_item_id,
    upper(btrim(p_sku_code)),
    coalesce(v_batch_code, v_layer_batch_code),
    v_quantity,
    round(coalesce(v_unit_cost_net, 0), 4),
    round(coalesce(v_unit_cost_net, 0) * v_quantity, 2),
    coalesce(nullif(p_status, ''), 'reserved'),
    v_confidence,
    coalesce(nullif(p_source, ''), 'manual'),
    p_recognized_at,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'resolved_cost_layer_id', v_cost_layer_id,
      'fallback_product_cost', v_product_cost
    )
  )
  on conflict (allocation_key) where allocation_key is not null do update
  set
    order_id = excluded.order_id,
    cost_layer_id = coalesce(public.finance_order_line_cost_allocations.cost_layer_id, excluded.cost_layer_id),
    supplier_batch_line_id = coalesce(public.finance_order_line_cost_allocations.supplier_batch_line_id, excluded.supplier_batch_line_id),
    inventory_item_id = coalesce(public.finance_order_line_cost_allocations.inventory_item_id, excluded.inventory_item_id),
    batch_code = coalesce(public.finance_order_line_cost_allocations.batch_code, excluded.batch_code),
    quantity = greatest(public.finance_order_line_cost_allocations.quantity, excluded.quantity),
    unit_cost_net = case
      when public.finance_order_line_cost_allocations.confidence = 'unmatched' then excluded.unit_cost_net
      else public.finance_order_line_cost_allocations.unit_cost_net
    end,
    total_cost_net = round(
      case
        when public.finance_order_line_cost_allocations.confidence = 'unmatched' then excluded.unit_cost_net
        else public.finance_order_line_cost_allocations.unit_cost_net
      end * greatest(public.finance_order_line_cost_allocations.quantity, excluded.quantity),
      2
    ),
    status = case
      when public.finance_order_line_cost_allocations.status = 'consumed' then 'consumed'
      else excluded.status
    end,
    confidence = case
      when public.finance_order_line_cost_allocations.confidence = 'exact' then 'exact'
      else excluded.confidence
    end,
    source = excluded.source,
    recognized_at = coalesce(public.finance_order_line_cost_allocations.recognized_at, excluded.recognized_at),
    metadata = public.finance_order_line_cost_allocations.metadata || excluded.metadata,
    updated_at = now();
end;
$$;

create or replace function private.finance_refresh_cost_layer_usage(p_cost_layer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_cost_layer_id is null then
    return;
  end if;

  update public.finance_cost_layers as fcl
  set
    allocated_qty = coalesce(usage.allocated_qty, 0),
    consumed_qty = coalesce(usage.consumed_qty, 0),
    updated_at = now()
  from (
    select
      p_cost_layer_id as cost_layer_id,
      coalesce(sum(quantity) filter (where status in ('reserved', 'consumed', 'backfilled')), 0)::integer as allocated_qty,
      coalesce(sum(quantity) filter (where status = 'consumed'), 0)::integer as consumed_qty
    from public.finance_order_line_cost_allocations
    where cost_layer_id = p_cost_layer_id
  ) as usage
  where fcl.id = usage.cost_layer_id;
end;
$$;

create or replace function private.finance_cost_allocation_usage_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.finance_refresh_cost_layer_usage(old.cost_layer_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform private.finance_refresh_cost_layer_usage(new.cost_layer_id);
    return new;
  end if;

  return old;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'finance_allocations_refresh_cost_layer_usage') then
    create trigger finance_allocations_refresh_cost_layer_usage
      after insert or update or delete on public.finance_order_line_cost_allocations
      for each row execute function private.finance_cost_allocation_usage_trigger();
  end if;
end
$$;

insert into public.finance_order_line_cost_allocations (
  allocation_key,
  order_id,
  order_line_id,
  cost_layer_id,
  supplier_batch_line_id,
  sku_code,
  batch_code,
  quantity,
  unit_cost_net,
  total_cost_net,
  status,
  confidence,
  source,
  recognized_at,
  metadata,
  created_at,
  updated_at
)
select
  'backfill:' || ol.id::text,
  o.id,
  ol.id,
  fcl.id,
  fcl.supplier_batch_line_id,
  upper(ol.sku_code),
  coalesce(nullif(btrim(ol.batch_code), ''), fcl.batch_code),
  greatest(
    case
      when coalesce(ol.fulfilled_qty, 0) > 0 then coalesce(ol.fulfilled_qty, 0)
      else coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0)
    end,
    0
  )::integer,
  round(coalesce(fcl.unit_cost_net, p.cost_price, 0), 4),
  round(
    coalesce(fcl.unit_cost_net, p.cost_price, 0) * greatest(
      case
        when coalesce(ol.fulfilled_qty, 0) > 0 then coalesce(ol.fulfilled_qty, 0)
        else coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0)
      end,
      0
    ),
    2
  ),
  case
    when coalesce(ol.fulfilled_qty, 0) > 0 or o.status in ('shipped', 'completed') then 'consumed'
    else 'backfilled'
  end,
  case
    when fcl.id is not null and coalesce(fcl.confidence, 'exact') = 'exact' then 'exact'
    when coalesce(fcl.unit_cost_net, p.cost_price, 0) > 0 then 'estimated'
    else 'unmatched'
  end,
  case
    when fcl.id is not null then 'backfill'
    when coalesce(p.cost_price, 0) > 0 then 'current_product_cost'
    else 'backfill'
  end,
  coalesce(o.payment_received_at, o.updated_at, o.created_at, now()),
  jsonb_build_object(
    'source', 'historical_backfill',
    'order_no', o.order_no,
    'order_status', o.status,
    'payment_status', o.payment_status,
    'source_batch_code', ol.batch_code,
    'requires_review', fcl.id is null or coalesce(fcl.confidence, 'exact') <> 'exact'
  ),
  coalesce(o.created_at, now()),
  now()
from public.order_lines as ol
join public.orders as o on o.id = ol.order_id
left join public.products as p on upper(p.sku_code) = upper(ol.sku_code)
left join lateral (
  select fcl.*
  from public.finance_cost_layers as fcl
  where upper(fcl.sku_code) = upper(ol.sku_code)
    and (
      nullif(btrim(coalesce(ol.batch_code, '')), '') is null
      or fcl.batch_code = nullif(btrim(ol.batch_code), '')
      or fcl.batch_code is null
    )
  order by
    case
      when nullif(btrim(coalesce(ol.batch_code, '')), '') is not null
        and fcl.batch_code = nullif(btrim(ol.batch_code), '') then 0
      else 1
    end,
    fcl.created_at desc
  limit 1
) as fcl on true
where coalesce(o.soft_deleted_at, null) is null
  and o.status <> 'cancelled'
  and greatest(
    case
      when coalesce(ol.fulfilled_qty, 0) > 0 then coalesce(ol.fulfilled_qty, 0)
      else coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0)
    end,
    0
  ) > 0
on conflict (allocation_key) where allocation_key is not null do nothing;

select private.finance_refresh_cost_layer_usage(id)
from public.finance_cost_layers;

create or replace function private.finance_order_line_cost_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocation jsonb;
  v_inventory_id uuid;
  v_allocation_batch text;
  v_quantity integer;
  v_fulfilled_delta integer := 0;
  v_existing_consumed integer := 0;
begin
  if tg_op = 'UPDATE' then
    v_fulfilled_delta := coalesce(new.fulfilled_qty, 0) - coalesce(old.fulfilled_qty, 0);
  else
    v_fulfilled_delta := coalesce(new.fulfilled_qty, 0);
  end if;

  for v_allocation in
    select value
    from jsonb_array_elements(coalesce(new.reservation_allocations, '[]'::jsonb))
  loop
    v_inventory_id := case
      when nullif(v_allocation ->> 'inventory_item_id', '') is null then null
      else (v_allocation ->> 'inventory_item_id')::uuid
    end;
    v_allocation_batch := nullif(btrim(coalesce(v_allocation ->> 'batch_code', new.batch_code, '')), '');
    v_quantity := greatest(coalesce((v_allocation ->> 'quantity')::integer, 0), 0);

    perform private.finance_insert_order_line_cost_allocation(
      new.order_id,
      new.id,
      new.sku_code,
      v_allocation_batch,
      v_inventory_id,
      v_quantity,
      case when coalesce(new.fulfilled_qty, 0) > 0 and coalesce(new.reserved_qty, 0) = 0 then 'consumed' else 'reserved' end,
      'reservation',
      'reservation:' || new.id::text || ':' || coalesce(v_inventory_id::text, coalesce(v_allocation_batch, 'no-batch')),
      case when coalesce(new.fulfilled_qty, 0) > 0 and coalesce(new.reserved_qty, 0) = 0 then now() else null end,
      jsonb_build_object('reservation_allocation', v_allocation)
    );
  end loop;

  if v_fulfilled_delta > 0 then
    update public.finance_order_line_cost_allocations
    set status = 'consumed',
        recognized_at = coalesce(recognized_at, now()),
        source = case when source = 'reservation' then 'consume' else source end,
        updated_at = now()
    where order_line_id = new.id
      and status in ('reserved', 'backfilled');

    select coalesce(sum(quantity), 0)::integer
    into v_existing_consumed
    from public.finance_order_line_cost_allocations
    where order_line_id = new.id
      and status = 'consumed';

    if v_existing_consumed < coalesce(new.fulfilled_qty, 0) then
      perform private.finance_insert_order_line_cost_allocation(
        new.order_id,
        new.id,
        new.sku_code,
        new.batch_code,
        null,
        coalesce(new.fulfilled_qty, 0) - v_existing_consumed,
        'consumed',
        'consume',
        'consume:' || new.id::text || ':' || coalesce(new.fulfilled_qty, 0)::text,
        now(),
        jsonb_build_object('source', 'fulfilled_qty_delta_without_reservation_snapshot')
      );
    end if;
  elsif tg_op = 'UPDATE'
    and coalesce(new.reserved_qty, 0) < coalesce(old.reserved_qty, 0)
    and coalesce(new.fulfilled_qty, 0) <= coalesce(old.fulfilled_qty, 0)
  then
    update public.finance_order_line_cost_allocations
    set status = 'released',
        updated_at = now(),
        metadata = metadata || jsonb_build_object('released_from_reserved_qty_delta', true)
    where order_line_id = new.id
      and status = 'reserved';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'finance_order_line_cost_snapshot') then
    create trigger finance_order_line_cost_snapshot
      after insert or update of reservation_allocations, reserved_qty, fulfilled_qty, stock_status
      on public.order_lines
      for each row execute function private.finance_order_line_cost_snapshot();
  end if;
end
$$;

create or replace function private.finance_audit_expense_entry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.partspro_audit_admin(
    case
      when tg_op = 'INSERT' then 'finance.expense.create'
      when tg_op = 'UPDATE' then 'finance.expense.update'
      else 'finance.expense.delete'
    end,
    'finance_expense_entry',
    coalesce(new.id, old.id)::text,
    case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end,
    case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end,
    'Finance expense ledger change',
    jsonb_build_object('category', coalesce(new.category, old.category))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function private.finance_audit_supplier_batch_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.partspro_audit_admin(
    case
      when tg_op = 'INSERT' then 'finance.supplier_payment.create'
      when tg_op = 'UPDATE' then 'finance.supplier_payment.update'
      else 'finance.supplier_payment.delete'
    end,
    'supplier_batch_payment',
    coalesce(new.id, old.id)::text,
    case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end,
    case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end,
    'Supplier batch payment ledger change',
    jsonb_build_object('batch_id', coalesce(new.batch_id, old.batch_id), 'supplier_id', coalesce(new.supplier_id, old.supplier_id))
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'finance_expenses_audit') then
    create trigger finance_expenses_audit
      after insert or update or delete on public.finance_expense_entries
      for each row execute function private.finance_audit_expense_entry();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'supplier_batch_payments_audit') then
    create trigger supplier_batch_payments_audit
      after insert or update or delete on public.supplier_batch_payments
      for each row execute function private.finance_audit_supplier_batch_payment();
  end if;
end
$$;
