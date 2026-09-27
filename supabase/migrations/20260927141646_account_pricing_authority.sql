-- Account pricing authority. No changes to paid-spend aggregation or existing entitlements.
create or replace function private.customer_base_level(_level text,_tier text,_spend numeric,_source text,_profile_kind text default 'customer')
returns text language sql immutable set search_path = '' as $$
 select case when (_source = 'manual' or _profile_kind = 'employee_self')
   and lower(btrim(coalesce(_level,_tier,''))) = any(array['bronze','silver','gold','emerald','diamond','master','king','standard','pro','partner'])
 then private.normalize_customer_tier(coalesce(_level,_tier))
 else private.customer_level_for_spend(coalesce(_spend,0)) end
$$;
create or replace function private.customer_effective_level(_level text,_tier text,_lifetime_spend_net numeric,_promo_level text,_promo_level_starts_at timestamptz,_promo_level_expires_at timestamptz,_as_of timestamptz,_level_source text,_profile_kind text default 'customer')
returns text language sql stable set search_path = '' as $$
 with b as (select private.customer_base_level(_level,_tier,_lifetime_spend_net,_level_source,_profile_kind) level),
 ranks as (select array['bronze','silver','gold','emerald','diamond','master','king'] levels)
 select case when _as_of >= _promo_level_starts_at and _as_of < _promo_level_expires_at
 and array_position(levels,private.normalize_customer_tier(_promo_level)) > array_position(levels,b.level)
 then private.normalize_customer_tier(_promo_level) else b.level end from b,ranks
$$;
-- Legacy signature retained; stored tier is treated as the legacy base.
create or replace function private.customer_effective_level(_level text,_tier text,_lifetime_spend_net numeric,_promo_level text,_promo_level_starts_at timestamptz,_promo_level_expires_at timestamptz,_as_of timestamptz default now())
returns text language sql stable set search_path = '' as $$
 select private.customer_effective_level(_level,_tier,_lifetime_spend_net,_promo_level,_promo_level_starts_at,_promo_level_expires_at,_as_of,'manual','customer')
$$;

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
  v_customer_effective_level text := 'bronze';
  v_order_id uuid;
  v_order_line_id uuid;
  v_order_no text;
  v_expected_count integer;
  v_line_count integer := 0;
  v_total_net numeric := 0;
  v_vat numeric := 0;
  v_stock_risk text := 'clear';
  v_payment_method text := case
    when lower(coalesce(p_fiscal ->> 'payment_method', p_fiscal ->> 'paymentMethod', '')) = 'cash' then 'cash'
    else 'bank_transfer'
  end;
  v_fiscal jsonb := jsonb_set(
    case
      when jsonb_typeof(p_fiscal) = 'object' then p_fiscal
      else '{}'::jsonb
    end,
    '{payment_method}',
    to_jsonb(case
      when lower(coalesce(p_fiscal ->> 'payment_method', p_fiscal ->> 'paymentMethod', '')) = 'cash' then 'cash'
      else 'bank_transfer'
    end),
    true
  );
  v_wallet_requested numeric(12, 2) := greatest(coalesce(nullif(p_fiscal ->> 'wallet_requested_amount', '')::numeric, 0), 0);
  v_wallet_available numeric(12, 2) := 0;
  v_wallet_applied numeric(12, 2) := 0;
  v_wallet_debit jsonb := null;
  v_order_gross numeric(12, 2) := 0;
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

  v_customer_effective_level := private.customer_effective_level(
    v_customer.level,
    v_customer.tier,
    v_customer.lifetime_spend_net,
    v_customer.promo_level,
    v_customer.promo_level_starts_at,
    v_customer.promo_level_expires_at,
    now(), v_customer.level_source, v_customer.profile_kind
  );

  if not v_is_staff
    and (
      v_customer.status <> 'active'
      or coalesce(v_customer.assignment_status, 'needs_review') <> 'assigned'
    ) then
    raise exception 'Customer must be active and assigned before placing orders' using errcode = '42501';
  end if;

  if not private.is_customer_profile_complete_for_checkout(
    v_customer.company_name,
    v_customer.email,
    v_customer.phone,
    v_customer.fiscal_code,
    v_customer.billing_address,
    v_customer.shipping_address
  ) then
    raise exception 'Customer name, tax, billing and shipping profile must be completed before checkout' using errcode = '42501';
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
    payment_method,
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
    v_customer_effective_level,
    'submitted',
    'pending',
    v_payment_method,
    'clear',
    0,
    0,
    coalesce(p_shipping, 0),
    coalesce(p_shipping_method, ''),
    v_fiscal,
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
      (select sum((item->>'quantity')::integer)::integer from jsonb_array_elements(p_lines) item where upper(btrim(item->>'sku_code'))=upper(btrim(requested.sku_code)))
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
  v_order_gross := round(v_total_net + v_vat + coalesce(p_shipping, 0), 2);

  if v_wallet_requested > 0 and v_order_gross > 0 then
    perform private.ensure_customer_wallet(v_customer.id);

    select balance
    into v_wallet_available
    from public.customer_wallets
    where customer_id = v_customer.id
    for update;

    v_wallet_applied := least(coalesce(v_wallet_available, 0), v_wallet_requested, v_order_gross);

    if v_wallet_applied > 0 then
      v_wallet_debit := private.debit_customer_wallet(
        v_customer.id,
        v_wallet_applied,
        '钱包余额自动抵扣订单',
        v_order_id,
        jsonb_build_object(
          'order_no', v_order_no,
          'requested_amount', v_wallet_requested,
          'order_gross', v_order_gross
        )
      );
    end if;
  end if;

  v_fiscal := jsonb_set(v_fiscal, '{wallet_applied_amount}', to_jsonb(v_wallet_applied), true);

  update public.orders
  set
    total_net = v_total_net,
    vat = v_vat,
    shipping = coalesce(p_shipping, 0),
    wallet_applied_amount = v_wallet_applied,
    payment_status = case when v_wallet_applied >= v_order_gross and v_order_gross > 0 then 'paid' else payment_status end,
    payment_received_at = case when v_wallet_applied >= v_order_gross and v_order_gross > 0 then now() else payment_received_at end,
    payment_received_by = case when v_wallet_applied >= v_order_gross and v_order_gross > 0 then v_auth_uid else payment_received_by end,
    payment_received_amount = payment_received_amount,
    fiscal = v_fiscal,
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
      'customer_level', v_customer_effective_level,
      'level_source', v_customer.level_source,
      'base_customer_level', private.customer_base_level(v_customer.level,v_customer.tier,v_customer.lifetime_spend_net,v_customer.level_source,v_customer.profile_kind),
      'stored_customer_level', coalesce(v_customer.level, v_customer.tier, 'bronze'),
      'promo_level', v_customer.promo_level,
      'promo_level_expires_at', v_customer.promo_level_expires_at,
      'price_group_id', v_customer.price_group_id,
      'shipping_method', coalesce(p_shipping_method, ''),
      'payment_method', v_payment_method,
      'wallet_applied_amount', v_wallet_applied,
      'wallet_debit', v_wallet_debit,
      'price_snapshot_validated', true
    )
  );

  return v_order_id;
end;
$$;

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
  level_discount_amount numeric,
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
  v_level_discount_amount numeric := 0;
  v_base_unit_price numeric;
  v_level_unit_price numeric;
  v_raw_unit_price numeric;
  v_effective_unit_price numeric;
  v_margin_floor numeric;
  v_price_source text := 'hidden';
  v_resolved_at timestamptz := now();
  v_profile_complete boolean := false;
  v_discount_exempt boolean := false;
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

  v_discount_exempt :=
    lower(btrim(coalesce(v_product.category, ''))) = 'pellicole protettive'
    or upper(btrim(coalesce(v_product.brand, ''))) = 'REMAX';

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
    v_level := private.customer_effective_level(
      v_customer.level,
      v_customer.tier,
      v_customer.lifetime_spend_net,
      v_customer.promo_level,
      v_customer.promo_level_starts_at,
      v_customer.promo_level_expires_at,
      v_resolved_at, v_customer.level_source, v_customer.profile_kind
    );
    v_group_id := v_customer.price_group_id;
    v_profile_complete := private.is_customer_profile_complete_for_checkout(
      v_customer.company_name,
      v_customer.email,
      v_customer.phone,
      v_customer.fiscal_code,
      v_customer.billing_address,
      v_customer.shipping_address
    );
    v_can_view :=
      (v_is_staff and private.partspro_has_permission('orders.manage') and private.partspro_has_permission('customers.read'))
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

    if v_discount_exempt then
      v_raw_unit_price := v_base_unit_price;
      v_price_source := case
        when v_customer.id is not null and v_customer_type = 'retail'
          then 'retail_price_discount_exempt'
        else 'b2b_price_discount_exempt'
      end;
    else
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
        v_level_discount_amount := round(
          coalesce(private.customer_level_discount_amount(v_level), 0),
          2
        );

        if coalesce(v_base_unit_price, 0) > 0 then
          v_level_discount_percent := round(
            (least(v_level_discount_amount, v_base_unit_price) / v_base_unit_price) * 100,
            2
          );
        end if;

        if v_customer.id is not null
          and v_customer_type = 'wholesale'
          and v_group_id is not null then
          select least(greatest(coalesce(pg.discount_percent, 0), 0), 100)
          into v_group_discount_percent
          from public.price_groups as pg
          where pg.id = v_group_id;

          v_group_discount_percent := coalesce(v_group_discount_percent, 0);
        end if;

        v_level_unit_price := greatest(
          coalesce(v_base_unit_price, 0) - v_level_discount_amount,
          0
        );
        v_raw_unit_price := round(
          v_level_unit_price * (1 - coalesce(v_group_discount_percent, 0) / 100),
          2
        );
        v_price_source := case
          when v_customer_type = 'retail' and v_level_discount_amount > 0
            then 'retail_customer_level'
          when v_group_discount_percent > 0 and v_level_discount_amount > 0
            then 'level_price_group'
          when v_group_discount_percent > 0 then 'price_group'
          when v_level_discount_amount > 0 then 'customer_level'
          when v_customer.id is not null and v_customer_type = 'retail'
            then 'retail_price'
          else 'b2b_price'
        end;
      end if;
    end if;

    v_margin_floor := case
      when coalesce(v_product.cost_price, 0) > 0
        then least(
          coalesce(v_base_unit_price, 0),
          round(v_product.cost_price / 0.85, 2)
        )
      else 0
    end;
    v_effective_unit_price := greatest(
      coalesce(v_raw_unit_price, 0),
      coalesce(v_margin_floor, 0)
    );

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
    case when v_can_view then v_level_discount_amount else null::numeric end,
    case when v_can_view then v_group_discount_percent else null::numeric end,
    case
      when v_can_view and v_base_unit_price > 0
        then round((1 - (v_effective_unit_price / v_base_unit_price)) * 100, 2)
      when v_can_view then 0::numeric
      else null::numeric
    end,
    case when v_can_view then round(v_effective_unit_price, 2) else null::numeric end,
    v_price_source,
    null::numeric, -- Customer-facing legacy views must not reveal a reversible cost margin.
    case
      when v_can_view then md5(concat_ws(
        '|',
        v_product.id::text,
        coalesce(v_product.updated_at::text, ''),
        coalesce(v_customer.id::text, ''),
        coalesce(v_customer_type, ''),
        coalesce(v_level, ''),
        coalesce(v_customer.level_source, ''),
        private.customer_base_level(v_customer.level,v_customer.tier,v_customer.lifetime_spend_net,v_customer.level_source,v_customer.profile_kind),
        coalesce(v_customer.promo_level, ''),
        coalesce(v_customer.promo_level_starts_at::text, ''),
        coalesce(v_customer.promo_level_expires_at::text, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_group_id else '' end, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_customer_price.id::text else '' end, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_customer_price.updated_at::text else '' end, ''),
        coalesce(v_base_unit_price::text, '0'),
        coalesce(v_level_discount_amount::text, '0'),
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

create or replace function public.create_preorder_transaction(
  p_lines jsonb,
  p_customer_id uuid default null,
  p_delivery_address text default '',
  p_customer_note text default '',
  p_shipping_method text default '',
  p_shipping numeric default 0,
  p_fiscal jsonb default '{}'::jsonb,
  p_terms_accepted boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := coalesce((select private.is_staff()), false);
  v_customer public.customers%rowtype;
  v_customer_effective_level text := 'bronze';
  v_order_id uuid;
  v_order_line_id uuid;
  v_order_no text;
  v_expected_count integer;
  v_distinct_count integer;
  v_line_count integer := 0;
  v_total_net numeric(12, 2) := 0;
  v_fiscal jsonb;
  v_line record;
  v_offer record;
  v_batch_line record;
  v_pending integer;
  v_available integer;
  v_take integer;
  v_remaining integer;
  v_eta_start date;
  v_eta_end date;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'Preorder terms must be accepted' using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Order lines must be a JSON array' using errcode = '22023';
  end if;

  v_expected_count := jsonb_array_length(p_lines);

  if v_expected_count < 1 then
    raise exception 'Order must contain at least one line' using errcode = '22023';
  end if;

  if p_shipping < 0 then
    raise exception 'Shipping cannot be negative' using errcode = '22023';
  end if;

  select count(distinct upper(btrim(sku_code)))
  into v_distinct_count
  from jsonb_to_recordset(p_lines) as requested(
    sku_code text,
    quantity integer,
    unit_net numeric,
    price_version text,
    offer_version text
  );

  if v_distinct_count <> v_expected_count then
    raise exception 'Duplicate SKU in preorder payload' using errcode = '23514';
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

  v_customer_effective_level := private.customer_effective_level(
    v_customer.level,
    v_customer.tier,
    v_customer.lifetime_spend_net,
    v_customer.promo_level,
    v_customer.promo_level_starts_at,
    v_customer.promo_level_expires_at,
    now(), v_customer.level_source, v_customer.profile_kind
  );

  if not v_is_staff
    and (
      v_customer.status <> 'active'
      or coalesce(v_customer.assignment_status, 'needs_review') <> 'assigned'
    ) then
    raise exception 'Customer must be active and assigned before placing orders'
      using errcode = '42501';
  end if;

  if not private.is_customer_profile_complete_for_checkout(
    v_customer.company_name,
    v_customer.email,
    v_customer.phone,
    v_customer.fiscal_code,
    v_customer.billing_address,
    v_customer.shipping_address
  ) then
    raise exception 'Customer name, tax, billing and shipping profile must be completed before checkout'
      using errcode = '42501';
  end if;

  if v_is_staff and v_customer.status = 'suspended' then
    raise exception 'Suspended customers cannot receive new orders' using errcode = '42501';
  end if;

  v_order_no := 'PP-PRE-' ||
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') ||
    '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  v_fiscal := jsonb_set(
    case when jsonb_typeof(p_fiscal) = 'object' then p_fiscal else '{}'::jsonb end,
    '{payment_method}',
    to_jsonb('bank_transfer'::text),
    true
  );
  v_fiscal := jsonb_set(v_fiscal, '{wallet_requested_amount}', '0'::jsonb, true);
  v_fiscal := jsonb_set(v_fiscal, '{wallet_applied_amount}', '0'::jsonb, true);
  v_fiscal := jsonb_set(v_fiscal, '{order_kind}', to_jsonb('preorder'::text), true);
  v_fiscal := jsonb_set(v_fiscal, '{preorder_terms_accepted}', 'true'::jsonb, true);

  insert into public.orders (
    order_no,
    customer_id,
    user_id,
    customer_name,
    customer_tier,
    status,
    payment_status,
    payment_method,
    stock_risk,
    total_net,
    vat,
    shipping,
    shipping_method,
    fiscal,
    delivery_address,
    customer_note,
    order_kind,
    wallet_applied_amount
  )
  values (
    v_order_no,
    v_customer.id,
    v_customer.user_id,
    v_customer.company_name,
    v_customer_effective_level,
    'submitted',
    'pending',
    'bank_transfer',
    'blocked',
    0,
    0,
    coalesce(p_shipping, 0),
    coalesce(p_shipping_method, ''),
    v_fiscal,
    coalesce(p_delivery_address, ''),
    coalesce(p_customer_note, ''),
    'preorder',
    0
  )
  returning id into v_order_id;

  for v_line in
    select
      upper(btrim(requested.sku_code)) as sku_code,
      requested.quantity,
      round(requested.unit_net, 2) as requested_unit_net,
      nullif(btrim(requested.price_version), '') as requested_price_version,
      nullif(btrim(requested.offer_version), '') as requested_offer_version,
      p.id as product_id,
      p.name as product_name,
      p.quality_grade,
      p.moq,
      p.batch_code,
      p.location,
      p.preorder_terms,
      pricing.effective_unit_price as allowed_unit_price,
      pricing.base_unit_price,
      pricing.discount_percent,
      pricing.price_source,
      pricing.customer_level,
      pricing.price_group_id,
      pricing.price_version,
      pricing.price_resolved_at
    from jsonb_to_recordset(p_lines) as requested(
      sku_code text,
      quantity integer,
      unit_net numeric,
      price_version text,
      offer_version text
    )
    join public.products as p
      on p.sku_code = upper(btrim(requested.sku_code))
    cross join lateral private.resolve_customer_product_price(
      p.id,
      v_customer.id,
      (select sum((item->>'quantity')::integer)::integer from jsonb_array_elements(p_lines) item where upper(btrim(item->>'sku_code'))=upper(btrim(requested.sku_code)))
    ) as pricing
    where p.status = 'active'
      and p.preorder_enabled
      and (p.preorder_close_at is null or p.preorder_close_at > now())
    order by p.sku_code
    for update of p
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Order line quantity must be positive' using errcode = '23514';
    end if;

    if v_line.quantity < v_line.moq then
      raise exception 'Order line quantity is below MOQ for SKU %', v_line.sku_code
        using errcode = '23514';
    end if;

    if v_line.allowed_unit_price is null or v_line.allowed_unit_price <= 0 then
      raise exception 'SKU % has no available price for this customer', v_line.sku_code
        using errcode = '42501';
    end if;

    if v_line.requested_price_version is not null
      and v_line.price_version is not null
      and v_line.requested_price_version <> v_line.price_version then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code
        using errcode = '40001';
    end if;

    if v_line.requested_unit_net is not null
      and abs(v_line.requested_unit_net - v_line.allowed_unit_price) > 0.01 then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code
        using errcode = '40001';
    end if;

    select *
    into v_offer
    from public.catalog_preorder_availability(array[v_line.sku_code])
    limit 1;

    if v_offer.sku_code is null or v_offer.remaining_qty < v_line.quantity then
      raise exception 'Requested quantity exceeds preorder capacity for SKU %', v_line.sku_code
        using errcode = '23514';
    end if;

    if v_line.requested_offer_version is not null
      and v_line.requested_offer_version <> v_offer.offer_version then
      raise exception 'SKU % preorder ETA or capacity changed; refresh checkout before submitting',
        v_line.sku_code
        using errcode = '40001';
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
      location,
      reserved_qty,
      fulfilled_qty,
      fulfillment_type,
      fulfillment_status,
      preorder_eta_start,
      preorder_eta_end,
      preorder_terms_snapshot,
      preorder_offer_version
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
      'preorder_waiting',
      null,
      v_line.location,
      0,
      0,
      'preorder',
      'awaiting_stock',
      v_offer.eta_start,
      v_offer.eta_end,
      v_line.preorder_terms,
      v_offer.offer_version
    )
    returning id into v_order_line_id;

    v_remaining := v_line.quantity;
    v_eta_start := null;
    v_eta_end := null;

    for v_batch_line in
      select
        sbl.id,
        sbl.batch_id,
        sbl.preorder_capacity_qty,
        sbl.qty_received,
        sb.eta_start,
        sb.eta_end
      from public.supplier_batch_lines as sbl
      join public.supplier_batches as sb on sb.id = sbl.batch_id
      where sbl.sku_code = v_line.sku_code
        and sbl.preorder_capacity_qty > sbl.qty_received
        and sb.preorder_status in ('planned', 'open', 'partially_received')
        and sb.eta_start is not null
        and sb.eta_end is not null
      order by sb.eta_end, sb.eta_start, sb.created_at, sbl.line_no, sbl.id
      for update of sb, sbl
    loop
      exit when v_remaining <= 0;

      select coalesce(sum(greatest(a.quantity - a.received_qty, 0)), 0)::integer
      into v_pending
      from public.order_line_preorder_allocations as a
      join public.orders as existing_order on existing_order.id = a.order_id
      where a.supplier_batch_line_id = v_batch_line.id
        and a.status in ('awaiting_stock', 'partially_ready')
        and existing_order.status <> 'cancelled';

      v_available := greatest(
        v_batch_line.preorder_capacity_qty - v_batch_line.qty_received - v_pending,
        0
      );

      if v_available <= 0 then
        continue;
      end if;

      v_take := least(v_remaining, v_available);

      insert into public.order_line_preorder_allocations (
        order_id,
        order_line_id,
        supplier_batch_id,
        supplier_batch_line_id,
        sku_code,
        quantity,
        received_qty,
        status
      )
      values (
        v_order_id,
        v_order_line_id,
        v_batch_line.batch_id,
        v_batch_line.id,
        v_line.sku_code,
        v_take,
        0,
        'awaiting_stock'
      );

      v_eta_start := case
        when v_eta_start is null then v_batch_line.eta_start
        else least(v_eta_start, v_batch_line.eta_start)
      end;
      v_eta_end := case
        when v_eta_end is null then v_batch_line.eta_end
        else greatest(v_eta_end, v_batch_line.eta_end)
      end;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Preorder capacity changed for SKU %; refresh checkout', v_line.sku_code
        using errcode = '40001';
    end if;

    update public.order_lines
    set
      preorder_eta_start = v_eta_start,
      preorder_eta_end = v_eta_end
    where id = v_order_line_id;

    v_total_net := v_total_net
      + round(coalesce(v_line.requested_unit_net, v_line.allowed_unit_price) * v_line.quantity, 2);
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count <> v_expected_count then
    raise exception 'One or more preorder lines reference inactive, closed, or unknown SKUs'
      using errcode = '23503';
  end if;

  update public.orders
  set
    total_net = v_total_net,
    vat = 0,
    shipping = coalesce(p_shipping, 0),
    fiscal = v_fiscal,
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
    'preorder_created',
    v_auth_uid,
    nullif(coalesce(p_customer_note, ''), ''),
    jsonb_build_object(
      'source', 'create_preorder_transaction',
      'order_kind', 'preorder',
      'line_count', v_line_count,
      'customer_level', v_customer_effective_level,
      'customer_type', v_customer.customer_type,
      'level_source', v_customer.level_source,
      'base_customer_level', private.customer_base_level(v_customer.level,v_customer.tier,v_customer.lifetime_spend_net,v_customer.level_source,v_customer.profile_kind),
      'promo_level', v_customer.promo_level,
      'promo_level_expires_at', v_customer.promo_level_expires_at,
      'shipping_method', coalesce(p_shipping_method, ''),
      'payment_method', 'bank_transfer',
      'wallet_applied_amount', 0,
      'terms_accepted', true,
      'price_and_offer_snapshot_validated', true
    )
  );

  return v_order_id;
end;
$$;

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
      'promoPreserved', true,
      'profile_kind', coalesce(v_after.profile_kind, 'customer')
    )
  );

  return v_after;
end;
$$;

create or replace function private.account_pricing_assert_customer(p_customer_id uuid,p_classification_preview boolean default false)
returns public.customers language plpgsql stable security definer set search_path = '' as $$
declare c public.customers; u uuid := auth.uid(); staff boolean;
begin
 if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into c from public.customers where id=coalesce(p_customer_id,private.current_customer_id());
 if c.id is null then raise exception 'Customer not found' using errcode='23503'; end if;
 staff := coalesce(private.partspro_has_permission('customers.read') and private.partspro_has_permission(case when p_classification_preview then 'customers.classify' else 'orders.manage' end),false);
 if not staff and not coalesce((c.user_id=u or exists(select 1 from public.customer_memberships m where m.customer_id=c.id and m.user_id=u and m.status='active')),false) then raise exception 'Customer access denied' using errcode='42501'; end if;
 if not staff and (coalesce(c.status,'') <> 'active' or coalesce(c.assignment_status,'needs_review') <> 'assigned' or not private.is_customer_profile_complete_for_checkout(c.company_name,c.email,c.phone,c.fiscal_code,c.billing_address,c.shipping_address)) then raise exception 'Customer cannot receive quotes' using errcode='42501'; end if;
 if c.profile_kind='archived_customer' then raise exception 'Archived customer' using errcode='42501'; end if;
 return c;
end $$;
create or replace function private.account_product_quotes(p_customer_id uuid,p_items jsonb,p_classification_preview boolean default false)
returns table(id uuid,sku_code text,price numeric,effective_unit_price numeric,base_unit_price numeric,price_source text,customer_level text,price_group_id text,discount_percent numeric,level_discount_percent numeric,level_discount_amount numeric,price_group_discount_percent numeric,price_version text,price_resolved_at timestamptz,customer_type text,base_customer_level text,level_source text,quoted_quantity integer,price_valid_until timestamptz,quote_status text)
language plpgsql stable security definer set search_path = '' as $$
declare c public.customers;
begin
 c := private.account_pricing_assert_customer(p_customer_id,p_classification_preview);
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>1000 then raise exception 'Items must be an array of at most 1000 entries' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x) <> 'object' or jsonb_typeof(x->'sku') is distinct from 'string' or nullif(btrim(x->>'sku'),'') is null or jsonb_typeof(x->'quantity') is distinct from 'number' or (x->>'quantity') !~ '^[1-9][0-9]*$' or (x->>'quantity')::numeric>2147483647) then raise exception 'Each item requires sku and positive integer quantity' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x group by upper(btrim(x->>'sku')) having sum((x->>'quantity')::numeric)>2147483647) then raise exception 'Aggregate quantity overflow' using errcode='22023'; end if;
 return query with requested as (select upper(btrim(x->>'sku')) sku,sum((x->>'quantity')::numeric)::integer qty from jsonb_array_elements(p_items) x group by 1)
 select p.id,coalesce(p.sku_code,r.sku),q.effective_unit_price,q.effective_unit_price,q.base_unit_price,q.price_source,q.customer_level,q.price_group_id,q.discount_percent,q.level_discount_percent,q.level_discount_amount,q.price_group_discount_percent,q.price_version,q.price_resolved_at,c.customer_type,
 private.customer_base_level(c.level,c.tier,c.lifetime_spend_net,c.level_source,c.profile_kind),c.level_source,r.qty,
 (select min(t) from (select c.promo_level_starts_at t where c.promo_level_starts_at>now() union all select c.promo_level_expires_at where c.promo_level_expires_at>now() union all select cp.starts_at from public.customer_product_prices cp where cp.product_id=p.id and cp.customer_id=c.id and cp.min_quantity<=r.qty and cp.starts_at>now() union all select cp.ends_at from public.customer_product_prices cp where cp.product_id=p.id and cp.customer_id=c.id and cp.min_quantity<=r.qty and cp.ends_at>now()) boundaries),
 case when p.id is null then 'not_found' when q.effective_unit_price is null then 'unavailable' else 'quoted' end
 from requested r left join public.products p on upper(p.sku_code)=r.sku left join lateral private.resolve_customer_product_price(p.id,c.id,r.qty) q on true;
end $$;
create or replace function public.resolve_customer_product_quotes(p_customer_id uuid,p_items jsonb)
returns table(id uuid,sku_code text,price numeric,effective_unit_price numeric,base_unit_price numeric,price_source text,customer_level text,price_group_id text,discount_percent numeric,level_discount_percent numeric,level_discount_amount numeric,price_group_discount_percent numeric,price_version text,price_resolved_at timestamptz,customer_type text,base_customer_level text,level_source text,quoted_quantity integer,price_valid_until timestamptz,quote_status text)
language sql stable security invoker set search_path = '' as $$ select * from private.account_product_quotes(p_customer_id,p_items) $$;
create or replace function public.resolve_customer_catalog_prices(p_customer_id uuid,p_sku_codes text[])
returns table(id uuid,sku_code text,price numeric,effective_unit_price numeric,base_unit_price numeric,price_source text,customer_level text,price_group_id text,discount_percent numeric,level_discount_percent numeric,level_discount_amount numeric,price_group_discount_percent numeric,margin_percent numeric,price_version text,price_resolved_at timestamptz)
language sql stable security invoker set search_path = '' as $$
 select q.id,q.sku_code,q.price,q.effective_unit_price,q.base_unit_price,q.price_source,q.customer_level,q.price_group_id,q.discount_percent,q.level_discount_percent,q.level_discount_amount,q.price_group_discount_percent,null::numeric,q.price_version,q.price_resolved_at
 from private.account_product_quotes(p_customer_id,(select coalesce(jsonb_agg(jsonb_build_object('sku',p.sku_code,'quantity',greatest(coalesce(p.moq,1),1))),'[]'::jsonb) from public.products p where upper(p.sku_code) in (select upper(s) from unnest(p_sku_codes) s))) q
$$;
create or replace function private.restore_customer_automatic_level(
  p_customer_id uuid,
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
  v_level text;
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

  v_level := case when v_before.profile_kind = 'employee_self' then private.normalize_customer_tier(coalesce(v_before.level,v_before.tier)) else private.customer_level_for_spend(coalesce(v_before.lifetime_spend_net,0)) end;
  update public.customers
  set level = v_level,
      tier = v_level,
      level_source = 'automatic',
      manual_level_set_by = null,
      manual_level_set_at = null,
      manual_level_reason = null,
      updated_at = now()
  where id = p_customer_id
  returning * into v_after;

  perform private.partspro_audit_admin(
    'customer.level_restore_automatic',
    'customer',
    p_customer_id::text,
    to_jsonb(v_before),
    to_jsonb(v_after),
    p_reason,
    jsonb_build_object(
      'level', v_level,
      'levelSource', 'automatic',
      'promoPreserved', true,
      'profile_kind', coalesce(v_after.profile_kind, 'customer')
    )
  );

  return v_after;
end;
$$;
create or replace function public.admin_restore_customer_automatic_level(p_customer_id uuid,p_reason text) returns public.customers language sql security invoker set search_path = '' as $$ select private.restore_customer_automatic_level(p_customer_id,p_reason) $$;

-- Config and claim ledger are private. The ledger survives profile deletion and is unique per auth identity.
create table private.signup_pricing_campaign(singleton boolean primary key default true check(singleton),enabled boolean not null default true,level text not null default 'king' check(level in ('bronze','silver','gold','emerald','diamond','master','king')),duration_months integer not null default 3 check(duration_months between 1 and 24),starts_at timestamptz,ends_at timestamptz,updated_at timestamptz not null default now(),check(ends_at is null or starts_at is null or ends_at>starts_at));
alter table private.signup_pricing_campaign enable row level security;
insert into private.signup_pricing_campaign(singleton) values(true);
create table private.signup_pricing_grants(user_id uuid primary key,customer_id uuid,granted_at timestamptz not null,expires_at timestamptz,level text not null);
alter table private.signup_pricing_grants enable row level security;
-- Eligibility ledger only: never modifies existing customer prices or promo expiry.
insert into private.signup_pricing_grants(user_id,customer_id,granted_at,expires_at,level)
select distinct on(user_id) user_id,id,coalesce(promo_level_starts_at,created_at,now()),promo_level_expires_at,promo_level from public.customers where user_id is not null and promo_level is not null order by user_id,promo_level_starts_at nulls last,id on conflict do nothing;
-- Include earlier grants subsequently cleared by a manual-level edit, using existing audit evidence.
insert into private.signup_pricing_grants(user_id,customer_id,granted_at,expires_at,level)
select distinct on(c.user_id) c.user_id,c.id,a.created_at,nullif(a.after_data->>'promo_level_expires_at','')::timestamptz,coalesce(a.after_data->>'promo_level','king')
from public.admin_audit_events a join public.customers c on c.id::text=a.entity_id
where a.action='customer.king_promo_apply' and c.user_id is not null
order by c.user_id,a.created_at on conflict do nothing;
-- Manual edits historically cleared registration promos; preserve that explicit claim evidence.
insert into private.signup_pricing_grants(user_id,customer_id,granted_at,expires_at,level)
select distinct on(c.user_id) c.user_id,c.id,
  coalesce(nullif(a.before_data->>'promo_level_starts_at','')::timestamptz,a.created_at),
  nullif(a.before_data->>'promo_level_expires_at','')::timestamptz,
  a.before_data->>'promo_level'
from public.admin_audit_events a join public.customers c on c.id::text=a.entity_id
where a.action='customer.level_update' and c.user_id is not null
  and a.before_data->>'promo_level' in ('bronze','silver','gold','emerald','diamond','master','king')
  and a.before_data->>'promo_level_starts_at' is not null
order by c.user_id,a.created_at on conflict do nothing;
insert into public.admin_permissions(id,label,group_name,description) values('pricing.manage_policy','Manage pricing policy','pricing','Manage signup pricing campaigns and review pricing policy anomalies') on conflict(id) do nothing;
insert into public.admin_role_template_permissions(role_template_id,permission_id) values('admin','pricing.manage_policy') on conflict do nothing;
create or replace function private.apply_customer_signup_king_promo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c private.signup_pricing_campaign; granted uuid; start_time timestamptz:=now(); expiry timestamptz;
begin
 select * into c from private.signup_pricing_campaign where singleton;
 if new.user_id is not null and coalesce(new.profile_kind,'customer') not in ('employee_self','archived_customer') and new.promo_level is null and c.enabled and (c.starts_at is null or start_time>=c.starts_at) and (c.ends_at is null or start_time<c.ends_at) then
 expiry := ((start_time at time zone 'UTC') + make_interval(months=>c.duration_months)) at time zone 'UTC';
 insert into private.signup_pricing_grants(user_id,customer_id,granted_at,expires_at,level) values(new.user_id,new.id,start_time,expiry,c.level) on conflict do nothing returning user_id into granted;
 if granted is not null then new.promo_level:=c.level; new.promo_level_starts_at:=start_time; new.promo_level_expires_at:=expiry; new.promo_level_reason:='registration_pricing_campaign'; end if;
 end if;
 return new;
end $$;
create or replace function private.get_signup_pricing_campaign() returns jsonb language plpgsql stable security definer set search_path = '' as $$ begin perform private.partspro_assert_permission('pricing.manage_policy'); return (select to_jsonb(c)-'singleton' from private.signup_pricing_campaign c where singleton); end $$;
create or replace function public.admin_get_signup_pricing_campaign() returns jsonb language sql security invoker set search_path = '' as $$ select private.get_signup_pricing_campaign() $$;
create or replace function private.update_signup_pricing_campaign(p_enabled boolean,p_level text,p_duration_months integer,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare before_row jsonb; after_row jsonb;
begin
 perform private.partspro_assert_permission('pricing.manage_policy');
 if nullif(btrim(p_reason),'') is null then raise exception 'A reason is required' using errcode='23514'; end if;
 select to_jsonb(c) into before_row from private.signup_pricing_campaign c where singleton for update;
 update private.signup_pricing_campaign set enabled=p_enabled,level=p_level,duration_months=p_duration_months,starts_at=p_starts_at,ends_at=p_ends_at,updated_at=now() where singleton returning to_jsonb(signup_pricing_campaign) into after_row;
 perform private.partspro_audit_admin('pricing.signup_campaign_update','pricing_policy','signup',before_row,after_row,p_reason,'{}'::jsonb);
 return after_row-'singleton';
end $$;
create or replace function public.admin_update_signup_pricing_campaign(p_enabled boolean,p_level text,p_duration_months integer,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text) returns jsonb language sql security invoker set search_path = '' as $$ select private.update_signup_pricing_campaign(p_enabled,p_level,p_duration_months,p_starts_at,p_ends_at,p_reason) $$;
create or replace function private.get_signup_pricing_campaign_audit(p_limit integer) returns jsonb language plpgsql stable security definer set search_path = '' as $$ begin perform private.partspro_assert_permission('pricing.manage_policy'); return (select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from (select id,created_at,actor_id,before_data,after_data,reason from public.admin_audit_events where action='pricing.signup_campaign_update' order by created_at desc limit least(greatest(coalesce(p_limit,50),1),200)) a); end $$;
create or replace function public.admin_get_signup_pricing_campaign_audit(p_limit integer default 50) returns jsonb language sql security invoker set search_path = '' as $$ select private.get_signup_pricing_campaign_audit(p_limit) $$;
create or replace function private.get_pricing_anomalies() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 perform private.partspro_assert_permission('pricing.manage_policy'); perform private.partspro_assert_permission('customers.read');
 return (select coalesce(jsonb_agg(a),'[]'::jsonb) from (
 select jsonb_build_object('kind','manual_effective_mismatch','customer_id',c.id,'stored_level',coalesce(c.level,c.tier),'effective_level',private.customer_effective_level(c.level,c.tier,c.lifetime_spend_net,c.promo_level,c.promo_level_starts_at,c.promo_level_expires_at,now(),c.level_source,c.profile_kind)) a from public.customers c where c.level_source='manual' and private.customer_effective_level(c.level,c.tier,c.lifetime_spend_net,c.promo_level,c.promo_level_starts_at,c.promo_level_expires_at,now(),c.level_source,c.profile_kind) = any((array['bronze','silver','gold','emerald','diamond','master','king'])[1:array_position(array['bronze','silver','gold','emerald','diamond','master','king'],private.normalize_customer_tier(coalesce(c.level,c.tier)))-1])
 union all select jsonb_build_object('kind','retail_below_b2b','product_id',p.id,'sku_code',p.sku_code) from public.products p where p.retail_price<p.b2b_price
 union all select jsonb_build_object('kind','exempt_customer_price_ignored','product_id',p.id,'sku_code',p.sku_code) from public.products p where (upper(btrim(p.brand))='REMAX' or lower(btrim(p.category))='pellicole protettive') and exists(select 1 from public.customer_product_prices cp where cp.product_id=p.id and cp.starts_at<=now() and (cp.ends_at is null or cp.ends_at>now()))
 union all select jsonb_build_object('kind','quote_unavailable','product_id',p.id,'sku_code',p.sku_code) from public.products p where p.status='active' and (coalesce(p.b2b_price,0)<=0 or coalesce(p.retail_price,0)<=0)
 ) anomalies);
end $$;
create or replace function public.admin_get_pricing_anomalies() returns jsonb language sql security invoker set search_path = '' as $$ select private.get_pricing_anomalies() $$;

revoke all on function private.customer_base_level(text,text,numeric,text,text) from public, anon;
grant execute on function private.customer_base_level(text,text,numeric,text,text) to authenticated;

revoke all on function private.customer_effective_level(text,text,numeric,text,timestamptz,timestamptz,timestamptz,text,text) from public, anon;
grant execute on function private.customer_effective_level(text,text,numeric,text,timestamptz,timestamptz,timestamptz,text,text) to authenticated;

revoke all on function private.account_pricing_assert_customer(uuid,boolean) from public, anon;
grant execute on function private.account_pricing_assert_customer(uuid,boolean) to authenticated;

revoke all on function private.account_product_quotes(uuid,jsonb,boolean) from public, anon;
grant execute on function private.account_product_quotes(uuid,jsonb,boolean) to authenticated;

revoke all on function public.resolve_customer_product_quotes(uuid,jsonb) from public, anon;
grant execute on function public.resolve_customer_product_quotes(uuid,jsonb) to authenticated;

revoke all on function public.resolve_customer_catalog_prices(uuid,text[]) from public, anon;
grant execute on function public.resolve_customer_catalog_prices(uuid,text[]) to authenticated;

revoke all on function private.restore_customer_automatic_level(uuid,text) from public, anon;
grant execute on function private.restore_customer_automatic_level(uuid,text) to authenticated;

revoke all on function public.admin_restore_customer_automatic_level(uuid,text) from public, anon;
grant execute on function public.admin_restore_customer_automatic_level(uuid,text) to authenticated;

revoke all on function private.get_signup_pricing_campaign() from public, anon;
grant execute on function private.get_signup_pricing_campaign() to authenticated;

revoke all on function public.admin_get_signup_pricing_campaign() from public, anon;
grant execute on function public.admin_get_signup_pricing_campaign() to authenticated;

revoke all on function private.update_signup_pricing_campaign(boolean,text,integer,timestamptz,timestamptz,text) from public, anon;
grant execute on function private.update_signup_pricing_campaign(boolean,text,integer,timestamptz,timestamptz,text) to authenticated;

revoke all on function public.admin_update_signup_pricing_campaign(boolean,text,integer,timestamptz,timestamptz,text) from public, anon;
grant execute on function public.admin_update_signup_pricing_campaign(boolean,text,integer,timestamptz,timestamptz,text) to authenticated;

revoke all on function private.get_signup_pricing_campaign_audit(integer) from public, anon;
grant execute on function private.get_signup_pricing_campaign_audit(integer) to authenticated;

revoke all on function public.admin_get_signup_pricing_campaign_audit(integer) from public, anon;
grant execute on function public.admin_get_signup_pricing_campaign_audit(integer) to authenticated;

revoke all on function private.get_pricing_anomalies() from public, anon;
grant execute on function private.get_pricing_anomalies() to authenticated;

revoke all on function public.admin_get_pricing_anomalies() from public, anon;
grant execute on function public.admin_get_pricing_anomalies() to authenticated;
revoke all on private.signup_pricing_campaign,private.signup_pricing_grants from public,anon,authenticated;

-- Read-only hypothetical classification resolver. Mirrors the actual resolver without modifying the profile.
create or replace function private.preview_customer_product_price(
  _product_id uuid,
  _customer_id uuid,
  _quantity integer,
  _customer_type text
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
  level_discount_amount numeric,
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
  v_level_discount_amount numeric := 0;
  v_base_unit_price numeric;
  v_level_unit_price numeric;
  v_raw_unit_price numeric;
  v_effective_unit_price numeric;
  v_margin_floor numeric;
  v_price_source text := 'hidden';
  v_resolved_at timestamptz := now();
  v_profile_complete boolean := false;
  v_discount_exempt boolean := false;
begin
  perform private.partspro_assert_permission('customers.read');
  perform private.partspro_assert_permission('customers.classify');
  if _customer_type not in ('retail','wholesale') then raise exception 'Invalid customer type' using errcode='22023'; end if;
  select *
  into v_product
  from public.products
  where id = _product_id
    and (status = 'active' or v_is_staff)
  limit 1;

  if v_product.id is null then
    return;
  end if;

  v_discount_exempt :=
    lower(btrim(coalesce(v_product.category, ''))) = 'pellicole protettive'
    or upper(btrim(coalesce(v_product.brand, ''))) = 'REMAX';

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
    v_customer_type := _customer_type;
    v_level := private.customer_effective_level(
      v_customer.level,
      v_customer.tier,
      v_customer.lifetime_spend_net,
      v_customer.promo_level,
      v_customer.promo_level_starts_at,
      v_customer.promo_level_expires_at,
      v_resolved_at, v_customer.level_source, v_customer.profile_kind
    );
    v_group_id := v_customer.price_group_id;
    v_profile_complete := private.is_customer_profile_complete_for_checkout(
      v_customer.company_name,
      v_customer.email,
      v_customer.phone,
      v_customer.fiscal_code,
      v_customer.billing_address,
      v_customer.shipping_address
    );
    v_can_view :=
      (v_is_staff and private.partspro_has_permission('customers.classify') and private.partspro_has_permission('customers.read'))
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

    if v_discount_exempt then
      v_raw_unit_price := v_base_unit_price;
      v_price_source := case
        when v_customer.id is not null and v_customer_type = 'retail'
          then 'retail_price_discount_exempt'
        else 'b2b_price_discount_exempt'
      end;
    else
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
        v_level_discount_amount := round(
          coalesce(private.customer_level_discount_amount(v_level), 0),
          2
        );

        if coalesce(v_base_unit_price, 0) > 0 then
          v_level_discount_percent := round(
            (least(v_level_discount_amount, v_base_unit_price) / v_base_unit_price) * 100,
            2
          );
        end if;

        if v_customer.id is not null
          and v_customer_type = 'wholesale'
          and v_group_id is not null then
          select least(greatest(coalesce(pg.discount_percent, 0), 0), 100)
          into v_group_discount_percent
          from public.price_groups as pg
          where pg.id = v_group_id;

          v_group_discount_percent := coalesce(v_group_discount_percent, 0);
        end if;

        v_level_unit_price := greatest(
          coalesce(v_base_unit_price, 0) - v_level_discount_amount,
          0
        );
        v_raw_unit_price := round(
          v_level_unit_price * (1 - coalesce(v_group_discount_percent, 0) / 100),
          2
        );
        v_price_source := case
          when v_customer_type = 'retail' and v_level_discount_amount > 0
            then 'retail_customer_level'
          when v_group_discount_percent > 0 and v_level_discount_amount > 0
            then 'level_price_group'
          when v_group_discount_percent > 0 then 'price_group'
          when v_level_discount_amount > 0 then 'customer_level'
          when v_customer.id is not null and v_customer_type = 'retail'
            then 'retail_price'
          else 'b2b_price'
        end;
      end if;
    end if;

    v_margin_floor := case
      when coalesce(v_product.cost_price, 0) > 0
        then least(
          coalesce(v_base_unit_price, 0),
          round(v_product.cost_price / 0.85, 2)
        )
      else 0
    end;
    v_effective_unit_price := greatest(
      coalesce(v_raw_unit_price, 0),
      coalesce(v_margin_floor, 0)
    );

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
    case when v_can_view then v_level_discount_amount else null::numeric end,
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
        then round(
          (
            (v_effective_unit_price - coalesce(v_product.cost_price, 0))
            / v_effective_unit_price
          ) * 100,
          2
        )
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
        coalesce(v_level, ''),
        coalesce(v_customer.level_source, ''),
        private.customer_base_level(v_customer.level,v_customer.tier,v_customer.lifetime_spend_net,v_customer.level_source,v_customer.profile_kind),
        coalesce(v_customer.promo_level, ''),
        coalesce(v_customer.promo_level_starts_at::text, ''),
        coalesce(v_customer.promo_level_expires_at::text, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_group_id else '' end, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_customer_price.id::text else '' end, ''),
        coalesce(case when v_customer_type = 'wholesale' then v_customer_price.updated_at::text else '' end, ''),
        coalesce(v_base_unit_price::text, '0'),
        coalesce(v_level_discount_amount::text, '0'),
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
create or replace function private.preview_customer_classification(p_customer_id uuid,p_customer_type text,p_items jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 perform private.partspro_assert_permission('customers.read'); perform private.partspro_assert_permission('customers.classify');
 if p_customer_type is null or p_customer_type not in ('retail','wholesale') then raise exception 'Invalid customer type' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('sku_code',q.sku_code,'before',to_jsonb(q) || (to_jsonb(original)-'product_id'-'customer_id'-'margin_percent') || jsonb_build_object('price',original.effective_unit_price,'quote_status',case when original.effective_unit_price is null then 'unavailable' else 'quoted' end),'after',
 (to_jsonb(q) || (to_jsonb(sim)-'product_id'-'customer_id'-'margin_percent') || jsonb_build_object('id',q.id,'price',sim.effective_unit_price,'customer_type',p_customer_type,'quote_status',case when sim.effective_unit_price is null then 'unavailable' else 'quoted' end)))),'[]'::jsonb) into result
 from private.account_product_quotes(p_customer_id,p_items,true) q left join lateral private.preview_customer_product_price(q.id,p_customer_id,q.quoted_quantity,q.customer_type) original on true left join lateral private.preview_customer_product_price(q.id,p_customer_id,q.quoted_quantity,p_customer_type) sim on true;
 return jsonb_build_object('customer_id',p_customer_id,'proposed_customer_type',p_customer_type,'items',result);
end $$;
create or replace function public.admin_preview_customer_classification(p_customer_id uuid,p_customer_type text,p_items jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$ select private.preview_customer_classification(p_customer_id,p_customer_type,p_items) $$;
revoke all on function private.preview_customer_product_price(uuid,uuid,integer,text) from public,anon,authenticated;
revoke all on function private.preview_customer_classification(uuid,text,jsonb) from public,anon;
grant execute on function private.preview_customer_classification(uuid,text,jsonb) to authenticated;
revoke all on function public.admin_preview_customer_classification(uuid,text,jsonb) from public,anon;
grant execute on function public.admin_preview_customer_classification(uuid,text,jsonb) to authenticated;

revoke all on function private.apply_customer_signup_king_promo() from public,anon,authenticated;
