create table if not exists public.customer_cart_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  cart_version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_cart_sync_state_customer_updated_idx
  on public.customer_cart_sync_state (customer_id, updated_at desc);

drop trigger if exists customer_cart_sync_state_set_updated_at
  on public.customer_cart_sync_state;
create trigger customer_cart_sync_state_set_updated_at
  before update on public.customer_cart_sync_state
  for each row execute function public.set_updated_at();

alter table public.customer_cart_sync_state enable row level security;
alter table public.customer_cart_sync_state replica identity full;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.customer_cart_sync_state to authenticated;

drop policy if exists "partspro_customer_cart_sync_state_owner_select"
  on public.customer_cart_sync_state;
create policy "partspro_customer_cart_sync_state_owner_select"
  on public.customer_cart_sync_state
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

drop policy if exists "partspro_customer_cart_sync_state_owner_insert"
  on public.customer_cart_sync_state;
create policy "partspro_customer_cart_sync_state_owner_insert"
  on public.customer_cart_sync_state
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
        where cm.customer_id = public.customer_cart_sync_state.customer_id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
    )
  );

drop policy if exists "partspro_customer_cart_sync_state_owner_update"
  on public.customer_cart_sync_state;
create policy "partspro_customer_cart_sync_state_owner_update"
  on public.customer_cart_sync_state
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
        where cm.customer_id = public.customer_cart_sync_state.customer_id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
    )
  );

drop policy if exists "partspro_customer_cart_sync_state_owner_delete"
  on public.customer_cart_sync_state;
create policy "partspro_customer_cart_sync_state_owner_delete"
  on public.customer_cart_sync_state
  for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
  );

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime
      add table public.customer_cart_sync_state;
  end if;
exception
  when duplicate_object then null;
end $$;

comment on table public.customer_cart_sync_state is
  'Per-user realtime sync marker for authenticated PartsPro carts.';
