create index if not exists products_active_brand_stock_idx
  on public.products (brand, stock_qty desc, name)
  where status = 'active';

create index if not exists products_active_category_stock_idx
  on public.products (category, stock_qty desc, name)
  where status = 'active';

create index if not exists products_active_stock_idx
  on public.products (stock_qty desc, name)
  where status = 'active';

create index if not exists products_active_stock_status_idx
  on public.products (stock_status, stock_qty desc, name)
  where status = 'active';

create index if not exists products_active_compatibility_models_gin_idx
  on public.products using gin (compatibility_models)
  where status = 'active';

create or replace view public.catalog_model_options
with (security_invoker = on)
as
select
  p.brand,
  model_option.model
from public.products as p
cross join lateral unnest(p.compatibility_models) as model_option(model)
where p.status = 'active'
  and nullif(btrim(p.brand), '') is not null
  and nullif(btrim(model_option.model), '') is not null
group by p.brand, model_option.model;

grant select on public.catalog_model_options to anon, authenticated;
