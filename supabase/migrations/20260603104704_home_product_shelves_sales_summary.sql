create or replace function private.catalog_hot_product_sales_30d()
returns table (
  sku_code text,
  sold_qty integer,
  last_order_at timestamptz
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    upper(btrim(ol.sku_code)) as sku_code,
    sum(greatest(coalesce(ol.quantity, 0), 0))::integer as sold_qty,
    max(o.created_at) as last_order_at
  from public.order_lines as ol
  join public.orders as o on o.id = ol.order_id
  join public.catalog_public_summary as product
    on product.sku_code = upper(btrim(ol.sku_code))
  where o.created_at >= now() - interval '30 days'
    and coalesce(o.status, '') not in ('draft', 'cancelled')
    and nullif(btrim(ol.sku_code), '') is not null
  group by upper(btrim(ol.sku_code))
  having sum(greatest(coalesce(ol.quantity, 0), 0)) > 0
  order by sold_qty desc, last_order_at desc, sku_code asc
  limit 50;
$$;

comment on function private.catalog_hot_product_sales_30d() is
  'Returns sanitized SKU-level sales totals for the public homepage hot-products shelf. No customer, order number, or amount data is exposed.';

revoke all on function private.catalog_hot_product_sales_30d() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.catalog_hot_product_sales_30d() to anon, authenticated;

create or replace view public.catalog_hot_products_30d
with (security_invoker = on)
as
select
  sku_code,
  sold_qty,
  last_order_at
from private.catalog_hot_product_sales_30d();

comment on view public.catalog_hot_products_30d is
  'Public-safe hot product aggregate for the homepage. Exposes only SKU, quantity sold in the last 30 days, and latest order timestamp.';

grant select on public.catalog_hot_products_30d to anon, authenticated;
