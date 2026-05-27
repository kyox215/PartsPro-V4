-- Customer management foundation: dedicated level permission, customer
-- activity events, owner membership auto-upsert, and order aggregate upkeep.

create extension if not exists "pgcrypto";
create schema if not exists private;

insert into public.admin_permissions (id, label, group_name, description)
values (
  'customers.manage_level',
  'Manage customer level',
  'customers',
  'Can update a customer loyalty level without broader commercial terms access.'
)
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'customers.manage_level'),
  ('sales', 'customers.manage_level')
on conflict do nothing;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
select 'admin', id
from public.admin_permissions
where id = 'customers.manage_level'
on conflict do nothing;

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
      p.role,
      coalesce(p.account_type, 'customer') as account_type
    from public.profiles as p
    where p.id = _user_id
      and (
        coalesce(p.account_type, 'customer') = 'employee'
        or coalesce(p.role, '') in (
          'admin',
          'auditor',
          'catalog_manager',
          'inventory_manager',
          'pricing_manager',
          'purchasing',
          'sales',
          'sales_support',
          'warehouse'
        )
      )
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
    select permission_override.permission_id
    from public.admin_user_permission_overrides as permission_override
    join profile as p on p.id = permission_override.user_id
    where permission_override.user_id = _user_id
      and permission_override.effect = 'deny'
  ),
  granted as (
    select permission_override.permission_id
    from public.admin_user_permission_overrides as permission_override
    join profile as p on p.id = permission_override.user_id
    where permission_override.user_id = _user_id
      and permission_override.effect = 'grant'
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
    select * into v_after_profile from public.profiles where id = p_user_id for update;
  else
    v_after_profile := v_before_profile;
  end if;

  if coalesce(v_after_profile.account_type, 'customer') <> 'employee'
     and coalesce(v_after_profile.role, '') not in (
       'admin',
       'auditor',
       'catalog_manager',
       'inventory_manager',
       'pricing_manager',
       'purchasing',
       'sales',
       'sales_support',
       'warehouse'
     ) then
    raise exception 'Permission overrides can only target employee accounts' using errcode = '23514';
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

    if not exists (select 1 from public.admin_permissions where id = v_permission_id) then
      raise exception 'Unknown admin permission' using errcode = '23503';
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
        and coalesce(p.account_type, 'customer') <> 'employee'
        and p.customer_id is not null
      limit 1
    ),
    (
      select cm.customer_id
      from public.customer_memberships as cm
      left join public.profiles as p on p.id = cm.user_id
      where cm.user_id = (select auth.uid())
        and cm.status = 'active'
        and coalesce(p.account_type, 'customer') <> 'employee'
      order by cm.created_at asc
      limit 1
    ),
    (
      select c.id
      from public.customers as c
      left join public.profiles as p on p.id = c.user_id
      where c.user_id = (select auth.uid())
        and coalesce(p.account_type, 'customer') <> 'employee'
      order by c.created_at desc
      limit 1
    )
  )
$$;

alter table public.customers
  add column if not exists level_source text not null default 'automatic'
    check (level_source in ('automatic', 'manual')),
  add column if not exists manual_level_set_by uuid references auth.users(id) on delete set null,
  add column if not exists manual_level_set_at timestamptz,
  add column if not exists manual_level_reason text;

update public.customers
set status = 'active',
    updated_at = now()
where status = 'pending';

create table if not exists public.customer_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  event_type text not null,
  sku_code text,
  product_name text,
  brand text,
  model text,
  model_series text,
  search_query text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.customer_activity_events
  drop constraint if exists customer_activity_events_event_type_check,
  add constraint customer_activity_events_event_type_check
    check (event_type in (
      'product_view',
      'model_view',
      'catalog_search',
      'catalog_filter',
      'order_detail_view'
    ));

create index if not exists customer_activity_events_customer_created_idx
  on public.customer_activity_events (customer_id, created_at desc);

create index if not exists customer_activity_events_user_created_idx
  on public.customer_activity_events (user_id, created_at desc);

create index if not exists customer_activity_events_type_created_idx
  on public.customer_activity_events (event_type, created_at desc);

alter table public.customer_activity_events enable row level security;

grant select, insert on public.customer_activity_events to authenticated;

create or replace function private.prepare_customer_activity_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_customer_id uuid := (select private.current_customer_id());
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.profiles as p
    where p.id = v_auth_uid
      and p.account_type = 'employee'
  ) then
    raise exception 'Employee accounts cannot write customer activity' using errcode = '42501';
  end if;

  if new.user_id is null then
    new.user_id := v_auth_uid;
  end if;

  if new.customer_id is null then
    new.customer_id := v_customer_id;
  end if;

  new.event_type := nullif(btrim(coalesce(new.event_type, '')), '');
  if new.event_type is null then
    raise exception 'Customer activity event_type is required' using errcode = '23514';
  end if;

  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  if jsonb_typeof(new.metadata) <> 'object' then
    raise exception 'Customer activity metadata must be a JSON object' using errcode = '23514';
  end if;

  if new.user_id is distinct from v_auth_uid then
    raise exception 'Cannot write activity for another user' using errcode = '42501';
  end if;

  if not (
    new.customer_id = v_customer_id
    or exists (
      select 1
      from public.customer_memberships as cm
      left join public.profiles as p on p.id = cm.user_id
      where cm.customer_id = new.customer_id
        and cm.user_id = v_auth_uid
        and cm.status = 'active'
        and coalesce(p.account_type, 'customer') <> 'employee'
    )
  ) then
    raise exception 'Cannot write activity for another customer' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists partspro_prepare_customer_activity_event
  on public.customer_activity_events;
create trigger partspro_prepare_customer_activity_event
  before insert on public.customer_activity_events
  for each row execute function private.prepare_customer_activity_event();

do $$
begin
  drop policy if exists "partspro_customer_activity_read" on public.customer_activity_events;
  create policy "partspro_customer_activity_read"
    on public.customer_activity_events
    for select
    to authenticated
    using (
      user_id = (select auth.uid())
      or customer_id = (select private.current_customer_id())
      or exists (
        select 1
        from public.customer_memberships as cm
        where cm.customer_id = public.customer_activity_events.customer_id
          and cm.user_id = (select auth.uid())
          and cm.status = 'active'
      )
      or (select private.partspro_has_permission('customers.read'))
    );

  drop policy if exists "partspro_customer_activity_insert" on public.customer_activity_events;
  create policy "partspro_customer_activity_insert"
    on public.customer_activity_events
    for insert
    to authenticated
    with check (
      (
        user_id = (select auth.uid())
        and not exists (
          select 1
          from public.profiles as p
          where p.id = (select auth.uid())
            and p.account_type = 'employee'
        )
        and (
          customer_id = (select private.current_customer_id())
          or exists (
            select 1
            from public.customer_memberships as cm
            where cm.customer_id = public.customer_activity_events.customer_id
              and cm.user_id = (select auth.uid())
              and cm.status = 'active'
          )
        )
      )
    );
end $$;

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

  update public.customers
  set user_id = _user_id,
      updated_at = now()
  where id = v_customer_id
    and user_id is null;

  insert into public.customer_memberships (customer_id, user_id, member_role, status)
  values (v_customer_id, _user_id, 'owner', 'active')
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

  return v_customer_id;
end;
$$;

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
    or new.level_source is distinct from old.level_source
    or new.manual_level_set_by is distinct from old.manual_level_set_by
    or new.manual_level_set_at is distinct from old.manual_level_set_at
    or new.manual_level_reason is distinct from old.manual_level_reason
  then
    if not (select private.partspro_has_permission('customers.manage_level')) then
      raise exception 'Missing customer level permission' using errcode = '42501';
    end if;
  end if;

  if new.price_group_id is distinct from old.price_group_id
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

do $$
begin
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
      or (select private.partspro_has_permission('customers.manage_level'))
    )
    with check (
      (
        (user_id = (select auth.uid()) or id = (select private.current_customer_id()))
        and status = 'active'
      )
      or (select private.partspro_has_permission('customers.manage'))
      or (select private.partspro_has_permission('customers.classify'))
      or (select private.partspro_has_permission('customers.manage_terms'))
      or (select private.partspro_has_permission('customers.manage_level'))
    );
end $$;

do $$
begin
  drop policy if exists "partspro_orders_self_or_staff_read" on public.orders;
  create policy "partspro_orders_self_or_staff_read"
    on public.orders
    for select
    to authenticated
    using (
      (
        not exists (
          select 1
          from public.profiles as p
          where p.id = (select auth.uid())
            and p.account_type = 'employee'
        )
        and (
          user_id = (select auth.uid())
          or customer_id = (select private.current_customer_id())
        )
      )
      or (select private.partspro_has_permission('orders.read'))
    );

  drop policy if exists "partspro_order_lines_self_or_staff_read" on public.order_lines;
  create policy "partspro_order_lines_self_or_staff_read"
    on public.order_lines
    for select
    to authenticated
    using (
      (select private.partspro_has_permission('orders.read'))
      or (
        not exists (
          select 1
          from public.profiles as p
          where p.id = (select auth.uid())
            and p.account_type = 'employee'
        )
        and exists (
          select 1
          from public.orders as o
          where o.id = public.order_lines.order_id
            and (
              o.user_id = (select auth.uid())
              or o.customer_id = (select private.current_customer_id())
            )
        )
      )
    );

  drop policy if exists "partspro_order_events_self_or_staff_read" on public.order_events;
  create policy "partspro_order_events_self_or_staff_read"
    on public.order_events
    for select
    to authenticated
    using (
      (select private.partspro_has_permission('orders.read'))
      or (
        not exists (
          select 1
          from public.profiles as p
          where p.id = (select auth.uid())
            and p.account_type = 'employee'
        )
        and exists (
          select 1
          from public.orders as o
          where o.id = public.order_events.order_id
            and (
              o.user_id = (select auth.uid())
              or o.customer_id = (select private.current_customer_id())
            )
        )
      )
    );
end $$;

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
  v_terms jsonb := coalesce(p_terms, '{}'::jsonb);
begin
  perform private.partspro_assert_permission('customers.manage_terms');
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  if v_terms ? 'tier' or v_terms ? 'level' then
    raise exception 'Use admin_update_customer_level to update customer level' using errcode = '42501';
  end if;

  select * into v_before from public.customers where id = p_customer_id for update;
  if v_before.id is null then
    raise exception 'Customer not found' using errcode = '23503';
  end if;

  update public.customers
  set
    price_group_id = case when v_terms ? 'price_group_id' then nullif(btrim(v_terms ->> 'price_group_id'), '') else price_group_id end,
    monthly_purchase = case when v_terms ? 'monthly_purchase' then nullif(btrim(v_terms ->> 'monthly_purchase'), '') else monthly_purchase end,
    credit_limit = case when v_terms ? 'credit_limit' then greatest(coalesce((v_terms ->> 'credit_limit')::numeric, 0), 0) else credit_limit end,
    payment_terms = case when v_terms ? 'payment_terms' then nullif(btrim(v_terms ->> 'payment_terms'), '') else payment_terms end,
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
    v_terms
  );

  return v_after;
end;
$$;

revoke execute on function public.admin_update_customer_terms(uuid, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_customer_terms(uuid, jsonb, text)
  to authenticated;

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
  v_terms jsonb := coalesce(p_terms, '{}'::jsonb);
  v_has_commercial_terms boolean :=
    (v_terms ? 'price_group_id')
    or (v_terms ? 'credit_limit')
    or (v_terms ? 'payment_terms')
    or (v_terms ? 'monthly_purchase');
begin
  perform private.partspro_assert_permission('customers.classify');

  if v_terms ?| array['tier', 'level', 'priceList', 'customer_level'] then
    raise exception 'Use admin_update_customer_level to update customer level' using errcode = '42501';
  end if;

  if v_has_commercial_terms then
    perform private.partspro_assert_permission('customers.manage_terms');
  end if;

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
      v_terms
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
      coalesce(nullif(v_before_application.company_name, ''), 'Cliente'),
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
      'bronze',
      'bronze',
      case when v_terms ? 'price_group_id' then nullif(btrim(v_terms ->> 'price_group_id'), '') else null end,
      'active',
      'wholesale',
      'assigned',
      '',
      case when v_terms ? 'credit_limit' then greatest(coalesce((v_terms ->> 'credit_limit')::numeric, 0), 0) else 0 end,
      case when v_terms ? 'payment_terms' then nullif(btrim(v_terms ->> 'payment_terms'), '') else null end,
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
        price_group_id = case when v_terms ? 'price_group_id' then nullif(btrim(v_terms ->> 'price_group_id'), '') else price_group_id end,
        status = 'active',
        customer_type = 'wholesale',
        assignment_status = 'assigned',
        credit_limit = case when v_terms ? 'credit_limit' then greatest(coalesce((v_terms ->> 'credit_limit')::numeric, 0), 0) else credit_limit end,
        payment_terms = case when v_terms ? 'payment_terms' then nullif(btrim(v_terms ->> 'payment_terms'), '') else payment_terms end,
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
    v_terms
  );

  return jsonb_build_object(
    'application', to_jsonb(v_after_application),
    'customer', to_jsonb(v_after_customer)
  );
end;
$$;

revoke execute on function public.admin_review_b2b_application(uuid, text, jsonb, text)
  from public, anon;
grant execute on function public.admin_review_b2b_application(uuid, text, jsonb, text)
  to authenticated;

create or replace function public.admin_update_customer_level(
  p_customer_id uuid,
  p_level text,
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
  v_level text := private.normalize_customer_tier(p_level);
begin
  perform private.partspro_assert_permission('customers.manage_level');
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before from public.customers where id = p_customer_id for update;
  if v_before.id is null then
    raise exception 'Customer not found' using errcode = '23503';
  end if;

  update public.customers
  set level = v_level,
      tier = v_level,
      level_source = 'manual',
      manual_level_set_by = (select auth.uid()),
      manual_level_set_at = now(),
      manual_level_reason = nullif(btrim(p_reason), ''),
      updated_at = now()
  where id = p_customer_id
  returning * into v_after;

  perform private.partspro_audit_admin(
    'customer.level_update',
    'customer',
    p_customer_id::text,
    to_jsonb(v_before),
    to_jsonb(v_after),
    p_reason,
    jsonb_build_object('level', v_level, 'levelSource', 'manual')
  );

  return v_after;
end;
$$;

revoke execute on function public.admin_update_customer_level(uuid, text, text)
  from public, anon;
grant execute on function public.admin_update_customer_level(uuid, text, text)
  to authenticated;

create or replace function private.recalculate_customer_level(_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_orders_count integer := 0;
  v_revenue numeric(12, 2) := 0;
  v_lifetime_spend_net numeric(12, 2) := 0;
  v_last_order_at timestamptz;
  v_level text;
begin
  if _customer_id is null then
    return;
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

  select
    count(*)::integer,
    coalesce(sum(total_net), 0)::numeric(12, 2),
    coalesce(sum(total_net) filter (where payment_status = 'paid'), 0)::numeric(12, 2),
    max(created_at)
  into v_orders_count, v_revenue, v_lifetime_spend_net, v_last_order_at
  from public.orders
  where customer_id = _customer_id
    and status <> 'cancelled';

  v_level := private.customer_level_for_spend(v_lifetime_spend_net);

  update public.customers
  set orders_count = v_orders_count,
      revenue = v_revenue,
      last_order_at = v_last_order_at,
      lifetime_spend_net = v_lifetime_spend_net,
      level = case when level_source = 'manual' then level else v_level end,
      tier = case when level_source = 'manual' then tier else v_level end,
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
  if tg_op = 'DELETE' and old.customer_id is not null then
    perform private.recalculate_customer_level(old.customer_id);
    return old;
  end if;

  if tg_op = 'INSERT' and new.customer_id is not null then
    perform private.recalculate_customer_level(new.customer_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.customer_id is not null and old.customer_id is distinct from new.customer_id then
      perform private.recalculate_customer_level(old.customer_id);
    end if;

    perform private.recalculate_customer_level(new.customer_id);
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists partspro_orders_recalculate_customer_level on public.orders;
create trigger partspro_orders_recalculate_customer_level
  after insert or update or delete
  on public.orders
  for each row execute function private.recalculate_customer_level_from_order();

do $$
declare
  v_customer_id uuid;
begin
  for v_customer_id in
    select id from public.customers
  loop
    perform private.recalculate_customer_level(v_customer_id);
  end loop;
end $$;
