-- Supplier-batch arrival cost V2.
--
-- This migration is additive and deliberately keeps EUR as the accounting
-- ledger currency.  Existing V1 EUR rows remain readable; V2 writes retain
-- the transaction-currency values and an immutable EUR/FX snapshot alongside
-- them.  No product price, stock quantity, or consumed COGS history is
-- rewritten by this migration.

insert into public.admin_permissions (id, label, group_name, description)
values
  ('supplier_batch.read', 'Read supplier batch costs', 'supplier_batches', 'Can read supplier batch cost facts and history.'),
  ('supplier_batch.estimate', 'Estimate supplier batch costs', 'supplier_batches', 'Can preview and save cancellable supplier batch cost estimates.'),
  ('supplier_batch.confirm', 'Confirm supplier batch costs', 'supplier_batches', 'Can confirm supplier batch costs after a fresh preview.'),
  ('supplier_batch.correct', 'Correct supplier batch costs', 'supplier_batches', 'Can create an auditable correction candidate for a confirmed cost.'),
  ('supplier_batch.export', 'Export supplier batch costs', 'supplier_batches', 'Can export supplier batch cost facts and audit history.')
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'supplier_batch.read'),
  ('admin', 'supplier_batch.estimate'),
  ('admin', 'supplier_batch.confirm'),
  ('admin', 'supplier_batch.correct'),
  ('admin', 'supplier_batch.export'),
  ('purchasing', 'supplier_batch.read'),
  ('purchasing', 'supplier_batch.estimate'),
  ('pricing_manager', 'supplier_batch.read'),
  ('pricing_manager', 'supplier_batch.estimate'),
  ('auditor', 'supplier_batch.read'),
  ('auditor', 'supplier_batch.export')
on conflict do nothing;

alter table public.supplier_batches
  add column if not exists base_currency text not null default 'EUR',
  add column if not exists goods_value_eur numeric(14, 2),
  add column if not exists goods_value_fx_rate_to_eur numeric(24, 12),
  add column if not exists goods_value_fx_date date,
  add column if not exists goods_value_fx_source text,
  add column if not exists goods_value_fx_evidence_url text;

alter table public.supplier_batch_charges
  add column if not exists base_currency text not null default 'EUR',
  add column if not exists fx_rate_to_eur numeric(24, 12),
  add column if not exists fx_rate_date date,
  add column if not exists fx_rate_source text,
  add column if not exists fx_evidence_url text,
  add column if not exists amount_net_eur numeric(14, 2),
  add column if not exists vat_amount_eur numeric(14, 2),
  add column if not exists amount_gross_eur numeric(14, 2),
  add column if not exists capitalized_amount_eur numeric(14, 2);

alter table public.supplier_batch_charge_allocations
  add column if not exists goods_cost_snapshot_eur numeric(14, 2),
  add column if not exists allocated_amount_eur numeric(14, 2),
  add column if not exists allocated_unit_amount_eur numeric(14, 4),
  add column if not exists landed_line_cost_eur numeric(14, 2),
  add column if not exists landed_unit_cost_eur numeric(14, 4),
  add column if not exists rounding_adjustment_eur numeric(14, 2),
  -- V1 did not persist these original-currency landed snapshots.  Keep them
  -- nullable for legacy rows; every V2 allocation writes both values.
  add column if not exists landed_line_cost numeric(14, 2),
  add column if not exists landed_unit_cost numeric(14, 4);

-- V1 had an EUR-only check.  Replace only that narrow check with the V2
-- allow-list; all other amount/status invariants remain in force.
alter table public.supplier_batch_charges
  drop constraint if exists supplier_batch_charges_currency_eur;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batches'::regclass
      and conname = 'supplier_batches_base_currency_eur'
  ) then
    alter table public.supplier_batches
      add constraint supplier_batches_base_currency_eur
      check (base_currency = 'EUR');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batches'::regclass
      and conname = 'supplier_batches_goods_fx_snapshot_complete'
  ) then
    alter table public.supplier_batches
      add constraint supplier_batches_goods_fx_snapshot_complete
      check (
        (
          goods_value_eur is null
          and goods_value_fx_rate_to_eur is null
          and goods_value_fx_date is null
          and goods_value_fx_source is null
          and goods_value_fx_evidence_url is null
        )
        or (
          goods_value_eur is not null
          and goods_value_eur >= 0
          and goods_value_fx_rate_to_eur is not null
          and goods_value_fx_rate_to_eur between 0.000001 and 1000000
          and goods_value_fx_date is not null
          and nullif(btrim(goods_value_fx_source), '') is not null
          and goods_value_eur = round(total_cost * goods_value_fx_rate_to_eur, 2)
          and (
            upper(coalesce(currency, 'EUR')) <> 'EUR'
            or goods_value_fx_rate_to_eur = 1
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charges'::regclass
      and conname = 'supplier_batch_charges_currency_v2'
  ) then
    alter table public.supplier_batch_charges
      add constraint supplier_batch_charges_currency_v2
      check (currency in ('EUR', 'USD', 'CNY'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charges'::regclass
      and conname = 'supplier_batch_charges_base_currency_eur'
  ) then
    alter table public.supplier_batch_charges
      add constraint supplier_batch_charges_base_currency_eur
      check (base_currency = 'EUR');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charges'::regclass
      and conname = 'supplier_batch_charges_fx_snapshot_complete'
  ) then
    alter table public.supplier_batch_charges
      add constraint supplier_batch_charges_fx_snapshot_complete
      check (
        (
          currency = 'EUR'
          and fx_rate_to_eur is null
          and fx_rate_date is null
          and fx_rate_source is null
          and fx_evidence_url is null
          and amount_net_eur is null
          and vat_amount_eur is null
          and amount_gross_eur is null
          and capitalized_amount_eur is null
        )
        or (
          fx_rate_to_eur is not null
          and fx_rate_to_eur between 0.000001 and 1000000
          and fx_rate_date is not null
          and nullif(btrim(fx_rate_source), '') is not null
          and amount_net_eur is not null
          and vat_amount_eur is not null
          and amount_gross_eur is not null
          and capitalized_amount_eur is not null
          and (currency <> 'EUR' or fx_rate_to_eur = 1)
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charges'::regclass
      and conname = 'supplier_batch_charges_eur_amounts_match'
  ) then
    alter table public.supplier_batch_charges
      add constraint supplier_batch_charges_eur_amounts_match
      check (
        (amount_net_eur is null or amount_net_eur >= 0)
        and (vat_amount_eur is null or vat_amount_eur >= 0)
        and (amount_gross_eur is null or amount_gross_eur >= 0)
        and (capitalized_amount_eur is null or capitalized_amount_eur >= 0)
        and (
          (
            fx_rate_to_eur is null
            and fx_rate_date is null
            and fx_rate_source is null
            and fx_evidence_url is null
            and amount_net_eur is null
            and vat_amount_eur is null
            and amount_gross_eur is null
            and capitalized_amount_eur is null
          )
          or (
            fx_rate_to_eur is not null
            and fx_rate_to_eur between 0.000001 and 1000000
            and fx_rate_date is not null
            and nullif(btrim(fx_rate_source), '') is not null
            and amount_net_eur is not null
            and vat_amount_eur is not null
            and amount_gross_eur is not null
            and capitalized_amount_eur is not null
            and (currency <> 'EUR' or fx_rate_to_eur = 1)
            and amount_net_eur = round(amount_net * fx_rate_to_eur, 2)
            and vat_amount_eur = round(vat_amount * fx_rate_to_eur, 2)
            and amount_gross_eur = round(amount_net * fx_rate_to_eur, 2)
              + round(vat_amount * fx_rate_to_eur, 2)
            and capitalized_amount_eur = case
              when capitalized_amount = amount_gross then amount_gross_eur
              else least(round(capitalized_amount * fx_rate_to_eur, 2), amount_gross_eur)
            end
          )
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charges'::regclass
      and conname = 'supplier_batch_charges_gross_matches_net_vat'
  ) then
    alter table public.supplier_batch_charges
      add constraint supplier_batch_charges_gross_matches_net_vat
      check (amount_gross = round(amount_net + vat_amount, 2));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charge_allocations'::regclass
      and conname = 'supplier_batch_charge_allocations_eur_amounts_match'
  ) then
    alter table public.supplier_batch_charge_allocations
      add constraint supplier_batch_charge_allocations_eur_amounts_match
      check (
        (
          goods_cost_snapshot_eur is null
          and allocated_amount_eur is null
          and allocated_unit_amount_eur is null
          and landed_line_cost_eur is null
          and landed_unit_cost_eur is null
          and rounding_adjustment_eur is null
        )
        or (
          goods_cost_snapshot_eur is not null
          and allocated_amount_eur is not null
          and (allocated_unit_amount_eur is not null or qty_received_snapshot = 0)
          and landed_line_cost_eur is not null
          and (landed_unit_cost_eur is not null or qty_received_snapshot = 0)
          and rounding_adjustment_eur is not null
          and goods_cost_snapshot_eur >= 0
          and allocated_amount_eur >= 0
          and (allocated_unit_amount_eur is null or allocated_unit_amount_eur >= 0)
          and landed_line_cost_eur >= 0
          and (landed_unit_cost_eur is null or landed_unit_cost_eur >= 0)
          and landed_line_cost_eur = round(goods_cost_snapshot_eur + allocated_amount_eur, 2)
          and (
            (qty_received_snapshot = 0 and allocated_unit_amount_eur is null)
            or (qty_received_snapshot > 0 and allocated_unit_amount_eur = round(allocated_amount_eur / qty_received_snapshot, 4))
          )
          and (
            (qty_received_snapshot = 0 and landed_unit_cost_eur is null)
            or (qty_received_snapshot > 0 and landed_unit_cost_eur = round(landed_line_cost_eur / qty_received_snapshot, 4))
          )
        )
      );

  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charge_allocations'::regclass
      and conname = 'supplier_batch_charge_allocations_original_landed_complete'
  ) then
    alter table public.supplier_batch_charge_allocations
      add constraint supplier_batch_charge_allocations_original_landed_complete
      check (
        (
          landed_line_cost is null
          and landed_unit_cost is null
        )
        or (
          landed_line_cost is not null
          and landed_line_cost >= 0
          and landed_line_cost = round(goods_cost_snapshot + allocated_amount, 2)
          and (
            (qty_received_snapshot = 0 and landed_unit_cost is null)
            or (
              qty_received_snapshot > 0
              and landed_unit_cost is not null
              and landed_unit_cost >= 0
              and landed_unit_cost = round(landed_line_cost / qty_received_snapshot, 4)
            )
          )
        )
      );
  end if;
end
$$;

-- Correction rows are created before the effective-read helpers below so all
-- SQL functions can resolve the relation during migration compilation.
create table if not exists public.supplier_batch_charge_corrections (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.supplier_batches(id) on update cascade on delete restrict,
  original_charge_id uuid not null,
  replacement_charge_id uuid,
  status text not null default 'candidate_ready',
  correction_reason text not null,
  finance_adjustment_required boolean not null default false,
  idempotency_key text not null,
  preview_fingerprint text not null,
  revision text not null,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint supplier_batch_charge_corrections_status_check
    check (status in ('candidate_ready', 'pending_finance_adjustment', 'applied', 'rejected')),
  constraint supplier_batch_charge_corrections_state_shape
    check (
      (
        status in ('candidate_ready', 'rejected')
        and replacement_charge_id is null
        and finance_adjustment_required = false
      )
      or (
        status = 'applied'
        and replacement_charge_id is not null
        and finance_adjustment_required = false
      )
      or (
        status = 'pending_finance_adjustment'
        and replacement_charge_id is null
        and finance_adjustment_required = true
      )
    ),
  constraint supplier_batch_charge_corrections_reason_not_blank
    check (nullif(btrim(correction_reason), '') is not null),
  constraint supplier_batch_charge_corrections_idempotency_not_blank
    check (nullif(btrim(idempotency_key), '') is not null),
  constraint supplier_batch_charge_corrections_fingerprint_not_blank
    check (nullif(btrim(preview_fingerprint), '') is not null),
  constraint supplier_batch_charge_corrections_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint supplier_batch_charge_corrections_original_charge_batch_fk
    foreign key (original_charge_id, batch_id)
    references public.supplier_batch_charges(id, batch_id)
    on update cascade on delete restrict,
  constraint supplier_batch_charge_corrections_replacement_charge_batch_fk
    foreign key (replacement_charge_id, batch_id)
    references public.supplier_batch_charges(id, batch_id)
    on update cascade on delete restrict
);

create unique index if not exists supplier_batch_charge_corrections_idempotency_uidx
  on public.supplier_batch_charge_corrections (idempotency_key);
create unique index if not exists supplier_batch_charge_corrections_one_active_idx
  on public.supplier_batch_charge_corrections (original_charge_id)
  where status in ('candidate_ready', 'pending_finance_adjustment', 'applied');

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charge_corrections'::regclass
      and conname = 'supplier_batch_charge_corrections_state_shape'
  ) then
    alter table public.supplier_batch_charge_corrections
      drop constraint supplier_batch_charge_corrections_state_shape;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.supplier_batch_charge_corrections'::regclass
      and conname = 'supplier_batch_charge_corrections_state_shape'
  ) then
    alter table public.supplier_batch_charge_corrections
      add constraint supplier_batch_charge_corrections_state_shape
      check (
        (
          status in ('candidate_ready', 'rejected')
          and replacement_charge_id is null
          and finance_adjustment_required = false
        )
        or (
          status = 'applied'
          and replacement_charge_id is not null
          and finance_adjustment_required = false
        )
        or (
          status = 'pending_finance_adjustment'
          and replacement_charge_id is null
          and finance_adjustment_required = true
        )
      );
  end if;
end
$$;

create or replace function private.supplier_batch_correction_receipt_v2(
  p_status text,
  p_correction_id uuid,
  p_original_charge_id uuid,
  p_replacement_charge_id uuid,
  p_batch_code text,
  p_idempotency_key text,
  p_preview_fingerprint text,
  p_revision text,
  p_finance_adjustment_required boolean,
  p_replacement jsonb default null
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'status', p_status,
    'correctionId', p_correction_id,
    'originalChargeId', p_original_charge_id,
    'replacementChargeId', p_replacement_charge_id,
    'batchCode', p_batch_code,
    'idempotencyKey', p_idempotency_key,
    'previewFingerprint', p_preview_fingerprint,
    'revision', p_revision,
    'financeAdjustmentRequired', p_finance_adjustment_required,
    'replacement', p_replacement
  )
$$;

-- finance_cost_layers is the narrowest persistence boundary in the current
-- installation: totals are numeric(12,2), unit values numeric(12,4), and the
-- application also derives bigint cents for immutable ledger comparisons.
-- Validate the complete goods+inbound result before any UPDATE/INSERT so a
-- wider upstream amount cannot fail halfway through a financial write.
create or replace function private.supplier_batch_v2_assert_finance_totals(
  p_goods_total numeric,
  p_inbound_total numeric,
  p_received_qty numeric default null
)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_total numeric;
  v_goods_unit numeric;
  v_landed_unit numeric;
begin
  if p_goods_total is null or p_inbound_total is null then
    raise exception 'Supplier batch finance totals are required'
      using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
  end if;

  v_total := round(p_goods_total + p_inbound_total, 2);
  if p_goods_total < 0
     or p_inbound_total < 0
     or p_goods_total > 9999999999.99
     or p_inbound_total > 9999999999.99
     or v_total > 9999999999.99
     or round(abs(p_goods_total) * 100, 0) > 9223372036854775807
     or round(abs(p_inbound_total) * 100, 0) > 9223372036854775807
     or round(abs(v_total) * 100, 0) > 9223372036854775807 then
    raise exception 'Supplier batch finance total exceeds the persisted numeric range'
      using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
  end if;

  if p_received_qty is not null and p_received_qty > 0 then
    v_goods_unit := round(p_goods_total / p_received_qty, 4);
    v_landed_unit := round(v_total / p_received_qty, 4);
    if v_goods_unit > 99999999.9999
       or v_landed_unit > 99999999.9999
       or round(abs(v_goods_unit) * 10000, 0) > 9223372036854775807
       or round(abs(v_landed_unit) * 10000, 0) > 9223372036854775807 then
      raise exception 'Supplier batch finance unit value exceeds the persisted numeric range'
        using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
    end if;
  end if;
end
$$;

-- Convert a non-negative scaled money value to bigint cents only after checking
-- both the narrowest finance numeric(12,2) amount and the bigint boundary.  The
-- allocation enrichment path is also used by previews, so a very large single
-- line must return the same stable domain detail instead of leaking a raw
-- numeric cast error.
create or replace function private.supplier_batch_v2_guard_cents(
  p_cents numeric,
  p_qty numeric default null
)
returns bigint
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_cents numeric;
  v_unit numeric;
begin
  if p_cents is null then
    return null;
  end if;
  if p_cents::text = 'NaN' then
    raise exception 'Supplier batch finance cents are not finite'
      using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
  end if;

  v_cents := round(p_cents, 0);
  if p_cents < 0
     or v_cents < 0
     or v_cents > 999999999999.00
     or v_cents > 9223372036854775807.00 then
    raise exception 'Supplier batch finance cents exceed the persisted numeric range'
      using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
  end if;

  -- A goods/landed line unit is persisted at numeric(12,4).  Checking the
  -- unit from the rounded cents keeps the line-level guard aligned with the
  -- exact value that will be written, rather than a wider intermediate.
  if p_qty is not null and p_qty > 0 then
    v_unit := round((v_cents / 100) / p_qty, 4);
    if v_unit::text = 'NaN'
       or v_unit < 0
       or v_unit > 99999999.9999
       or round(abs(v_unit) * 10000, 0) > 9223372036854775807.00 then
      raise exception 'Supplier batch finance unit exceeds the persisted numeric range'
        using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
    end if;
  end if;

  -- This is deliberately the first bigint conversion in the helper: every
  -- caller has passed the numeric(12,2), numeric(12,4), and signed-integer
  -- checks above.
  return v_cents::bigint;
end
$$;

create or replace function private.supplier_batch_v2_guard_unit(
  p_unit numeric
)
returns numeric
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_unit numeric;
begin
  if p_unit is null then
    return null;
  end if;
  if p_unit::text = 'NaN' then
    raise exception 'Supplier batch finance unit is not finite'
      using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
  end if;
  v_unit := round(p_unit, 4);
  if p_unit < 0
     or v_unit < 0
     or v_unit > 99999999.9999
     or round(abs(v_unit) * 10000, 0) > 9223372036854775807.00 then
    raise exception 'Supplier batch finance unit exceeds the persisted numeric range'
      using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
  end if;
  return v_unit;
end
$$;

-- Recalculate one batch from its effective confirmed charge version.  This is
-- called only by the atomic, unconsumed correction branch; all affected
-- layers are therefore safe to refresh while preserving their identity.  An
-- applied correction keeps the original allocations for audit/history, but
-- excludes them from this effective financial projection.
create or replace function private.rebuild_supplier_batch_finance_layers_v2(
  p_batch_id uuid,
  p_last_charge_id uuid default null,
  p_allocation_method text default 'correction'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch public.supplier_batches%rowtype;
  v_goods_fx_rate numeric;
  v_finance_row record;
begin
  select * into v_batch
  from public.supplier_batches as batch
  where batch.id = p_batch_id;
  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_id
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;

  v_goods_fx_rate := case
    when upper(coalesce(v_batch.currency, 'EUR')) = 'EUR' then 1
    else v_batch.goods_value_fx_rate_to_eur
  end;
  if v_goods_fx_rate is null then
    raise exception 'A non-EUR batch requires an independent goods-value FX snapshot before rebuilding finance layers'
      using errcode = '55000', detail = 'BATCH_FX_RATE_REQUIRED';
  end if;

  for v_finance_row in
    with confirmed_inbound as (
      select allocation.batch_line_id,
        round(sum(coalesce(allocation.allocated_amount_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR'
            then allocation.allocated_amount else 0 end)), 2) as inbound_total
      from public.supplier_batch_charge_allocations as allocation
      join public.supplier_batch_charges as charge
        on charge.id = allocation.charge_id
       and charge.batch_id = allocation.batch_id
      where allocation.batch_id = p_batch_id
        and charge.status = 'confirmed'
        and not exists (
          select 1
          from public.supplier_batch_charge_corrections as correction
          where correction.original_charge_id = charge.id
            and correction.status = 'applied'
        )
      group by allocation.batch_line_id
    )
    select round(line.qty_received::numeric * line.unit_cost * v_goods_fx_rate, 2) as goods_total,
      coalesce(confirmed_inbound.inbound_total, 0) as inbound_total,
      line.qty_received as received_qty
    from public.supplier_batch_lines as line
    left join confirmed_inbound on confirmed_inbound.batch_line_id = line.id
    where line.batch_id = p_batch_id and line.qty_received > 0
  loop
    perform private.supplier_batch_v2_assert_finance_totals(
      v_finance_row.goods_total,
      v_finance_row.inbound_total,
      v_finance_row.received_qty
    );
  end loop;

  with confirmed_inbound as (
    select allocation.batch_line_id,
      round(sum(coalesce(allocation.allocated_amount_eur,
        case when upper(coalesce(charge.currency, 'EUR')) = 'EUR'
          then allocation.allocated_amount else 0 end)), 2) as inbound_total
    from public.supplier_batch_charge_allocations as allocation
    join public.supplier_batch_charges as charge
      on charge.id = allocation.charge_id
     and charge.batch_id = allocation.batch_id
    where allocation.batch_id = p_batch_id
      and charge.status = 'confirmed'
      and not exists (
        select 1
        from public.supplier_batch_charge_corrections as correction
        where correction.original_charge_id = charge.id
          and correction.status = 'applied'
      )
    group by allocation.batch_line_id
  ), summary as (
    select line.id as batch_line_id, line.sku_code, line.qty_received,
      round(line.qty_received::numeric * line.unit_cost * v_goods_fx_rate, 2) as goods_total,
      coalesce(confirmed_inbound.inbound_total, 0) as inbound_total,
      v_batch.id as batch_id, v_batch.supplier_id, v_batch.batch_code,
      v_batch.vat_mode
    from public.supplier_batch_lines as line
    left join confirmed_inbound on confirmed_inbound.batch_line_id = line.id
    where line.batch_id = p_batch_id and line.qty_received > 0
  )
  update public.finance_cost_layers as layer
  set received_qty = summary.qty_received,
      goods_unit_cost_net = round(summary.goods_total / nullif(summary.qty_received, 0), 4),
      goods_total_cost_net = summary.goods_total,
      inbound_charge_total_net = summary.inbound_total,
      unit_cost_net = round((summary.goods_total + summary.inbound_total)
        / nullif(summary.qty_received, 0), 4),
      total_cost_net = round(summary.goods_total + summary.inbound_total, 2),
      currency = 'EUR',
      metadata = coalesce(layer.metadata, '{}'::jsonb) || jsonb_build_object(
        'supplier_batch_transport', jsonb_build_object(
          'last_charge_id', p_last_charge_id,
          'inbound_charge_total_net', summary.inbound_total,
          'allocation_method', p_allocation_method,
          'effective_version', true,
          'source', 'supplier_batch_cost_v2'
        )
      ),
      updated_at = now()
  from summary
  where layer.supplier_batch_line_id = summary.batch_line_id;

  with confirmed_inbound as (
    select allocation.batch_line_id,
      round(sum(coalesce(allocation.allocated_amount_eur,
        case when upper(coalesce(charge.currency, 'EUR')) = 'EUR'
          then allocation.allocated_amount else 0 end)), 2) as inbound_total
    from public.supplier_batch_charge_allocations as allocation
    join public.supplier_batch_charges as charge
      on charge.id = allocation.charge_id
     and charge.batch_id = allocation.batch_id
    where allocation.batch_id = p_batch_id
      and charge.status = 'confirmed'
      and not exists (
        select 1
        from public.supplier_batch_charge_corrections as correction
        where correction.original_charge_id = charge.id
          and correction.status = 'applied'
      )
    group by allocation.batch_line_id
  ), summary as (
    select line.id as batch_line_id, line.sku_code, line.qty_received,
      round(line.qty_received::numeric * line.unit_cost * v_goods_fx_rate, 2) as goods_total,
      coalesce(confirmed_inbound.inbound_total, 0) as inbound_total,
      v_batch.id as batch_id, v_batch.supplier_id, v_batch.batch_code,
      v_batch.vat_mode
    from public.supplier_batch_lines as line
    left join confirmed_inbound on confirmed_inbound.batch_line_id = line.id
    where line.batch_id = p_batch_id and line.qty_received > 0
  )
  insert into public.finance_cost_layers (
    supplier_batch_line_id, supplier_batch_id, supplier_id, sku_code, batch_code,
    received_qty, allocated_qty, consumed_qty, goods_unit_cost_net,
    goods_total_cost_net, inbound_charge_total_net, unit_cost_net, total_cost_net,
    currency, vat_mode, vat_treatment, confidence, metadata
  )
  select summary.batch_line_id, summary.batch_id, summary.supplier_id,
    summary.sku_code, summary.batch_code, summary.qty_received, 0, 0,
    round(summary.goods_total / nullif(summary.qty_received, 0), 4),
    summary.goods_total, summary.inbound_total,
    round((summary.goods_total + summary.inbound_total)
      / nullif(summary.qty_received, 0), 4),
    round(summary.goods_total + summary.inbound_total, 2), 'EUR', summary.vat_mode,
    case when lower(coalesce(summary.vat_mode, '')) like '%esclus%'
      or lower(coalesce(summary.vat_mode, '')) like '%excluded%' then 'excluded'
      when lower(coalesce(summary.vat_mode, '')) like '%inclus%'
      or lower(coalesce(summary.vat_mode, '')) like '%included%' then 'included'
      else 'unknown' end,
    case when summary.goods_total <= 0
      or nullif(btrim(coalesce(summary.sku_code, '')), '') is null
      then 'unmatched' else 'estimated' end,
    jsonb_build_object('supplier_batch_transport', jsonb_build_object(
      'last_charge_id', p_last_charge_id,
      'inbound_charge_total_net', summary.inbound_total,
      'allocation_method', p_allocation_method,
      'effective_version', true,
      'source', 'supplier_batch_cost_v2'))
  from summary
  where not exists (
    select 1 from public.finance_cost_layers as existing
    where existing.supplier_batch_line_id = summary.batch_line_id
  );
end
$$;

-- Estimated charges are cancellable drafts. Cancellation never deletes the
-- row; the original payload and audit event remain available to history and
-- export consumers. The route may add the legacy estimate compatibility map;
-- the database function itself requires the dedicated estimate permission.
create or replace function public.admin_cancel_supplier_batch_charge_v2(
  p_batch_code text,
  p_charge_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_batch public.supplier_batches%rowtype;
  v_charge public.supplier_batch_charges%rowtype;
  v_before jsonb;
  v_result jsonb;
  v_existing_key text;
  v_existing_reason text;
begin
  if v_actor_id is null and not coalesce((auth.jwt() ->> 'role') = 'service_role', false) then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not (select private.supplier_batch_v2_has_permission('supplier_batch.estimate', true)) then
    raise exception 'Supplier batch estimate permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;
  if p_charge_id is null then
    raise exception 'chargeId is required' using errcode = '22023', detail = 'CHARGE_NOT_FOUND';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A cancellation reason is required'
      using errcode = '22023', detail = 'CANCELLATION_REASON_REQUIRED';
  end if;
  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'idempotencyKey is required when cancelling an estimate'
      using errcode = '22023', detail = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(coalesce(p_batch_code, ''))
  for update;
  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;

  select * into v_charge
  from public.supplier_batch_charges as charge
  where charge.id = p_charge_id
    and charge.batch_id = v_batch.id
  for update;
  if v_charge.id is null then
    raise exception 'Supplier batch charge not found: %', p_charge_id
      using errcode = 'P0002', detail = 'CHARGE_NOT_FOUND';
  end if;
  if exists (
    select 1
    from public.supplier_batch_charge_corrections as correction
    where correction.replacement_charge_id = v_charge.id
  ) then
    raise exception 'Correction replacements are managed only by the correction RPC'
      using errcode = '55000', detail = 'CORRECTION_REPLACEMENT_MANAGED';
  end if;
  v_before := to_jsonb(v_charge);
  v_existing_key := v_charge.metadata ->> 'cancelIdempotencyKey';
  v_existing_reason := v_charge.metadata ->> 'cancelReason';
  if v_charge.status = 'cancelled' then
    if v_existing_key = btrim(p_idempotency_key)
       and v_existing_reason = btrim(p_reason) then
      return private.supplier_batch_charge_result_v2(v_charge.id);
    end if;
    if v_existing_key = btrim(p_idempotency_key) then
      raise exception 'Idempotency key conflicts with a different cancellation reason'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
    raise exception 'Supplier batch charge is already cancelled'
      using errcode = '55000', detail = 'CHARGE_CANCELLED';
  end if;
  if v_charge.status <> 'estimated' then
    raise exception 'Only estimated supplier batch charges can be cancelled'
      using errcode = '55000', detail = 'CHARGE_IMMUTABLE';
  end if;

  update public.supplier_batch_charges
  set status = 'cancelled',
      updated_by = v_actor_id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'cancelReason', btrim(p_reason),
        'cancelIdempotencyKey', btrim(p_idempotency_key),
        'cancelledAt', now(),
        'source', 'supplier_batch_cost_v2'
      ),
      updated_at = now()
  where id = v_charge.id
  returning * into v_charge;

  v_result := private.supplier_batch_charge_result_v2(v_charge.id);
  insert into public.admin_audit_events (
    actor_id, actor_email, actor_role, action, entity_type, entity_id,
    before_data, after_data, reason, request_metadata
  ) values (
    v_actor_id, nullif(auth.jwt() ->> 'email', ''),
    (select private.current_profile_role()),
    'supplier_batch_charge.cancelled_v2', 'supplier_batch_charge',
    v_charge.id::text, v_before, v_result, btrim(p_reason),
    jsonb_build_object(
      'batch_code', v_batch.batch_code,
      'batch_id', v_batch.id,
      'charge_id', v_charge.id,
      'idempotency_key', btrim(p_idempotency_key),
      'source', 'v2'
    )
  );
  return v_result;
end
$$;

create or replace function public.admin_confirm_supplier_batch_charge_v2(
  p_batch_code text,
  p_payload jsonb,
  p_revision text,
  p_preview_fingerprint text,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_batch public.supplier_batches%rowtype;
  v_by_id public.supplier_batch_charges%rowtype;
  v_existing public.supplier_batch_charges%rowtype;
  v_charge public.supplier_batch_charges%rowtype;
  v_terms record;
  v_fingerprint text;
  v_current_revision text;
  v_batch_currency text;
  v_goods_fx_rate numeric;
  v_goods_value_eur numeric;
  v_allocations jsonb;
  v_allocation_total_eur numeric;
  v_result jsonb;
  v_finance_row record;
begin
  if v_actor_id is null and not coalesce((auth.jwt() ->> 'role') = 'service_role', false) then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not (select private.supplier_batch_v2_has_permission('supplier_batch.confirm', false)) then
    raise exception 'Supplier batch confirmation permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;
  if nullif(btrim(coalesce(p_revision, '')), '') is null
     or nullif(btrim(coalesce(p_preview_fingerprint, '')), '') is null then
    raise exception 'A revision and preview fingerprint are required for confirmation'
      using errcode = '22023', detail = 'STALE_PREVIEW';
  end if;

  select * into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(coalesce(p_batch_code, ''))
  for update;
  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;
  v_batch_currency := upper(coalesce(v_batch.currency, 'EUR'));

  select * into v_terms
  from private.parse_supplier_batch_charge_payload_v2(p_payload, p_idempotency_key);
  if v_terms.idempotency_key is null then
    raise exception 'idempotencyKey is required when confirming a charge'
      using errcode = '22023';
  end if;
  if v_terms.allocation_method <> 'manual' then
    v_terms.manual_allocations := '[]'::jsonb;
  end if;

  -- Lock every row addressed by either identifier in one deterministic id
  -- order.  This makes a chargeId/key pair atomic and avoids the classic
  -- deadlock where two retries lock the pair in opposite orders.
  perform charge.id
  from public.supplier_batch_charges as charge
  where charge.id = v_terms.charge_id
     or charge.idempotency_key = v_terms.idempotency_key
  order by charge.id
  for update;
  if v_terms.charge_id is not null then
    select * into v_by_id
    from public.supplier_batch_charges as charge
    where charge.id = v_terms.charge_id;
    if v_by_id.id is null or v_by_id.batch_id <> v_batch.id then
      raise exception 'Supplier batch charge not found: %', v_terms.charge_id
        using errcode = 'P0002', detail = 'CHARGE_NOT_FOUND';
    end if;
  end if;
  select * into v_existing
  from public.supplier_batch_charges as charge
  where charge.idempotency_key = v_terms.idempotency_key;
  if v_terms.charge_id is not null and (
    v_existing.id is null or v_existing.id <> v_terms.charge_id
  ) then
    raise exception 'chargeId and idempotencyKey must identify the same supplier batch charge'
      using errcode = '23505', detail = 'CHARGE_IDEMPOTENCY_MISMATCH';
  end if;
  if v_existing.id is not null and v_existing.batch_id <> v_batch.id then
    raise exception 'Idempotency key belongs to another supplier batch'
      using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
  end if;
  if v_existing.id is not null and exists (
    select 1
    from public.supplier_batch_charge_corrections as correction
    where correction.replacement_charge_id = v_existing.id
  ) then
    raise exception 'Correction replacements are managed only by the correction RPC'
      using errcode = '55000', detail = 'CORRECTION_REPLACEMENT_MANAGED';
  end if;
  if v_existing.id is not null and v_existing.status = 'cancelled' then
    raise exception 'Cancelled supplier batch charges cannot be confirmed'
      using errcode = '55000', detail = 'CHARGE_CANCELLED';
  end if;

  v_fingerprint := private.supplier_batch_charge_fingerprint_v2(
    v_terms.charge_type, v_terms.amount_net, v_terms.vat_amount,
    v_terms.amount_gross, v_terms.capitalized_amount, v_terms.currency,
    v_terms.vat_treatment, v_terms.allocation_method, v_terms.carrier_name,
    v_terms.charge_reference, v_terms.occurred_at, v_terms.evidence_url,
    v_terms.notes, v_terms.zero_cost_reason, v_terms.manual_allocations,
    v_terms.metadata, v_terms.fx_rate_to_eur, v_terms.fx_rate_date,
    v_terms.fx_rate_source, v_terms.fx_evidence_url,
    v_terms.batch_goods_fx_rate_to_eur, v_terms.batch_goods_fx_date,
    v_terms.batch_goods_fx_source, v_terms.batch_goods_fx_evidence_url
  );
  if v_fingerprint <> p_preview_fingerprint then
    raise exception 'Preview fingerprint does not match the confirmation payload'
      using errcode = '40001', detail = 'STALE_PREVIEW';
  end if;
  if v_existing.id is not null and v_existing.status = 'confirmed' then
    if v_existing.payload_fingerprint <> v_fingerprint then
      raise exception 'Idempotency key conflicts with a different confirmed payload'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
    return private.supplier_batch_charge_result_v2(v_existing.id);
  end if;

  -- Lock all rows that feed the preview before checking revision and finance
  -- usage.  This makes the fingerprint/revision pair a real stale gate.
  perform line.id
  from public.supplier_batch_lines as line
  where line.batch_id = v_batch.id
  order by line.id
  for update;
  perform layer.id
  from public.finance_cost_layers as layer
  join public.supplier_batch_lines as line on line.id = layer.supplier_batch_line_id
  where line.batch_id = v_batch.id
  order by layer.supplier_batch_line_id, layer.id
  for update;
  v_current_revision := private.supplier_batch_charge_revision(v_batch.id);
  if p_revision <> v_current_revision then
    raise exception 'Supplier batch revision is stale; preview must be refreshed'
      using errcode = '40001', detail = 'STALE_REVISION';
  end if;

  if v_terms.vat_treatment = 'unknown' then
    raise exception 'Confirmed supplier batch charges require known VAT treatment'
      using errcode = '23514', detail = 'UNKNOWN_VAT_NOT_ALLOWED';
  end if;
  if exists (
    select 1
    from public.finance_cost_layers as layer
    join public.supplier_batch_lines as line on line.id = layer.supplier_batch_line_id
    where line.batch_id = v_batch.id
      and (layer.allocated_qty > 0 or layer.consumed_qty > 0)
  ) then
    raise exception 'Financial adjustment required: an affected cost layer is allocated or consumed'
      using errcode = '55000', detail = 'FINANCE_ADJUSTMENT_REQUIRED';
  end if;
  if v_existing.id is not null and exists (
    select 1 from public.supplier_batch_charge_allocations as allocation
    where allocation.charge_id = v_existing.id
  ) then
    raise exception 'Estimated charge already has allocations and cannot be rewritten'
      using errcode = '55000', detail = 'CHARGE_IMMUTABLE';
  end if;

  v_goods_fx_rate := case
    when v_batch_currency = 'EUR' then 1
    when v_batch.goods_value_fx_rate_to_eur is not null then v_batch.goods_value_fx_rate_to_eur
    when v_terms.batch_goods_fx_rate_to_eur is not null then v_terms.batch_goods_fx_rate_to_eur
    else null
  end;
  if v_batch_currency <> 'EUR' and v_goods_fx_rate is null then
    raise exception 'A non-EUR batch requires an independent goods-value FX snapshot before confirmation'
      using errcode = '55000', detail = 'BATCH_FX_RATE_REQUIRED';
  end if;
  if v_batch_currency = 'EUR' and v_terms.batch_goods_fx_rate_to_eur is not null
     and v_terms.batch_goods_fx_rate_to_eur <> 1 then
    raise exception 'EUR batch goods FX rate must be exactly 1'
      using errcode = '22023', detail = 'BATCH_FX_RATE_REQUIRED';
  end if;
  if v_batch.goods_value_fx_rate_to_eur is not null
     and v_terms.batch_goods_fx_rate_to_eur is not null
    and (v_batch.goods_value_fx_rate_to_eur <> v_terms.batch_goods_fx_rate_to_eur
      or v_batch.goods_value_fx_date <> v_terms.batch_goods_fx_date
      or v_batch.goods_value_fx_source <> v_terms.batch_goods_fx_source
      or v_batch.goods_value_fx_evidence_url is distinct from v_terms.batch_goods_fx_evidence_url) then
    raise exception 'Batch goods FX snapshot is immutable; refresh with the stored valuation'
      using errcode = '55000', detail = 'BATCH_FX_SNAPSHOT_IMMUTABLE';
  end if;
  if v_batch_currency <> 'EUR' and v_batch.goods_value_fx_rate_to_eur is null then
    v_goods_value_eur := private.supplier_batch_v2_goods_value_eur(v_batch.id, v_goods_fx_rate);
    update public.supplier_batches
    set goods_value_eur = v_goods_value_eur,
        goods_value_fx_rate_to_eur = v_terms.batch_goods_fx_rate_to_eur,
        goods_value_fx_date = v_terms.batch_goods_fx_date,
        goods_value_fx_source = v_terms.batch_goods_fx_source,
        goods_value_fx_evidence_url = v_terms.batch_goods_fx_evidence_url,
        updated_at = now()
    where id = v_batch.id;
    select * into v_batch from public.supplier_batches where id = v_batch.id;
  end if;
  v_goods_value_eur := private.supplier_batch_v2_goods_value_eur(v_batch.id, v_goods_fx_rate);

  v_allocations := private.supplier_batch_v2_allocations_json(
    v_batch.id, v_terms.allocation_method, v_terms.capitalized_amount,
    v_terms.manual_allocations, v_terms.fx_rate_to_eur, v_goods_fx_rate,
    v_batch_currency, v_terms.currency,
    v_terms.amount_net, v_terms.vat_amount, v_terms.amount_gross
  );
  v_allocation_total_eur := private.supplier_batch_v2_allocation_total(v_allocations, 'allocatedAmountEur');
  if round(v_allocation_total_eur, 2) <> (
    case
      when v_terms.capitalized_amount = v_terms.amount_gross
        then round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
      else least(
        round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
        round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
      )
    end
  ) then
    raise exception 'EUR allocation total must equal the converted capitalized amount'
      using errcode = '23514', detail = 'ALLOCATION_EUR_TOTAL_MISMATCH';
  end if;

  if v_existing.id is null then
    insert into public.supplier_batch_charges (
      batch_id, charge_type, status, amount_net, vat_amount, capitalized_amount,
      currency, vat_treatment, allocation_method, carrier_name, reference,
      occurred_at, evidence_url, notes, zero_cost_reason, idempotency_key,
      payload_fingerprint, manual_allocations_snapshot, created_by, updated_by,
      confirmed_by, confirmed_at, base_currency, fx_rate_to_eur, fx_rate_date,
      fx_rate_source, fx_evidence_url, amount_net_eur, vat_amount_eur,
      amount_gross_eur, capitalized_amount_eur, metadata
    ) values (
      v_batch.id, v_terms.charge_type, 'confirmed', v_terms.amount_net,
      v_terms.vat_amount, v_terms.capitalized_amount, v_terms.currency,
      v_terms.vat_treatment, v_terms.allocation_method, v_terms.carrier_name,
      v_terms.charge_reference, v_terms.occurred_at, v_terms.evidence_url,
      v_terms.notes, v_terms.zero_cost_reason, v_terms.idempotency_key,
      v_fingerprint, v_terms.manual_allocations, v_actor_id, v_actor_id,
      v_actor_id, now(), 'EUR', v_terms.fx_rate_to_eur, v_terms.fx_rate_date,
      v_terms.fx_rate_source, v_terms.fx_evidence_url,
      round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2),
      round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
      round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
        + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
      case when v_terms.capitalized_amount = v_terms.amount_gross
        then round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
        else least(
          round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
          round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
            + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
        )
      end,
      v_terms.metadata
    ) returning * into v_charge;
  else
    update public.supplier_batch_charges
    set charge_type = v_terms.charge_type, status = 'confirmed',
        amount_net = v_terms.amount_net, vat_amount = v_terms.vat_amount,
        capitalized_amount = v_terms.capitalized_amount, currency = v_terms.currency,
        vat_treatment = v_terms.vat_treatment, allocation_method = v_terms.allocation_method,
        carrier_name = v_terms.carrier_name, reference = v_terms.charge_reference,
        occurred_at = v_terms.occurred_at, evidence_url = v_terms.evidence_url,
        notes = v_terms.notes, zero_cost_reason = v_terms.zero_cost_reason,
        base_currency = 'EUR', fx_rate_to_eur = v_terms.fx_rate_to_eur,
        fx_rate_date = v_terms.fx_rate_date, fx_rate_source = v_terms.fx_rate_source,
        fx_evidence_url = v_terms.fx_evidence_url,
        amount_net_eur = round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2),
        vat_amount_eur = round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
        amount_gross_eur = round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
        capitalized_amount_eur = case when v_terms.capitalized_amount = v_terms.amount_gross
          then round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
            + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
          else least(
            round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
            round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
              + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
          )
        end,
        payload_fingerprint = v_fingerprint, manual_allocations_snapshot = v_terms.manual_allocations,
        updated_by = v_actor_id, confirmed_by = v_actor_id, confirmed_at = now(),
        metadata = v_terms.metadata, updated_at = now()
    where id = v_existing.id
    returning * into v_charge;
  end if;

  insert into public.supplier_batch_charge_allocations (
    batch_id, charge_id, batch_line_id, qty_received_snapshot,
    goods_cost_snapshot, goods_cost_snapshot_eur, weight_gram_snapshot,
    basis_value, share_ratio, allocated_amount, allocated_amount_eur,
    allocated_unit_amount, allocated_unit_amount_eur, landed_line_cost,
    landed_line_cost_eur, landed_unit_cost, landed_unit_cost_eur,
    rounding_adjustment, rounding_adjustment_eur, metadata
  )
  select
    v_batch.id, v_charge.id, allocation.batch_line_id,
    allocation.qty_received_snapshot, allocation.goods_cost_snapshot,
    allocation.goods_cost_snapshot_eur, allocation.weight_gram_snapshot,
    allocation.basis_value, allocation.share_ratio, allocation.allocated_amount,
    allocation.allocated_amount_eur, allocation.allocated_unit_amount,
    allocation.allocated_unit_amount_eur, allocation.landed_line_cost,
    allocation.landed_line_cost_eur, allocation.landed_unit_cost,
    allocation.landed_unit_cost_eur, allocation.rounding_adjustment,
    allocation.rounding_adjustment_eur,
    jsonb_build_object('lineNo', allocation.line_no, 'skuCode', allocation.sku_code,
      'allocationMethod', v_terms.allocation_method, 'source', 'supplier_batch_cost_v2')
  from private.calculate_supplier_batch_charge_allocations_v2(
    v_batch.id, v_terms.allocation_method, v_terms.capitalized_amount,
    v_terms.manual_allocations, v_terms.fx_rate_to_eur, v_goods_fx_rate,
    v_batch_currency, v_terms.currency,
    v_terms.amount_net, v_terms.vat_amount, v_terms.amount_gross
  ) as allocation;

  for v_finance_row in
    with confirmed_inbound as (
      select allocation.batch_line_id,
        round(sum(coalesce(allocation.allocated_amount_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR'
            then allocation.allocated_amount else 0 end)), 2) as inbound_total
      from public.supplier_batch_charge_allocations as allocation
      join public.supplier_batch_charges as charge
        on charge.id = allocation.charge_id
       and charge.batch_id = allocation.batch_id
      where allocation.batch_id = v_batch.id
        and charge.status = 'confirmed'
        and not exists (
          select 1
          from public.supplier_batch_charge_corrections as correction
          where correction.original_charge_id = charge.id
            and correction.status = 'applied'
        )
      group by allocation.batch_line_id
    )
    select round(line.qty_received::numeric * line.unit_cost * v_goods_fx_rate, 2) as goods_total,
      coalesce(confirmed_inbound.inbound_total, 0) as inbound_total,
      line.qty_received as received_qty
    from public.supplier_batch_lines as line
    left join confirmed_inbound on confirmed_inbound.batch_line_id = line.id
    where line.batch_id = v_batch.id and line.qty_received > 0
  loop
    perform private.supplier_batch_v2_assert_finance_totals(
      v_finance_row.goods_total,
      v_finance_row.inbound_total,
      v_finance_row.received_qty
    );
  end loop;

  -- Only unconsumed layers are recalculated.  The ledger is always EUR, so a
  -- non-EUR batch uses the stored line-level goods EUR snapshot and EUR
  -- inbound allocations; no original-currency values are mixed.
  with confirmed_inbound as (
    select allocation.batch_line_id,
      round(sum(coalesce(allocation.allocated_amount_eur,
        case when upper(coalesce(charge.currency, 'EUR')) = 'EUR'
          then allocation.allocated_amount else 0 end)), 2) as inbound_total
    from public.supplier_batch_charge_allocations as allocation
    join public.supplier_batch_charges as charge on charge.id = allocation.charge_id
      and charge.batch_id = allocation.batch_id
    where allocation.batch_id = v_batch.id and charge.status = 'confirmed'
      and not exists (
        select 1
        from public.supplier_batch_charge_corrections as correction
        where correction.original_charge_id = charge.id
          and correction.status = 'applied'
      )
    group by allocation.batch_line_id
  ), summary as (
    select line.id as batch_line_id, line.sku_code, line.qty_received,
      round(line.qty_received::numeric * line.unit_cost * v_goods_fx_rate, 2) as goods_total,
      coalesce(confirmed_inbound.inbound_total, 0) as inbound_total,
      v_batch.id as batch_id, v_batch.supplier_id, v_batch.batch_code,
      v_batch.vat_mode
    from public.supplier_batch_lines as line
    left join confirmed_inbound on confirmed_inbound.batch_line_id = line.id
    where line.batch_id = v_batch.id and line.qty_received > 0
  )
  update public.finance_cost_layers as layer
  set received_qty = summary.qty_received,
      goods_unit_cost_net = round(summary.goods_total / nullif(summary.qty_received, 0), 4),
      goods_total_cost_net = summary.goods_total,
      inbound_charge_total_net = summary.inbound_total,
      unit_cost_net = round((summary.goods_total + summary.inbound_total) / nullif(summary.qty_received, 0), 4),
      total_cost_net = round(summary.goods_total + summary.inbound_total, 2),
      currency = 'EUR',
      metadata = coalesce(layer.metadata, '{}'::jsonb) || jsonb_build_object(
        'supplier_batch_transport', jsonb_build_object('last_charge_id', v_charge.id,
          'inbound_charge_total_net', summary.inbound_total,
          'allocation_method', v_terms.allocation_method, 'source', 'v2')),
      updated_at = now()
  from summary
  where layer.supplier_batch_line_id = summary.batch_line_id;

  with confirmed_inbound as (
    select allocation.batch_line_id,
      round(sum(coalesce(allocation.allocated_amount_eur,
        case when upper(coalesce(charge.currency, 'EUR')) = 'EUR'
          then allocation.allocated_amount else 0 end)), 2) as inbound_total
    from public.supplier_batch_charge_allocations as allocation
    join public.supplier_batch_charges as charge on charge.id = allocation.charge_id
      and charge.batch_id = allocation.batch_id
    where allocation.batch_id = v_batch.id and charge.status = 'confirmed'
      and not exists (
        select 1
        from public.supplier_batch_charge_corrections as correction
        where correction.original_charge_id = charge.id
          and correction.status = 'applied'
      )
    group by allocation.batch_line_id
  ), summary as (
    select line.id as batch_line_id, line.sku_code, line.qty_received,
      round(line.qty_received::numeric * line.unit_cost * v_goods_fx_rate, 2) as goods_total,
      coalesce(confirmed_inbound.inbound_total, 0) as inbound_total,
      v_batch.id as batch_id, v_batch.supplier_id, v_batch.batch_code,
      v_batch.vat_mode
    from public.supplier_batch_lines as line
    left join confirmed_inbound on confirmed_inbound.batch_line_id = line.id
    where line.batch_id = v_batch.id and line.qty_received > 0
  )
  insert into public.finance_cost_layers (
    supplier_batch_line_id, supplier_batch_id, supplier_id, sku_code, batch_code,
    received_qty, allocated_qty, consumed_qty, goods_unit_cost_net,
    goods_total_cost_net, inbound_charge_total_net, unit_cost_net, total_cost_net,
    currency, vat_mode, vat_treatment, confidence, metadata
  )
  select summary.batch_line_id, summary.batch_id, summary.supplier_id,
    summary.sku_code, summary.batch_code, summary.qty_received, 0, 0,
    round(summary.goods_total / nullif(summary.qty_received, 0), 4),
    summary.goods_total, summary.inbound_total,
    round((summary.goods_total + summary.inbound_total) / nullif(summary.qty_received, 0), 4),
    round(summary.goods_total + summary.inbound_total, 2), 'EUR', summary.vat_mode,
    case when lower(coalesce(summary.vat_mode, '')) like '%esclus%'
      or lower(coalesce(summary.vat_mode, '')) like '%excluded%' then 'excluded'
      when lower(coalesce(summary.vat_mode, '')) like '%inclus%'
      or lower(coalesce(summary.vat_mode, '')) like '%included%' then 'included'
      else 'unknown' end,
    case when summary.goods_total <= 0 or nullif(btrim(coalesce(summary.sku_code, '')), '') is null
      then 'unmatched' else 'estimated' end,
    jsonb_build_object('supplier_batch_transport', jsonb_build_object(
      'last_charge_id', v_charge.id, 'inbound_charge_total_net', summary.inbound_total,
      'allocation_method', v_terms.allocation_method, 'source', 'v2'))
  from summary
  where not exists (
    select 1 from public.finance_cost_layers as existing
    where existing.supplier_batch_line_id = summary.batch_line_id
  );

  v_result := private.supplier_batch_charge_result_v2(v_charge.id);
  insert into public.admin_audit_events (
    actor_id, actor_email, actor_role, action, entity_type, entity_id,
    after_data, reason, request_metadata
  ) values (
    v_actor_id, nullif(auth.jwt() ->> 'email', ''),
    (select private.current_profile_role()), 'supplier_batch_charge.confirmed_v2',
    'supplier_batch_charge', v_charge.id::text, v_result, v_terms.notes,
    jsonb_build_object('batch_code', v_batch.batch_code, 'batch_id', v_batch.id,
      'charge_id', v_charge.id, 'revision', p_revision,
      'preview_fingerprint', p_preview_fingerprint, 'payload_fingerprint', v_fingerprint,
      'idempotency_key', v_terms.idempotency_key, 'source', 'v2')
  );
  return v_result;
end
$$;

create or replace function public.admin_save_supplier_batch_charge_estimate_v2(
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
  v_batch public.supplier_batches%rowtype;
  v_by_id public.supplier_batch_charges%rowtype;
  v_by_key public.supplier_batch_charges%rowtype;
  v_existing public.supplier_batch_charges%rowtype;
  v_charge public.supplier_batch_charges%rowtype;
  v_terms record;
  v_fingerprint text;
  v_goods_fx_rate numeric;
  v_goods_value_eur numeric;
begin
  if v_actor_id is null and not coalesce((auth.jwt() ->> 'role') = 'service_role', false) then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not (select private.supplier_batch_v2_has_permission('supplier_batch.estimate', true)) then
    raise exception 'Supplier batch estimate permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;
  select * into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(coalesce(p_batch_code, ''))
  for update;
  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;

  select * into v_terms
  from private.parse_supplier_batch_charge_payload_v2(p_payload, p_idempotency_key);
  if v_terms.idempotency_key is null then
    raise exception 'idempotencyKey is required when saving an estimate'
      using errcode = '22023';
  end if;
  if upper(coalesce(v_batch.currency, 'EUR')) = 'EUR'
     and v_terms.batch_goods_fx_rate_to_eur is not null
     and v_terms.batch_goods_fx_rate_to_eur <> 1 then
    raise exception 'EUR batch goods FX rate must be exactly 1'
      using errcode = '22023', detail = 'BATCH_FX_RATE_REQUIRED';
  end if;
  -- Lock both possible identities in one stable order.  A supplied chargeId
  -- is not an alternate lookup: it must be the row owned by this key.
  perform charge.id
  from public.supplier_batch_charges as charge
  where charge.id = v_terms.charge_id
     or charge.idempotency_key = v_terms.idempotency_key
  order by charge.id
  for update;
  if v_terms.charge_id is not null then
    select * into v_by_id
    from public.supplier_batch_charges as charge
    where charge.id = v_terms.charge_id;
    select * into v_by_key
    from public.supplier_batch_charges as charge
    where charge.idempotency_key = v_terms.idempotency_key;
    if v_by_id.id is null or v_by_id.batch_id <> v_batch.id then
      raise exception 'Supplier batch charge not found: %', v_terms.charge_id
        using errcode = 'P0002', detail = 'CHARGE_NOT_FOUND';
    end if;
    if v_by_key.id is null or v_by_key.id <> v_terms.charge_id then
      raise exception 'chargeId and idempotencyKey must identify the same supplier batch charge'
        using errcode = '23505', detail = 'CHARGE_IDEMPOTENCY_MISMATCH';
    end if;
    v_existing := v_by_id;
  else
    select * into v_existing
    from public.supplier_batch_charges as charge
    where charge.idempotency_key = v_terms.idempotency_key;
    if v_existing.id is not null and v_existing.batch_id <> v_batch.id then
      raise exception 'Idempotency key belongs to another supplier batch'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
  end if;
  if v_existing.id is not null and exists (
    select 1
    from public.supplier_batch_charge_corrections as correction
    where correction.replacement_charge_id = v_existing.id
  ) then
    raise exception 'Correction replacements are managed only by the correction RPC'
      using errcode = '55000', detail = 'CORRECTION_REPLACEMENT_MANAGED';
  end if;
  if v_existing.id is not null and v_existing.status <> 'estimated' then
    raise exception 'Confirmed or cancelled supplier batch charges are immutable'
      using errcode = '55000', detail = 'CHARGE_IMMUTABLE';
  end if;

  if v_terms.allocation_method = 'manual' and not (p_payload ? 'manualAllocations') then
    if v_existing.id is null then
      raise exception 'manualAllocations is required when saving a manual estimate'
        using errcode = '22023', detail = 'MANUAL_ALLOCATIONS_REQUIRED';
    end if;
    v_terms.manual_allocations := v_existing.manual_allocations_snapshot;
  elsif v_terms.allocation_method <> 'manual' then
    v_terms.manual_allocations := '[]'::jsonb;
  end if;

  v_fingerprint := private.supplier_batch_charge_fingerprint_v2(
    v_terms.charge_type, v_terms.amount_net, v_terms.vat_amount,
    v_terms.amount_gross, v_terms.capitalized_amount, v_terms.currency,
    v_terms.vat_treatment, v_terms.allocation_method, v_terms.carrier_name,
    v_terms.charge_reference, v_terms.occurred_at, v_terms.evidence_url,
    v_terms.notes, v_terms.zero_cost_reason, v_terms.manual_allocations,
    v_terms.metadata, v_terms.fx_rate_to_eur, v_terms.fx_rate_date,
    v_terms.fx_rate_source, v_terms.fx_evidence_url,
    v_terms.batch_goods_fx_rate_to_eur, v_terms.batch_goods_fx_date,
    v_terms.batch_goods_fx_source, v_terms.batch_goods_fx_evidence_url
  );
  if v_existing.id is not null and v_existing.payload_fingerprint = v_fingerprint then
    return private.supplier_batch_charge_result_v2(v_existing.id);
  end if;
  if v_existing.id is not null and v_terms.charge_id is null then
    raise exception 'Idempotency key conflicts with a different supplier batch charge payload'
      using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
  end if;

  -- An explicitly supplied batch goods FX snapshot becomes the independent
  -- valuation fact used by later confirmations.  It is never borrowed from
  -- the fee's FX snapshot.
  if upper(coalesce(v_batch.currency, 'EUR')) <> 'EUR'
     and v_terms.batch_goods_fx_rate_to_eur is not null then
    if v_batch.goods_value_fx_rate_to_eur is not null
       and (v_batch.goods_value_fx_rate_to_eur <> v_terms.batch_goods_fx_rate_to_eur
         or v_batch.goods_value_fx_date <> v_terms.batch_goods_fx_date
         or v_batch.goods_value_fx_source <> v_terms.batch_goods_fx_source
         or v_batch.goods_value_fx_evidence_url is distinct from v_terms.batch_goods_fx_evidence_url) then
      raise exception 'Batch goods FX snapshot is immutable; refresh with the stored valuation'
        using errcode = '55000', detail = 'BATCH_FX_SNAPSHOT_IMMUTABLE';
    end if;
    v_goods_value_eur := private.supplier_batch_v2_goods_value_eur(
      v_batch.id, v_terms.batch_goods_fx_rate_to_eur
    );
    update public.supplier_batches
    set goods_value_eur = v_goods_value_eur,
        goods_value_fx_rate_to_eur = v_terms.batch_goods_fx_rate_to_eur,
        goods_value_fx_date = v_terms.batch_goods_fx_date,
        goods_value_fx_source = v_terms.batch_goods_fx_source,
        goods_value_fx_evidence_url = v_terms.batch_goods_fx_evidence_url,
        updated_at = now()
    where id = v_batch.id;
    select * into v_batch from public.supplier_batches where id = v_batch.id;
  end if;
  v_goods_fx_rate := case
    when upper(coalesce(v_batch.currency, 'EUR')) = 'EUR' then 1
    else v_batch.goods_value_fx_rate_to_eur
  end;

  -- This validates all line/product/manual invariants without writing formal
  -- allocations or finance layers.
  perform allocation.batch_line_id
  from private.calculate_supplier_batch_charge_allocations_v2(
    v_batch.id, v_terms.allocation_method, v_terms.capitalized_amount,
    v_terms.manual_allocations, v_terms.fx_rate_to_eur, v_goods_fx_rate,
    upper(coalesce(v_batch.currency, 'EUR')), v_terms.currency,
    v_terms.amount_net, v_terms.vat_amount, v_terms.amount_gross
  ) as allocation;

  if v_existing.id is not null then
    update public.supplier_batch_charges
    set charge_type = v_terms.charge_type,
        status = 'estimated', amount_net = v_terms.amount_net,
        vat_amount = v_terms.vat_amount, capitalized_amount = v_terms.capitalized_amount,
        currency = v_terms.currency, vat_treatment = v_terms.vat_treatment,
        allocation_method = v_terms.allocation_method, carrier_name = v_terms.carrier_name,
        reference = v_terms.charge_reference, occurred_at = v_terms.occurred_at,
        evidence_url = v_terms.evidence_url, notes = v_terms.notes,
        zero_cost_reason = v_terms.zero_cost_reason,
        base_currency = 'EUR', fx_rate_to_eur = v_terms.fx_rate_to_eur,
        fx_rate_date = v_terms.fx_rate_date, fx_rate_source = v_terms.fx_rate_source,
        fx_evidence_url = v_terms.fx_evidence_url,
        amount_net_eur = round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2),
        vat_amount_eur = round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
        amount_gross_eur = round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
        capitalized_amount_eur = case when v_terms.capitalized_amount = v_terms.amount_gross
          then round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
            + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
          else least(
            round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
            round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
              + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
          )
        end,
        payload_fingerprint = v_fingerprint,
        manual_allocations_snapshot = v_terms.manual_allocations,
        updated_by = v_actor_id, confirmed_by = null, confirmed_at = null,
        metadata = v_terms.metadata, updated_at = now()
    where id = v_existing.id
    returning * into v_charge;
  else
    insert into public.supplier_batch_charges (
      batch_id, charge_type, status, amount_net, vat_amount, capitalized_amount,
      currency, vat_treatment, allocation_method, carrier_name, reference,
      occurred_at, evidence_url, notes, zero_cost_reason, idempotency_key,
      payload_fingerprint, manual_allocations_snapshot, created_by, updated_by,
      base_currency, fx_rate_to_eur, fx_rate_date, fx_rate_source, fx_evidence_url,
      amount_net_eur, vat_amount_eur, amount_gross_eur, capitalized_amount_eur,
      metadata
    ) values (
      v_batch.id, v_terms.charge_type, 'estimated', v_terms.amount_net,
      v_terms.vat_amount, v_terms.capitalized_amount, v_terms.currency,
      v_terms.vat_treatment, v_terms.allocation_method, v_terms.carrier_name,
      v_terms.charge_reference, v_terms.occurred_at, v_terms.evidence_url,
      v_terms.notes, v_terms.zero_cost_reason, v_terms.idempotency_key,
      v_fingerprint, v_terms.manual_allocations, v_actor_id, v_actor_id,
      'EUR', v_terms.fx_rate_to_eur, v_terms.fx_rate_date, v_terms.fx_rate_source,
      v_terms.fx_evidence_url,
      round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2),
      round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
      round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
        + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
      case when v_terms.capitalized_amount = v_terms.amount_gross
        then round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
        else least(
          round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
          round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
            + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
        )
      end,
      v_terms.metadata
    ) returning * into v_charge;
  end if;

  insert into public.admin_audit_events (
    actor_id, actor_email, actor_role, action, entity_type, entity_id,
    before_data, after_data, reason, request_metadata
  ) values (
    v_actor_id, nullif(auth.jwt() ->> 'email', ''),
    (select private.current_profile_role()),
    'supplier_batch_charge.estimate_saved_v2', 'supplier_batch_charge',
    v_charge.id::text,
    case when v_existing.id is null then '{}'::jsonb else to_jsonb(v_existing) end,
    to_jsonb(v_charge), v_terms.notes,
    jsonb_build_object('batch_code', v_batch.batch_code, 'batch_id', v_batch.id,
      'charge_id', v_charge.id, 'payload_fingerprint', v_fingerprint,
      'idempotency_key', v_terms.idempotency_key, 'source', 'v2')
  );
  return private.supplier_batch_charge_result_v2(v_charge.id);
end
$$;

-- Canonical preview calculator.  The public estimate preview and the
-- correction preview below are deliberately thin wrappers around this one
-- implementation so permission boundaries cannot make the two contracts
-- drift (especially around FX rounding, revision and fingerprints).
create or replace function private.admin_preview_supplier_batch_charge_v2_core(
  p_batch_code text,
  p_payload jsonb,
  p_required_permission text,
  p_allow_legacy_estimate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_batch public.supplier_batches%rowtype;
  v_existing public.supplier_batch_charges%rowtype;
  v_terms record;
  v_batch_currency text;
  v_goods_fx_rate numeric;
  v_goods_value_eur numeric;
  v_revision_before text;
  v_revision_after text;
  v_allocations jsonb;
  v_allocation_total numeric;
  v_allocation_total_eur numeric;
  v_payload_fingerprint text;
  v_original_charge_eur numeric;
  v_other_effective_cost_eur numeric;
  v_replacement_charge_eur numeric;
  v_correction_before_total_eur numeric;
  v_correction_after_total_eur numeric;
  v_correction_cost_delta_eur numeric;
  v_correction_totals jsonb;
  v_confirmation_blocked boolean := false;
  v_confirmation_block_code text;
  v_confirmation_block_reason text;
begin
  if v_actor_id is null and not coalesce((auth.jwt() ->> 'role') = 'service_role', false) then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not coalesce((auth.jwt() ->> 'role') = 'service_role', false)
     and not (select private.supplier_batch_v2_has_permission(
       p_required_permission, p_allow_legacy_estimate
     )) then
    raise exception 'Supplier batch preview permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;
  if nullif(btrim(coalesce(p_batch_code, '')), '') is null then
    raise exception 'batch_code is required' using errcode = '22023';
  end if;

  select * into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(p_batch_code)
  limit 1;
  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;

  select * into v_terms
  from private.parse_supplier_batch_charge_payload_v2(p_payload, null);
  -- A correction preview is scoped to the current effective confirmed charge.
  -- Do this validation before calculating allocations so an estimate, a
  -- cross-batch id, or a charge already superseded by a correction can never
  -- be used as the exclusion baseline.  The mutation repeats the same checks
  -- under its row lock; preview must fail closed with the same domain codes.
  if p_required_permission = 'supplier_batch.correct' then
    if v_terms.charge_id is null then
      raise exception 'A correction preview requires the original charge id'
        using errcode = '22023', detail = 'CHARGE_NOT_FOUND';
    end if;
    select * into v_existing
    from public.supplier_batch_charges as charge
    where charge.id = v_terms.charge_id
      and charge.batch_id = v_batch.id;
    if v_existing.id is null then
      raise exception 'Supplier batch charge not found: %', v_terms.charge_id
        using errcode = 'P0002', detail = 'CHARGE_NOT_FOUND';
    end if;
    if v_existing.status <> 'confirmed' then
      raise exception 'Only an effective confirmed supplier batch charge can be corrected'
        using errcode = '55000', detail = 'CORRECTION_NOT_ALLOWED';
    end if;
    if exists (
      select 1
      from public.supplier_batch_charge_corrections as correction
      where correction.original_charge_id = v_existing.id
        and correction.status in ('candidate_ready', 'pending_finance_adjustment', 'applied')
    ) then
      raise exception 'The supplier batch charge already has a correction state and cannot be corrected again'
        using errcode = '55000', detail = 'CORRECTION_NOT_ALLOWED';
    end if;
  end if;
  v_batch_currency := upper(coalesce(v_batch.currency, 'EUR'));
  if v_batch_currency = 'EUR'
     and v_terms.batch_goods_fx_rate_to_eur is not null
     and v_terms.batch_goods_fx_rate_to_eur <> 1 then
    raise exception 'EUR batch goods FX rate must be exactly 1'
      using errcode = '22023', detail = 'BATCH_FX_RATE_REQUIRED';
  end if;
  -- A persisted batch goods-FX snapshot is an immutable valuation fact.  A
  -- preview must use it verbatim; a payload that omits or changes even the
  -- evidence URL is a different fact and fails closed instead of presenting
  -- a preview that cannot later be confirmed.
  if v_batch.goods_value_fx_rate_to_eur is not null
     and (
       v_terms.batch_goods_fx_rate_to_eur is distinct from v_batch.goods_value_fx_rate_to_eur
       or v_terms.batch_goods_fx_date is distinct from v_batch.goods_value_fx_date
       or v_terms.batch_goods_fx_source is distinct from v_batch.goods_value_fx_source
       or v_terms.batch_goods_fx_evidence_url is distinct from v_batch.goods_value_fx_evidence_url
     ) then
    raise exception 'Batch goods FX snapshot is immutable; refresh with the stored valuation'
      using errcode = '55000', detail = 'BATCH_FX_SNAPSHOT_IMMUTABLE';
  end if;

  if p_required_permission <> 'supplier_batch.correct'
     and v_terms.charge_id is not null
     and v_terms.allocation_method = 'manual'
     and not (p_payload ? 'manualAllocations') then
    select * into v_existing
    from public.supplier_batch_charges as charge
    where charge.id = v_terms.charge_id
      and charge.batch_id = v_batch.id;
    if v_existing.id is null or v_existing.status <> 'estimated' then
      raise exception 'Manual preview fallback requires an estimated charge from the same supplier batch'
        using errcode = '55000', detail = 'CHARGE_IMMUTABLE';
    end if;
    v_terms.manual_allocations := v_existing.manual_allocations_snapshot;
  elsif v_terms.allocation_method <> 'manual' then
    v_terms.manual_allocations := '[]'::jsonb;
  end if;

  v_goods_fx_rate := case
    when v_batch_currency = 'EUR' then 1
    when v_batch.goods_value_fx_rate_to_eur is not null then v_batch.goods_value_fx_rate_to_eur
    else v_terms.batch_goods_fx_rate_to_eur
  end;
  v_goods_value_eur := private.supplier_batch_v2_goods_value_eur(v_batch.id, v_goods_fx_rate);
  v_payload_fingerprint := private.supplier_batch_charge_fingerprint_v2(
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
    v_terms.metadata,
    v_terms.fx_rate_to_eur,
    v_terms.fx_rate_date,
    v_terms.fx_rate_source,
    v_terms.fx_evidence_url,
    v_terms.batch_goods_fx_rate_to_eur,
    v_terms.batch_goods_fx_date,
    v_terms.batch_goods_fx_source,
    v_terms.batch_goods_fx_evidence_url
  );
  v_revision_before := private.supplier_batch_charge_revision(v_batch.id);
  v_allocations := private.supplier_batch_v2_allocations_json(
    v_batch.id,
    v_terms.allocation_method,
    v_terms.capitalized_amount,
    v_terms.manual_allocations,
    v_terms.fx_rate_to_eur,
    v_goods_fx_rate,
    v_batch_currency,
    v_terms.currency,
    v_terms.amount_net,
    v_terms.vat_amount,
    v_terms.amount_gross
  );
  v_allocation_total := private.supplier_batch_v2_allocation_total(v_allocations, 'allocatedAmount');
  v_allocation_total_eur := private.supplier_batch_v2_allocation_total(v_allocations, 'allocatedAmountEur');
  v_revision_after := private.supplier_batch_charge_revision(v_batch.id);
  if v_revision_before <> v_revision_after then
    raise exception 'Supplier batch changed while preview was calculated; preview must be retried'
      using errcode = '40001', detail = 'STALE_REVISION';
  end if;

  if exists (
    select 1
    from public.finance_cost_layers as layer
    join public.supplier_batch_lines as line on line.id = layer.supplier_batch_line_id
    where line.batch_id = v_batch.id
      and (layer.allocated_qty > 0 or layer.consumed_qty > 0)
  ) then
    v_confirmation_blocked := true;
    v_confirmation_block_code := 'FINANCE_ADJUSTMENT_REQUIRED';
    v_confirmation_block_reason :=
      'An affected finance cost layer is allocated or consumed; financial adjustment is required before confirmation.';
  elsif v_batch_currency <> 'EUR' and v_goods_fx_rate is null then
    v_confirmation_blocked := true;
    v_confirmation_block_code := 'BATCH_FX_RATE_REQUIRED';
    v_confirmation_block_reason :=
      'A non-EUR batch requires an independent goods-value FX snapshot before confirmation.';
  end if;

  if p_required_permission = 'supplier_batch.correct' then
    -- Correction totals are charge-cost totals, not the line projection with
    -- the original charge excluded.  Keep the explicit identity visible to
    -- every consumer: before = other effective charges + original; after =
    -- other effective charges + replacement; delta = after - before.
    v_original_charge_eur := coalesce(
      v_existing.capitalized_amount_eur,
      case when upper(coalesce(v_existing.currency, 'EUR')) = 'EUR'
        then v_existing.capitalized_amount else null end
    );
    select case
      when count(*) = count(effective_charge_eur) then coalesce(sum(effective_charge_eur), 0)
      else null
    end
    into v_other_effective_cost_eur
    from (
      select coalesce(
        charge.capitalized_amount_eur,
        case when upper(coalesce(charge.currency, 'EUR')) = 'EUR'
          then charge.capitalized_amount else null end
      ) as effective_charge_eur
      from public.supplier_batch_charges as charge
      where charge.batch_id = v_batch.id
        and charge.status = 'confirmed'
        and charge.id <> v_existing.id
        and not exists (
          select 1
          from public.supplier_batch_charge_corrections as correction
          where correction.original_charge_id = charge.id
            and correction.status = 'applied'
        )
    ) as effective_charges;
    v_replacement_charge_eur := case
      when v_terms.capitalized_amount = v_terms.amount_gross then
        round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
      else least(
        round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
        round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
      )
    end;
    v_correction_before_total_eur := case
      when v_other_effective_cost_eur is null or v_original_charge_eur is null then null
      else round(v_other_effective_cost_eur + v_original_charge_eur, 2)
    end;
    v_correction_after_total_eur := case
      when v_other_effective_cost_eur is null or v_replacement_charge_eur is null then null
      else round(v_other_effective_cost_eur + v_replacement_charge_eur, 2)
    end;
    v_correction_cost_delta_eur := case
      when v_correction_before_total_eur is null
        or v_correction_after_total_eur is null then null
      else round(v_correction_after_total_eur - v_correction_before_total_eur, 2)
    end;
    v_correction_totals := case
      when v_other_effective_cost_eur is null
        or v_original_charge_eur is null
        or v_replacement_charge_eur is null
        or v_correction_before_total_eur is null
        or v_correction_after_total_eur is null
        or v_correction_cost_delta_eur is null then null
      else jsonb_build_object(
        'otherEffectiveCostEur', v_other_effective_cost_eur,
        'originalChargeEur', v_original_charge_eur,
        'replacementChargeEur', v_replacement_charge_eur,
        'beforeTotalEur', v_correction_before_total_eur,
        'afterTotalEur', v_correction_after_total_eur,
        'costDeltaEur', v_correction_cost_delta_eur
      )
    end;
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
    'baseCurrency', 'EUR',
    'fxRateToEur', v_terms.fx_rate_to_eur,
    'fxRateDate', v_terms.fx_rate_date,
    'fxRateSource', v_terms.fx_rate_source,
    'fxEvidenceUrl', v_terms.fx_evidence_url,
    'amountNetEur', round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2),
    'vatAmountEur', round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
    'amountGrossEur', round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
      + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
    'capitalizedAmountEur', case when v_terms.capitalized_amount = v_terms.amount_gross
      then round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
        + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
      else least(
        round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
        round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
      )
    end,
    'goodsValue', v_batch.total_cost,
    'goodsValueEur', v_goods_value_eur,
    'goodsValueFxRateToEur', coalesce(v_terms.batch_goods_fx_rate_to_eur, v_batch.goods_value_fx_rate_to_eur),
    'goodsValueFxDate', coalesce(v_terms.batch_goods_fx_date, v_batch.goods_value_fx_date),
    'goodsValueFxSource', coalesce(v_terms.batch_goods_fx_source, v_batch.goods_value_fx_source),
    'goodsValueFxEvidenceUrl', coalesce(v_terms.batch_goods_fx_evidence_url, v_batch.goods_value_fx_evidence_url),
    'correctionPreview', p_required_permission = 'supplier_batch.correct',
    'correctionTotals', v_correction_totals,
    'confirmationBlocked', v_confirmation_blocked,
    'confirmationBlockCode', v_confirmation_block_code,
    'confirmationBlockReason', v_confirmation_block_reason,
    'candidateAllocationTotal', v_allocation_total,
    'candidateAllocationTotalEur', v_allocation_total_eur,
    'candidateAllocations', v_allocations,
    'confirmedAllocationTotal', 0,
    'confirmedAllocationTotalEur', 0,
    'confirmedAllocations', '[]'::jsonb,
    'allocationTotal', v_allocation_total,
    'allocationTotalEur', v_allocation_total_eur,
    'allocations', v_allocations,
    'lineProjections', private.supplier_batch_v2_line_projection(
      v_batch.id,
      v_allocations,
      v_batch_currency,
      v_terms.currency,
      v_terms.fx_rate_to_eur,
      case
        when p_required_permission = 'supplier_batch.correct' then v_terms.charge_id
        else null
      end
    )
  );
end
$$;

create or replace function public.admin_preview_supplier_batch_charge_v2(
  p_batch_code text,
  p_payload jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.admin_preview_supplier_batch_charge_v2_core(
    p_batch_code, p_payload, 'supplier_batch.estimate', true
  )
$$;

create or replace function public.admin_preview_supplier_batch_charge_correction_v2(
  p_batch_code text,
  p_payload jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.admin_preview_supplier_batch_charge_v2_core(
    p_batch_code, p_payload, 'supplier_batch.correct', false
  )
$$;

create or replace function private.supplier_batch_v2_enrich_allocations(
  p_allocations jsonb,
  p_capitalized_amount numeric,
  p_charge_fx_rate numeric,
  p_goods_fx_rate numeric,
  p_batch_currency text default 'EUR',
  p_charge_currency text default 'EUR',
  p_amount_net numeric default null,
  p_vat_amount numeric default null,
  p_amount_gross numeric default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  -- Work in integer cents for both currency conversions.  The target is
  -- rounded once and the residual cents are assigned by largest remainder;
  -- no row can receive a negative residual and ties are stable by row_no.
  with raw as (
    select
      item.value,
      item.ordinality::integer as row_no,
      (item.value ->> 'qtyReceivedSnapshot')::numeric as qty_received,
      (item.value ->> 'allocatedAmount')::numeric
        * coalesce(p_charge_fx_rate, 1) * 100 as allocated_raw_cents,
      case
        when p_goods_fx_rate is null then null
        else (item.value ->> 'goodsCostSnapshot')::numeric
          * p_goods_fx_rate * 100
      end as goods_raw_cents,
      private.supplier_batch_v2_guard_cents(round(
        case
          when p_amount_net is not null
            and p_vat_amount is not null
            and p_amount_gross is not null
            and p_capitalized_amount = p_amount_gross
            then round(p_amount_net * coalesce(p_charge_fx_rate, 1), 2) * 100
              + round(p_vat_amount * coalesce(p_charge_fx_rate, 1), 2) * 100
          when p_amount_net is not null and p_vat_amount is not null then least(
            round(p_capitalized_amount * coalesce(p_charge_fx_rate, 1), 2) * 100,
            round(p_amount_net * coalesce(p_charge_fx_rate, 1), 2) * 100
              + round(p_vat_amount * coalesce(p_charge_fx_rate, 1), 2) * 100
          )
          else round(p_capitalized_amount * coalesce(p_charge_fx_rate, 1), 2) * 100
        end,
        0
      )) as allocated_target_cents
    from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) with ordinality as item(value, ordinality)
  ),
  scaled as (
    select
      raw.*,
      sum(raw.allocated_raw_cents) over () as allocated_raw_total,
      case
        when sum(raw.allocated_raw_cents) over () > 0
          then raw.allocated_raw_cents
            / sum(raw.allocated_raw_cents) over ()
            * raw.allocated_target_cents
        when raw.row_no = 1 then raw.allocated_target_cents::numeric
        else 0::numeric
      end as allocated_scaled_cents
    from raw
  ),
  floored as (
    select
      scaled.*,
      private.supplier_batch_v2_guard_cents(
        floor(scaled.allocated_scaled_cents)
      ) as allocated_floor_cents,
      scaled.allocated_scaled_cents - floor(scaled.allocated_scaled_cents)
        as allocated_fraction,
      case when scaled.goods_raw_cents is null then null
        else private.supplier_batch_v2_guard_cents(
          round(scaled.goods_raw_cents, 0), scaled.qty_received
        ) end as goods_cents
    from scaled
  ),
  ranked as (
    select
      floored.*,
      floored.allocated_target_cents
        - sum(floored.allocated_floor_cents) over () as allocated_remainder_cents,
      row_number() over (order by allocated_fraction desc, row_no) as allocated_fraction_rank
    from floored
  ),
  adjusted as (
    select
      ranked.*,
      allocated_floor_cents
        + case
            when allocated_fraction_rank <= allocated_remainder_cents then 1
            else 0
          end as allocated_cents
    from ranked
  )
  select coalesce(jsonb_agg(
    adjusted.value || jsonb_build_object(
      'goodsCostSnapshotEur', case when adjusted.goods_cents is null then null else adjusted.goods_cents::numeric / 100 end,
      'allocatedAmountEur', adjusted.allocated_cents::numeric / 100,
      'allocatedUnitAmountEur', case
        when adjusted.qty_received is null or adjusted.qty_received = 0 then null
        else private.supplier_batch_v2_guard_unit(
          (adjusted.allocated_cents::numeric / 100) / adjusted.qty_received
        )
      end,
      'landedLineCostEur', case
        when adjusted.goods_cents is null then null
        else private.supplier_batch_v2_guard_cents(
          adjusted.goods_cents + adjusted.allocated_cents,
          adjusted.qty_received
        )::numeric / 100
      end,
      'landedUnitCostEur', case
        when adjusted.goods_cents is null then null
        when adjusted.qty_received is null or adjusted.qty_received = 0 then null
        else private.supplier_batch_v2_guard_unit(
          ((adjusted.goods_cents + adjusted.allocated_cents)::numeric / 100)
            / adjusted.qty_received
        )
      end,
      'roundingAdjustmentEur', (adjusted.allocated_cents - adjusted.allocated_floor_cents)::numeric / 100,
      'originalCurrencyComparable', upper(coalesce(p_batch_currency, 'EUR')) = upper(coalesce(p_charge_currency, 'EUR')),
      'landedLineCost', case
        when upper(coalesce(p_batch_currency, 'EUR')) = upper(coalesce(p_charge_currency, 'EUR'))
          then adjusted.value -> 'landedLineCost'
        else null
      end,
      'landedUnitCost', case
        when upper(coalesce(p_batch_currency, 'EUR')) = upper(coalesce(p_charge_currency, 'EUR'))
          then adjusted.value -> 'landedUnitCost'
        else null
      end
    ) order by adjusted.row_no
  ), '[]'::jsonb)
  from adjusted
$$;

-- The V1 line projection adds original-currency goods and inbound amounts.
-- That is not a valid landed total when a batch has mixed currencies.  This
-- projection keeps those fields nullable in that case and makes EUR values
-- the only landed authority.  Existing confirmed charges are converted from
-- their stored immutable EUR snapshots; a legacy EUR row remains compatible.
create or replace function private.supplier_batch_v2_line_projection(
  p_batch_id uuid,
  p_candidate_allocations jsonb default '[]'::jsonb,
  p_batch_currency text default 'EUR',
  p_charge_currency text default 'EUR',
  p_charge_fx_rate numeric default 1,
  p_exclude_charge_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with batch_context as (
    select
      batch.id,
      upper(coalesce(batch.currency, 'EUR')) as batch_currency,
      case
        when upper(coalesce(batch.currency, 'EUR')) = 'EUR' then 1::numeric
        else batch.goods_value_fx_rate_to_eur
      end as goods_fx_rate
    from public.supplier_batches as batch
    where batch.id = p_batch_id
  ),
  currency_state as (
    select
      context.*,
      coalesce(
        bool_and(upper(coalesce(charge.currency, 'EUR')) = context.batch_currency)
          filter (where charge.status = 'confirmed'
            and (p_exclude_charge_id is null or charge.id <> p_exclude_charge_id)
            and not exists (
              select 1
              from public.supplier_batch_charge_corrections as correction
              where correction.original_charge_id = charge.id
                and correction.status = 'applied'
            )),
        true
      ) as existing_original_comparable
    from batch_context as context
    left join public.supplier_batch_charges as charge
      on charge.batch_id = context.id
    group by context.id, context.batch_currency, context.goods_fx_rate
  ),
  existing as (
    select
      allocation.batch_line_id,
      round(sum(coalesce(
        allocation.allocated_amount_eur,
        case when upper(coalesce(charge.currency, 'EUR')) = 'EUR'
          then allocation.allocated_amount
          else null
        end
      )), 2) as inbound_eur,
      case
        when max(state.existing_original_comparable::integer) = 1
          then round(sum(allocation.allocated_amount), 2)
        else null
      end as inbound_original
    from public.supplier_batch_charge_allocations as allocation
    join public.supplier_batch_charges as charge
      on charge.id = allocation.charge_id
     and charge.batch_id = allocation.batch_id
    join currency_state as state on state.id = allocation.batch_id
    where allocation.batch_id = p_batch_id
      and charge.status = 'confirmed'
      and (p_exclude_charge_id is null or charge.id <> p_exclude_charge_id)
      and not exists (
        select 1
        from public.supplier_batch_charge_corrections as correction
        where correction.original_charge_id = charge.id
          and correction.status = 'applied'
      )
    group by allocation.batch_line_id
  ),
  candidate as (
    select
      nullif(item.value ->> 'batchLineId', '')::uuid as batch_line_id,
      round((item.value ->> 'allocatedAmount')::numeric, 2) as amount_original,
      case
        when item.value ? 'allocatedAmountEur'
          then round((item.value ->> 'allocatedAmountEur')::numeric, 2)
        else round((item.value ->> 'allocatedAmount')::numeric * coalesce(p_charge_fx_rate, 1), 2)
      end as amount_eur
    from jsonb_array_elements(coalesce(p_candidate_allocations, '[]'::jsonb)) as item(value)
  ),
  rows as (
    select
      line.id as batch_line_id,
      line.line_no,
      line.sku_code,
      line.qty_received,
      coalesce(product.weight_gram, 0) as weight_gram,
      round(line.qty_received::numeric * line.unit_cost, 2) as goods_cost,
      round(line.unit_cost, 4) as goods_unit_cost,
      case
        when state.goods_fx_rate is null then null
        else round(line.qty_received::numeric * line.unit_cost * state.goods_fx_rate, 2)
      end as goods_cost_eur,
      coalesce(existing.inbound_eur, 0) as existing_inbound_eur,
      existing.inbound_original,
      candidate.amount_original as candidate_original,
      coalesce(candidate.amount_eur, 0) as candidate_eur,
      state.batch_currency,
      state.goods_fx_rate,
      state.existing_original_comparable
    from public.supplier_batch_lines as line
    join currency_state as state on state.id = line.batch_id
    left join public.products as product on product.sku_code = line.sku_code
    left join existing on existing.batch_line_id = line.id
    left join candidate on candidate.batch_line_id = line.id
    where line.batch_id = p_batch_id
      and line.qty_received > 0
  ),
  flags as (
    select
      rows.*,
      (rows.batch_currency = upper(coalesce(p_batch_currency, 'EUR')))
        and (upper(coalesce(p_charge_currency, 'EUR')) = rows.batch_currency)
        and rows.existing_original_comparable as original_comparable
    from rows
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'batchLineId', batch_line_id,
      'lineNo', line_no,
      'skuCode', sku_code,
      'qtyReceived', qty_received,
      'weightGram', weight_gram,
      'goodsCost', case when original_comparable then goods_cost else goods_cost end,
      'goodsUnitCost', goods_unit_cost,
      'currentAllocation', case when original_comparable then coalesce(inbound_original, 0) else null end,
      'candidateAllocation', case when original_comparable then coalesce(candidate_original, 0) else null end,
      'existingInbound', case when original_comparable then coalesce(inbound_original, 0) else null end,
      'inboundAfterCandidate', case when original_comparable then coalesce(inbound_original, 0) + coalesce(candidate_original, 0) else null end,
      'currentLandedLineCost', case when original_comparable then round(goods_cost + coalesce(inbound_original, 0), 2) else null end,
      'currentLandedUnitCost', case when original_comparable then round((goods_cost + coalesce(inbound_original, 0)) / nullif(qty_received, 0), 4) else null end,
      'projectedLandedLineCost', case when original_comparable then round(goods_cost + coalesce(inbound_original, 0) + coalesce(candidate_original, 0), 2) else null end,
      'projectedLandedUnitCost', case when original_comparable then round((goods_cost + coalesce(inbound_original, 0) + coalesce(candidate_original, 0)) / nullif(qty_received, 0), 4) else null end,
      'originalCurrencyComparable', original_comparable,
      'goodsCostEur', goods_cost_eur,
      'currentAllocationEur', existing_inbound_eur,
      'candidateAllocationEur', candidate_eur,
      'existingInboundEur', existing_inbound_eur,
      'inboundAfterCandidateEur', round(existing_inbound_eur + candidate_eur, 2),
      'currentLandedLineCostEur', case when goods_cost_eur is null then null else round(goods_cost_eur + existing_inbound_eur, 2) end,
      'currentLandedUnitCostEur', case when goods_cost_eur is null then null else round((goods_cost_eur + existing_inbound_eur) / nullif(qty_received, 0), 4) end,
      'projectedLandedLineCostEur', case when goods_cost_eur is null then null else round(goods_cost_eur + existing_inbound_eur + candidate_eur, 2) end,
      'projectedLandedUnitCostEur', case when goods_cost_eur is null then null else round((goods_cost_eur + existing_inbound_eur + candidate_eur) / nullif(qty_received, 0), 4) end
    ) order by line_no, batch_line_id
  ), '[]'::jsonb)
  from flags
$$;

create or replace function private.supplier_batch_charge_result_v2(
  p_charge_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_charge public.supplier_batch_charges%rowtype;
  v_batch public.supplier_batches%rowtype;
  v_result jsonb;
  v_goods_fx_rate numeric;
  v_batch_currency text;
  v_effective_replacement_id uuid;
begin
  select charge.*
  into v_charge
  from public.supplier_batch_charges as charge
  join public.supplier_batches as batch on batch.id = charge.batch_id
  where charge.id = p_charge_id;
  if v_charge.id is null then
    return null;
  end if;

  -- An applied correction supersedes the physical original for all result
  -- consumers.  Keep the original row available to audit/history, but make a
  -- direct result lookup follow the effective confirmed version so callers
  -- cannot accidentally count both sides of a correction chain.
  select correction.replacement_charge_id
  into v_effective_replacement_id
  from public.supplier_batch_charge_corrections as correction
  where correction.original_charge_id = v_charge.id
    and correction.status = 'applied'
  order by correction.created_at desc, correction.id desc
  limit 1;
  if v_effective_replacement_id is not null
     and v_effective_replacement_id <> v_charge.id then
    return private.supplier_batch_charge_result_v2(v_effective_replacement_id);
  end if;

  select * into v_batch from public.supplier_batches as batch where batch.id = v_charge.batch_id;
  v_batch_currency := upper(coalesce(v_batch.currency, 'EUR'));
  v_goods_fx_rate := case
    when v_batch_currency = 'EUR' then 1
    else v_batch.goods_value_fx_rate_to_eur
  end;
  v_result := private.supplier_batch_charge_result(v_charge.id);
  v_result := v_result || jsonb_build_object(
    'baseCurrency', 'EUR',
    -- Legacy EUR rows have no V2 FX columns.  Project an implicit EUR=1
    -- snapshot at read time without backfilling the historical row.
    'fxRateToEur', coalesce(v_charge.fx_rate_to_eur,
      case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then 1 else null end),
    'fxRateDate', coalesce(v_charge.fx_rate_date,
      case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR'
        then coalesce(v_charge.created_at::date, current_date) else null end),
    'fxRateSource', coalesce(v_charge.fx_rate_source,
      case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then 'legacy EUR implicit' else null end),
    'fxEvidenceUrl', v_charge.fx_evidence_url,
    'amountNetEur', coalesce(v_charge.amount_net_eur,
      case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then v_charge.amount_net else null end),
    'vatAmountEur', coalesce(v_charge.vat_amount_eur,
      case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then v_charge.vat_amount else null end),
    'amountGrossEur', coalesce(v_charge.amount_gross_eur,
      case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then v_charge.amount_gross else null end),
    'capitalizedAmountEur', coalesce(v_charge.capitalized_amount_eur,
      case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then v_charge.capitalized_amount else null end),
    'goodsValueEur', coalesce(v_batch.goods_value_eur,
      case when v_batch_currency = 'EUR' then v_batch.total_cost else null end),
    'goodsValueFxRateToEur', coalesce(v_batch.goods_value_fx_rate_to_eur,
      case when v_batch_currency = 'EUR' then 1 else null end),
    'goodsValueFxDate', coalesce(v_batch.goods_value_fx_date,
      case when v_batch_currency = 'EUR' then coalesce(v_batch.created_at::date, current_date) else null end),
    'goodsValueFxSource', coalesce(v_batch.goods_value_fx_source,
      case when v_batch_currency = 'EUR' then 'legacy EUR implicit' else null end),
    'goodsValueFxEvidenceUrl', v_batch.goods_value_fx_evidence_url
  );
  v_result := jsonb_set(
    v_result,
    '{candidateAllocations}',
    private.supplier_batch_v2_enrich_allocations(
      v_result -> 'candidateAllocations',
      v_charge.capitalized_amount,
      v_charge.fx_rate_to_eur,
      v_goods_fx_rate,
      v_batch_currency,
      upper(coalesce(v_charge.currency, 'EUR')),
      v_charge.amount_net,
      v_charge.vat_amount,
      v_charge.amount_gross
    ),
    true
  );
  v_result := jsonb_set(
    v_result,
    '{confirmedAllocations}',
    private.supplier_batch_v2_enrich_allocations(
      v_result -> 'confirmedAllocations',
      v_charge.capitalized_amount,
      v_charge.fx_rate_to_eur,
      v_goods_fx_rate,
      v_batch_currency,
      upper(coalesce(v_charge.currency, 'EUR')),
      v_charge.amount_net,
      v_charge.vat_amount,
      v_charge.amount_gross
    ),
    true
  );
  v_result := jsonb_set(
    v_result,
    '{allocations}',
    private.supplier_batch_v2_enrich_allocations(
      v_result -> 'allocations',
      v_charge.capitalized_amount,
      v_charge.fx_rate_to_eur,
      v_goods_fx_rate,
      v_batch_currency,
      upper(coalesce(v_charge.currency, 'EUR')),
      v_charge.amount_net,
      v_charge.vat_amount,
      v_charge.amount_gross
    ),
    true
  );
  v_result := jsonb_set(
    v_result,
    '{lineProjections}',
    private.supplier_batch_v2_line_projection(
      v_batch.id,
      case
        when v_charge.status = 'estimated' then coalesce(v_result -> 'candidateAllocations', '[]'::jsonb)
        else '[]'::jsonb
      end,
      v_batch_currency,
      upper(coalesce(v_charge.currency, 'EUR')),
      v_charge.fx_rate_to_eur
    ),
    true
  );
  if jsonb_typeof(v_result -> 'charge') = 'object' then
    v_result := jsonb_set(
      v_result,
      '{charge}',
      (v_result -> 'charge') || jsonb_build_object(
        'baseCurrency', 'EUR',
        'fxRateToEur', coalesce(v_charge.fx_rate_to_eur,
          case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then 1 else null end),
        'fxRateDate', coalesce(v_charge.fx_rate_date,
          case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR'
            then coalesce(v_charge.created_at::date, current_date) else null end),
        'fxRateSource', coalesce(v_charge.fx_rate_source,
          case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then 'legacy EUR implicit' else null end),
        'fxEvidenceUrl', v_charge.fx_evidence_url,
        'amountNetEur', coalesce(v_charge.amount_net_eur,
          case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then v_charge.amount_net else null end),
        'vatAmountEur', coalesce(v_charge.vat_amount_eur,
          case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then v_charge.vat_amount else null end),
        'amountGrossEur', coalesce(v_charge.amount_gross_eur,
          case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then v_charge.amount_gross else null end),
        'capitalizedAmountEur', coalesce(v_charge.capitalized_amount_eur,
          case when upper(coalesce(v_charge.currency, 'EUR')) = 'EUR' then v_charge.capitalized_amount else null end)
      ),
      true
    );
  end if;
  return v_result;
end
$$;

create or replace function private.supplier_batch_v2_has_permission(
  p_permission text,
  p_allow_legacy_estimate boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'role') = 'service_role', false)
    or coalesce((select private.partspro_has_permission(p_permission)), false)
    or (
      p_allow_legacy_estimate
      and coalesce((select private.partspro_has_permission('supplier_batch.manage_costs')), false)
    )
$$;

-- V2 summary read model.  Original-currency totals are retained only when
-- every active charge uses the batch currency.  EUR totals are the reporting
-- authority for mixed currencies, and goods use the independent batch FX
-- snapshot rather than any charge FX snapshot.
create or replace function public.admin_list_supplier_batch_cost_summaries_v2(
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
  -- Cost summaries are part of the base batch/product read model.  The
  -- dedicated supplier_batch.read permission is reserved for redacted cost
  -- history/correction links and must not make this RPC an alternate batch
  -- enumeration channel.
  if not v_is_service_role and not (
    coalesce((select private.partspro_has_permission('product.read_admin')), false)
    or coalesce((select private.partspro_has_permission('products.read_admin')), false)
  ) then
    raise exception 'Product read permission required for supplier batch summaries'
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

  with requested as (
    select unnest(v_requested_ids) as batch_id
  ),
  batch_base as (
    select
      batch.id as batch_id,
      batch.batch_code,
      upper(coalesce(batch.currency, 'EUR')) as currency,
      round(batch.total_cost, 2) as goods_value,
      batch.goods_value_eur,
      batch.goods_value_fx_rate_to_eur,
      batch.goods_value_fx_date,
      batch.goods_value_fx_source,
      batch.goods_value_fx_evidence_url,
      batch.base_currency
    from public.supplier_batches as batch
    join requested on requested.batch_id = batch.id
  ),
  line_goods as (
    select
      line.batch_id,
      count(*)::integer as received_line_count,
      sum(round(line.qty_received::numeric * line.unit_cost, 2)) as line_goods_value,
      sum(
        case
          when base.currency = 'EUR' then round(line.qty_received::numeric * line.unit_cost, 2)
          when base.goods_value_fx_rate_to_eur is null then 0::numeric
          else round(line.qty_received::numeric * line.unit_cost * base.goods_value_fx_rate_to_eur, 2)
        end
      ) as line_goods_value_eur
    from public.supplier_batch_lines as line
    join batch_base as base on base.batch_id = line.batch_id
    where line.qty_received > 0
    group by line.batch_id
  ),
  batches as (
    select
      base.*,
      -- supplier_batches.total_cost is the goods-value authority.  The
      -- received-line sum remains available only as a reconciliation basis;
      -- it must never replace the batch fact in a summary or landed total.
      base.goods_value as goods_value_original,
      coalesce(line_goods.line_goods_value, 0) as received_line_goods_value,
      round(coalesce(line_goods.line_goods_value, 0) - base.goods_value, 2)
        as goods_value_reconciliation_delta,
      case
        when base.currency = 'EUR' then round(base.goods_value, 2)
        when base.goods_value_fx_rate_to_eur is not null
          and base.goods_value_fx_date is not null
          and nullif(btrim(base.goods_value_fx_source), '') is not null
          then round(base.goods_value * base.goods_value_fx_rate_to_eur, 2)
        else null
      end as goods_value_eur_resolved
    from batch_base as base
    left join line_goods on line_goods.batch_id = base.batch_id
  ),
  -- Applied corrections replace the original confirmed charge in every
  -- effective read.  Keep the physical original row/allocations for audit,
  -- but never count that row together with its replacement.
  effective_charges as (
    select charge.*
    from public.supplier_batch_charges as charge
    where not exists (
      select 1
      from public.supplier_batch_charge_corrections as correction
      where correction.original_charge_id = charge.id
        and correction.status = 'applied'
    )
  ),
  charge_currency_state as (
    select
      batch.batch_id,
      coalesce(
        bool_and(upper(coalesce(charge.currency, 'EUR')) = batch.currency)
          filter (where charge.status in ('estimated', 'confirmed')),
        true
      ) as original_totals_comparable
    from batches as batch
    left join effective_charges as charge
      on charge.batch_id = batch.batch_id
    group by batch.batch_id
  ),
  charge_summary as (
    select
      charge.batch_id,
      count(*) filter (where charge.status = 'estimated')::integer as estimated_count,
      count(*) filter (where charge.status = 'confirmed')::integer as confirmed_count,
      count(*) filter (where charge.status = 'cancelled')::integer as cancelled_count,
      round(coalesce(sum(charge.amount_net) filter (where charge.status = 'estimated'), 0), 2) as estimated_net,
      round(coalesce(sum(charge.vat_amount) filter (where charge.status = 'estimated'), 0), 2) as estimated_vat,
      round(coalesce(sum(charge.amount_gross) filter (where charge.status = 'estimated'), 0), 2) as estimated_gross,
      round(coalesce(sum(charge.capitalized_amount) filter (where charge.status = 'estimated'), 0), 2) as estimated_capitalized,
      round(coalesce(sum(charge.amount_net) filter (where charge.status = 'confirmed'), 0), 2) as confirmed_net,
      round(coalesce(sum(charge.vat_amount) filter (where charge.status = 'confirmed'), 0), 2) as confirmed_vat,
      round(coalesce(sum(charge.amount_gross) filter (where charge.status = 'confirmed'), 0), 2) as confirmed_gross,
      round(coalesce(sum(charge.capitalized_amount) filter (where charge.status = 'confirmed'), 0), 2) as confirmed_capitalized,
      round(coalesce(sum(
        coalesce(charge.amount_net_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR' then charge.amount_net else 0 end)
      ) filter (where charge.status = 'estimated'), 0), 2) as estimated_net_eur,
      round(coalesce(sum(
        coalesce(charge.vat_amount_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR' then charge.vat_amount else 0 end)
      ) filter (where charge.status = 'estimated'), 0), 2) as estimated_vat_eur,
      round(coalesce(sum(
        coalesce(charge.amount_gross_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR' then charge.amount_gross else 0 end)
      ) filter (where charge.status = 'estimated'), 0), 2) as estimated_gross_eur,
      round(coalesce(sum(
        coalesce(charge.capitalized_amount_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR' then charge.capitalized_amount else 0 end)
      ) filter (where charge.status = 'estimated'), 0), 2) as estimated_capitalized_eur,
      round(coalesce(sum(
        coalesce(charge.amount_net_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR' then charge.amount_net else 0 end)
      ) filter (where charge.status = 'confirmed'), 0), 2) as confirmed_net_eur,
      round(coalesce(sum(
        coalesce(charge.vat_amount_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR' then charge.vat_amount else 0 end)
      ) filter (where charge.status = 'confirmed'), 0), 2) as confirmed_vat_eur,
      round(coalesce(sum(
        coalesce(charge.amount_gross_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR' then charge.amount_gross else 0 end)
      ) filter (where charge.status = 'confirmed'), 0), 2) as confirmed_gross_eur,
      round(coalesce(sum(
        coalesce(charge.capitalized_amount_eur,
          case when upper(coalesce(charge.currency, 'EUR')) = 'EUR' then charge.capitalized_amount else 0 end)
      ) filter (where charge.status = 'confirmed'), 0), 2) as confirmed_capitalized_eur
    from effective_charges as charge
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
  weight_flags as (
    select
      charge.batch_id,
      bool_or(charge.status = 'estimated' and charge.allocation_method = 'weight') as has_active_weight_estimate
    from effective_charges as charge
    join requested on requested.batch_id = charge.batch_id
    group by charge.batch_id
  ),
  layer_flags as (
    select
      line.batch_id,
      bool_or(layer.allocated_qty > 0 or layer.consumed_qty > 0) as has_allocated_or_consumed_layer
    from public.supplier_batch_lines as line
    join requested on requested.batch_id = line.batch_id
    join public.finance_cost_layers as layer on layer.supplier_batch_line_id = line.id
    group by line.batch_id
  ),
  reviewed as (
    select
      batches.*,
      state.original_totals_comparable,
      coalesce(charge_summary.estimated_count, 0) as estimated_count,
      coalesce(charge_summary.confirmed_count, 0) as confirmed_count,
      coalesce(charge_summary.cancelled_count, 0) as cancelled_count,
      case when state.original_totals_comparable then coalesce(charge_summary.estimated_net, 0) else 0 end as estimated_net,
      case when state.original_totals_comparable then coalesce(charge_summary.estimated_vat, 0) else 0 end as estimated_vat,
      case when state.original_totals_comparable then coalesce(charge_summary.estimated_gross, 0) else 0 end as estimated_gross,
      case when state.original_totals_comparable then coalesce(charge_summary.estimated_capitalized, 0) else 0 end as estimated_capitalized,
      case when state.original_totals_comparable then coalesce(charge_summary.confirmed_net, 0) else 0 end as confirmed_net,
      case when state.original_totals_comparable then coalesce(charge_summary.confirmed_vat, 0) else 0 end as confirmed_vat,
      case when state.original_totals_comparable then coalesce(charge_summary.confirmed_gross, 0) else 0 end as confirmed_gross,
      case when state.original_totals_comparable then coalesce(charge_summary.confirmed_capitalized, 0) else 0 end as confirmed_capitalized,
      coalesce(charge_summary.estimated_net_eur, 0) as estimated_net_eur,
      coalesce(charge_summary.estimated_vat_eur, 0) as estimated_vat_eur,
      coalesce(charge_summary.estimated_gross_eur, 0) as estimated_gross_eur,
      coalesce(charge_summary.estimated_capitalized_eur, 0) as estimated_capitalized_eur,
      coalesce(charge_summary.confirmed_net_eur, 0) as confirmed_net_eur,
      coalesce(charge_summary.confirmed_vat_eur, 0) as confirmed_vat_eur,
      coalesce(charge_summary.confirmed_gross_eur, 0) as confirmed_gross_eur,
      coalesce(charge_summary.confirmed_capitalized_eur, 0) as confirmed_capitalized_eur,
      array_remove(array[
        case when not state.original_totals_comparable then 'MIXED_CURRENCY'::text end,
        case when batches.goods_value_eur_resolved is null then 'BATCH_FX_RATE_REQUIRED'::text end,
        case when coalesce(line_flags.missing_product_mapping, false) then 'PRODUCT_MAPPING_REQUIRED'::text end,
        case when coalesce(weight_flags.has_active_weight_estimate, false)
          and coalesce(line_flags.missing_weight, false) then 'WEIGHT_REQUIRED_FOR_ESTIMATE'::text end,
        case when coalesce(layer_flags.has_allocated_or_consumed_layer, false)
          then 'FINANCE_ADJUSTMENT_REQUIRED'::text end
      ]::text[], null::text) as review_codes
    from batches
    join charge_currency_state as state on state.batch_id = batches.batch_id
    left join charge_summary on charge_summary.batch_id = batches.batch_id
    left join line_flags on line_flags.batch_id = batches.batch_id
    left join weight_flags on weight_flags.batch_id = batches.batch_id
    left join layer_flags on layer_flags.batch_id = batches.batch_id
  ),
  scored as (
    select reviewed.*,
      case
        when cardinality(array_remove(review_codes, 'MIXED_CURRENCY')) > 0 then 'needs_review'
        when estimated_count > 0 then 'estimated'
        when confirmed_count > 0
          and case when original_totals_comparable
            then confirmed_capitalized
            else confirmed_capitalized_eur
          end = 0 then 'confirmed_zero'
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
      'goodsValue', goods_value_original,
      'goodsValueReceivedLineBasis', received_line_goods_value,
      'goodsValueReconciliationDelta', goods_value_reconciliation_delta,
      'goodsValueReconciliationWarning', goods_value_reconciliation_delta <> 0,
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
      'confirmedLandedTotal', case when original_totals_comparable then round(goods_value_original + confirmed_capitalized, 2) else null end,
      'projectedLandedTotal', case when original_totals_comparable then round(goods_value_original + confirmed_capitalized + estimated_capitalized, 2) else null end,
      'confirmationBlocked', cardinality(array_remove(review_codes, 'MIXED_CURRENCY')) > 0,
      'reviewCodes', to_jsonb(review_codes),
      'costStatus', cost_status,
      'originalTotalsComparable', original_totals_comparable,
      'baseCurrency', 'EUR',
      'baseFxAvailable', goods_value_eur_resolved is not null,
      'goodsValueEur', goods_value_eur_resolved,
      'estimatedNetEur', estimated_net_eur,
      'estimatedVatEur', estimated_vat_eur,
      'estimatedGrossEur', estimated_gross_eur,
      'estimatedCapitalizedEur', estimated_capitalized_eur,
      'confirmedNetEur', confirmed_net_eur,
      'confirmedVatEur', confirmed_vat_eur,
      'confirmedGrossEur', confirmed_gross_eur,
      'confirmedCapitalizedEur', confirmed_capitalized_eur,
      'confirmedLandedTotalEur', case when goods_value_eur_resolved is null then null else round(goods_value_eur_resolved + confirmed_capitalized_eur, 2) end,
      'projectedLandedTotalEur', case when goods_value_eur_resolved is null then null else round(goods_value_eur_resolved + confirmed_capitalized_eur + estimated_capitalized_eur, 2) end,
      'goodsValueFxRateToEur', goods_value_fx_rate_to_eur,
      'goodsValueFxDate', goods_value_fx_date,
      'goodsValueFxSource', goods_value_fx_source,
      'goodsValueFxEvidenceUrl', goods_value_fx_evidence_url
    ) order by batch_code, batch_id
  ), '[]'::jsonb)
  into v_result
  from scored;
  return v_result;
end
$$;

-- Allocation remains in the transaction currency, then each line is converted
-- independently to EUR cents by the single largest-remainder implementation
-- above.  Keeping this relational wrapper on that implementation prevents
-- preview and persisted allocation paths from drifting.
create or replace function private.calculate_supplier_batch_charge_allocations_v2(
  p_batch_id uuid,
  p_allocation_method text,
  p_capitalized_amount numeric,
  p_manual_allocations jsonb default '[]'::jsonb,
  p_charge_fx_rate numeric default 1,
  p_goods_fx_rate numeric default 1,
  p_batch_currency text default 'EUR',
  p_charge_currency text default 'EUR',
  p_amount_net numeric default null,
  p_vat_amount numeric default null,
  p_amount_gross numeric default null
)
returns table (
  batch_line_id uuid,
  line_no integer,
  sku_code text,
  qty_received_snapshot integer,
  goods_cost_snapshot numeric,
  goods_cost_snapshot_eur numeric,
  weight_gram_snapshot integer,
  basis_value numeric,
  share_ratio numeric,
  allocated_amount numeric,
  allocated_amount_eur numeric,
  allocated_unit_amount numeric,
  allocated_unit_amount_eur numeric,
  landed_line_cost numeric,
  landed_line_cost_eur numeric,
  landed_unit_cost numeric,
  landed_unit_cost_eur numeric,
  rounding_adjustment numeric,
  rounding_adjustment_eur numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select coalesce(jsonb_agg(
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
      ) order by allocation.line_no, allocation.batch_line_id
    ), '[]'::jsonb) as allocations
    from private.calculate_supplier_batch_charge_allocations(
      p_batch_id,
      p_allocation_method,
      p_capitalized_amount,
      p_manual_allocations
    ) as allocation
  ),
  enriched as (
    select private.supplier_batch_v2_enrich_allocations(
      base.allocations,
      p_capitalized_amount,
      p_charge_fx_rate,
      p_goods_fx_rate,
      p_batch_currency,
      p_charge_currency,
      p_amount_net,
      p_vat_amount,
      p_amount_gross
    ) as allocations
    from base
  )
  select
    (item.value ->> 'batchLineId')::uuid,
    (item.value ->> 'lineNo')::integer,
    item.value ->> 'skuCode',
    (item.value ->> 'qtyReceivedSnapshot')::integer,
    (item.value ->> 'goodsCostSnapshot')::numeric,
    (item.value ->> 'goodsCostSnapshotEur')::numeric,
    (item.value ->> 'weightGramSnapshot')::integer,
    (item.value ->> 'basisValue')::numeric,
    (item.value ->> 'shareRatio')::numeric,
    (item.value ->> 'allocatedAmount')::numeric,
    (item.value ->> 'allocatedAmountEur')::numeric,
    (item.value ->> 'allocatedUnitAmount')::numeric,
    (item.value ->> 'allocatedUnitAmountEur')::numeric,
    (item.value ->> 'landedLineCost')::numeric,
    (item.value ->> 'landedLineCostEur')::numeric,
    (item.value ->> 'landedUnitCost')::numeric,
    (item.value ->> 'landedUnitCostEur')::numeric,
    (item.value ->> 'roundingAdjustment')::numeric,
    (item.value ->> 'roundingAdjustmentEur')::numeric
  from enriched
  cross join lateral jsonb_array_elements(enriched.allocations) as item(value)
  order by (item.value ->> 'lineNo')::integer, (item.value ->> 'batchLineId')::uuid
$$;


-- Parse and normalize the V2 payload once.  The function accepts decimal
-- text from jsonb, validates its scale before casting, and always emits a
-- complete immutable EUR snapshot.  EUR is deliberately normalized to rate
-- 1 with a server-recorded date/source when the caller omits those fields.
create or replace function private.parse_supplier_batch_charge_payload_v2(
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
  metadata jsonb,
  fx_rate_to_eur numeric,
  fx_rate_date date,
  fx_rate_source text,
  fx_evidence_url text,
  batch_goods_fx_rate_to_eur numeric,
  batch_goods_fx_date date,
  batch_goods_fx_source text,
  batch_goods_fx_evidence_url text
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
  v_fx_rate numeric;
  v_fx_rate_date date;
  v_fx_rate_source text;
  v_fx_evidence_url text;
  v_batch_goods_fx_rate_to_eur numeric;
  v_batch_goods_fx_date date;
  v_batch_goods_fx_source text;
  v_batch_goods_fx_evidence_url text;
  v_amount_text text;
  v_fx_text text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Charge payload must be a JSON object' using errcode = '22023';
  end if;

  v_charge_id := case
    when nullif(btrim(coalesce(p_payload ->> 'chargeId', '')), '') is null then null
    else (p_payload ->> 'chargeId')::uuid
  end;
  v_charge_type := lower(coalesce(nullif(btrim(p_payload ->> 'chargeType'), ''), 'transport'));
  v_currency := upper(coalesce(nullif(btrim(p_payload ->> 'currency'), ''), 'EUR'));
  v_vat_treatment := lower(coalesce(nullif(btrim(p_payload ->> 'vatTreatment'), ''), 'unknown'));
  v_allocation_method := lower(coalesce(nullif(btrim(p_payload ->> 'allocationMethod'), ''), 'goods_value'));

  foreach v_amount_text in array array[
    p_payload ->> 'amountNet',
    p_payload ->> 'vatAmount'
  ] loop
    if coalesce(v_amount_text, '') !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$' then
      raise exception 'Money values must have at most two decimal places' using errcode = '22023';
    end if;
  end loop;
  v_amount_net := round((p_payload ->> 'amountNet')::numeric, 2);
  v_vat_amount := round((p_payload ->> 'vatAmount')::numeric, 2);
  if not p_payload ? 'capitalizedAmount'
     or coalesce(p_payload ->> 'capitalizedAmount', '') !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$' then
    raise exception 'capitalizedAmount must have at most two decimal places and be explicit' using errcode = '22023';
  end if;
  v_capitalized_amount := round((p_payload ->> 'capitalizedAmount')::numeric, 2);
  v_amount_gross := round(v_amount_net + v_vat_amount, 2);

  v_carrier_name := nullif(btrim(coalesce(p_payload ->> 'carrierName', '')), '');
  v_charge_reference := nullif(btrim(coalesce(p_payload ->> 'reference', '')), '');
  v_occurred_at := case
    when nullif(btrim(coalesce(p_payload ->> 'occurredAt', '')), '') is null then null
    else (p_payload ->> 'occurredAt')::timestamptz
  end;
  v_evidence_url := nullif(btrim(coalesce(p_payload ->> 'evidenceUrl', '')), '');
  v_notes := nullif(btrim(coalesce(p_payload ->> 'notes', '')), '');
  v_zero_cost_reason := nullif(btrim(coalesce(p_payload ->> 'zeroCostReason', '')), '');
  v_idempotency_key := nullif(btrim(coalesce(p_idempotency_key, p_payload ->> 'idempotencyKey', '')), '');
  if length(v_carrier_name) > 200
     or length(v_charge_reference) > 200
     or length(v_notes) > 2000
     or length(v_zero_cost_reason) > 500
     or length(v_idempotency_key) > 200
     or length(nullif(btrim(coalesce(p_payload ->> 'occurredAt', '')), '')) > 80 then
    raise exception 'Charge text fields exceed their V2 limits' using errcode = '22023';
  end if;
  if p_idempotency_key is not null
     and nullif(btrim(coalesce(p_payload ->> 'idempotencyKey', '')), '') is not null
     and btrim(p_idempotency_key) <> btrim(p_payload ->> 'idempotencyKey') then
    raise exception 'Payload idempotencyKey must match the request idempotency key'
      using errcode = '23505', detail = 'IDEMPOTENCY_KEY_MISMATCH';
  end if;

  if length(v_evidence_url) > 2048
     or (v_evidence_url is not null and v_evidence_url !~* '^https?://\S+$') then
    raise exception 'evidenceUrl must use http or https' using errcode = '22023';
  end if;

  if p_payload ? 'manualAllocations'
     and jsonb_typeof(p_payload -> 'manualAllocations') <> 'array' then
    raise exception 'manualAllocations must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_payload -> 'manualAllocations', '[]'::jsonb)) > 500 then
    raise exception 'At most 500 manual allocations are allowed' using errcode = '22023';
  end if;
  v_manual_allocations := private.normalise_supplier_batch_manual_allocations(
    coalesce(p_payload -> 'manualAllocations', '[]'::jsonb)
  );
  if v_allocation_method <> 'manual' then
    v_manual_allocations := '[]'::jsonb;
  end if;

  if p_payload ? 'metadata' and jsonb_typeof(p_payload -> 'metadata') <> 'object' then
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
  if v_currency not in ('EUR', 'USD', 'CNY') then
    raise exception 'Unsupported supplier batch currency: %', v_currency using errcode = '22023';
  end if;
  if v_amount_net < 0 or v_vat_amount < 0 or v_capitalized_amount < 0 then
    raise exception 'Charge amounts cannot be negative' using errcode = '22023';
  end if;
  if v_amount_net > 1000000000
     or v_vat_amount > 1000000000
     or v_capitalized_amount > 1000000000 then
    raise exception 'Charge amounts exceed the V2 limit' using errcode = '22023';
  end if;
  if v_capitalized_amount > v_amount_gross then
    raise exception 'Capitalized amount cannot exceed gross amount' using errcode = '22023';
  end if;
  if v_capitalized_amount = 0 and v_zero_cost_reason is null then
    raise exception 'zeroCostReason is required when capitalized amount is zero' using errcode = '22023';
  end if;

  v_fx_text := nullif(btrim(coalesce(p_payload ->> 'fxRateToEur', '')), '');
  if v_currency = 'EUR' then
    if v_fx_text is not null and (v_fx_text !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,12})?$' or v_fx_text::numeric <> 1) then
      raise exception 'EUR FX rate must be exactly 1' using errcode = '22023';
    end if;
    v_fx_rate := 1;
    v_fx_rate_date := case
      when nullif(btrim(coalesce(p_payload ->> 'fxRateDate', '')), '') is null then current_date
      else (p_payload ->> 'fxRateDate')::date
    end;
    v_fx_rate_source := coalesce(nullif(btrim(p_payload ->> 'fxRateSource'), ''), 'EUR base');
  else
    if v_fx_text is null
       or v_fx_text !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,12})?$'
       or v_fx_text::numeric < 0.000001
       or v_fx_text::numeric > 1000000
       or nullif(btrim(coalesce(p_payload ->> 'fxRateDate', '')), '') is null
       or p_payload ->> 'fxRateDate' !~ '^\d{4}-\d{2}-\d{2}$'
       or nullif(btrim(coalesce(p_payload ->> 'fxRateSource', '')), '') is null then
      raise exception 'Non-EUR charges require a complete FX snapshot' using errcode = '22023';
    end if;
    if length(btrim(p_payload ->> 'fxRateSource')) > 200 then
      raise exception 'fxRateSource exceeds the V2 limit' using errcode = '22023';
    end if;
    v_fx_rate := v_fx_text::numeric;
    v_fx_rate_date := (p_payload ->> 'fxRateDate')::date;
    v_fx_rate_source := btrim(p_payload ->> 'fxRateSource');
  end if;
  perform private.supplier_batch_v2_assert_eur_product(v_amount_net, v_fx_rate);
  perform private.supplier_batch_v2_assert_eur_product(v_vat_amount, v_fx_rate);
  perform private.supplier_batch_v2_assert_eur_product(v_capitalized_amount, v_fx_rate);
  v_fx_evidence_url := nullif(btrim(coalesce(p_payload ->> 'fxEvidenceUrl', '')), '');
  if length(v_fx_evidence_url) > 2048
     or (v_fx_evidence_url is not null and v_fx_evidence_url !~* '^https?://\S+$') then
    raise exception 'fxEvidenceUrl must use http or https' using errcode = '22023';
  end if;

  if p_payload ? 'batchGoodsValueFxRateToEur'
     or p_payload ? 'batchGoodsValueFxDate'
     or p_payload ? 'batchGoodsValueFxSource'
     or p_payload ? 'batchGoodsValueFxEvidenceUrl' then
    v_fx_text := nullif(btrim(coalesce(p_payload ->> 'batchGoodsValueFxRateToEur', '')), '');
    if v_fx_text is null
       or v_fx_text !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,12})?$'
       or v_fx_text::numeric < 0.000001
       or v_fx_text::numeric > 1000000
       or coalesce(p_payload ->> 'batchGoodsValueFxDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or nullif(btrim(coalesce(p_payload ->> 'batchGoodsValueFxSource', '')), '') is null then
      raise exception 'Batch goods FX snapshot requires rate, date and source' using errcode = '22023';
    end if;
    if length(btrim(p_payload ->> 'batchGoodsValueFxSource')) > 200 then
      raise exception 'batchGoodsValueFxSource exceeds the V2 limit' using errcode = '22023';
    end if;
    v_batch_goods_fx_rate_to_eur := v_fx_text::numeric;
    v_batch_goods_fx_date := (p_payload ->> 'batchGoodsValueFxDate')::date;
    v_batch_goods_fx_source := btrim(p_payload ->> 'batchGoodsValueFxSource');
    v_batch_goods_fx_evidence_url := nullif(btrim(coalesce(p_payload ->> 'batchGoodsValueFxEvidenceUrl', '')), '');
    if length(v_batch_goods_fx_evidence_url) > 2048
       or (v_batch_goods_fx_evidence_url is not null and v_batch_goods_fx_evidence_url !~* '^https?://\S+$') then
      raise exception 'Batch goods FX evidence URL must use http or https' using errcode = '22023';
    end if;
  end if;

  return query select
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
    v_metadata,
    v_fx_rate,
    v_fx_rate_date,
    v_fx_rate_source,
    v_fx_evidence_url,
    v_batch_goods_fx_rate_to_eur,
    v_batch_goods_fx_date,
    v_batch_goods_fx_source,
    v_batch_goods_fx_evidence_url;
end
$$;

create or replace function private.supplier_batch_charge_fingerprint_v2(
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
  p_metadata jsonb,
  p_fx_rate_to_eur numeric,
  p_fx_rate_date date,
  p_fx_rate_source text,
  p_fx_evidence_url text,
  p_batch_goods_fx_rate_to_eur numeric,
  p_batch_goods_fx_date date,
  p_batch_goods_fx_source text,
  p_batch_goods_fx_evidence_url text
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select md5(jsonb_build_object(
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
    'manualAllocations', private.normalise_supplier_batch_manual_allocations(coalesce(p_manual_allocations, '[]'::jsonb)),
    'userMetadata', coalesce(p_metadata, '{}'::jsonb),
    'fxRateToEur', p_fx_rate_to_eur,
    'fxRateDate', p_fx_rate_date,
    'fxRateSource', p_fx_rate_source,
    'fxEvidenceUrl', p_fx_evidence_url,
    'batchGoodsValueFxRateToEur', p_batch_goods_fx_rate_to_eur,
    'batchGoodsValueFxDate', p_batch_goods_fx_date,
    'batchGoodsValueFxSource', p_batch_goods_fx_source,
    'batchGoodsValueFxEvidenceUrl', p_batch_goods_fx_evidence_url
  )::text)
$$;

-- Correction idempotency is deliberately separate from the charge payload
-- fingerprint.  A correction can reuse the same replacement payload only
-- when its reason, source revision, preview fingerprint and original charge
-- are all the same; this prevents a reused key from silently changing an
-- audit decision.
create or replace function private.supplier_batch_correction_fingerprint_v2(
  p_original_charge_id uuid,
  p_correction_reason text,
  p_payload jsonb,
  p_revision text,
  p_preview_fingerprint text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'originalChargeId', p_original_charge_id,
    'correctionReason', btrim(coalesce(p_correction_reason, '')),
    'payload', coalesce(p_payload, '{}'::jsonb),
    'revision', btrim(coalesce(p_revision, '')),
    'previewFingerprint', btrim(coalesce(p_preview_fingerprint, ''))
  )::text)
$$;


create index if not exists supplier_batches_currency_fx_idx
  on public.supplier_batches (currency, goods_value_fx_date);
create index if not exists supplier_batch_charges_fx_date_idx
  on public.supplier_batch_charges (currency, fx_rate_date, created_at desc);
create index if not exists supplier_batch_charge_corrections_original_idx
  on public.supplier_batch_charge_corrections (batch_id, original_charge_id, created_at desc);
create index if not exists supplier_batch_charge_corrections_original_fk_idx
  on public.supplier_batch_charge_corrections (original_charge_id, batch_id);
create index if not exists supplier_batch_charge_corrections_replacement_fk_idx
  on public.supplier_batch_charge_corrections (replacement_charge_id, batch_id);

alter table public.supplier_batch_charge_corrections enable row level security;
revoke all on table public.supplier_batch_charge_corrections from public, anon, authenticated, service_role;
-- Correction metadata contains proposed payloads, before/after snapshots and
-- actor details.  It must never be directly enumerable through PostgREST;
-- authenticated readers use the allow-listed history/correction RPC instead.
-- Keep service_role access for maintenance only, with no authenticated grant
-- or policy that could expose the raw metadata column.
grant select on table public.supplier_batch_charge_corrections to service_role;
drop policy if exists partspro_supplier_batch_charge_corrections_staff_read
  on public.supplier_batch_charge_corrections;

-- A correction never mutates a confirmed charge.  When no affected finance
-- layer has been allocated/consumed this function atomically creates the
-- confirmed replacement, its allocations and the effective finance-layer
-- projection.  Once a layer has been used, it records only a pending receipt:
-- no replacement, allocation, layer, COGS, stock or price write is allowed.
create or replace function public.admin_correct_supplier_batch_charge_v2(
  p_batch_code text,
  p_charge_id uuid,
  p_payload jsonb,
  p_correction_reason text,
  p_revision text,
  p_preview_fingerprint text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_batch public.supplier_batches%rowtype;
  v_original public.supplier_batch_charges%rowtype;
  v_replacement public.supplier_batch_charges%rowtype;
  v_existing_correction public.supplier_batch_charge_corrections%rowtype;
  v_active_correction public.supplier_batch_charge_corrections%rowtype;
  v_terms record;
  v_fingerprint text;
  v_correction_fingerprint text;
  v_current_revision text;
  v_batch_currency text;
  v_goods_fx_rate numeric;
  v_goods_value_eur numeric;
  v_allocations jsonb;
  v_allocation_total numeric;
  v_allocation_total_eur numeric;
  v_expected_allocation_eur numeric;
  v_finance_adjustment_required boolean := false;
  v_correction_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_replacement_result jsonb;
  v_receipt jsonb;
  v_metadata jsonb;
begin
  if v_actor_id is null and not coalesce((auth.jwt() ->> 'role') = 'service_role', false) then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not (select private.supplier_batch_v2_has_permission('supplier_batch.correct', false)) then
    raise exception 'Supplier batch correction permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;
  if p_charge_id is null then
    raise exception 'chargeId is required' using errcode = '22023', detail = 'CHARGE_NOT_FOUND';
  end if;
  if nullif(btrim(coalesce(p_correction_reason, '')), '') is null then
    raise exception 'A correction reason is required'
      using errcode = '22023', detail = 'CORRECTION_REASON_REQUIRED';
  end if;
  if nullif(btrim(coalesce(p_revision, '')), '') is null
     or nullif(btrim(coalesce(p_preview_fingerprint, '')), '') is null then
    raise exception 'A revision and preview fingerprint are required for correction'
      using errcode = '22023', detail = 'STALE_PREVIEW';
  end if;
  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null then
    raise exception 'idempotencyKey is required for correction'
      using errcode = '22023', detail = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(coalesce(p_batch_code, ''))
  for update;
  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;

  select * into v_original
  from public.supplier_batch_charges as charge
  where charge.id = p_charge_id
    and charge.batch_id = v_batch.id
  for update;
  if v_original.id is null then
    raise exception 'Supplier batch charge not found: %', p_charge_id
      using errcode = 'P0002', detail = 'CHARGE_NOT_FOUND';
  end if;
  if v_original.status <> 'confirmed' then
    raise exception 'Only confirmed supplier batch charges can be corrected'
      using errcode = '55000', detail = 'CORRECTION_NOT_ALLOWED';
  end if;

  select * into v_terms
  from private.parse_supplier_batch_charge_payload_v2(p_payload, p_idempotency_key);
  if v_terms.charge_id is distinct from p_charge_id then
    raise exception 'Correction payload chargeId must identify the original charge'
      using errcode = '23505', detail = 'CHARGE_IDEMPOTENCY_MISMATCH';
  end if;
  if v_terms.idempotency_key is null then
    raise exception 'idempotencyKey is required for correction'
      using errcode = '22023', detail = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if v_terms.vat_treatment = 'unknown' then
    raise exception 'Corrected confirmed supplier batch charges require known VAT treatment'
      using errcode = '23514', detail = 'UNKNOWN_VAT_NOT_ALLOWED';
  end if;
  if v_terms.allocation_method <> 'manual' then
    v_terms.manual_allocations := '[]'::jsonb;
  end if;

  v_fingerprint := private.supplier_batch_charge_fingerprint_v2(
    v_terms.charge_type, v_terms.amount_net, v_terms.vat_amount,
    v_terms.amount_gross, v_terms.capitalized_amount, v_terms.currency,
    v_terms.vat_treatment, v_terms.allocation_method, v_terms.carrier_name,
    v_terms.charge_reference, v_terms.occurred_at, v_terms.evidence_url,
    v_terms.notes, v_terms.zero_cost_reason, v_terms.manual_allocations,
    v_terms.metadata, v_terms.fx_rate_to_eur, v_terms.fx_rate_date,
    v_terms.fx_rate_source, v_terms.fx_evidence_url,
    v_terms.batch_goods_fx_rate_to_eur, v_terms.batch_goods_fx_date,
    v_terms.batch_goods_fx_source, v_terms.batch_goods_fx_evidence_url
  );
  if v_fingerprint <> btrim(p_preview_fingerprint) then
    raise exception 'Preview fingerprint does not match the correction payload'
      using errcode = '40001', detail = 'STALE_PREVIEW';
  end if;
  v_correction_fingerprint := private.supplier_batch_correction_fingerprint_v2(
    p_charge_id,
    p_correction_reason,
    p_payload,
    p_revision,
    p_preview_fingerprint
  );

  -- The original-charge lock is acquired before the correction-key lock for
  -- every request.  This makes same-original races deterministic; the unique
  -- key/index checks below then fail closed for cross-pair reuse.
  select * into v_existing_correction
  from public.supplier_batch_charge_corrections as correction
  where correction.idempotency_key = btrim(p_idempotency_key)
  for update;
  if v_existing_correction.id is not null then
    if v_existing_correction.batch_id <> v_batch.id
       or v_existing_correction.original_charge_id <> p_charge_id
       or v_existing_correction.correction_reason <> btrim(p_correction_reason)
       or v_existing_correction.preview_fingerprint <> btrim(p_preview_fingerprint)
       or v_existing_correction.revision <> btrim(p_revision)
       or coalesce(v_existing_correction.metadata ->> 'correctionFingerprint', '')
          <> v_correction_fingerprint
       or coalesce(v_existing_correction.metadata ->> 'payloadFingerprint', '')
          <> v_fingerprint then
      raise exception 'Correction idempotency key conflicts with a different correction payload'
        using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing_correction.status = 'applied'
       and v_existing_correction.replacement_charge_id is not null then
      v_replacement_result := private.supplier_batch_charge_result_v2(
        v_existing_correction.replacement_charge_id
      );
      return private.supplier_batch_correction_receipt_v2(
        'corrected', v_existing_correction.id, p_charge_id,
        v_existing_correction.replacement_charge_id, v_batch.batch_code,
        v_existing_correction.idempotency_key,
        v_existing_correction.preview_fingerprint,
        v_existing_correction.revision, false, v_replacement_result
      );
    elsif v_existing_correction.status = 'pending_finance_adjustment' then
      return private.supplier_batch_correction_receipt_v2(
        'pending_finance_adjustment', v_existing_correction.id, p_charge_id,
        null, v_batch.batch_code, v_existing_correction.idempotency_key,
        v_existing_correction.preview_fingerprint,
        v_existing_correction.revision, true, null
      );
    end if;
    raise exception 'Correction is not replayable in its current state'
      using errcode = '55000', detail = 'CORRECTION_NOT_ALLOWED';
  end if;

  -- A correction key is also persisted on the replacement charge.  Reject a
  -- pre-existing charge key before inserting anything so a cross-operation
  -- key collision fails closed with a domain error instead of a raw unique
  -- violation after the replacement has been partially prepared.
  if exists (
    select 1
    from public.supplier_batch_charges as charge
    where charge.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Correction idempotency key belongs to another charge'
      using errcode = '23505', detail = 'IDEMPOTENCY_CONFLICT';
  end if;

  -- A different key cannot create a second active correction for one original.
  select * into v_active_correction
  from public.supplier_batch_charge_corrections as correction
  where correction.original_charge_id = p_charge_id
    and correction.status in ('candidate_ready', 'pending_finance_adjustment', 'applied')
  order by correction.created_at, correction.id
  limit 1
  for update;
  if v_active_correction.id is not null then
    raise exception 'A correction already exists for this original charge'
      using errcode = '55000', detail = 'CORRECTION_ALREADY_EXISTS';
  end if;

  -- Lock every preview input in the same line/layer order used by confirm.
  perform line.id
  from public.supplier_batch_lines as line
  where line.batch_id = v_batch.id
  order by line.id
  for update;
  perform layer.id
  from public.finance_cost_layers as layer
  join public.supplier_batch_lines as line on line.id = layer.supplier_batch_line_id
  where line.batch_id = v_batch.id
  order by layer.supplier_batch_line_id, layer.id
  for update;
  v_current_revision := private.supplier_batch_charge_revision(v_batch.id);
  if btrim(p_revision) <> v_current_revision then
    raise exception 'Supplier batch revision is stale; correction preview must be refreshed'
      using errcode = '40001', detail = 'STALE_REVISION';
  end if;
  select exists (
    select 1
    from public.finance_cost_layers as layer
    join public.supplier_batch_lines as line on line.id = layer.supplier_batch_line_id
    where line.batch_id = v_batch.id
      and (layer.allocated_qty > 0 or layer.consumed_qty > 0)
  ) into v_finance_adjustment_required;

  v_before := private.supplier_batch_charge_result_v2(v_original.id);
  v_batch_currency := upper(coalesce(v_batch.currency, 'EUR'));
  v_goods_fx_rate := case
    when v_batch_currency = 'EUR' then 1
    else coalesce(v_batch.goods_value_fx_rate_to_eur,
      v_terms.batch_goods_fx_rate_to_eur)
  end;
  if v_batch_currency <> 'EUR' and v_goods_fx_rate is null then
    raise exception 'A non-EUR batch requires an independent goods-value FX snapshot before correction'
      using errcode = '55000', detail = 'BATCH_FX_RATE_REQUIRED';
  end if;
  if v_batch_currency = 'EUR'
     and v_terms.batch_goods_fx_rate_to_eur is not null
     and v_terms.batch_goods_fx_rate_to_eur <> 1 then
    raise exception 'EUR batch goods FX rate must be exactly 1'
      using errcode = '22023', detail = 'BATCH_FX_RATE_REQUIRED';
  end if;
  if v_batch.goods_value_fx_rate_to_eur is not null
     and v_terms.batch_goods_fx_rate_to_eur is not null
     and (v_batch.goods_value_fx_rate_to_eur <> v_terms.batch_goods_fx_rate_to_eur
       or v_batch.goods_value_fx_date <> v_terms.batch_goods_fx_date
       or v_batch.goods_value_fx_source <> v_terms.batch_goods_fx_source
       or v_batch.goods_value_fx_evidence_url is distinct from v_terms.batch_goods_fx_evidence_url) then
    raise exception 'Batch goods FX snapshot is immutable; refresh with the stored valuation'
      using errcode = '55000', detail = 'BATCH_FX_SNAPSHOT_IMMUTABLE';
  end if;

  -- A pending correction is intentionally write-minimal: even a supplied
  -- batch FX snapshot is retained in its proposal metadata and is not applied
  -- until finance accepts the adjustment.
  if not v_finance_adjustment_required
     and v_batch_currency <> 'EUR'
     and v_batch.goods_value_fx_rate_to_eur is null
     and v_terms.batch_goods_fx_rate_to_eur is not null then
    v_goods_value_eur := private.supplier_batch_v2_goods_value_eur(v_batch.id, v_goods_fx_rate);
    update public.supplier_batches
    set goods_value_eur = v_goods_value_eur,
        goods_value_fx_rate_to_eur = v_terms.batch_goods_fx_rate_to_eur,
        goods_value_fx_date = v_terms.batch_goods_fx_date,
        goods_value_fx_source = v_terms.batch_goods_fx_source,
        goods_value_fx_evidence_url = v_terms.batch_goods_fx_evidence_url,
        updated_at = now()
    where id = v_batch.id;
    select * into v_batch from public.supplier_batches where id = v_batch.id;
  end if;
  v_goods_fx_rate := case
    when v_batch_currency = 'EUR' then 1
    else coalesce(v_batch.goods_value_fx_rate_to_eur, v_terms.batch_goods_fx_rate_to_eur)
  end;

  v_allocations := private.supplier_batch_v2_allocations_json(
    v_batch.id, v_terms.allocation_method, v_terms.capitalized_amount,
    v_terms.manual_allocations, v_terms.fx_rate_to_eur, v_goods_fx_rate,
    v_batch_currency, v_terms.currency, v_terms.amount_net,
    v_terms.vat_amount, v_terms.amount_gross
  );
  v_allocation_total := private.supplier_batch_v2_allocation_total(
    v_allocations, 'allocatedAmount'
  );
  v_allocation_total_eur := private.supplier_batch_v2_allocation_total(
    v_allocations, 'allocatedAmountEur'
  );
  v_expected_allocation_eur := case
    when v_terms.capitalized_amount = v_terms.amount_gross
      then round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
        + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
    else least(
      round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
      round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
        + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
    )
  end;
  if round(v_allocation_total, 2) <> round(v_terms.capitalized_amount, 2)
     or round(v_allocation_total_eur, 2) <> round(v_expected_allocation_eur, 2) then
    raise exception 'Correction allocation total does not match the canonical capitalized amount'
      using errcode = '23514', detail = 'ALLOCATION_TOTAL_MISMATCH';
  end if;

  if v_finance_adjustment_required then
    v_correction_id := gen_random_uuid();
    v_after := jsonb_build_object(
      'status', 'pending_finance_adjustment',
      'correctionId', v_correction_id,
      'originalChargeId', v_original.id,
      'replacementChargeId', null,
      'batchCode', v_batch.batch_code,
      'idempotencyKey', btrim(p_idempotency_key),
      'previewFingerprint', btrim(p_preview_fingerprint),
      'revision', btrim(p_revision),
      'financeAdjustmentRequired', true,
      'replacement', null,
      'proposedPayload', coalesce(p_payload, '{}'::jsonb),
      'candidateAllocations', v_allocations,
      'candidateAllocationTotal', v_allocation_total
    );
    v_metadata := jsonb_build_object(
      'source', 'supplier_batch_cost_v2',
      'correctionFingerprint', v_correction_fingerprint,
      'payloadFingerprint', v_fingerprint,
      'proposedPayload', coalesce(p_payload, '{}'::jsonb),
      'before', v_before,
      'after', v_after,
      'fingerprint', v_correction_fingerprint,
      'previewFingerprint', btrim(p_preview_fingerprint),
      'revision', btrim(p_revision),
      'actorEmail', nullif(auth.jwt() ->> 'email', ''),
      'candidateAllocations', v_allocations
    );
    insert into public.supplier_batch_charge_corrections (
      id, batch_id, original_charge_id, replacement_charge_id, status,
      correction_reason, finance_adjustment_required, idempotency_key,
      preview_fingerprint, revision, created_by, metadata
    ) values (
      v_correction_id, v_batch.id, v_original.id, null,
      'pending_finance_adjustment', btrim(p_correction_reason), true,
      btrim(p_idempotency_key), btrim(p_preview_fingerprint), btrim(p_revision),
      v_actor_id, v_metadata
    );
    insert into public.admin_audit_events (
      actor_id, actor_email, actor_role, action, entity_type, entity_id,
      before_data, after_data, reason, request_metadata
    ) values (
      v_actor_id, nullif(auth.jwt() ->> 'email', ''),
      (select private.current_profile_role()),
      'supplier_batch_charge.correction_pending_finance_adjustment_v2',
      'supplier_batch_charge', v_original.id::text, v_before, v_after,
      btrim(p_correction_reason), jsonb_build_object(
        'batch_code', v_batch.batch_code,
        'batch_id', v_batch.id,
        'original_charge_id', v_original.id,
        'replacement_charge_id', null,
        'correction_id', v_correction_id,
        'status', 'pending_finance_adjustment',
        'revision', btrim(p_revision),
        'preview_fingerprint', btrim(p_preview_fingerprint),
        'payload_fingerprint', v_fingerprint,
        'correction_fingerprint', v_correction_fingerprint,
        'finance_adjustment_required', true,
        'source', 'v2'
      )
    );
    return private.supplier_batch_correction_receipt_v2(
      'pending_finance_adjustment', v_correction_id, v_original.id, null,
      v_batch.batch_code, btrim(p_idempotency_key), btrim(p_preview_fingerprint),
      btrim(p_revision), true, null
    );
  end if;

  -- The unconsumed branch creates a confirmed replacement directly.  It never
  -- creates an estimated row, so normal estimate/cancel/confirm cannot claim
  -- or mutate this replacement later.
  v_correction_id := gen_random_uuid();
  insert into public.supplier_batch_charges (
    batch_id, charge_type, status, amount_net, vat_amount, capitalized_amount,
    currency, vat_treatment, allocation_method, carrier_name, reference,
    occurred_at, evidence_url, notes, zero_cost_reason, idempotency_key,
    payload_fingerprint, manual_allocations_snapshot, created_by, updated_by,
    confirmed_by, confirmed_at, base_currency, fx_rate_to_eur, fx_rate_date,
    fx_rate_source, fx_evidence_url, amount_net_eur, vat_amount_eur,
    amount_gross_eur, capitalized_amount_eur, metadata
  ) values (
    v_batch.id, v_terms.charge_type, 'confirmed', v_terms.amount_net,
    v_terms.vat_amount, v_terms.capitalized_amount, v_terms.currency,
    v_terms.vat_treatment, v_terms.allocation_method, v_terms.carrier_name,
    v_terms.charge_reference, v_terms.occurred_at, v_terms.evidence_url,
    v_terms.notes, v_terms.zero_cost_reason, btrim(p_idempotency_key),
    v_fingerprint, v_terms.manual_allocations, v_actor_id, v_actor_id,
    v_actor_id, now(), 'EUR', v_terms.fx_rate_to_eur, v_terms.fx_rate_date,
    v_terms.fx_rate_source, v_terms.fx_evidence_url,
    round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2),
    round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
    round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
      + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2),
    case when v_terms.capitalized_amount = v_terms.amount_gross
      then round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
        + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
      else least(
        round(v_terms.capitalized_amount * v_terms.fx_rate_to_eur, 2),
        round(v_terms.amount_net * v_terms.fx_rate_to_eur, 2)
          + round(v_terms.vat_amount * v_terms.fx_rate_to_eur, 2)
      )
    end,
    -- The replacement row is intentionally link-free.  Original/replacement
    -- relationships, correction state and sensitive proposal snapshots live
    -- only in the restricted correction table and its redacted history
    -- projection.  Charge metadata remains a generic, product-readable fact.
    jsonb_build_object('source', 'supplier_batch_cost_v2')
  ) returning * into v_replacement;

  insert into public.supplier_batch_charge_allocations (
    batch_id, charge_id, batch_line_id, qty_received_snapshot,
    goods_cost_snapshot, goods_cost_snapshot_eur, weight_gram_snapshot,
    basis_value, share_ratio, allocated_amount, allocated_amount_eur,
    allocated_unit_amount, allocated_unit_amount_eur, landed_line_cost,
    landed_line_cost_eur, landed_unit_cost, landed_unit_cost_eur,
    rounding_adjustment, rounding_adjustment_eur, metadata
  )
  select
    v_batch.id, v_replacement.id, allocation.batch_line_id,
    allocation.qty_received_snapshot, allocation.goods_cost_snapshot,
    allocation.goods_cost_snapshot_eur, allocation.weight_gram_snapshot,
    allocation.basis_value, allocation.share_ratio, allocation.allocated_amount,
    allocation.allocated_amount_eur, allocation.allocated_unit_amount,
    allocation.allocated_unit_amount_eur, allocation.landed_line_cost,
    allocation.landed_line_cost_eur, allocation.landed_unit_cost,
    allocation.landed_unit_cost_eur, allocation.rounding_adjustment,
    allocation.rounding_adjustment_eur,
    jsonb_build_object(
      'lineNo', allocation.line_no,
      'skuCode', allocation.sku_code,
      'allocationMethod', v_terms.allocation_method,
      'source', 'supplier_batch_cost_v2'
    )
  from private.calculate_supplier_batch_charge_allocations_v2(
    v_batch.id, v_terms.allocation_method, v_terms.capitalized_amount,
    v_terms.manual_allocations, v_terms.fx_rate_to_eur, v_goods_fx_rate,
    v_batch_currency, v_terms.currency, v_terms.amount_net,
    v_terms.vat_amount, v_terms.amount_gross
  ) as allocation;

  -- Insert the correction link before projecting the effective replacement;
  -- this makes line projections and the returned receipt agree at commit.
  v_metadata := jsonb_build_object(
    'source', 'supplier_batch_cost_v2',
    'correctionFingerprint', v_correction_fingerprint,
    'payloadFingerprint', v_fingerprint,
    'proposedPayload', coalesce(p_payload, '{}'::jsonb),
    'before', v_before,
    'after', null,
    'fingerprint', v_correction_fingerprint,
    'previewFingerprint', btrim(p_preview_fingerprint),
    'revision', btrim(p_revision),
    'actorEmail', nullif(auth.jwt() ->> 'email', '')
  );
  insert into public.supplier_batch_charge_corrections (
    id, batch_id, original_charge_id, replacement_charge_id, status,
    correction_reason, finance_adjustment_required, idempotency_key,
    preview_fingerprint, revision, created_by, metadata
  ) values (
    v_correction_id, v_batch.id, v_original.id, v_replacement.id, 'applied',
    btrim(p_correction_reason), false, btrim(p_idempotency_key),
    btrim(p_preview_fingerprint), btrim(p_revision), v_actor_id, v_metadata
  );

  v_replacement_result := private.supplier_batch_charge_result_v2(v_replacement.id);
  perform private.rebuild_supplier_batch_finance_layers_v2(
    v_batch.id, v_replacement.id, v_terms.allocation_method
  );
  v_receipt := private.supplier_batch_correction_receipt_v2(
    'corrected', v_correction_id, v_original.id, v_replacement.id,
    v_batch.batch_code, btrim(p_idempotency_key), btrim(p_preview_fingerprint),
    btrim(p_revision), false, v_replacement_result
  );
  v_after := v_receipt;
  update public.supplier_batch_charge_corrections
  set metadata = v_metadata || jsonb_build_object('after', v_after)
  where id = v_correction_id;

  insert into public.admin_audit_events (
    actor_id, actor_email, actor_role, action, entity_type, entity_id,
    before_data, after_data, reason, request_metadata
  ) values (
    v_actor_id, nullif(auth.jwt() ->> 'email', ''),
    (select private.current_profile_role()),
    'supplier_batch_charge.correction_applied_v2',
    'supplier_batch_charge', v_original.id::text, v_before, v_after,
    btrim(p_correction_reason), jsonb_build_object(
      'batch_code', v_batch.batch_code,
      'batch_id', v_batch.id,
      'original_charge_id', v_original.id,
      'replacement_charge_id', v_replacement.id,
      'correction_id', v_correction_id,
      'status', 'applied',
      'revision', btrim(p_revision),
      'preview_fingerprint', btrim(p_preview_fingerprint),
      'payload_fingerprint', v_fingerprint,
      'correction_fingerprint', v_correction_fingerprint,
      'finance_adjustment_required', false,
      'source', 'v2'
    )
  );
  return v_receipt;
end
$$;

create or replace function private.supplier_batch_charges_v2_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'confirmed' then
    raise exception 'Confirmed supplier batch charge facts are immutable; create a correction chain instead'
      using errcode = '55000', detail = 'CHARGE_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

-- Canonical allocation payload shared by preview, estimate and confirmation.
-- The relational calculator above is the only rounding implementation; this
-- helper merely serializes its result for the API contract.
create or replace function private.supplier_batch_v2_allocations_json(
  p_batch_id uuid,
  p_allocation_method text,
  p_capitalized_amount numeric,
  p_manual_allocations jsonb,
  p_charge_fx_rate numeric,
  p_goods_fx_rate numeric,
  p_batch_currency text,
  p_charge_currency text,
  p_amount_net numeric default null,
  p_vat_amount numeric default null,
  p_amount_gross numeric default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'batchLineId', allocation.batch_line_id,
      'lineNo', allocation.line_no,
      'skuCode', allocation.sku_code,
      'qtyReceivedSnapshot', allocation.qty_received_snapshot,
      'goodsCostSnapshot', allocation.goods_cost_snapshot,
      'goodsCostSnapshotEur', allocation.goods_cost_snapshot_eur,
      'weightGramSnapshot', allocation.weight_gram_snapshot,
      'basisValue', allocation.basis_value,
      'shareRatio', allocation.share_ratio,
      'allocatedAmount', allocation.allocated_amount,
      'allocatedAmountEur', allocation.allocated_amount_eur,
      'allocatedUnitAmount', allocation.allocated_unit_amount,
      'allocatedUnitAmountEur', allocation.allocated_unit_amount_eur,
      'landedLineCost', allocation.landed_line_cost,
      'landedLineCostEur', allocation.landed_line_cost_eur,
      'landedUnitCost', allocation.landed_unit_cost,
      'landedUnitCostEur', allocation.landed_unit_cost_eur,
      'roundingAdjustment', allocation.rounding_adjustment,
      'roundingAdjustmentEur', allocation.rounding_adjustment_eur,
      'originalCurrencyComparable', upper(coalesce(p_batch_currency, 'EUR')) = upper(coalesce(p_charge_currency, 'EUR')),
      'metadata', jsonb_build_object(
        'allocationMethod', p_allocation_method,
        'source', 'supplier_batch_cost_v2'
      )
    ) order by allocation.line_no, allocation.batch_line_id
  ), '[]'::jsonb)
  from private.calculate_supplier_batch_charge_allocations_v2(
    p_batch_id,
    p_allocation_method,
    p_capitalized_amount,
    p_manual_allocations,
    p_charge_fx_rate,
    p_goods_fx_rate,
    p_batch_currency,
    p_charge_currency,
    p_amount_net,
    p_vat_amount,
    p_amount_gross
  ) as allocation
$$;

create or replace function private.supplier_batch_v2_allocation_total(
  p_allocations jsonb,
  p_field text default 'allocatedAmount'
)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select round(coalesce(sum((item.value ->> p_field)::numeric), 0), 2)
  from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) as item(value)
$$;

-- Guard the narrowest target numeric(12,2) EUR finance columns before any multiplication or
-- insert/update.  Postgres numeric arithmetic itself can represent larger
-- values, but a target-column overflow must surface as a stable domain error
-- rather than a raw SQLSTATE 22003 from a later assignment.
create or replace function private.supplier_batch_v2_assert_eur_product(
  p_amount numeric,
  p_fx_rate numeric
)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_amount is null or p_fx_rate is null then
    return;
  end if;
  if p_amount < 0
     or p_fx_rate < 0.000001
     or p_fx_rate > 1000000
     or p_amount > 9999999999.99
     or p_amount * p_fx_rate > 9999999999.99 then
    raise exception 'Supplier batch EUR amount exceeds the V2 numeric range'
      using errcode = '22003', detail = 'SUPPLIER_BATCH_COST_OVERFLOW';
  end if;
end
$$;

create or replace function private.supplier_batch_v2_goods_value_eur(
  p_batch_id uuid,
  p_goods_fx_rate numeric
)
returns numeric
language plpgsql
stable
security invoker
  set search_path = ''
as $$
declare
  v_total_cost numeric;
begin
  select batch.total_cost
  into v_total_cost
  from public.supplier_batches as batch
  where batch.id = p_batch_id;
  perform private.supplier_batch_v2_assert_eur_product(v_total_cost, p_goods_fx_rate);
  return case
    when p_goods_fx_rate is null then null
    else round(v_total_cost * p_goods_fx_rate, 2)
  end;
end
$$;

-- Dedicated non-sensitive supplier-batch product hydration.  This RPC keeps
-- the legacy admin_get_supplier_batch_products compatibility function intact
-- while giving the V2 batch screens a contract that cannot return the three
-- catalog price columns.  Price-rule/quality flags are calculated inside the
-- SECURITY DEFINER body and only the boolean result crosses the RPC boundary.
create or replace function private.admin_get_supplier_batch_products_v2(
  p_sku_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codes text[] := coalesce(p_sku_codes, '{}'::text[]);
  v_input_count integer := coalesce(cardinality(v_codes), 0);
  v_is_service_role boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
begin
  if (select auth.uid()) is null and not v_is_service_role then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not v_is_service_role and not (
    (select private.partspro_has_permission('product.read_admin'))
    or (select private.partspro_has_permission('products.read_admin'))
  ) then
    raise exception 'Supplier batch product read permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;
  if v_input_count > 500 then
    raise exception 'Supplier batch product lookup accepts at most 500 codes'
      using errcode = '22023', detail = 'PRODUCT_LOOKUP_LIMIT_EXCEEDED';
  end if;
  if exists (
    select 1 from unnest(v_codes) as input(code)
    where nullif(btrim(input.code), '') is null
      or char_length(btrim(input.code)) > 128
  ) then
    raise exception 'Supplier batch product lookup codes must be non-empty and at most 128 characters'
      using errcode = '22023', detail = 'PRODUCT_LOOKUP_INVALID';
  end if;
  if v_input_count = 0 then
    return '[]'::jsonb;
  end if;

  return (
    with requested as (
      select distinct on (upper(btrim(input.code)))
        upper(btrim(input.code)) as lookup_code
      from unnest(v_codes) with ordinality as input(code, ordinal)
      order by upper(btrim(input.code)), input.ordinal
    ),
    normalized_requested as (
      select requested.lookup_code,
        upper(coalesce(nullif(btrim(regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(requested.lookup_code, '\mMOBILAX\M[[:space:]]*[-_]*', '', 'gi'),
              '[-_]{2,}', '-', 'g'
            ),
            '[[:space:]]{2,}', ' ', 'g'
          ),
          '^[[:space:]_-]+|[[:space:]_-]+$', '', 'g'
        )), ''), requested.lookup_code)) as public_sku
      from requested
    ),
    candidate_values as (
      select requested.lookup_code, candidate.value, candidate.priority
      from normalized_requested as requested
      cross join lateral (values
        (requested.lookup_code, 1),
        (requested.public_sku, 2),
        (case when requested.lookup_code !~* '^MOBILAX[-_[:space:]]'
          then 'MOBILAX-' || requested.public_sku end, 3)
      ) as candidate(value, priority)
      where nullif(btrim(candidate.value), '') is not null
    ),
    deduped_candidates as (
      select distinct on (lookup_code, value)
        lookup_code, value, priority
      from candidate_values
      order by lookup_code, value, priority
    ),
    matched as (
      select distinct on (candidate.lookup_code)
        candidate.lookup_code,
        product.sku_code,
        product.name,
        product.brand,
        product.model,
        product.model_codes,
        product.compatibility_models,
        product.category,
        product.quality_grade,
        product.weight_gram,
        product.stock_qty,
        product.stock_status,
        product.status,
        product.image_path,
        (product.retail_price > 0
          and product.b2b_price > 0
          and product.retail_price >= product.b2b_price) as price_rule_ok,
        (product.status = 'active' and nullif(btrim(product.image_path), '') is null)
          as active_missing_image,
        (product.stock_qty >= 0) as stock_snapshot_ok,
        candidate.priority
      from deduped_candidates as candidate
      join public.products as product on product.sku_code = candidate.value
      order by candidate.lookup_code, candidate.priority, product.sku_code
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'lookup_code', lookup_code,
      'sku_code', sku_code,
      'name', name,
      'brand', brand,
      'model', model,
      'model_codes', model_codes,
      'compatibility_models', compatibility_models,
      'category', category,
      'quality_grade', quality_grade,
      'weight_gram', weight_gram,
      'stock_qty', stock_qty,
      'stock_status', stock_status,
      'status', status,
      'image_path', image_path,
      'price_rule_ok', price_rule_ok,
      'active_missing_image', active_missing_image,
      'stock_snapshot_ok', stock_snapshot_ok
    ) order by lookup_code), '[]'::jsonb)
    from matched
  );
end
$$;

create or replace function public.admin_get_supplier_batch_products_v2(
  p_sku_codes text[]
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.admin_get_supplier_batch_products_v2(p_sku_codes)
$$;

revoke all on function private.admin_get_supplier_batch_products_v2(text[])
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_supplier_batch_products_v2(text[])
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_supplier_batch_products_v2(text[])
  to authenticated, service_role;

-- Product-read-only effective flags keep the base batch/detail projection from
-- enumerating the restricted correction table.  Relationship IDs remain
-- history-only; this RPC returns only the booleans needed to avoid counting an
-- applied original and its replacement together.
create or replace function private.admin_list_supplier_batch_charge_effective_flags_v2(
  p_charge_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[] := coalesce(p_charge_ids, '{}'::uuid[]);
  v_is_service_role boolean := coalesce((auth.jwt() ->> 'role') = 'service_role', false);
  v_result jsonb;
begin
  if (select auth.uid()) is null and not v_is_service_role then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not v_is_service_role and not (
    coalesce((select private.partspro_has_permission('product.read_admin')), false)
    or coalesce((select private.partspro_has_permission('products.read_admin')), false)
  ) then
    raise exception 'Product read permission required for supplier batch charge flags'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;
  if cardinality(v_ids) > 5000 then
    raise exception 'At most 5000 supplier batch charge ids may be resolved at once'
      using errcode = '22023', detail = 'BATCH_IDS_LIMIT_EXCEEDED';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'chargeId', charge.id,
    'effective', charge.status = 'confirmed'
      and not exists (
        select 1
        from public.supplier_batch_charge_corrections as correction
        where correction.original_charge_id = charge.id
          and correction.status = 'applied'
      ),
    'superseded', charge.status = 'confirmed'
      and exists (
        select 1
        from public.supplier_batch_charge_corrections as correction
        where correction.original_charge_id = charge.id
          and correction.status = 'applied'
      )
  ) order by charge.id), '[]'::jsonb)
  into v_result
  from public.supplier_batch_charges as charge
  join (
    select distinct value as charge_id
    from unnest(v_ids) as requested(value)
    where value is not null
  ) as requested on requested.charge_id = charge.id;

  return v_result;
end
$$;

create or replace function public.admin_list_supplier_batch_charge_effective_flags_v2(
  p_charge_ids uuid[]
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.admin_list_supplier_batch_charge_effective_flags_v2(p_charge_ids)
$$;

revoke all on function private.admin_list_supplier_batch_charge_effective_flags_v2(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.admin_list_supplier_batch_charge_effective_flags_v2(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.admin_list_supplier_batch_charge_effective_flags_v2(uuid[])
  to authenticated, service_role;

-- Bounded, stable history for the batch-cost screen. Sensitive audit payloads
-- remain behind the existing audit-table/RLS boundary; the parent release may
-- opt into the separately reviewed actor and before/after projection.
create or replace function public.admin_list_supplier_batch_cost_history_v2(
  p_batch_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_batch public.supplier_batches%rowtype;
  v_result jsonb;
begin
  if v_actor_id is null and not coalesce((auth.jwt() ->> 'role') = 'service_role', false) then
    raise exception 'Authentication required'
      using errcode = '28000', detail = 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    coalesce((auth.jwt() ->> 'role') = 'service_role', false)
    or (select private.partspro_has_permission('supplier_batch.read'))
  ) then
    raise exception 'Supplier batch read permission required'
      using errcode = '42501', detail = 'PERMISSION_DENIED';
  end if;

  select * into v_batch
  from public.supplier_batches as batch
  where batch.batch_code = btrim(coalesce(p_batch_code, ''))
  limit 1;
  if v_batch.id is null then
    raise exception 'Supplier batch not found: %', p_batch_code
      using errcode = 'P0002', detail = 'BATCH_NOT_FOUND';
  end if;

  select coalesce(jsonb_agg(row_data order by created_at desc, event_id desc), '[]'::jsonb)
  into v_result
  from (
    select
      event.id::text as event_id,
      event.created_at,
      jsonb_build_object(
        'eventId', event.id,
        'batchId', v_batch.id,
        'batchCode', v_batch.batch_code,
        'chargeId', nullif(event.entity_id, ''),
        'correctionId', nullif(event.request_metadata ->> 'correction_id', ''),
        'originalChargeId', coalesce(
          nullif(event.request_metadata ->> 'original_charge_id', ''),
          correction.original_charge_id::text,
          case
            when correction.id is null then nullif(event.entity_id, '')
            else null
          end
        ),
        'replacementChargeId', coalesce(
          nullif(event.request_metadata ->> 'replacement_charge_id', ''),
          correction.replacement_charge_id::text
        ),
        'linkedChargeId', coalesce(
          nullif(event.request_metadata ->> 'replacement_charge_id', ''),
          nullif(event.request_metadata ->> 'original_charge_id', ''),
          nullif(event.entity_id, '')
        ),
        'links', jsonb_build_object(
          'originalChargeId', coalesce(
            nullif(event.request_metadata ->> 'original_charge_id', ''),
            correction.original_charge_id::text,
            case
              when correction.id is null then nullif(event.entity_id, '')
              else null
            end
          ),
          'replacementChargeId', coalesce(
            nullif(event.request_metadata ->> 'replacement_charge_id', ''),
            correction.replacement_charge_id::text
          ),
          'correctionId', coalesce(
            nullif(event.request_metadata ->> 'correction_id', ''),
            correction.id::text
          )
        ),
        'eventType', event.action,
        'status', coalesce(
          nullif(event.request_metadata ->> 'status', ''),
          nullif(correction.status, ''),
          nullif(event.after_data ->> 'status', ''),
          'recorded'
        ),
        'reason', coalesce(event.reason, correction.correction_reason),
        'revision', nullif(event.request_metadata ->> 'revision', ''),
        'payloadFingerprint', coalesce(
          nullif(event.request_metadata ->> 'payload_fingerprint', ''),
          nullif(event.request_metadata ->> 'preview_fingerprint', ''),
          correction.preview_fingerprint
        ),
        'idempotencyKey', coalesce(
          nullif(event.request_metadata ->> 'idempotency_key', ''),
          correction.idempotency_key
        ),
        'createdAt', event.created_at,
        'metadata', jsonb_build_object(
          'source', coalesce(event.request_metadata ->> 'source', 'legacy'),
          'correctionReason', correction.correction_reason,
          'correctionStatus', correction.status,
          'originalChargeId', correction.original_charge_id,
          'replacementChargeId', correction.replacement_charge_id,
          'financeAdjustmentRequired',
            case
              when event.request_metadata ->> 'finance_adjustment_required' in ('true', 'false')
                then (event.request_metadata ->> 'finance_adjustment_required')::boolean
              else coalesce(correction.finance_adjustment_required, false)
            end
        )
      ) as row_data
    from public.admin_audit_events as event
    left join public.supplier_batch_charge_corrections as correction
      on correction.id::text = event.request_metadata ->> 'correction_id'
    where event.entity_type = 'supplier_batch_charge'
      and (
        event.request_metadata ->> 'batch_id' = v_batch.id::text
        or exists (
          select 1
          from public.supplier_batch_charges as charge
          where charge.id::text = event.entity_id
            and charge.batch_id = v_batch.id
        )
      )
    order by event.created_at desc, event.id desc
    limit 200
  ) as history;
  return v_result;
end
$$;

-- Audit snapshots are projected from an explicit allow-list.  Correction
-- metadata can contain a proposed payload and candidate allocations, so
-- neither that object nor a charge's raw metadata crosses the audit boundary.
create or replace function private.supplier_batch_cost_audit_projection_v2(
  p_value jsonb
)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_value is null or jsonb_typeof(p_value) <> 'object' then null
    else jsonb_build_object(
      'chargeId', coalesce(p_value -> 'chargeId', p_value -> 'originalChargeId'),
      'batchId', p_value -> 'batchId',
      'batchCode', p_value -> 'batchCode',
      'chargeType', p_value -> 'chargeType',
      'status', p_value -> 'status',
      'amountNet', p_value -> 'amountNet',
      'vatAmount', p_value -> 'vatAmount',
      'amountGross', p_value -> 'amountGross',
      'capitalizedAmount', p_value -> 'capitalizedAmount',
      'currency', p_value -> 'currency',
      'vatTreatment', p_value -> 'vatTreatment',
      'allocationMethod', p_value -> 'allocationMethod',
      'carrierName', p_value -> 'carrierName',
      'reference', p_value -> 'reference',
      'occurredAt', p_value -> 'occurredAt',
      'evidenceUrl', p_value -> 'evidenceUrl',
      'idempotencyKey', p_value -> 'idempotencyKey',
      'payloadFingerprint', coalesce(
        p_value -> 'payloadFingerprint', p_value -> 'previewFingerprint'
      ),
      'revision', p_value -> 'revision',
      'correctionId', p_value -> 'correctionId',
      'originalChargeId', p_value -> 'originalChargeId',
      'replacementChargeId', p_value -> 'replacementChargeId',
      'financeAdjustmentRequired', p_value -> 'financeAdjustmentRequired'
    )
  end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.supplier_batch_charges'::regclass
      and tgname = 'supplier_batch_charges_v2_immutable'
  ) then
    create trigger supplier_batch_charges_v2_immutable
      before update or delete on public.supplier_batch_charges
      for each row execute function private.supplier_batch_charges_v2_immutable();
  end if;
end
$$;

-- Batch goods FX is an accounting snapshot, not a caller-editable profile
-- field.  The trigger leaves ordinary supplier_batches updates intact, but
-- rejects direct authenticated/service-role edits to the new snapshot columns.
-- Only a SECURITY DEFINER function running as the table owner may perform the
-- one transition from the all-null legacy state to a complete snapshot.
create or replace function private.supplier_batch_v2_has_effective_confirmed_charge(
  p_batch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.supplier_batch_charges as charge
    where charge.batch_id = p_batch_id
      and charge.status = 'confirmed'
      and not exists (
        select 1
        from public.supplier_batch_charge_corrections as correction
        where correction.original_charge_id = charge.id
          and correction.status = 'applied'
      )
  )
$$;

create or replace function private.supplier_batches_v2_fx_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table_owner name;
  v_snapshot_exists boolean;
  v_core_changed boolean;
  v_fx_changed boolean;
  v_effective_confirmed_charge boolean;
begin
  v_snapshot_exists :=
    old.goods_value_eur is not null
    or old.goods_value_fx_rate_to_eur is not null
    or old.goods_value_fx_date is not null
    or old.goods_value_fx_source is not null
    or old.goods_value_fx_evidence_url is not null;
  v_core_changed :=
    new.currency is distinct from old.currency
    or new.total_cost is distinct from old.total_cost;
  v_fx_changed :=
    new.base_currency is distinct from old.base_currency
    or new.goods_value_eur is distinct from old.goods_value_eur
    or new.goods_value_fx_rate_to_eur is distinct from old.goods_value_fx_rate_to_eur
    or new.goods_value_fx_date is distinct from old.goods_value_fx_date
    or new.goods_value_fx_source is distinct from old.goods_value_fx_source
    or new.goods_value_fx_evidence_url is distinct from old.goods_value_fx_evidence_url;

  if v_core_changed then
    v_effective_confirmed_charge :=
      private.supplier_batch_v2_has_effective_confirmed_charge(old.id);
    if v_effective_confirmed_charge then
      raise exception 'Batch currency and goods value are immutable after an effective confirmed charge'
        using errcode = '55000', detail = 'SUPPLIER_BATCH_CONFIRMED_IMMUTABLE';
    end if;

    if v_snapshot_exists then
      raise exception 'Batch currency and goods value are immutable after the FX snapshot is written'
        using errcode = '55000', detail = 'BATCH_FX_SNAPSHOT_IMMUTABLE';
    end if;
  end if;

  if not v_fx_changed then
    return new;
  end if;

  select pg_get_userbyid(relowner)
  into v_table_owner
  from pg_catalog.pg_class
  where oid = 'public.supplier_batches'::regclass;
  if current_user <> v_table_owner then
    raise exception 'Batch FX snapshot is writable only by its SECURITY DEFINER owner'
      using errcode = '42501', detail = 'BATCH_FX_DIRECT_UPDATE_FORBIDDEN';
  end if;

  if v_snapshot_exists then
    raise exception 'Batch goods FX snapshot is immutable after first write'
      using errcode = '55000', detail = 'BATCH_FX_SNAPSHOT_IMMUTABLE';
  end if;
  if new.base_currency <> 'EUR'
     or new.goods_value_eur is null
     or new.goods_value_fx_rate_to_eur is null
     or new.goods_value_fx_rate_to_eur not between 0.000001 and 1000000
     or new.goods_value_fx_date is null
     or nullif(btrim(new.goods_value_fx_source), '') is null
     or new.goods_value_eur <> round(new.total_cost * new.goods_value_fx_rate_to_eur, 2) then
    raise exception 'Batch goods FX snapshot must be complete on first write'
      using errcode = '23514', detail = 'BATCH_FX_SNAPSHOT_INCOMPLETE';
  end if;
  if upper(coalesce(new.currency, 'EUR')) = 'EUR'
     and new.goods_value_fx_rate_to_eur <> 1 then
    raise exception 'EUR batch goods FX rate must be exactly 1'
      using errcode = '23514', detail = 'BATCH_FX_RATE_REQUIRED';
  end if;
  return new;
end
$$;

-- A received line's business identity and valuation inputs become immutable
-- once its batch has an effective confirmed charge. Non-financial metadata
-- such as images, status and notes remains editable. The trigger is a
-- SECURITY DEFINER read guard so a writer without supplier_batch.read cannot
-- bypass the invariant merely because charge rows are RLS-protected.
create or replace function private.supplier_batch_lines_v2_confirmed_freeze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.batch_id is distinct from old.batch_id
       or new.sku_code is distinct from old.sku_code
       or new.line_no is distinct from old.line_no
       or new.qty_received is distinct from old.qty_received
       or new.unit_cost is distinct from old.unit_cost
       or new.line_total is distinct from old.line_total
     )
     and exists (
       select 1
       from public.supplier_batch_charges as charge
       where charge.batch_id in (old.batch_id, new.batch_id)
         and charge.status = 'confirmed'
         and not exists (
           select 1
           from public.supplier_batch_charge_corrections as correction
           where correction.original_charge_id = charge.id
             and correction.status = 'applied'
         )
     ) then
    raise exception 'Supplier batch line business fields are immutable after an effective confirmed charge'
      using errcode = '55000', detail = 'SUPPLIER_BATCH_LINE_CONFIRMED_IMMUTABLE';
  end if;
  return new;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.supplier_batch_lines'::regclass
      and tgname = 'supplier_batch_lines_v2_confirmed_freeze'
  ) then
    create trigger supplier_batch_lines_v2_confirmed_freeze
      before update on public.supplier_batch_lines
      for each row execute function private.supplier_batch_lines_v2_confirmed_freeze();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.supplier_batches'::regclass
      and tgname = 'supplier_batches_v2_fx_guard'
  ) then
    create trigger supplier_batches_v2_fx_guard
      before update on public.supplier_batches
      for each row execute function private.supplier_batches_v2_fx_guard();
  end if;
end
$$;

-- No private helper is callable through PostgREST. Public RPCs are exposed
-- only to authenticated/service_role callers; each RPC repeats its own
-- authentication and business-permission checks.
revoke all on function private.admin_preview_supplier_batch_charge_v2_core(
  text, jsonb, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_enrich_allocations(
  jsonb, numeric, numeric, numeric, text, text, numeric, numeric, numeric
) from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_line_projection(
  uuid, jsonb, text, text, numeric, uuid
) from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_charge_result_v2(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_has_permission(text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.calculate_supplier_batch_charge_allocations_v2(
  uuid, text, numeric, jsonb, numeric, numeric, text, text, numeric, numeric, numeric
) from public, anon, authenticated, service_role;
revoke all on function private.parse_supplier_batch_charge_payload_v2(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_charge_fingerprint_v2(
  text, numeric, numeric, numeric, numeric, text, text, text, text, text,
  timestamptz, text, text, text, jsonb, jsonb, numeric, date, text, text,
  numeric, date, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_correction_fingerprint_v2(
  uuid, text, jsonb, text, text
) from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_correction_receipt_v2(
  text, uuid, uuid, uuid, text, text, text, text, boolean, jsonb
) from public, anon, authenticated, service_role;
revoke all on function private.rebuild_supplier_batch_finance_layers_v2(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_charges_v2_immutable()
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_allocations_json(
  uuid, text, numeric, jsonb, numeric, numeric, text, text, numeric, numeric, numeric
) from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_allocation_total(jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_goods_value_eur(uuid, numeric)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_assert_eur_product(numeric, numeric)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_assert_finance_totals(numeric, numeric, numeric)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_guard_cents(numeric, numeric)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_guard_unit(numeric)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batches_v2_fx_guard()
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_v2_has_effective_confirmed_charge(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_cost_audit_projection_v2(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.supplier_batch_lines_v2_confirmed_freeze()
  from public, anon, authenticated, service_role;
revoke all on function private.admin_get_supplier_batch_products_v2(text[])
  from public, anon, authenticated, service_role;
revoke all on function private.admin_list_supplier_batch_charge_effective_flags_v2(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_supplier_batch_products_v2(text[])
  from public, anon;

revoke all on function public.admin_list_supplier_batch_cost_summaries_v2(uuid[])
  from public, anon;
revoke all on function public.admin_list_supplier_batch_charge_effective_flags_v2(uuid[])
  from public, anon;
revoke all on function public.admin_preview_supplier_batch_charge_v2(text, jsonb)
  from public, anon;
revoke all on function public.admin_preview_supplier_batch_charge_correction_v2(text, jsonb)
  from public, anon;
revoke all on function public.admin_save_supplier_batch_charge_estimate_v2(text, jsonb, text)
  from public, anon;
revoke all on function public.admin_confirm_supplier_batch_charge_v2(text, jsonb, text, text, text)
  from public, anon;
revoke all on function public.admin_cancel_supplier_batch_charge_v2(text, uuid, text, text)
  from public, anon;
revoke all on function public.admin_correct_supplier_batch_charge_v2(
  text, uuid, jsonb, text, text, text, text
) from public, anon;
revoke all on function public.admin_list_supplier_batch_cost_history_v2(text)
  from public, anon;

grant execute on function public.admin_list_supplier_batch_cost_summaries_v2(uuid[])
  to authenticated, service_role;
grant execute on function public.admin_preview_supplier_batch_charge_v2(text, jsonb)
  to authenticated, service_role;
grant execute on function public.admin_preview_supplier_batch_charge_correction_v2(text, jsonb)
  to authenticated, service_role;
grant execute on function public.admin_save_supplier_batch_charge_estimate_v2(text, jsonb, text)
  to authenticated, service_role;
grant execute on function public.admin_confirm_supplier_batch_charge_v2(text, jsonb, text, text, text)
  to authenticated, service_role;
grant execute on function public.admin_cancel_supplier_batch_charge_v2(text, uuid, text, text)
  to authenticated, service_role;
grant execute on function public.admin_correct_supplier_batch_charge_v2(
  text, uuid, jsonb, text, text, text, text
) to authenticated, service_role;
grant execute on function public.admin_list_supplier_batch_cost_history_v2(text)
  to authenticated, service_role;

-- Stage 1 deliberately preserves the V1 estimate/confirm/cancel grants so an
-- older production client is not interrupted before the replacement app is
-- deployed.  A separately reviewed cleanup migration will revoke V1 confirm
-- after the new application smoke gate passes.
