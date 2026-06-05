create or replace function private.customer_level_discount_amount(_level text)
returns numeric
language sql
immutable
as $$
  select case private.normalize_customer_tier(_level)
    when 'king' then 1.50
    when 'master' then 1.25
    when 'diamond' then 1.00
    when 'emerald' then 0.75
    when 'gold' then 0.50
    when 'silver' then 0.25
    else 0.00
  end
$$;

comment on function private.customer_level_discount_amount(text) is
  'Returns the fixed per-unit EUR discount amount for a PartsPro customer level.';

drop view if exists public.catalog_buyer_prices;
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
  'Resolves PartsPro retail/wholesale customer prices. Retail uses retail_price and wholesale uses b2b_price; customer levels apply fixed per-unit EUR amounts, wholesale price groups apply after level amounts, and customer product prices override both.';

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
