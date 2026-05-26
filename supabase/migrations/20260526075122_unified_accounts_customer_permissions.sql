-- Unified account/customer management, customer-level pricing, and admin permissions.

create extension if not exists "pgcrypto";
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

alter table public.profiles
  add column if not exists account_type text not null default 'customer',
  add column if not exists auth_provider text not null default 'password',
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists role_template text;

alter table public.customers
  add column if not exists customer_type text not null default 'retail',
  add column if not exists assignment_status text not null default 'needs_review',
  add column if not exists level text not null default 'bronze',
  add column if not exists lifetime_spend_net numeric(12, 2) not null default 0,
  add column if not exists assigned_by uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists converted_to_employee_at timestamptz;

do $$
begin
  alter table public.profiles drop constraint if exists profiles_account_type_check;
  alter table public.profiles
    add constraint profiles_account_type_check
    check (account_type in ('customer', 'employee'));

  alter table public.customers drop constraint if exists customers_customer_type_check;
  alter table public.customers
    add constraint customers_customer_type_check
    check (customer_type in ('retail', 'wholesale'));

  alter table public.customers drop constraint if exists customers_assignment_status_check;
  alter table public.customers
    add constraint customers_assignment_status_check
    check (assignment_status in ('needs_review', 'assigned', 'converted_to_employee', 'archived'));

  alter table public.customers drop constraint if exists customers_level_check;
  alter table public.customers
    add constraint customers_level_check
    check (level in ('bronze', 'silver', 'gold', 'emerald', 'diamond', 'master', 'king'));
end $$;

update public.customers
set
  customer_type = case when status = 'active' then 'wholesale' else customer_type end,
  assignment_status = case when status = 'active' then 'assigned' else assignment_status end,
  level = case
    when tier in ('bronze', 'silver', 'gold', 'emerald', 'diamond', 'master', 'king') then tier
    when lower(tier) in ('partner', 'gold') then 'gold'
    when lower(tier) in ('pro', 'silver') then 'silver'
    else 'bronze'
  end,
  tier = case
    when tier in ('bronze', 'silver', 'gold', 'emerald', 'diamond', 'master', 'king') then tier
    when lower(tier) in ('partner', 'gold') then 'gold'
    when lower(tier) in ('pro', 'silver') then 'silver'
    else 'bronze'
  end
where true;

create table if not exists public.admin_permissions (
  id text primary key,
  label text not null,
  group_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_role_templates (
  id text primary key,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_role_template_permissions (
  role_template_id text not null references public.admin_role_templates(id) on delete cascade,
  permission_id text not null references public.admin_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_template_id, permission_id)
);

create table if not exists public.admin_user_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_id text not null references public.admin_permissions(id) on delete cascade,
  effect text not null check (effect in ('grant', 'deny')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);

alter table public.admin_permissions enable row level security;
alter table public.admin_role_templates enable row level security;
alter table public.admin_role_template_permissions enable row level security;
alter table public.admin_user_permission_overrides enable row level security;

grant select on public.admin_permissions to authenticated;
grant select on public.admin_role_templates to authenticated;
grant select on public.admin_role_template_permissions to authenticated;
grant select, insert, update, delete on public.admin_user_permission_overrides to authenticated;

insert into public.admin_permissions (id, label, group_name, description)
values
  ('panel.orders', 'Orders panel', 'panel', 'Can open the admin orders panel.'),
  ('panel.customers', 'Customers panel', 'panel', 'Can open unified customer management.'),
  ('panel.catalog', 'Catalog panel', 'panel', 'Can open the admin catalog panel.'),
  ('panel.inventory', 'Inventory panel', 'panel', 'Can open inventory operations.'),
  ('panel.settings', 'Settings panel', 'panel', 'Can open admin settings and permissions.'),
  ('customers.read', 'Read customers', 'customers', 'Can read customer and account records.'),
  ('customers.manage', 'Manage customers', 'customers', 'Can edit customer profiles.'),
  ('customers.classify', 'Classify customers', 'customers', 'Can assign retail/wholesale/customer/employee type.'),
  ('employees.read', 'Read employees', 'employees', 'Can read employee accounts.'),
  ('employees.manage_permissions', 'Manage employee permissions', 'employees', 'Can assign employee role templates and permission overrides.'),
  ('orders.read', 'Read orders', 'orders', 'Can read admin orders.'),
  ('orders.manage', 'Manage orders', 'orders', 'Can update order operations and status.'),
  ('products.read_admin', 'Read admin products', 'products', 'Can read admin catalog data.'),
  ('products.manage', 'Manage products', 'products', 'Can create and edit product content.'),
  ('products.pricing', 'Manage pricing', 'products', 'Can edit retail, wholesale, and cost prices.'),
  ('inventory.manage', 'Manage inventory', 'inventory', 'Can adjust inventory and stock.')
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_templates (id, label, description)
values
  ('admin', 'Administrator', 'Full access to all admin panels and operations.'),
  ('sales', 'Sales', 'Customer and order operations without settings access.'),
  ('sales_support', 'Sales support', 'Read customer, product, and order information.'),
  ('catalog_manager', 'Catalog manager', 'Product catalog content management.'),
  ('pricing_manager', 'Pricing manager', 'Product pricing management.'),
  ('inventory_manager', 'Inventory manager', 'Inventory operations.'),
  ('warehouse', 'Warehouse', 'Warehouse and stock operations.'),
  ('purchasing', 'Purchasing', 'Catalog and purchasing support.'),
  ('auditor', 'Auditor', 'Read-only administrative access.')
on conflict (id) do update
set label = excluded.label,
    description = excluded.description,
    updated_at = now();

insert into public.admin_role_template_permissions (role_template_id, permission_id)
select 'admin', id from public.admin_permissions
on conflict do nothing;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('sales', 'panel.orders'),
  ('sales', 'panel.customers'),
  ('sales', 'orders.read'),
  ('sales', 'orders.manage'),
  ('sales', 'customers.read'),
  ('sales', 'customers.manage'),
  ('sales', 'customers.classify'),
  ('sales', 'employees.read'),
  ('sales_support', 'panel.orders'),
  ('sales_support', 'panel.customers'),
  ('sales_support', 'panel.catalog'),
  ('sales_support', 'orders.read'),
  ('sales_support', 'customers.read'),
  ('sales_support', 'employees.read'),
  ('sales_support', 'products.read_admin'),
  ('catalog_manager', 'panel.catalog'),
  ('catalog_manager', 'products.read_admin'),
  ('catalog_manager', 'products.manage'),
  ('pricing_manager', 'panel.catalog'),
  ('pricing_manager', 'products.read_admin'),
  ('pricing_manager', 'products.pricing'),
  ('inventory_manager', 'panel.catalog'),
  ('inventory_manager', 'panel.inventory'),
  ('inventory_manager', 'products.read_admin'),
  ('inventory_manager', 'inventory.manage'),
  ('warehouse', 'panel.inventory'),
  ('warehouse', 'products.read_admin'),
  ('warehouse', 'inventory.manage'),
  ('purchasing', 'panel.catalog'),
  ('purchasing', 'products.read_admin'),
  ('purchasing', 'products.manage'),
  ('auditor', 'panel.orders'),
  ('auditor', 'panel.customers'),
  ('auditor', 'panel.catalog'),
  ('auditor', 'orders.read'),
  ('auditor', 'customers.read'),
  ('auditor', 'employees.read'),
  ('auditor', 'products.read_admin')
on conflict do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_permissions'
      and policyname = 'partspro_admin_permissions_staff_read'
  ) then
    create policy "partspro_admin_permissions_staff_read"
      on public.admin_permissions
      for select
      to authenticated
      using ((select private.is_staff()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_role_templates'
      and policyname = 'partspro_admin_role_templates_staff_read'
  ) then
    create policy "partspro_admin_role_templates_staff_read"
      on public.admin_role_templates
      for select
      to authenticated
      using ((select private.is_staff()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_role_template_permissions'
      and policyname = 'partspro_admin_role_template_permissions_staff_read'
  ) then
    create policy "partspro_admin_role_template_permissions_staff_read"
      on public.admin_role_template_permissions
      for select
      to authenticated
      using ((select private.is_staff()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_user_permission_overrides'
      and policyname = 'partspro_admin_user_permission_overrides_staff_read'
  ) then
    create policy "partspro_admin_user_permission_overrides_staff_read"
      on public.admin_user_permission_overrides
      for select
      to authenticated
      using ((select private.is_staff()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_user_permission_overrides'
      and policyname = 'partspro_admin_user_permission_overrides_admin_write'
  ) then
    create policy "partspro_admin_user_permission_overrides_admin_write"
      on public.admin_user_permission_overrides
      for all
      to authenticated
      using ((select private.partspro_has_permission('employees.manage_permissions')))
      with check ((select private.partspro_has_permission('employees.manage_permissions')));
  end if;
end $$;

create or replace function private.customer_level_for_spend(_spend numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(_spend, 0) >= 50000 then 'king'
    when coalesce(_spend, 0) >= 40200 then 'master'
    when coalesce(_spend, 0) >= 30400 then 'diamond'
    when coalesce(_spend, 0) >= 20600 then 'emerald'
    when coalesce(_spend, 0) >= 10800 then 'gold'
    when coalesce(_spend, 0) >= 1000 then 'silver'
    else 'bronze'
  end
$$;

create or replace function private.customer_level_discount(_level text)
returns numeric
language sql
immutable
as $$
  select case _level
    when 'king' then 0.12
    when 'master' then 0.10
    when 'diamond' then 0.08
    when 'emerald' then 0.06
    when 'gold' then 0.04
    when 'silver' then 0.02
    else 0
  end
$$;

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
    (select p.account_type = 'employee' from public.profiles as p where p.id = (select auth.uid()) limit 1)
    or (select private.current_profile_role()) in (
      'sales',
      'warehouse',
      'purchasing',
      'admin',
      'catalog_manager',
      'pricing_manager',
      'inventory_manager',
      'sales_support',
      'auditor'
    ),
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

create or replace function private.partspro_effective_permissions(_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with profile as (
    select
      p.id,
      coalesce(nullif(p.role_template, ''), nullif(p.role, ''), 'customer') as template_id,
      p.role
    from public.profiles as p
    where p.id = _user_id
    limit 1
  ),
  base_permissions as (
    select arp.permission_id
    from profile as p
    join public.admin_role_template_permissions as arp
      on arp.role_template_id = p.template_id
    union
    select ap.id
    from profile as p
    cross join public.admin_permissions as ap
    where p.role = 'admin'
  ),
  denied as (
    select permission_id
    from public.admin_user_permission_overrides
    where user_id = _user_id
      and effect = 'deny'
  ),
  granted as (
    select permission_id
    from public.admin_user_permission_overrides
    where user_id = _user_id
      and effect = 'grant'
  )
  select coalesce(array_agg(permission_id order by permission_id), '{}'::text[])
  from (
    select permission_id from base_permissions
    except
    select permission_id from denied
    union
    select permission_id from granted
  ) as permissions
$$;

create or replace function private.partspro_has_permission(_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(_permission = any(private.partspro_effective_permissions((select auth.uid()))), false)
$$;

create or replace function public.partspro_my_permissions()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.partspro_effective_permissions((select auth.uid()))
$$;

grant execute on function private.partspro_effective_permissions(uuid) to authenticated;
grant execute on function private.partspro_has_permission(text) to authenticated;
grant execute on function public.partspro_my_permissions() to authenticated;

create or replace function private.can_view_b2b_prices()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.is_staff()), false)
    or (select private.current_customer_id()) is not null
$$;

create or replace function private.ensure_user_account(
  _user_id uuid,
  _email text,
  _provider text,
  _display_name text,
  _avatar_url text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_customer_id uuid;
  v_company_name text;
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  insert into public.profiles (
    id,
    email,
    role,
    account_type,
    auth_provider,
    display_name,
    avatar_url
  )
  values (
    _user_id,
    _email,
    'customer',
    'customer',
    coalesce(nullif(_provider, ''), 'password'),
    nullif(_display_name, ''),
    nullif(_avatar_url, '')
  )
  on conflict (id) do update
    set email = excluded.email,
        auth_provider = excluded.auth_provider,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();

  select *
  into v_profile
  from public.profiles
  where id = _user_id
  limit 1;

  if v_profile.account_type = 'employee' then
    return v_profile.customer_id;
  end if;

  v_customer_id := v_profile.customer_id;

  if v_customer_id is null then
    select c.id
    into v_customer_id
    from public.customers as c
    where c.user_id = _user_id
    order by c.created_at desc
    limit 1;
  end if;

  if v_customer_id is null then
    v_company_name := coalesce(nullif(_display_name, ''), nullif(_email, ''), 'Cliente PartsPro');

    insert into public.customers (
      user_id,
      company_name,
      contact_name,
      email,
      status,
      tier,
      customer_type,
      assignment_status,
      level,
      lifetime_spend_net,
      profile_completed_at
    )
    values (
      _user_id,
      v_company_name,
      coalesce(nullif(_display_name, ''), ''),
      coalesce(nullif(_email, ''), ''),
      'active',
      'bronze',
      'retail',
      'needs_review',
      'bronze',
      0,
      null
    )
    returning id into v_customer_id;
  end if;

  update public.profiles
  set customer_id = v_customer_id,
      account_type = 'customer',
      updated_at = now()
  where id = _user_id;

  return v_customer_id;
end;
$$;

create or replace function public.ensure_current_user_account()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user record;
  v_customer_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select
    u.email,
    coalesce(u.raw_app_meta_data ->> 'provider', 'password') as provider,
    coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      u.raw_user_meta_data ->> 'display_name'
    ) as display_name,
    coalesce(
      u.raw_user_meta_data ->> 'avatar_url',
      u.raw_user_meta_data ->> 'picture'
    ) as avatar_url
  into v_user
  from auth.users as u
  where u.id = v_user_id
  limit 1;

  v_customer_id := private.ensure_user_account(
    v_user_id,
    v_user.email,
    v_user.provider,
    v_user.display_name,
    v_user.avatar_url
  );

  return jsonb_build_object('customer_id', v_customer_id);
end;
$$;

grant execute on function private.ensure_user_account(uuid, text, text, text, text) to authenticated;
grant execute on function public.ensure_current_user_account() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.ensure_user_account(
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data ->> 'provider', 'password'),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'display_name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  );

  return new;
end;
$$;

create or replace function private.recalculate_customer_level(_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_spend numeric(12, 2);
  v_level text;
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  select coalesce(sum(total_net), 0)
  into v_spend
  from public.orders
  where customer_id = _customer_id
    and payment_status = 'paid'
    and status <> 'cancelled';

  v_level := private.customer_level_for_spend(v_spend);

  update public.customers
  set lifetime_spend_net = v_spend,
      level = v_level,
      tier = v_level,
      updated_at = now()
  where id = _customer_id;
end;
$$;

create or replace function private.recalculate_customer_level_from_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.customer_id is not null then
    perform private.recalculate_customer_level(old.customer_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.customer_id is not null then
    perform private.recalculate_customer_level(new.customer_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists partspro_orders_recalculate_customer_level on public.orders;
create trigger partspro_orders_recalculate_customer_level
  after insert or update or delete
  on public.orders
  for each row execute function private.recalculate_customer_level_from_order();

create or replace function private.create_order_transaction(
  p_lines jsonb,
  p_customer_id uuid default null,
  p_delivery_address text default '',
  p_customer_note text default '',
  p_shipping_method text default '',
  p_shipping numeric default 0,
  p_fiscal jsonb default '{}'::jsonb,
  p_vat_rate numeric default 22.00
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := (select private.is_staff());
  v_customer public.customers%rowtype;
  v_order_id uuid;
  v_order_line_id uuid;
  v_order_no text;
  v_expected_count integer;
  v_line_count integer := 0;
  v_total_net numeric := 0;
  v_vat numeric := 0;
  v_stock_risk text := 'clear';
  v_line record;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Order lines must be a JSON array' using errcode = '22023';
  end if;

  v_expected_count := jsonb_array_length(p_lines);

  if v_expected_count < 1 then
    raise exception 'Order must contain at least one line' using errcode = '22023';
  end if;

  if p_vat_rate < 0 then
    raise exception 'VAT rate cannot be negative' using errcode = '22023';
  end if;

  if p_shipping < 0 then
    raise exception 'Shipping cannot be negative' using errcode = '22023';
  end if;

  if v_is_staff and p_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = p_customer_id
    limit 1;
  else
    select *
    into v_customer
    from public.customers
    where id = coalesce(p_customer_id, (select private.current_customer_id()))
      and user_id = v_auth_uid
    limit 1;
  end if;

  if v_customer.id is null then
    raise exception 'No matching customer profile was found' using errcode = '23503';
  end if;

  if not v_is_staff and v_customer.status <> 'active' then
    raise exception 'Customer must be active before placing orders' using errcode = '42501';
  end if;

  if coalesce(v_customer.contact_name, '') = ''
    or coalesce(v_customer.email, '') = ''
    or coalesce(v_customer.phone, '') = ''
    or coalesce(v_customer.billing_address, '') = ''
    or coalesce(v_customer.shipping_address, '') = '' then
    raise exception 'Customer contact, billing and shipping profile must be completed before checkout' using errcode = '42501';
  end if;

  if coalesce(v_customer.customer_type, 'retail') = 'retail'
    and coalesce(nullif(v_customer.fiscal_code, ''), nullif(v_customer.vat_number, ''), '') = '' then
    raise exception 'Retail customer fiscal code or VAT number is required before checkout' using errcode = '42501';
  end if;

  if coalesce(v_customer.customer_type, 'retail') = 'wholesale'
    and (
      coalesce(v_customer.company_name, '') = ''
      or coalesce(v_customer.vat_number, '') = ''
      or coalesce(v_customer.fiscal_code, '') = ''
      or coalesce(v_customer.registered_address, '') = ''
      or coalesce(nullif(v_customer.pec, ''), nullif(v_customer.sdi, ''), '') = ''
    ) then
    raise exception 'Wholesale customer company and tax profile must be completed before checkout' using errcode = '42501';
  end if;

  if v_is_staff and v_customer.status = 'suspended' then
    raise exception 'Suspended customers cannot receive new orders' using errcode = '42501';
  end if;

  v_order_no := 'PP-' ||
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.orders (
    order_no,
    customer_id,
    user_id,
    customer_name,
    customer_tier,
    status,
    payment_status,
    stock_risk,
    total_net,
    vat,
    shipping,
    shipping_method,
    fiscal,
    delivery_address,
    customer_note
  )
  values (
    v_order_no,
    v_customer.id,
    v_customer.user_id,
    v_customer.company_name,
    coalesce(v_customer.level, v_customer.tier, 'bronze'),
    'submitted',
    'pending',
    'clear',
    0,
    0,
    coalesce(p_shipping, 0),
    coalesce(p_shipping_method, ''),
    coalesce(p_fiscal, '{}'::jsonb),
    coalesce(p_delivery_address, ''),
    coalesce(p_customer_note, '')
  )
  returning id into v_order_id;

  for v_line in
    select
      requested.sku_code,
      requested.quantity,
      p.name as product_name,
      p.quality_grade,
      round(
        (
          case
            when coalesce(v_customer.customer_type, 'retail') = 'wholesale'
              then coalesce(p.b2b_price, p.retail_price, 0)
            else coalesce(p.retail_price, p.b2b_price, 0)
          end
        ) * (1 - private.customer_level_discount(coalesce(v_customer.level, v_customer.tier, 'bronze'))),
        2
      ) as unit_price,
      p.moq,
      p.stock_status,
      p.stock_qty,
      p.batch_code,
      p.location
    from jsonb_to_recordset(p_lines) as requested(sku_code text, quantity integer)
    join public.products as p on p.sku_code = requested.sku_code
    where p.status = 'active'
    order by requested.sku_code
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Order line quantity must be positive' using errcode = '23514';
    end if;

    if v_line.quantity < v_line.moq then
      raise exception 'Order line quantity is below MOQ for SKU %', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.stock_status = 'out_of_stock' or coalesce(v_line.stock_qty, 0) <= 0 then
      raise exception 'SKU % is out of stock', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.quantity > coalesce(v_line.stock_qty, 0) then
      raise exception 'Requested quantity exceeds stock for SKU %', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.unit_price < 0 then
      raise exception 'SKU % has invalid pricing', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.stock_status = 'low_stock' or (coalesce(v_line.stock_qty, 0) - v_line.quantity) <= v_line.moq then
      v_stock_risk := 'low';
    end if;

    insert into public.order_lines (
      order_id,
      sku_code,
      product_name,
      quality_grade,
      quantity,
      unit_price,
      stock_status,
      batch_code,
      location
    )
    values (
      v_order_id,
      v_line.sku_code,
      v_line.product_name,
      v_line.quality_grade,
      v_line.quantity,
      v_line.unit_price,
      'pending_reservation',
      v_line.batch_code,
      v_line.location
    )
    returning id into v_order_line_id;

    perform private.reserve_order_line_inventory(v_order_line_id, v_line.sku_code, v_line.quantity);

    v_total_net := v_total_net + round(v_line.unit_price * v_line.quantity, 2);
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count <> v_expected_count then
    raise exception 'One or more order lines reference inactive or unknown SKUs' using errcode = '23503';
  end if;

  v_vat := round((v_total_net + coalesce(p_shipping, 0)) * p_vat_rate / 100, 2);

  update public.orders
  set
    total_net = v_total_net,
    vat = v_vat,
    shipping = coalesce(p_shipping, 0),
    stock_risk = v_stock_risk,
    updated_at = now()
  where id = v_order_id;

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    v_order_id,
    'order_created',
    v_auth_uid,
    coalesce(p_customer_note, ''),
    jsonb_build_object(
      'source', 'create_order_transaction',
      'line_count', v_line_count,
      'customer_type', coalesce(v_customer.customer_type, 'retail'),
      'customer_level', coalesce(v_customer.level, v_customer.tier, 'bronze'),
      'shipping_method', coalesce(p_shipping_method, '')
    )
  );

  return v_order_id;
end;
$$;

create or replace function private.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('partspro.allow_account_admin_update', true) = 'on' then
    return new;
  end if;

  if (select private.partspro_has_permission('employees.manage_permissions')) then
    return new;
  end if;

  if new.account_type is distinct from old.account_type
    or new.role is distinct from old.role
    or new.role_template is distinct from old.role_template
    or new.customer_id is distinct from old.customer_id
  then
    raise exception 'Only authorized staff can update account type, role, template, or customer link' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists partspro_profiles_protect_admin_fields on public.profiles;
create trigger partspro_profiles_protect_admin_fields
  before update on public.profiles
  for each row execute function private.protect_profile_admin_fields();

create or replace function private.protect_customer_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if current_setting('partspro.allow_account_admin_update', true) = 'on' then
    return new;
  end if;

  if (select private.is_staff()) then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
    or new.status is distinct from old.status
    or new.tier is distinct from old.tier
    or new.price_group_id is distinct from old.price_group_id
    or new.credit_limit is distinct from old.credit_limit
    or new.payment_terms is distinct from old.payment_terms
    or new.customer_type is distinct from old.customer_type
    or new.assignment_status is distinct from old.assignment_status
    or new.level is distinct from old.level
    or new.lifetime_spend_net is distinct from old.lifetime_spend_net
    or new.assigned_by is distinct from old.assigned_by
    or new.assigned_at is distinct from old.assigned_at
    or new.converted_to_employee_at is distinct from old.converted_to_employee_at
  then
    raise exception 'Only staff can update customer classification, pricing, or assignment fields' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists partspro_customers_protect_admin_fields on public.customers;
create trigger partspro_customers_protect_admin_fields
  before update on public.customers
  for each row execute function private.protect_customer_admin_fields();

create or replace function public.admin_update_account(
  p_user_id uuid,
  p_account_type text,
  p_customer_type text default null,
  p_role_template text default null,
  p_assignment_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := (select auth.uid());
  v_customer_id uuid;
  v_effective_role text;
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if not (
    (select private.partspro_has_permission('customers.classify'))
    or (select private.partspro_has_permission('employees.manage_permissions'))
  ) then
    raise exception 'Missing account management permission' using errcode = '42501';
  end if;

  if p_account_type not in ('customer', 'employee') then
    raise exception 'Invalid account type' using errcode = '23514';
  end if;

  if p_account_type = 'employee'
    and not (select private.partspro_has_permission('employees.manage_permissions'))
  then
    raise exception 'Missing employee permission management permission' using errcode = '42501';
  end if;

  if p_account_type = 'employee' then
    v_effective_role := coalesce(nullif(p_role_template, ''), 'sales');

    update public.profiles
    set account_type = 'employee',
        role = v_effective_role,
        role_template = v_effective_role,
        customer_id = null,
        updated_at = now()
    where id = p_user_id;

    update public.customers
    set assignment_status = 'converted_to_employee',
        status = 'suspended',
        converted_to_employee_at = now(),
        updated_at = now()
    where user_id = p_user_id;

    return jsonb_build_object('account_type', 'employee', 'role_template', v_effective_role);
  end if;

  select c.id
  into v_customer_id
  from public.customers as c
  where c.user_id = p_user_id
  order by c.created_at desc
  limit 1;

  if v_customer_id is null then
    insert into public.customers (
      user_id,
      company_name,
      contact_name,
      email,
      status,
      tier,
      customer_type,
      assignment_status,
      level,
      lifetime_spend_net
    )
    select
      p.id,
      coalesce(nullif(p.display_name, ''), nullif(p.email, ''), 'Cliente PartsPro'),
      coalesce(nullif(p.display_name, ''), ''),
      coalesce(nullif(p.email, ''), ''),
      'active',
      'bronze',
      coalesce(nullif(p_customer_type, ''), 'retail'),
      coalesce(nullif(p_assignment_status, ''), 'assigned'),
      'bronze',
      0
    from public.profiles as p
    where p.id = p_user_id
    returning id into v_customer_id;
  end if;

  update public.customers
  set customer_type = coalesce(nullif(p_customer_type, ''), customer_type),
      assignment_status = coalesce(nullif(p_assignment_status, ''), 'assigned'),
      assigned_by = v_actor,
      assigned_at = now(),
      status = 'active',
      updated_at = now()
  where id = v_customer_id;

  update public.profiles
  set account_type = 'customer',
      role = 'customer',
      role_template = null,
      customer_id = v_customer_id,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object('account_type', 'customer', 'customer_id', v_customer_id);
end;
$$;

grant execute on function public.admin_update_account(uuid, text, text, text, text) to authenticated;
