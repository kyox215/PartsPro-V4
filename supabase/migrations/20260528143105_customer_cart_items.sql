create table if not exists public.customer_cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  sku_code text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_cart_items_user_sku_unique unique (user_id, sku_code),
  constraint customer_cart_items_sku_code_format
    check (sku_code = upper(sku_code) and sku_code ~ '^[A-Z0-9_+.-]{3,64}$')
);

create index if not exists customer_cart_items_user_updated_idx
  on public.customer_cart_items (user_id, updated_at desc);

create index if not exists customer_cart_items_customer_idx
  on public.customer_cart_items (customer_id);

drop trigger if exists customer_cart_items_set_updated_at
  on public.customer_cart_items;
create trigger customer_cart_items_set_updated_at
  before update on public.customer_cart_items
  for each row execute function public.set_updated_at();

alter table public.customer_cart_items enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.customer_cart_items to authenticated;

drop policy if exists "partspro_customer_cart_items_owner_select"
  on public.customer_cart_items;
create policy "partspro_customer_cart_items_owner_select"
  on public.customer_cart_items
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

drop policy if exists "partspro_customer_cart_items_owner_insert"
  on public.customer_cart_items;
create policy "partspro_customer_cart_items_owner_insert"
  on public.customer_cart_items
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and (
      customer_id is null
      or customer_id = (select private.current_customer_id())
      or exists (
        select 1
        from public.customer_memberships as cm
        where cm.customer_id = public.customer_cart_items.customer_id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
    )
  );

drop policy if exists "partspro_customer_cart_items_owner_update"
  on public.customer_cart_items;
create policy "partspro_customer_cart_items_owner_update"
  on public.customer_cart_items
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  )
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and (
      customer_id is null
      or customer_id = (select private.current_customer_id())
      or exists (
        select 1
        from public.customer_memberships as cm
        where cm.customer_id = public.customer_cart_items.customer_id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
    )
  );

drop policy if exists "partspro_customer_cart_items_owner_delete"
  on public.customer_cart_items;
create policy "partspro_customer_cart_items_owner_delete"
  on public.customer_cart_items
  for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

comment on table public.customer_cart_items is
  'Per-user persistent storefront cart for authenticated PartsPro customers.';
