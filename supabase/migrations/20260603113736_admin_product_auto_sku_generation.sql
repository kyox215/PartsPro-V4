create or replace function private.partspro_admin_clean_sku(p_value text)
returns text
language sql
immutable
as $$
  select left(
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              upper(
                regexp_replace(coalesce(p_value, ''), 'MOBILAX[-_[:space:]]*', '', 'gi')
              ),
              '[[:space:]]+',
              '-',
              'g'
            ),
            '[^A-Z0-9_+.-]+',
            '-',
            'g'
          ),
          '[-_]{2,}',
          '-',
          'g'
        ),
        '._+-'
      ),
      ''
    ),
    64
  )
$$;

create or replace function private.partspro_admin_sku_is_valid(p_value text)
returns boolean
language sql
immutable
as $$
  select coalesce(private.partspro_admin_clean_sku(p_value), '') ~ '^[A-Z0-9_+.-]{2,64}$'
$$;

create or replace function private.partspro_admin_sku_segment(p_value text)
returns text
language sql
immutable
as $$
  select left(
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(private.partspro_admin_clean_sku(p_value), '[_.+]+', '-', 'g'),
          '-+',
          '-',
          'g'
        ),
        '-'
      ),
      ''
    ),
    18
  )
$$;

create or replace function private.partspro_admin_product_sku_candidate(p_product jsonb)
returns table(sku text, source text)
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_external text := private.partspro_admin_clean_sku(p_product ->> 'model_code');
  v_brand text := coalesce(private.partspro_admin_sku_segment(p_product ->> 'brand'), 'PRODUCT');
  v_subject text := coalesce(
    private.partspro_admin_sku_segment(p_product ->> 'model'),
    private.partspro_admin_sku_segment(p_product ->> 'name'),
    'ITEM'
  );
  v_category text := coalesce(private.partspro_admin_sku_segment(p_product ->> 'category'), 'PART');
  v_grade text := coalesce(private.partspro_admin_sku_segment(p_product ->> 'quality_grade'), 'A');
  v_internal text;
begin
  if private.partspro_admin_sku_is_valid(v_external) then
    return query select v_external, 'external';
    return;
  end if;

  v_internal := private.partspro_admin_clean_sku(
    concat_ws('-', 'PP', v_brand, v_subject, v_category, v_grade)
  );

  if not private.partspro_admin_sku_is_valid(v_internal) then
    v_internal := 'PP-PRODUCT-ITEM';
  end if;

  return query select v_internal, 'internal';
end;
$$;

create or replace function private.partspro_admin_unique_product_sku(p_base text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_base text := coalesce(private.partspro_admin_clean_sku(p_base), 'PP-PRODUCT-ITEM');
  v_candidate text := v_base;
  v_suffix integer := 2;
  v_suffix_text text;
begin
  if not private.partspro_admin_sku_is_valid(v_base) then
    v_base := 'PP-PRODUCT-ITEM';
    v_candidate := v_base;
  end if;

  while exists (
    select 1
    from public.products as product
    where product.sku_code = v_candidate
  ) loop
    v_suffix_text := '-' || v_suffix::text;
    v_candidate := left(v_base, greatest(1, 64 - length(v_suffix_text))) || v_suffix_text;
    v_suffix := v_suffix + 1;
  end loop;

  return v_candidate;
end;
$$;

create or replace function private.admin_create_product_draft(
  p_product jsonb,
  p_reason text default ''
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.products%rowtype;
  v_sku text := private.partspro_admin_clean_sku(p_product ->> 'sku_code');
  v_sku_source text := 'explicit';
  v_stock_qty integer := greatest(coalesce((p_product ->> 'stock_qty')::integer, 0), 0);
begin
  perform private.partspro_assert_permission('product.create_draft');

  if not private.partspro_admin_sku_is_valid(v_sku) then
    select candidate.sku, candidate.source
    into v_sku, v_sku_source
    from private.partspro_admin_product_sku_candidate(p_product) as candidate;
  end if;

  if not private.partspro_admin_sku_is_valid(v_sku) then
    raise exception 'sku_code could not be generated' using errcode = '23514';
  end if;

  if v_sku_source = 'internal' then
    v_sku := private.partspro_admin_unique_product_sku(v_sku);
  elsif exists (
    select 1
    from public.products as product
    where product.sku_code = v_sku
  ) then
    raise exception 'SKU % already exists', v_sku using errcode = '23505';
  end if;

  insert into public.products (
    sku_code,
    name,
    brand,
    model,
    model_code,
    model_codes,
    category,
    quality_grade,
    stock_status,
    moq,
    cost_price,
    retail_price,
    b2b_price,
    vat_mode,
    warranty_days,
    weight_gram,
    stock_qty,
    location,
    batch_code,
    supplier,
    compatibility_models,
    highlights,
    status,
    image_path,
    image_alt,
    gallery_image_paths
  )
  values (
    v_sku,
    nullif(btrim(coalesce(p_product ->> 'name', '')), ''),
    coalesce(nullif(btrim(p_product ->> 'brand'), ''), 'PartsPro'),
    nullif(btrim(p_product ->> 'model'), ''),
    nullif(btrim(p_product ->> 'model_code'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product -> 'model_codes', '[]'::jsonb))), '{}'::text[]),
    nullif(btrim(coalesce(p_product ->> 'category', '')), ''),
    coalesce(nullif(btrim(p_product ->> 'quality_grade'), ''), 'A'),
    private.partspro_stock_status(v_stock_qty),
    greatest(coalesce((p_product ->> 'moq')::integer, 1), 1),
    greatest(coalesce((p_product ->> 'cost_price')::numeric, 0), 0),
    greatest(coalesce((p_product ->> 'retail_price')::numeric, 0), 0),
    greatest(coalesce((p_product ->> 'b2b_price')::numeric, 0), 0),
    coalesce(nullif(btrim(p_product ->> 'vat_mode'), ''), 'IVA esclusa'),
    greatest(coalesce((p_product ->> 'warranty_days')::integer, 180), 0),
    greatest(coalesce((p_product ->> 'weight_gram')::integer, 0), 0),
    v_stock_qty,
    nullif(btrim(p_product ->> 'location'), ''),
    nullif(btrim(p_product ->> 'batch_code'), ''),
    nullif(btrim(p_product ->> 'supplier'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product -> 'compatibility_models', '[]'::jsonb))), '{}'::text[]),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product -> 'highlights', '[]'::jsonb))), '{}'::text[]),
    'draft',
    nullif(btrim(p_product ->> 'image_path'), ''),
    nullif(btrim(p_product ->> 'image_alt'), ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_product -> 'gallery_image_paths', '[]'::jsonb))), '{}'::text[])
  )
  returning * into v_row;

  insert into public.inventory_items (
    sku_code,
    product_name,
    brand,
    model,
    quality_grade,
    batch_code,
    location,
    actual_qty,
    available_qty,
    locked_qty,
    supplier,
    last_movement_at
  )
  values (
    v_row.sku_code,
    v_row.name,
    v_row.brand,
    v_row.model,
    v_row.quality_grade,
    v_row.batch_code,
    v_row.location,
    v_row.stock_qty,
    v_row.stock_qty,
    0,
    v_row.supplier,
    now()
  );

  perform private.partspro_audit_product(
    'product.create_draft',
    null,
    v_row,
    p_reason,
    jsonb_build_object(
      'inventory_action', 'initial_stock',
      'sku_source', v_sku_source
    )
  );

  return v_row;
end;
$$;
