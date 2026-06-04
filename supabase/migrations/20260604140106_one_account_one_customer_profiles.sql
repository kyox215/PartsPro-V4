-- One account, one customer profile:
-- - customer accounts always have a normal customers row;
-- - admin accounts UI no longer treats customer membership as a separate binding feature;
-- - customer shells default to active + retail + needs_review.

create or replace function private.pick_customer_for_account_profile(
  p_user_id uuid,
  p_email text,
  p_customer_id uuid default null
)
returns uuid
language sql
security definer
set search_path = public, pg_temp
as $$
  select candidate.customer_id
  from (
    select c.id as customer_id, 400 as source_rank, c.status, c.assignment_status, c.updated_at, c.created_at
    from public.customers as c
    where c.id = p_customer_id
      and (c.user_id is null or c.user_id = p_user_id)
      and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')

    union all

    select c.id as customer_id, 300 as source_rank, c.status, c.assignment_status, c.updated_at, c.created_at
    from public.customers as c
    where c.user_id = p_user_id
      and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')

    union all

    select c.id as customer_id, 200 as source_rank, c.status, c.assignment_status, c.updated_at, c.created_at
    from public.customer_memberships as cm
    join public.customers as c on c.id = cm.customer_id
    where cm.user_id = p_user_id
      and cm.status = 'active'
      and cm.member_role = 'owner'
      and (c.user_id is null or c.user_id = p_user_id)
      and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')

    union all

    select c.id as customer_id, 100 as source_rank, c.status, c.assignment_status, c.updated_at, c.created_at
    from public.customers as c
    where nullif(btrim(coalesce(p_email, '')), '') is not null
      and lower(c.email) = lower(p_email)
      and (c.user_id is null or c.user_id = p_user_id)
      and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')
  ) as candidate
  order by
    candidate.source_rank desc,
    case candidate.status when 'active' then 3 when 'pending' then 2 else 1 end desc,
    case candidate.assignment_status when 'assigned' then 3 when 'needs_review' then 2 else 1 end desc,
    candidate.updated_at desc nulls last,
    candidate.created_at desc nulls last
  limit 1;
$$;

create or replace function private.ensure_customer_profile_for_account(
  p_user_id uuid,
  p_email text,
  p_display_name text,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer_id uuid;
  v_company_name text;
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  v_customer_id := private.pick_customer_for_account_profile(
    p_user_id,
    p_email,
    p_customer_id
  );

  if v_customer_id is null then
    v_company_name := coalesce(nullif(p_display_name, ''), nullif(p_email, ''), 'Cliente PartsPro');

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
      profile_completed_at,
      profile_kind,
      last_activity_at
    )
    values (
      p_user_id,
      v_company_name,
      coalesce(nullif(p_display_name, ''), ''),
      coalesce(nullif(p_email, ''), ''),
      'active',
      'bronze',
      'retail',
      'needs_review',
      'bronze',
      0,
      null,
      'customer',
      now()
    )
    returning id into v_customer_id;
  else
    update public.customers
    set user_id = coalesce(user_id, p_user_id),
        status = coalesce(nullif(status, ''), 'active'),
        customer_type = coalesce(nullif(customer_type, ''), 'retail'),
        assignment_status = coalesce(nullif(assignment_status, ''), 'needs_review'),
        level = coalesce(nullif(level, ''), 'bronze'),
        profile_kind = case
          when coalesce(profile_kind, 'customer') = 'customer' then 'customer'
          else profile_kind
        end,
        last_activity_at = coalesce(last_activity_at, now()),
        updated_at = now()
    where id = v_customer_id
      and (user_id is null or user_id = p_user_id);
  end if;

  update public.profiles
  set account_type = 'customer',
      role = 'customer',
      role_template = null,
      customer_id = v_customer_id,
      updated_at = now()
  where id = p_user_id;

  insert into public.customer_memberships (customer_id, user_id, member_role, status)
  values (v_customer_id, p_user_id, 'owner', 'active')
  on conflict (customer_id, user_id) do update
  set member_role = 'owner',
      status = 'active',
      updated_at = now();

  return v_customer_id;
end;
$$;

do $$
declare
  v_profile record;
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  for v_profile in
    select id, email, display_name, customer_id
    from public.profiles
    where coalesce(account_type, 'customer') = 'customer'
  loop
    perform private.ensure_customer_profile_for_account(
      v_profile.id,
      v_profile.email,
      v_profile.display_name,
      v_profile.customer_id
    );
  end loop;
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
  for update;

  if coalesce(v_profile.account_type, 'customer') = 'employee' then
    return v_profile.customer_id;
  end if;

  v_customer_id := private.ensure_customer_profile_for_account(
    _user_id,
    coalesce(_email, v_profile.email),
    coalesce(_display_name, v_profile.display_name),
    v_profile.customer_id
  );

  return v_customer_id;
end;
$$;

grant execute on function private.ensure_user_account(uuid, text, text, text, text)
  to authenticated;

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
      and coalesce(profile_kind, 'customer') = 'customer'
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

  return jsonb_build_object('account_type', 'customer', 'profile', to_jsonb(v_after_profile), 'customer', to_jsonb(v_after_customer));
end;
$$;

grant execute on function public.admin_update_account_type(uuid, text, text, text, text)
  to authenticated;
