-- Customer management workbench: memberships, permission-scoped writes,
-- transactional B2B review, and audit events for customer/account changes.

create extension if not exists "pgcrypto";
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.customer_memberships (
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'owner'
    check (member_role in ('owner', 'buyer', 'finance', 'support')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (customer_id, user_id)
);

create index if not exists customer_memberships_user_idx
  on public.customer_memberships (user_id, status);

create index if not exists customer_memberships_customer_idx
  on public.customer_memberships (customer_id, status);

alter table public.customer_memberships enable row level security;

grant select on public.customer_memberships to authenticated;

insert into public.customer_memberships (customer_id, user_id, member_role, status)
select c.id, c.user_id, 'owner', 'active'
from public.customers as c
where c.user_id is not null
on conflict (customer_id, user_id) do update
set member_role = case
      when public.customer_memberships.member_role = 'owner' then public.customer_memberships.member_role
      else excluded.member_role
    end,
    status = case
      when public.customer_memberships.status = 'disabled' then public.customer_memberships.status
      else excluded.status
    end,
    updated_at = now();

insert into public.admin_permissions (id, label, group_name, description)
values
  ('customers.manage_terms', 'Manage customer commercial terms', 'customers', 'Can edit customer credit, payment terms, and pricing tier.'),
  ('product.read_admin', 'Read admin product', 'products', 'Compatibility alias for reading admin catalog data.'),
  ('product.create_draft', 'Create product draft', 'products', 'Compatibility alias for creating draft products.'),
  ('product.edit_content', 'Edit product content', 'products', 'Compatibility alias for editing product content.'),
  ('product.edit_price', 'Edit product prices', 'products', 'Compatibility alias for editing product prices.'),
  ('product.edit_cost', 'Edit product cost', 'products', 'Compatibility alias for editing product costs.'),
  ('product.adjust_stock', 'Adjust product stock', 'inventory', 'Compatibility alias for stock adjustments.'),
  ('product.publish', 'Publish product', 'products', 'Compatibility alias for publishing products.'),
  ('product.hide', 'Hide product', 'products', 'Compatibility alias for hiding products.'),
  ('product.block', 'Block product', 'products', 'Compatibility alias for blocking products.'),
  ('product.restore_draft', 'Restore product draft', 'products', 'Compatibility alias for restoring product drafts.'),
  ('product.image_manage', 'Manage product images', 'products', 'Compatibility alias for product image management.')
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'customers.manage_terms'),
  ('sales', 'customers.manage_terms'),
  ('catalog_manager', 'product.read_admin'),
  ('catalog_manager', 'product.create_draft'),
  ('catalog_manager', 'product.edit_content'),
  ('catalog_manager', 'product.publish'),
  ('catalog_manager', 'product.hide'),
  ('catalog_manager', 'product.restore_draft'),
  ('catalog_manager', 'product.image_manage'),
  ('pricing_manager', 'product.read_admin'),
  ('pricing_manager', 'product.edit_price'),
  ('pricing_manager', 'product.edit_cost'),
  ('inventory_manager', 'product.read_admin'),
  ('inventory_manager', 'product.adjust_stock'),
  ('warehouse', 'product.read_admin'),
  ('warehouse', 'product.adjust_stock'),
  ('purchasing', 'product.read_admin'),
  ('purchasing', 'product.create_draft'),
  ('purchasing', 'product.edit_content'),
  ('sales', 'product.read_admin'),
  ('sales_support', 'product.read_admin'),
  ('auditor', 'product.read_admin')
on conflict do nothing;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
select 'admin', id from public.admin_permissions
on conflict do nothing;

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
      select cm.customer_id
      from public.customer_memberships as cm
      where cm.user_id = (select auth.uid())
        and cm.status = 'active'
      order by cm.created_at asc
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

create or replace function private.can_view_b2b_prices()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.is_staff()), false)
    or exists (
      select 1
      from public.customers as c
      where c.id = (select private.current_customer_id())
        and c.status = 'active'
        and coalesce(c.customer_type, 'retail') = 'wholesale'
    )
$$;

create or replace function private.partspro_assert_permission(_permission text)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce((select private.partspro_has_permission(_permission)), false) then
    raise exception 'Missing admin permission: %', _permission using errcode = '42501';
  end if;
end;
$$;

create or replace function private.partspro_audit_admin(
  _action text,
  _entity_type text,
  _entity_id text,
  _before jsonb default '{}'::jsonb,
  _after jsonb default '{}'::jsonb,
  _reason text default '',
  _metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_email text := nullif(coalesce((auth.jwt() ->> 'email'), ''), '');
  v_actor_role text := (select private.current_profile_role());
  v_request_headers text := nullif(current_setting('request.headers', true), '');
  v_request_metadata jsonb;
begin
  v_request_metadata := coalesce(_metadata, '{}'::jsonb) || jsonb_build_object(
    'request_method', nullif(current_setting('request.method', true), ''),
    'request_path', nullif(current_setting('request.path', true), ''),
    'request_headers', case
      when v_request_headers is null then null
      else v_request_headers::jsonb
    end
  );

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
    v_actor_email,
    v_actor_role,
    _action,
    _entity_type,
    _entity_id,
    coalesce(_before, '{}'::jsonb),
    coalesce(_after, '{}'::jsonb),
    nullif(btrim(coalesce(_reason, '')), ''),
    v_request_metadata
  );
end;
$$;

do $$
begin
  drop policy if exists "partspro_customer_memberships_read" on public.customer_memberships;
  create policy "partspro_customer_memberships_read"
    on public.customer_memberships
    for select
    to authenticated
    using (
      user_id = (select auth.uid())
      or (select private.partspro_has_permission('customers.read'))
      or (select private.partspro_has_permission('employees.read'))
    );

  drop policy if exists "partspro_customers_self_or_staff_read" on public.customers;
  create policy "partspro_customers_self_or_staff_read"
    on public.customers
    for select
    to authenticated
    using (
      user_id = (select auth.uid())
      or id = (select private.current_customer_id())
      or exists (
        select 1
        from public.customer_memberships as cm
        where cm.customer_id = public.customers.id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
      or (select private.partspro_has_permission('customers.read'))
    );

  drop policy if exists "partspro_customers_self_create" on public.customers;
  create policy "partspro_customers_self_create"
    on public.customers
    for insert
    to authenticated
    with check (
      (user_id = (select auth.uid()) and status = 'pending')
      or (select private.partspro_has_permission('customers.manage'))
    );

  drop policy if exists "partspro_customers_self_or_staff_update" on public.customers;
  create policy "partspro_customers_self_or_staff_update"
    on public.customers
    for update
    to authenticated
    using (
      user_id = (select auth.uid())
      or exists (
        select 1
        from public.customer_memberships as cm
        where cm.customer_id = public.customers.id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
      or (select private.partspro_has_permission('customers.manage'))
      or (select private.partspro_has_permission('customers.classify'))
      or (select private.partspro_has_permission('customers.manage_terms'))
    )
    with check (
      (
        (user_id = (select auth.uid()) or id = (select private.current_customer_id()))
        and status in ('pending', 'active')
      )
      or (select private.partspro_has_permission('customers.manage'))
      or (select private.partspro_has_permission('customers.classify'))
      or (select private.partspro_has_permission('customers.manage_terms'))
    );

  drop policy if exists "partspro_profiles_self_or_staff_read" on public.profiles;
  create policy "partspro_profiles_self_or_staff_read"
    on public.profiles
    for select
    to authenticated
    using (
      id = (select auth.uid())
      or (select private.partspro_has_permission('customers.read'))
      or (select private.partspro_has_permission('employees.read'))
    );

  drop policy if exists "partspro_profiles_self_update" on public.profiles;
  create policy "partspro_profiles_self_update"
    on public.profiles
    for update
    to authenticated
    using (
      id = (select auth.uid())
      or (select private.partspro_has_permission('employees.manage_permissions'))
    )
    with check (
      id = (select auth.uid())
      or (select private.partspro_has_permission('employees.manage_permissions'))
    );
end $$;

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

  if new.account_type is distinct from old.account_type
    or new.role is distinct from old.role
    or new.role_template is distinct from old.role_template
    or new.customer_id is distinct from old.customer_id
  then
    raise exception 'Account type, role, template, and customer link must be updated through admin RPCs' using errcode = '42501';
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

  if new.user_id is distinct from old.user_id
    or new.status is distinct from old.status
    or new.customer_type is distinct from old.customer_type
    or new.assignment_status is distinct from old.assignment_status
    or new.assigned_by is distinct from old.assigned_by
    or new.assigned_at is distinct from old.assigned_at
    or new.converted_to_employee_at is distinct from old.converted_to_employee_at
  then
    if not (select private.partspro_has_permission('customers.classify')) then
      raise exception 'Missing customer classification permission' using errcode = '42501';
    end if;
  end if;

  if new.tier is distinct from old.tier
    or new.level is distinct from old.level
    or new.price_group_id is distinct from old.price_group_id
    or new.credit_limit is distinct from old.credit_limit
    or new.payment_terms is distinct from old.payment_terms
    or new.monthly_purchase is distinct from old.monthly_purchase
    or new.lifetime_spend_net is distinct from old.lifetime_spend_net
  then
    if not (select private.partspro_has_permission('customers.manage_terms')) then
      raise exception 'Missing customer terms permission' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists partspro_customers_protect_admin_fields on public.customers;
create trigger partspro_customers_protect_admin_fields
  before update on public.customers
  for each row execute function private.protect_customer_admin_fields();

create or replace function private.normalize_customer_tier(_tier text)
returns text
language sql
immutable
as $$
  select case lower(btrim(coalesce(_tier, '')))
    when 'bronze' then 'bronze'
    when 'silver' then 'silver'
    when 'gold' then 'gold'
    when 'emerald' then 'emerald'
    when 'diamond' then 'diamond'
    when 'master' then 'master'
    when 'king' then 'king'
    when 'standard' then 'bronze'
    when 'pro' then 'silver'
    when 'partner' then 'gold'
    else 'bronze'
  end
$$;

create or replace function public.admin_update_customer_profile(
  p_customer_id uuid,
  p_customer jsonb,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.customers%rowtype;
  v_after public.customers%rowtype;
begin
  perform private.partspro_assert_permission('customers.manage');
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before from public.customers where id = p_customer_id for update;
  if v_before.id is null then
    raise exception 'Customer not found' using errcode = '23503';
  end if;

  update public.customers
  set
    company_name = case when p_customer ? 'company_name' then coalesce(nullif(btrim(p_customer ->> 'company_name'), ''), company_name) else company_name end,
    contact_name = case when p_customer ? 'contact_name' then nullif(btrim(p_customer ->> 'contact_name'), '') else contact_name end,
    email = case when p_customer ? 'email' then nullif(btrim(p_customer ->> 'email'), '') else email end,
    phone = case when p_customer ? 'phone' then nullif(btrim(p_customer ->> 'phone'), '') else phone end,
    vat_number = case when p_customer ? 'vat_number' then nullif(btrim(p_customer ->> 'vat_number'), '') else vat_number end,
    fiscal_code = case when p_customer ? 'fiscal_code' then nullif(btrim(p_customer ->> 'fiscal_code'), '') else fiscal_code end,
    sdi = case when p_customer ? 'sdi' then nullif(btrim(p_customer ->> 'sdi'), '') else sdi end,
    pec = case when p_customer ? 'pec' then nullif(btrim(p_customer ->> 'pec'), '') else pec end,
    registered_address = case when p_customer ? 'registered_address' then nullif(btrim(p_customer ->> 'registered_address'), '') else registered_address end,
    billing_address = case when p_customer ? 'billing_address' then nullif(btrim(p_customer ->> 'billing_address'), '') else billing_address end,
    shipping_address = case when p_customer ? 'shipping_address' then nullif(btrim(p_customer ->> 'shipping_address'), '') else shipping_address end,
    updated_at = now()
  where id = p_customer_id
  returning * into v_after;

  perform private.partspro_audit_admin(
    'customer.profile_update',
    'customer',
    p_customer_id::text,
    to_jsonb(v_before),
    to_jsonb(v_after),
    p_reason,
    p_customer
  );

  return v_after;
end;
$$;

create or replace function public.admin_update_customer_classification(
  p_customer_id uuid,
  p_customer jsonb,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.customers%rowtype;
  v_after public.customers%rowtype;
  v_member_user_id uuid;
begin
  perform private.partspro_assert_permission('customers.classify');
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before from public.customers where id = p_customer_id for update;
  if v_before.id is null then
    raise exception 'Customer not found' using errcode = '23503';
  end if;

  update public.customers
  set
    status = case
      when p_customer ? 'status' then p_customer ->> 'status'
      else status
    end,
    customer_type = case
      when p_customer ? 'customer_type' then p_customer ->> 'customer_type'
      else customer_type
    end,
    assignment_status = case
      when p_customer ? 'assignment_status' then p_customer ->> 'assignment_status'
      else assignment_status
    end,
    assigned_by = (select auth.uid()),
    assigned_at = now(),
    updated_at = now()
  where id = p_customer_id
  returning * into v_after;

  if p_customer ? 'member_user_id' then
    v_member_user_id := nullif(p_customer ->> 'member_user_id', '')::uuid;
    if v_member_user_id is not null then
      insert into public.customer_memberships (
        customer_id,
        user_id,
        member_role,
        status
      )
      values (
        p_customer_id,
        v_member_user_id,
        coalesce(nullif(p_customer ->> 'member_role', ''), 'owner'),
        coalesce(nullif(p_customer ->> 'member_status', ''), 'active')
      )
      on conflict (customer_id, user_id) do update
      set member_role = excluded.member_role,
          status = excluded.status,
          updated_at = now();
    end if;
  end if;

  perform private.partspro_audit_admin(
    'customer.classification_update',
    'customer',
    p_customer_id::text,
    to_jsonb(v_before),
    to_jsonb(v_after),
    p_reason,
    p_customer
  );

  return v_after;
end;
$$;

create or replace function public.admin_update_customer_terms(
  p_customer_id uuid,
  p_terms jsonb,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.customers%rowtype;
  v_after public.customers%rowtype;
  v_tier text;
begin
  perform private.partspro_assert_permission('customers.manage_terms');
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before from public.customers where id = p_customer_id for update;
  if v_before.id is null then
    raise exception 'Customer not found' using errcode = '23503';
  end if;

  v_tier := case when p_terms ? 'tier' then private.normalize_customer_tier(p_terms ->> 'tier') else null end;

  update public.customers
  set
    tier = coalesce(v_tier, tier),
    level = coalesce(v_tier, level),
    price_group_id = case when p_terms ? 'price_group_id' then nullif(btrim(p_terms ->> 'price_group_id'), '') else price_group_id end,
    monthly_purchase = case when p_terms ? 'monthly_purchase' then nullif(btrim(p_terms ->> 'monthly_purchase'), '') else monthly_purchase end,
    credit_limit = case when p_terms ? 'credit_limit' then greatest(coalesce((p_terms ->> 'credit_limit')::numeric, 0), 0) else credit_limit end,
    payment_terms = case when p_terms ? 'payment_terms' then nullif(btrim(p_terms ->> 'payment_terms'), '') else payment_terms end,
    updated_at = now()
  where id = p_customer_id
  returning * into v_after;

  perform private.partspro_audit_admin(
    'customer.terms_update',
    'customer',
    p_customer_id::text,
    to_jsonb(v_before),
    to_jsonb(v_after),
    p_reason,
    p_terms
  );

  return v_after;
end;
$$;

create or replace function public.admin_review_b2b_application(
  p_application_id uuid,
  p_decision text,
  p_terms jsonb default '{}'::jsonb,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before_application public.b2b_applications%rowtype;
  v_after_application public.b2b_applications%rowtype;
  v_before_customer public.customers%rowtype;
  v_after_customer public.customers%rowtype;
  v_customer_id uuid;
  v_tier text := private.normalize_customer_tier(coalesce(p_terms ->> 'tier', p_terms ->> 'priceList'));
begin
  perform private.partspro_assert_permission('customers.classify');
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if p_decision not in ('approve', 'reject', 'approved', 'rejected') then
    raise exception 'Invalid B2B decision' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before_application
  from public.b2b_applications
  where id = p_application_id
  for update;

  if v_before_application.id is null then
    raise exception 'B2B application not found' using errcode = '23503';
  end if;

  if p_decision in ('reject', 'rejected') then
    update public.b2b_applications
    set status = 'rejected',
        review_note = coalesce(nullif(btrim(p_reason), ''), review_note),
        reviewed_at = now(),
        updated_at = now()
    where id = p_application_id
    returning * into v_after_application;

    perform private.partspro_audit_admin(
      'b2b_application.reject',
      'b2b_application',
      p_application_id::text,
      to_jsonb(v_before_application),
      to_jsonb(v_after_application),
      p_reason,
      p_terms
    );

    return jsonb_build_object(
      'application', to_jsonb(v_after_application),
      'customer', null
    );
  end if;

  v_customer_id := v_before_application.approved_customer_id;

  if v_customer_id is null and nullif(v_before_application.vat_number, '') is not null then
    select *
    into v_before_customer
    from public.customers
    where vat_number = v_before_application.vat_number
    order by created_at desc
    limit 1
    for update;
    v_customer_id := v_before_customer.id;
  elsif v_customer_id is not null then
    select * into v_before_customer
    from public.customers
    where id = v_customer_id
    for update;
  end if;

  if v_customer_id is null then
    insert into public.customers (
      company_name,
      contact_name,
      email,
      phone,
      vat_number,
      fiscal_code,
      sdi,
      pec,
      registered_address,
      billing_address,
      shipping_address,
      tier,
      level,
      price_group_id,
      status,
      customer_type,
      assignment_status,
      monthly_purchase,
      credit_limit,
      payment_terms,
      profile_completed_at
    )
    values (
      coalesce(nullif(v_before_application.company_name, ''), 'Cliente B2B'),
      coalesce(nullif(v_before_application.contact_name, ''), ''),
      coalesce(nullif(v_before_application.email, ''), ''),
      coalesce(nullif(v_before_application.phone, ''), nullif(v_before_application.whatsapp, ''), ''),
      coalesce(nullif(v_before_application.vat_number, ''), ''),
      coalesce(nullif(v_before_application.fiscal_code, ''), ''),
      coalesce(nullif(v_before_application.sdi, ''), ''),
      coalesce(nullif(v_before_application.pec, ''), ''),
      coalesce(nullif(v_before_application.registered_address, ''), ''),
      coalesce(nullif(v_before_application.registered_address, ''), ''),
      coalesce(nullif(v_before_application.shipping_address, ''), nullif(v_before_application.registered_address, ''), ''),
      v_tier,
      v_tier,
      coalesce(nullif(p_terms ->> 'price_group_id', ''), v_before_application.requested_price_group_id),
      'active',
      'wholesale',
      'assigned',
      coalesce(nullif(v_before_application.monthly_purchase, ''), ''),
      greatest(coalesce((p_terms ->> 'credit_limit')::numeric, 0), 0),
      coalesce(nullif(p_terms ->> 'payment_terms', ''), 'Bonifico anticipato'),
      now()
    )
    returning * into v_after_customer;
  else
    update public.customers
    set company_name = coalesce(nullif(v_before_application.company_name, ''), company_name),
        contact_name = coalesce(nullif(v_before_application.contact_name, ''), contact_name),
        email = coalesce(nullif(v_before_application.email, ''), email),
        phone = coalesce(nullif(v_before_application.phone, ''), nullif(v_before_application.whatsapp, ''), phone),
        vat_number = coalesce(nullif(v_before_application.vat_number, ''), vat_number),
        fiscal_code = coalesce(nullif(v_before_application.fiscal_code, ''), fiscal_code),
        sdi = coalesce(nullif(v_before_application.sdi, ''), sdi),
        pec = coalesce(nullif(v_before_application.pec, ''), pec),
        registered_address = coalesce(nullif(v_before_application.registered_address, ''), registered_address),
        billing_address = coalesce(nullif(v_before_application.registered_address, ''), billing_address),
        shipping_address = coalesce(nullif(v_before_application.shipping_address, ''), nullif(v_before_application.registered_address, ''), shipping_address),
        tier = v_tier,
        level = v_tier,
        price_group_id = coalesce(nullif(p_terms ->> 'price_group_id', ''), v_before_application.requested_price_group_id, price_group_id),
        status = 'active',
        customer_type = 'wholesale',
        assignment_status = 'assigned',
        monthly_purchase = coalesce(nullif(v_before_application.monthly_purchase, ''), monthly_purchase),
        credit_limit = case when p_terms ? 'credit_limit' then greatest(coalesce((p_terms ->> 'credit_limit')::numeric, 0), 0) else credit_limit end,
        payment_terms = coalesce(nullif(p_terms ->> 'payment_terms', ''), payment_terms),
        profile_completed_at = coalesce(profile_completed_at, now()),
        updated_at = now()
    where id = v_customer_id
    returning * into v_after_customer;
  end if;

  update public.b2b_applications
  set status = 'approved',
      review_note = coalesce(nullif(btrim(p_reason), ''), review_note),
      approved_customer_id = v_after_customer.id,
      reviewed_at = now(),
      updated_at = now()
  where id = p_application_id
  returning * into v_after_application;

  perform private.partspro_audit_admin(
    'b2b_application.approve',
    'b2b_application',
    p_application_id::text,
    to_jsonb(v_before_application),
    jsonb_build_object(
      'application', to_jsonb(v_after_application),
      'customer', to_jsonb(v_after_customer)
    ),
    p_reason,
    p_terms
  );

  return jsonb_build_object(
    'application', to_jsonb(v_after_application),
    'customer', to_jsonb(v_after_customer)
  );
end;
$$;

create or replace function public.admin_update_account_type(
  p_user_id uuid,
  p_account_type text,
  p_customer_type text default null,
  p_assignment_status text default null,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before_profile public.profiles%rowtype;
  v_after_profile public.profiles%rowtype;
  v_before_customer public.customers%rowtype;
  v_after_customer public.customers%rowtype;
  v_customer_id uuid;
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if p_account_type not in ('customer', 'employee') then
    raise exception 'Invalid account type' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before_profile from public.profiles where id = p_user_id for update;
  if v_before_profile.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if p_account_type = 'employee' then
    perform private.partspro_assert_permission('employees.manage_permissions');

    update public.profiles
    set account_type = 'employee',
        role = coalesce(nullif(role_template, ''), 'sales_support'),
        role_template = coalesce(nullif(role_template, ''), 'sales_support'),
        customer_id = null,
        updated_at = now()
    where id = p_user_id
    returning * into v_after_profile;

    update public.customers
    set assignment_status = 'converted_to_employee',
        status = 'suspended',
        converted_to_employee_at = now(),
        updated_at = now()
    where user_id = p_user_id
    returning * into v_after_customer;

    update public.customer_memberships
    set status = 'disabled',
        updated_at = now()
    where user_id = p_user_id;

    perform private.partspro_audit_admin(
      'account.type_update',
      'profile',
      p_user_id::text,
      to_jsonb(v_before_profile),
      to_jsonb(v_after_profile),
      p_reason,
      jsonb_build_object('account_type', p_account_type)
    );

    return jsonb_build_object('account_type', 'employee', 'profile', to_jsonb(v_after_profile), 'customer', to_jsonb(v_after_customer));
  end if;

  perform private.partspro_assert_permission('customers.classify');

  select *
  into v_before_customer
  from public.customers
  where user_id = p_user_id
  order by created_at desc
  limit 1
  for update;

  v_customer_id := v_before_customer.id;

  if v_customer_id is null then
    insert into public.customers (
      user_id,
      company_name,
      contact_name,
      email,
      status,
      tier,
      level,
      customer_type,
      assignment_status,
      lifetime_spend_net
    )
    values (
      p_user_id,
      coalesce(nullif(v_before_profile.display_name, ''), nullif(v_before_profile.email, ''), 'Cliente PartsPro'),
      coalesce(nullif(v_before_profile.display_name, ''), ''),
      coalesce(nullif(v_before_profile.email, ''), ''),
      'active',
      'bronze',
      'bronze',
      coalesce(nullif(p_customer_type, ''), 'retail'),
      coalesce(nullif(p_assignment_status, ''), 'assigned'),
      0
    )
    returning * into v_after_customer;
  else
    update public.customers
    set customer_type = coalesce(nullif(p_customer_type, ''), customer_type),
        assignment_status = coalesce(nullif(p_assignment_status, ''), 'assigned'),
        status = 'active',
        assigned_by = (select auth.uid()),
        assigned_at = now(),
        updated_at = now()
    where id = v_customer_id
    returning * into v_after_customer;
  end if;

  insert into public.customer_memberships (customer_id, user_id, member_role, status)
  values (v_after_customer.id, p_user_id, 'owner', 'active')
  on conflict (customer_id, user_id) do update
  set member_role = 'owner',
      status = 'active',
      updated_at = now();

  update public.profiles
  set account_type = 'customer',
      role = 'customer',
      role_template = null,
      customer_id = v_after_customer.id,
      updated_at = now()
  where id = p_user_id
  returning * into v_after_profile;

  perform private.partspro_audit_admin(
    'account.type_update',
    'profile',
    p_user_id::text,
    to_jsonb(v_before_profile),
    jsonb_build_object('profile', to_jsonb(v_after_profile), 'customer', to_jsonb(v_after_customer)),
    p_reason,
    jsonb_build_object('account_type', p_account_type)
  );

  return jsonb_build_object('account_type', 'customer', 'profile', to_jsonb(v_after_profile), 'customer', to_jsonb(v_after_customer));
end;
$$;

create or replace function public.admin_update_employee_role(
  p_user_id uuid,
  p_role_template text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
begin
  perform private.partspro_assert_permission('employees.manage_permissions');
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before from public.profiles where id = p_user_id for update;
  if v_before.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if not exists (select 1 from public.admin_role_templates where id = p_role_template) then
    raise exception 'Unknown role template' using errcode = '23514';
  end if;

  update public.profiles
  set account_type = 'employee',
      role = p_role_template,
      role_template = p_role_template,
      customer_id = null,
      updated_at = now()
  where id = p_user_id
  returning * into v_after;

  perform private.partspro_audit_admin(
    'account.role_update',
    'profile',
    p_user_id::text,
    to_jsonb(v_before),
    to_jsonb(v_after),
    p_reason,
    jsonb_build_object('role_template', p_role_template)
  );

  return jsonb_build_object('profile', to_jsonb(v_after));
end;
$$;

create or replace function public.admin_update_permission_overrides(
  p_user_id uuid,
  p_role_template text default null,
  p_overrides jsonb default '[]'::jsonb,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before_profile public.profiles%rowtype;
  v_after_profile public.profiles%rowtype;
  v_override jsonb;
  v_effect text;
  v_permission_id text;
begin
  perform private.partspro_assert_permission('employees.manage_permissions');
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before_profile from public.profiles where id = p_user_id for update;
  if v_before_profile.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if p_role_template is not null then
    perform public.admin_update_employee_role(p_user_id, p_role_template, p_reason);
  end if;

  if jsonb_typeof(coalesce(p_overrides, '[]'::jsonb)) <> 'array' then
    raise exception 'Overrides must be an array' using errcode = '22023';
  end if;

  for v_override in select * from jsonb_array_elements(coalesce(p_overrides, '[]'::jsonb))
  loop
    v_permission_id := nullif(btrim(v_override ->> 'permissionId'), '');
    v_effect := nullif(btrim(v_override ->> 'effect'), '');

    if v_permission_id is null then
      raise exception 'permissionId is required' using errcode = '23514';
    end if;

    if v_effect = 'inherit' then
      delete from public.admin_user_permission_overrides
      where user_id = p_user_id
        and permission_id = v_permission_id;
    elsif v_effect in ('grant', 'deny') then
      insert into public.admin_user_permission_overrides (
        user_id,
        permission_id,
        effect,
        updated_at
      )
      values (
        p_user_id,
        v_permission_id,
        v_effect,
        now()
      )
      on conflict (user_id, permission_id) do update
      set effect = excluded.effect,
          updated_at = now();
    else
      raise exception 'Invalid override effect' using errcode = '23514';
    end if;
  end loop;

  select * into v_after_profile from public.profiles where id = p_user_id;

  perform private.partspro_audit_admin(
    'permissions.update',
    'profile',
    p_user_id::text,
    to_jsonb(v_before_profile),
    to_jsonb(v_after_profile),
    p_reason,
    jsonb_build_object('role_template', p_role_template, 'overrides', p_overrides)
  );

  return jsonb_build_object(
    'user_id', p_user_id,
    'role_template', p_role_template,
    'overrides', coalesce(p_overrides, '[]'::jsonb)
  );
end;
$$;

grant execute on function public.admin_update_customer_profile(uuid, jsonb, text) to authenticated;
grant execute on function public.admin_update_customer_classification(uuid, jsonb, text) to authenticated;
grant execute on function public.admin_update_customer_terms(uuid, jsonb, text) to authenticated;
grant execute on function public.admin_review_b2b_application(uuid, text, jsonb, text) to authenticated;
grant execute on function public.admin_update_account_type(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_update_employee_role(uuid, text, text) to authenticated;
grant execute on function public.admin_update_permission_overrides(uuid, text, jsonb, text) to authenticated;
