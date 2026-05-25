-- PartsPro v4 baseline schema for an empty Supabase project.
-- Created after `supabase migration new baseline_empty_public_schema`, then
-- reordered before the hardening migration so a blank linked project can boot.

create extension if not exists "pgcrypto";

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.price_groups (
  id text primary key,
  name text not null,
  description text,
  discount_percent numeric(6, 2) not null default 0 check (discount_percent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  company_name text not null,
  contact_name text,
  email text,
  vat_number text,
  fiscal_code text,
  sdi text,
  pec text,
  phone text,
  registered_address text,
  billing_address text,
  shipping_address text,
  tier text not null default 'standard',
  price_group_id text references public.price_groups(id) on update cascade,
  status text not null default 'pending' check (status in ('active', 'pending', 'suspended')),
  monthly_purchase text,
  orders_count integer not null default 0 check (orders_count >= 0),
  revenue numeric(12, 2) not null default 0 check (revenue >= 0),
  credit_limit numeric(12, 2) not null default 0 check (credit_limit >= 0),
  payment_terms text,
  profile_completed_at timestamptz,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_id_user_id_key unique (id, user_id)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  customer_id uuid constraint profiles_customer_id_fkey references public.customers(id) on delete set null,
  email text,
  role text not null default 'customer' check (role in ('customer', 'sales', 'warehouse', 'purchasing', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku_code text not null unique,
  name text not null,
  brand text not null default 'PartsPro',
  model text,
  model_code text,
  model_codes text[] not null default '{}'::text[],
  category text not null,
  quality_grade text not null default 'A' check (quality_grade in ('A+', 'A', 'B', 'Refurbished')),
  color text,
  frame text,
  stock_status text not null default 'incoming' check (stock_status in ('in_stock', 'low_stock', 'out_of_stock', 'incoming')),
  moq integer not null default 1 check (moq > 0),
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  retail_price numeric(12, 2) not null default 0 check (retail_price >= 0),
  b2b_price numeric(12, 2) not null default 0 check (b2b_price >= 0),
  vat_mode text not null default 'IVA esclusa',
  warranty_days integer not null default 180 check (warranty_days >= 0),
  weight_gram integer not null default 0 check (weight_gram >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  location text,
  batch_code text,
  supplier text,
  is_battery boolean not null default false,
  is_dangerous_goods boolean not null default false,
  msds_url text,
  un38_url text,
  compatibility jsonb not null default '[]'::jsonb check (jsonb_typeof(compatibility) = 'array'),
  compatibility_models text[] not null default '{}'::text[],
  alternative_skus text[] not null default '{}'::text[],
  add_on_skus text[] not null default '{}'::text[],
  highlights text[] not null default '{}'::text[],
  tier_prices jsonb not null default '[]'::jsonb check (jsonb_typeof(tier_prices) = 'array'),
  status text not null default 'active' check (status in ('active', 'draft', 'hidden', 'blocked')),
  image_path text,
  image_alt text,
  gallery_image_paths text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  sku_code text not null references public.products(sku_code) on update cascade on delete cascade,
  product_name text not null,
  brand text,
  model text,
  quality_grade text,
  batch_code text,
  location text,
  actual_qty integer not null default 0 check (actual_qty >= 0),
  locked_qty integer not null default 0 check (locked_qty >= 0),
  available_qty integer not null default 0 check (available_qty >= 0),
  incoming_qty integer not null default 0 check (incoming_qty >= 0),
  qc_qty integer not null default 0 check (qc_qty >= 0),
  rma_qty integer not null default 0 check (rma_qty >= 0),
  defective_qty integer not null default 0 check (defective_qty >= 0),
  supplier text,
  last_movement_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_tier text not null default 'standard',
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'picking', 'packed', 'shipped', 'completed', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'bank_waiting', 'failed')),
  stock_risk text not null default 'clear' check (stock_risk in ('clear', 'low', 'split', 'blocked')),
  total_net numeric(12, 2) not null default 0,
  vat numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  shipping_method text,
  fiscal jsonb not null default '{}'::jsonb check (jsonb_typeof(fiscal) = 'object'),
  delivery_address text,
  customer_note text,
  staff_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partspro_orders_amounts_nonnegative check (total_net >= 0 and vat >= 0 and shipping >= 0)
);

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sku_code text not null references public.products(sku_code) on update cascade,
  product_name text not null,
  quality_grade text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null default 0,
  stock_status text not null default 'available',
  batch_code text,
  location text,
  constraint partspro_order_lines_unit_price_nonnegative check (unit_price >= 0)
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.rma_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_no text,
  sku_code text references public.products(sku_code) on update cascade,
  order_line_id uuid references public.order_lines(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'submitted',
  problem_type text,
  description text,
  evidence_urls text[] not null default '{}'::text[],
  attachments jsonb not null default '[]'::jsonb,
  tested_before_install boolean not null default false,
  installed boolean not null default false,
  has_physical_damage boolean not null default false,
  requested_resolution text not null default 'replacement' check (requested_resolution in ('replacement', 'refund', 'credit_note')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partspro_rma_status_check check (status in ('submitted', 'under_review', 'approved', 'rejected', 'received', 'replacement_sent', 'refunded', 'closed')),
  constraint partspro_rma_attachments_array_check check (jsonb_typeof(attachments) = 'array')
);

create table if not exists public.b2b_applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  whatsapp text,
  vat_number text not null,
  fiscal_code text not null,
  sdi text,
  pec text,
  company_type text,
  registered_address text,
  shipping_address text,
  monthly_purchase text,
  interested_categories text[] not null default '{}'::text[],
  payment_needs text[] not null default '{}'::text[],
  requested_price_group_id text references public.price_groups(id) on update cascade,
  approved_customer_id uuid constraint b2b_applications_approved_customer_id_fkey references public.customers(id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  review_note text,
  accepts_terms boolean not null default false,
  accepts_privacy boolean not null default false,
  accepts_marketing boolean not null default false,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_customer_user_match_fkey'
  ) then
    alter table public.orders
      add constraint orders_customer_user_match_fkey
      foreign key (customer_id, user_id)
      references public.customers(id, user_id);
  end if;
end $$;

create index if not exists profiles_customer_id_idx on public.profiles(customer_id);
create index if not exists customers_user_id_idx on public.customers(user_id) where user_id is not null;
create unique index if not exists customers_user_id_unique_idx on public.customers(user_id) where user_id is not null;
create index if not exists customers_status_idx on public.customers(status);
create index if not exists products_sku_status_idx on public.products(sku_code, status);
create index if not exists products_category_status_idx on public.products(category, status);
create index if not exists inventory_items_sku_code_idx on public.inventory_items(sku_code);
create index if not exists orders_customer_created_idx on public.orders(customer_id, created_at desc);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists order_lines_order_id_idx on public.order_lines(order_id);
create index if not exists order_lines_sku_code_idx on public.order_lines(sku_code);
create index if not exists order_events_order_created_idx on public.order_events(order_id, created_at desc);
create index if not exists rma_requests_order_line_status_idx on public.rma_requests(order_line_id, status);
create index if not exists rma_requests_user_created_idx on public.rma_requests(user_id, created_at desc);
create index if not exists b2b_applications_status_submitted_idx on public.b2b_applications(status, submitted_at desc);
create index if not exists b2b_applications_approved_customer_id_idx on public.b2b_applications(approved_customer_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'price_groups_set_updated_at') then
    create trigger price_groups_set_updated_at
      before update on public.price_groups
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'customers_set_updated_at') then
    create trigger customers_set_updated_at
      before update on public.customers
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'profiles_set_updated_at') then
    create trigger profiles_set_updated_at
      before update on public.profiles
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'products_set_updated_at') then
    create trigger products_set_updated_at
      before update on public.products
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'orders_set_updated_at') then
    create trigger orders_set_updated_at
      before update on public.orders
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'rma_requests_set_updated_at') then
    create trigger rma_requests_set_updated_at
      before update on public.rma_requests
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'b2b_applications_set_updated_at') then
    create trigger b2b_applications_set_updated_at
      before update on public.b2b_applications
      for each row execute function public.set_updated_at();
  end if;
end $$;

create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
  limit 1
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select private.current_profile_role()) in ('sales', 'warehouse', 'purchasing', 'admin'),
    false
  )
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.current_profile_role()) = 'admin', false)
$$;

create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select p.customer_id
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.customer_id is not null
      limit 1
    ),
    (
      select c.id
      from public.customers as c
      where c.user_id = (select auth.uid())
      order by c.created_at desc
      limit 1
    )
  )
$$;

create or replace function private.current_customer_status()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.status
  from public.customers as c
  where c.id = (select private.current_customer_id())
  limit 1
$$;

create or replace function private.can_view_b2b_prices()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.is_staff()), false)
    or coalesce((select private.current_customer_status()) = 'active', false)
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'customer')
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'partspro_auth_user_profile'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger partspro_auth_user_profile
      after insert on auth.users
      for each row execute function private.handle_new_user();
  end if;
end $$;

grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_customer_id() to authenticated;
grant execute on function private.current_customer_status() to authenticated;
grant execute on function private.can_view_b2b_prices() to authenticated;

alter table public.price_groups enable row level security;
alter table public.customers enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.order_events enable row level security;
alter table public.rma_requests enable row level security;
alter table public.b2b_applications enable row level security;

grant usage on schema public to anon, authenticated;

grant select on public.price_groups to authenticated;
grant select (
  id,
  sku_code,
  name,
  brand,
  model,
  model_code,
  model_codes,
  category,
  quality_grade,
  color,
  frame,
  stock_status,
  stock_qty,
  location,
  moq,
  vat_mode,
  warranty_days,
  weight_gram,
  is_battery,
  is_dangerous_goods,
  msds_url,
  un38_url,
  compatibility,
  compatibility_models,
  alternative_skus,
  add_on_skus,
  highlights,
  status,
  created_at,
  updated_at,
  image_path,
  image_alt,
  gallery_image_paths
) on public.products to anon, authenticated;
grant select on public.inventory_items to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.order_lines to authenticated;
grant select, insert on public.order_events to authenticated;
grant select, insert, update on public.rma_requests to authenticated;
grant insert on public.b2b_applications to anon, authenticated;
grant select, update on public.b2b_applications to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'price_groups' and policyname = 'partspro_price_groups_staff_read') then
    create policy "partspro_price_groups_staff_read"
      on public.price_groups
      for select
      to authenticated
      using ((select private.is_staff()) or (select private.current_customer_id()) is not null);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'partspro_products_public_active_read') then
    create policy "partspro_products_public_active_read"
      on public.products
      for select
      to anon
      using (status = 'active');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'partspro_products_authenticated_read') then
    create policy "partspro_products_authenticated_read"
      on public.products
      for select
      to authenticated
      using (status = 'active' or (select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'partspro_products_staff_write') then
    create policy "partspro_products_staff_write"
      on public.products
      for all
      to authenticated
      using ((select private.is_staff()))
      with check ((select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_items' and policyname = 'partspro_inventory_staff_read') then
    create policy "partspro_inventory_staff_read"
      on public.inventory_items
      for select
      to authenticated
      using ((select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'inventory_items' and policyname = 'partspro_inventory_staff_write') then
    create policy "partspro_inventory_staff_write"
      on public.inventory_items
      for all
      to authenticated
      using ((select private.is_staff()))
      with check ((select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'partspro_profiles_self_or_staff_read') then
    create policy "partspro_profiles_self_or_staff_read"
      on public.profiles
      for select
      to authenticated
      using (id = (select auth.uid()) or (select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'partspro_profiles_self_update') then
    create policy "partspro_profiles_self_update"
      on public.profiles
      for update
      to authenticated
      using (id = (select auth.uid()) or (select private.is_admin()))
      with check (
        (id = (select auth.uid()) and role = (select private.current_profile_role()))
        or (select private.is_admin())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'partspro_customers_self_or_staff_read') then
    create policy "partspro_customers_self_or_staff_read"
      on public.customers
      for select
      to authenticated
      using (user_id = (select auth.uid()) or id = (select private.current_customer_id()) or (select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'partspro_customers_self_create') then
    create policy "partspro_customers_self_create"
      on public.customers
      for insert
      to authenticated
      with check (
        (user_id = (select auth.uid()) and status = 'pending')
        or (select private.is_staff())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'partspro_customers_self_or_staff_update') then
    create policy "partspro_customers_self_or_staff_update"
      on public.customers
      for update
      to authenticated
      using (user_id = (select auth.uid()) or (select private.is_staff()))
      with check (
        (user_id = (select auth.uid()) and status in ('pending', 'active'))
        or (select private.is_staff())
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'partspro_orders_self_or_staff_read') then
    create policy "partspro_orders_self_or_staff_read"
      on public.orders
      for select
      to authenticated
      using (user_id = (select auth.uid()) or customer_id = (select private.current_customer_id()) or (select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'partspro_orders_staff_update') then
    create policy "partspro_orders_staff_update"
      on public.orders
      for update
      to authenticated
      using ((select private.is_staff()))
      with check ((select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_lines' and policyname = 'partspro_order_lines_self_or_staff_read') then
    create policy "partspro_order_lines_self_or_staff_read"
      on public.order_lines
      for select
      to authenticated
      using (
        (select private.is_staff())
        or exists (
          select 1
          from public.orders as o
          where o.id = order_lines.order_id
            and (o.user_id = (select auth.uid()) or o.customer_id = (select private.current_customer_id()))
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_lines' and policyname = 'partspro_order_lines_staff_update') then
    create policy "partspro_order_lines_staff_update"
      on public.order_lines
      for update
      to authenticated
      using ((select private.is_staff()))
      with check ((select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_events' and policyname = 'partspro_order_events_self_or_staff_read') then
    create policy "partspro_order_events_self_or_staff_read"
      on public.order_events
      for select
      to authenticated
      using (
        (select private.is_staff())
        or exists (
          select 1
          from public.orders as o
          where o.id = order_events.order_id
            and (o.user_id = (select auth.uid()) or o.customer_id = (select private.current_customer_id()))
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'order_events' and policyname = 'partspro_order_events_staff_insert') then
    create policy "partspro_order_events_staff_insert"
      on public.order_events
      for insert
      to authenticated
      with check ((select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rma_requests' and policyname = 'partspro_rma_self_or_staff_read') then
    create policy "partspro_rma_self_or_staff_read"
      on public.rma_requests
      for select
      to authenticated
      using (user_id = (select auth.uid()) or (select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rma_requests' and policyname = 'partspro_rma_self_submit') then
    create policy "partspro_rma_self_submit"
      on public.rma_requests
      for insert
      to authenticated
      with check (
        (select private.is_staff())
        or (
          user_id = (select auth.uid())
          and status = 'submitted'
          and exists (
            select 1
            from public.order_lines as ol
            join public.orders as o on o.id = ol.order_id
            where ol.id = rma_requests.order_line_id
              and o.user_id = (select auth.uid())
              and rma_requests.quantity <= ol.quantity
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rma_requests' and policyname = 'partspro_rma_staff_update') then
    create policy "partspro_rma_staff_update"
      on public.rma_requests
      for update
      to authenticated
      using ((select private.is_staff()))
      with check ((select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'b2b_applications' and policyname = 'partspro_b2b_public_submit') then
    create policy "partspro_b2b_public_submit"
      on public.b2b_applications
      for insert
      to anon, authenticated
      with check (
        status = 'submitted'
        and accepts_terms = true
        and accepts_privacy = true
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'b2b_applications' and policyname = 'partspro_b2b_staff_read') then
    create policy "partspro_b2b_staff_read"
      on public.b2b_applications
      for select
      to authenticated
      using ((select private.is_staff()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'b2b_applications' and policyname = 'partspro_b2b_staff_update') then
    create policy "partspro_b2b_staff_update"
      on public.b2b_applications
      for update
      to authenticated
      using ((select private.is_staff()))
      with check ((select private.is_staff()));
  end if;
end $$;
