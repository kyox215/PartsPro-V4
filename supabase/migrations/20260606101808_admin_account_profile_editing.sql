-- Allow the admin account workbench to create/edit the same profile row used by
-- storefront account details without weakening customer/employee boundaries.

create or replace function public.admin_ensure_customer_profile(
  p_user_id uuid,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_customer_id uuid;
  v_customer public.customers%rowtype;
begin
  perform private.partspro_assert_permission('customers.classify');

  if p_user_id is null then
    raise exception 'User id is required' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if v_profile.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if coalesce(v_profile.account_type, 'customer') = 'employee' then
    raise exception 'Use admin_ensure_employee_self_customer for employee accounts'
      using errcode = '42501';
  end if;

  v_customer_id := private.ensure_customer_profile_for_account(
    p_user_id,
    v_profile.email,
    v_profile.display_name,
    v_profile.customer_id
  );

  select *
  into v_customer
  from public.customers
  where id = v_customer_id;

  perform private.partspro_audit_admin(
    'customer.profile_ensure',
    'customer',
    v_customer.id::text,
    '{}'::jsonb,
    to_jsonb(v_customer),
    p_reason,
    jsonb_build_object(
      'user_id', p_user_id,
      'profile_kind', coalesce(v_customer.profile_kind, 'customer'),
      'rpc', 'admin_ensure_customer_profile'
    )
  );

  return v_customer;
end;
$$;

revoke execute on function public.admin_ensure_customer_profile(uuid, text)
  from public, anon;
grant execute on function public.admin_ensure_customer_profile(uuid, text)
  to authenticated;

create or replace function public.admin_ensure_employee_self_customer(
  p_user_id uuid,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_before public.customers%rowtype;
  v_after public.customers%rowtype;
  v_display_name text;
begin
  perform private.partspro_assert_permission('employees.manage_permissions');

  if p_user_id is null then
    raise exception 'User id is required' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if v_profile.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if coalesce(v_profile.account_type, 'customer') <> 'employee' then
    raise exception 'Only employee accounts can create employee self checkout profiles'
      using errcode = '42501';
  end if;

  select *
  into v_before
  from public.customers
  where user_id = p_user_id
    and profile_kind = 'employee_self'
  order by created_at desc
  limit 1
  for update;

  v_display_name := coalesce(
    nullif(v_profile.display_name, ''),
    nullif(v_profile.email, ''),
    'Dipendente PartsPro'
  );

  if v_before.id is null then
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
      p_user_id,
      v_display_name,
      '',
      coalesce(v_profile.email, ''),
      'bronze',
      'bronze',
      'active',
      'wholesale',
      'assigned',
      'employee_self'
    )
    returning * into v_after;
  else
    update public.customers
    set status = 'active',
        customer_type = 'wholesale',
        assignment_status = 'assigned',
        company_name = coalesce(nullif(company_name, ''), v_display_name),
        email = coalesce(nullif(email, ''), coalesce(v_profile.email, '')),
        updated_at = now()
    where id = v_before.id
      and profile_kind = 'employee_self'
    returning * into v_after;
  end if;

  update public.profiles
  set customer_id = v_after.id,
      updated_at = now()
  where id = p_user_id
    and customer_id is distinct from v_after.id;

  update public.customer_memberships
  set status = 'disabled',
      updated_at = now()
  where user_id = p_user_id
    and status = 'active';

  perform private.partspro_audit_admin(
    'employee.self_customer_ensure',
    'customer',
    v_after.id::text,
    case when v_before.id is null then '{}'::jsonb else to_jsonb(v_before) end,
    to_jsonb(v_after),
    p_reason,
    jsonb_build_object(
      'user_id', p_user_id,
      'profile_kind', 'employee_self',
      'rpc', 'admin_ensure_employee_self_customer'
    )
  );

  return v_after;
end;
$$;

revoke execute on function public.admin_ensure_employee_self_customer(uuid, text)
  from public, anon;
grant execute on function public.admin_ensure_employee_self_customer(uuid, text)
  to authenticated;

create or replace function public.admin_update_customer_profile(
  p_customer_id uuid,
  p_customer jsonb,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_before public.customers%rowtype;
  v_after public.customers%rowtype;
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
  v_complete boolean;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  if coalesce(p_customer, '{}'::jsonb) ? 'registered_address' then
    raise exception 'Registered address is no longer edited from the account profile'
      using errcode = '23514';
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

  select *
  into v_before
  from public.customers
  where id = p_customer_id
  for update;

  if v_before.id is null then
    raise exception 'Customer not found' using errcode = '23503';
  end if;

  if coalesce(v_before.profile_kind, 'customer') = 'employee_self' then
    perform private.partspro_assert_permission('customers.classify');
  elsif coalesce(v_before.profile_kind, 'customer') = 'archived_customer' then
    raise exception 'Archived customer profiles cannot be edited'
      using errcode = '42501';
  else
    perform private.partspro_assert_permission('customers.classify');
  end if;

  v_company_name := case
    when coalesce(p_customer, '{}'::jsonb) ? 'company_name' then nullif(btrim(p_customer ->> 'company_name'), '')
    else v_before.company_name
  end;
  v_contact_name := case
    when coalesce(p_customer, '{}'::jsonb) ? 'contact_name' then nullif(btrim(p_customer ->> 'contact_name'), '')
    else v_before.contact_name
  end;
  v_email := case
    when coalesce(p_customer, '{}'::jsonb) ? 'email' then nullif(btrim(p_customer ->> 'email'), '')
    else v_before.email
  end;
  v_phone := case
    when coalesce(p_customer, '{}'::jsonb) ? 'phone' then nullif(btrim(p_customer ->> 'phone'), '')
    else v_before.phone
  end;
  v_vat_number := case
    when coalesce(p_customer, '{}'::jsonb) ? 'vat_number' then nullif(btrim(p_customer ->> 'vat_number'), '')
    else v_before.vat_number
  end;
  v_fiscal_code := case
    when coalesce(p_customer, '{}'::jsonb) ? 'fiscal_code' then nullif(btrim(p_customer ->> 'fiscal_code'), '')
    else v_before.fiscal_code
  end;
  v_sdi := case
    when coalesce(p_customer, '{}'::jsonb) ? 'sdi' then nullif(btrim(p_customer ->> 'sdi'), '')
    else v_before.sdi
  end;
  v_pec := case
    when coalesce(p_customer, '{}'::jsonb) ? 'pec' then nullif(btrim(p_customer ->> 'pec'), '')
    else v_before.pec
  end;
  v_billing_address := case
    when coalesce(p_customer, '{}'::jsonb) ? 'billing_address' then nullif(btrim(p_customer ->> 'billing_address'), '')
    else v_before.billing_address
  end;
  v_shipping_address := case
    when coalesce(p_customer, '{}'::jsonb) ? 'shipping_address' then nullif(btrim(p_customer ->> 'shipping_address'), '')
    else v_before.shipping_address
  end;

  v_complete := private.is_customer_profile_complete_for_checkout(
    v_company_name,
    v_email,
    v_phone,
    v_fiscal_code,
    v_billing_address,
    v_shipping_address
  );

  update public.customers
  set company_name = v_company_name,
      contact_name = v_contact_name,
      email = v_email,
      phone = v_phone,
      vat_number = v_vat_number,
      fiscal_code = v_fiscal_code,
      sdi = v_sdi,
      pec = v_pec,
      billing_address = v_billing_address,
      shipping_address = v_shipping_address,
      profile_completed_at = case when v_complete then coalesce(profile_completed_at, now()) else null end,
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
    coalesce(p_customer, '{}'::jsonb) || jsonb_build_object(
      'profile_kind', coalesce(v_after.profile_kind, 'customer'),
      'profile_complete', v_complete,
      'rpc', 'admin_update_customer_profile'
    )
  );

  return v_after;
end;
$$;

revoke execute on function public.admin_update_customer_profile(uuid, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_customer_profile(uuid, jsonb, text)
  to authenticated;

-- Employee accounts use their employee_self row as the current commercial
-- profile. Historical normal customer rows remain read-only conversion history.

create or replace function public.admin_ensure_employee_self_customer(
  p_user_id uuid,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_source public.customers%rowtype;
  v_before public.customers%rowtype;
  v_after public.customers%rowtype;
  v_display_name text;
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
  v_level text;
  v_tier text;
  v_customer_type text;
  v_complete boolean;
begin
  if not (
    coalesce((select private.partspro_has_permission('customers.classify')), false)
    or coalesce((select private.partspro_has_permission('customers.manage_level')), false)
  ) then
    raise exception 'Missing admin permission: customers.classify or customers.manage_level'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'User id is required' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

  select *
  into v_profile
  from public.profiles
  where id = p_user_id
  for update;

  if v_profile.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if coalesce(v_profile.account_type, 'customer') <> 'employee' then
    raise exception 'Only employee accounts can create employee self checkout profiles'
      using errcode = '42501';
  end if;

  select *
  into v_source
  from public.customers
  where coalesce(profile_kind, 'customer') = 'customer'
    and (
      user_id = p_user_id
      or (
        user_id is null
        and nullif(v_profile.email, '') is not null
        and lower(email) = lower(v_profile.email)
      )
    )
  order by
    case when assignment_status = 'converted_to_employee' then 0 else 1 end,
    converted_to_employee_at desc nulls last,
    updated_at desc nulls last,
    created_at desc nulls last
  limit 1
  for update;

  select *
  into v_before
  from public.customers
  where user_id = p_user_id
    and profile_kind = 'employee_self'
  order by created_at desc
  limit 1
  for update;

  v_display_name := coalesce(
    nullif(v_source.company_name, ''),
    nullif(v_profile.display_name, ''),
    nullif(v_profile.email, ''),
    'Dipendente PartsPro'
  );
  v_company_name := coalesce(nullif(v_source.company_name, ''), v_display_name);
  v_contact_name := coalesce(nullif(v_source.contact_name, ''), '');
  v_email := coalesce(nullif(v_source.email, ''), coalesce(v_profile.email, ''));
  v_phone := nullif(v_source.phone, '');
  v_vat_number := nullif(v_source.vat_number, '');
  v_fiscal_code := nullif(v_source.fiscal_code, '');
  v_sdi := nullif(v_source.sdi, '');
  v_pec := nullif(v_source.pec, '');
  v_billing_address := nullif(v_source.billing_address, '');
  v_shipping_address := nullif(v_source.shipping_address, '');
  v_level := coalesce(nullif(v_source.level, ''), nullif(v_source.tier, ''), 'bronze');
  v_tier := coalesce(nullif(v_source.tier, ''), v_level, 'bronze');
  v_customer_type := coalesce(nullif(v_source.customer_type, ''), 'wholesale');
  v_complete := private.is_customer_profile_complete_for_checkout(
    v_company_name,
    v_email,
    v_phone,
    v_fiscal_code,
    v_billing_address,
    v_shipping_address
  );

  if v_before.id is null then
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
      status,
      customer_type,
      assignment_status,
      profile_kind,
      profile_completed_at
    )
    values (
      p_user_id,
      v_company_name,
      v_contact_name,
      v_email,
      v_phone,
      v_vat_number,
      v_fiscal_code,
      v_sdi,
      v_pec,
      v_billing_address,
      v_shipping_address,
      v_tier,
      v_level,
      'active',
      v_customer_type,
      'assigned',
      'employee_self',
      case when v_complete then coalesce(v_source.profile_completed_at, now()) else null end
    )
    returning * into v_after;
  else
    update public.customers
    set company_name = coalesce(nullif(company_name, ''), v_company_name),
        contact_name = coalesce(nullif(contact_name, ''), v_contact_name, ''),
        email = coalesce(nullif(email, ''), v_email),
        phone = coalesce(nullif(phone, ''), v_phone),
        vat_number = coalesce(nullif(vat_number, ''), v_vat_number),
        fiscal_code = coalesce(nullif(fiscal_code, ''), v_fiscal_code),
        sdi = coalesce(nullif(sdi, ''), v_sdi),
        pec = coalesce(nullif(pec, ''), v_pec),
        billing_address = coalesce(nullif(billing_address, ''), v_billing_address),
        shipping_address = coalesce(nullif(shipping_address, ''), v_shipping_address),
        level = case
          when coalesce(nullif(level, ''), 'bronze') = 'bronze'
            and nullif(v_source.level, '') is not null
            then v_source.level
          else coalesce(nullif(level, ''), 'bronze')
        end,
        tier = case
          when coalesce(nullif(tier, ''), 'bronze') = 'bronze'
            and coalesce(nullif(v_source.tier, ''), nullif(v_source.level, '')) is not null
            then coalesce(nullif(v_source.tier, ''), v_source.level)
          else coalesce(nullif(tier, ''), coalesce(nullif(level, ''), 'bronze'))
        end,
        customer_type = case
          when coalesce(nullif(level, ''), 'bronze') = 'bronze'
            and coalesce(orders_count, 0) = 0
            and coalesce(revenue, 0) = 0
            and nullif(v_source.customer_type, '') is not null
            then v_source.customer_type
          else coalesce(nullif(customer_type, ''), v_customer_type)
        end,
        profile_completed_at = case
          when private.is_customer_profile_complete_for_checkout(
            coalesce(nullif(company_name, ''), v_company_name),
            coalesce(nullif(email, ''), v_email),
            coalesce(nullif(phone, ''), v_phone),
            coalesce(nullif(fiscal_code, ''), v_fiscal_code),
            coalesce(nullif(billing_address, ''), v_billing_address),
            coalesce(nullif(shipping_address, ''), v_shipping_address)
          )
            then coalesce(profile_completed_at, v_source.profile_completed_at, now())
          else null
        end,
        updated_at = now()
    where id = v_before.id
      and profile_kind = 'employee_self'
    returning * into v_after;
  end if;

  update public.profiles
  set customer_id = v_after.id,
      updated_at = now()
  where id = p_user_id
    and customer_id is distinct from v_after.id;

  update public.customer_memberships
  set status = 'disabled',
      updated_at = now()
  where user_id = p_user_id
    and status = 'active';

  perform private.partspro_audit_admin(
    'employee.self_customer_ensure',
    'customer',
    v_after.id::text,
    case when v_before.id is null then '{}'::jsonb else to_jsonb(v_before) end,
    to_jsonb(v_after),
    p_reason,
    jsonb_build_object(
      'user_id', p_user_id,
      'profile_kind', 'employee_self',
      'source_customer_id', v_source.id,
      'rpc', 'admin_ensure_employee_self_customer'
    )
  );

  return v_after;
end;
$$;

revoke execute on function public.admin_ensure_employee_self_customer(uuid, text)
  from public, anon;
grant execute on function public.admin_ensure_employee_self_customer(uuid, text)
  to authenticated;

create or replace function public.ensure_employee_self_customer()
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_source public.customers%rowtype;
  v_customer public.customers%rowtype;
  v_display_name text;
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
  v_level text;
  v_tier text;
  v_customer_type text;
  v_complete boolean;
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
  into v_source
  from public.customers
  where coalesce(profile_kind, 'customer') = 'customer'
    and (
      user_id = v_user_id
      or (
        user_id is null
        and nullif(v_profile.email, '') is not null
        and lower(email) = lower(v_profile.email)
      )
    )
  order by
    case when assignment_status = 'converted_to_employee' then 0 else 1 end,
    converted_to_employee_at desc nulls last,
    updated_at desc nulls last,
    created_at desc nulls last
  limit 1;

  select *
  into v_customer
  from public.customers
  where user_id = v_user_id
    and profile_kind = 'employee_self'
  order by created_at desc
  limit 1
  for update;

  v_display_name := coalesce(
    nullif(v_source.company_name, ''),
    nullif(v_profile.display_name, ''),
    nullif(v_profile.email, ''),
    'Dipendente PartsPro'
  );
  v_company_name := coalesce(nullif(v_source.company_name, ''), v_display_name);
  v_contact_name := coalesce(nullif(v_source.contact_name, ''), '');
  v_email := coalesce(nullif(v_source.email, ''), coalesce(v_profile.email, ''));
  v_phone := nullif(v_source.phone, '');
  v_vat_number := nullif(v_source.vat_number, '');
  v_fiscal_code := nullif(v_source.fiscal_code, '');
  v_sdi := nullif(v_source.sdi, '');
  v_pec := nullif(v_source.pec, '');
  v_billing_address := nullif(v_source.billing_address, '');
  v_shipping_address := nullif(v_source.shipping_address, '');
  v_level := coalesce(nullif(v_source.level, ''), nullif(v_source.tier, ''), 'bronze');
  v_tier := coalesce(nullif(v_source.tier, ''), v_level, 'bronze');
  v_customer_type := coalesce(nullif(v_source.customer_type, ''), 'wholesale');
  v_complete := private.is_customer_profile_complete_for_checkout(
    v_company_name,
    v_email,
    v_phone,
    v_fiscal_code,
    v_billing_address,
    v_shipping_address
  );

  if v_customer.id is null then
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
      status,
      customer_type,
      assignment_status,
      profile_kind,
      profile_completed_at
    )
    values (
      v_user_id,
      v_company_name,
      v_contact_name,
      v_email,
      v_phone,
      v_vat_number,
      v_fiscal_code,
      v_sdi,
      v_pec,
      v_billing_address,
      v_shipping_address,
      v_tier,
      v_level,
      'active',
      v_customer_type,
      'assigned',
      'employee_self',
      case when v_complete then coalesce(v_source.profile_completed_at, now()) else null end
    )
    returning * into v_customer;
  else
    update public.customers
    set company_name = coalesce(nullif(company_name, ''), v_company_name),
        contact_name = coalesce(nullif(contact_name, ''), v_contact_name, ''),
        email = coalesce(nullif(email, ''), v_email),
        phone = coalesce(nullif(phone, ''), v_phone),
        vat_number = coalesce(nullif(vat_number, ''), v_vat_number),
        fiscal_code = coalesce(nullif(fiscal_code, ''), v_fiscal_code),
        sdi = coalesce(nullif(sdi, ''), v_sdi),
        pec = coalesce(nullif(pec, ''), v_pec),
        billing_address = coalesce(nullif(billing_address, ''), v_billing_address),
        shipping_address = coalesce(nullif(shipping_address, ''), v_shipping_address),
        level = case
          when coalesce(nullif(level, ''), 'bronze') = 'bronze'
            and nullif(v_source.level, '') is not null
            then v_source.level
          else coalesce(nullif(level, ''), 'bronze')
        end,
        tier = case
          when coalesce(nullif(tier, ''), 'bronze') = 'bronze'
            and coalesce(nullif(v_source.tier, ''), nullif(v_source.level, '')) is not null
            then coalesce(nullif(v_source.tier, ''), v_source.level)
          else coalesce(nullif(tier, ''), coalesce(nullif(level, ''), 'bronze'))
        end,
        customer_type = coalesce(nullif(customer_type, ''), v_customer_type),
        assignment_status = coalesce(nullif(assignment_status, ''), 'assigned'),
        status = coalesce(nullif(status, ''), 'active'),
        profile_completed_at = case
          when private.is_customer_profile_complete_for_checkout(
            coalesce(nullif(company_name, ''), v_company_name),
            coalesce(nullif(email, ''), v_email),
            coalesce(nullif(phone, ''), v_phone),
            coalesce(nullif(fiscal_code, ''), v_fiscal_code),
            coalesce(nullif(billing_address, ''), v_billing_address),
            coalesce(nullif(shipping_address, ''), v_shipping_address)
          )
            then coalesce(profile_completed_at, v_source.profile_completed_at, now())
          else null
        end,
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

revoke execute on function public.ensure_employee_self_customer()
  from public, anon;
grant execute on function public.ensure_employee_self_customer()
  to authenticated;

create or replace function public.admin_update_customer_classification(
  p_customer_id uuid,
  p_customer jsonb,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_before public.customers%rowtype;
  v_after public.customers%rowtype;
  v_member_user_id uuid;
  v_next_status text;
  v_next_customer_type text;
  v_next_assignment_status text;
  v_payload jsonb := coalesce(p_customer, '{}'::jsonb);
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

  if coalesce(v_before.profile_kind, 'customer') = 'archived_customer' then
    raise exception 'Archived customer profiles cannot be edited'
      using errcode = '42501';
  end if;

  if coalesce(v_before.profile_kind, 'customer') not in ('customer', 'employee_self') then
    raise exception 'Unsupported customer profile kind'
      using errcode = '42501';
  end if;

  v_next_status := case
    when v_payload ? 'status' then nullif(btrim(v_payload ->> 'status'), '')
    else v_before.status
  end;
  v_next_customer_type := case
    when v_payload ? 'customer_type' then nullif(btrim(v_payload ->> 'customer_type'), '')
    else v_before.customer_type
  end;
  v_next_assignment_status := case
    when v_payload ? 'assignment_status' then nullif(btrim(v_payload ->> 'assignment_status'), '')
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

  if coalesce(v_after.profile_kind, 'customer') = 'customer' and v_payload ? 'member_user_id' then
    v_member_user_id := nullif(v_payload ->> 'member_user_id', '')::uuid;
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
        coalesce(nullif(v_payload ->> 'member_role', ''), 'owner'),
        coalesce(nullif(v_payload ->> 'member_status', ''), 'active')
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
    v_payload || jsonb_build_object('profile_kind', coalesce(v_after.profile_kind, 'customer'))
  );

  return v_after;
end;
$$;

revoke execute on function public.admin_update_customer_classification(uuid, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_customer_classification(uuid, jsonb, text)
  to authenticated;

create or replace function public.admin_update_customer_level(
  p_customer_id uuid,
  p_level text,
  p_reason text
)
returns public.customers
language plpgsql
security definer
set search_path = public, private, pg_temp
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

  if coalesce(v_before.profile_kind, 'customer') = 'archived_customer' then
    raise exception 'Archived customer profiles cannot be edited'
      using errcode = '42501';
  end if;

  if coalesce(v_before.profile_kind, 'customer') not in ('customer', 'employee_self') then
    raise exception 'Unsupported customer profile kind'
      using errcode = '42501';
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
    jsonb_build_object(
      'level', v_level,
      'levelSource', 'manual',
      'profile_kind', coalesce(v_after.profile_kind, 'customer')
    )
  );

  return v_after;
end;
$$;

revoke execute on function public.admin_update_customer_level(uuid, text, text)
  from public, anon;
grant execute on function public.admin_update_customer_level(uuid, text, text)
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
set search_path = public, private, pg_temp
as $$
declare
  v_before_profile public.profiles%rowtype;
  v_after_profile public.profiles%rowtype;
  v_before_customer public.customers%rowtype;
  v_after_customer public.customers%rowtype;
  v_employee_self_before public.customers%rowtype;
  v_employee_self_after public.customers%rowtype;
  v_customer_id uuid;
  v_display_name text;
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
  v_level text;
  v_tier text;
  v_customer_type text;
  v_complete boolean;
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

    v_display_name := coalesce(
      nullif(v_after_customer.company_name, ''),
      nullif(v_before_profile.display_name, ''),
      nullif(v_before_profile.email, ''),
      'Dipendente PartsPro'
    );
    v_company_name := coalesce(nullif(v_after_customer.company_name, ''), v_display_name);
    v_contact_name := coalesce(nullif(v_after_customer.contact_name, ''), '');
    v_email := coalesce(nullif(v_after_customer.email, ''), coalesce(v_before_profile.email, ''));
    v_phone := nullif(v_after_customer.phone, '');
    v_vat_number := nullif(v_after_customer.vat_number, '');
    v_fiscal_code := nullif(v_after_customer.fiscal_code, '');
    v_sdi := nullif(v_after_customer.sdi, '');
    v_pec := nullif(v_after_customer.pec, '');
    v_billing_address := nullif(v_after_customer.billing_address, '');
    v_shipping_address := nullif(v_after_customer.shipping_address, '');
    v_level := coalesce(nullif(v_after_customer.level, ''), nullif(v_after_customer.tier, ''), 'bronze');
    v_tier := coalesce(nullif(v_after_customer.tier, ''), v_level, 'bronze');
    v_customer_type := coalesce(nullif(v_after_customer.customer_type, ''), 'wholesale');
    v_complete := private.is_customer_profile_complete_for_checkout(
      v_company_name,
      v_email,
      v_phone,
      v_fiscal_code,
      v_billing_address,
      v_shipping_address
    );

    select *
    into v_employee_self_before
    from public.customers
    where user_id = p_user_id
      and profile_kind = 'employee_self'
    order by created_at desc
    limit 1
    for update;

    if v_employee_self_before.id is null then
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
        status,
        customer_type,
        assignment_status,
        profile_kind,
        profile_completed_at
      )
      values (
        p_user_id,
        v_company_name,
        v_contact_name,
        v_email,
        v_phone,
        v_vat_number,
        v_fiscal_code,
        v_sdi,
        v_pec,
        v_billing_address,
        v_shipping_address,
        v_tier,
        v_level,
        'active',
        v_customer_type,
        'assigned',
        'employee_self',
        case when v_complete then coalesce(v_after_customer.profile_completed_at, now()) else null end
      )
      returning * into v_employee_self_after;
    else
      update public.customers
      set company_name = coalesce(nullif(company_name, ''), v_company_name),
          contact_name = coalesce(nullif(contact_name, ''), v_contact_name, ''),
          email = coalesce(nullif(email, ''), v_email),
          phone = coalesce(nullif(phone, ''), v_phone),
          vat_number = coalesce(nullif(vat_number, ''), v_vat_number),
          fiscal_code = coalesce(nullif(fiscal_code, ''), v_fiscal_code),
          sdi = coalesce(nullif(sdi, ''), v_sdi),
          pec = coalesce(nullif(pec, ''), v_pec),
          billing_address = coalesce(nullif(billing_address, ''), v_billing_address),
          shipping_address = coalesce(nullif(shipping_address, ''), v_shipping_address),
          level = case
            when coalesce(nullif(level, ''), 'bronze') = 'bronze'
              and nullif(v_after_customer.level, '') is not null
              then v_after_customer.level
            else coalesce(nullif(level, ''), 'bronze')
          end,
          tier = case
            when coalesce(nullif(tier, ''), 'bronze') = 'bronze'
              and coalesce(nullif(v_after_customer.tier, ''), nullif(v_after_customer.level, '')) is not null
              then coalesce(nullif(v_after_customer.tier, ''), v_after_customer.level)
            else coalesce(nullif(tier, ''), coalesce(nullif(level, ''), 'bronze'))
          end,
          customer_type = case
            when coalesce(nullif(level, ''), 'bronze') = 'bronze'
              and coalesce(orders_count, 0) = 0
              and coalesce(revenue, 0) = 0
              and nullif(v_after_customer.customer_type, '') is not null
              then v_after_customer.customer_type
            else coalesce(nullif(customer_type, ''), v_customer_type)
          end,
          assignment_status = coalesce(nullif(assignment_status, ''), 'assigned'),
          status = coalesce(nullif(status, ''), 'active'),
          profile_completed_at = case
            when private.is_customer_profile_complete_for_checkout(
              coalesce(nullif(company_name, ''), v_company_name),
              coalesce(nullif(email, ''), v_email),
              coalesce(nullif(phone, ''), v_phone),
              coalesce(nullif(fiscal_code, ''), v_fiscal_code),
              coalesce(nullif(billing_address, ''), v_billing_address),
              coalesce(nullif(shipping_address, ''), v_shipping_address)
            )
              then coalesce(profile_completed_at, v_after_customer.profile_completed_at, now())
            else null
          end,
          updated_at = now()
      where id = v_employee_self_before.id
        and profile_kind = 'employee_self'
      returning * into v_employee_self_after;
    end if;

    update public.profiles
    set customer_id = v_employee_self_after.id,
        updated_at = now()
    where id = p_user_id
    returning * into v_after_profile;

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
        'customer', to_jsonb(v_after_customer),
        'employee_self_before', to_jsonb(v_employee_self_before),
        'employee_self', to_jsonb(v_employee_self_after)
      ),
      p_reason,
      jsonb_build_object('account_type', p_account_type)
    );

    return jsonb_build_object(
      'account_type', 'employee',
      'profile', to_jsonb(v_after_profile),
      'customer', to_jsonb(v_after_customer),
      'employee_self', to_jsonb(v_employee_self_after)
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

revoke execute on function public.admin_update_account_type(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.admin_update_account_type(uuid, text, text, text, text)
  to authenticated;

do $$
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  with source as (
    select distinct on (profile.id)
      profile.id as profile_user_id,
      customer.*
    from public.profiles as profile
    join public.customers as customer
      on coalesce(customer.profile_kind, 'customer') = 'customer'
      and (
        customer.user_id = profile.id
        or (
          customer.user_id is null
          and nullif(profile.email, '') is not null
          and lower(customer.email) = lower(profile.email)
        )
      )
    where coalesce(profile.account_type, 'customer') = 'employee'
      and customer.assignment_status = 'converted_to_employee'
    order by
      profile.id,
      customer.converted_to_employee_at desc nulls last,
      customer.updated_at desc nulls last,
      customer.created_at desc nulls last
  )
  update public.customers as self
  set level = case
        when coalesce(nullif(self.level, ''), 'bronze') = 'bronze'
          and nullif(source.level, '') is not null
          then source.level
        else coalesce(nullif(self.level, ''), 'bronze')
      end,
      tier = case
        when coalesce(nullif(self.tier, ''), 'bronze') = 'bronze'
          and coalesce(nullif(source.tier, ''), nullif(source.level, '')) is not null
          then coalesce(nullif(source.tier, ''), source.level)
        else coalesce(nullif(self.tier, ''), coalesce(nullif(self.level, ''), 'bronze'))
      end,
      customer_type = case
        when coalesce(nullif(self.level, ''), 'bronze') = 'bronze'
          and coalesce(self.orders_count, 0) = 0
          and coalesce(self.revenue, 0) = 0
          and nullif(source.customer_type, '') is not null
          then source.customer_type
        else coalesce(nullif(self.customer_type, ''), 'wholesale')
      end,
      profile_completed_at = case
        when private.is_customer_profile_complete_for_checkout(
          self.company_name,
          self.email,
          self.phone,
          self.fiscal_code,
          self.billing_address,
          self.shipping_address
        )
          then coalesce(self.profile_completed_at, source.profile_completed_at, now())
        else null
      end,
      updated_at = now()
  from source
  where self.user_id = source.profile_user_id
    and self.profile_kind = 'employee_self'
    and (
      (
        coalesce(nullif(self.level, ''), 'bronze') = 'bronze'
        and nullif(source.level, '') is not null
        and source.level <> 'bronze'
      )
      or (
        coalesce(nullif(self.tier, ''), 'bronze') = 'bronze'
        and coalesce(nullif(source.tier, ''), nullif(source.level, '')) is not null
        and coalesce(nullif(source.tier, ''), source.level) <> 'bronze'
      )
      or (
        coalesce(nullif(self.customer_type, ''), 'wholesale') = 'wholesale'
        and coalesce(self.orders_count, 0) = 0
        and coalesce(self.revenue, 0) = 0
        and nullif(source.customer_type, '') is not null
        and source.customer_type <> coalesce(nullif(self.customer_type, ''), 'wholesale')
      )
      or self.profile_completed_at is distinct from case
        when private.is_customer_profile_complete_for_checkout(
          self.company_name,
          self.email,
          self.phone,
          self.fiscal_code,
          self.billing_address,
          self.shipping_address
        )
          then coalesce(self.profile_completed_at, source.profile_completed_at, now())
        else null
      end
    );

  update public.profiles as profile
  set customer_id = self.id,
      updated_at = now()
  from public.customers as self
  where profile.id = self.user_id
    and coalesce(profile.account_type, 'customer') = 'employee'
    and self.profile_kind = 'employee_self'
    and profile.customer_id is distinct from self.id;
end $$;
