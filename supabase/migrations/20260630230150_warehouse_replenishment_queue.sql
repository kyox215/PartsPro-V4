-- Warehouse replenishment queue for record-only restock planning.
-- This table stores decisions and stock/sales snapshots; it does not mutate
-- inventory quantities. Receiving remains handled by stock adjustments or
-- supplier-batch imports.

create table if not exists public.warehouse_replenishment_items (
  id uuid primary key default gen_random_uuid(),
  sku_code text not null,
  source text not null default 'sold_stock_shortage',
  status text not null default 'open'
    check (status in ('open', 'planned', 'ordered', 'received', 'ignored')),
  product_name text not null,
  supplier text,
  cost_price numeric(12, 2),
  moq integer not null default 1 check (moq >= 1),
  suggested_qty integer not null check (suggested_qty >= 0),
  planned_qty integer not null check (planned_qty >= 0),
  sold_qty integer not null default 0 check (sold_qty >= 0),
  order_count integer not null default 0 check (order_count >= 0),
  starting_available_qty integer not null default 0 check (starting_available_qty >= 0),
  available_qty integer not null default 0 check (available_qty >= 0),
  actual_qty integer not null default 0 check (actual_qty >= 0),
  locked_qty integer not null default 0 check (locked_qty >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 1),
  window_days integer not null default 30 check (window_days >= 1),
  shortage_type text not null check (shortage_type in ('out_of_stock', 'low_stock')),
  last_sold_at timestamptz,
  note text,
  snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouse_replenishment_items_sku_not_blank
    check (nullif(btrim(sku_code), '') is not null),
  constraint warehouse_replenishment_items_product_name_not_blank
    check (nullif(btrim(product_name), '') is not null)
);

create index if not exists warehouse_replenishment_items_status_updated_idx
  on public.warehouse_replenishment_items (status, updated_at desc);

create index if not exists warehouse_replenishment_items_supplier_status_idx
  on public.warehouse_replenishment_items (supplier, status, updated_at desc);

create index if not exists warehouse_replenishment_items_sku_updated_idx
  on public.warehouse_replenishment_items (sku_code, updated_at desc);

create unique index if not exists warehouse_replenishment_items_active_sku_idx
  on public.warehouse_replenishment_items (upper(sku_code), source)
  where status in ('open', 'planned', 'ordered');

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'warehouse_replenishment_items_set_updated_at'
  ) then
    create trigger warehouse_replenishment_items_set_updated_at
      before update on public.warehouse_replenishment_items
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.warehouse_replenishment_items enable row level security;

grant select, insert, update on public.warehouse_replenishment_items to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'warehouse_replenishment_items'
      and policyname = 'partspro_warehouse_replenishment_staff_read'
  ) then
    create policy "partspro_warehouse_replenishment_staff_read"
      on public.warehouse_replenishment_items
      for select
      to authenticated
      using (
        (select private.partspro_has_permission('panel.inventory'))
        or (select private.partspro_has_permission('inventory.manage'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'warehouse_replenishment_items'
      and policyname = 'partspro_warehouse_replenishment_staff_insert'
  ) then
    create policy "partspro_warehouse_replenishment_staff_insert"
      on public.warehouse_replenishment_items
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('inventory.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'warehouse_replenishment_items'
      and policyname = 'partspro_warehouse_replenishment_staff_update'
  ) then
    create policy "partspro_warehouse_replenishment_staff_update"
      on public.warehouse_replenishment_items
      for update
      to authenticated
      using ((select private.partspro_has_permission('inventory.manage')))
      with check ((select private.partspro_has_permission('inventory.manage')));
  end if;
end $$;
