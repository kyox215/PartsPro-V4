-- Supplier-batch inbound transport/cost-layer contract.
-- This migration is additive.  It intentionally keeps
-- supplier_batches.total_cost as goods value and routes all charge writes
-- through the permission-checked RPCs below.

insert into public.admin_permissions (id, label, group_name, description)
values (
  'supplier_batch.manage_costs',
  'Manage supplier batch costs',
  'supplier_batches',
  'Can save estimates and confirm inbound charges for supplier batches.'
)
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'supplier_batch.manage_costs'),
  ('purchasing', 'supplier_batch.manage_costs'),
  ('pricing_manager', 'supplier_batch.manage_costs')
on conflict do nothing;

-- Preserve existing unit_cost_net/total_cost_net as the final COGS/landed
-- consumption fields while adding an explicit goods/inbound breakdown.
alter table public.finance_cost_layers
  add column if not exists goods_unit_cost_net numeric(12, 4) not null default 0,
  add column if not exists goods_total_cost_net numeric(12, 2) not null default 0,
  add column if not exists inbound_charge_total_net numeric(12, 2) not null default 0;

-- Controlled one-time backfill for rows that received the new-column defaults.
update public.finance_cost_layers
set goods_unit_cost_net = unit_cost_net,
    goods_total_cost_net = total_cost_net,
    inbound_charge_total_net = 0
where goods_unit_cost_net = 0
  and goods_total_cost_net = 0
  and inbound_charge_total_net = 0
  and (unit_cost_net <> 0 or total_cost_net <> 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.finance_cost_layers'::regclass
      and conname = 'finance_cost_layers_breakdown_nonnegative'
  ) then
    alter table public.finance_cost_layers
      add constraint finance_cost_layers_breakdown_nonnegative
      check (
        goods_unit_cost_net >= 0
        and goods_total_cost_net >= 0
        and inbound_charge_total_net >= 0
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.finance_cost_layers'::regclass
      and conname = 'finance_cost_layers_total_breakdown_match'
  ) then
    alter table public.finance_cost_layers
      add constraint finance_cost_layers_total_breakdown_match
      check (
        supplier_batch_line_id is null
        or total_cost_net = round(goods_total_cost_net + inbound_charge_total_net, 2)
      );
  end if;
end
$$;

-- Legacy receiving RPCs predate the breakdown columns and only write the old
-- final-cost fields.  This compatibility trigger is deliberately scoped to
-- supplier-batch layers (supplier_batch_line_id is not null).  Non-supplier
-- finance layers are returned unchanged, so their historical breakdown values
-- and final-cost semantics are not guessed or rewritten here.
create or replace function private.finance_cost_layers_supplier_batch_compat()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_breakdown_changed boolean := false;
  v_legacy_total_changed boolean := false;
  v_legacy_unit_changed boolean := false;
  v_received_changed boolean := false;
  v_explicit_breakdown boolean := false;
  v_goods_total numeric := 0;
  v_inbound_total numeric := 0;
  v_final_total numeric := 0;
begin
  -- Compatibility applies only to supplier-batch cost layers.  In particular,
  -- do not coalesce, zero, or recalculate an unlinked historical layer.
  if new.supplier_batch_line_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_explicit_breakdown :=
      (coalesce(new.metadata, '{}'::jsonb) ? 'supplier_batch_transport')
      or coalesce(new.goods_unit_cost_net, 0) <> 0
      or coalesce(new.goods_total_cost_net, 0) <> 0
      or coalesce(new.inbound_charge_total_net, 0) <> 0;

    -- Old writers omit the breakdown columns.  Map that legacy shape to the
    -- goods component, preferring its old total and falling back to unit*qty.
    if not v_explicit_breakdown
       and coalesce(new.goods_unit_cost_net, 0) = 0
       and coalesce(new.goods_total_cost_net, 0) = 0
       and coalesce(new.inbound_charge_total_net, 0) = 0
       and (
         coalesce(new.unit_cost_net, 0) <> 0
         or coalesce(new.total_cost_net, 0) <> 0
       ) then
      v_goods_total := case
        when coalesce(new.total_cost_net, 0) <> 0 then round(new.total_cost_net, 2)
        else round(coalesce(new.unit_cost_net, 0) * coalesce(new.received_qty, 0), 2)
      end;
      new.goods_total_cost_net := v_goods_total;
      new.goods_unit_cost_net := case
        when coalesce(new.received_qty, 0) > 0 then
          round(v_goods_total / new.received_qty, 4)
        else coalesce(nullif(new.unit_cost_net, 0), 0)
      end;
      new.inbound_charge_total_net := 0;
    else
      -- Explicit breakdown inserts must already carry the matching final
      -- total.  Do not silently overwrite a caller's inconsistent total.
      v_goods_total := coalesce(new.goods_total_cost_net, 0);
      v_inbound_total := coalesce(new.inbound_charge_total_net, 0);
      if round(coalesce(new.total_cost_net, 0), 2)
           <> round(v_goods_total + v_inbound_total, 2) then
        raise exception 'Supplier batch finance layer total must equal goods plus inbound breakdown'
          using errcode = '23514', detail = 'BREAKDOWN_INCONSISTENT';
      end if;
      if coalesce(new.received_qty, 0) > 0
         and round(coalesce(new.goods_unit_cost_net, 0), 4)
             <> round(v_goods_total / new.received_qty, 4) then
        raise exception 'Supplier batch goods unit must match goods total and received quantity'
          using errcode = '23514', detail = 'BREAKDOWN_UNIT_INCONSISTENT';
      end if;
    end if;

    v_goods_total := coalesce(new.goods_total_cost_net, 0);
    v_inbound_total := coalesce(new.inbound_charge_total_net, 0);
    if coalesce(new.received_qty, 0) = 0 and v_inbound_total > 0 then
      raise exception 'Supplier batch finance layer with positive inbound cost requires received quantity'
        using errcode = '23514';
    end if;
    v_final_total := round(v_goods_total + v_inbound_total, 2);
    new.total_cost_net := v_final_total;
    if coalesce(new.received_qty, 0) > 0 then
      new.unit_cost_net := round(v_final_total / new.received_qty, 4);
    else
      -- A zero-quantity layer may retain an informative unit cost; do not
      -- force it to zero merely because it cannot be divided at this time.
      new.unit_cost_net := coalesce(
        nullif(new.unit_cost_net, 0),
        nullif(new.goods_unit_cost_net, 0),
        0
      );
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_breakdown_changed :=
      new.goods_unit_cost_net is distinct from old.goods_unit_cost_net
      or new.goods_total_cost_net is distinct from old.goods_total_cost_net
      or new.inbound_charge_total_net is distinct from old.inbound_charge_total_net;

    v_legacy_total_changed := new.total_cost_net is distinct from old.total_cost_net;
    v_legacy_unit_changed := new.unit_cost_net is distinct from old.unit_cost_net;
    v_received_changed := new.received_qty is distinct from old.received_qty;

    if v_breakdown_changed then
      -- Explicit breakdown updates are authoritative only when their final
      -- total agrees.  The trigger may derive the unit field, but never fixes
      -- an inconsistent total or reclassifies inbound as goods.
      v_goods_total := coalesce(new.goods_total_cost_net, 0);
      v_inbound_total := coalesce(new.inbound_charge_total_net, 0);
      if round(coalesce(new.total_cost_net, 0), 2)
           <> round(v_goods_total + v_inbound_total, 2) then
        raise exception 'Supplier batch finance layer total must equal goods plus inbound breakdown'
          using errcode = '23514', detail = 'BREAKDOWN_INCONSISTENT';
      end if;
      if coalesce(new.received_qty, 0) > 0
         and round(coalesce(new.goods_unit_cost_net, 0), 4)
             <> round(v_goods_total / new.received_qty, 4) then
        raise exception 'Supplier batch goods unit must match goods total and received quantity'
          using errcode = '23514', detail = 'BREAKDOWN_UNIT_INCONSISTENT';
      end if;
    elsif v_legacy_total_changed or v_legacy_unit_changed then
      -- A legacy writer changed a cost field without touching the breakdown.
      -- Only this branch reconstructs goods; received-only updates below never
      -- mistake the old landed total for goods and never add inbound twice.
      new.inbound_charge_total_net := coalesce(old.inbound_charge_total_net, 0);
      if v_legacy_total_changed then
        new.goods_total_cost_net := round(coalesce(new.total_cost_net, 0), 2);
        new.goods_unit_cost_net := case
          when coalesce(new.received_qty, 0) > 0 then
            round(new.goods_total_cost_net / new.received_qty, 4)
          else coalesce(
            nullif(new.unit_cost_net, 0),
            nullif(old.goods_unit_cost_net, 0),
            nullif(old.unit_cost_net, 0),
            0
          )
        end;
      elsif coalesce(new.received_qty, 0) > 0 then
        new.goods_unit_cost_net := round(coalesce(new.unit_cost_net, 0), 4);
        new.goods_total_cost_net := round(
          new.goods_unit_cost_net * new.received_qty,
          2
        );
      else
        new.goods_total_cost_net := coalesce(old.goods_total_cost_net, 0);
        new.goods_unit_cost_net := coalesce(
          nullif(new.unit_cost_net, 0),
          nullif(old.goods_unit_cost_net, 0),
          nullif(old.unit_cost_net, 0),
          0
        );
      end if;
    elsif v_received_changed then
      -- Preserve both component totals.  Recompute only the unit fields for a
      -- changed received quantity; this is the legacy received-only boundary.
      new.goods_total_cost_net := coalesce(old.goods_total_cost_net, 0);
      new.inbound_charge_total_net := coalesce(old.inbound_charge_total_net, 0);
      if coalesce(new.received_qty, 0) > 0 then
        new.goods_unit_cost_net := round(
          new.goods_total_cost_net / new.received_qty,
          4
        );
      else
        new.goods_unit_cost_net := coalesce(old.goods_unit_cost_net, 0);
      end if;
    else
      return new;
    end if;

    v_goods_total := coalesce(new.goods_total_cost_net, 0);
    v_inbound_total := coalesce(new.inbound_charge_total_net, 0);
    if coalesce(new.received_qty, 0) = 0 and v_inbound_total > 0 then
      raise exception 'Supplier batch finance layer with positive inbound cost requires received quantity'
        using errcode = '23514';
    end if;
    v_final_total := round(v_goods_total + v_inbound_total, 2);
    new.total_cost_net := v_final_total;
    if coalesce(new.received_qty, 0) > 0 then
      new.unit_cost_net := round(v_final_total / new.received_qty, 4);
    elsif v_breakdown_changed then
      new.unit_cost_net := coalesce(
        nullif(new.unit_cost_net, 0),
        nullif(new.goods_unit_cost_net, 0),
        nullif(old.unit_cost_net, 0),
        0
      );
    else
      new.unit_cost_net := coalesce(
        nullif(new.unit_cost_net, 0),
        nullif(old.unit_cost_net, 0),
        nullif(new.goods_unit_cost_net, 0),
        0
      );
    end if;
  end if;
  return new;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.finance_cost_layers'::regclass
      and tgname = 'finance_cost_layers_supplier_batch_compat'
  ) then
    create trigger finance_cost_layers_supplier_batch_compat
      before insert or update of
        received_qty,
        unit_cost_net,
        total_cost_net,
        goods_unit_cost_net,
        goods_total_cost_net,
        inbound_charge_total_net
      on public.finance_cost_layers
      for each row
      execute function private.finance_cost_layers_supplier_batch_compat();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_batch_lines'::regclass
      and conname = 'supplier_batch_lines_id_batch_unique'
  ) then
    alter table public.supplier_batch_lines
      add constraint supplier_batch_lines_id_batch_unique unique (id, batch_id);
  end if;
end
$$;

create table if not exists public.supplier_batch_charges (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.supplier_batches(id) on update cascade on delete restrict,
  charge_type text not null default 'transport',
  status text not null default 'estimated',
  amount_net numeric(14, 2) not null default 0,
  vat_amount numeric(14, 2) not null default 0,
  amount_gross numeric(14, 2)
    generated always as (round(amount_net + vat_amount, 2)) stored,
  capitalized_amount numeric(14, 2) not null default 0,
  currency text not null default 'EUR',
  vat_treatment text not null default 'unknown',
  allocation_method text not null default 'goods_value',
  carrier_name text,
  reference text,
  occurred_at timestamptz,
  evidence_url text,
  notes text,
  zero_cost_reason text,
  idempotency_key text not null,
  payload_fingerprint text not null,
  manual_allocations_snapshot jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_batch_charges_type_check
    check (charge_type in ('transport', 'insurance', 'customs', 'handling', 'other')),
  constraint supplier_batch_charges_status_check
    check (status in ('estimated', 'confirmed', 'cancelled')),
  constraint supplier_batch_charges_amount_nonnegative
    check (amount_net >= 0 and vat_amount >= 0 and capitalized_amount >= 0),
  constraint supplier_batch_charges_currency_not_blank
    check (nullif(btrim(currency), '') is not null),
  constraint supplier_batch_charges_currency_eur
    check (currency = 'EUR'),
  constraint supplier_batch_charges_vat_treatment_check
    check (vat_treatment in ('recoverable', 'non_recoverable', 'unknown')),
  constraint supplier_batch_charges_allocation_method_check
    check (allocation_method in ('goods_value', 'received_qty', 'weight', 'manual')),
  constraint supplier_batch_charges_capitalized_not_over_gross
    check (capitalized_amount <= amount_gross),
  constraint supplier_batch_charges_confirmed_vat_known
    check (status <> 'confirmed' or vat_treatment <> 'unknown'),
  constraint supplier_batch_charges_zero_reason_required
    check (
      capitalized_amount > 0
      or nullif(btrim(coalesce(zero_cost_reason, '')), '') is not null
    ),
  constraint supplier_batch_charges_confirmed_actor_required
    check (
      status <> 'confirmed'
      or (confirmed_by is not null and confirmed_at is not null)
    ),
  constraint supplier_batch_charges_idempotency_not_blank
    check (nullif(btrim(idempotency_key), '') is not null),
  constraint supplier_batch_charges_fingerprint_not_blank
    check (nullif(btrim(payload_fingerprint), '') is not null),
  constraint supplier_batch_charges_manual_snapshot_array
    check (jsonb_typeof(manual_allocations_snapshot) = 'array'),
  constraint supplier_batch_charges_id_batch_unique
    unique (id, batch_id),
  constraint supplier_batch_charges_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.supplier_batch_charge_allocations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.supplier_batches(id) on update cascade on delete restrict,
  charge_id uuid not null,
  batch_line_id uuid not null,
  qty_received_snapshot integer not null default 0,
  goods_cost_snapshot numeric(14, 2) not null default 0,
  weight_gram_snapshot integer not null default 0,
  basis_value numeric(20, 8) not null default 0,
  share_ratio numeric(20, 12) not null default 0,
  allocated_amount numeric(14, 2) not null default 0,
  allocated_unit_amount numeric(14, 4) not null default 0,
  rounding_adjustment numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_batch_charge_allocations_unique_line
    unique (charge_id, batch_line_id),
  constraint supplier_batch_charge_allocations_charge_batch_fk
    foreign key (charge_id, batch_id)
    references public.supplier_batch_charges(id, batch_id)
    on update cascade on delete cascade,
  constraint supplier_batch_charge_allocations_line_batch_fk
    foreign key (batch_line_id, batch_id)
    references public.supplier_batch_lines(id, batch_id)
    on update cascade on delete restrict,
  constraint supplier_batch_charge_allocations_qty_nonnegative
    check (qty_received_snapshot >= 0),
  constraint supplier_batch_charge_allocations_goods_nonnegative
    check (goods_cost_snapshot >= 0),
  constraint supplier_batch_charge_allocations_weight_nonnegative
    check (weight_gram_snapshot >= 0),
  constraint supplier_batch_charge_allocations_basis_nonnegative
    check (basis_value >= 0),
  constraint supplier_batch_charge_allocations_share_range
    check (share_ratio >= 0 and share_ratio <= 1),
  constraint supplier_batch_charge_allocations_amount_nonnegative
    check (allocated_amount >= 0 and allocated_unit_amount >= 0),
  constraint supplier_batch_charge_allocations_rounding_range
    check (rounding_adjustment >= -0.01 and rounding_adjustment <= 0.01),
  constraint supplier_batch_charge_allocations_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists supplier_batch_charges_batch_idx
  on public.supplier_batch_charges (batch_id, status, occurred_at desc, created_at desc);

create unique index if not exists supplier_batch_charges_idempotency_uidx
  on public.supplier_batch_charges (idempotency_key);

create index if not exists supplier_batch_charges_created_by_idx
  on public.supplier_batch_charges (created_by);

create index if not exists supplier_batch_charges_updated_by_idx
  on public.supplier_batch_charges (updated_by);

create index if not exists supplier_batch_charges_confirmed_by_idx
  on public.supplier_batch_charges (confirmed_by);

create index if not exists supplier_batch_charge_allocations_charge_idx
  on public.supplier_batch_charge_allocations (batch_id, charge_id, batch_line_id);

create index if not exists supplier_batch_charge_allocations_batch_line_idx
  on public.supplier_batch_charge_allocations (batch_id, batch_line_id, charge_id);

-- Keep indexes in the same column order as both composite foreign keys; the
-- batch-leading reporting indexes above do not replace these FK checks.
create index if not exists supplier_batch_charge_allocations_charge_batch_fk_idx
  on public.supplier_batch_charge_allocations (charge_id, batch_id);

create index if not exists supplier_batch_charge_allocations_line_batch_fk_idx
  on public.supplier_batch_charge_allocations (batch_line_id, batch_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.supplier_batch_charges'::regclass
      and tgname = 'supplier_batch_charges_set_updated_at'
  ) then
    create trigger supplier_batch_charges_set_updated_at
      before update on public.supplier_batch_charges
      for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.supplier_batch_charge_allocations'::regclass
      and tgname = 'supplier_batch_charge_allocations_set_updated_at'
  ) then
    create trigger supplier_batch_charge_allocations_set_updated_at
      before update on public.supplier_batch_charge_allocations
      for each row execute function public.set_updated_at();
  end if;
end
$$;

alter table public.supplier_batch_charges enable row level security;
alter table public.supplier_batch_charge_allocations enable row level security;

-- The new tables are read-only through the Data API.  All writes must use
-- the permission-checked SECURITY DEFINER RPCs below.
revoke all on table public.supplier_batch_charges from public, anon, authenticated, service_role;
revoke all on table public.supplier_batch_charge_allocations from public, anon, authenticated, service_role;
grant select on table public.supplier_batch_charges to authenticated, service_role;
grant select on table public.supplier_batch_charge_allocations to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_charges'
      and policyname = 'partspro_supplier_batch_charges_staff_read'
  ) then
    create policy "partspro_supplier_batch_charges_staff_read"
      on public.supplier_batch_charges
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('product.read_admin'))
        or (select private.partspro_has_permission('products.read_admin'))
        or (select private.partspro_has_permission('supplier_batch.manage_costs'))
        or (select private.partspro_has_permission('finance.read'))
        or (select private.partspro_has_permission('finance.cost_reconcile'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_charge_allocations'
      and policyname = 'partspro_supplier_batch_charge_allocations_staff_read'
  ) then
    create policy "partspro_supplier_batch_charge_allocations_staff_read"
      on public.supplier_batch_charge_allocations
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('product.read_admin'))
        or (select private.partspro_has_permission('products.read_admin'))
        or (select private.partspro_has_permission('supplier_batch.manage_costs'))
        or (select private.partspro_has_permission('finance.read'))
        or (select private.partspro_has_permission('finance.cost_reconcile'))
      );
  end if;
end
$$;

create or replace function private.supplier_batch_charge_revision(
  p_batch_id uuid
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select md5(
    jsonb_build_object(
      'batch', jsonb_build_object(
        'id', batch.id,
        'batchCode', batch.batch_code,
        'currency', batch.currency,
        'updatedAt', batch.updated_at
      ),
      'lines', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', line.id,
            'lineNo', line.line_no,
            'skuCode', line.sku_code,
            'qtyReceived', line.qty_received,
            'unitCost', line.unit_cost,
            'updatedAt', line.updated_at,
            'productId', product.id,
            'weightGram', product.weight_gram,
            'productUpdatedAt', product.updated_at
          )
          order by line.id, line.line_no
        )
        from public.supplier_batch_lines as line
        left join public.products as product on product.sku_code = line.sku_code
        where line.batch_id = batch.id
      ), '[]'::jsonb),
      'charges', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', charge.id,
            'batchId', charge.batch_id,
            'chargeType', charge.charge_type,
            'status', charge.status,
            'amountNet', charge.amount_net,
            'vatAmount', charge.vat_amount,
            'amountGross', charge.amount_gross,
            'capitalizedAmount', charge.capitalized_amount,
            'currency', charge.currency,
            'vatTreatment', charge.vat_treatment,
            'allocationMethod', charge.allocation_method,
            'carrierName', charge.carrier_name,
            'reference', charge.reference,
            'occurredAt', charge.occurred_at,
            'evidenceUrl', charge.evidence_url,
            'notes', charge.notes,
            'zeroCostReason', charge.zero_cost_reason,
            'idempotencyKey', charge.idempotency_key,
            'payloadFingerprint', charge.payload_fingerprint,
            'manualAllocationsSnapshot', charge.manual_allocations_snapshot,
            'createdBy', charge.created_by,
            'updatedBy', charge.updated_by,
            'confirmedBy', charge.confirmed_by,
            'confirmedAt', charge.confirmed_at,
            'metadata', charge.metadata,
            'createdAt', charge.created_at,
            'updatedAt', charge.updated_at
          )
          order by charge.id
        )
        from public.supplier_batch_charges as charge
        where charge.batch_id = batch.id
      ), '[]'::jsonb)
    )::text
  )
  from public.supplier_batches as batch
  where batch.id = p_batch_id
$$;

create or replace function private.normalise_supplier_batch_manual_allocations(
  p_manual_allocations jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_manual_allocations is null
     or jsonb_typeof(p_manual_allocations) <> 'array' then
    raise exception 'manualAllocations must be a JSON array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_manual_allocations) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or nullif(btrim(coalesce(item.value ->> 'batchLineId', '')), '') is null
      or nullif(btrim(coalesce(item.value ->> 'amount', '')), '') is null
  ) then
    raise exception 'Manual allocations require batchLineId and amount for every row'
      using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'batchLineId', (item.value ->> 'batchLineId')::uuid,
        'amount', round((item.value ->> 'amount')::numeric, 2)
      )
      order by
        (item.value ->> 'batchLineId')::uuid,
        round((item.value ->> 'amount')::numeric, 2)
    )
    from jsonb_array_elements(p_manual_allocations) as item(value)
  ), '[]'::jsonb);
end
$$;

create or replace function private.supplier_batch_charge_fingerprint(
  p_charge_type text,
  p_amount_net numeric,
  p_vat_amount numeric,
  p_amount_gross numeric,
  p_capitalized_amount numeric,
  p_currency text,
  p_vat_treatment text,
  p_allocation_method text,
  p_carrier_name text,
  p_charge_reference text,
  p_occurred_at timestamptz,
  p_evidence_url text,
  p_notes text,
  p_zero_cost_reason text,
  p_manual_allocations jsonb,
  p_metadata jsonb
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select md5(
    jsonb_build_object(
      'chargeType', p_charge_type,
      'amountNet', round(p_amount_net, 2),
      'vatAmount', round(p_vat_amount, 2),
      'amountGross', round(p_amount_gross, 2),
      'capitalizedAmount', round(p_capitalized_amount, 2),
      'currency', upper(p_currency),
      'vatTreatment', p_vat_treatment,
      'allocationMethod', p_allocation_method,
      'carrierName', p_carrier_name,
      'reference', p_charge_reference,
      'occurredAt', p_occurred_at,
      'evidenceUrl', p_evidence_url,
      'notes', p_notes,
      'zeroCostReason', p_zero_cost_reason,
      'manualAllocations', private.normalise_supplier_batch_manual_allocations(
        coalesce(p_manual_allocations, '[]'::jsonb)
      ),
      'userMetadata', coalesce(p_metadata, '{}'::jsonb)
    )::text
  )
$$;

create or replace function private.parse_supplier_batch_charge_payload(
  p_payload jsonb,
  p_idempotency_key text default null
)
returns table (
  charge_id uuid,
  charge_type text,
  amount_net numeric,
  vat_amount numeric,
  amount_gross numeric,
  capitalized_amount numeric,
  currency text,
  vat_treatment text,
  allocation_method text,
  carrier_name text,
  charge_reference text,
  occurred_at timestamptz,
  evidence_url text,
  notes text,
  zero_cost_reason text,
  idempotency_key text,
  manual_allocations jsonb,
  metadata jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_charge_id uuid;
  v_charge_type text;
  v_amount_net numeric;
  v_vat_amount numeric;
  v_amount_gross numeric;
  v_capitalized_amount numeric;
  v_currency text;
  v_vat_treatment text;
  v_allocation_method text;
  v_carrier_name text;
  v_charge_reference text;
  v_occurred_at timestamptz;
  v_evidence_url text;
  v_notes text;
  v_zero_cost_reason text;
  v_idempotency_key text;
  v_manual_allocations jsonb;
  v_metadata jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Charge payload must be a JSON object' using errcode = '22023';
  end if;

  v_charge_id := case
    when nullif(btrim(coalesce(p_payload ->> 'chargeId', '')), '') is null then null
    else (p_payload ->> 'chargeId')::uuid
  end;
  v_charge_type := lower(coalesce(nullif(btrim(p_payload ->> 'chargeType'), ''), 'transport'));
  v_amount_net := round(coalesce(nullif(btrim(p_payload ->> 'amountNet'), ''), '0')::numeric, 2);
  v_vat_amount := round(coalesce(nullif(btrim(p_payload ->> 'vatAmount'), ''), '0')::numeric, 2);
  v_amount_gross := round(v_amount_net + v_vat_amount, 2);
  if not p_payload ? 'capitalizedAmount'
     or nullif(btrim(coalesce(p_payload ->> 'capitalizedAmount', '')), '') is null then
    raise exception 'capitalizedAmount must be explicitly provided' using errcode = '22023';
  end if;
  v_capitalized_amount := round((p_payload ->> 'capitalizedAmount')::numeric, 2);
  v_currency := upper(coalesce(nullif(btrim(p_payload ->> 'currency'), ''), 'EUR'));
  v_vat_treatment := lower(coalesce(nullif(btrim(p_payload ->> 'vatTreatment'), ''), 'unknown'));
  v_allocation_method := lower(coalesce(nullif(btrim(p_payload ->> 'allocationMethod'), ''), 'goods_value'));
  v_carrier_name := nullif(btrim(coalesce(p_payload ->> 'carrierName', '')), '');
  v_charge_reference := nullif(btrim(coalesce(p_payload ->> 'reference', '')), '');
  v_occurred_at := case
    when nullif(btrim(coalesce(p_payload ->> 'occurredAt', '')), '') is null then null
    else (p_payload ->> 'occurredAt')::timestamptz
  end;
  v_evidence_url := nullif(btrim(coalesce(p_payload ->> 'evidenceUrl', '')), '');
  v_notes := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_zero_cost_reason := nullif(btrim(coalesce(p_payload ->> 'zeroCostReason', '')), '');
  v_idempotency_key := nullif(
    btrim(coalesce(p_idempotency_key, p_payload ->> 'idempotencyKey', '')),
    ''
  );

  if p_payload ? 'manualAllocations'
     and jsonb_typeof(p_payload -> 'manualAllocations') <> 'array' then
    raise exception 'manualAllocations must be a JSON array' using errcode = '22023';
  end if;
  v_manual_allocations := coalesce(p_payload -> 'manualAllocations', '[]'::jsonb);
  v_manual_allocations := private.normalise_supplier_batch_manual_allocations(v_manual_allocations);
  -- Manual rows are part of the business payload only for manual allocation.
  -- Clearing them for other methods makes estimate/confirm retries stable even
  -- when a stale UI draft still carries a manualAllocations array.
  if v_allocation_method <> 'manual' then
    v_manual_allocations := '[]'::jsonb;
  end if;

  if p_payload ? 'metadata'
     and jsonb_typeof(p_payload -> 'metadata') <> 'object' then
    raise exception 'metadata must be a JSON object' using errcode = '22023';
  end if;
  v_metadata := coalesce(p_payload -> 'metadata', '{}'::jsonb);

  if v_charge_type not in ('transport', 'insurance', 'customs', 'handling', 'other') then
    raise exception 'Unsupported supplier batch charge type: %', v_charge_type using errcode = '22023';
  end if;
  if v_vat_treatment not in ('recoverable', 'non_recoverable', 'unknown') then
    raise exception 'Unsupported VAT treatment: %', v_vat_treatment using errcode = '22023';
  end if;
  if v_allocation_method not in ('goods_value', 'received_qty', 'weight', 'manual') then
    raise exception 'Unsupported allocation method: %', v_allocation_method using errcode = '22023';
  end if;
  if v_currency <> 'EUR' then
    raise exception 'Only EUR supplier batch costs are supported by this version' using errcode = '22023';
  end if;
  if v_amount_net < 0 or v_vat_amount < 0 or v_capitalized_amount < 0 then
    raise exception 'Charge amounts cannot be negative' using errcode = '22023';
  end if;
  if v_capitalized_amount > v_amount_gross then
    raise exception 'Capitalized amount cannot exceed gross amount' using errcode = '22023';
  end if;
  if v_capitalized_amount = 0 and v_zero_cost_reason is null then
    raise exception 'zeroCostReason is required when capitalized amount is zero' using errcode = '22023';
  end if;
  return query
  select
    v_charge_id,
    v_charge_type,
    v_amount_net,
    v_vat_amount,
    v_amount_gross,
    v_capitalized_amount,
    v_currency,
    v_vat_treatment,
    v_allocation_method,
    v_carrier_name,
    v_charge_reference,
    v_occurred_at,
    v_evidence_url,
    v_notes,
    v_zero_cost_reason,
    v_idempotency_key,
    v_manual_allocations,
    v_metadata;
end
$$;

create or replace function private.calculate_supplier_batch_charge_allocations(
  p_batch_id uuid,
  p_allocation_method text,
  p_capitalized_amount numeric,
  p_manual_allocations jsonb default '[]'::jsonb
)
returns table (
  batch_line_id uuid,
  line_no integer,
  sku_code text,
  qty_received_snapshot integer,
  goods_cost_snapshot numeric,
  weight_gram_snapshot integer,
  basis_value numeric,
  share_ratio numeric,
  allocated_amount numeric,
  allocated_unit_amount numeric,
  landed_line_cost numeric,
  landed_unit_cost numeric,
  rounding_adjustment numeric
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_eligible_count integer := 0;
  v_invalid_count integer := 0;
  v_manual_count integer := 0;
  v_manual_distinct integer := 0;
  v_manual_sum numeric := 0;
  v_total_basis numeric := 0;
begin
  if p_allocation_method not in ('goods_value', 'received_qty', 'weight', 'manual') then
    raise exception 'Unsupported allocation method: %', p_allocation_method using errcode = '22023';
  end if;

  select count(*)::integer
  into v_eligible_count
  from public.supplier_batch_lines as line
  left join public.products as product on product.sku_code = line.sku_code
  where line.batch_id = p_batch_id
    and line.qty_received > 0
    and nullif(btrim(coalesce(line.sku_code, '')), '') is not null
    and product.sku_code is not null;

  select count(*)::integer
  into v_invalid_count
  from public.supplier_batch_lines as line
  left join public.products as product on product.sku_code = line.sku_code
  where line.batch_id = p_batch_id
    and line.qty_received > 0
    and (
      nullif(btrim(coalesce(line.sku_code, '')), '') is null
      or product.sku_code is null
    );

  if v_invalid_count > 0 then
    raise exception 'Every received supplier batch line must resolve to a product SKU' using errcode = '23514';
  end if;

  if p_allocation_method = 'weight' and exists (
    select 1
    from public.supplier_batch_lines as line
    join public.products as product on product.sku_code = line.sku_code
    where line.batch_id = p_batch_id
      and line.qty_received > 0
      and coalesce(product.weight_gram, 0) <= 0
  ) then
    raise exception 'Weight allocation requires weight_gram > 0 for every eligible product' using errcode = '23514';
  end if;

  if p_allocation_method = 'manual' then
    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_manual_allocations, '[]'::jsonb)) as item(value)
      where nullif(btrim(coalesce(item.value ->> 'batchLineId', '')), '') is null
         or nullif(btrim(coalesce(item.value ->> 'amount', '')), '') is null
    ) then
      raise exception 'Manual allocations require batchLineId and amount for every row' using errcode = '22023';
    end if;
    select
      count(*)::integer,
      count(distinct nullif(item.value ->> 'batchLineId', '')::uuid)::integer,
      coalesce(sum(round((item.value ->> 'amount')::numeric, 2)), 0)
    into v_manual_count, v_manual_distinct, v_manual_sum
    from jsonb_array_elements(coalesce(p_manual_allocations, '[]'::jsonb)) as item(value);

    if v_manual_count <> v_manual_distinct then
      raise exception 'Manual allocations must contain each batchLineId exactly once' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_manual_allocations, '[]'::jsonb)) as item(value)
      where not exists (
        select 1
        from public.supplier_batch_lines as line
        where line.id = nullif(item.value ->> 'batchLineId', '')::uuid
          and line.batch_id = p_batch_id
          and line.qty_received > 0
      )
    ) then
      raise exception 'Manual allocations may only reference eligible lines in the selected batch' using errcode = '22023';
    end if;
    if v_manual_count <> v_eligible_count then
      raise exception 'Manual allocations must cover every eligible received line' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(coalesce(p_manual_allocations, '[]'::jsonb)) as item(value)
      where round((item.value ->> 'amount')::numeric, 2) < 0
    ) then
      raise exception 'Manual allocation amounts cannot be negative' using errcode = '22023';
    end if;
    if round(v_manual_sum, 2) <> round(p_capitalized_amount, 2) then
      raise exception 'Manual allocation total must equal capitalized amount' using errcode = '22023';
    end if;
  end if;

  if v_eligible_count = 0 then
    if p_capitalized_amount > 0 then
      raise exception 'A positive capitalized amount requires eligible received lines' using errcode = '23514';
    end if;
    return;
  end if;

  if p_allocation_method = 'manual' then
    v_total_basis := round(p_capitalized_amount, 2);
  else
    select coalesce(sum(
      case p_allocation_method
        when 'goods_value' then round(line.qty_received::numeric * line.unit_cost, 2)
        when 'received_qty' then line.qty_received::numeric
        when 'weight' then line.qty_received::numeric * product.weight_gram::numeric
        else 0
      end
    ), 0)
    into v_total_basis
    from public.supplier_batch_lines as line
    join public.products as product on product.sku_code = line.sku_code
    where line.batch_id = p_batch_id
      and line.qty_received > 0;
  end if;

  if p_capitalized_amount > 0 and v_total_basis <= 0 then
    raise exception 'Allocation basis must be positive for a positive capitalized amount' using errcode = '23514';
  end if;

  return query
  with eligible as (
    select
      line.id as line_id,
      line.line_no,
      line.sku_code,
      line.qty_received,
      round(line.qty_received::numeric * line.unit_cost, 2) as goods_cost,
      coalesce(product.weight_gram, 0) as weight_gram
    from public.supplier_batch_lines as line
    join public.products as product on product.sku_code = line.sku_code
    where line.batch_id = p_batch_id
      and line.qty_received > 0
  ),
  manual as (
    select
      nullif(item.value ->> 'batchLineId', '')::uuid as line_id,
      round((item.value ->> 'amount')::numeric, 2) as manual_amount
    from jsonb_array_elements(coalesce(p_manual_allocations, '[]'::jsonb)) as item(value)
  ),
  basis as (
    select
      eligible.*,
      case p_allocation_method
        when 'goods_value' then eligible.goods_cost
        when 'received_qty' then eligible.qty_received::numeric
        when 'weight' then eligible.qty_received::numeric * eligible.weight_gram::numeric
        when 'manual' then manual.manual_amount
        else 0
      end as basis
    from eligible
    left join manual on manual.line_id = eligible.line_id
  ),
  raw as (
    select
      basis.*,
      round(
        case
          when v_total_basis > 0 then p_capitalized_amount * 100 * basis.basis / v_total_basis
          else 0
        end,
        12
      ) as raw_cents
    from basis
  ),
  floored as (
    select
      raw.*,
      floor(raw.raw_cents)::bigint as floor_cents,
      raw.raw_cents - floor(raw.raw_cents) as fractional_cents
    from raw
  ),
  ranked as (
    select
      floored.*,
      row_number() over (
        order by floored.fractional_cents desc, floored.line_no, floored.line_id
      ) as fractional_rank,
      sum(floored.floor_cents) over () as floor_total
    from floored
  ),
  allocated as (
    select
      ranked.*,
      ranked.floor_cents + case
        when ranked.fractional_rank <= (
          round(p_capitalized_amount * 100, 0)::bigint - ranked.floor_total
        ) then 1
        else 0
      end as allocated_cents
    from ranked
  )
  select
    allocated.line_id,
    allocated.line_no,
    allocated.sku_code,
    allocated.qty_received,
    allocated.goods_cost,
    allocated.weight_gram,
    round(allocated.basis, 8),
    round(
      case when v_total_basis > 0 then allocated.basis / v_total_basis else 0 end,
      12
    ),
    round(allocated.allocated_cents::numeric / 100, 2),
    round(
      (allocated.allocated_cents::numeric / 100) / nullif(allocated.qty_received, 0),
      4
    ),
    round(allocated.goods_cost + allocated.allocated_cents::numeric / 100, 2),
    round(
      (allocated.goods_cost + allocated.allocated_cents::numeric / 100)
        / nullif(allocated.qty_received, 0),
      4
    ),
    round((allocated.allocated_cents - allocated.floor_cents)::numeric / 100, 2)
  from allocated
  order by allocated.line_no, allocated.line_id;
end
$$;

create or replace function private.supplier_batch_charge_line_projection(
  p_batch_id uuid,
  p_candidate_charge_id uuid default null,
  p_candidate_allocations jsonb default '[]'::jsonb
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with existing_inbound as (
    select
      allocation.batch_line_id,
      round(sum(allocation.allocated_amount), 2) as inbound_amount
    from public.supplier_batch_charge_allocations as allocation
    join public.supplier_batch_charges as charge
      on charge.id = allocation.charge_id
     and charge.batch_id = allocation.batch_id
    where allocation.batch_id = p_batch_id
      and charge.status = 'confirmed'
      and (p_candidate_charge_id is null or charge.id <> p_candidate_charge_id)
    group by allocation.batch_line_id
  ),
  candidate as (
    select
      nullif(item.value ->> 'batchLineId', '')::uuid as batch_line_id,
      round((item.value ->> 'allocatedAmount')::numeric, 2) as allocated_amount
    from jsonb_array_elements(coalesce(p_candidate_allocations, '[]'::jsonb)) as item(value)
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'batchLineId', line.id,
      'lineNo', line.line_no,
      'skuCode', line.sku_code,
      'qtyReceived', line.qty_received,
      'weightGram', product.weight_gram,
      'goodsCost', round(line.qty_received::numeric * line.unit_cost, 2),
      'goodsUnitCost', round(line.unit_cost, 4),
      'currentAllocation', coalesce(existing_inbound.inbound_amount, 0),
      'candidateAllocation', coalesce(candidate.allocated_amount, 0),
      'existingInbound', coalesce(existing_inbound.inbound_amount, 0),
      'inboundAfterCandidate', round(
        coalesce(existing_inbound.inbound_amount, 0)
          + coalesce(candidate.allocated_amount, 0),
        2
      ),
      'currentLandedLineCost', round(
        line.qty_received::numeric * line.unit_cost
          + coalesce(existing_inbound.inbound_amount, 0),
        2
      ),
      'currentLandedUnitCost', round(
        (
          line.qty_received::numeric * line.unit_cost
            + coalesce(existing_inbound.inbound_amount, 0)
        ) / nullif(line.qty_received, 0),
        4
      ),
      'projectedLandedLineCost', round(
        line.qty_received::numeric * line.unit_cost
          + coalesce(existing_inbound.inbound_amount, 0)
          + coalesce(candidate.allocated_amount, 0),
        2
      ),
      'projectedLandedUnitCost', round(
        (
          line.qty_received::numeric * line.unit_cost
            + coalesce(existing_inbound.inbound_amount, 0)
            + coalesce(candidate.allocated_amount, 0)
        ) / nullif(line.qty_received, 0),
        4
      )
    )
    order by line.line_no, line.id
  ), '[]'::jsonb)
  from public.supplier_batch_lines as line
  left join public.products as product on product.sku_code = line.sku_code
  left join existing_inbound on existing_inbound.batch_line_id = line.id
  left join candidate on candidate.batch_line_id = line.id
  where line.batch_id = p_batch_id
    and line.qty_received > 0
$$;

create or replace function private.supplier_batch_charge_result(
  p_charge_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with charge_row as (
    select charge.*, batch.batch_code
    from public.supplier_batch_charges as charge
    join public.supplier_batches as batch on batch.id = charge.batch_id
    where charge.id = p_charge_id
  ),
  confirmed_rows as (
    select
      charge.id as charge_id,
      allocation.batch_line_id,
      line.line_no,
      allocation.qty_received_snapshot,
      allocation.goods_cost_snapshot,
      allocation.weight_gram_snapshot,
      allocation.basis_value,
      allocation.share_ratio,
      allocation.allocated_amount,
      allocation.allocated_unit_amount,
      allocation.rounding_adjustment,
      allocation.metadata
    from charge_row as charge
    join public.supplier_batch_charge_allocations as allocation
      on allocation.charge_id = charge.id
     and allocation.batch_id = charge.batch_id
    join public.supplier_batch_lines as line
      on line.id = allocation.batch_line_id
     and line.batch_id = allocation.batch_id
    where charge.status = 'confirmed'
  ),
  confirmed_summary as (
    select
      charge_id,
      round(sum(allocated_amount), 2) as allocation_total,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'batchLineId', batch_line_id,
          'lineNo', line_no,
          'qtyReceivedSnapshot', qty_received_snapshot,
          'goodsCostSnapshot', goods_cost_snapshot,
          'weightGramSnapshot', weight_gram_snapshot,
          'basisValue', basis_value,
          'shareRatio', share_ratio,
          'allocatedAmount', allocated_amount,
          'allocatedUnitAmount', allocated_unit_amount,
          'landedLineCost', round(goods_cost_snapshot + allocated_amount, 2),
          'landedUnitCost', round(
            (goods_cost_snapshot + allocated_amount)
              / nullif(qty_received_snapshot, 0),
            4
          ),
          'roundingAdjustment', rounding_adjustment,
          'metadata', metadata
        )
        order by line_no, batch_line_id
      ), '[]'::jsonb) as allocations,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'batchLineId', batch_line_id,
          'allocatedAmount', allocated_amount
        )
        order by line_no, batch_line_id
      ), '[]'::jsonb) as compact_allocations
    from confirmed_rows
    group by charge_id
  ),
  candidate_rows as (
    select
      charge.id as charge_id,
      charge.allocation_method,
      allocation.batch_line_id,
      allocation.line_no,
      allocation.sku_code,
      allocation.qty_received_snapshot,
      allocation.goods_cost_snapshot,
      allocation.weight_gram_snapshot,
      allocation.basis_value,
      allocation.share_ratio,
      allocation.allocated_amount,
      allocation.allocated_unit_amount,
      allocation.landed_line_cost,
      allocation.landed_unit_cost,
      allocation.rounding_adjustment
    from charge_row as charge
    cross join lateral private.calculate_supplier_batch_charge_allocations(
      charge.batch_id,
      charge.allocation_method,
      charge.capitalized_amount,
      charge.manual_allocations_snapshot
    ) as allocation
    where charge.status = 'estimated'
  ),
  candidate_summary as (
    select
      charge_id,
      round(sum(allocated_amount), 2) as allocation_total,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'batchLineId', batch_line_id,
          'lineNo', line_no,
          'skuCode', sku_code,
          'qtyReceivedSnapshot', qty_received_snapshot,
          'goodsCostSnapshot', goods_cost_snapshot,
          'weightGramSnapshot', weight_gram_snapshot,
          'basisValue', basis_value,
          'shareRatio', share_ratio,
          'allocatedAmount', allocated_amount,
          'allocatedUnitAmount', allocated_unit_amount,
          'landedLineCost', landed_line_cost,
          'landedUnitCost', landed_unit_cost,
          'roundingAdjustment', rounding_adjustment,
          'metadata', jsonb_build_object(
            'allocationMethod', allocation_method,
            'source', 'candidate'
          )
        )
        order by line_no, batch_line_id
      ), '[]'::jsonb) as allocations,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'batchLineId', batch_line_id,
          'allocatedAmount', allocated_amount
        )
        order by line_no, batch_line_id
      ), '[]'::jsonb) as compact_allocations
    from candidate_rows
    group by charge_id
  )
  select jsonb_build_object(
    'chargeId', charge.id,
    'batchId', charge.batch_id,
    'batchCode', charge.batch_code,
    'chargeType', charge.charge_type,
    'status', charge.status,
    'amountNet', charge.amount_net,
    'vatAmount', charge.vat_amount,
    'amountGross', charge.amount_gross,
    'capitalizedAmount', charge.capitalized_amount,
    'currency', charge.currency,
    'vatTreatment', charge.vat_treatment,
    'allocationMethod', charge.allocation_method,
    'carrierName', charge.carrier_name,
    'reference', charge.reference,
    'occurredAt', charge.occurred_at,
    'evidenceUrl', charge.evidence_url,
    'notes', charge.notes,
    'zeroCostReason', charge.zero_cost_reason,
    'idempotencyKey', charge.idempotency_key,
    'payloadFingerprint', charge.payload_fingerprint,
    'manualAllocationsSnapshot', charge.manual_allocations_snapshot,
    'metadata', charge.metadata,
    'createdBy', charge.created_by,
    'updatedBy', charge.updated_by,
    'confirmedBy', charge.confirmed_by,
    'confirmedAt', charge.confirmed_at,
    'createdAt', charge.created_at,
    'updatedAt', charge.updated_at,
    'revision', private.supplier_batch_charge_revision(charge.batch_id),
    'candidateAllocationTotal', case
      when charge.status = 'estimated' then coalesce(candidate.allocation_total, 0)
      else 0
    end,
    'candidateAllocations', case
      when charge.status = 'estimated' then coalesce(candidate.allocations, '[]'::jsonb)
      else '[]'::jsonb
    end,
    'confirmedAllocationTotal', coalesce(confirmed.allocation_total, 0),
    'confirmedAllocations', coalesce(confirmed.allocations, '[]'::jsonb),
    -- allocationTotal/allocations are the effective view: candidate for an
    -- estimate, formal allocations for a confirmed charge, and empty for a
    -- cancelled charge.
    'allocationTotal', case
      when charge.status = 'confirmed' then coalesce(confirmed.allocation_total, 0)
      when charge.status = 'estimated' then coalesce(candidate.allocation_total, 0)
      else 0
    end,
    'allocations', case
      when charge.status = 'confirmed' then coalesce(confirmed.allocations, '[]'::jsonb)
      when charge.status = 'estimated' then coalesce(candidate.allocations, '[]'::jsonb)
      else '[]'::jsonb
    end,
    'lineProjections', private.supplier_batch_charge_line_projection(
      charge.batch_id,
      case when charge.status = 'confirmed' then charge.id else null end,
      case
        when charge.status = 'confirmed' then coalesce(confirmed.compact_allocations, '[]'::jsonb)
        when charge.status = 'estimated' then coalesce(candidate.compact_allocations, '[]'::jsonb)
        else '[]'::jsonb
      end
    )
  )
  from charge_row as charge
  left join confirmed_summary as confirmed on confirmed.charge_id = charge.id
  left join candidate_summary as candidate on candidate.charge_id = charge.id
$$;

-- Set-based read model for batch-list summaries.  The RPC intentionally
-- returns one row for every existing requested batch, including batches with
-- no charge rows; it does not loop over batches or call a per-batch function.
create or replace function public.admin_list_supplier_batch_cost_summaries(
  p_batch_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_service_role boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
  v_requested_ids uuid[];
  v_result jsonb;
begin
  if v_actor_id is null and not v_is_service_role then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not v_is_service_role
     and not (
       coalesce((select private.partspro_has_permission('product.read_admin')), false)
       or coalesce((select private.partspro_has_permission('products.read_admin')), false)
       or coalesce((select private.partspro_has_permission('supplier_batch.manage_costs')), false)
       or coalesce((select private.partspro_has_permission('finance.read')), false)
       or coalesce((select private.partspro_has_permission('finance.cost_reconcile')), false)
     ) then
     raise exception 'Supplier batch cost summary permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;

  if cardinality(coalesce(p_batch_ids, '{}'::uuid[])) > 500 then
    raise exception 'At most 500 supplier batch ids may be summarized at once'
      using errcode = '22023', detail = 'BATCH_IDS_LIMIT_EXCEEDED';
  end if;

  select coalesce(array_agg(batch_id order by batch_id), '{}'::uuid[])
  into v_requested_ids
  from (
    select distinct item.value as batch_id
    from unnest(coalesce(p_batch_ids, '{}'::uuid[])) as item(value)
    where item.value is not null
  ) as requested;

  if cardinality(v_requested_ids) > 500 then
    raise exception 'At most 500 supplier batch ids may be summarized at once'
      using errcode = '22023', detail = 'BATCH_IDS_LIMIT_EXCEEDED';
  end if;

  with requested as (
    select unnest(v_requested_ids) as batch_id
  ),
  batches as (
    select
      batch.id as batch_id,
      batch.batch_code,
      batch.currency,
      batch.total_cost as goods_value
    from public.supplier_batches as batch
    join requested on requested.batch_id = batch.id
  ),
  charge_summary as (
    select
      charge.batch_id,
      count(*) filter (where charge.status = 'estimated')::integer as estimated_count,
      count(*) filter (where charge.status = 'confirmed')::integer as confirmed_count,
      count(*) filter (where charge.status = 'cancelled')::integer as cancelled_count,
      coalesce(sum(charge.amount_net) filter (where charge.status = 'estimated'), 0) as estimated_net,
      coalesce(sum(charge.vat_amount) filter (where charge.status = 'estimated'), 0) as estimated_vat,
      coalesce(sum(charge.amount_gross) filter (where charge.status = 'estimated'), 0) as estimated_gross,
      coalesce(sum(charge.capitalized_amount) filter (where charge.status = 'estimated'), 0) as estimated_capitalized,
      coalesce(sum(charge.amount_net) filter (where charge.status = 'confirmed'), 0) as confirmed_net,
      coalesce(sum(charge.vat_amount) filter (where charge.status = 'confirmed'), 0) as confirmed_vat,
      coalesce(sum(charge.amount_gross) filter (where charge.status = 'confirmed'), 0) as confirmed_gross,
      coalesce(sum(charge.capitalized_amount) filter (where charge.status = 'confirmed'), 0) as confirmed_capitalized
    from public.supplier_batch_charges as charge
    join requested on requested.batch_id = charge.batch_id
    group by charge.batch_id
  ),
  line_flags as (
    select
      line.batch_id,
      bool_or(line.qty_received > 0 and product.id is null) as missing_product_mapping,
      bool_or(line.qty_received > 0 and coalesce(product.weight_gram, 0) <= 0) as missing_weight
    from public.supplier_batch_lines as line
    join requested on requested.batch_id = line.batch_id
    left join public.products as product on product.sku_code = line.sku_code
    group by line.batch_id
  ),
  weight_estimate_flags as (
    select
      charge.batch_id,
      bool_or(
        charge.status = 'estimated'
        and charge.allocation_method = 'weight'
      ) as has_active_weight_estimate
    from public.supplier_batch_charges as charge
    join requested on requested.batch_id = charge.batch_id
    group by charge.batch_id
  ),
  layer_flags as (
    select
      line.batch_id,
      bool_or(layer.allocated_qty > 0 or layer.consumed_qty > 0) as has_allocated_or_consumed_layer
    from public.supplier_batch_lines as line
    join requested on requested.batch_id = line.batch_id
    join public.finance_cost_layers as layer
      on layer.supplier_batch_line_id = line.id
    group by line.batch_id
  ),
  reviewed as (
    select
      batches.*,
      coalesce(charge_summary.estimated_count, 0) as estimated_count,
      coalesce(charge_summary.confirmed_count, 0) as confirmed_count,
      coalesce(charge_summary.cancelled_count, 0) as cancelled_count,
      coalesce(charge_summary.estimated_net, 0) as estimated_net,
      coalesce(charge_summary.estimated_vat, 0) as estimated_vat,
      coalesce(charge_summary.estimated_gross, 0) as estimated_gross,
      coalesce(charge_summary.estimated_capitalized, 0) as estimated_capitalized,
      coalesce(charge_summary.confirmed_net, 0) as confirmed_net,
      coalesce(charge_summary.confirmed_vat, 0) as confirmed_vat,
      coalesce(charge_summary.confirmed_gross, 0) as confirmed_gross,
      coalesce(charge_summary.confirmed_capitalized, 0) as confirmed_capitalized,
      array_remove(
        array[
          case
            when upper(coalesce(batches.currency, '')) <> 'EUR' then 'NON_EUR_BATCH'::text
          end,
          case
            when coalesce(line_flags.missing_product_mapping, false)
              then 'PRODUCT_MAPPING_REQUIRED'::text
          end,
          case
            when coalesce(weight_estimate_flags.has_active_weight_estimate, false)
             and coalesce(line_flags.missing_weight, false)
              then 'WEIGHT_REQUIRED_FOR_ESTIMATE'::text
          end,
          case
            when coalesce(layer_flags.has_allocated_or_consumed_layer, false)
              then 'FINANCIAL_ADJUSTMENT_REQUIRED'::text
          end
        ]::text[],
        null::text
      ) as review_codes
    from batches
    left join charge_summary on charge_summary.batch_id = batches.batch_id
    left join line_flags on line_flags.batch_id = batches.batch_id
    left join weight_estimate_flags on weight_estimate_flags.batch_id = batches.batch_id
    left join layer_flags on layer_flags.batch_id = batches.batch_id
  ),
  scored as (
    select
      reviewed.*,
      case
        when cardinality(review_codes) > 0 then 'needs_review'
        when estimated_count > 0 then 'estimated'
        when confirmed_count > 0 and confirmed_capitalized = 0 then 'confirmed_zero'
        when confirmed_count > 0 then 'confirmed'
        else 'unrecorded'
      end as cost_status
    from reviewed
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'batchId', batch_id,
      'batchCode', batch_code,
      'currency', currency,
      'goodsValue', goods_value,
      'estimatedCount', estimated_count,
      'confirmedCount', confirmed_count,
      'cancelledCount', cancelled_count,
      'estimatedNet', estimated_net,
      'estimatedVat', estimated_vat,
      'estimatedGross', estimated_gross,
      'estimatedCapitalized', estimated_capitalized,
      'confirmedNet', confirmed_net,
      'confirmedVat', confirmed_vat,
      'confirmedGross', confirmed_gross,
      'confirmedCapitalized', confirmed_capitalized,
      'confirmedLandedTotal', round(goods_value + confirmed_capitalized, 2),
      'projectedLandedTotal', round(
        goods_value + confirmed_capitalized + estimated_capitalized,
        2
      ),
      'confirmationBlocked', cardinality(review_codes) > 0,
      'reviewCodes', to_jsonb(review_codes),
      'costStatus', cost_status
    )
    order by batch_code, batch_id
  ), '[]'::jsonb)
  into v_result
  from scored;

  return v_result;
end
$$;

create or replace function public.admin_preview_supplier_batch_charge(
  p_batch_code text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_service_role boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
  v_batch public.supplier_batches%rowtype;
  v_existing public.supplier_batch_charges%rowtype;
  v_terms record;
  v_revision_before text;
  v_revision_after text;
  v_allocations jsonb;
  v_candidate_allocations jsonb;
  v_allocation_total numeric := 0;
  v_confirmation_blocked boolean := false;
  v_confirmation_block_code text;
  v_confirmation_block_reason text;
  v_payload_fingerprint text;
begin
  if v_actor_id is null and not v_is_service_role then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not v_is_service_role
     and not coalesce((select private.partspro_has_permission('supplier_batch.manage_costs')), false) then
    raise exception 'supplier_batch.manage_costs permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;
  if nullif(btrim(coalesce(p_batch_code, '')), '') is null then
    raise exception 'batch_code is required' using errcode = '22023';
  end if;

  select *
  into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(p_batch_code)
  limit 1;

  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;

  select *
  into v_terms
  from private.parse_supplier_batch_charge_payload(p_payload, null);

  if upper(coalesce(v_batch.currency, '')) <> 'EUR'
     or v_terms.currency <> 'EUR' then
    raise exception 'Only EUR supplier batch costs are supported by this version'
      using errcode = '22023';
  end if;

  -- A manual preview may restore only an existing estimate's immutable draft
  -- snapshot.  Never borrow a confirmed/cancelled or cross-batch snapshot.
  if v_terms.allocation_method = 'manual'
     and not (p_payload ? 'manualAllocations') then
    if v_terms.charge_id is null then
      raise exception 'manualAllocations is required for a manual preview unless an estimated charge is referenced'
        using errcode = '22023', detail = 'MANUAL_ALLOCATIONS_REQUIRED';
    end if;
    select *
    into v_existing
    from public.supplier_batch_charges as charge
    where charge.id = v_terms.charge_id;
    if v_existing.id is null
       or v_existing.batch_id <> v_batch.id then
      raise exception 'Manual preview fallback requires an estimated charge from the same supplier batch'
        using errcode = 'P0002', detail = 'CHARGE_NOT_FOUND';
    elsif v_existing.status <> 'estimated' then
      raise exception 'Manual preview fallback requires an estimated charge from the same supplier batch'
        using errcode = '55000', detail = 'CHARGE_IMMUTABLE';
    end if;
    v_terms.manual_allocations := v_existing.manual_allocations_snapshot;
  elsif v_terms.allocation_method <> 'manual' then
    v_terms.manual_allocations := '[]'::jsonb;
  end if;

  v_payload_fingerprint := private.supplier_batch_charge_fingerprint(
    v_terms.charge_type,
    v_terms.amount_net,
    v_terms.vat_amount,
    v_terms.amount_gross,
    v_terms.capitalized_amount,
    v_terms.currency,
    v_terms.vat_treatment,
    v_terms.allocation_method,
    v_terms.carrier_name,
    v_terms.charge_reference,
    v_terms.occurred_at,
    v_terms.evidence_url,
    v_terms.notes,
    v_terms.zero_cost_reason,
    v_terms.manual_allocations,
    v_terms.metadata
  );

  -- Capture a stable revision before reading allocation inputs.  The after
  -- check below rejects a concurrent line/product/charge change instead of
  -- returning a preview whose rows came from mixed revisions.
  v_revision_before := private.supplier_batch_charge_revision(v_batch.id);

  select
  coalesce(jsonb_agg(
      jsonb_build_object(
        'batchLineId', allocation.batch_line_id,
        'lineNo', allocation.line_no,
        'skuCode', allocation.sku_code,
        'qtyReceivedSnapshot', allocation.qty_received_snapshot,
        'goodsCostSnapshot', allocation.goods_cost_snapshot,
        'weightGramSnapshot', allocation.weight_gram_snapshot,
        'basisValue', allocation.basis_value,
        'shareRatio', allocation.share_ratio,
        'allocatedAmount', allocation.allocated_amount,
        'allocatedUnitAmount', allocation.allocated_unit_amount,
        'landedLineCost', allocation.landed_line_cost,
        'landedUnitCost', allocation.landed_unit_cost,
        'roundingAdjustment', allocation.rounding_adjustment
      )
      order by allocation.line_no, allocation.batch_line_id
    ), '[]'::jsonb),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'batchLineId', allocation.batch_line_id,
        'allocatedAmount', allocation.allocated_amount
      )
      order by allocation.line_no, allocation.batch_line_id
    ), '[]'::jsonb),
  coalesce(sum(allocation.allocated_amount), 0)
  into v_allocations, v_candidate_allocations, v_allocation_total
  from private.calculate_supplier_batch_charge_allocations(
    v_batch.id,
    v_terms.allocation_method,
    v_terms.capitalized_amount,
    v_terms.manual_allocations
  ) as allocation;

  v_revision_after := private.supplier_batch_charge_revision(v_batch.id);
  if v_revision_after <> v_revision_before then
    raise exception 'Supplier batch changed while preview was calculated; preview must be retried'
      using errcode = '40001', detail = 'STALE_REVISION';
  end if;

  v_confirmation_blocked := exists (
    select 1
    from public.finance_cost_layers as layer
    join public.supplier_batch_lines as line
      on line.id = layer.supplier_batch_line_id
    where line.batch_id = v_batch.id
      and (layer.allocated_qty > 0 or layer.consumed_qty > 0)
  );
  if v_confirmation_blocked then
    v_confirmation_block_code := 'FINANCIAL_ADJUSTMENT_REQUIRED';
    v_confirmation_block_reason :=
      'At least one affected finance cost layer is already allocated or consumed; financial adjustment is required before V1 confirmation.';
  end if;

  return jsonb_build_object(
    'status', 'preview',
    'batchId', v_batch.id,
    'batchCode', v_batch.batch_code,
    'revision', v_revision_before,
    'chargeType', v_terms.charge_type,
    'amountNet', v_terms.amount_net,
    'vatAmount', v_terms.vat_amount,
    'amountGross', v_terms.amount_gross,
    'capitalizedAmount', v_terms.capitalized_amount,
    'currency', v_terms.currency,
    'vatTreatment', v_terms.vat_treatment,
    'allocationMethod', v_terms.allocation_method,
    'carrierName', v_terms.carrier_name,
    'reference', v_terms.charge_reference,
    'occurredAt', v_terms.occurred_at,
    'evidenceUrl', v_terms.evidence_url,
    'notes', v_terms.notes,
    'zeroCostReason', v_terms.zero_cost_reason,
    'manualAllocationsSnapshot', v_terms.manual_allocations,
    'payloadFingerprint', v_payload_fingerprint,
    'confirmationBlocked', v_confirmation_blocked,
    'confirmationBlockCode', v_confirmation_block_code,
    'confirmationBlockReason', v_confirmation_block_reason,
    'candidateAllocationTotal', v_allocation_total,
    'candidateAllocations', v_allocations,
    'confirmedAllocationTotal', 0,
    'confirmedAllocations', '[]'::jsonb,
    -- allocationTotal/allocations are the effective preview candidate view;
    -- lineProjections remains the cumulative current/candidate authority.
    'allocationTotal', v_allocation_total,
    'allocations', v_allocations,
    'lineProjections', private.supplier_batch_charge_line_projection(
      v_batch.id,
      null,
      v_candidate_allocations
    )
  );
end
$$;

create or replace function public.admin_save_supplier_batch_charge_estimate(
  p_batch_code text,
  p_payload jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_service_role boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
  v_batch public.supplier_batches%rowtype;
  v_existing public.supplier_batch_charges%rowtype;
  v_charge public.supplier_batch_charges%rowtype;
  v_terms record;
  v_payload_fingerprint text;
  v_key_collision uuid;
begin
  if v_actor_id is null and not v_is_service_role then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not v_is_service_role
     and not coalesce((select private.partspro_has_permission('supplier_batch.manage_costs')), false) then
    raise exception 'supplier_batch.manage_costs permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;

  select *
  into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(coalesce(p_batch_code, ''))
  for update;

  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;

  select *
  into v_terms
  from private.parse_supplier_batch_charge_payload(p_payload, p_idempotency_key);

  if v_terms.idempotency_key is null then
    raise exception 'idempotencyKey is required when saving an estimate' using errcode = '22023';
  end if;
  if upper(coalesce(v_batch.currency, '')) <> 'EUR'
     or v_terms.currency <> 'EUR' then
    raise exception 'Only EUR supplier batch costs are supported by this version'
      using errcode = '22023';
  end if;

  if v_terms.charge_id is not null then
    select *
    into v_existing
    from public.supplier_batch_charges as charge
    where charge.id = v_terms.charge_id
    for update;
    if v_existing.id is null then
      raise exception 'Supplier batch charge not found: %', v_terms.charge_id
        using errcode = 'P0002', detail = 'CHARGE_NOT_FOUND';
    end if;
    select charge.id
    into v_key_collision
    from public.supplier_batch_charges as charge
    where charge.idempotency_key = v_terms.idempotency_key
      and charge.id <> v_existing.id
    for update;
    if v_key_collision is not null then
      raise exception 'Idempotency key belongs to another supplier batch charge'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
  else
    select *
    into v_existing
    from public.supplier_batch_charges as charge
    where charge.idempotency_key = v_terms.idempotency_key
    for update;
  end if;

  if v_existing.id is not null then
    if v_existing.batch_id <> v_batch.id then
      raise exception 'Idempotency key belongs to another supplier batch'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing.idempotency_key <> v_terms.idempotency_key then
      raise exception 'Charge id and idempotency key do not match'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing.status <> 'estimated' then
      raise exception 'Confirmed or cancelled supplier batch charges are immutable'
        using errcode = '55000', detail = 'CHARGE_IMMUTABLE';
    end if;

    if v_terms.allocation_method = 'manual'
       and not (p_payload ? 'manualAllocations') then
      v_terms.manual_allocations := v_existing.manual_allocations_snapshot;
    elsif v_terms.allocation_method <> 'manual' then
      -- Switching an estimate away from manual allocation clears the old
      -- draft snapshot so a same-key retry fingerprints the same payload.
      v_terms.manual_allocations := '[]'::jsonb;
    end if;

    v_payload_fingerprint := private.supplier_batch_charge_fingerprint(
      v_terms.charge_type,
      v_terms.amount_net,
      v_terms.vat_amount,
      v_terms.amount_gross,
      v_terms.capitalized_amount,
      v_terms.currency,
      v_terms.vat_treatment,
      v_terms.allocation_method,
      v_terms.carrier_name,
      v_terms.charge_reference,
      v_terms.occurred_at,
      v_terms.evidence_url,
      v_terms.notes,
      v_terms.zero_cost_reason,
      v_terms.manual_allocations,
      v_terms.metadata
    );

    if v_existing.payload_fingerprint = v_payload_fingerprint
       and (v_terms.charge_id is null or v_terms.charge_id = v_existing.id) then
      return private.supplier_batch_charge_result(v_existing.id);
    end if;

    if v_terms.charge_id is null then
      raise exception 'Idempotency key conflicts with a different supplier batch charge payload'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
  else
    v_payload_fingerprint := private.supplier_batch_charge_fingerprint(
      v_terms.charge_type,
      v_terms.amount_net,
      v_terms.vat_amount,
      v_terms.amount_gross,
      v_terms.capitalized_amount,
      v_terms.currency,
      v_terms.vat_treatment,
      v_terms.allocation_method,
      v_terms.carrier_name,
      v_terms.charge_reference,
      v_terms.occurred_at,
      v_terms.evidence_url,
      v_terms.notes,
      v_terms.zero_cost_reason,
      v_terms.manual_allocations,
      v_terms.metadata
    );
  end if;

  -- Save validates the deterministic allocation calculation but does not
  -- write formal allocations or finance cost layers.
  perform allocation.batch_line_id
  from private.calculate_supplier_batch_charge_allocations(
    v_batch.id,
    v_terms.allocation_method,
    v_terms.capitalized_amount,
    v_terms.manual_allocations
  ) as allocation;

  if v_existing.id is not null then
    update public.supplier_batch_charges
    set charge_type = v_terms.charge_type,
        status = 'estimated',
        amount_net = v_terms.amount_net,
        vat_amount = v_terms.vat_amount,
        capitalized_amount = v_terms.capitalized_amount,
        currency = v_terms.currency,
        vat_treatment = v_terms.vat_treatment,
        allocation_method = v_terms.allocation_method,
        carrier_name = v_terms.carrier_name,
        reference = v_terms.charge_reference,
        occurred_at = v_terms.occurred_at,
        evidence_url = v_terms.evidence_url,
        notes = v_terms.notes,
        zero_cost_reason = v_terms.zero_cost_reason,
        payload_fingerprint = v_payload_fingerprint,
        manual_allocations_snapshot = v_terms.manual_allocations,
        updated_by = v_actor_id,
        confirmed_by = null,
        confirmed_at = null,
        metadata = v_terms.metadata,
        updated_at = now()
    where id = v_existing.id
    returning * into v_charge;
  else
    insert into public.supplier_batch_charges (
      batch_id,
      charge_type,
      status,
      amount_net,
      vat_amount,
      capitalized_amount,
      currency,
      vat_treatment,
      allocation_method,
      carrier_name,
      reference,
      occurred_at,
      evidence_url,
      notes,
      zero_cost_reason,
      idempotency_key,
      payload_fingerprint,
      manual_allocations_snapshot,
      created_by,
      updated_by,
      metadata
    )
    values (
      v_batch.id,
      v_terms.charge_type,
      'estimated',
      v_terms.amount_net,
      v_terms.vat_amount,
      v_terms.capitalized_amount,
      v_terms.currency,
      v_terms.vat_treatment,
      v_terms.allocation_method,
      v_terms.carrier_name,
      v_terms.charge_reference,
      v_terms.occurred_at,
      v_terms.evidence_url,
      v_terms.notes,
      v_terms.zero_cost_reason,
      v_terms.idempotency_key,
      v_payload_fingerprint,
      v_terms.manual_allocations,
      v_actor_id,
      v_actor_id,
      v_terms.metadata
    )
    returning * into v_charge;
  end if;

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
    request_metadata
  )
  values (
    v_actor_id,
    nullif(auth.jwt() ->> 'email', ''),
    (select private.current_profile_role()),
    'supplier_batch_charge.estimate_saved',
    'supplier_batch_charge',
    v_charge.id::text,
    case when v_existing.id is null then '{}'::jsonb else to_jsonb(v_existing) end,
    to_jsonb(v_charge),
    v_terms.notes,
    jsonb_build_object(
      'batch_code', v_batch.batch_code,
      'idempotency_key', v_terms.idempotency_key,
      'payload_fingerprint', v_payload_fingerprint,
      'status', 'estimated',
      'user_metadata', v_terms.metadata
    )
  );

  return private.supplier_batch_charge_result(v_charge.id);
end
$$;

create or replace function public.admin_confirm_supplier_batch_charge(
  p_batch_code text,
  p_payload jsonb,
  p_revision text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_service_role boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
  v_batch public.supplier_batches%rowtype;
  v_existing public.supplier_batch_charges%rowtype;
  v_charge public.supplier_batch_charges%rowtype;
  v_terms record;
  v_current_revision text;
  v_allocation_total numeric := 0;
  v_payload_fingerprint text;
  v_result jsonb;
begin
  if v_actor_id is null and not v_is_service_role then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not v_is_service_role
     and not coalesce((select private.partspro_has_permission('supplier_batch.manage_costs')), false) then
    raise exception 'supplier_batch.manage_costs permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;

  select *
  into v_terms
  from private.parse_supplier_batch_charge_payload(p_payload, p_idempotency_key);

  if v_terms.idempotency_key is null then
    raise exception 'idempotencyKey is required when confirming a charge' using errcode = '22023';
  end if;

  select *
  into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(coalesce(p_batch_code, ''))
  for update;

  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;
  if upper(v_batch.currency) <> 'EUR' or upper(v_terms.currency) <> 'EUR' then
    raise exception 'Only EUR supplier batch costs can be confirmed by this version' using errcode = '22023';
  end if;

  -- Idempotent retries return the already confirmed result before checking the
  -- stale preview revision.  The batch lock serializes other confirmations.
  select *
  into v_existing
  from public.supplier_batch_charges as charge
  where charge.idempotency_key = v_terms.idempotency_key
  for update;

  if v_existing.id is not null then
    if v_existing.batch_id <> v_batch.id then
      raise exception 'Idempotency key belongs to another supplier batch'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing.status = 'cancelled' then
      raise exception 'Cancelled supplier batch charges cannot be confirmed'
        using errcode = '55000', detail = 'CHARGE_CANCELLED';
    end if;
    if v_terms.charge_id is not null and v_terms.charge_id <> v_existing.id then
      raise exception 'Charge id and idempotency key do not match'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
  elsif v_terms.charge_id is not null then
    select *
    into v_existing
    from public.supplier_batch_charges as charge
    where charge.id = v_terms.charge_id
    for update;
    if v_existing.id is null then
      raise exception 'Supplier batch charge not found: %', v_terms.charge_id
        using errcode = 'P0002', detail = 'CHARGE_NOT_FOUND';
    end if;
    if v_existing.batch_id <> v_batch.id
       or v_existing.idempotency_key <> v_terms.idempotency_key then
      raise exception 'Charge id and idempotency key do not match'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing.status = 'cancelled' then
      raise exception 'Cancelled supplier batch charges cannot be confirmed'
        using errcode = '55000', detail = 'CHARGE_CANCELLED';
    end if;
  end if;

  if v_existing.id is not null
     and v_terms.allocation_method = 'manual'
     and not (p_payload ? 'manualAllocations') then
    v_terms.manual_allocations := v_existing.manual_allocations_snapshot;
  elsif v_terms.allocation_method <> 'manual' then
    -- The incoming method controls the fingerprint.  A stale manual draft is
    -- never retained when confirming a non-manual allocation.
    v_terms.manual_allocations := '[]'::jsonb;
  end if;

  v_payload_fingerprint := private.supplier_batch_charge_fingerprint(
    v_terms.charge_type,
    v_terms.amount_net,
    v_terms.vat_amount,
    v_terms.amount_gross,
    v_terms.capitalized_amount,
    v_terms.currency,
    v_terms.vat_treatment,
    v_terms.allocation_method,
    v_terms.carrier_name,
    v_terms.charge_reference,
    v_terms.occurred_at,
    v_terms.evidence_url,
    v_terms.notes,
    v_terms.zero_cost_reason,
    v_terms.manual_allocations,
    v_terms.metadata
  );

  if v_existing.id is not null
     and v_existing.status = 'confirmed' then
    if v_existing.payload_fingerprint <> v_payload_fingerprint then
      raise exception 'Confirmed idempotency key conflicts with a different supplier batch charge payload'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
    return private.supplier_batch_charge_result(v_existing.id);
  end if;

  if v_existing.id is not null
     and v_existing.status = 'estimated'
     and v_terms.charge_id is null
     and v_existing.payload_fingerprint <> v_payload_fingerprint then
    raise exception 'Idempotency key conflicts with a different supplier batch charge payload'
      using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
  end if;

  -- Stable lock order: batch, all batch lines by id, product rows by id,
  -- existing cost layers by batch-line id, then the charge row.
  -- No external calls occur in this transaction.
  perform line.id
  from public.supplier_batch_lines as line
  where line.batch_id = v_batch.id
  order by line.id
  for update;

  perform product.id
  from public.products as product
  join public.supplier_batch_lines as line
    on line.sku_code = product.sku_code
  where line.batch_id = v_batch.id
  order by product.id
  for update;

  perform layer.id
  from public.finance_cost_layers as layer
  join public.supplier_batch_lines as line
    on line.id = layer.supplier_batch_line_id
  where line.batch_id = v_batch.id
  order by layer.supplier_batch_line_id, layer.id
  for update;

  v_current_revision := private.supplier_batch_charge_revision(v_batch.id);
  if nullif(btrim(coalesce(p_revision, '')), '') is null
     or p_revision <> v_current_revision then
    raise exception 'Supplier batch revision is stale; preview must be refreshed'
      using errcode = '40001', detail = 'STALE_REVISION';
  end if;

  if v_terms.vat_treatment = 'unknown' then
    raise exception 'Confirmed supplier batch charges require known VAT treatment' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.finance_cost_layers as layer
    join public.supplier_batch_lines as line
      on line.id = layer.supplier_batch_line_id
    where line.batch_id = v_batch.id
      and (layer.allocated_qty > 0 or layer.consumed_qty > 0)
  ) then
    -- REMAX/preorder layers with reserved/consumed usage remain estimate-only
    -- in V1.  Historical financial adjustment is intentionally out of scope.
    raise exception 'Financial adjustment required: an affected cost layer is already allocated or consumed'
      using errcode = '55000', detail = 'FINANCIAL_ADJUSTMENT_REQUIRED';
  end if;

  if v_existing.id is not null
     and exists (
       select 1
       from public.supplier_batch_charge_allocations as allocation
       where allocation.charge_id = v_existing.id
  ) then
    raise exception 'Estimated charge already has allocations and cannot be rewritten'
      using errcode = '55000', detail = 'CHARGE_IMMUTABLE';
  end if;

  if v_existing.id is null then
    insert into public.supplier_batch_charges (
      batch_id,
      charge_type,
      status,
      amount_net,
      vat_amount,
      capitalized_amount,
      currency,
      vat_treatment,
      allocation_method,
      carrier_name,
      reference,
      occurred_at,
      evidence_url,
      notes,
      zero_cost_reason,
      idempotency_key,
      payload_fingerprint,
      manual_allocations_snapshot,
      created_by,
      updated_by,
      confirmed_by,
      confirmed_at,
      metadata
    )
    values (
      v_batch.id,
      v_terms.charge_type,
      'confirmed',
      v_terms.amount_net,
      v_terms.vat_amount,
      v_terms.capitalized_amount,
      v_terms.currency,
      v_terms.vat_treatment,
      v_terms.allocation_method,
      v_terms.carrier_name,
      v_terms.charge_reference,
      v_terms.occurred_at,
      v_terms.evidence_url,
      v_terms.notes,
      v_terms.zero_cost_reason,
      v_terms.idempotency_key,
      v_payload_fingerprint,
      v_terms.manual_allocations,
      v_actor_id,
      v_actor_id,
      v_actor_id,
      now(),
      v_terms.metadata
    )
    returning * into v_charge;
  else
    update public.supplier_batch_charges
    set charge_type = v_terms.charge_type,
        status = 'confirmed',
        amount_net = v_terms.amount_net,
        vat_amount = v_terms.vat_amount,
        capitalized_amount = v_terms.capitalized_amount,
        currency = v_terms.currency,
        vat_treatment = v_terms.vat_treatment,
        allocation_method = v_terms.allocation_method,
        carrier_name = v_terms.carrier_name,
        reference = v_terms.charge_reference,
        occurred_at = v_terms.occurred_at,
        evidence_url = v_terms.evidence_url,
        notes = v_terms.notes,
        zero_cost_reason = v_terms.zero_cost_reason,
        payload_fingerprint = v_payload_fingerprint,
        manual_allocations_snapshot = v_terms.manual_allocations,
        updated_by = v_actor_id,
        confirmed_by = v_actor_id,
        confirmed_at = now(),
        metadata = v_terms.metadata,
        updated_at = now()
    where id = v_existing.id
    returning * into v_charge;
  end if;

  insert into public.supplier_batch_charge_allocations (
    batch_id,
    charge_id,
    batch_line_id,
    qty_received_snapshot,
    goods_cost_snapshot,
    weight_gram_snapshot,
    basis_value,
    share_ratio,
    allocated_amount,
    allocated_unit_amount,
    rounding_adjustment,
    metadata
  )
  select
    v_batch.id,
    v_charge.id,
    allocation.batch_line_id,
    allocation.qty_received_snapshot,
    allocation.goods_cost_snapshot,
    allocation.weight_gram_snapshot,
    allocation.basis_value,
    allocation.share_ratio,
    allocation.allocated_amount,
    allocation.allocated_unit_amount,
    allocation.rounding_adjustment,
    jsonb_build_object(
      'lineNo', allocation.line_no,
      'skuCode', allocation.sku_code,
      'allocationMethod', v_terms.allocation_method
    )
  from private.calculate_supplier_batch_charge_allocations(
    v_batch.id,
    v_terms.allocation_method,
    v_terms.capitalized_amount,
    v_terms.manual_allocations
  ) as allocation;

  select coalesce(sum(allocation.allocated_amount), 0)
  into v_allocation_total
  from public.supplier_batch_charge_allocations as allocation
  where allocation.charge_id = v_charge.id
    and allocation.batch_id = v_batch.id;

  if round(v_allocation_total, 2) <> round(v_charge.capitalized_amount, 2) then
    raise exception 'Allocation total must equal capitalized amount' using errcode = '23514';
  end if;

  -- Rebuild only the affected batch's unconsumed layers.  Existing final
  -- unit_cost_net/total_cost_net remain the COGS/landed values consumed by
  -- downstream finance code; the three breakdown columns make the source
  -- values auditable.  No products prices, stock, or expense entries change.
  with confirmed_inbound as (
    select
      allocation.batch_line_id,
      round(sum(allocation.allocated_amount), 2) as inbound_total
    from public.supplier_batch_charge_allocations as allocation
    join public.supplier_batch_charges as charge on charge.id = allocation.charge_id
    where allocation.batch_id = v_batch.id
      and charge.batch_id = v_batch.id
      and charge.status = 'confirmed'
    group by allocation.batch_line_id
  ),
  summary as (
    select
      line.id as batch_line_id,
      line.sku_code,
      line.qty_received,
      round(line.qty_received::numeric * line.unit_cost, 2) as goods_total,
      round(
        (line.qty_received::numeric * line.unit_cost) / nullif(line.qty_received, 0),
        4
      ) as goods_unit,
      coalesce(confirmed_inbound.inbound_total, 0) as inbound_total,
      v_batch.id as batch_id,
      v_batch.supplier_id,
      v_batch.batch_code,
      upper(v_batch.currency) as currency,
      v_batch.vat_mode
    from public.supplier_batch_lines as line
    left join confirmed_inbound on confirmed_inbound.batch_line_id = line.id
    where line.batch_id = v_batch.id
      and line.qty_received > 0
  )
  update public.finance_cost_layers as layer
  set received_qty = summary.qty_received,
      goods_unit_cost_net = summary.goods_unit,
      goods_total_cost_net = summary.goods_total,
      inbound_charge_total_net = summary.inbound_total,
      unit_cost_net = round(
        (summary.goods_total + summary.inbound_total)
          / nullif(summary.qty_received, 0),
        4
      ),
      total_cost_net = round(summary.goods_total + summary.inbound_total, 2),
      metadata = coalesce(layer.metadata, '{}'::jsonb) || jsonb_build_object(
        'supplier_batch_transport', jsonb_build_object(
          'last_charge_id', v_charge.id,
          'inbound_charge_total_net', summary.inbound_total,
          'allocation_method', v_terms.allocation_method
        )
      ),
      updated_at = now()
  from summary
  where layer.supplier_batch_line_id = summary.batch_line_id;

  with confirmed_inbound as (
    select
      allocation.batch_line_id,
      round(sum(allocation.allocated_amount), 2) as inbound_total
    from public.supplier_batch_charge_allocations as allocation
    join public.supplier_batch_charges as charge on charge.id = allocation.charge_id
    where allocation.batch_id = v_batch.id
      and charge.batch_id = v_batch.id
      and charge.status = 'confirmed'
    group by allocation.batch_line_id
  ),
  summary as (
    select
      line.id as batch_line_id,
      line.sku_code,
      line.qty_received,
      round(line.qty_received::numeric * line.unit_cost, 2) as goods_total,
      round(
        (line.qty_received::numeric * line.unit_cost) / nullif(line.qty_received, 0),
        4
      ) as goods_unit,
      coalesce(confirmed_inbound.inbound_total, 0) as inbound_total,
      v_batch.id as batch_id,
      v_batch.supplier_id,
      v_batch.batch_code,
      upper(v_batch.currency) as currency,
      v_batch.vat_mode
    from public.supplier_batch_lines as line
    left join confirmed_inbound on confirmed_inbound.batch_line_id = line.id
    where line.batch_id = v_batch.id
      and line.qty_received > 0
  )
  insert into public.finance_cost_layers (
    supplier_batch_line_id,
    supplier_batch_id,
    supplier_id,
    sku_code,
    batch_code,
    received_qty,
    allocated_qty,
    consumed_qty,
    goods_unit_cost_net,
    goods_total_cost_net,
    inbound_charge_total_net,
    unit_cost_net,
    total_cost_net,
    currency,
    vat_mode,
    vat_treatment,
    confidence,
    metadata
  )
  select
    summary.batch_line_id,
    summary.batch_id,
    summary.supplier_id,
    summary.sku_code,
    summary.batch_code,
    summary.qty_received,
    0,
    0,
    summary.goods_unit,
    summary.goods_total,
    summary.inbound_total,
    round(
      (summary.goods_total + summary.inbound_total)
        / nullif(summary.qty_received, 0),
      4
    ),
    round(summary.goods_total + summary.inbound_total, 2),
    summary.currency,
    summary.vat_mode,
    case
      when lower(coalesce(summary.vat_mode, '')) like '%esclus%'
        or lower(coalesce(summary.vat_mode, '')) like '%excluded%' then 'excluded'
      when lower(coalesce(summary.vat_mode, '')) like '%inclus%'
        or lower(coalesce(summary.vat_mode, '')) like '%included%' then 'included'
      else 'unknown'
    end,
    case
      when summary.goods_total <= 0
        or nullif(btrim(coalesce(summary.sku_code, '')), '') is null then 'unmatched'
      when lower(coalesce(summary.vat_mode, '')) like '%esclus%'
        or lower(coalesce(summary.vat_mode, '')) like '%excluded%' then 'exact'
      else 'estimated'
    end,
    jsonb_build_object(
      'supplier_batch_transport', jsonb_build_object(
        'last_charge_id', v_charge.id,
        'inbound_charge_total_net', summary.inbound_total,
        'allocation_method', v_terms.allocation_method
      )
    )
  from summary
  where not exists (
    select 1
    from public.finance_cost_layers as existing
    where existing.supplier_batch_line_id = summary.batch_line_id
  );

  v_result := private.supplier_batch_charge_result(v_charge.id);

  insert into public.admin_audit_events (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    request_metadata
  )
  values (
    v_actor_id,
    nullif(auth.jwt() ->> 'email', ''),
    (select private.current_profile_role()),
    'supplier_batch_charge.confirmed',
    'supplier_batch_charge',
    v_charge.id::text,
    v_result,
    v_terms.notes,
    jsonb_build_object(
      'batch_code', v_batch.batch_code,
      'batch_id', v_batch.id,
      'charge_id', v_charge.id,
      'amount_net', v_charge.amount_net,
      'vat_amount', v_charge.vat_amount,
      'amount_gross', v_charge.amount_gross,
      'capitalized_amount', v_charge.capitalized_amount,
      'allocation_method', v_terms.allocation_method,
      'revision', p_revision,
      'idempotency_key', v_terms.idempotency_key,
      'allocation_total', v_allocation_total,
      'allocation_summary', v_result -> 'allocations',
      'payload_fingerprint', v_payload_fingerprint,
      'user_metadata', v_terms.metadata
    )
  );

  return v_result;
end
$$;

revoke all on function private.supplier_batch_charge_revision(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.finance_cost_layers_supplier_batch_compat()
  from public, anon, authenticated, service_role;
revoke all on function private.normalise_supplier_batch_manual_allocations(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_charge_fingerprint(
  text, numeric, numeric, numeric, numeric, text, text, text, text, text,
  timestamptz, text, text, text, jsonb, jsonb
)
  from public, anon, authenticated, service_role;
revoke all on function private.parse_supplier_batch_charge_payload(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.calculate_supplier_batch_charge_allocations(uuid, text, numeric, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_charge_result(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_charge_line_projection(uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.admin_preview_supplier_batch_charge(text, jsonb)
  from public, anon;
revoke all on function public.admin_list_supplier_batch_cost_summaries(uuid[])
  from public, anon;
revoke all on function public.admin_save_supplier_batch_charge_estimate(text, jsonb, text)
  from public, anon;
revoke all on function public.admin_confirm_supplier_batch_charge(text, jsonb, text, text)
  from public, anon;

grant execute on function public.admin_preview_supplier_batch_charge(text, jsonb)
  to authenticated, service_role;
grant execute on function public.admin_list_supplier_batch_cost_summaries(uuid[])
  to authenticated, service_role;
grant execute on function public.admin_save_supplier_batch_charge_estimate(text, jsonb, text)
  to authenticated, service_role;
grant execute on function public.admin_confirm_supplier_batch_charge(text, jsonb, text, text)
  to authenticated, service_role;
