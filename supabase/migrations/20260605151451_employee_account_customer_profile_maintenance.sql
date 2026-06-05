-- Employee accounts need two separate customer rows:
-- - profile_kind = customer: the historical/admin-maintained customer profile;
-- - profile_kind = employee_self: the staff self-purchase checkout profile.

drop index if exists public.customers_user_id_unique_idx;

do $$
begin
  if to_regclass('public.customers_user_id_profile_kind_unique_idx') is null then
    if exists (
      select 1
      from public.customers
      where user_id is not null
        and profile_kind in ('customer', 'employee_self')
      group by user_id, profile_kind
      having count(*) > 1
    ) then
      raise notice 'Skipped customers_user_id_profile_kind_unique_idx because duplicate customer rows already exist for the same user/profile_kind.';
    else
      execute $create_index$
        create unique index customers_user_id_profile_kind_unique_idx
          on public.customers (user_id, profile_kind)
          where user_id is not null
            and profile_kind in ('customer', 'employee_self')
      $create_index$;
    end if;
  end if;
end $$;

create or replace function public.ensure_employee_self_customer()
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_customer public.customers%rowtype;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if v_profile.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if coalesce(v_profile.account_type, 'customer') <> 'employee' then
    raise exception 'Only employee accounts can create employee self checkout profiles'
      using errcode = '42501';
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

  select *
  into v_customer
  from public.customers
  where user_id = v_user_id
    and profile_kind = 'employee_self'
  order by created_at desc
  limit 1
  for update;

  v_display_name := coalesce(
    nullif(v_profile.display_name, ''),
    nullif(v_profile.email, ''),
    'Dipendente PartsPro'
  );

  if v_customer.id is null then
    insert into public.customers (
      user_id,
      company_name,
      contact_name,
      email,
      tier,
      level,
      status,
      customer_type,
      assignment_status,
      profile_kind
    )
    values (
      v_user_id,
      v_display_name,
      v_display_name,
      coalesce(v_profile.email, ''),
      'bronze',
      'bronze',
      'active',
      'wholesale',
      'assigned',
      'employee_self'
    )
    returning * into v_customer;
  else
    update public.customers
    set status = 'active',
        customer_type = 'wholesale',
        assignment_status = 'assigned',
        company_name = coalesce(nullif(company_name, ''), v_display_name),
        contact_name = coalesce(nullif(contact_name, ''), v_display_name),
        email = coalesce(nullif(email, ''), coalesce(v_profile.email, '')),
        updated_at = now()
    where id = v_customer.id
      and profile_kind = 'employee_self'
    returning * into v_customer;
  end if;

  update public.profiles
  set customer_id = v_customer.id,
      updated_at = now()
  where id = v_user_id
    and customer_id is distinct from v_customer.id;

  update public.customer_memberships
  set status = 'disabled',
      updated_at = now()
  where user_id = v_user_id
    and status = 'active';

  return v_customer.id;
end;
$$;

grant execute on function public.ensure_employee_self_customer() to authenticated;

do $$
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  insert into public.customers (
    user_id,
    company_name,
    contact_name,
    email,
    phone,
    vat_number,
    fiscal_code,
    sdi,
    pec,
    billing_address,
    shipping_address,
    tier,
    level,
    lifetime_spend_net,
    orders_count,
    revenue,
    last_order_at,
    last_activity_at,
    profile_completed_at,
    status,
    customer_type,
    assignment_status,
    profile_kind,
    converted_to_employee_at,
    created_at,
    updated_at
  )
  select
    employee_self.user_id,
    coalesce(nullif(employee_self.company_name, ''), nullif(profile.display_name, ''), nullif(profile.email, ''), 'Cliente PartsPro'),
    coalesce(nullif(employee_self.contact_name, ''), nullif(profile.display_name, ''), ''),
    coalesce(nullif(employee_self.email, ''), coalesce(profile.email, '')),
    employee_self.phone,
    employee_self.vat_number,
    employee_self.fiscal_code,
    employee_self.sdi,
    employee_self.pec,
    employee_self.billing_address,
    employee_self.shipping_address,
    coalesce(nullif(employee_self.tier, ''), 'bronze'),
    coalesce(nullif(employee_self.level, ''), 'bronze'),
    coalesce(employee_self.lifetime_spend_net, 0),
    coalesce(employee_self.orders_count, 0),
    coalesce(employee_self.revenue, 0),
    employee_self.last_order_at,
    employee_self.last_activity_at,
    employee_self.profile_completed_at,
    'suspended',
    coalesce(nullif(employee_self.customer_type, ''), 'wholesale'),
    'converted_to_employee',
    'customer',
    coalesce(employee_self.converted_to_employee_at, now()),
    coalesce(employee_self.created_at, now()),
    now()
  from public.customers as employee_self
  join public.profiles as profile
    on profile.id = employee_self.user_id
  where coalesce(profile.account_type, 'customer') = 'employee'
    and employee_self.profile_kind = 'employee_self'
    and employee_self.user_id is not null
    and not exists (
      select 1
      from public.customers as normal_customer
      where coalesce(normal_customer.profile_kind, 'customer') = 'customer'
        and (
          normal_customer.user_id = employee_self.user_id
          or (
            normal_customer.user_id is null
            and nullif(profile.email, '') is not null
            and lower(normal_customer.email) = lower(profile.email)
          )
        )
    );
end $$;

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

    v_customer_id := private.pick_customer_for_account_profile(
      p_user_id,
      v_before_profile.email,
      v_before_profile.customer_id
    );

    if v_customer_id is not null then
      select * into v_before_customer from public.customers where id = v_customer_id for update;
    end if;

    update public.profiles
    set account_type = 'employee',
        role = coalesce(nullif(role_template, ''), 'sales_support'),
        role_template = coalesce(nullif(role_template, ''), 'sales_support'),
        customer_id = null,
        updated_at = now()
    where id = p_user_id
    returning * into v_after_profile;

    if v_customer_id is not null then
      update public.customers
      set user_id = p_user_id,
          profile_kind = 'customer',
          assignment_status = 'converted_to_employee',
          status = 'suspended',
          converted_to_employee_at = now(),
          updated_at = now()
      where id = v_customer_id
      returning * into v_after_customer;
    end if;

    update public.customer_memberships
    set status = 'disabled',
        updated_at = now()
    where user_id = p_user_id;

    perform private.partspro_audit_admin(
      'account.type_update',
      'profile',
      p_user_id::text,
      to_jsonb(v_before_profile),
      jsonb_build_object(
        'profile', to_jsonb(v_after_profile),
        'customer_before', to_jsonb(v_before_customer),
        'customer', to_jsonb(v_after_customer)
      ),
      p_reason,
      jsonb_build_object('account_type', p_account_type)
    );

    return jsonb_build_object(
      'account_type', 'employee',
      'profile', to_jsonb(v_after_profile),
      'customer', to_jsonb(v_after_customer)
    );
  end if;

  perform private.partspro_assert_permission('customers.classify');

  v_customer_id := private.pick_customer_for_account_profile(
    p_user_id,
    v_before_profile.email,
    v_before_profile.customer_id
  );

  if v_customer_id is not null then
    select * into v_before_customer from public.customers where id = v_customer_id for update;
  end if;

  v_customer_id := private.ensure_customer_profile_for_account(
    p_user_id,
    v_before_profile.email,
    v_before_profile.display_name,
    v_before_profile.customer_id
  );

  update public.customers
  set customer_type = coalesce(nullif(p_customer_type, ''), nullif(customer_type, ''), 'retail'),
      assignment_status = coalesce(nullif(p_assignment_status, ''), nullif(assignment_status, ''), 'needs_review'),
      status = 'active',
      assigned_by = (select auth.uid()),
      assigned_at = now(),
      last_activity_at = coalesce(last_activity_at, now()),
      updated_at = now()
  where id = v_customer_id
  returning * into v_after_customer;

  select * into v_after_profile from public.profiles where id = p_user_id;

  perform private.partspro_audit_admin(
    'account.type_update',
    'profile',
    p_user_id::text,
    to_jsonb(v_before_profile),
    jsonb_build_object(
      'profile', to_jsonb(v_after_profile),
      'customer_before', to_jsonb(v_before_customer),
      'customer', to_jsonb(v_after_customer)
    ),
    p_reason,
    jsonb_build_object('account_type', p_account_type)
  );

  return jsonb_build_object(
    'account_type', 'customer',
    'profile', to_jsonb(v_after_profile),
    'customer', to_jsonb(v_after_customer)
  );
end;
$$;

grant execute on function public.admin_update_account_type(uuid, text, text, text, text)
  to authenticated;
