create extension if not exists pg_trgm with schema extensions;

create index if not exists customer_cart_items_user_created_idx
  on public.customer_cart_items (user_id, created_at asc);

create index if not exists products_active_name_trgm_idx
  on public.products using gin (name gin_trgm_ops)
  where status = 'active';

create index if not exists products_active_sku_code_trgm_idx
  on public.products using gin (sku_code gin_trgm_ops)
  where status = 'active';

create index if not exists products_active_brand_trgm_idx
  on public.products using gin (brand gin_trgm_ops)
  where status = 'active';

create index if not exists products_active_category_trgm_idx
  on public.products using gin (category gin_trgm_ops)
  where status = 'active';

create index if not exists products_active_alternative_skus_gin_idx
  on public.products using gin (alternative_skus)
  where status = 'active';

create or replace function public.replace_current_customer_cart(p_items jsonb default '[]'::jsonb)
returns table (
  sku_code text,
  quantity integer,
  customer_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_customer_id uuid := (select private.current_customer_id());
  v_item_count integer;
begin
  if v_auth_uid is null then
    raise exception 'Authentication is required to replace the cart.'
      using errcode = '28000';
  end if;

  if p_items is null then
    p_items := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Cart payload must be a JSON array.'
      using errcode = '22023';
  end if;

  v_item_count := jsonb_array_length(p_items);

  if v_item_count > 100 then
    raise exception 'Cart cannot contain more than 100 items.'
      using errcode = '22023';
  end if;

  if exists (
    with parsed as (
      select
        upper(trim(coalesce(item.value ->> 'sku', ''))) as sku_code,
        case
          when coalesce(item.value ->> 'quantity', '') ~ '^[0-9]+$'
            then (item.value ->> 'quantity')::integer
          else null
        end as quantity
      from jsonb_array_elements(p_items) as item(value)
    )
    select 1
    from parsed as item
    where item.sku_code is null
       or item.sku_code = ''
       or item.sku_code !~ '^[A-Z0-9_+.-]{3,64}$'
       or item.quantity is null
       or item.quantity < 1
       or item.quantity > 999
  ) then
    raise exception 'Cart payload contains an invalid SKU or quantity.'
      using errcode = '22023';
  end if;

  if exists (
    with parsed as (
      select upper(trim(coalesce(item.value ->> 'sku', ''))) as sku_code
      from jsonb_array_elements(p_items) as item(value)
    )
    select 1
    from parsed
    group by sku_code
    having count(*) > 1
  ) then
    raise exception 'Cart payload cannot contain duplicate SKUs.'
      using errcode = '23505';
  end if;

  with parsed as (
    select upper(trim(coalesce(item.value ->> 'sku', ''))) as sku_code
    from jsonb_array_elements(p_items) as item(value)
  )
  delete from public.customer_cart_items as cart
  where cart.user_id = v_auth_uid
    and not exists (
      select 1
      from parsed as item
      where item.sku_code = cart.sku_code
    );

  with parsed as (
    select
      upper(trim(coalesce(item.value ->> 'sku', ''))) as sku_code,
      (item.value ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as item(value)
  )
  insert into public.customer_cart_items (
    user_id,
    customer_id,
    sku_code,
    quantity
  )
  select
    v_auth_uid,
    v_customer_id,
    item.sku_code,
    item.quantity
  from parsed as item
  on conflict (user_id, sku_code) do update
    set customer_id = excluded.customer_id,
        quantity = excluded.quantity,
        updated_at = now();

  insert into public.customer_cart_sync_state (
    user_id,
    customer_id,
    cart_version
  )
  values (
    v_auth_uid,
    v_customer_id,
    1
  )
  on conflict (user_id) do update
    set customer_id = excluded.customer_id,
        cart_version = public.customer_cart_sync_state.cart_version + 1,
        updated_at = now();

  return query
  select
    cart.sku_code,
    cart.quantity,
    cart.customer_id,
    cart.created_at,
    cart.updated_at
  from public.customer_cart_items as cart
  where cart.user_id = v_auth_uid
  order by cart.created_at asc;
end;
$$;

revoke execute on function public.replace_current_customer_cart(jsonb)
  from public, anon;
grant execute on function public.replace_current_customer_cart(jsonb) to authenticated;

comment on function public.replace_current_customer_cart(jsonb) is
  'Atomically replaces the authenticated PartsPro customer cart and bumps realtime sync state while preserving RLS.';

notify pgrst, 'reload schema';
