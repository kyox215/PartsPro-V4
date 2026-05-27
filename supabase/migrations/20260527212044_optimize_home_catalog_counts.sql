create or replace view public.catalog_category_counts
with (security_invoker = on)
as
select
  summary.category,
  count(*)::integer as product_count
from public.catalog_public_summary as summary
where nullif(btrim(summary.category), '') is not null
group by summary.category;

grant select on public.catalog_category_counts to anon, authenticated;
