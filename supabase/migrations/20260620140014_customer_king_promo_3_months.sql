alter table public.customers
  add column if not exists promo_level text
    check (promo_level is null or promo_level in ('bronze', 'silver', 'gold', 'emerald', 'diamond', 'master', 'king')),
  add column if not exists promo_level_starts_at timestamptz,
  add column if not exists promo_level_expires_at timestamptz,
  add column if not exists promo_level_reason text;

create index if not exists customers_promo_level_expires_idx
  on public.customers (promo_level_expires_at)
  where promo_level is not null;

create or replace function private.customer_effective_level(
  _level text,
  _tier text,
  _lifetime_spend_net numeric,
  _promo_level text,
  _promo_level_starts_at timestamptz,
  _promo_level_expires_at timestamptz,
  _as_of timestamptz default now()
)
returns text
language sql
stable
as $$
  select case
    when _promo_level is not null
      and _promo_level_starts_at is not null
      and _promo_level_expires_at is not null
      and _as_of >= _promo_level_starts_at
      and _as_of < _promo_level_expires_at
      then private.normalize_customer_tier(_promo_level)
    when _promo_level is not null
      and _promo_level_expires_at is not null
      and _as_of >= _promo_level_expires_at
      then private.customer_level_for_spend(coalesce(_lifetime_spend_net, 0))
    else private.normalize_customer_tier(coalesce(_level, _tier, 'bronze'))
  end
$$;

comment on function private.customer_effective_level(text, text, numeric, text, timestamptz, timestamptz, timestamptz) is
  'Returns the customer level currently used for pricing. Active promo levels override stored/manual levels; expired promo levels fall back to spend-based recalculation.';

create or replace function private.apply_customer_signup_king_promo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz;
begin
  if new.user_id is not null
    and coalesce(new.profile_kind, 'customer') not in ('employee_self', 'archived_customer')
    and new.promo_level is null then
    v_start := coalesce(new.created_at, now());
    new.promo_level := 'king';
    new.promo_level_starts_at := v_start;
    new.promo_level_expires_at := v_start + interval '3 months';
    new.promo_level_reason := 'registration_king_3_month_campaign';
  end if;

  return new;
end;
$$;

drop trigger if exists partspro_customer_signup_king_promo on public.customers;
create trigger partspro_customer_signup_king_promo
  before insert on public.customers
  for each row execute function private.apply_customer_signup_king_promo();

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
      promo_level = null,
      promo_level_starts_at = null,
      promo_level_expires_at = null,
      promo_level_reason = null,
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
      'promoCleared', v_before.promo_level is not null,
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

select set_config('partspro.allow_account_admin_update', 'on', true);

with eligible as (
  select
    c.*,
    private.customer_effective_level(
      c.level,
      c.tier,
      c.lifetime_spend_net,
      c.promo_level,
      c.promo_level_starts_at,
      c.promo_level_expires_at,
      now()
    ) as before_effective_level
  from public.customers as c
  where c.status = 'active'
    and coalesce(c.assignment_status, 'needs_review') = 'assigned'
    and coalesce(c.profile_kind, 'customer') not in ('employee_self', 'archived_customer')
),
updated as (
  update public.customers as c
  set promo_level = 'king',
      promo_level_starts_at = now(),
      promo_level_expires_at = now() + interval '3 months',
      promo_level_reason = 'existing_customer_king_3_month_campaign',
      level = 'king',
      tier = 'king',
      updated_at = now()
  from eligible as e
  where c.id = e.id
  returning
    c.*,
    e.before_effective_level
)
insert into public.admin_audit_events (
  action,
  actor_email,
  actor_id,
  actor_role,
  after_data,
  before_data,
  entity_id,
  entity_type,
  reason,
  request_metadata,
  result
)
select
  'customer.king_promo_apply',
  null,
  null,
  'system',
  jsonb_build_object(
    'level', u.level,
    'tier', u.tier,
    'promo_level', u.promo_level,
    'promo_level_starts_at', u.promo_level_starts_at,
    'promo_level_expires_at', u.promo_level_expires_at,
    'promo_level_reason', u.promo_level_reason
  ),
  jsonb_build_object(
    'effective_level', u.before_effective_level
  ),
  u.id::text,
  'customer',
  'Existing active assigned customers upgraded to King for 3 months.',
  jsonb_build_object(
    'campaign', 'king_3_months',
    'scope', 'active_assigned_real_customers'
  ),
  'success'
from updated as u;

drop view if exists public.catalog_buyer_prices;
drop function if exists public.resolve_customer_catalog_prices(uuid, text[]);
drop function if exists private.resolve_customer_product_price(uuid, uuid, integer);

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
    v_level := private.customer_effective_level(
      v_customer.level,
      v_customer.tier,
      v_customer.lifetime_spend_net,
      v_customer.promo_level,
      v_customer.promo_level_starts_at,
      v_customer.promo_level_expires_at,
      v_resolved_at
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
      v_level_discount_amount := round(coalesce(private.customer_level_discount_amount(v_level), 0), 2);

      if coalesce(v_base_unit_price, 0) > 0 then
        v_level_discount_percent := round(
          (least(v_level_discount_amount, v_base_unit_price) / v_base_unit_price) * 100,
          2
        );
      end if;

      if v_customer.id is not null and v_customer_type = 'wholesale' and v_group_id is not null then
        select least(greatest(coalesce(pg.discount_percent, 0), 0), 100)
        into v_group_discount_percent
        from public.price_groups as pg
        where pg.id = v_group_id;

        v_group_discount_percent := coalesce(v_group_discount_percent, 0);
      end if;

      v_level_unit_price := greatest(coalesce(v_base_unit_price, 0) - v_level_discount_amount, 0);
      v_raw_unit_price := round(
        v_level_unit_price * (1 - coalesce(v_group_discount_percent, 0) / 100),
        2
      );
      v_price_source := case
        when v_customer_type = 'retail' and v_level_discount_amount > 0 then 'retail_customer_level'
        when v_group_discount_percent > 0 and v_level_discount_amount > 0 then 'level_price_group'
        when v_group_discount_percent > 0 then 'price_group'
        when v_level_discount_amount > 0 then 'customer_level'
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
        coalesce(v_level, ''),
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

grant execute on function private.resolve_customer_product_price(uuid, uuid, integer)
  to authenticated;

comment on function private.resolve_customer_product_price(uuid, uuid, integer) is
  'Resolves PartsPro customer prices using active promotional customer levels before stored/manual levels; expired promos fall back to spend-based level.';

create or replace view public.catalog_buyer_prices
with (security_invoker = on)
as
select
  p.id,
  p.sku_code,
  p.moq,
  p.vat_mode,
  (select private.can_view_b2b_prices()) as can_view_b2b_prices,
  private.product_b2b_price(p.id) as b2b_price,
  private.product_tier_prices(p.id) as tier_prices,
  resolved.effective_unit_price as price,
  resolved.effective_unit_price,
  resolved.base_unit_price,
  resolved.price_source,
  resolved.customer_level,
  resolved.price_group_id,
  resolved.discount_percent,
  resolved.level_discount_percent,
  resolved.level_discount_amount,
  resolved.price_group_discount_percent,
  resolved.margin_percent,
  resolved.price_version,
  resolved.price_resolved_at
from public.products as p
left join lateral private.resolve_customer_product_price(p.id, null, p.moq) as resolved
  on true
where p.status = 'active'
   or (select private.is_staff());

grant select on public.catalog_buyer_prices to authenticated;

create or replace function public.resolve_customer_catalog_prices(
  p_customer_id uuid,
  p_sku_codes text[]
)
returns table (
  id uuid,
  sku_code text,
  price numeric,
  effective_unit_price numeric,
  base_unit_price numeric,
  price_source text,
  customer_level text,
  price_group_id text,
  discount_percent numeric,
  level_discount_percent numeric,
  level_discount_amount numeric,
  price_group_discount_percent numeric,
  margin_percent numeric,
  price_version text,
  price_resolved_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.sku_code,
    resolved.effective_unit_price as price,
    resolved.effective_unit_price,
    resolved.base_unit_price,
    resolved.price_source,
    resolved.customer_level,
    resolved.price_group_id,
    resolved.discount_percent,
    resolved.level_discount_percent,
    resolved.level_discount_amount,
    resolved.price_group_discount_percent,
    resolved.margin_percent,
    resolved.price_version,
    resolved.price_resolved_at
  from public.products as p
  join unnest(coalesce(p_sku_codes, array[]::text[])) as requested(sku_code)
    on upper(p.sku_code) = upper(requested.sku_code)
  left join lateral private.resolve_customer_product_price(
    p.id,
    p_customer_id,
    p.moq
  ) as resolved on true
  where p.status = 'active'
     or (select private.is_staff())
$$;

revoke execute on function public.resolve_customer_catalog_prices(uuid, text[])
  from public, anon;
grant execute on function public.resolve_customer_catalog_prices(uuid, text[])
  to authenticated;

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
    now()
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
