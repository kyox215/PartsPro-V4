alter table public.orders
  add column if not exists admin_queue_bucket integer
    generated always as (
      case
        when status in ('completed', 'cancelled', 'delivered') then 1
        else 0
      end
    ) stored,
  add column if not exists admin_status_rank integer
    generated always as (
      case status
        when 'submitted' then 10
        when 'accepted' then 20
        when 'picking' then 30
        when 'packed' then 40
        when 'shipped' then 50
        when 'completed' then 60
        when 'delivered' then 60
        when 'cancelled' then 70
        else 50
      end
    ) stored;

create index if not exists orders_admin_operations_queue_sort_idx
  on public.orders (
    admin_queue_bucket asc,
    created_at desc,
    admin_status_rank asc,
    order_no desc
  );

comment on column public.orders.admin_queue_bucket is
  'Admin order queue sort bucket: active orders first, completed/cancelled/delivered terminal orders last.';

comment on column public.orders.admin_status_rank is
  'Admin order queue status rank used after created_at to keep lifecycle sorting stable.';
