-- Email OTP signups should create a customer shell that is visible to staff
-- but not commercially active until reviewed.

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
      'pending',
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

grant execute on function private.ensure_user_account(uuid, text, text, text, text) to authenticated;

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
        and status in ('pending', 'active')
      )
      or (select private.partspro_has_permission('customers.manage'))
      or (select private.partspro_has_permission('customers.classify'))
      or (select private.partspro_has_permission('customers.manage_terms'))
      or (select private.partspro_has_permission('customers.manage_level'))
    );
end $$;
