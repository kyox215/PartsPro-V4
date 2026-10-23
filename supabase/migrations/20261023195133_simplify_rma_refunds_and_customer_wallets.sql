-- Explicitly approved production application is required, including the zero-wallet backfill.
begin;
alter table public.rma_requests
  add column refund_completed_at timestamptz,
  add column refund_completed_by uuid references auth.users(id),
  add column refund_transaction_id uuid references public.customer_wallet_transactions(id),
  add column return_waived_at timestamptz,
  add column return_waived_by uuid references auth.users(id),
  add column return_waived_reason text;
alter table public.rma_requests drop constraint rma_requests_refund_method_check;
alter table public.rma_requests add constraint rma_requests_refund_method_check
  check(refund_method is null or refund_method in ('cash','original_payment','wallet_credit','credit_note'));
alter table public.rma_requests drop constraint rma_requests_resolution_action_check;
alter table public.rma_requests add constraint rma_requests_resolution_action_check
  check(resolution_action is null or resolution_action in ('replacement','refund_wallet','refund_cash','credit_note','no_fault','scrap','return_to_stock','supplier_return'));
alter table public.rma_requests add constraint rma_simple_settlement_consistency check (
  refund_completed_at is null or (
    refund_completed_by is not null and refund_gross_amount is not null and refund_gross_amount > 0 and refund_method is not null and resolution_action is not null and
    ((refund_method='cash' and resolution_action='refund_cash' and refund_transaction_id is null)
      or (refund_method='wallet_credit' and resolution_action='refund_wallet' and refund_transaction_id is not null))));

create function private.create_customer_zero_wallet() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
begin
  insert into public.customer_wallets(customer_id) values(new.id) on conflict(customer_id) do nothing;
  return new;
end $$;
revoke all on function private.create_customer_zero_wallet() from public,anon,authenticated,service_role;
create trigger customer_zero_wallet after insert on public.customers for each row execute function private.create_customer_zero_wallet();
-- Zero opening accounts only; no wallet transactions, balance rewrites or funds.
insert into public.customer_wallets(customer_id)
select c.id from public.customers c where not exists(select 1 from public.customer_wallets w where w.customer_id=c.id)
on conflict(customer_id) do nothing;

-- Every old and new wallet path must also deduct recorded cash refunds.
create or replace function private.order_wallet_refundable_amount(p_order_id uuid) returns numeric
language sql stable security definer set search_path=pg_catalog,public,private,pg_temp as $$
  select round(greatest(coalesce(o.payment_received_amount,0)+coalesce(o.wallet_applied_amount,0)
    - coalesce(private.wallet_refunded_amount_for_order(o.id),0)
    - coalesce((select sum(r.refund_gross_amount) from public.rma_requests r
      where r.order_id=o.id and r.refund_method='cash' and r.refund_completed_at is not null),0),0),2)
  from public.orders o where o.id=p_order_id;
$$;

-- Reuse original invoice pricing. This read-only calculation never creates a wallet or rewrites evidence.
create function private.rma_simple_refund_cap(p_request_id uuid)
returns table(max_refund_amount numeric,quantity integer,net_amount numeric,tax_amount numeric,amount_basis text)
language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
declare r public.rma_requests%rowtype; l public.order_lines%rowtype; o public.orders%rowtype;
  j jsonb; evidence text; used numeric; reserved numeric; line_credit numeric; line_cash numeric; n numeric; t numeric; cap numeric; used_quantity integer; used_tax numeric;
begin
  select * into r from public.rma_requests where id=p_request_id;
  select * into l from public.order_lines where id=r.order_line_id;
  select * into o from public.orders where id=l.order_id;
  if r.id is null or r.status not in ('approved','received') or r.refund_completed_at is not null
    or r.customer_id is null or l.id is null or o.id is null or o.customer_id is distinct from r.customer_id
    or o.id is distinct from r.order_id or o.order_no is distinct from r.order_no or l.sku_code is distinct from r.sku_code
    or (r.refund_currency is not null and r.refund_currency<>'EUR')
    or o.payment_status is distinct from 'paid' or r.quantity<1
    or r.replacement_order_id is not null or r.replacement_reserved_order_id is not null
    or (r.resolution_action is not null and r.resolution_action<>'refund_wallet')
    or r.negotiation_status='pending' or (r.negotiation_status='agreed' and r.negotiation_outcome<>'refund_wallet')
    or exists(select 1 from public.wallet_refund_requests w where w.rma_request_id=r.id and w.status='approved') then
    raise exception 'Return is not eligible for a new refund' using errcode='23514';
  end if;
  if coalesce(r.order_line_snapshot,'{}'::jsonb)<>'{}'::jsonb and (
    jsonb_typeof(r.order_line_snapshot)<>'object'
    or (r.order_line_snapshot ? 'id' and r.order_line_snapshot->>'id' is distinct from l.id::text)
    or (r.order_line_snapshot ? 'order_line_id' and r.order_line_snapshot->>'order_line_id' is distinct from l.id::text)
    or (r.order_line_snapshot ? 'order_id' and r.order_line_snapshot->>'order_id' is distinct from o.id::text)
    or (r.order_line_snapshot ? 'sku_code' and r.order_line_snapshot->>'sku_code' is distinct from l.sku_code)
    or (r.order_line_snapshot ? 'unit_price' and (r.order_line_snapshot->>'unit_price')::numeric is distinct from l.unit_price)
    or (r.order_line_snapshot ? 'quantity' and (r.order_line_snapshot->>'quantity')::numeric is distinct from l.quantity::numeric)) then
      raise exception 'Historical order-line evidence conflicts with original invoice' using errcode='23514';
  end if;
  j:=private.rma_v4_pricing_snapshot(l.id,coalesce(r.unit_price_snapshot,l.unit_price));
  if r.refund_pricing_snapshot is not null then
    foreach evidence in array array['version','order_id','order_line_id','unit_amount','line_quantity','line_net_amount','line_tax_amount','amount_basis'] loop
      if r.refund_pricing_snapshot->evidence is distinct from j->evidence then
        raise exception 'Original refund evidence conflicts with the paid invoice' using errcode='23514';
      end if;
    end loop;
  end if;
  if r.quantity>(j->>'line_quantity')::integer then raise exception 'Return quantity exceeds original line' using errcode='23514'; end if;
  -- Includes old wallet credits, new wallet credits, and old pending reservations.
  select coalesce(sum(w.amount),0) into line_credit from public.customer_wallet_transactions w
    where w.order_line_id=l.id and w.direction='credit';
  select coalesce(sum(x.refund_gross_amount),0) into line_cash from public.rma_requests x
    where x.order_line_id=l.id and x.refund_method='cash' and x.refund_completed_at is not null;
  select coalesce(sum(w.requested_amount),0) into reserved from public.wallet_refund_requests w
    where w.order_line_id=l.id and w.status='pending' and w.rma_request_id is distinct from r.id;
  used:=line_credit+line_cash+reserved;
  n:=round(l.unit_price*r.quantity,2);
  select coalesce(sum(x.refund_approved_quantity),0),coalesce(sum(coalesce(x.refund_allocated_tax_amount,x.refund_tax_amount)),0)
    into used_quantity,used_tax from public.rma_requests x where x.order_line_id=l.id and x.id<>r.id
    and x.resolution_action in ('refund_wallet','refund_cash')
    and (x.refund_allocated_tax_amount is not null or x.status in ('refunded','closed'));
  t:=case when r.refund_allocated_tax_amount is not null then r.refund_allocated_tax_amount
    when used_quantity+r.quantity=(j->>'line_quantity')::integer then greatest((j->>'line_tax_amount')::numeric-used_tax,0)
    else round((j->>'line_tax_amount')::numeric*r.quantity/(j->>'line_quantity')::integer,2) end;
  cap:=greatest(least(n+t,(j->>'line_net_amount')::numeric+(j->>'line_tax_amount')::numeric-used,
    private.order_wallet_refundable_amount(o.id)-coalesce((select sum(w.requested_amount) from public.wallet_refund_requests w
      where w.order_id=o.id and w.status='pending' and w.rma_request_id is distinct from r.id),0)),0);
  return query select cap,r.quantity,n,t,j->>'amount_basis';
end $$;
revoke all on function private.rma_simple_refund_cap(uuid) from public,anon,authenticated,service_role;

create function public.admin_rma_refund_preview_v5(p_request_id uuid)
returns table(available boolean,blocked_reason text,currency text,max_refund_amount numeric,quantity integer,net_amount numeric,tax_amount numeric,tax_included boolean,shipping_included boolean,amount_basis text)
language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
declare m record;
begin
  if auth.uid() is null or not coalesce(private.is_staff(),false) or not (
    coalesce(private.partspro_has_permission('rma.read'),false) or coalesce(private.partspro_has_permission('orders.read'),false)) then
    raise exception 'After-sales read permission required' using errcode='42501'; end if;
  if not (coalesce(private.partspro_has_permission('wallet_refunds.approve'),false) or coalesce(private.partspro_has_permission('rma.refund'),false)
    or coalesce(private.partspro_has_permission('rma.manage'),false)) then raise exception 'Refund preview permission required' using errcode='42501'; end if;
  begin
    select * into m from private.rma_simple_refund_cap(p_request_id);
    return query select m.max_refund_amount>0,case when m.max_refund_amount>0 then null::text else 'wallet_balance_exhausted' end,
      'EUR'::text,m.max_refund_amount,m.quantity,m.net_amount,m.tax_amount,true,false,m.amount_basis;
  exception when check_violation then
    return query select false,'invalid_snapshot'::text,'EUR'::text,0::numeric,0,0::numeric,0::numeric,true,false,null::text;
  end;
end $$;
revoke all on function public.admin_rma_refund_preview_v5(uuid) from public,anon;
grant execute on function public.admin_rma_refund_preview_v5(uuid) to authenticated;

create function public.admin_perform_rma_simple_action_v1(p_request_id uuid,p_action text,p_payload jsonb,p_idempotency_key text)
returns public.rma_requests language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
declare u uuid:=auth.uid(); r public.rma_requests%rowtype; before_row public.rma_requests%rowtype;
 e public.rma_action_executions%rowtype; o public.orders%rowtype; m record; fp text; method text:=p_payload->>'refund_method';
 amount numeric:=(p_payload->>'refund_amount')::numeric; reason text:=nullif(btrim(p_payload->>'reason'),''); credit jsonb; pending public.wallet_refund_requests%rowtype;
begin
 if u is null or not coalesce(private.is_staff(),false) or not (
   coalesce(private.partspro_has_permission('rma.read'),false) or coalesce(private.partspro_has_permission('orders.read'),false)) then
   raise exception 'After-sales staff read permission required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('execute_refund','waive_return','mark_received','close') or p_payload is null or jsonb_typeof(p_payload)<>'object'
   or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 128 then raise exception 'Invalid action or retry key' using errcode='22023'; end if;
 if p_action='execute_refund' then
   if not coalesce(private.partspro_has_permission('wallet_refunds.approve'),false) then raise exception 'Refund approval permission required' using errcode='42501'; end if;
 elsif p_action in ('waive_return','close') then
   if not (coalesce(private.partspro_has_permission('rma.manage'),false) or (p_action='close' and coalesce(private.partspro_has_permission('orders.manage'),false))) then raise exception 'After-sales management permission required' using errcode='42501'; end if;
 elsif not (coalesce(private.partspro_has_permission('rma.inventory'),false) or coalesce(private.partspro_has_permission('product.adjust_stock'),false)
   or coalesce(private.partspro_has_permission('inventory.manage'),false)) then raise exception 'Receipt permission required' using errcode='42501'; end if;
 -- Same order/line locks used by legacy money functions; entire operation is atomic.
 select * into r from public.rma_requests where id=p_request_id for update;
 if r.id is null then raise exception 'Return not found' using errcode='P0002'; end if;
 before_row:=r;
 if p_action in ('mark_received','close') and r.refund_completed_at is null then
   return public.admin_perform_rma_action_v4(p_request_id,p_action,p_payload,p_idempotency_key);
 end if;
 fp:=md5(p_action||':'||p_payload::text);
 select * into e from public.rma_action_executions where rma_request_id=r.id and action=p_action and idempotency_key=p_idempotency_key for update;
 if e.id is not null then
   if e.actor_id is distinct from u or e.payload_fingerprint is distinct from fp then raise exception 'Idempotency payload conflict' using errcode='23514'; end if;
   if e.execution_status='succeeded' then return r; end if;
   raise exception 'Action already executing' using errcode='55P03';
 end if;
 if r.status in ('closed','rejected') then raise exception 'Return is already finished' using errcode='23514'; end if;
 insert into public.rma_action_executions(rma_request_id,action,idempotency_key,payload_fingerprint,actor_id)
 values(r.id,p_action,p_idempotency_key,fp,u) returning * into e;
 if p_action='execute_refund' then
   if method is null or method not in ('cash','wallet_credit') or amount is null or amount<=0 or amount<>round(amount,2)
     or amount>999999 or (method='cash' and coalesce((p_payload->>'cash_paid')::boolean,false) is not true) then
     raise exception 'Confirm refund method, exact amount and actual cash payment' using errcode='23514'; end if;
   if r.requested_resolution='replacement' and coalesce((p_payload->>'confirm_resolution_change')::boolean,false) is not true then
     raise exception 'Confirm changing replacement to refund' using errcode='23514'; end if;
   perform 1 from public.order_lines where id=r.order_line_id for update;
   select * into o from public.orders where id=r.order_id for update;
   select * into m from private.rma_simple_refund_cap(r.id);
   if amount>m.max_refund_amount then raise exception 'Amount exceeds remaining original paid amount' using errcode='23514'; end if;
   if r.refund_pricing_snapshot is null then
     update public.rma_requests set unit_price_snapshot=coalesce(unit_price_snapshot,(select unit_price from public.order_lines where id=r.order_line_id)),
       refund_pricing_snapshot=private.rma_v4_pricing_snapshot(r.order_line_id,coalesce(r.unit_price_snapshot,(select unit_price from public.order_lines where id=r.order_line_id))) where id=r.id;
   end if;
   -- Consume a pre-existing request in this transaction; nobody can approve it afterwards.
   for pending in select * from public.wallet_refund_requests where rma_request_id=r.id and status='pending' for update loop
     if pending.customer_id is distinct from r.customer_id or pending.order_line_id is distinct from r.order_line_id or pending.order_id is distinct from r.order_id then
       raise exception 'Existing request does not match return' using errcode='23514'; end if;
     update public.wallet_refund_requests set status='rejected',decision_note='Superseded by unified return refund',updated_at=now() where id=pending.id;
   end loop;
   if method='wallet_credit' then
     credit:=private.credit_customer_wallet(r.customer_id,amount,'RMA refund',r.order_id,r.order_line_id,
       jsonb_build_object('rma_request_id',r.id,'rma_action_execution_id',e.id,'refund_method',method));
   end if;
   update public.rma_requests set status='refunded',requested_resolution=case when method='wallet_credit' then 'wallet_credit' else 'refund' end,
     resolution_action=case when method='wallet_credit' then 'refund_wallet' else 'refund_cash' end,
     refund_method=method,refund_amount=amount,refund_gross_amount=amount,
     refund_net_amount=round(amount*m.net_amount/nullif(m.net_amount+m.tax_amount,0),2),
     refund_tax_amount=amount-round(amount*m.net_amount/nullif(m.net_amount+m.tax_amount,0),2),
     refund_allocated_tax_amount=m.tax_amount,refund_shipping_amount=0,refund_approved_quantity=r.quantity,
     refund_completed_at=now(),refund_completed_by=u,refund_transaction_id=(credit->>'transaction_id')::uuid,
     resolved_at=now(),updated_at=now() where id=r.id;
 elsif p_action='waive_return' then
   if r.refund_completed_at is null or r.return_waived_at is not null or r.received_at is not null or coalesce(r.received_quantity,0)<>0 or r.inventory_disposition<>'pending'
     or reason is null or length(reason) not between 8 and 1000 then raise exception 'Only unreceived refunded goods can be waived with a reason' using errcode='23514'; end if;
   update public.rma_requests set return_waived_at=now(),return_waived_by=u,return_waived_reason=reason,updated_at=now() where id=r.id;
 elsif p_action='mark_received' then
   if r.status<>'refunded' or r.return_waived_at is not null or r.received_at is not null or coalesce(r.received_quantity,0)<>0
     or (p_payload->>'quantity')::integer is distinct from r.quantity then raise exception 'Confirm complete physical receipt' using errcode='23514'; end if;
   update public.rma_requests set received_at=now(),received_by=u,received_quantity=r.quantity,inventory_disposition='quarantine',updated_at=now() where id=r.id;
 elsif p_action='close' then
   if r.refund_completed_at is null or not (r.return_waived_at is not null or (
     r.received_at is not null and r.received_quantity=r.quantity and r.inventory_disposition in ('restock','scrap','supplier_return')
     and r.inventory_disposition_quantity=r.quantity)) then raise exception 'Finish physical return or explicitly waive it first' using errcode='23514'; end if;
   update public.rma_requests set status='closed',closed_at=now(),updated_at=now() where id=r.id;
 end if;
 select * into r from public.rma_requests where id=p_request_id;
 insert into public.rma_request_events(rma_request_id,actor_id,event_type,from_status,to_status,note,metadata,customer_visible,source_action,idempotency_key,rma_action_execution_id)
 values(r.id,u,'note_added',before_row.status,r.status,
   case p_action when 'execute_refund' then case method when 'cash' then 'Cash refund paid' else 'Refund credited to PartsPro wallet' end
     when 'waive_return' then 'No return required: '||reason when 'mark_received' then 'Returned goods received in full' else 'Return completed' end,
   jsonb_build_object('customer_visible',true,'refund_method',r.refund_method,'amount',r.refund_gross_amount),true,p_action,p_idempotency_key,e.id);
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,before_data,after_data,reason)
 values(u,'rma.'||p_action,'rma_request',r.id::text,to_jsonb(before_row),to_jsonb(r),reason);
 insert into public.notification_events(recipient_user_id,actor_user_id,audience,event_type,title,body,target_path,source_table,source_id,rma_request_id,source_action,payload)
 select r.user_id,u,'customer','rma_status_updated','RMA updated',
   case p_action when 'execute_refund' then case method when 'cash' then 'Your cash refund has been paid.' else 'Your refund has been credited to your PartsPro wallet.' end
     when 'waive_return' then 'You do not need to return the goods.' when 'mark_received' then 'Your returned goods have been received.' else 'Your return is complete.' end,
   '/rma','rma_requests',r.id::text,r.id,p_action,jsonb_build_object('refund_method',r.refund_method,'amount',r.refund_gross_amount)
 where r.user_id is not null;
 update public.rma_action_executions set execution_status='succeeded',result=jsonb_build_object('rma_request_id',r.id,'refund_method',r.refund_method,'amount',r.refund_gross_amount),updated_at=now() where id=e.id;
 return r;
end $$;
revoke all on function public.admin_perform_rma_simple_action_v1(uuid,text,jsonb,text) from public,anon;
grant execute on function public.admin_perform_rma_simple_action_v1(uuid,text,jsonb,text) to authenticated;

-- Legacy allocation must count new cash settlements when assigning the last tax cent.
do $$ declare d text; needle text; begin
 d:=pg_get_functiondef('private.rma_v4_amounts(uuid)'::regprocedure);
 needle:='x.resolution_action=''refund_wallet''';
 if position(needle in d)=0 then raise exception 'Legacy tax allocation patch precondition failed'; end if;
 execute replace(d,needle,'x.resolution_action in (''refund_wallet'',''refund_cash'')');
end $$;

-- Direct approve/reject retains the original RPC's checks, execution record and notifications.
do $$ declare d text; needle text; begin
 d:=pg_get_functiondef('public.admin_perform_rma_review_action(uuid,text,text,text,text)'::regprocedure);
 needle:='v_before.status <> ''under_review''';
 if position(needle in d)=0 then raise exception 'Review guard patch precondition failed'; end if;
 execute replace(d,needle,'v_before.status not in (''submitted'',''under_review'')');
 d:=pg_get_functiondef('private.notify_rma_review_status_change()'::regprocedure);
 needle:='old.status = ''under_review'' and new.status in (''approved'', ''rejected'')';
 if position(needle in d)=0 then raise exception 'Review notification patch precondition failed'; end if;
 execute replace(d,needle,'old.status in (''submitted'',''under_review'') and new.status in (''approved'', ''rejected'')');
end $$;

do $$ declare d text; needle text; begin
 d:=pg_get_functiondef('public.rma_mark_customer_shipped(uuid,text,text)'::regprocedure);
 needle:='v_before.status <> ''approved''';
 if position(needle in d)=0 then raise exception 'Shipment guard patch precondition failed'; end if;
 execute replace(d,needle,'not (v_before.status=''approved'' or (v_before.status=''refunded'' and v_before.refund_completed_at is not null)) or v_before.received_at is not null or v_before.return_waived_at is not null');
end $$;
commit;
