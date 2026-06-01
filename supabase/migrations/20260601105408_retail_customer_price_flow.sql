-- Retail customer checkout flow:
-- - new linked customer shells stay pending until the profile is completed;
-- - completing a customer profile activates an assigned retail account unless suspended;
-- - retail pricing uses retail_price with no wholesale level discount;
-- - self checkout accepts active assigned retail or wholesale customers.

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
      role = 'customer',
      role_template = null,
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
  set member_role = 'owner',
      status = 'active',
      updated_at = now();

  return v_customer_id;
end;
$$;

grant execute on function private.ensure_user_account(uuid, text, text, text, text) to authenticated;

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

revoke execute on function public.update_current_customer_profile(jsonb) from public, anon;
grant execute on function public.update_current_customer_profile(jsonb) to authenticated;

create or replace function private.resolve_customer_product_price(
  _product_id uuid,
  _customer_id uuid default null,
  _quantity integer default 1
)
returns table (
  product_id uuid,
  sku_code text,
  customer_id uuid,
  customer_type text,
  customer_level text,
  price_group_id text,
  base_unit_price numeric,
  level_discount_percent numeric,
  price_group_discount_percent numeric,
  discount_percent numeric,
  effective_unit_price numeric,
  price_source text,
  margin_percent numeric,
  price_version text,
  price_resolved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_customer public.customers%rowtype;
  v_customer_price public.customer_product_prices%rowtype;
  v_requested_customer_id uuid := _customer_id;
  v_auth_uid uuid := (select auth.uid());
  v_current_customer_id uuid := (select private.current_customer_id());
  v_is_staff boolean := coalesce((select private.is_staff()), false);
  v_can_view boolean := false;
  v_customer_type text := 'wholesale';
  v_level text := 'bronze';
  v_group_id text;
  v_group_discount_percent numeric := 0;
  v_level_discount_percent numeric := 0;
  v_combined_discount_percent numeric := 0;
  v_base_unit_price numeric;
  v_raw_unit_price numeric;
  v_effective_unit_price numeric;
  v_margin_floor numeric;
  v_price_source text := 'hidden';
  v_resolved_at timestamptz := now();
  v_profile_complete boolean := false;
begin
  select *
  into v_product
  from public.products
  where id = _product_id
    and (status = 'active' or v_is_staff)
  limit 1;

  if v_product.id is null then
    return;
  end if;

  if v_requested_customer_id is null then
    v_requested_customer_id := v_current_customer_id;
  end if;

  if v_requested_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = v_requested_customer_id
    limit 1;
  end if;

  if v_customer.id is not null then
    v_customer_type := coalesce(v_customer.customer_type, 'retail');
    v_level := private.normalize_customer_tier(coalesce(v_customer.level, v_customer.tier, 'bronze'));
    v_group_id := v_customer.price_group_id;
    v_profile_complete :=
      nullif(coalesce(v_customer.contact_name, ''), '') is not null
      and nullif(coalesce(v_customer.email, ''), '') is not null
      and nullif(coalesce(v_customer.phone, ''), '') is not null
      and nullif(coalesce(v_customer.billing_address, ''), '') is not null
      and nullif(coalesce(v_customer.shipping_address, ''), '') is not null
      and (
        (
          v_customer_type = 'retail'
          and coalesce(nullif(v_customer.fiscal_code, ''), nullif(v_customer.vat_number, ''), '') <> ''
        )
        or (
          v_customer_type = 'wholesale'
          and nullif(coalesce(v_customer.company_name, ''), '') is not null
          and nullif(coalesce(v_customer.vat_number, ''), '') is not null
          and nullif(coalesce(v_customer.fiscal_code, ''), '') is not null
          and coalesce(nullif(v_customer.pec, ''), nullif(v_customer.sdi, ''), '') <> ''
        )
      );
    v_can_view :=
      v_is_staff
      or (
        v_customer.status = 'active'
        and coalesce(v_customer.assignment_status, 'needs_review') = 'assigned'
        and v_profile_complete
        and (
          v_customer.user_id = v_auth_uid
          or exists (
            select 1
            from public.customer_memberships as cm
            where cm.customer_id = v_customer.id
              and cm.user_id = v_auth_uid
              and cm.status = 'active'
          )
        )
      );
  else
    v_can_view := v_is_staff;
  end if;

  if v_can_view then
    v_base_unit_price := case
      when v_customer.id is not null and v_customer_type = 'retail'
        then coalesce(v_product.retail_price, v_product.b2b_price, 0)
      else coalesce(v_product.b2b_price, v_product.retail_price, 0)
    end;

    if v_customer.id is not null and v_customer_type = 'wholesale' then
      select *
      into v_customer_price
      from public.customer_product_prices as cpp
      where cpp.customer_id = v_customer.id
        and cpp.product_id = v_product.id
        and cpp.min_quantity <= greatest(coalesce(_quantity, 1), 1)
        and cpp.starts_at <= v_resolved_at
        and (cpp.ends_at is null or cpp.ends_at > v_resolved_at)
      order by cpp.min_quantity desc, cpp.starts_at desc
      limit 1;
    end if;

    if v_customer_price.id is not null then
      v_raw_unit_price := v_customer_price.unit_price;
      v_price_source := 'customer_product_price';
    else
      v_level_discount_percent := case
        when v_customer.id is not null and v_customer_type = 'wholesale'
          then round(coalesce(private.customer_level_discount(v_level), 0) * 100, 2)
        else 0
      end;

      if v_customer.id is not null and v_customer_type = 'wholesale' and v_group_id is not null then
        select least(greatest(coalesce(pg.discount_percent, 0), 0), 100)
        into v_group_discount_percent
        from public.price_groups as pg
        where pg.id = v_group_id;

        v_group_discount_percent := coalesce(v_group_discount_percent, 0);
      end if;

      v_combined_discount_percent := round(
        (
          1
          - (
            (1 - coalesce(v_level_discount_percent, 0) / 100)
            * (1 - coalesce(v_group_discount_percent, 0) / 100)
          )
        ) * 100,
        2
      );
      v_raw_unit_price := round(
        coalesce(v_base_unit_price, 0) * (1 - v_combined_discount_percent / 100),
        2
      );
      v_price_source := case
        when v_group_discount_percent > 0 and v_level_discount_percent > 0 then 'level_price_group'
        when v_group_discount_percent > 0 then 'price_group'
        when v_level_discount_percent > 0 then 'customer_level'
        when v_customer.id is not null and v_customer_type = 'retail' then 'retail_price'
        else 'b2b_price'
      end;
    end if;

    v_margin_floor := case
      when coalesce(v_product.cost_price, 0) > 0
        then least(coalesce(v_base_unit_price, 0), round(v_product.cost_price / 0.85, 2))
      else 0
    end;
    v_effective_unit_price := greatest(coalesce(v_raw_unit_price, 0), coalesce(v_margin_floor, 0));

    if v_effective_unit_price > coalesce(v_raw_unit_price, 0) then
      v_price_source := v_price_source || '_margin_floor';
    end if;
  end if;

  return query
  select
    v_product.id,
    v_product.sku_code,
    case when v_customer.id is null then null::uuid else v_customer.id end,
    case when v_can_view then v_customer_type else null::text end,
    case when v_can_view then v_level else null::text end,
    case when v_can_view then v_group_id else null::text end,
    case when v_can_view then round(v_base_unit_price, 2) else null::numeric end,
    case when v_can_view then v_level_discount_percent else null::numeric end,
    case when v_can_view then v_group_discount_percent else null::numeric end,
    case
      when v_can_view and v_base_unit_price > 0
        then round((1 - (v_effective_unit_price / v_base_unit_price)) * 100, 2)
      when v_can_view then 0::numeric
      else null::numeric
    end,
    case when v_can_view then round(v_effective_unit_price, 2) else null::numeric end,
    v_price_source,
    case
      when v_can_view and v_effective_unit_price > 0
        then round(((v_effective_unit_price - coalesce(v_product.cost_price, 0)) / v_effective_unit_price) * 100, 2)
      when v_can_view then null::numeric
      else null::numeric
    end,
    case
      when v_can_view then md5(concat_ws(
        '|',
        v_product.id::text,
        coalesce(v_product.updated_at::text, ''),
        coalesce(v_customer.id::text, ''),
        coalesce(v_customer_type, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_level else '' end, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_group_id else '' end, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_customer_price.id::text else '' end, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_customer_price.updated_at::text else '' end, ''),
        coalesce(v_base_unit_price::text, '0'),
        coalesce(v_level_discount_percent::text, '0'),
        coalesce(v_group_discount_percent::text, '0'),
        coalesce(v_effective_unit_price::text, '0'),
        coalesce(v_price_source, '')
      ))
      else null::text
    end,
    case when v_can_view then v_resolved_at else null::timestamptz end;
end;
$$;

grant execute on function private.resolve_customer_product_price(uuid, uuid, integer)
  to authenticated;

comment on function private.resolve_customer_product_price(uuid, uuid, integer) is
  'Resolves PartsPro retail/wholesale customer prices. Retail uses retail_price without wholesale level discounts; wholesale uses b2b rules. price_version excludes generic customers.updated_at.';

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
    select c.*
    into v_customer
    from public.customers as c
    where c.id = coalesce(p_customer_id, (select private.current_customer_id()))
      and (
        c.user_id = v_auth_uid
        or exists (
          select 1
          from public.customer_memberships as cm
          where cm.customer_id = c.id
            and cm.user_id = v_auth_uid
            and cm.status = 'active'
        )
      )
    limit 1;
  end if;

  if v_customer.id is null then
    raise exception 'No matching customer profile was found' using errcode = '23503';
  end if;

  if not v_is_staff
    and (
      v_customer.status <> 'active'
      or coalesce(v_customer.assignment_status, 'needs_review') <> 'assigned'
    ) then
    raise exception 'Customer must be active and assigned before placing orders' using errcode = '42501';
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
      round(requested.unit_net, 2) as requested_unit_net,
      nullif(btrim(requested.price_version), '') as requested_price_version,
      p.name as product_name,
      p.quality_grade,
      pricing.effective_unit_price as allowed_unit_price,
      pricing.base_unit_price,
      pricing.discount_percent,
      pricing.price_source,
      pricing.customer_level,
      pricing.price_group_id,
      pricing.price_version,
      pricing.price_resolved_at,
      p.moq,
      p.stock_status,
      p.stock_qty,
      p.batch_code,
      p.location
    from jsonb_to_recordset(p_lines) as requested(
      sku_code text,
      quantity integer,
      unit_net numeric,
      price_version text
    )
    join public.products as p on p.sku_code = requested.sku_code
    cross join lateral private.resolve_customer_product_price(
      p.id,
      v_customer.id,
      requested.quantity
    ) as pricing
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

    if v_line.allowed_unit_price is null then
      raise exception 'SKU % has no available price for this customer', v_line.sku_code using errcode = '42501';
    end if;

    if coalesce(v_line.requested_unit_net, v_line.allowed_unit_price) < 0 then
      raise exception 'SKU % has invalid pricing', v_line.sku_code using errcode = '23514';
    end if;

    if v_line.requested_price_version is not null
      and v_line.price_version is not null
      and v_line.requested_price_version <> v_line.price_version then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code using errcode = '40001';
    end if;

    if v_line.requested_unit_net is not null
      and abs(v_line.requested_unit_net - v_line.allowed_unit_price) > 0.01 then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code using errcode = '40001';
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
      base_unit_price,
      discount_percent,
      price_source,
      customer_level_snapshot,
      price_group_id_snapshot,
      price_version,
      price_resolved_at,
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
      coalesce(v_line.requested_unit_net, v_line.allowed_unit_price),
      v_line.base_unit_price,
      v_line.discount_percent,
      v_line.price_source,
      v_line.customer_level,
      v_line.price_group_id,
      v_line.price_version,
      v_line.price_resolved_at,
      'pending_reservation',
      v_line.batch_code,
      v_line.location
    )
    returning id into v_order_line_id;

    perform private.reserve_order_line_inventory(v_order_line_id, v_line.sku_code, v_line.quantity);

    v_total_net := v_total_net + round(coalesce(v_line.requested_unit_net, v_line.allowed_unit_price) * v_line.quantity, 2);
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
      'pricing_resolver', 'private.resolve_customer_product_price',
      'line_count', v_line_count,
      'customer_type', coalesce(v_customer.customer_type, 'retail'),
      'customer_level', coalesce(v_customer.level, v_customer.tier, 'bronze'),
      'price_group_id', v_customer.price_group_id,
      'shipping_method', coalesce(p_shipping_method, ''),
      'price_snapshot_validated', true
    )
  );

  return v_order_id;
end;
$$;

do $$
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  update public.customers as c
  set status = 'active',
      assignment_status = 'assigned',
      customer_type = coalesce(nullif(c.customer_type, ''), 'retail'),
      profile_completed_at = coalesce(c.profile_completed_at, now()),
      updated_at = now()
  from public.profiles as p
  where p.customer_id = c.id
    and coalesce(p.account_type, 'customer') = 'customer'
    and coalesce(c.profile_kind, 'customer') = 'customer'
    and c.status <> 'suspended'
    and coalesce(c.customer_type, 'retail') = 'retail'
    and nullif(coalesce(c.company_name, ''), '') is not null
    and nullif(coalesce(c.contact_name, ''), '') is not null
    and nullif(coalesce(c.email, ''), '') is not null
    and nullif(coalesce(c.phone, ''), '') is not null
    and nullif(coalesce(c.billing_address, ''), '') is not null
    and nullif(coalesce(c.shipping_address, ''), '') is not null
    and coalesce(nullif(c.fiscal_code, ''), nullif(c.vat_number, ''), '') <> '';
end $$;
