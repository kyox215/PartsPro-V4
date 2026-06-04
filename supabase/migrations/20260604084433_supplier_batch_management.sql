-- Supplier and receiving-batch management for traceable product imports.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  display_label text not null,
  vat_number text,
  eori text,
  country text,
  website_url text,
  tags text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_code_not_blank check (nullif(btrim(code), '') is not null),
  constraint suppliers_name_not_blank check (nullif(btrim(name), '') is not null)
);

create table if not exists public.supplier_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,
  supplier_id uuid not null references public.suppliers(id) on update cascade on delete restrict,
  invoice_no text,
  order_no text,
  invoice_date date,
  received_at timestamptz,
  total_qty integer not null default 0 check (total_qty >= 0),
  total_cost numeric(12, 2) not null default 0 check (total_cost >= 0),
  currency text not null default 'EUR',
  vat_mode text not null default 'IVA esclusa',
  tags text[] not null default '{}'::text[],
  source_file_name text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_batches_code_not_blank check (nullif(btrim(batch_code), '') is not null)
);

create table if not exists public.supplier_batch_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.supplier_batches(id) on update cascade on delete cascade,
  line_no integer not null,
  ean text,
  supplier_sku text,
  sku_code text references public.products(sku_code) on update cascade on delete set null,
  name text not null,
  qty_received integer not null default 0 check (qty_received >= 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  line_total numeric(12, 2) not null default 0 check (line_total >= 0),
  image_status text not null default 'missing' check (image_status in ('missing', 'matched', 'uploaded', 'skipped')),
  product_status text not null default 'draft' check (product_status in ('active', 'draft', 'hidden', 'blocked')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_batch_lines_name_not_blank check (nullif(btrim(name), '') is not null),
  constraint supplier_batch_lines_line_no_positive check (line_no > 0),
  constraint supplier_batch_lines_unique_line unique (batch_id, line_no),
  constraint supplier_batch_lines_unique_ean unique (batch_id, ean),
  constraint supplier_batch_lines_unique_supplier_sku unique (batch_id, supplier_sku)
);

create index if not exists suppliers_status_label_idx
  on public.suppliers (status, display_label);

create index if not exists supplier_batches_supplier_created_idx
  on public.supplier_batches (supplier_id, created_at desc);

create index if not exists supplier_batch_lines_batch_sku_idx
  on public.supplier_batch_lines (batch_id, sku_code);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'suppliers_set_updated_at') then
    create trigger suppliers_set_updated_at
      before update on public.suppliers
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'supplier_batches_set_updated_at') then
    create trigger supplier_batches_set_updated_at
      before update on public.supplier_batches
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'supplier_batch_lines_set_updated_at') then
    create trigger supplier_batch_lines_set_updated_at
      before update on public.supplier_batch_lines
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.suppliers enable row level security;
alter table public.supplier_batches enable row level security;
alter table public.supplier_batch_lines enable row level security;

grant select on public.suppliers to authenticated;
grant select on public.supplier_batches to authenticated;
grant select on public.supplier_batch_lines to authenticated;
grant insert, update, delete on public.suppliers to authenticated;
grant insert, update, delete on public.supplier_batches to authenticated;
grant insert, update, delete on public.supplier_batch_lines to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'suppliers'
      and policyname = 'partspro_suppliers_staff_read'
  ) then
    create policy "partspro_suppliers_staff_read"
      on public.suppliers
      for select
      to authenticated
      using ((select private.partspro_has_permission('product.read_admin')) or (select private.partspro_has_permission('products.read_admin')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'supplier_batches'
      and policyname = 'partspro_supplier_batches_staff_read'
  ) then
    create policy "partspro_supplier_batches_staff_read"
      on public.supplier_batches
      for select
      to authenticated
      using ((select private.partspro_has_permission('product.read_admin')) or (select private.partspro_has_permission('products.read_admin')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'supplier_batch_lines'
      and policyname = 'partspro_supplier_batch_lines_staff_read'
  ) then
    create policy "partspro_supplier_batch_lines_staff_read"
      on public.supplier_batch_lines
      for select
      to authenticated
      using ((select private.partspro_has_permission('product.read_admin')) or (select private.partspro_has_permission('products.read_admin')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'suppliers'
      and policyname = 'partspro_suppliers_admin_write'
  ) then
    create policy "partspro_suppliers_admin_write"
      on public.suppliers
      for all
      to authenticated
      using ((select private.partspro_has_permission('product.edit_content')))
      with check ((select private.partspro_has_permission('product.edit_content')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'supplier_batches'
      and policyname = 'partspro_supplier_batches_admin_write'
  ) then
    create policy "partspro_supplier_batches_admin_write"
      on public.supplier_batches
      for all
      to authenticated
      using ((select private.partspro_has_permission('product.edit_content')))
      with check ((select private.partspro_has_permission('product.edit_content')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'supplier_batch_lines'
      and policyname = 'partspro_supplier_batch_lines_admin_write'
  ) then
    create policy "partspro_supplier_batch_lines_admin_write"
      on public.supplier_batch_lines
      for all
      to authenticated
      using ((select private.partspro_has_permission('product.edit_content')))
      with check ((select private.partspro_has_permission('product.edit_content')));
  end if;
end $$;

drop function if exists public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text);
drop function if exists private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text);

create or replace function private.admin_list_products(
  p_limit integer default 20,
  p_offset integer default 0,
  p_q text default null,
  p_brand text default null,
  p_model text default null,
  p_category text default null,
  p_catalog_status text default null,
  p_stock_status text default null,
  p_warehouse text default null,
  p_grade text default null,
  p_sort text default 'updated_desc',
  p_model_series text default null,
  p_supplier text default null,
  p_batch_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_sort text := coalesce(nullif(btrim(p_sort), ''), 'updated_desc');
  v_total integer := 0;
  v_products jsonb := '[]'::jsonb;
begin
  perform private.partspro_assert_admin_product_read();

  with inventory_summary as (
    select
      i.sku_code,
      coalesce(sum(i.actual_qty), 0) as actual_qty,
      coalesce(sum(i.available_qty), 0) as available_qty,
      coalesce(sum(i.locked_qty), 0) as locked_qty
    from public.inventory_items as i
    group by i.sku_code
  ),
  filtered_products as (
    select
      p.id,
      p.sku_code,
      p.name,
      p.brand,
      p.model,
      p.model_series,
      p.model_code,
      p.model_codes,
      p.category,
      p.quality_grade,
      p.stock_status,
      p.moq,
      p.cost_price,
      p.retail_price,
      p.b2b_price,
      p.vat_mode,
      p.warranty_days,
      p.weight_gram,
      p.stock_qty,
      p.location,
      p.batch_code,
      p.supplier,
      p.compatibility_models,
      p.highlights,
      p.status,
      p.updated_at,
      p.image_path,
      p.image_alt,
      p.gallery_image_paths,
      p.created_at,
      coalesce(inv.actual_qty, p.stock_qty::bigint) as actual_qty,
      coalesce(inv.available_qty, p.stock_qty::bigint) as available_qty,
      coalesce(inv.locked_qty, 0) as locked_qty
    from public.products as p
    left join inventory_summary as inv on inv.sku_code = p.sku_code
    where (nullif(btrim(coalesce(p_q, '')), '') is null
        or p.name ilike '%' || btrim(p_q) || '%'
        or p.sku_code ilike '%' || btrim(p_q) || '%'
        or p.brand ilike '%' || btrim(p_q) || '%'
        or p.category ilike '%' || btrim(p_q) || '%'
        or p.model ilike '%' || btrim(p_q) || '%'
        or p.model_series ilike '%' || btrim(p_q) || '%'
        or p.model_code ilike '%' || btrim(p_q) || '%'
        or p.supplier ilike '%' || btrim(p_q) || '%'
        or p.batch_code ilike '%' || btrim(p_q) || '%')
      and (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = p_brand)
      and (nullif(btrim(coalesce(p_model_series, '')), '') is null
        or p.model_series = p_model_series
        or exists (
          select 1
          from unnest(p.compatibility_models) as model_option(model)
          where private.partspro_model_series(p.brand, model_option.model) = p_model_series
        ))
      and (nullif(btrim(coalesce(p_category, '')), '') is null or p.category = p_category)
      and (nullif(btrim(coalesce(p_catalog_status, '')), '') is null or p.status = p_catalog_status)
      and (nullif(btrim(coalesce(p_stock_status, '')), '') is null or p.stock_status = p_stock_status)
      and (nullif(btrim(coalesce(p_warehouse, '')), '') is null or p.location = p_warehouse)
      and (nullif(btrim(coalesce(p_grade, '')), '') is null or p.quality_grade = p_grade)
      and (nullif(btrim(coalesce(p_supplier, '')), '') is null or p.supplier = p_supplier)
      and (nullif(btrim(coalesce(p_batch_code, '')), '') is null or p.batch_code = p_batch_code)
      and (
        nullif(btrim(coalesce(p_model, '')), '') is null
        or p.model = p_model
        or p_model = any(p.model_codes)
        or p.compatibility_models @> array[p_model]::text[]
      )
  )
  select count(*) into v_total
  from filtered_products;

  with inventory_summary as (
    select
      i.sku_code,
      coalesce(sum(i.actual_qty), 0) as actual_qty,
      coalesce(sum(i.available_qty), 0) as available_qty,
      coalesce(sum(i.locked_qty), 0) as locked_qty
    from public.inventory_items as i
    group by i.sku_code
  ),
  filtered_products as (
    select
      p.id,
      p.sku_code,
      p.name,
      p.brand,
      p.model,
      p.model_series,
      p.model_code,
      p.model_codes,
      p.category,
      p.quality_grade,
      p.stock_status,
      p.moq,
      p.cost_price,
      p.retail_price,
      p.b2b_price,
      p.vat_mode,
      p.warranty_days,
      p.weight_gram,
      p.stock_qty,
      p.location,
      p.batch_code,
      p.supplier,
      p.compatibility_models,
      p.highlights,
      p.status,
      p.updated_at,
      p.image_path,
      p.image_alt,
      p.gallery_image_paths,
      p.created_at,
      coalesce(inv.actual_qty, p.stock_qty::bigint) as actual_qty,
      coalesce(inv.available_qty, p.stock_qty::bigint) as available_qty,
      coalesce(inv.locked_qty, 0) as locked_qty
    from public.products as p
    left join inventory_summary as inv on inv.sku_code = p.sku_code
    where (nullif(btrim(coalesce(p_q, '')), '') is null
        or p.name ilike '%' || btrim(p_q) || '%'
        or p.sku_code ilike '%' || btrim(p_q) || '%'
        or p.brand ilike '%' || btrim(p_q) || '%'
        or p.category ilike '%' || btrim(p_q) || '%'
        or p.model ilike '%' || btrim(p_q) || '%'
        or p.model_series ilike '%' || btrim(p_q) || '%'
        or p.model_code ilike '%' || btrim(p_q) || '%'
        or p.supplier ilike '%' || btrim(p_q) || '%'
        or p.batch_code ilike '%' || btrim(p_q) || '%')
      and (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = p_brand)
      and (nullif(btrim(coalesce(p_model_series, '')), '') is null
        or p.model_series = p_model_series
        or exists (
          select 1
          from unnest(p.compatibility_models) as model_option(model)
          where private.partspro_model_series(p.brand, model_option.model) = p_model_series
        ))
      and (nullif(btrim(coalesce(p_category, '')), '') is null or p.category = p_category)
      and (nullif(btrim(coalesce(p_catalog_status, '')), '') is null or p.status = p_catalog_status)
      and (nullif(btrim(coalesce(p_stock_status, '')), '') is null or p.stock_status = p_stock_status)
      and (nullif(btrim(coalesce(p_warehouse, '')), '') is null or p.location = p_warehouse)
      and (nullif(btrim(coalesce(p_grade, '')), '') is null or p.quality_grade = p_grade)
      and (nullif(btrim(coalesce(p_supplier, '')), '') is null or p.supplier = p_supplier)
      and (nullif(btrim(coalesce(p_batch_code, '')), '') is null or p.batch_code = p_batch_code)
      and (
        nullif(btrim(coalesce(p_model, '')), '') is null
        or p.model = p_model
        or p_model = any(p.model_codes)
        or p.compatibility_models @> array[p_model]::text[]
      )
  ),
  page_products as (
    select *
    from filtered_products
    order by
      case when v_sort = 'stock_desc' then stock_qty end desc nulls last,
      case when v_sort = 'created_desc' then created_at end desc nulls last,
      case when v_sort = 'name' then name end asc nulls last,
      case when v_sort not in ('stock_desc', 'created_desc', 'name') then updated_at end desc nulls last,
      sku_code asc
    limit v_limit
    offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(page_products)), '[]'::jsonb)
  into v_products
  from page_products;

  return jsonb_build_object(
    'products', coalesce(v_products, '[]'::jsonb),
    'total', coalesce(v_total, 0)
  );
end;
$$;

create or replace function public.admin_list_products(
  p_limit integer default 20,
  p_offset integer default 0,
  p_q text default null,
  p_brand text default null,
  p_model text default null,
  p_category text default null,
  p_catalog_status text default null,
  p_stock_status text default null,
  p_warehouse text default null,
  p_grade text default null,
  p_sort text default 'updated_desc',
  p_model_series text default null,
  p_supplier text default null,
  p_batch_code text default null
)
returns jsonb
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.admin_list_products(
    p_limit,
    p_offset,
    p_q,
    p_brand,
    p_model,
    p_category,
    p_catalog_status,
    p_stock_status,
    p_warehouse,
    p_grade,
    p_sort,
    p_model_series,
    p_supplier,
    p_batch_code
  )
$$;

revoke execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

revoke execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text) from public;
revoke execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text) from anon;
grant execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;

insert into public.suppliers (code, name, display_label, vat_number, eori, country, website_url, tags, status, metadata)
values
  ('EXTERNAL', 'External Supplier', 'External Supplier', null, null, null, null, array['legacy'], 'active', jsonb_build_object('source', 'existing_products')),
  ('MOBILAX', 'Mobilax ChinaTech', 'Mobilax ChinaTech', null, null, null, 'https://www.mobilax.com', array['mobilax'], 'active', jsonb_build_object('source', 'existing_products')),
  ('UTOPYA', 'UTOPYA', 'UTOPYA', 'FR84791460660', 'FR79146066000099', 'FR', 'https://www.utopya.it', array['utopya'], 'active', jsonb_build_object('source', 'supplier_invoice'))
on conflict (code) do update
set
  name = excluded.name,
  display_label = excluded.display_label,
  vat_number = coalesce(public.suppliers.vat_number, excluded.vat_number),
  eori = coalesce(public.suppliers.eori, excluded.eori),
  country = coalesce(public.suppliers.country, excluded.country),
  website_url = coalesce(public.suppliers.website_url, excluded.website_url),
  tags = array(select distinct value from unnest(coalesce(public.suppliers.tags, '{}'::text[]) || excluded.tags) as value),
  status = excluded.status,
  metadata = coalesce(public.suppliers.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

insert into public.supplier_batches (
  batch_code,
  supplier_id,
  total_qty,
  total_cost,
  currency,
  vat_mode,
  tags,
  metadata
)
select
  coalesce(nullif(p.batch_code, ''), 'UNBATCHED-' || s.code),
  s.id,
  coalesce(sum(p.stock_qty), 0)::int,
  coalesce(sum(p.cost_price * p.stock_qty), 0)::numeric(12, 2),
  'EUR',
  'IVA esclusa',
  array['backfill'],
  jsonb_build_object('source', 'existing_products', 'supplier_name', p.supplier)
from public.products p
join public.suppliers s on s.name = p.supplier or s.display_label = p.supplier
where nullif(p.supplier, '') is not null
group by coalesce(nullif(p.batch_code, ''), 'UNBATCHED-' || s.code), s.id, p.supplier
on conflict (batch_code) do update
set
  supplier_id = excluded.supplier_id,
  total_qty = excluded.total_qty,
  total_cost = excluded.total_cost,
  tags = array(select distinct value from unnest(coalesce(public.supplier_batches.tags, '{}'::text[]) || excluded.tags) as value),
  metadata = coalesce(public.supplier_batches.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();
