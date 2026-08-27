-- Add a permission-checked bulk product hydration path for supplier batches.
-- The private function is the only place that reads sensitive price columns;
-- callers receive only the fields required by supplier-batch list/detail views.
create or replace function private.admin_get_supplier_batch_products(
  p_sku_codes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codes text[] := coalesce(p_sku_codes, '{}'::text[]);
  v_input_count integer := coalesce(cardinality(v_codes), 0);
begin
  perform private.partspro_assert_admin_product_read();

  if v_input_count = 0 then
    return '[]'::jsonb;
  end if;

  if v_input_count > 1000 then
    raise exception 'Supplier batch product lookup accepts at most 1000 codes'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_codes) as input(code)
    where nullif(btrim(input.code), '') is null
  ) then
    raise exception 'Supplier batch product lookup codes must be non-empty'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_codes) as input(code)
    where char_length(btrim(input.code)) > 128
  ) then
    raise exception 'Supplier batch product lookup codes must be at most 128 characters'
      using errcode = '22023';
  end if;

  return (
    with requested as (
      select distinct on (upper(btrim(input.code)))
        upper(btrim(input.code)) as lookup_code
      from unnest(v_codes) with ordinality as input(code, ordinal)
      order by upper(btrim(input.code)), input.ordinal
    ),
    normalized_requested as (
      select
        requested.lookup_code,
        upper(
          coalesce(
            nullif(
              btrim(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        requested.lookup_code,
                        '\mMOBILAX\M[[:space:]_-]*',
                        '',
                        'gi'
                      ),
                      '[-_]{2,}',
                      '-',
                      'g'
                    ),
                    '[[:space:]]{2,}',
                    ' ',
                    'g'
                  ),
                  '^[[:space:]_-]+|[[:space:]_-]+$',
                  '',
                  'g'
                )
              ),
              ''
            ),
            requested.lookup_code
          )
        ) as public_sku
      from requested
    ),
    candidate_values as (
      select
        requested.lookup_code,
        candidate.value,
        candidate.priority
      from normalized_requested as requested
      cross join lateral (
        values
          (requested.lookup_code, 1),
          (requested.public_sku, 2),
          (
            case
              when requested.lookup_code !~* '^MOBILAX[-_[:space:]]'
                then 'MOBILAX-' || requested.public_sku
            end,
            3
          )
      ) as candidate(value, priority)
      where nullif(btrim(candidate.value), '') is not null
    ),
    deduped_candidates as (
      select distinct on (lookup_code, value)
        lookup_code,
        value,
        priority
      from candidate_values
      order by lookup_code, value, priority
    ),
    matched as (
      select distinct on (c.lookup_code)
        c.lookup_code,
        p.sku_code,
        p.name,
        p.brand,
        p.model,
        p.model_codes,
        p.compatibility_models,
        p.category,
        p.quality_grade,
        p.cost_price,
        p.retail_price,
        p.b2b_price,
        p.weight_gram,
        p.stock_qty,
        p.stock_status,
        p.status,
        p.image_path,
        c.priority
      from deduped_candidates as c
      join public.products as p on p.sku_code = c.value
      order by c.lookup_code, c.priority, p.sku_code
    )
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'lookup_code', lookup_code,
          'sku_code', sku_code,
          'name', name,
          'brand', brand,
          'model', model,
          'model_codes', model_codes,
          'compatibility_models', compatibility_models,
          'category', category,
          'quality_grade', quality_grade,
          'cost_price', cost_price,
          'retail_price', retail_price,
          'b2b_price', b2b_price,
          'weight_gram', weight_gram,
          'stock_qty', stock_qty,
          'stock_status', stock_status,
          'status', status,
          'image_path', image_path
        )
        order by lookup_code
      ),
      '[]'::jsonb
    )
    from matched
  );
end;
$$;

create or replace function public.admin_get_supplier_batch_products(
  p_sku_codes text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_get_supplier_batch_products(p_sku_codes)
$$;

revoke all on function private.admin_get_supplier_batch_products(text[])
  from public, anon, authenticated, service_role;
grant execute on function private.admin_get_supplier_batch_products(text[])
  to authenticated, service_role;

revoke all on function public.admin_get_supplier_batch_products(text[])
  from public, anon, authenticated, service_role;
grant execute on function public.admin_get_supplier_batch_products(text[])
  to authenticated, service_role;

comment on function public.admin_get_supplier_batch_products(text[]) is
  'Permission-checked bulk supplier-batch product hydration with a bounded lookup input and minimal sensitive fields.';

notify pgrst, 'reload schema';
