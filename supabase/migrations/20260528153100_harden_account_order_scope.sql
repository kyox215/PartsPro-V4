-- Keep customer-facing order history bound to the current customer account.
-- Staff/admin order access still goes through the explicit orders.read permission.

do $$
begin
  drop policy if exists "partspro_orders_self_or_staff_read" on public.orders;
  create policy "partspro_orders_self_or_staff_read"
    on public.orders
    for select
    to authenticated
    using (
      (select private.partspro_has_permission('orders.read'))
      or (
        not exists (
          select 1
          from public.profiles as p
          where p.id = (select auth.uid())
            and p.account_type = 'employee'
        )
        and (
          customer_id = (select private.current_customer_id())
          or exists (
            select 1
            from public.customer_memberships as cm
            where cm.customer_id = public.orders.customer_id
              and cm.user_id = (select auth.uid())
              and cm.status = 'active'
          )
        )
      )
    );

  drop policy if exists "partspro_order_lines_self_or_staff_read" on public.order_lines;
  create policy "partspro_order_lines_self_or_staff_read"
    on public.order_lines
    for select
    to authenticated
    using (
      (select private.partspro_has_permission('orders.read'))
      or (
        not exists (
          select 1
          from public.profiles as p
          where p.id = (select auth.uid())
            and p.account_type = 'employee'
        )
        and exists (
          select 1
          from public.orders as o
          where o.id = public.order_lines.order_id
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
      )
    );

  drop policy if exists "partspro_order_events_self_or_staff_read" on public.order_events;
  create policy "partspro_order_events_self_or_staff_read"
    on public.order_events
    for select
    to authenticated
    using (
      (select private.partspro_has_permission('orders.read'))
      or (
        not exists (
          select 1
          from public.profiles as p
          where p.id = (select auth.uid())
            and p.account_type = 'employee'
        )
        and exists (
          select 1
          from public.orders as o
          where o.id = public.order_events.order_id
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
      )
    );
end $$;
