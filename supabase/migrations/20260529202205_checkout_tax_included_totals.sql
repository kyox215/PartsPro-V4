create or replace function public.create_order_transaction(
  p_lines jsonb,
  p_customer_id uuid default null,
  p_delivery_address text default '',
  p_customer_note text default '',
  p_shipping_method text default '',
  p_shipping numeric default 0,
  p_fiscal jsonb default '{}'::jsonb,
  p_vat_rate numeric default 0.00
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_auth_uid uuid := (select auth.uid());
  v_is_staff boolean := coalesce((select private.is_staff()), false);
  v_customer public.customers%rowtype;
begin
  if v_auth_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_vat_rate < 0 then
    raise exception 'VAT rate cannot be negative' using errcode = '22023';
  end if;

  if v_is_staff and p_customer_id is not null then
    select *
    into v_customer
    from public.customers
    where id = p_customer_id
    limit 1;

    if v_customer.id is null then
      raise exception 'No matching customer profile was found' using errcode = '23503';
    end if;

    if v_customer.status <> 'active'
      or coalesce(v_customer.customer_type, 'retail') <> 'wholesale'
      or coalesce(v_customer.assignment_status, 'needs_review') <> 'assigned' then
      raise exception 'Delegated checkout requires an active assigned wholesale customer' using errcode = '42501';
    end if;
  end if;

  return private.create_order_transaction(
    p_lines,
    p_customer_id,
    p_delivery_address,
    p_customer_note,
    p_shipping_method,
    p_shipping,
    p_fiscal,
    0
  );
end;
$$;

comment on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric) is
  'Creates PartsPro orders with tax-included product prices; p_vat_rate is accepted for compatibility but ignored for new order VAT.';

revoke execute on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  from public, anon;
grant execute on function public.create_order_transaction(jsonb, uuid, text, text, text, numeric, jsonb, numeric)
  to authenticated;
