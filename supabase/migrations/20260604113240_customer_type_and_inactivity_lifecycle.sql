-- Customer lifecycle hardening:
-- - new customer signups are active shells by default;
-- - checkout still requires assigned + complete profile;
-- - frontend activity keeps last_activity_at fresh;
-- - inactive customers are suspended after 3 months without self-service reactivation.

alter table public.customers
  add column if not exists last_activity_at timestamptz;

alter table public.customers
  alter column status set default 'active',
  alter column customer_type set default 'retail',
  alter column assignment_status set default 'needs_review',
  alter column last_activity_at set default now();

create index if not exists customers_status_last_activity_idx
  on public.customers (status, last_activity_at);

with latest_activity as (
  select
    c.id as customer_id,
    max(a.created_at) as activity_at
  from public.customers as c
  left join public.customer_activity_events as a
    on a.customer_id = c.id
  group by c.id
)
update public.customers as c
set last_activity_at = greatest(
  coalesce(c.last_activity_at, '-infinity'::timestamptz),
  coalesce(c.last_order_at, '-infinity'::timestamptz),
  coalesce(latest_activity.activity_at, '-infinity'::timestamptz),
  coalesce(c.created_at, now())
)
from latest_activity
where latest_activity.customer_id = c.id;

create or replace function private.touch_customer_last_activity(
  p_customer_id uuid,
  p_activity_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_customer_id is null then
    return;
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

  update public.customers
  set last_activity_at = greatest(
        coalesce(last_activity_at, '-infinity'::timestamptz),
        coalesce(p_activity_at, now())
      )
  where id = p_customer_id
    and coalesce(profile_kind, 'customer') = 'customer';
end;
$$;

create or replace function private.touch_customer_last_activity_from_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.touch_customer_last_activity(new.customer_id, new.created_at);

  return new;
end;
$$;

drop trigger if exists partspro_customer_activity_touch_customer
  on public.customer_activity_events;
create trigger partspro_customer_activity_touch_customer
  after insert on public.customer_activity_events
  for each row execute function private.touch_customer_last_activity_from_event();

create or replace function private.touch_customer_last_activity_from_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.touch_customer_last_activity(new.customer_id, new.created_at);

  return new;
end;
$$;

drop trigger if exists partspro_orders_touch_customer_activity
  on public.orders;
create trigger partspro_orders_touch_customer_activity
  after insert on public.orders
  for each row execute function private.touch_customer_last_activity_from_order();

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
  for update;

  if coalesce(v_profile.account_type, 'customer') = 'employee' then
    return v_profile.customer_id;
  end if;

  select candidate.customer_id
  into v_customer_id
  from (
    select c.id as customer_id, 400 as source_rank, c.status, c.assignment_status, c.updated_at, c.created_at
    from public.customers as c
    where c.id = v_profile.customer_id
      and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')

    union all

    select c.id as customer_id, 300 as source_rank, c.status, c.assignment_status, c.updated_at, c.created_at
    from public.customers as c
    where c.user_id = _user_id
      and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')

    union all

    select c.id as customer_id, 200 as source_rank, c.status, c.assignment_status, c.updated_at, c.created_at
    from public.customer_memberships as cm
    join public.customers as c on c.id = cm.customer_id
    where cm.user_id = _user_id
      and cm.status = 'active'
      and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')

    union all

    select c.id as customer_id, 100 as source_rank, c.status, c.assignment_status, c.updated_at, c.created_at
    from public.customers as c
    where nullif(btrim(coalesce(_email, '')), '') is not null
      and lower(c.email) = lower(_email)
      and (c.user_id is null or c.user_id = _user_id)
      and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')
  ) as candidate
  order by
    candidate.source_rank desc,
    case candidate.status when 'active' then 3 when 'pending' then 2 else 1 end desc,
    case candidate.assignment_status when 'assigned' then 3 when 'needs_review' then 2 else 1 end desc,
    candidate.updated_at desc nulls last,
    candidate.created_at desc nulls last
  limit 1;

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
      profile_completed_at,
      last_activity_at
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
      null,
      now()
    )
    returning id into v_customer_id;
  end if;

  update public.profiles
  set customer_id = v_customer_id,
      account_type = 'customer',
      role = 'customer',
      role_template = null,
      updated_at = now()
  where id = _user_id;

  update public.customers
  set user_id = _user_id,
      last_activity_at = coalesce(last_activity_at, now()),
      updated_at = now()
  where id = v_customer_id
    and user_id is null;

  insert into public.customer_memberships (customer_id, user_id, member_role, status)
  values (v_customer_id, _user_id, 'owner', 'active')
  on conflict (customer_id, user_id) do update
  set member_role = 'owner',
      status = 'active',
      updated_at = now();

  return v_customer_id;
end;
$$;

grant execute on function private.ensure_user_account(uuid, text, text, text, text)
  to authenticated;

create or replace function public.update_current_customer_profile(p_profile jsonb)
returns public.customers
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_user record;
  v_customer public.customers%rowtype;
  v_next public.customers%rowtype;
  v_customer_id uuid;
  v_company_name text;
  v_contact_name text;
  v_email text;
  v_phone text;
  v_vat_number text;
  v_fiscal_code text;
  v_sdi text;
  v_pec text;
  v_billing_address text;
  v_shipping_address text;
  v_customer_type text;
  v_complete boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

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

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if v_profile.id is null or coalesce(v_profile.account_type, 'customer') <> 'employee' then
    v_customer_id := private.ensure_user_account(
      v_user_id,
      v_user.email,
      v_user.provider,
      v_user.display_name,
      v_user.avatar_url
    );

    select *
    into v_customer
    from public.customers
    where id = v_customer_id
    for update;
  else
    perform public.ensure_employee_self_customer();

    select *
    into v_customer
    from public.customers
    where user_id = v_user_id
      and profile_kind = 'employee_self'
    order by created_at desc
    limit 1
    for update;
  end if;

  if v_customer.id is null then
    raise exception 'No matching customer profile was found' using errcode = '23503';
  end if;

  v_company_name := case when p_profile ? 'company_name' then nullif(btrim(p_profile ->> 'company_name'), '') else v_customer.company_name end;
  v_contact_name := case when p_profile ? 'contact_name' then nullif(btrim(p_profile ->> 'contact_name'), '') else v_customer.contact_name end;
  v_email := case when p_profile ? 'email' then nullif(btrim(p_profile ->> 'email'), '') else v_customer.email end;
  v_phone := case when p_profile ? 'phone' then nullif(btrim(p_profile ->> 'phone'), '') else v_customer.phone end;
  v_vat_number := case when p_profile ? 'vat_number' then nullif(btrim(p_profile ->> 'vat_number'), '') else v_customer.vat_number end;
  v_fiscal_code := case when p_profile ? 'fiscal_code' then nullif(btrim(p_profile ->> 'fiscal_code'), '') else v_customer.fiscal_code end;
  v_sdi := case when p_profile ? 'sdi' then nullif(btrim(p_profile ->> 'sdi'), '') else v_customer.sdi end;
  v_pec := case when p_profile ? 'pec' then nullif(btrim(p_profile ->> 'pec'), '') else v_customer.pec end;
  v_billing_address := case when p_profile ? 'billing_address' then nullif(btrim(p_profile ->> 'billing_address'), '') else v_customer.billing_address end;
  v_shipping_address := case when p_profile ? 'shipping_address' then nullif(btrim(p_profile ->> 'shipping_address'), '') else v_customer.shipping_address end;
  v_customer_type := coalesce(nullif(v_customer.customer_type, ''), 'retail');

  v_complete :=
    nullif(coalesce(v_company_name, ''), '') is not null
    and nullif(coalesce(v_contact_name, ''), '') is not null
    and nullif(coalesce(v_email, ''), '') is not null
    and nullif(coalesce(v_phone, ''), '') is not null
    and nullif(coalesce(v_billing_address, ''), '') is not null
    and nullif(coalesce(v_shipping_address, ''), '') is not null
    and (
      (
        v_customer_type = 'retail'
        and coalesce(nullif(v_fiscal_code, ''), nullif(v_vat_number, ''), '') <> ''
      )
      or (
        v_customer_type = 'wholesale'
        and nullif(coalesce(v_vat_number, ''), '') is not null
        and nullif(coalesce(v_fiscal_code, ''), '') is not null
        and coalesce(nullif(v_pec, ''), nullif(v_sdi, ''), '') <> ''
      )
    );

  update public.customers
  set company_name = v_company_name,
      contact_name = v_contact_name,
      email = coalesce(v_email, v_user.email, email),
      phone = v_phone,
      vat_number = v_vat_number,
      fiscal_code = v_fiscal_code,
      sdi = v_sdi,
      pec = v_pec,
      billing_address = v_billing_address,
      shipping_address = v_shipping_address,
      profile_completed_at = case when v_complete then coalesce(profile_completed_at, now()) else null end,
      status = case
        when coalesce(profile_kind, 'customer') = 'employee_self' then status
        when status = 'suspended' then status
        when v_complete then 'active'
        else status
      end,
      assignment_status = case
        when coalesce(profile_kind, 'customer') = 'employee_self' then assignment_status
        when status = 'suspended' then assignment_status
        when v_complete then 'assigned'
        else assignment_status
      end,
      customer_type = case
        when coalesce(profile_kind, 'customer') = 'employee_self' then customer_type
        when status = 'suspended' then customer_type
        when v_complete then case when customer_type = 'wholesale' then 'wholesale' else 'retail' end
        else coalesce(nullif(customer_type, ''), 'retail')
      end,
      last_activity_at = greatest(
        coalesce(last_activity_at, '-infinity'::timestamptz),
        now()
      ),
      updated_at = now()
  where id = v_customer.id
  returning * into v_next;

  if coalesce(v_next.profile_kind, 'customer') <> 'employee_self' then
    update public.profiles
    set customer_id = v_next.id,
        account_type = 'customer',
        role = 'customer',
        role_template = null,
        updated_at = now()
    where id = v_user_id;

    insert into public.customer_memberships (customer_id, user_id, member_role, status)
    values (v_next.id, v_user_id, 'owner', 'active')
    on conflict (customer_id, user_id) do update
    set member_role = 'owner',
        status = 'active',
        updated_at = now();
  end if;

  return v_next;
end;
$$;

revoke execute on function public.update_current_customer_profile(jsonb)
  from public, anon;
grant execute on function public.update_current_customer_profile(jsonb)
  to authenticated;

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
  v_next_status text;
  v_next_customer_type text;
  v_next_assignment_status text;
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

  v_next_status := case
    when p_customer ? 'status' then nullif(btrim(p_customer ->> 'status'), '')
    else v_before.status
  end;
  v_next_customer_type := case
    when p_customer ? 'customer_type' then nullif(btrim(p_customer ->> 'customer_type'), '')
    else v_before.customer_type
  end;
  v_next_assignment_status := case
    when p_customer ? 'assignment_status' then nullif(btrim(p_customer ->> 'assignment_status'), '')
    else v_before.assignment_status
  end;

  if v_next_status is null or v_next_status not in ('pending', 'active', 'suspended') then
    raise exception 'Invalid customer status' using errcode = '23514';
  end if;

  if v_next_customer_type is null or v_next_customer_type not in ('retail', 'wholesale') then
    raise exception 'Invalid customer type' using errcode = '23514';
  end if;

  if v_next_assignment_status is null
    or v_next_assignment_status not in ('needs_review', 'assigned', 'converted_to_employee', 'archived') then
    raise exception 'Invalid customer assignment status' using errcode = '23514';
  end if;

  update public.customers
  set
    status = v_next_status,
    customer_type = v_next_customer_type,
    assignment_status = v_next_assignment_status,
    assigned_by = (select auth.uid()),
    assigned_at = now(),
    last_activity_at = case
      when v_before.status = 'suspended' and v_next_status = 'active'
        then now()
      else last_activity_at
    end,
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

create or replace function private.suspend_inactive_customers(
  p_cutoff timestamptz default now() - interval '3 months'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_suspended integer := 0;
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  with candidates as (
    select c.*
    from public.customers as c
    where c.status = 'active'
      and coalesce(c.profile_kind, 'customer') = 'customer'
      and coalesce(c.last_activity_at, c.last_order_at, c.created_at) < p_cutoff
    for update
  ),
  updated as (
    update public.customers as c
    set status = 'suspended',
        updated_at = now()
    from candidates
    where c.id = candidates.id
    returning c.*
  ),
  audited as (
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
      request_metadata,
      result
    )
    select
      null::uuid,
      null::text,
      'system',
      'customer.auto_suspended_inactive',
      'customer',
      before_customer.id::text,
      to_jsonb(before_customer),
      to_jsonb(after_customer),
      '超过 3 个月无前台活动自动暂停',
      jsonb_build_object(
        'cutoff', p_cutoff,
        'last_activity_at', before_customer.last_activity_at,
        'source', 'private.suspend_inactive_customers'
      ),
      'success'
    from candidates as before_customer
    join updated as after_customer
      on after_customer.id = before_customer.id
    returning 1
  )
  select count(*) into v_suspended from updated;

  return coalesce(v_suspended, 0);
end;
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'partspro_suspend_inactive_customers',
  '15 2 * * *',
  $$select private.suspend_inactive_customers();$$
);
