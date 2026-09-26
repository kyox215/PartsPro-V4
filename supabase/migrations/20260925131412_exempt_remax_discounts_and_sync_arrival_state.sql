-- Keep protective-film and REMAX prices at their configured retail/B2B base price.
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
  'Resolves PartsPro customer prices. Products in Pellicole Protettive and all REMAX products are discount-exempt and always use their retail or B2B base price; other products retain customer, level, price-group, and margin-floor rules.';

with affected as (
  update public.products as p
  set
    preorder_enabled = false,
    preorder_close_at = coalesce(p.preorder_close_at, now()),
    updated_at = now()
  from public.supplier_batch_lines as sbl
  join public.supplier_batches as sb on sb.id = sbl.batch_id
  where p.sku_code = sbl.sku_code
    and sb.batch_code = 'REMAX-SONG-2026-07-A'
    and sbl.qty_received > 0
    and upper(btrim(coalesce(p.brand, ''))) = 'REMAX'
    and p.preorder_enabled
  returning p.sku_code
)
insert into public.admin_audit_events (
  action,
  entity_type,
  entity_id,
  after_data,
  reason,
  request_metadata
)
select
  'remax.preorder_arrival_state_normalized',
  'supplier_batch',
  'REMAX-SONG-2026-07-A',
  jsonb_build_object(
    'preorder_disabled_skus', coalesce(jsonb_agg(sku_code order by sku_code), '[]'::jsonb),
    'preorder_disabled_count', count(*)
  ),
  'Received REMAX products are sold as stocked items; unreceived products remain preorderable',
  jsonb_build_object('source', 'migration', 'batch_code', 'REMAX-SONG-2026-07-A')
from affected
having count(*) > 0;
