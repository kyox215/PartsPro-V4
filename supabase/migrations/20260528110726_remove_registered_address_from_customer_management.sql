-- Remove registered_address from the active customer-management workflow.
-- The physical column remains as legacy data for old records/imports, but
-- admin profile edits and checkout completeness now use only billing/shipping
-- addresses.

comment on column public.customers.registered_address is
  'Deprecated legacy field. Customer management uses billing_address and shipping_address.';

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

  if coalesce(p_customer, '{}'::jsonb) ?| array['registered_address', 'registeredAddress'] then
    raise exception 'Registered address is no longer managed; use billing_address and shipping_address'
      using errcode = '42703';
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

grant execute on function public.admin_update_customer_profile(uuid, jsonb, text) to authenticated;

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
