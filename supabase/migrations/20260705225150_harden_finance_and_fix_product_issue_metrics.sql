-- Follow-up hardening for the already-applied admin finance ledger objects.
-- This migration is intentionally additive: it tightens privileges and replaces
-- the product-list RPC with corrected summary and SKU matching logic.

revoke all on table public.finance_cost_layers from anon;
revoke all on table public.finance_cost_layers from public;
revoke all on table public.finance_order_line_cost_allocations from anon;
revoke all on table public.finance_order_line_cost_allocations from public;
revoke all on table public.finance_expense_entries from anon;
revoke all on table public.finance_expense_entries from public;
revoke all on table public.supplier_batch_payments from anon;
revoke all on table public.supplier_batch_payments from public;

revoke delete on public.finance_cost_layers from authenticated;
revoke delete on public.finance_order_line_cost_allocations from authenticated;
revoke delete on public.finance_expense_entries from authenticated;
revoke delete on public.supplier_batch_payments from authenticated;

drop policy if exists "partspro_finance_cost_layers_reconcile_delete"
  on public.finance_cost_layers;
drop policy if exists "partspro_finance_allocations_reconcile_delete"
  on public.finance_order_line_cost_allocations;
drop policy if exists "partspro_finance_expenses_manage_delete"
  on public.finance_expense_entries;
drop policy if exists "partspro_supplier_batch_payments_manage_delete"
  on public.supplier_batch_payments;

revoke all on function private.finance_insert_order_line_cost_allocation(
  uuid,
  uuid,
  text,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;
revoke all on function private.finance_refresh_cost_layer_usage(uuid)
  from public, anon, authenticated;
revoke all on function private.finance_cost_allocation_usage_trigger()
  from public, anon, authenticated;
revoke all on function private.finance_order_line_cost_snapshot()
  from public, anon, authenticated;
revoke all on function private.finance_audit_expense_entry()
  from public, anon, authenticated;
revoke all on function private.finance_audit_supplier_batch_payment()
  from public, anon, authenticated;

create or replace function private.partspro_admin_public_sku(p_value text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select upper(
    coalesce(
      nullif(
        btrim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                coalesce(p_value, ''),
                '(^|[[:space:]_-]+)MOBILAX([[:space:]_-]+|$)',
                '\1',
                'gi'
              ),
              '[-_]{2,}',
              '-',
              'g'
            ),
            '^[[:space:]_-]+|[[:space:]_-]+$',
            '',
            'g'
          )
        ),
        ''
      ),
      btrim(coalesce(p_value, ''))
    )
  );
$$;

revoke all on function private.partspro_admin_public_sku(text)
  from public, anon, authenticated;

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
  p_batch_code text default null,
  p_active_restock_only boolean default false,
  p_issue_filter text default null
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
  v_issue_filter text := nullif(btrim(coalesce(p_issue_filter, '')), '');
  v_products jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  perform private.partspro_assert_admin_product_read();

  with inventory_summary as (
    select
      private.partspro_admin_public_sku(i.sku_code) as sku_code,
      coalesce(sum(i.actual_qty), 0) as actual_qty,
      coalesce(sum(i.available_qty), 0) as available_qty,
      coalesce(sum(i.locked_qty), 0) as locked_qty
    from public.inventory_items as i
    group by private.partspro_admin_public_sku(i.sku_code)
  ),
  restock_summary as (
    select
      private.partspro_admin_public_sku(r.sku_code) as sku_code,
      count(*)::bigint as active_restock_request_count
    from public.product_restock_requests as r
    where r.status = 'active'
    group by private.partspro_admin_public_sku(r.sku_code)
  ),
  sold_summary as (
    select
      private.partspro_admin_public_sku(ol.sku_code) as sku_code,
      sum(greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0))::bigint as sold_qty
    from public.order_lines as ol
    join public.orders as o on o.id = ol.order_id
    where v_issue_filter in ('zero_stock_unsold', 'zero_stock_sold')
      and nullif(btrim(coalesce(ol.sku_code, '')), '') is not null
      and coalesce(o.soft_deleted_at, null) is null
      and o.status in ('shipped', 'completed')
      and greatest(coalesce(ol.quantity, 0) - coalesce(ol.cancelled_qty, 0), 0) > 0
    group by private.partspro_admin_public_sku(ol.sku_code)
  ),
  filtered_products as (
    select
      p.id,
      p.sku_code,
      p.name,
      p.brand,
      p.model,
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
      coalesce(inv.locked_qty, 0) as locked_qty,
      coalesce(restock.active_restock_request_count, 0) as active_restock_request_count,
      coalesce(sold.sold_qty, 0) as sold_qty
    from public.products as p
    left join inventory_summary as inv
      on inv.sku_code = private.partspro_admin_public_sku(p.sku_code)
    left join restock_summary as restock
      on restock.sku_code = private.partspro_admin_public_sku(p.sku_code)
    left join sold_summary as sold
      on sold.sku_code = private.partspro_admin_public_sku(p.sku_code)
    where (nullif(btrim(coalesce(p_q, '')), '') is null
        or p.name ilike '%' || btrim(p_q) || '%'
        or p.sku_code ilike '%' || btrim(p_q) || '%'
        or p.brand ilike '%' || btrim(p_q) || '%'
        or p.category ilike '%' || btrim(p_q) || '%'
        or p.model ilike '%' || btrim(p_q) || '%'
        or p.model_code ilike '%' || btrim(p_q) || '%'
        or p.model_series ilike '%' || btrim(p_q) || '%'
        or p.batch_code ilike '%' || btrim(p_q) || '%'
        or p.supplier ilike '%' || btrim(p_q) || '%'
        or exists (
          select 1
          from unnest(coalesce(p.alternative_skus, '{}'::text[])) as alternative_sku(value)
          where alternative_sku.value ilike '%' || btrim(p_q) || '%'
        ))
      and (nullif(btrim(coalesce(p_brand, '')), '') is null or p.brand = p_brand)
      and (nullif(btrim(coalesce(p_category, '')), '') is null or p.category = p_category)
      and (nullif(btrim(coalesce(p_catalog_status, '')), '') is null or p.status = p_catalog_status)
      and (nullif(btrim(coalesce(p_stock_status, '')), '') is null or p.stock_status = p_stock_status)
      and (nullif(btrim(coalesce(p_warehouse, '')), '') is null or p.location = p_warehouse)
      and (nullif(btrim(coalesce(p_grade, '')), '') is null or p.quality_grade = p_grade)
      and (nullif(btrim(coalesce(p_batch_code, '')), '') is null or p.batch_code ilike '%' || btrim(p_batch_code) || '%')
      and (nullif(btrim(coalesce(p_supplier, '')), '') is null or p.supplier ilike '%' || btrim(p_supplier) || '%')
      and (not coalesce(p_active_restock_only, false) or coalesce(restock.active_restock_request_count, 0) > 0)
      and (
        v_issue_filter is null
        or (
          v_issue_filter = 'missing_price'
          and coalesce(p.b2b_price, 0) <= 0
        )
        or (
          v_issue_filter = 'missing_image'
          and nullif(btrim(coalesce(p.image_path, '')), '') is null
        )
        or (
          v_issue_filter = 'zero_stock_unsold'
          and coalesce(inv.available_qty, p.stock_qty::bigint, 0) <= 0
          and coalesce(sold.sold_qty, 0) = 0
        )
        or (
          v_issue_filter = 'zero_stock_sold'
          and coalesce(inv.available_qty, p.stock_qty::bigint, 0) <= 0
          and coalesce(sold.sold_qty, 0) > 0
        )
      )
      and (nullif(btrim(coalesce(p_model_series, '')), '') is null
        or p.model_series = p_model_series
        or exists (
          select 1
          from unnest(coalesce(p.model_codes, '{}'::text[]) || coalesce(p.compatibility_models, '{}'::text[])) as model_option(model)
          where private.partspro_model_series(p.brand, model_option.model) = p_model_series
        ))
      and (
        nullif(btrim(coalesce(p_model, '')), '') is null
        or p.model = p_model
        or p_model = any(p.model_codes)
        or p.compatibility_models @> array[p_model]::text[]
      )
  ),
  summary as (
    select
      count(*)::bigint as total,
      count(*) filter (where status = 'active') as active,
      count(*) filter (where status = 'draft') as draft,
      count(*) filter (where status = 'hidden') as hidden,
      count(*) filter (where status = 'blocked') as blocked,
      count(*) filter (where status = 'active' and stock_status in ('low_stock', 'Low Stock')) as active_low_stock,
      count(*) filter (where status = 'active' and stock_status in ('out_of_stock', 'Out of Stock')) as active_out_of_stock,
      count(*) filter (where coalesce(available_qty, stock_qty::bigint, 0) > 0 and coalesce(available_qty, stock_qty::bigint, 0) < 10) as low_stock,
      count(*) filter (where nullif(btrim(coalesce(image_path, '')), '') is null) as missing_image,
      count(*) filter (where coalesce(b2b_price, 0) <= 0) as missing_price,
      coalesce(sum(active_restock_request_count), 0)::bigint as restock_requests
    from filtered_products
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
  ),
  page_json as (
    select coalesce(jsonb_agg(to_jsonb(page_products)), '[]'::jsonb) as products
    from page_products
  )
  select
    page_json.products,
    jsonb_build_object(
      'total', coalesce(summary.total, 0),
      'active', coalesce(summary.active, 0),
      'draft', coalesce(summary.draft, 0),
      'hidden', coalesce(summary.hidden, 0),
      'blocked', coalesce(summary.blocked, 0),
      'lowStock', coalesce(summary.low_stock, 0),
      'activeLowStock', coalesce(summary.active_low_stock, 0),
      'activeOutOfStock', coalesce(summary.active_out_of_stock, 0),
      'restockRequests', coalesce(summary.restock_requests, 0),
      'missingImage', coalesce(summary.missing_image, 0),
      'missingPrice', coalesce(summary.missing_price, 0)
    )
  into v_products, v_summary
  from page_json
  cross join summary;

  return jsonb_build_object(
    'products', coalesce(v_products, '[]'::jsonb),
    'total', coalesce((v_summary->>'total')::bigint, 0),
    'summary', coalesce(v_summary, '{}'::jsonb)
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
  p_batch_code text default null,
  p_active_restock_only boolean default false,
  p_issue_filter text default null
)
returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.admin_list_products(
    p_limit => p_limit,
    p_offset => p_offset,
    p_q => p_q,
    p_brand => p_brand,
    p_model => p_model,
    p_category => p_category,
    p_catalog_status => p_catalog_status,
    p_stock_status => p_stock_status,
    p_warehouse => p_warehouse,
    p_grade => p_grade,
    p_sort => p_sort,
    p_model_series => p_model_series,
    p_supplier => p_supplier,
    p_batch_code => p_batch_code,
    p_active_restock_only => p_active_restock_only,
    p_issue_filter => p_issue_filter
  );
$$;

revoke execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text) from public;
revoke execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text) from anon;
grant execute on function private.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text) to authenticated;

revoke execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text) from public;
revoke execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text) from anon;
grant execute on function public.admin_list_products(integer, integer, text, text, text, text, text, text, text, text, text, text, text, text, boolean, text) to authenticated;
