-- REMAX preorder center.
--
-- The contract intentionally keeps incoming preorder capacity separate from
-- physical stock. Importing an incoming batch never increments products.stock_qty
-- or inventory_items.actual_qty. Physical stock is created only by the arrival RPC,
-- which then allocates units FIFO to waiting preorder lines in the same transaction.

alter table public.products
  add column if not exists preorder_enabled boolean not null default false,
  add column if not exists preorder_close_at timestamptz,
  add column if not exists preorder_terms text not null default
    'Preordine soggetto a conferma di arrivo. La data prevista e indicativa e puo cambiare.';

alter table public.products
  drop constraint if exists products_preorder_terms_not_blank,
  add constraint products_preorder_terms_not_blank
    check (not preorder_enabled or nullif(btrim(preorder_terms), '') is not null);

alter table public.supplier_batches
  add column if not exists preorder_status text not null default 'not_applicable',
  add column if not exists eta_start date,
  add column if not exists eta_end date,
  add column if not exists ordered_qty integer not null default 0,
  add column if not exists source_hash text,
  add column if not exists import_idempotency_key text;

alter table public.supplier_batches
  drop constraint if exists supplier_batches_preorder_status_check,
  add constraint supplier_batches_preorder_status_check
    check (preorder_status in (
      'not_applicable',
      'planned',
      'open',
      'partially_received',
      'received',
      'cancelled'
    )),
  drop constraint if exists supplier_batches_ordered_qty_nonnegative,
  add constraint supplier_batches_ordered_qty_nonnegative
    check (ordered_qty >= 0),
  drop constraint if exists supplier_batches_eta_range_check,
  add constraint supplier_batches_eta_range_check
    check (eta_start is null or eta_end is null or eta_end >= eta_start);

alter table public.supplier_batch_lines
  add column if not exists qty_ordered integer not null default 0,
  add column if not exists preorder_capacity_qty integer not null default 0;

alter table public.supplier_batch_lines
  drop constraint if exists supplier_batch_lines_qty_ordered_nonnegative,
  add constraint supplier_batch_lines_qty_ordered_nonnegative
    check (qty_ordered >= 0),
  drop constraint if exists supplier_batch_lines_preorder_capacity_nonnegative,
  add constraint supplier_batch_lines_preorder_capacity_nonnegative
    check (preorder_capacity_qty >= 0),
  drop constraint if exists supplier_batch_lines_preorder_capacity_lte_ordered,
  add constraint supplier_batch_lines_preorder_capacity_lte_ordered
    check (preorder_capacity_qty <= qty_ordered),
  drop constraint if exists supplier_batch_lines_received_lte_ordered,
  add constraint supplier_batch_lines_received_lte_ordered
    check (qty_ordered = 0 or qty_received <= qty_ordered) not valid;

alter table public.orders
  add column if not exists order_kind text not null default 'stock';

alter table public.orders
  drop constraint if exists partspro_orders_order_kind_check,
  add constraint partspro_orders_order_kind_check
    check (order_kind in ('stock', 'preorder'));

alter table public.order_lines
  add column if not exists fulfillment_type text not null default 'stock',
  add column if not exists fulfillment_status text not null default 'stock',
  add column if not exists preorder_eta_start date,
  add column if not exists preorder_eta_end date,
  add column if not exists preorder_terms_snapshot text,
  add column if not exists preorder_offer_version text;

alter table public.order_lines
  drop constraint if exists partspro_order_lines_fulfillment_type_check,
  add constraint partspro_order_lines_fulfillment_type_check
    check (fulfillment_type in ('stock', 'preorder')),
  drop constraint if exists partspro_order_lines_fulfillment_status_check,
  add constraint partspro_order_lines_fulfillment_status_check
    check (fulfillment_status in (
      'stock',
      'awaiting_stock',
      'partially_ready',
      'ready',
      'cancelled',
      'fulfilled'
    )),
  drop constraint if exists partspro_order_lines_preorder_eta_range_check,
  add constraint partspro_order_lines_preorder_eta_range_check
    check (
      preorder_eta_start is null
      or preorder_eta_end is null
      or preorder_eta_end >= preorder_eta_start
    );

create table if not exists public.order_line_preorder_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  supplier_batch_id uuid not null references public.supplier_batches(id) on delete restrict,
  supplier_batch_line_id uuid not null references public.supplier_batch_lines(id) on delete restrict,
  sku_code text not null references public.products(sku_code) on update cascade on delete restrict,
  quantity integer not null check (quantity > 0),
  received_qty integer not null default 0 check (received_qty >= 0),
  status text not null default 'awaiting_stock' check (
    status in ('awaiting_stock', 'partially_ready', 'ready', 'cancelled', 'fulfilled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_line_preorder_allocations_received_lte_quantity
    check (received_qty <= quantity),
  constraint order_line_preorder_allocations_line_batch_unique
    unique (order_line_id, supplier_batch_line_id)
);

create index if not exists products_preorder_catalog_idx
  on public.products (preorder_enabled, status, brand, updated_at desc)
  where preorder_enabled;

create index if not exists supplier_batches_preorder_eta_idx
  on public.supplier_batches (preorder_status, eta_end, created_at)
  where preorder_status in ('planned', 'open', 'partially_received');

create unique index if not exists supplier_batches_source_hash_uidx
  on public.supplier_batches (source_hash)
  where source_hash is not null;

create unique index if not exists supplier_batches_import_idempotency_uidx
  on public.supplier_batches (import_idempotency_key)
  where import_idempotency_key is not null;

create index if not exists supplier_batch_lines_preorder_sku_idx
  on public.supplier_batch_lines (sku_code, batch_id, line_no)
  where preorder_capacity_qty > 0;

create index if not exists preorder_allocations_batch_fifo_idx
  on public.order_line_preorder_allocations (
    supplier_batch_line_id,
    status,
    created_at,
    id
  );

create index if not exists preorder_allocations_order_idx
  on public.order_line_preorder_allocations (order_id, order_line_id);

drop trigger if exists order_line_preorder_allocations_set_updated_at
  on public.order_line_preorder_allocations;
create trigger order_line_preorder_allocations_set_updated_at
  before update on public.order_line_preorder_allocations
  for each row execute function public.set_updated_at();

alter table public.order_line_preorder_allocations enable row level security;

revoke all on table public.order_line_preorder_allocations from public, anon, authenticated;
grant select on table public.order_line_preorder_allocations to authenticated;
grant select, insert, update, delete on table public.order_line_preorder_allocations to service_role;

drop policy if exists "partspro_preorder_allocations_read" on public.order_line_preorder_allocations;
create policy "partspro_preorder_allocations_read"
  on public.order_line_preorder_allocations
  for select
  to authenticated
  using (
    (select private.partspro_has_permission('orders.read'))
    or exists (
      select 1
      from public.orders as o
      where o.id = order_line_preorder_allocations.order_id
        and (
          o.customer_id = (select private.current_customer_id())
          or exists (
            select 1
            from public.customer_memberships as cm
            where cm.customer_id = o.customer_id
              and cm.user_id = (select auth.uid())
              and cm.status = 'active'
          )
        )
    )
  );

comment on column public.products.preorder_enabled is
  'Allows ordering against verified incoming supplier capacity without treating it as physical stock.';
comment on column public.supplier_batch_lines.qty_ordered is
  'Supplier-confirmed incoming quantity. This is not actual or available inventory.';
comment on table public.order_line_preorder_allocations is
  'Atomic links between preorder lines and incoming supplier batch capacity.';

create or replace function public.catalog_preorder_availability(
  p_skus text[] default null
)
returns table (
  product_id uuid,
  sku_code text,
  preorder_enabled boolean,
  preorder_status text,
  capacity_qty integer,
  pending_qty integer,
  remaining_qty integer,
  eta_start date,
  eta_end date,
  preorder_close_at timestamptz,
  preorder_terms text,
  offer_version text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with eligible_lines as (
    select
      p.id as product_id,
      p.sku_code,
      p.preorder_enabled,
      p.preorder_close_at,
      p.preorder_terms,
      sb.eta_start,
      sb.eta_end,
      sbl.id as supplier_batch_line_id,
      greatest(sbl.preorder_capacity_qty - sbl.qty_received, 0) as unreceived_capacity,
      coalesce((
        select sum(greatest(a.quantity - a.received_qty, 0))
        from public.order_line_preorder_allocations as a
        join public.orders as o on o.id = a.order_id
        where a.supplier_batch_line_id = sbl.id
          and a.status in ('awaiting_stock', 'partially_ready')
          and o.status <> 'cancelled'
      ), 0)::integer as pending_unreceived
    from public.products as p
    join public.supplier_batch_lines as sbl
      on sbl.sku_code = p.sku_code
    join public.supplier_batches as sb
      on sb.id = sbl.batch_id
    where p.status = 'active'
      and p.preorder_enabled
      and (p_skus is null or p.sku_code = any(p_skus))
      and (p.preorder_close_at is null or p.preorder_close_at > now())
      and sb.preorder_status in ('planned', 'open', 'partially_received')
      and sb.eta_start is not null
      and sb.eta_end is not null
      and sbl.preorder_capacity_qty > sbl.qty_received
  ),
  availability as (
    select
      el.product_id,
      el.sku_code,
      bool_or(el.preorder_enabled) as preorder_enabled,
      sum(el.unreceived_capacity)::integer as capacity_qty,
      sum(el.pending_unreceived)::integer as pending_qty,
      sum(greatest(el.unreceived_capacity - el.pending_unreceived, 0))::integer
        as remaining_qty,
      min(el.eta_start) as eta_start,
      max(el.eta_end) as eta_end,
      max(el.preorder_close_at) as preorder_close_at,
      max(el.preorder_terms) as preorder_terms,
      max(el.supplier_batch_line_id::text) as version_seed
    from eligible_lines as el
    group by el.product_id, el.sku_code
  )
  select
    a.product_id,
    a.sku_code,
    a.preorder_enabled,
    case
      when a.remaining_qty > 0 then 'open'
      else 'sold_out'
    end as preorder_status,
    a.capacity_qty,
    a.pending_qty,
    a.remaining_qty,
    a.eta_start,
    a.eta_end,
    a.preorder_close_at,
    a.preorder_terms,
    md5(concat_ws(
      '|',
      a.sku_code,
      a.capacity_qty,
      a.pending_qty,
      a.remaining_qty,
      a.eta_start,
      a.eta_end,
      a.preorder_close_at,
      a.preorder_terms,
      a.version_seed
    )) as offer_version
  from availability as a
  order by a.sku_code;
$$;

comment on function public.catalog_preorder_availability(text[]) is
  'Safe storefront projection of verified incoming capacity. Does not expose supplier cost or customer allocations.';

revoke execute on function public.catalog_preorder_availability(text[])
  from public;
grant execute on function public.catalog_preorder_availability(text[])
  to anon, authenticated, service_role;

create or replace function private.remax_arrival_revision(p_batch_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select md5(concat_ws(
    '|',
    sb.id,
    sb.updated_at,
    sb.preorder_status,
    coalesce((
      select jsonb_agg(
        jsonb_build_array(
          sbl.id,
          sbl.qty_ordered,
          sbl.qty_received,
          sbl.updated_at
        )
        order by sbl.line_no, sbl.id
      )::text
      from public.supplier_batch_lines as sbl
      where sbl.batch_id = sb.id
    ), '[]'),
    coalesce((
      select jsonb_agg(
        jsonb_build_array(
          a.id,
          a.quantity,
          a.received_qty,
          a.status,
          a.updated_at
        )
        order by a.created_at, a.id
      )::text
      from public.order_line_preorder_allocations as a
      where a.supplier_batch_id = sb.id
    ), '[]')
  ))
  from public.supplier_batches as sb
  where sb.id = p_batch_id;
$$;

revoke execute on function private.remax_arrival_revision(uuid)
  from public, anon, authenticated;

create or replace function public.admin_remax_preorder_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_can_cost boolean := coalesce(
    (select private.partspro_has_permission('product.edit_cost')),
    false
  ) or coalesce(
    (select private.partspro_has_permission('finance.read')),
    false
  );
  v_can_orders boolean := coalesce(
    (select private.partspro_has_permission('orders.read')),
    false
  ) or coalesce(
    (select private.partspro_has_permission('orders.manage')),
    false
  );
  v_products jsonb := '[]'::jsonb;
  v_batches jsonb := '[]'::jsonb;
  v_orders jsonb := '[]'::jsonb;
begin
  perform private.partspro_assert_permission('product.read_admin');

  select coalesce(jsonb_agg(jsonb_build_object(
    'sku', p.sku_code,
    'name', p.name,
    'status', p.status,
    'preorderEnabled', p.preorder_enabled,
    'remainingQty', coalesce(a.remaining_qty, 0),
    'capacityQty', coalesce(a.capacity_qty, 0),
    'pendingQty', coalesce(a.pending_qty, 0),
    'etaStart', a.eta_start,
    'etaEnd', a.eta_end,
    'closeAt', p.preorder_close_at,
    'retailPrice', p.retail_price,
    'b2bPrice', p.b2b_price,
    'costPrice', case when v_can_cost then p.cost_price else null end,
    'imagePath', p.image_path,
    'updatedAt', p.updated_at
  ) order by p.updated_at desc, p.sku_code), '[]'::jsonb)
  into v_products
  from public.products as p
  left join lateral public.catalog_preorder_availability(array[p.sku_code]) as a
    on true
  where lower(p.brand) = 'remax'
     or p.preorder_enabled;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sb.id,
    'batchCode', sb.batch_code,
    'status', sb.preorder_status,
    'etaStart', sb.eta_start,
    'etaEnd', sb.eta_end,
    'orderedQty', sb.ordered_qty,
    'receivedQty', sb.total_qty,
    'remainingQty', greatest(sb.ordered_qty - sb.total_qty, 0),
    'totalCost', case when v_can_cost then sb.total_cost else null end,
    'currency', sb.currency,
    'sourceFileName', sb.source_file_name,
    'revision', private.remax_arrival_revision(sb.id),
    'updatedAt', sb.updated_at,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sbl.id,
        'lineNo', sbl.line_no,
        'sku', sbl.sku_code,
        'name', sbl.name,
        'qtyOrdered', sbl.qty_ordered,
        'qtyReceived', sbl.qty_received,
        'remainingQty', greatest(sbl.qty_ordered - sbl.qty_received, 0),
        'preorderCapacityQty', sbl.preorder_capacity_qty,
        'unitCost', case when v_can_cost then sbl.unit_cost else null end,
        'waitingQty', coalesce((
          select sum(greatest(a.quantity - a.received_qty, 0))
          from public.order_line_preorder_allocations as a
          join public.orders as o on o.id = a.order_id
          where a.supplier_batch_line_id = sbl.id
            and a.status in ('awaiting_stock', 'partially_ready')
            and o.status <> 'cancelled'
        ), 0)
      ) order by sbl.line_no)
      from public.supplier_batch_lines as sbl
      where sbl.batch_id = sb.id
    ), '[]'::jsonb)
  ) order by sb.created_at desc), '[]'::jsonb)
  into v_batches
  from public.supplier_batches as sb
  join public.suppliers as s on s.id = sb.supplier_id
  where upper(s.code) = 'REMAX'
     or sb.preorder_status <> 'not_applicable';

  if v_can_orders then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id,
      'orderNo', o.order_no,
      'customerName', o.customer_name,
      'status', o.status,
      'paymentStatus', o.payment_status,
      'total', o.total_net + o.vat + o.shipping,
      'createdAt', o.created_at,
      'quantity', coalesce((
        select sum(ol.quantity)
        from public.order_lines as ol
        where ol.order_id = o.id
      ), 0),
      'readyQuantity', coalesce((
        select sum(ol.reserved_qty + ol.fulfilled_qty)
        from public.order_lines as ol
        where ol.order_id = o.id
      ), 0)
    ) order by o.created_at asc, o.id), '[]'::jsonb)
    into v_orders
    from public.orders as o
    where o.order_kind = 'preorder'
      and o.status not in ('completed', 'cancelled');
  end if;

  return jsonb_build_object(
    'products', v_products,
    'batches', v_batches,
    'orders', v_orders,
    'permissions', jsonb_build_object(
      'canViewCost', v_can_cost,
      'canViewOrders', v_can_orders,
      'canImport',
        coalesce((select private.partspro_has_permission('product.create_draft')), false)
        and coalesce((select private.partspro_has_permission('product.edit_content')), false)
        and coalesce((select private.partspro_has_permission('product.edit_cost')), false)
        and coalesce((select private.partspro_has_permission('product.edit_price')), false)
        and coalesce((select private.partspro_has_permission('product.publish')), false),
      'canReceive', coalesce(
        (select private.partspro_has_permission('product.adjust_stock')),
        false
      )
    ),
    'generatedAt', now()
  );
end;
$$;

revoke execute on function public.admin_remax_preorder_dashboard()
  from public, anon;
grant execute on function public.admin_remax_preorder_dashboard()
  to authenticated, service_role;

create or replace function public.admin_import_remax_preorder_batch(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_supplier_id uuid;
  v_batch_id uuid;
  v_existing_batch public.supplier_batches%rowtype;
  v_inventory_id uuid;
  v_batch_code text := upper(btrim(coalesce(p_payload ->> 'batchCode', '')));
  v_supplier_code text := upper(btrim(coalesce(p_payload ->> 'supplierCode', 'REMAX')));
  v_supplier_name text := btrim(coalesce(p_payload ->> 'supplierName', 'REMAX'));
  v_location text := btrim(coalesce(p_payload ->> 'location', 'Milano'));
  v_source_hash text := lower(btrim(coalesce(p_payload ->> 'sourceHash', '')));
  v_idempotency_key text := btrim(coalesce(p_payload ->> 'idempotencyKey', ''));
  v_default_terms text := btrim(coalesce(
    p_payload ->> 'terms',
    'Preordine soggetto a conferma di arrivo. La data prevista e indicativa e puo cambiare.'
  ));
  v_eta_start date;
  v_eta_end date;
  v_close_at timestamptz;
  v_lines jsonb := p_payload -> 'lines';
  v_line jsonb;
  v_line_no integer;
  v_sku text;
  v_name text;
  v_model text;
  v_category text;
  v_grade text;
  v_image_path text;
  v_ean text;
  v_supplier_sku text;
  v_qty integer;
  v_buffer integer;
  v_capacity integer;
  v_moq integer;
  v_cost numeric(12, 2);
  v_retail numeric(12, 2);
  v_b2b numeric(12, 2);
  v_publish boolean;
  v_compatibility text[];
  v_model_codes text[];
  v_before public.products%rowtype;
  v_after public.products%rowtype;
  v_publish_issues text[];
  v_created_products integer := 0;
  v_updated_products integer := 0;
  v_published_products integer := 0;
  v_draft_products integer := 0;
  v_ordered_total integer := 0;
  v_capacity_total integer := 0;
  v_total_cost numeric(12, 2) := 0;
begin
  perform private.partspro_assert_permission('product.create_draft');
  perform private.partspro_assert_permission('product.edit_content');
  perform private.partspro_assert_permission('product.edit_cost');
  perform private.partspro_assert_permission('product.edit_price');

  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Import payload must be a JSON object' using errcode = '22023';
  end if;

  if v_batch_code = '' or length(v_batch_code) > 80 then
    raise exception 'A valid batch code is required' using errcode = '23514';
  end if;

  if v_supplier_code <> 'REMAX' then
    raise exception 'This importer only accepts the REMAX supplier code' using errcode = '23514';
  end if;

  if v_source_hash = '' or v_idempotency_key = '' then
    raise exception 'Source hash and idempotency key are required' using errcode = '23514';
  end if;

  if v_default_terms = '' then
    raise exception 'Preorder terms are required' using errcode = '23514';
  end if;

  begin
    v_eta_start := nullif(p_payload ->> 'etaStart', '')::date;
    v_eta_end := nullif(p_payload ->> 'etaEnd', '')::date;
    v_close_at := nullif(p_payload ->> 'closeAt', '')::timestamptz;
  exception when others then
    raise exception 'ETA or close date is invalid' using errcode = '22007';
  end;

  if v_eta_start is null or v_eta_end is null or v_eta_end < v_eta_start then
    raise exception 'A valid ETA range is required' using errcode = '23514';
  end if;

  if v_close_at is not null and v_close_at::date > v_eta_end then
    raise exception 'Preorder close date cannot be after ETA end' using errcode = '23514';
  end if;

  if jsonb_typeof(v_lines) is distinct from 'array'
    or jsonb_array_length(v_lines) < 1 then
    raise exception 'At least one import line is required' using errcode = '22023';
  end if;

  select *
  into v_existing_batch
  from public.supplier_batches
  where batch_code = v_batch_code
     or source_hash = v_source_hash
     or import_idempotency_key = v_idempotency_key
  order by case when batch_code = v_batch_code then 0 else 1 end
  limit 1
  for update;

  if v_existing_batch.id is not null then
    if v_existing_batch.batch_code = v_batch_code
      and v_existing_batch.source_hash = v_source_hash
      and v_existing_batch.import_idempotency_key = v_idempotency_key then
      return jsonb_build_object(
        'batchId', v_existing_batch.id,
        'batchCode', v_existing_batch.batch_code,
        'idempotent', true,
        'orderedQty', v_existing_batch.ordered_qty,
        'receivedQty', v_existing_batch.total_qty,
        'status', v_existing_batch.preorder_status
      );
    end if;

    raise exception 'Batch code, source file, or idempotency key was already imported'
      using errcode = '23505';
  end if;

  insert into public.suppliers (
    code,
    name,
    display_label,
    country,
    tags,
    status,
    metadata
  )
  values (
    'REMAX',
    coalesce(nullif(v_supplier_name, ''), 'REMAX'),
    coalesce(nullif(v_supplier_name, ''), 'REMAX'),
    nullif(btrim(coalesce(p_payload ->> 'supplierCountry', '')), ''),
    array['REMAX', 'preorder'],
    'active',
    jsonb_build_object('source', 'remax_preorder_center')
  )
  on conflict (code) do update
  set
    name = excluded.name,
    display_label = excluded.display_label,
    tags = array(
      select distinct tag
      from unnest(public.suppliers.tags || excluded.tags) as tag
    ),
    status = 'active',
    updated_at = now()
  returning id into v_supplier_id;

  insert into public.supplier_batches (
    batch_code,
    supplier_id,
    order_no,
    invoice_no,
    invoice_date,
    received_at,
    total_qty,
    total_cost,
    currency,
    vat_mode,
    tags,
    source_file_name,
    metadata,
    preorder_status,
    eta_start,
    eta_end,
    ordered_qty,
    source_hash,
    import_idempotency_key
  )
  values (
    v_batch_code,
    v_supplier_id,
    nullif(btrim(coalesce(p_payload ->> 'orderNo', '')), ''),
    null,
    null,
    null,
    0,
    0,
    upper(coalesce(nullif(btrim(p_payload ->> 'currency'), ''), 'EUR')),
    coalesce(nullif(btrim(p_payload ->> 'vatMode'), ''), 'IVA esclusa'),
    array['REMAX', 'preorder', 'incoming'],
    nullif(btrim(coalesce(p_payload ->> 'sourceFileName', '')), ''),
    jsonb_build_object(
      'source', 'remax_preorder_center',
      'source_hash', v_source_hash,
      'location', v_location,
      'terms', v_default_terms
    ),
    'open',
    v_eta_start,
    v_eta_end,
    0,
    v_source_hash,
    v_idempotency_key
  )
  returning id into v_batch_id;

  for v_line, v_line_no in
    select value, ordinality::integer
    from jsonb_array_elements(v_lines) with ordinality
  loop
    v_name := btrim(coalesce(v_line ->> 'name', ''));
    v_ean := nullif(btrim(coalesce(v_line ->> 'ean', '')), '');
    v_supplier_sku := nullif(upper(btrim(coalesce(v_line ->> 'supplierSku', ''))), '');
    v_sku := upper(btrim(coalesce(v_line ->> 'sku', '')));
    v_model := nullif(btrim(coalesce(v_line ->> 'model', '')), '');
    v_category := coalesce(nullif(btrim(v_line ->> 'category'), ''), 'Accessori');
    v_grade := coalesce(nullif(btrim(v_line ->> 'grade'), ''), 'A');
    v_image_path := nullif(btrim(coalesce(v_line ->> 'imageUrl', '')), '');

    if v_sku = '' then
      v_sku := 'REMAX-' || upper(regexp_replace(
        coalesce(v_ean, v_supplier_sku, substr(md5(v_name || v_line_no::text), 1, 16)),
        '[^A-Za-z0-9_-]+',
        '-',
        'g'
      ));
    end if;

    if v_name = '' then
      raise exception 'Line % requires a product name', v_line_no using errcode = '23514';
    end if;

    if v_grade not in ('A+', 'A', 'B', 'Refurbished') then
      raise exception 'Line % has an unsupported grade', v_line_no using errcode = '23514';
    end if;

    begin
      v_qty := (v_line ->> 'qtyOrdered')::integer;
      v_buffer := greatest(coalesce(nullif(v_line ->> 'bufferQty', '')::integer, 0), 0);
      v_moq := greatest(coalesce(nullif(v_line ->> 'moq', '')::integer, 1), 1);
      v_cost := round(coalesce(nullif(v_line ->> 'costPrice', '')::numeric, 0), 2);
      v_retail := round(coalesce(nullif(v_line ->> 'retailPrice', '')::numeric, 0), 2);
      v_b2b := round(coalesce(nullif(v_line ->> 'b2bPrice', '')::numeric, 0), 2);
      v_publish := coalesce((v_line ->> 'publish')::boolean, false);
    exception when others then
      raise exception 'Line % contains an invalid quantity, price, or publish value', v_line_no
        using errcode = '22023';
    end;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Line % ordered quantity must be positive', v_line_no using errcode = '23514';
    end if;

    if v_buffer >= v_qty then
      raise exception 'Line % buffer must be lower than ordered quantity', v_line_no using errcode = '23514';
    end if;

    if v_cost < 0 or v_retail < 0 or v_b2b < 0 then
      raise exception 'Line % prices cannot be negative', v_line_no using errcode = '23514';
    end if;

    if v_publish then
      perform private.partspro_assert_permission('product.publish');

      if v_retail <= 0 or v_b2b <= 0 or v_image_path is null or v_model is null then
        raise exception 'Line % needs retail/B2B prices, image, and model before publishing', v_line_no
          using errcode = '23514';
      end if;
    end if;

    v_capacity := v_qty - v_buffer;
    v_compatibility := case
      when jsonb_typeof(v_line -> 'compatibilityModels') = 'array' then
        array(
          select nullif(btrim(value), '')
          from jsonb_array_elements_text(v_line -> 'compatibilityModels')
          where nullif(btrim(value), '') is not null
        )
      when v_model is not null then array[v_model]
      else '{}'::text[]
    end;
    v_model_codes := case
      when jsonb_typeof(v_line -> 'modelCodes') = 'array' then
        array(
          select upper(btrim(value))
          from jsonb_array_elements_text(v_line -> 'modelCodes')
          where nullif(btrim(value), '') is not null
        )
      else '{}'::text[]
    end;

    v_before := null;
    select *
    into v_before
    from public.products
    where sku_code = v_sku
    for update;

    if v_before.id is not null and lower(v_before.brand) <> 'remax' then
      raise exception 'SKU % already belongs to brand %', v_sku, v_before.brand
        using errcode = '23505';
    end if;

    if v_before.id is null then
      insert into public.products (
        sku_code,
        name,
        brand,
        model,
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
        stock_qty,
        location,
        batch_code,
        supplier,
        compatibility_models,
        highlights,
        status,
        image_path,
        image_alt,
        preorder_enabled,
        preorder_close_at,
        preorder_terms
      )
      values (
        v_sku,
        v_name,
        'REMAX',
        v_model,
        v_model_codes,
        v_category,
        v_grade,
        'out_of_stock',
        v_moq,
        v_cost,
        v_retail,
        v_b2b,
        coalesce(nullif(btrim(p_payload ->> 'vatMode'), ''), 'IVA esclusa'),
        greatest(coalesce(nullif(v_line ->> 'warrantyDays', '')::integer, 180), 1),
        0,
        v_location,
        v_batch_code,
        'REMAX',
        v_compatibility,
        array['REMAX', 'Preordine'],
        case when v_publish then 'active' else 'draft' end,
        v_image_path,
        coalesce(nullif(btrim(v_line ->> 'imageAlt'), ''), v_name),
        v_publish,
        v_close_at,
        v_default_terms
      )
      returning * into v_after;

      v_created_products := v_created_products + 1;
    else
      update public.products
      set
        name = v_name,
        brand = 'REMAX',
        model = coalesce(v_model, model),
        model_codes = case when cardinality(v_model_codes) > 0 then v_model_codes else model_codes end,
        category = v_category,
        quality_grade = v_grade,
        moq = v_moq,
        cost_price = v_cost,
        retail_price = v_retail,
        b2b_price = v_b2b,
        location = coalesce(nullif(v_location, ''), location),
        batch_code = v_batch_code,
        supplier = 'REMAX',
        compatibility_models = case
          when cardinality(v_compatibility) > 0 then v_compatibility
          else compatibility_models
        end,
        image_path = coalesce(v_image_path, image_path),
        image_alt = coalesce(nullif(btrim(v_line ->> 'imageAlt'), ''), image_alt, v_name),
        status = case when v_publish then 'active' else status end,
        preorder_enabled = case when v_publish then true else preorder_enabled end,
        preorder_close_at = v_close_at,
        preorder_terms = v_default_terms,
        updated_at = now()
      where id = v_before.id
      returning * into v_after;

      v_updated_products := v_updated_products + 1;
    end if;

    if v_publish then
      v_publish_issues := private.partspro_product_publish_issues(v_after);

      if cardinality(v_publish_issues) > 0 then
        raise exception 'Line % is not publishable: %',
          v_line_no,
          array_to_string(v_publish_issues, ', ')
          using errcode = '23514';
      end if;

      v_published_products := v_published_products + 1;
    else
      v_draft_products := v_draft_products + 1;
    end if;

    insert into public.supplier_batch_lines (
      batch_id,
      line_no,
      ean,
      supplier_sku,
      sku_code,
      name,
      qty_received,
      qty_ordered,
      preorder_capacity_qty,
      unit_cost,
      line_total,
      image_status,
      product_status,
      metadata
    )
    values (
      v_batch_id,
      v_line_no,
      v_ean,
      v_supplier_sku,
      v_sku,
      v_name,
      0,
      v_qty,
      v_capacity,
      v_cost,
      round(v_cost * v_qty, 2),
      case when v_image_path is null then 'missing' else 'matched' end,
      case when v_publish then 'active' else 'draft' end,
      jsonb_build_object(
        'source', 'remax_preorder_center',
        'buffer_qty', v_buffer,
        'model', v_model,
        'category', v_category,
        'retail_price', v_retail,
        'b2b_price', v_b2b,
        'image_source_url', v_image_path
      )
    );

    select id
    into v_inventory_id
    from public.inventory_items
    where sku_code = v_sku
      and batch_code is not distinct from v_batch_code
      and location is not distinct from v_location
    order by last_movement_at desc
    limit 1
    for update;

    if v_inventory_id is null then
      insert into public.inventory_items (
        sku_code,
        product_name,
        brand,
        model,
        quality_grade,
        batch_code,
        location,
        actual_qty,
        locked_qty,
        available_qty,
        incoming_qty,
        supplier,
        last_movement_at
      )
      values (
        v_sku,
        v_name,
        'REMAX',
        v_model,
        v_grade,
        v_batch_code,
        v_location,
        0,
        0,
        0,
        v_qty,
        'REMAX',
        now()
      );
    else
      update public.inventory_items
      set
        incoming_qty = incoming_qty + v_qty,
        product_name = v_name,
        brand = 'REMAX',
        model = coalesce(v_model, model),
        quality_grade = v_grade,
        supplier = 'REMAX',
        last_movement_at = now()
      where id = v_inventory_id;
    end if;

    perform private.partspro_audit_product(
      case when v_before.id is null then 'remax.preorder_product_created' else 'remax.preorder_product_updated' end,
      v_before,
      v_after,
      'REMAX preorder batch import',
      jsonb_build_object(
        'batch_code', v_batch_code,
        'qty_ordered', v_qty,
        'preorder_capacity_qty', v_capacity,
        'published', v_publish,
        'source_hash', v_source_hash
      )
    );

    v_ordered_total := v_ordered_total + v_qty;
    v_capacity_total := v_capacity_total + v_capacity;
    v_total_cost := v_total_cost + round(v_cost * v_qty, 2);
  end loop;

  update public.supplier_batches
  set
    ordered_qty = v_ordered_total,
    total_cost = v_total_cost,
    updated_at = now()
  where id = v_batch_id;

  insert into public.admin_audit_events (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    request_metadata
  )
  values (
    (select auth.uid()),
    nullif(auth.jwt() ->> 'email', ''),
    (select private.current_profile_role()),
    'remax.preorder_batch_imported',
    'supplier_batch',
    v_batch_id::text,
    jsonb_build_object(
      'batch_code', v_batch_code,
      'ordered_qty', v_ordered_total,
      'capacity_qty', v_capacity_total,
      'line_count', jsonb_array_length(v_lines),
      'eta_start', v_eta_start,
      'eta_end', v_eta_end
    ),
    'REMAX preorder batch import',
    jsonb_build_object(
      'source_hash', v_source_hash,
      'idempotency_key', v_idempotency_key
    )
  );

  return jsonb_build_object(
    'batchId', v_batch_id,
    'batchCode', v_batch_code,
    'idempotent', false,
    'createdProducts', v_created_products,
    'updatedProducts', v_updated_products,
    'publishedProducts', v_published_products,
    'draftProducts', v_draft_products,
    'orderedQty', v_ordered_total,
    'capacityQty', v_capacity_total,
    'status', 'open'
  );
end;
$$;

revoke execute on function public.admin_import_remax_preorder_batch(jsonb)
  from public, anon;
grant execute on function public.admin_import_remax_preorder_batch(jsonb)
  to authenticated, service_role;

create or replace function public.create_preorder_transaction(
  p_lines jsonb,
  p_customer_id uuid default null,
  p_delivery_address text default '',
  p_customer_note text default '',
  p_shipping_method text default '',
  p_shipping numeric default 0,
  p_fiscal jsonb default '{}'::jsonb,
  p_terms_accepted boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := coalesce((select private.is_staff()), false);
  v_customer public.customers%rowtype;
  v_customer_effective_level text := 'bronze';
  v_order_id uuid;
  v_order_line_id uuid;
  v_order_no text;
  v_expected_count integer;
  v_distinct_count integer;
  v_line_count integer := 0;
  v_total_net numeric(12, 2) := 0;
  v_fiscal jsonb;
  v_line record;
  v_offer record;
  v_batch_line record;
  v_pending integer;
  v_available integer;
  v_take integer;
  v_remaining integer;
  v_eta_start date;
  v_eta_end date;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'Preorder terms must be accepted' using errcode = '42501';
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Order lines must be a JSON array' using errcode = '22023';
  end if;

  v_expected_count := jsonb_array_length(p_lines);

  if v_expected_count < 1 then
    raise exception 'Order must contain at least one line' using errcode = '22023';
  end if;

  if p_shipping < 0 then
    raise exception 'Shipping cannot be negative' using errcode = '22023';
  end if;

  select count(distinct upper(btrim(sku_code)))
  into v_distinct_count
  from jsonb_to_recordset(p_lines) as requested(
    sku_code text,
    quantity integer,
    unit_net numeric,
    price_version text,
    offer_version text
  );

  if v_distinct_count <> v_expected_count then
    raise exception 'Duplicate SKU in preorder payload' using errcode = '23514';
  end if;

  if v_is_staff and p_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = p_customer_id
    limit 1;
  else
    select c.*
    into v_customer
    from public.customers as c
    where c.id = coalesce(p_customer_id, (select private.current_customer_id()))
      and (
        c.user_id = v_auth_uid
        or exists (
          select 1
          from public.customer_memberships as cm
          where cm.customer_id = c.id
            and cm.user_id = v_auth_uid
            and cm.status = 'active'
        )
      )
    limit 1;
  end if;

  if v_customer.id is null then
    raise exception 'No matching customer profile was found' using errcode = '23503';
  end if;

  v_customer_effective_level := private.customer_effective_level(
    v_customer.level,
    v_customer.tier,
    v_customer.lifetime_spend_net,
    v_customer.promo_level,
    v_customer.promo_level_starts_at,
    v_customer.promo_level_expires_at,
    now()
  );

  if not v_is_staff
    and (
      v_customer.status <> 'active'
      or coalesce(v_customer.assignment_status, 'needs_review') <> 'assigned'
    ) then
    raise exception 'Customer must be active and assigned before placing orders'
      using errcode = '42501';
  end if;

  if not private.is_customer_profile_complete_for_checkout(
    v_customer.company_name,
    v_customer.email,
    v_customer.phone,
    v_customer.fiscal_code,
    v_customer.billing_address,
    v_customer.shipping_address
  ) then
    raise exception 'Customer name, tax, billing and shipping profile must be completed before checkout'
      using errcode = '42501';
  end if;

  if v_is_staff and v_customer.status = 'suspended' then
    raise exception 'Suspended customers cannot receive new orders' using errcode = '42501';
  end if;

  v_order_no := 'PP-PRE-' ||
    to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') ||
    '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  v_fiscal := jsonb_set(
    case when jsonb_typeof(p_fiscal) = 'object' then p_fiscal else '{}'::jsonb end,
    '{payment_method}',
    to_jsonb('bank_transfer'::text),
    true
  );
  v_fiscal := jsonb_set(v_fiscal, '{wallet_requested_amount}', '0'::jsonb, true);
  v_fiscal := jsonb_set(v_fiscal, '{wallet_applied_amount}', '0'::jsonb, true);
  v_fiscal := jsonb_set(v_fiscal, '{order_kind}', to_jsonb('preorder'::text), true);
  v_fiscal := jsonb_set(v_fiscal, '{preorder_terms_accepted}', 'true'::jsonb, true);

  insert into public.orders (
    order_no,
    customer_id,
    user_id,
    customer_name,
    customer_tier,
    status,
    payment_status,
    payment_method,
    stock_risk,
    total_net,
    vat,
    shipping,
    shipping_method,
    fiscal,
    delivery_address,
    customer_note,
    order_kind,
    wallet_applied_amount
  )
  values (
    v_order_no,
    v_customer.id,
    v_customer.user_id,
    v_customer.company_name,
    v_customer_effective_level,
    'submitted',
    'pending',
    'bank_transfer',
    'blocked',
    0,
    0,
    coalesce(p_shipping, 0),
    coalesce(p_shipping_method, ''),
    v_fiscal,
    coalesce(p_delivery_address, ''),
    coalesce(p_customer_note, ''),
    'preorder',
    0
  )
  returning id into v_order_id;

  for v_line in
    select
      upper(btrim(requested.sku_code)) as sku_code,
      requested.quantity,
      round(requested.unit_net, 2) as requested_unit_net,
      nullif(btrim(requested.price_version), '') as requested_price_version,
      nullif(btrim(requested.offer_version), '') as requested_offer_version,
      p.id as product_id,
      p.name as product_name,
      p.quality_grade,
      p.moq,
      p.batch_code,
      p.location,
      p.preorder_terms,
      pricing.effective_unit_price as allowed_unit_price,
      pricing.base_unit_price,
      pricing.discount_percent,
      pricing.price_source,
      pricing.customer_level,
      pricing.price_group_id,
      pricing.price_version,
      pricing.price_resolved_at
    from jsonb_to_recordset(p_lines) as requested(
      sku_code text,
      quantity integer,
      unit_net numeric,
      price_version text,
      offer_version text
    )
    join public.products as p
      on p.sku_code = upper(btrim(requested.sku_code))
    cross join lateral private.resolve_customer_product_price(
      p.id,
      v_customer.id,
      requested.quantity
    ) as pricing
    where p.status = 'active'
      and p.preorder_enabled
      and (p.preorder_close_at is null or p.preorder_close_at > now())
    order by p.sku_code
    for update of p
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Order line quantity must be positive' using errcode = '23514';
    end if;

    if v_line.quantity < v_line.moq then
      raise exception 'Order line quantity is below MOQ for SKU %', v_line.sku_code
        using errcode = '23514';
    end if;

    if v_line.allowed_unit_price is null or v_line.allowed_unit_price <= 0 then
      raise exception 'SKU % has no available price for this customer', v_line.sku_code
        using errcode = '42501';
    end if;

    if v_line.requested_price_version is not null
      and v_line.price_version is not null
      and v_line.requested_price_version <> v_line.price_version then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code
        using errcode = '40001';
    end if;

    if v_line.requested_unit_net is not null
      and abs(v_line.requested_unit_net - v_line.allowed_unit_price) > 0.01 then
      raise exception 'SKU % price changed; refresh checkout before submitting', v_line.sku_code
        using errcode = '40001';
    end if;

    select *
    into v_offer
    from public.catalog_preorder_availability(array[v_line.sku_code])
    limit 1;

    if v_offer.sku_code is null or v_offer.remaining_qty < v_line.quantity then
      raise exception 'Requested quantity exceeds preorder capacity for SKU %', v_line.sku_code
        using errcode = '23514';
    end if;

    if v_line.requested_offer_version is not null
      and v_line.requested_offer_version <> v_offer.offer_version then
      raise exception 'SKU % preorder ETA or capacity changed; refresh checkout before submitting',
        v_line.sku_code
        using errcode = '40001';
    end if;

    insert into public.order_lines (
      order_id,
      sku_code,
      product_name,
      quality_grade,
      quantity,
      unit_price,
      base_unit_price,
      discount_percent,
      price_source,
      customer_level_snapshot,
      price_group_id_snapshot,
      price_version,
      price_resolved_at,
      stock_status,
      batch_code,
      location,
      reserved_qty,
      fulfilled_qty,
      fulfillment_type,
      fulfillment_status,
      preorder_eta_start,
      preorder_eta_end,
      preorder_terms_snapshot,
      preorder_offer_version
    )
    values (
      v_order_id,
      v_line.sku_code,
      v_line.product_name,
      v_line.quality_grade,
      v_line.quantity,
      coalesce(v_line.requested_unit_net, v_line.allowed_unit_price),
      v_line.base_unit_price,
      v_line.discount_percent,
      v_line.price_source,
      v_line.customer_level,
      v_line.price_group_id,
      v_line.price_version,
      v_line.price_resolved_at,
      'preorder_waiting',
      null,
      v_line.location,
      0,
      0,
      'preorder',
      'awaiting_stock',
      v_offer.eta_start,
      v_offer.eta_end,
      v_line.preorder_terms,
      v_offer.offer_version
    )
    returning id into v_order_line_id;

    v_remaining := v_line.quantity;
    v_eta_start := null;
    v_eta_end := null;

    for v_batch_line in
      select
        sbl.id,
        sbl.batch_id,
        sbl.preorder_capacity_qty,
        sbl.qty_received,
        sb.eta_start,
        sb.eta_end
      from public.supplier_batch_lines as sbl
      join public.supplier_batches as sb on sb.id = sbl.batch_id
      where sbl.sku_code = v_line.sku_code
        and sbl.preorder_capacity_qty > sbl.qty_received
        and sb.preorder_status in ('planned', 'open', 'partially_received')
        and sb.eta_start is not null
        and sb.eta_end is not null
      order by sb.eta_end, sb.eta_start, sb.created_at, sbl.line_no, sbl.id
      for update of sb, sbl
    loop
      exit when v_remaining <= 0;

      select coalesce(sum(greatest(a.quantity - a.received_qty, 0)), 0)::integer
      into v_pending
      from public.order_line_preorder_allocations as a
      join public.orders as existing_order on existing_order.id = a.order_id
      where a.supplier_batch_line_id = v_batch_line.id
        and a.status in ('awaiting_stock', 'partially_ready')
        and existing_order.status <> 'cancelled';

      v_available := greatest(
        v_batch_line.preorder_capacity_qty - v_batch_line.qty_received - v_pending,
        0
      );

      if v_available <= 0 then
        continue;
      end if;

      v_take := least(v_remaining, v_available);

      insert into public.order_line_preorder_allocations (
        order_id,
        order_line_id,
        supplier_batch_id,
        supplier_batch_line_id,
        sku_code,
        quantity,
        received_qty,
        status
      )
      values (
        v_order_id,
        v_order_line_id,
        v_batch_line.batch_id,
        v_batch_line.id,
        v_line.sku_code,
        v_take,
        0,
        'awaiting_stock'
      );

      v_eta_start := case
        when v_eta_start is null then v_batch_line.eta_start
        else least(v_eta_start, v_batch_line.eta_start)
      end;
      v_eta_end := case
        when v_eta_end is null then v_batch_line.eta_end
        else greatest(v_eta_end, v_batch_line.eta_end)
      end;
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Preorder capacity changed for SKU %; refresh checkout', v_line.sku_code
        using errcode = '40001';
    end if;

    update public.order_lines
    set
      preorder_eta_start = v_eta_start,
      preorder_eta_end = v_eta_end
    where id = v_order_line_id;

    v_total_net := v_total_net
      + round(coalesce(v_line.requested_unit_net, v_line.allowed_unit_price) * v_line.quantity, 2);
    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count <> v_expected_count then
    raise exception 'One or more preorder lines reference inactive, closed, or unknown SKUs'
      using errcode = '23503';
  end if;

  update public.orders
  set
    total_net = v_total_net,
    vat = 0,
    shipping = coalesce(p_shipping, 0),
    fiscal = v_fiscal,
    updated_at = now()
  where id = v_order_id;

  insert into public.order_events (
    order_id,
    event_type,
    actor_id,
    note,
    metadata
  )
  values (
    v_order_id,
    'preorder_created',
    v_auth_uid,
    nullif(coalesce(p_customer_note, ''), ''),
    jsonb_build_object(
      'source', 'create_preorder_transaction',
      'order_kind', 'preorder',
      'line_count', v_line_count,
      'customer_level', v_customer_effective_level,
      'shipping_method', coalesce(p_shipping_method, ''),
      'payment_method', 'bank_transfer',
      'wallet_applied_amount', 0,
      'terms_accepted', true,
      'price_and_offer_snapshot_validated', true
    )
  );

  return v_order_id;
end;
$$;

comment on function public.create_preorder_transaction(
  jsonb, uuid, text, text, text, numeric, jsonb, boolean
) is
  'Creates a bank-transfer preorder against locked supplier capacity without touching physical stock.';

revoke execute on function public.create_preorder_transaction(
  jsonb, uuid, text, text, text, numeric, jsonb, boolean
) from public, anon;
grant execute on function public.create_preorder_transaction(
  jsonb, uuid, text, text, text, numeric, jsonb, boolean
) to authenticated, service_role;

create or replace function private.reserve_preorder_allocation_inventory(
  p_allocation_id uuid,
  p_inventory_item_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allocation public.order_line_preorder_allocations%rowtype;
  v_line public.order_lines%rowtype;
  v_product public.products%rowtype;
  v_inventory public.inventory_items%rowtype;
  v_order_status text;
  v_next_received integer;
  v_allocation_json jsonb;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Reservation quantity must be positive' using errcode = '23514';
  end if;

  select *
  into v_allocation
  from public.order_line_preorder_allocations
  where id = p_allocation_id
  for update;

  if v_allocation.id is null or v_allocation.status = 'cancelled' then
    raise exception 'Preorder allocation is unavailable' using errcode = '23503';
  end if;

  if v_allocation.received_qty + p_quantity > v_allocation.quantity then
    raise exception 'Reservation exceeds preorder allocation quantity' using errcode = '23514';
  end if;

  select status
  into v_order_status
  from public.orders
  where id = v_allocation.order_id
  for update;

  if v_order_status = 'cancelled' then
    raise exception 'Cancelled preorder cannot receive inventory' using errcode = '23514';
  end if;

  select *
  into v_line
  from public.order_lines
  where id = v_allocation.order_line_id
  for update;

  if v_line.id is null
    or v_line.fulfillment_type <> 'preorder'
    or v_line.reserved_qty + v_line.fulfilled_qty + p_quantity > v_line.quantity then
    raise exception 'Preorder line cannot accept this reservation' using errcode = '23514';
  end if;

  select *
  into v_product
  from public.products
  where sku_code = v_allocation.sku_code
  for update;

  select *
  into v_inventory
  from public.inventory_items
  where id = p_inventory_item_id
  for update;

  if v_product.id is null
    or v_inventory.id is null
    or v_inventory.sku_code <> v_allocation.sku_code then
    raise exception 'Product or inventory row does not match preorder allocation'
      using errcode = '23503';
  end if;

  if v_product.stock_qty < p_quantity or v_inventory.available_qty < p_quantity then
    raise exception 'Received inventory is insufficient for preorder allocation'
      using errcode = '23514';
  end if;

  update public.inventory_items
  set
    available_qty = available_qty - p_quantity,
    locked_qty = locked_qty + p_quantity,
    last_movement_at = now()
  where id = v_inventory.id;

  update public.products
  set
    stock_qty = stock_qty - p_quantity,
    stock_status = private.partspro_stock_status(stock_qty - p_quantity),
    updated_at = now()
  where id = v_product.id;

  v_allocation_json := jsonb_build_object(
    'inventory_item_id', v_inventory.id,
    'sku_code', v_allocation.sku_code,
    'quantity', p_quantity,
    'batch_code', v_inventory.batch_code,
    'location', v_inventory.location,
    'preorder_allocation_id', v_allocation.id,
    'supplier_batch_line_id', v_allocation.supplier_batch_line_id
  );

  update public.order_lines
  set
    reserved_qty = reserved_qty + p_quantity,
    reservation_allocations = reservation_allocations || jsonb_build_array(v_allocation_json),
    stock_status = 'reserved',
    batch_code = coalesce(batch_code, v_inventory.batch_code),
    location = coalesce(location, v_inventory.location),
    fulfillment_status = case
      when reserved_qty + fulfilled_qty + p_quantity >= quantity then 'ready'
      else 'partially_ready'
    end
  where id = v_line.id;

  v_next_received := v_allocation.received_qty + p_quantity;

  update public.order_line_preorder_allocations
  set
    received_qty = v_next_received,
    status = case
      when v_next_received >= quantity then 'ready'
      else 'partially_ready'
    end,
    updated_at = now()
  where id = v_allocation.id;

  return v_allocation_json;
end;
$$;

revoke execute on function private.reserve_preorder_allocation_inventory(uuid, uuid, integer)
  from public, anon, authenticated;

create or replace function public.admin_preview_remax_arrival(
  p_batch_code text,
  p_receipts jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.supplier_batches%rowtype;
  v_receipt record;
  v_line record;
  v_waiting integer;
  v_lines jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_count integer := 0;
  v_distinct_count integer := 0;
begin
  perform private.partspro_assert_permission('product.read_admin');

  if jsonb_typeof(p_receipts) is distinct from 'array'
    or jsonb_array_length(p_receipts) < 1 then
    raise exception 'At least one receipt line is required' using errcode = '22023';
  end if;

  select *
  into v_batch
  from public.supplier_batches
  where batch_code = upper(btrim(p_batch_code));

  if v_batch.id is null then
    raise exception 'REMAX batch was not found' using errcode = '23503';
  end if;

  if v_batch.preorder_status not in ('open', 'partially_received') then
    raise exception 'Batch is not open for receiving' using errcode = '23514';
  end if;

  select count(*), count(distinct line_id)
  into v_count, v_distinct_count
  from jsonb_to_recordset(p_receipts) as requested(line_id uuid, quantity integer);

  if v_count <> v_distinct_count then
    raise exception 'Duplicate batch line in receipt payload' using errcode = '23514';
  end if;

  for v_receipt in
    select line_id, quantity
    from jsonb_to_recordset(p_receipts) as requested(line_id uuid, quantity integer)
    order by line_id
  loop
    if v_receipt.quantity is null or v_receipt.quantity <= 0 then
      raise exception 'Receipt quantity must be positive' using errcode = '23514';
    end if;

    select
      sbl.id,
      sbl.line_no,
      sbl.sku_code,
      sbl.name,
      sbl.qty_ordered,
      sbl.qty_received
    into v_line
    from public.supplier_batch_lines as sbl
    where sbl.id = v_receipt.line_id
      and sbl.batch_id = v_batch.id;

    if v_line.id is null then
      raise exception 'Receipt line does not belong to this batch' using errcode = '23503';
    end if;

    if v_receipt.quantity > v_line.qty_ordered - v_line.qty_received then
      raise exception 'Receipt exceeds remaining ordered quantity for line %', v_line.line_no
        using errcode = '23514';
    end if;

    select coalesce(sum(greatest(a.quantity - a.received_qty, 0)), 0)::integer
    into v_waiting
    from public.order_line_preorder_allocations as a
    join public.orders as o on o.id = a.order_id
    where a.supplier_batch_line_id = v_line.id
      and a.status in ('awaiting_stock', 'partially_ready')
      and o.status <> 'cancelled';

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'lineId', v_line.id,
      'lineNo', v_line.line_no,
      'sku', v_line.sku_code,
      'name', v_line.name,
      'receiveQty', v_receipt.quantity,
      'waitingQty', v_waiting,
      'willAllocateQty', least(v_receipt.quantity, v_waiting),
      'willRemainAvailableQty', greatest(v_receipt.quantity - v_waiting, 0),
      'remainingAfterReceipt',
        v_line.qty_ordered - v_line.qty_received - v_receipt.quantity
    ));
    v_total := v_total + v_receipt.quantity;
  end loop;

  return jsonb_build_object(
    'batchId', v_batch.id,
    'batchCode', v_batch.batch_code,
    'status', v_batch.preorder_status,
    'revision', private.remax_arrival_revision(v_batch.id),
    'totalReceiveQty', v_total,
    'lines', v_lines
  );
end;
$$;

revoke execute on function public.admin_preview_remax_arrival(text, jsonb)
  from public, anon;
grant execute on function public.admin_preview_remax_arrival(text, jsonb)
  to authenticated, service_role;

create or replace function public.admin_receive_remax_preorder_batch(
  p_batch_code text,
  p_receipts jsonb,
  p_revision text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.supplier_batches%rowtype;
  v_receipt record;
  v_line public.supplier_batch_lines%rowtype;
  v_product public.products%rowtype;
  v_inventory public.inventory_items%rowtype;
  v_allocation record;
  v_current_revision text;
  v_key text := btrim(coalesce(p_idempotency_key, ''));
  v_receipt_keys jsonb;
  v_count integer;
  v_distinct_count integer;
  v_to_allocate integer;
  v_take integer;
  v_total_received integer := 0;
  v_total_allocated integer := 0;
  v_batch_ordered integer := 0;
  v_batch_received integer := 0;
  v_next_status text;
  v_result_lines jsonb := '[]'::jsonb;
begin
  perform private.partspro_assert_permission('product.adjust_stock');

  if v_key = '' then
    raise exception 'Receipt idempotency key is required' using errcode = '23514';
  end if;

  if jsonb_typeof(p_receipts) is distinct from 'array'
    or jsonb_array_length(p_receipts) < 1 then
    raise exception 'At least one receipt line is required' using errcode = '22023';
  end if;

  select *
  into v_batch
  from public.supplier_batches
  where batch_code = upper(btrim(p_batch_code))
  for update;

  if v_batch.id is null then
    raise exception 'REMAX batch was not found' using errcode = '23503';
  end if;

  v_receipt_keys := case
    when jsonb_typeof(v_batch.metadata -> 'receiptIdempotencyKeys') = 'array'
      then v_batch.metadata -> 'receiptIdempotencyKeys'
    else '[]'::jsonb
  end;

  if v_receipt_keys ? v_key then
    return jsonb_build_object(
      'batchId', v_batch.id,
      'batchCode', v_batch.batch_code,
      'status', v_batch.preorder_status,
      'idempotent', true,
      'revision', private.remax_arrival_revision(v_batch.id)
    );
  end if;

  if v_batch.preorder_status not in ('open', 'partially_received') then
    raise exception 'Batch is not open for receiving' using errcode = '23514';
  end if;

  v_current_revision := private.remax_arrival_revision(v_batch.id);

  if nullif(btrim(coalesce(p_revision, '')), '') is null
    or p_revision <> v_current_revision then
    raise exception 'Arrival preview is stale; refresh before confirming'
      using errcode = '40001';
  end if;

  select count(*), count(distinct line_id)
  into v_count, v_distinct_count
  from jsonb_to_recordset(p_receipts) as requested(line_id uuid, quantity integer);

  if v_count <> v_distinct_count then
    raise exception 'Duplicate batch line in receipt payload' using errcode = '23514';
  end if;

  for v_receipt in
    select line_id, quantity
    from jsonb_to_recordset(p_receipts) as requested(line_id uuid, quantity integer)
    order by line_id
  loop
    if v_receipt.quantity is null or v_receipt.quantity <= 0 then
      raise exception 'Receipt quantity must be positive' using errcode = '23514';
    end if;

    select *
    into v_line
    from public.supplier_batch_lines
    where id = v_receipt.line_id
      and batch_id = v_batch.id
    for update;

    if v_line.id is null then
      raise exception 'Receipt line does not belong to this batch' using errcode = '23503';
    end if;

    if v_line.sku_code is null then
      raise exception 'Receipt line has no product SKU' using errcode = '23514';
    end if;

    if v_receipt.quantity > v_line.qty_ordered - v_line.qty_received then
      raise exception 'Receipt exceeds remaining ordered quantity for line %', v_line.line_no
        using errcode = '23514';
    end if;

    select *
    into v_product
    from public.products
    where sku_code = v_line.sku_code
    for update;

    if v_product.id is null then
      raise exception 'Product for receipt line % was not found', v_line.line_no
        using errcode = '23503';
    end if;

    select *
    into v_inventory
    from public.inventory_items
    where sku_code = v_line.sku_code
      and batch_code is not distinct from v_batch.batch_code
      and location is not distinct from v_product.location
    order by last_movement_at desc
    limit 1
    for update;

    if v_inventory.id is null then
      insert into public.inventory_items (
        sku_code,
        product_name,
        brand,
        model,
        quality_grade,
        batch_code,
        location,
        actual_qty,
        locked_qty,
        available_qty,
        incoming_qty,
        supplier,
        last_movement_at
      )
      values (
        v_product.sku_code,
        v_product.name,
        v_product.brand,
        v_product.model,
        v_product.quality_grade,
        v_batch.batch_code,
        v_product.location,
        v_receipt.quantity,
        0,
        v_receipt.quantity,
        greatest(v_line.qty_ordered - v_line.qty_received - v_receipt.quantity, 0),
        v_product.supplier,
        now()
      )
      returning * into v_inventory;
    else
      update public.inventory_items
      set
        actual_qty = actual_qty + v_receipt.quantity,
        available_qty = available_qty + v_receipt.quantity,
        incoming_qty = greatest(incoming_qty - v_receipt.quantity, 0),
        product_name = v_product.name,
        brand = v_product.brand,
        model = v_product.model,
        quality_grade = v_product.quality_grade,
        supplier = coalesce(v_product.supplier, supplier),
        last_movement_at = now()
      where id = v_inventory.id
      returning * into v_inventory;
    end if;

    update public.products
    set
      stock_qty = stock_qty + v_receipt.quantity,
      stock_status = private.partspro_stock_status(stock_qty + v_receipt.quantity),
      batch_code = v_batch.batch_code,
      updated_at = now()
    where id = v_product.id;

    update public.supplier_batch_lines
    set
      qty_received = qty_received + v_receipt.quantity,
      updated_at = now()
    where id = v_line.id
    returning * into v_line;

    insert into public.finance_cost_layers (
      supplier_batch_line_id,
      supplier_batch_id,
      supplier_id,
      sku_code,
      batch_code,
      received_qty,
      unit_cost_net,
      total_cost_net,
      currency,
      vat_mode,
      vat_treatment,
      confidence,
      metadata
    )
    values (
      v_line.id,
      v_batch.id,
      v_batch.supplier_id,
      v_line.sku_code,
      v_batch.batch_code,
      v_line.qty_received,
      round(v_line.unit_cost, 4),
      round(v_line.unit_cost * v_line.qty_received, 2),
      v_batch.currency,
      v_batch.vat_mode,
      case
        when lower(coalesce(v_batch.vat_mode, '')) like '%esclus%'
          or lower(coalesce(v_batch.vat_mode, '')) like '%excluded%' then 'excluded'
        when lower(coalesce(v_batch.vat_mode, '')) like '%inclus%'
          or lower(coalesce(v_batch.vat_mode, '')) like '%included%' then 'included'
        else 'unknown'
      end,
      case
        when v_line.unit_cost > 0 then 'exact'
        else 'unmatched'
      end,
      jsonb_build_object(
        'source', 'remax_preorder_receipt',
        'receipt_idempotency_key', v_key,
        'supplier_batch_code', v_batch.batch_code
      )
    )
    on conflict (supplier_batch_line_id) where supplier_batch_line_id is not null
    do update set
      received_qty = excluded.received_qty,
      unit_cost_net = excluded.unit_cost_net,
      total_cost_net = excluded.total_cost_net,
      currency = excluded.currency,
      vat_mode = excluded.vat_mode,
      vat_treatment = excluded.vat_treatment,
      confidence = excluded.confidence,
      metadata = public.finance_cost_layers.metadata || excluded.metadata,
      updated_at = now();

    v_to_allocate := v_receipt.quantity;

    for v_allocation in
      select
        a.id,
        a.order_id,
        a.order_line_id,
        a.quantity,
        a.received_qty
      from public.order_line_preorder_allocations as a
      join public.orders as o on o.id = a.order_id
      where a.supplier_batch_line_id = v_line.id
        and a.status in ('awaiting_stock', 'partially_ready')
        and o.status <> 'cancelled'
        and a.received_qty < a.quantity
      order by o.created_at, o.id, a.created_at, a.id
      for update of a
    loop
      exit when v_to_allocate <= 0;

      v_take := least(v_to_allocate, v_allocation.quantity - v_allocation.received_qty);

      perform private.reserve_preorder_allocation_inventory(
        v_allocation.id,
        v_inventory.id,
        v_take
      );

      insert into public.order_events (
        order_id,
        event_type,
        actor_id,
        note,
        metadata
      )
      values (
        v_allocation.order_id,
        'preorder_stock_allocated',
        (select auth.uid()),
        'REMAX arrival allocated FIFO',
        jsonb_build_object(
          'supplier_batch_id', v_batch.id,
          'supplier_batch_line_id', v_line.id,
          'order_line_id', v_allocation.order_line_id,
          'quantity', v_take,
          'inventory_item_id', v_inventory.id,
          'receipt_idempotency_key', v_key
        )
      );

      v_to_allocate := v_to_allocate - v_take;
      v_total_allocated := v_total_allocated + v_take;
    end loop;

    v_result_lines := v_result_lines || jsonb_build_array(jsonb_build_object(
      'lineId', v_line.id,
      'lineNo', v_line.line_no,
      'sku', v_line.sku_code,
      'receivedQty', v_receipt.quantity,
      'allocatedQty', v_receipt.quantity - v_to_allocate,
      'availableQty', v_to_allocate,
      'cumulativeReceivedQty', v_line.qty_received,
      'remainingIncomingQty', greatest(v_line.qty_ordered - v_line.qty_received, 0)
    ));
    v_total_received := v_total_received + v_receipt.quantity;
  end loop;

  select
    coalesce(sum(qty_ordered), 0)::integer,
    coalesce(sum(qty_received), 0)::integer
  into v_batch_ordered, v_batch_received
  from public.supplier_batch_lines
  where batch_id = v_batch.id;

  v_next_status := case
    when v_batch_received >= v_batch_ordered and v_batch_ordered > 0 then 'received'
    else 'partially_received'
  end;

  update public.supplier_batches
  set
    ordered_qty = v_batch_ordered,
    total_qty = v_batch_received,
    preorder_status = v_next_status,
    received_at = coalesce(received_at, now()),
    metadata = jsonb_set(
      metadata,
      '{receiptIdempotencyKeys}',
      v_receipt_keys || to_jsonb(v_key),
      true
    ),
    updated_at = now()
  where id = v_batch.id;

  insert into public.admin_audit_events (
    actor_id,
    actor_email,
    actor_role,
    action,
    entity_type,
    entity_id,
    after_data,
    reason,
    request_metadata
  )
  values (
    (select auth.uid()),
    nullif(auth.jwt() ->> 'email', ''),
    (select private.current_profile_role()),
    'remax.preorder_batch_received',
    'supplier_batch',
    v_batch.id::text,
    jsonb_build_object(
      'batch_code', v_batch.batch_code,
      'received_qty', v_total_received,
      'allocated_qty', v_total_allocated,
      'status', v_next_status,
      'lines', v_result_lines
    ),
    'REMAX preorder arrival confirmation',
    jsonb_build_object('receipt_idempotency_key', v_key)
  );

  return jsonb_build_object(
    'batchId', v_batch.id,
    'batchCode', v_batch.batch_code,
    'status', v_next_status,
    'idempotent', false,
    'receivedQty', v_total_received,
    'allocatedQty', v_total_allocated,
    'availableQty', v_total_received - v_total_allocated,
    'lines', v_result_lines,
    'revision', private.remax_arrival_revision(v_batch.id)
  );
end;
$$;

revoke execute on function public.admin_receive_remax_preorder_batch(text, jsonb, text, text)
  from public, anon;
grant execute on function public.admin_receive_remax_preorder_batch(text, jsonb, text, text)
  to authenticated, service_role;

create or replace function private.sync_preorder_allocations_from_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.order_kind <> 'preorder' or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'cancelled' then
    update public.order_line_preorder_allocations
    set status = 'cancelled', updated_at = now()
    where order_id = new.id
      and status <> 'fulfilled';

    update public.order_lines
    set fulfillment_status = 'cancelled'
    where order_id = new.id
      and fulfillment_type = 'preorder';
  elsif new.status = 'completed' then
    update public.order_line_preorder_allocations
    set status = 'fulfilled', updated_at = now()
    where order_id = new.id
      and status <> 'cancelled';

    update public.order_lines
    set fulfillment_status = 'fulfilled'
    where order_id = new.id
      and fulfillment_type = 'preorder';
  end if;

  return new;
end;
$$;

drop trigger if exists partspro_sync_preorder_allocations_from_order_status
  on public.orders;
create trigger partspro_sync_preorder_allocations_from_order_status
  after update of status on public.orders
  for each row execute function private.sync_preorder_allocations_from_order_status();

revoke execute on function private.sync_preorder_allocations_from_order_status()
  from public, anon, authenticated;

create or replace function private.admin_transition_order_status(
  p_order_id uuid,
  p_status text,
  p_note text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_allowed boolean := false;
  v_reserved integer := 0;
  v_released integer := 0;
  v_consumed integer := 0;
  v_reservation_issues jsonb := '[]'::jsonb;
  v_inventory_lifecycle text;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not coalesce((select private.partspro_has_permission('orders.manage')), false) then
    raise exception 'orders.manage permission required' using errcode = '42501';
  end if;

  if p_status not in ('submitted', 'accepted', 'picking', 'packed', 'shipped', 'completed', 'cancelled') then
    raise exception 'Unsupported order status %', p_status using errcode = '22023';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if v_order.id is null then
    raise exception 'Order does not exist' using errcode = '23503';
  end if;

  if v_order.status = p_status then
    return jsonb_build_object(
      'order_id', p_order_id,
      'from_status', v_order.status,
      'to_status', p_status,
      'order_kind', v_order.order_kind,
      'noop', true,
      'inventory_lifecycle', 'unchanged'
    );
  end if;

  if v_order.status in ('completed', 'cancelled') then
    raise exception 'Completed or cancelled orders cannot be reopened' using errcode = '42501';
  end if;

  v_allowed := case v_order.status
    when 'submitted' then p_status in ('accepted', 'cancelled')
    when 'accepted' then p_status in ('picking', 'cancelled')
    when 'picking' then p_status in ('packed', 'cancelled')
    when 'packed' then p_status in ('shipped', 'cancelled')
    when 'shipped' then p_status = 'completed'
    else false
  end;

  if not v_allowed then
    raise exception 'Invalid order status transition from % to %', v_order.status, p_status
      using errcode = '42501';
  end if;

  if p_status in ('accepted', 'picking', 'packed', 'shipped', 'completed')
    and not (v_order.order_kind = 'preorder' and p_status = 'accepted') then
    v_reservation_issues := private.order_reservation_issues(p_order_id);

    if jsonb_array_length(v_reservation_issues) > 0 then
      raise exception 'Order inventory cannot be reserved'
        using errcode = '23514',
          detail = v_reservation_issues::text,
          hint = case
            when v_order.order_kind = 'preorder' then 'preorder_waiting_for_arrival'
            else 'reservation_issues'
          end;
    end if;

    v_reserved := private.ensure_order_inventory_reserved(p_order_id);
  end if;

  if p_status = 'completed' then
    v_consumed := private.consume_order_inventory(p_order_id);
  elsif p_status = 'cancelled' then
    v_released := private.release_order_inventory(p_order_id);
  end if;

  update public.orders
  set status = p_status, updated_at = now()
  where id = p_order_id;

  v_inventory_lifecycle := case
    when v_order.order_kind = 'preorder' then
      'supplier_capacity_until_arrival_then_physical_reservation'
    else
      'reserved_on_order_create_released_on_pre_ship_cancel_consumed_on_completed'
  end;

  insert into public.order_events (
    order_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    note,
    metadata
  )
  values (
    p_order_id,
    'status_changed',
    v_order.status,
    p_status,
    v_auth_uid,
    nullif(coalesce(p_note, ''), ''),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'order_kind', v_order.order_kind,
      'inventory_lifecycle', v_inventory_lifecycle,
      'payment_lifecycle', 'payment_status_is_explicit_only',
      'reserved_qty', v_reserved,
      'released_qty', v_released,
      'consumed_qty', v_consumed
    )
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'from_status', v_order.status,
    'to_status', p_status,
    'order_kind', v_order.order_kind,
    'inventory_lifecycle', v_inventory_lifecycle,
    'payment_lifecycle', 'payment_status_is_explicit_only',
    'reserved_qty', v_reserved,
    'released_qty', v_released,
    'consumed_qty', v_consumed
  );
end;
$$;

revoke execute on function private.admin_transition_order_status(uuid, text, text, jsonb)
  from public, anon;
grant execute on function private.admin_transition_order_status(uuid, text, text, jsonb)
  to authenticated, service_role;
