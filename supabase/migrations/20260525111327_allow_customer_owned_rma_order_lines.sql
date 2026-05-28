-- Allow RMA requests against order lines owned by the current customer/company,
-- not only orders whose header user_id directly matches auth.uid().

create or replace function private.enforce_rma_order_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line_qty integer;
  v_order_user_id uuid;
  v_order_customer_id uuid;
  v_order_no text;
  v_sku_code text;
  v_auth_uid uuid := (select auth.uid());
  v_current_customer_id uuid := (select private.current_customer_id());
  v_is_staff boolean := (select private.is_staff());
begin
  if new.order_line_id is null then
    raise exception 'RMA request must reference an order line' using errcode = '23502';
  end if;

  select
    ol.quantity,
    o.user_id,
    o.customer_id,
    o.order_no,
    ol.sku_code
  into
    v_line_qty,
    v_order_user_id,
    v_order_customer_id,
    v_order_no,
    v_sku_code
  from public.order_lines as ol
  join public.orders as o on o.id = ol.order_id
  where ol.id = new.order_line_id
  limit 1;

  if v_line_qty is null then
    raise exception 'RMA order line does not exist' using errcode = '23503';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'RMA quantity must be positive' using errcode = '23514';
  end if;

  if new.quantity > v_line_qty then
    raise exception 'RMA quantity cannot exceed ordered line quantity' using errcode = '23514';
  end if;

  if new.attachments is null then
    new.attachments := '[]'::jsonb;
  end if;

  if jsonb_typeof(new.attachments) <> 'array' then
    raise exception 'RMA attachments must be a JSON array' using errcode = '23514';
  end if;

  if new.order_no is null or btrim(new.order_no) = '' then
    new.order_no := v_order_no;
  elsif new.order_no <> v_order_no then
    raise exception 'RMA order_no must match the referenced order line' using errcode = '23514';
  end if;

  if new.sku_code is null or btrim(new.sku_code) = '' then
    new.sku_code := v_sku_code;
  elsif new.sku_code <> v_sku_code then
    raise exception 'RMA sku_code must match the referenced order line' using errcode = '23514';
  end if;

  if not v_is_staff then
    if v_auth_uid is null then
      raise exception 'Authentication required' using errcode = '28000';
    end if;

    if v_order_user_id is distinct from v_auth_uid
      and (
        v_current_customer_id is null
        or v_order_customer_id is distinct from v_current_customer_id
      )
    then
      raise exception 'RMA order line is not owned by current user or customer' using errcode = '42501';
    end if;

    new.user_id := coalesce(new.user_id, v_auth_uid);

    if new.user_id is distinct from v_auth_uid then
      raise exception 'RMA user_id must match current user' using errcode = '42501';
    end if;

    new.status := coalesce(new.status, 'submitted');

    if new.status <> 'submitted' then
      raise exception 'Buyers can only submit new RMA requests' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;
drop policy if exists "partspro_rma_self_submit" on public.rma_requests;
create policy "partspro_rma_self_submit"
on public.rma_requests
for insert
to authenticated
with check (
  (select private.is_staff())
  or (
    user_id = (select auth.uid())
    and status = 'submitted'
    and exists (
      select 1
      from public.order_lines as ol
      join public.orders as o on o.id = ol.order_id
      where ol.id = rma_requests.order_line_id
        and rma_requests.quantity <= ol.quantity
        and (
          o.user_id = (select auth.uid())
          or o.customer_id = (select private.current_customer_id())
        )
    )
  )
);
drop policy if exists "partspro_rma_insert_order_line_guard" on public.rma_requests;
create policy "partspro_rma_insert_order_line_guard"
on public.rma_requests
as restrictive
for insert
to authenticated
with check (
  (select private.is_staff())
  or (
    user_id = (select auth.uid())
    and status = 'submitted'
    and order_line_id is not null
    and exists (
      select 1
      from public.order_lines as ol
      join public.orders as o on o.id = ol.order_id
      where ol.id = rma_requests.order_line_id
        and rma_requests.quantity <= ol.quantity
        and (
          o.user_id = (select auth.uid())
          or o.customer_id = (select private.current_customer_id())
        )
    )
  )
);
