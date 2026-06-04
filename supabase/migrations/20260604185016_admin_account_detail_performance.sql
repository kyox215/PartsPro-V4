create index if not exists admin_audit_events_entity_id_created_idx
  on public.admin_audit_events (entity_id, created_at desc);

create or replace function public.admin_customer_order_ledger(
  p_customer_id uuid,
  p_order_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_order_limit, 20), 0), 50);
  v_payload jsonb;
begin
  if not (
    coalesce((select private.partspro_has_permission('customers.read')), false)
    or coalesce((select private.partspro_has_permission('orders.read')), false)
  ) then
    raise exception 'Missing permission to read customer order ledger' using errcode = '42501';
  end if;

  with recent_orders as materialized (
    select
      o.id,
      o.order_no,
      o.status,
      o.payment_status,
      coalesce(o.total_net, 0)::numeric as total_net,
      coalesce(o.vat, 0)::numeric as vat,
      coalesce(o.shipping, 0)::numeric as shipping,
      o.created_at,
      o.updated_at
    from public.orders as o
    where o.customer_id = p_customer_id
    order by o.created_at desc
    limit v_limit
  ),
  line_counts as (
    select
      ol.order_id,
      count(*)::integer as line_count
    from public.order_lines as ol
    join recent_orders as ro on ro.id = ol.order_id
    group by ol.order_id
  ),
  orders_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ro.id,
          'orderNo', ro.order_no,
          'status', ro.status,
          'paymentStatus', ro.payment_status,
          'totalNet', round(ro.total_net, 2),
          'vat', round(ro.vat, 2),
          'shipping', round(ro.shipping, 2),
          'total', round(ro.total_net + ro.vat + ro.shipping, 2),
          'lineCount', coalesce(lc.line_count, 0),
          'createdAt', ro.created_at,
          'updatedAt', ro.updated_at
        )
        order by ro.created_at desc
      ),
      '[]'::jsonb
    ) as orders
    from recent_orders as ro
    left join line_counts as lc on lc.order_id = ro.id
  ),
  spend as (
    select
      count(*)::integer as order_count,
      round(coalesce(sum(o.total_net), 0), 2) as total_net,
      round(coalesce(sum(o.vat), 0), 2) as vat,
      round(coalesce(sum(o.shipping), 0), 2) as shipping,
      round(coalesce(sum(o.total_net + o.vat + o.shipping), 0), 2) as total,
      round(coalesce(sum(o.total_net + o.vat + o.shipping) filter (where o.payment_status = 'paid'), 0), 2) as paid_amount,
      round(coalesce(sum(o.total_net + o.vat + o.shipping) filter (where o.payment_status in ('refunded', 'failed')), 0), 2) as refunded_amount,
      round(coalesce(sum(o.total_net + o.vat + o.shipping) filter (where o.status = 'cancelled'), 0), 2) as cancelled_amount,
      round(coalesce(sum(o.total_net + o.vat + o.shipping) filter (
        where o.status <> 'cancelled'
          and o.payment_status not in ('paid', 'refunded', 'failed')
      ), 0), 2) as pending_amount
    from public.orders as o
    where o.customer_id = p_customer_id
  )
  select jsonb_build_object(
    'orders', oj.orders,
    'spendSummary', jsonb_build_object(
      'cancelledAmount', spend.cancelled_amount,
      'orderCount', spend.order_count,
      'paidAmount', spend.paid_amount,
      'pendingAmount', spend.pending_amount,
      'refundedAmount', spend.refunded_amount,
      'shipping', spend.shipping,
      'total', spend.total,
      'totalNet', spend.total_net,
      'vat', spend.vat
    )
  )
  into v_payload
  from orders_json as oj
  cross join spend;

  return coalesce(
    v_payload,
    jsonb_build_object(
      'orders', '[]'::jsonb,
      'spendSummary', jsonb_build_object(
        'cancelledAmount', 0,
        'orderCount', 0,
        'paidAmount', 0,
        'pendingAmount', 0,
        'refundedAmount', 0,
        'shipping', 0,
        'total', 0,
        'totalNet', 0,
        'vat', 0
      )
    )
  );
end;
$$;

grant execute on function public.admin_customer_order_ledger(uuid, integer) to authenticated;
