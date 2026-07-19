-- Keep the original create implementation as the single transactional writer,
-- but make every externally reachable path enforce field-level permissions.
create or replace function private.partspro_guard_admin_create_product_draft(
  p_product jsonb,
  p_reason text default ''
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.partspro_assert_permission('product.create_draft');

  if
    greatest(coalesce(nullif(p_product ->> 'b2b_price', '')::numeric, 0), 0) > 0
    or greatest(coalesce(nullif(p_product ->> 'retail_price', '')::numeric, 0), 0) > 0
    or nullif(btrim(coalesce(p_product ->> 'vat_mode', '')), '') is not null
  then
    perform private.partspro_assert_permission('product.edit_price');
  end if;

  if greatest(coalesce(nullif(p_product ->> 'cost_price', '')::numeric, 0), 0) > 0 then
    perform private.partspro_assert_permission('product.edit_cost');
  end if;

  if greatest(coalesce(nullif(p_product ->> 'stock_qty', '')::integer, 0), 0) > 0 then
    perform private.partspro_assert_permission('product.adjust_stock');
  end if;

  if
    nullif(btrim(coalesce(p_product ->> 'image_path', '')), '') is not null
    or nullif(btrim(coalesce(p_product ->> 'image_alt', '')), '') is not null
    or (
      jsonb_typeof(p_product -> 'gallery_image_paths') = 'array'
      and jsonb_array_length(p_product -> 'gallery_image_paths') > 0
    )
  then
    perform private.partspro_assert_permission('product.image_manage');
  end if;

  return private.admin_create_product_draft(p_product, p_reason);
end;
$$;

revoke execute on function private.admin_create_product_draft(jsonb, text)
  from public, anon, authenticated;
grant execute on function private.admin_create_product_draft(jsonb, text)
  to service_role;

revoke execute on function private.partspro_guard_admin_create_product_draft(jsonb, text)
  from public, anon;
grant execute on function private.partspro_guard_admin_create_product_draft(jsonb, text)
  to authenticated, service_role;

create or replace function public.admin_create_product_draft(
  p_product jsonb,
  p_reason text default ''
)
returns public.products
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.partspro_guard_admin_create_product_draft(p_product, p_reason)
$$;

revoke execute on function public.admin_create_product_draft(jsonb, text)
  from public, anon;
grant execute on function public.admin_create_product_draft(jsonb, text)
  to authenticated, service_role;

comment on function private.partspro_guard_admin_create_product_draft(jsonb, text) is
  'Enforces product field permissions before the transactional draft creation RPC.';
