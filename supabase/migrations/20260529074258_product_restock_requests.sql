create table if not exists public.product_restock_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sku_code text not null,
  product_name text not null,
  status text not null default 'active'
    check (status in ('active', 'notified', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  notified_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_restock_requests_sku_code_format
    check (sku_code = upper(sku_code) and sku_code ~ '^[A-Z0-9_+.-]{3,64}$')
);

create unique index if not exists product_restock_requests_user_sku_active_idx
  on public.product_restock_requests (user_id, sku_code)
  where status = 'active';

create index if not exists product_restock_requests_sku_status_idx
  on public.product_restock_requests (sku_code, status, created_at desc);

create index if not exists product_restock_requests_customer_status_idx
  on public.product_restock_requests (customer_id, status, created_at desc);

drop trigger if exists product_restock_requests_set_updated_at
  on public.product_restock_requests;
create trigger product_restock_requests_set_updated_at
  before update on public.product_restock_requests
  for each row execute function public.set_updated_at();

alter table public.product_restock_requests enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.product_restock_requests to authenticated;

drop policy if exists "partspro_product_restock_owner_select"
  on public.product_restock_requests;
create policy "partspro_product_restock_owner_select"
  on public.product_restock_requests
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and (
      user_id = (select auth.uid())
      or (select private.is_staff())
    )
  );

drop policy if exists "partspro_product_restock_owner_insert"
  on public.product_restock_requests;
create policy "partspro_product_restock_owner_insert"
  on public.product_restock_requests
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and status = 'active'
    and (
      customer_id is null
      or customer_id = (select private.current_customer_id())
      or exists (
        select 1
        from public.customer_memberships as cm
        where cm.customer_id = public.product_restock_requests.customer_id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
    )
  );

drop policy if exists "partspro_product_restock_staff_update"
  on public.product_restock_requests;
create policy "partspro_product_restock_staff_update"
  on public.product_restock_requests
  for update
  to authenticated
  using ((select private.is_staff()))
  with check ((select private.is_staff()));

comment on table public.product_restock_requests is
  'Per-user storefront restock reminders for out-of-stock PartsPro catalog SKUs.';
