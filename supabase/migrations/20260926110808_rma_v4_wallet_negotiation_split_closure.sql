-- RMA v4. Additive contract; historical settled records are not rewritten.
-- Apply only after linked dry-run review and explicit approval of this push.
begin;
alter table public.rma_requests
  add column parent_request_id uuid references public.rma_requests(id),
  add column negotiation_status text not null default 'none' check (negotiation_status in ('none','pending','agreed')),
  add column negotiation_outcome text check (negotiation_outcome in ('refund_wallet','replacement','return_to_customer','scrap_without_refund')),
  add column customer_confirmation text,
  add column customer_confirmed_at timestamptz,
  add column customer_confirmed_by uuid references auth.users(id),
  add column outbound_tracking_number text,
  add column outbound_carrier text,
  add column refund_pricing_snapshot jsonb,
  add column refund_gross_amount numeric(12,2),
  add column refund_allocated_tax_amount numeric(12,2) check (refund_allocated_tax_amount >= 0),
  add column replacement_reserved_order_id uuid references public.orders(id);
alter table public.orders add column replacement_rma_request_id uuid references public.rma_requests(id);
create unique index orders_replacement_rma_request_unique on public.orders(replacement_rma_request_id) where replacement_rma_request_id is not null and status<>'cancelled';
create index rma_parent_request_idx on public.rma_requests(parent_request_id) where parent_request_id is not null;
alter table public.rma_requests drop constraint rma_requests_inventory_disposition_check;
alter table public.rma_requests add constraint rma_requests_inventory_disposition_check check (inventory_disposition in ('pending','quarantine','restock','scrap','supplier_return','returned_to_customer'));

-- Capture only internally consistent original monetary evidence. Product unit
-- prices already include tax when orders.vat=0; never apply an invented VAT rate.
create function private.rma_v4_pricing_snapshot(p_order_line_id uuid,p_unit_price numeric)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
declare l public.order_lines%rowtype; o public.orders%rowtype; s numeric; q integer; t numeric;
begin
 select * into l from public.order_lines where id=p_order_line_id for update;
 select * into o from public.orders where id=l.order_id for update;
 select round(sum(unit_price*greatest(quantity-coalesce(cancelled_qty,0),0)),2) into s from public.order_lines where order_id=o.id;
 q:=private.rma_order_line_returnable_quantity(l.id);
 if l.id is null or o.id is null or p_unit_price is null or l.unit_price is distinct from p_unit_price or q<1
   or s is distinct from o.total_net or o.total_net<=0 or o.vat<0 or o.shipping<0 then
   raise exception 'Order pricing evidence is missing or inconsistent; manual financial review required' using errcode='23514';
 end if;
 t:=round(p_unit_price*q*o.vat/(o.total_net+o.shipping),2);
 return jsonb_build_object('version',4,'order_id',o.id,'order_line_id',l.id,'unit_amount',p_unit_price,
 'line_quantity',q,'line_net_amount',round(p_unit_price*q,2),'line_tax_amount',t,
 'amount_basis',case when o.vat=0 then 'recorded_tax_included_price' else 'recorded_price_plus_order_tax' end,
 'captured_at',now(),'captured_by',auth.uid());
end $$;
revoke all on function private.rma_v4_pricing_snapshot(uuid,numeric) from public,anon,authenticated,service_role;
create function private.rma_v4_capture_pricing() returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
begin
 if new.parent_request_id is null then
   begin new.refund_pricing_snapshot:=private.rma_v4_pricing_snapshot(new.order_line_id,new.unit_price_snapshot);
   exception when check_violation then new.refund_pricing_snapshot:=null; end;
 end if;
 return new;
end $$;
revoke all on function private.rma_v4_capture_pricing() from public,anon,authenticated,service_role;
create trigger rma_v4_capture_pricing before insert on public.rma_requests for each row execute function private.rma_v4_capture_pricing();

create function private.rma_v4_amounts(p_request_id uuid)
returns table(net_amount numeric,tax_amount numeric,gross_amount numeric)
language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
declare r public.rma_requests%rowtype; j jsonb; q integer; n numeric; t numeric; used_q integer; used_tax numeric;
begin
 select * into r from public.rma_requests where id=p_request_id;
 j:=r.refund_pricing_snapshot;
 if j is null or j->>'version'<>'4' or j->>'order_line_id' is distinct from r.order_line_id::text
   or j->>'order_id' is distinct from r.order_id::text or (j->>'unit_amount')::numeric is distinct from r.unit_price_snapshot then
   raise exception 'Immutable refund pricing snapshot is missing; verify original invoice first' using errcode='23514';
 end if;
 q:=(j->>'line_quantity')::integer;
 if q<r.quantity then raise exception 'Invalid refund pricing quantity' using errcode='23514'; end if;
 n:=round((j->>'unit_amount')::numeric*r.quantity,2);
 -- Allocation belongs to the returned quantity, not the negotiated payout.
 -- Keep it stable through approval order and rejected-wallet retries.
 if r.refund_allocated_tax_amount is not null then
   return query select n,r.refund_allocated_tax_amount,n+r.refund_allocated_tax_amount; return;
 end if;
 select coalesce(sum(x.refund_approved_quantity),0),coalesce(sum(coalesce(x.refund_allocated_tax_amount,x.refund_tax_amount)),0) into used_q,used_tax
 from public.rma_requests x where x.order_line_id=r.order_line_id and x.id<>r.id and x.resolution_action='refund_wallet'
 and (x.refund_allocated_tax_amount is not null or x.status in ('refunded','closed') or exists(select 1 from public.wallet_refund_requests w where w.id=x.wallet_refund_request_id and w.rma_request_id=x.id and w.status='pending'));
 t:=case when used_q+r.quantity=q then greatest((j->>'line_tax_amount')::numeric-used_tax,0)
 else round((j->>'line_tax_amount')::numeric*r.quantity/q,2) end;
 return query select n,t,n+t;
end $$;
revoke all on function private.rma_v4_amounts(uuid) from public,anon,authenticated,service_role;

-- Harden the deployed v3 implementation too: no legacy endpoint can bypass
-- QC, dedicated replacement provenance, negotiation, or the gross refund cap.
do $patch$
declare d text; needle text; replacement text;
begin
 d:=pg_get_functiondef('public.admin_perform_rma_action_v3(uuid,text,uuid,text,text,text,numeric,integer,text,text,text,text,uuid,text,text)'::regprocedure);
 needle:='  if v_action = ''assign'' then';
 replacement:=$code$  if v_before.negotiation_status = 'pending' and v_action in ('request_wallet_refund','mark_replacement_sent','restock_return','mark_scrapped','supplier_return','close') then
    raise exception 'Resolve customer negotiation before processing this action' using errcode='23514';
  end if;
  if v_before.negotiation_status='agreed' and (
    (v_action='request_wallet_refund' and v_before.negotiation_outcome<>'refund_wallet')
    or (v_action='mark_replacement_sent' and v_before.negotiation_outcome<>'replacement')
    or (v_before.negotiation_outcome='return_to_customer' and v_action in ('restock_return','mark_scrapped','supplier_return'))
    or (v_before.negotiation_outcome='scrap_without_refund' and v_action in ('restock_return','supplier_return'))
  ) then raise exception 'Action conflicts with the recorded customer agreement' using errcode='23514'; end if;
  if v_action = 'restock_return' and v_before.qc_status is distinct from 'passed' then
    raise exception 'Only QC-passed returns may enter saleable inventory' using errcode='23514';
  end if;
  if v_action = 'mark_replacement_sent' and not exists(select 1 from public.orders o where o.id=p_replacement_order_id and o.replacement_rma_request_id=v_before.id and o.total_net=0 and o.vat=0 and o.shipping=0) then
    raise exception 'Replacement must use the dedicated zero-value RMA order' using errcode='23514';
  end if;
  if v_action = 'assign' then$code$;
 if position(needle in d)=0 then raise exception 'RMA v3 action patch precondition failed'; end if;
 d:=replace(d,needle,replacement);
 needle:='    v_line_refund_cap := round(v_line_unit_price * v_stock_quantity, 2);';
 if position(needle in d)=0 then raise exception 'RMA v3 refund patch precondition failed'; end if;
 d:=replace(d,needle,'    select gross_amount into v_line_refund_cap from private.rma_v4_amounts(v_before.id);');
 d:=replace(d,'''amount_scope'', ''explicit_line_amount_only''','''amount_scope'', ''recorded_goods_gross_excluding_shipping''');
 d:=replace(d,'sum(coalesce(r.refund_net_amount, r.refund_amount, 0))','sum(coalesce(r.refund_gross_amount, r.refund_amount, 0))');
 d:=replace(d,'round(v_line_unit_price * v_order_line_returnable_quantity, 2)',
 'round((v_before.refund_pricing_snapshot->>''line_net_amount'')::numeric+(v_before.refund_pricing_snapshot->>''line_tax_amount'')::numeric,2)');
 -- The action accepts an explicitly confirmed gross total and derives net/tax
 -- proportionately; partial negotiated amounts do not overstate tax.
 d:=replace(d,'refund_net_amount = case when v_action = ''request_wallet_refund'' then v_refund_amount else refund_net_amount end,',
 $code$refund_net_amount = case when v_action = 'request_wallet_refund' then round(v_refund_amount*(select net_amount/nullif(gross_amount,0) from private.rma_v4_amounts(v_before.id)),2) else refund_net_amount end,
      refund_tax_amount = case when v_action = 'request_wallet_refund' then v_refund_amount-round(v_refund_amount*(select net_amount/nullif(gross_amount,0) from private.rma_v4_amounts(v_before.id)),2) else refund_tax_amount end,
      refund_gross_amount = case when v_action = 'request_wallet_refund' then v_refund_amount else refund_gross_amount end,
      refund_allocated_tax_amount = case when v_action = 'request_wallet_refund' then (select tax_amount from private.rma_v4_amounts(v_before.id)) else refund_allocated_tax_amount end,
      refund_shipping_amount = case when v_action = 'request_wallet_refund' then 0 else refund_shipping_amount end,$code$);
 execute d;
 d:=pg_get_functiondef('private.assert_rma_wallet_refund_line_cap()'::regprocedure);
 d:=replace(d,'sum(coalesce(r.refund_net_amount, r.refund_amount, 0))','sum(coalesce(r.refund_gross_amount, r.refund_amount, 0))');
 d:=replace(d,'round(v_unit_price * v_approved_quantity, 2)','case when v_rma.refund_pricing_snapshot is null then round(v_unit_price * v_approved_quantity,2) else (select gross_amount from private.rma_v4_amounts(v_rma.id)) end');
 d:=replace(d,'round(v_unit_price * v_order_line_returnable_quantity, 2)',
 'case when v_rma.refund_pricing_snapshot is null then round(v_unit_price * v_order_line_returnable_quantity,2) else round((v_rma.refund_pricing_snapshot->>''line_net_amount'')::numeric+(v_rma.refund_pricing_snapshot->>''line_tax_amount'')::numeric,2) end');
 d:=replace(d,'  return new;', $code$  if new.request_type='rma_return' and new.status='approved' and v_rma.negotiation_status='pending' then
    raise exception 'Customer negotiation is pending' using errcode='23514';
  end if;
  return new;$code$);
 execute d;
 d:=pg_get_functiondef('private.sync_rma_wallet_refund_approval()'::regprocedure);
 d:=replace(d,'refund_net_amount = new.approved_amount,',
 $code$refund_net_amount = case when v_rma.refund_pricing_snapshot is not null then round(new.approved_amount*(select net_amount/nullif(gross_amount,0) from private.rma_v4_amounts(v_rma.id)),2) else new.approved_amount end,
      refund_tax_amount = case when v_rma.refund_pricing_snapshot is not null then new.approved_amount-round(new.approved_amount*(select net_amount/nullif(gross_amount,0) from private.rma_v4_amounts(v_rma.id)),2) else 0 end,
      refund_gross_amount = new.approved_amount,$code$);
 execute d;
end $patch$;

create function public.admin_perform_rma_action_v4(p_request_id uuid,p_action text,p_payload jsonb default '{}'::jsonb,p_idempotency_key text default null)
returns public.rma_requests language plpgsql security definer
set search_path=pg_catalog,public,private,pg_temp as $$
declare
 u uuid:=auth.uid(); a text:=lower(btrim(p_action)); p jsonb:=coalesce(p_payload,'{}'::jsonb);
 r public.rma_requests%rowtype; result public.rma_requests%rowtype; child public.rma_requests%rowtype;
 e public.rma_action_executions%rowtype; k text:=nullif(btrim(p_idempotency_key),''); fp text;
 q integer; outcome text; confirmation text; reason text:=nullif(btrim(p->>'reason'),'');
 oid uuid; lid uuid; o public.orders%rowtype; original public.orders%rowtype; l public.order_lines%rowtype;
begin
 if u is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if not coalesce(private.is_staff(),false) then raise exception 'Staff role required' using errcode='42501'; end if;
 if a is null or jsonb_typeof(p)<>'object' or k is null or length(k) not between 8 and 160 then raise exception 'Invalid RMA action payload or idempotency key' using errcode='22023'; end if;
 if a not in ('start_negotiation','resolve_negotiation','split_request','return_to_customer','bind_replacement_order','create_replacement_order','release_cancelled_replacement','verify_refund_snapshot','cancel_unreceived','close') then
   return public.admin_perform_rma_action_v3(p_request_id,a,(p->>'assigned_to')::uuid,p->>'customer_visible_note',p->>'internal_note',p->>'reason',(p->>'refund_amount')::numeric,(p->>'quantity')::integer,p->>'batch_code',p->>'supplier',p->>'location',k,(p->>'replacement_order_id')::uuid,p->>'qc_status',p->>'qc_note');
 end if;
 if a='return_to_customer' then
   if not (coalesce(private.partspro_has_permission('rma.inventory'),false) or coalesce(private.partspro_has_permission('inventory.manage'),false) or coalesce(private.partspro_has_permission('product.adjust_stock'),false)) then raise exception 'RMA inventory permission required' using errcode='42501'; end if;
 elsif not coalesce(private.partspro_has_permission('rma.manage'),false) then raise exception 'RMA manage permission required' using errcode='42501'; end if;
 select * into r from public.rma_requests where id=p_request_id for update;
 if r.id is null then raise exception 'RMA request not found' using errcode='P0002'; end if;
 fp:=md5(a||':'||p::text);
 select * into e from public.rma_action_executions where rma_request_id=r.id and action=a and idempotency_key=k for update;
 if e.id is not null then
   if e.payload_fingerprint<>fp then raise exception 'RMA action idempotency key conflicts with another payload' using errcode='23514'; end if;
   if e.execution_status='succeeded' then return r; end if;
   raise exception 'RMA action is already executing' using errcode='55P03';
 end if;
 if a='close' and r.status='closed' then return r; end if;
 if a='close' and not (r.negotiation_status='agreed' and r.negotiation_outcome in ('return_to_customer','scrap_without_refund')) then
   return public.admin_perform_rma_action_v3(p_request_id,a,p_customer_visible_note=>p->>'customer_visible_note',p_internal_note=>p->>'internal_note',p_reason=>reason,p_idempotency_key=>k);
 end if;
 if r.status in ('closed','rejected','refunded','replacement_sent','replaced') then raise exception 'RMA commercial outcome is already terminal' using errcode='23514'; end if;
 if r.wallet_refund_request_id is not null or exists(select 1 from public.wallet_refund_requests where rma_request_id=r.id and status<>'rejected') or r.replacement_order_id is not null then raise exception 'Resolve existing commercial processing before changing the RMA' using errcode='23514'; end if;
 insert into public.rma_action_executions(rma_request_id,action,idempotency_key,payload_fingerprint,actor_id) values(r.id,a,k,fp,u) returning * into e;
 if a='cancel_unreceived' then
   confirmation:=nullif(btrim(p->>'customer_confirmation'),'');
   if r.status not in ('submitted','under_review','approved') or r.received_at is not null or coalesce(r.received_quantity,0)<>0 or r.resolution_action is not null or r.inventory_disposition<>'pending' or r.replacement_reserved_order_id is not null or reason is null or coalesce(length(confirmation),0)<8 then raise exception 'Cancellation requires unreceived goods and documented customer agreement' using errcode='23514'; end if;
   update public.rma_requests set status='rejected',customer_confirmation=confirmation,customer_confirmed_at=now(),customer_confirmed_by=u,customer_visible_note=reason,reviewed_at=now(),updated_at=now() where id=r.id;
 elsif a='start_negotiation' then
   if r.status<>'received' or r.received_quantity is distinct from r.quantity or r.qc_status='pending' or reason is null or r.inventory_disposition<>'quarantine' or r.replacement_reserved_order_id is not null then raise exception 'Negotiation requires received, quarantined and inspected goods plus a reason' using errcode='23514'; end if;
   update public.rma_requests set negotiation_status='pending',negotiation_outcome=null,customer_confirmation=null,customer_confirmed_at=null,customer_confirmed_by=null,customer_visible_note=coalesce(nullif(btrim(p->>'customer_visible_note'),''),reason),updated_at=now() where id=r.id;
 elsif a='resolve_negotiation' then
   outcome:=p->>'outcome'; confirmation:=nullif(btrim(p->>'customer_confirmation'),'');
   if r.negotiation_status<>'pending' or outcome is null or outcome not in ('refund_wallet','replacement','return_to_customer','scrap_without_refund') or coalesce(length(confirmation),0)<8 then raise exception 'Customer agreement and a supported outcome are required' using errcode='23514'; end if;
   update public.rma_requests set negotiation_status='agreed',negotiation_outcome=outcome,customer_confirmation=confirmation,customer_confirmed_at=now(),customer_confirmed_by=u,
   requested_resolution=case outcome when 'refund_wallet' then 'wallet_credit' when 'replacement' then 'replacement' else requested_resolution end,
   resolution_action=null,updated_at=now() where id=r.id;
 elsif a='split_request' then
   q:=(p->>'quantity')::integer;
   if q is null or q<1 or q>=r.quantity or r.status not in ('approved','received') or r.qc_status<>'pending' or r.resolution_action is not null or r.negotiation_status<>'none' or r.replacement_reserved_order_id is not null or r.inventory_disposition not in ('pending','quarantine') or r.inventory_disposition_quantity is not null then raise exception 'Split requires a partial positive quantity before QC or commercial processing' using errcode='23514'; end if;
   child:=r; child.id:=gen_random_uuid(); child.parent_request_id:=r.id;
   child.rma_no:='RMA-'||to_char(now(),'YYYYMMDD')||'-'||lpad(nextval('public.rma_request_no_seq')::text,6,'0');
   child.quantity:=r.quantity-q; child.draft_id:=null; child.idempotency_key:=null; child.submit_payload_fingerprint:=null;
   child.attachments:='[]'::jsonb; child.evidence_urls:='{}'::text[]; child.created_at:=now(); child.updated_at:=now();
   if r.status='received' then
     if r.received_quantity is distinct from r.quantity then raise exception 'Received split requires a complete existing receipt' using errcode='23514'; end if;
     child.received_quantity:=child.quantity;
   end if;
   update public.rma_requests set quantity=q,received_quantity=case when r.status='received' then q else received_quantity end,updated_at=now() where id=r.id;
   insert into public.rma_requests select child.*;
   -- Receipt remains a single physical event; explicit allocation events bind
   -- the child to its original quarantine entry without inventing new stock.
   insert into public.rma_request_events(rma_request_id,actor_id,event_type,from_status,to_status,note,customer_visible,source_action,metadata)
   values(child.id,u,'note_added',child.status,child.status,'Created from a partial RMA; original evidence and receipt remain on the parent request.',true,a,jsonb_build_object('parent_request_id',r.id,'quantity',child.quantity,'customer_visible',true));
 elsif a='verify_refund_snapshot' then
   if not (coalesce(private.partspro_has_permission('rma.refund'),false) or coalesce(private.partspro_has_permission('wallet_refunds.request'),false)) then raise exception 'Refund permission is required to verify financial evidence' using errcode='42501'; end if;
   if reason is null or r.refund_pricing_snapshot is not null or r.resolution_action is not null then raise exception 'Snapshot verification requires original-invoice evidence and an unprocessed historical RMA' using errcode='23514'; end if;
   update public.rma_requests set refund_pricing_snapshot=private.rma_v4_pricing_snapshot(r.order_line_id,r.unit_price_snapshot)||jsonb_build_object('verification_reason',reason),updated_at=now() where id=r.id;
 elsif a='release_cancelled_replacement' then
   if not coalesce(private.partspro_has_permission('orders.manage'),false) then raise exception 'Order management permission required' using errcode='42501'; end if;
   select * into o from public.orders where id=r.replacement_reserved_order_id for update;
   if r.status<>'received' or r.resolution_action is not null or o.id is null or o.replacement_rma_request_id is distinct from r.id or o.status<>'cancelled' or exists(select 1 from public.order_events ev where ev.order_id=o.id and ev.to_status in ('shipped','completed')) then raise exception 'Only a cancelled unshipped dedicated replacement can be released' using errcode='23514'; end if;
   oid:=o.id;
   update public.rma_requests set replacement_reserved_order_id=null,updated_at=now() where id=r.id;
 elsif a in ('bind_replacement_order','create_replacement_order') then
   if not coalesce(private.partspro_has_permission('orders.manage'),false) then raise exception 'Order management permission required for replacement orders' using errcode='42501'; end if;
   if r.status<>'received' or r.qc_status='pending' or r.received_quantity is distinct from r.quantity or r.requested_resolution<>'replacement' or r.resolution_action is not null or not (r.negotiation_status='none' or (r.negotiation_status='agreed' and r.negotiation_outcome='replacement')) or r.replacement_reserved_order_id is not null then raise exception 'Replacement requires inspected receipt and no previous reservation' using errcode='23514'; end if;
   if a='create_replacement_order' then
     select * into original from public.orders where id=r.order_id for update;
     select * into l from public.order_lines where id=r.order_line_id;
     insert into public.orders(order_no,customer_id,user_id,customer_name,customer_tier,status,payment_status,payment_method,total_net,vat,shipping,delivery_address,shipping_method,fiscal,staff_note,replacement_rma_request_id)
     values('PP-RMA-'||upper(replace(gen_random_uuid()::text,'-','')),r.customer_id,original.user_id,original.customer_name,original.customer_tier,'submitted','paid',original.payment_method,0,0,0,original.delivery_address,original.shipping_method,original.fiscal,'Replacement for '||r.rma_no,r.id) returning id into oid;
     insert into public.order_lines(order_id,sku_code,product_name,quality_grade,quantity,unit_price,stock_status)
     values(oid,r.sku_code,l.product_name,l.quality_grade,r.quantity,0,'available') returning id into lid;
     perform private.reserve_order_line_inventory(lid,r.sku_code,r.quantity);
     insert into public.order_events(order_id,event_type,actor_id,note,metadata) values(oid,'created',u,'Dedicated RMA replacement; no customer payment',jsonb_build_object('rma_request_id',r.id,'source','rma_v4'));
   else
     oid:=(p->>'replacement_order_id')::uuid;
     select * into o from public.orders where id=oid for update;
     if o.id is null or o.replacement_rma_request_id is distinct from r.id or o.customer_id is distinct from r.customer_id or o.status not in ('submitted','accepted','picking','packed') or o.total_net<>0 or o.vat<>0 or o.shipping<>0 then raise exception 'Only an unshipped dedicated zero-value replacement order can be bound' using errcode='23514'; end if;
   end if;
   update public.rma_requests set replacement_reserved_order_id=oid,updated_at=now() where id=r.id;
 elsif a='return_to_customer' then
   if not (coalesce(private.partspro_has_permission('rma.inventory'),false) or coalesce(private.partspro_has_permission('inventory.manage'),false) or coalesce(private.partspro_has_permission('product.adjust_stock'),false)) then raise exception 'RMA inventory permission required' using errcode='42501'; end if;
   if r.negotiation_status<>'agreed' or r.negotiation_outcome<>'return_to_customer' or r.customer_confirmed_at is null or r.inventory_disposition<>'quarantine' or nullif(btrim(p->>'tracking_number'),'') is null or nullif(btrim(p->>'carrier'),'') is null or nullif(btrim(p->>'location'),'') is null or reason is null then raise exception 'Customer agreement, dispatch evidence, carrier, tracking and location are required' using errcode='23514'; end if;
   insert into public.stock_movements(sku_code,order_id,order_line_id,movement_type,quantity,actor_id,rma_request_id,rma_action_execution_id,source_type,metadata)
   values(r.sku_code,r.order_id,r.order_line_id,'rma_disposition',r.quantity,u,r.id,e.id,'rma_return_to_customer',jsonb_build_object('available_qty_delta',0,'disposition','returned_to_customer','location',p->>'location','reason',reason));
   update public.rma_requests set inventory_disposition='returned_to_customer',inventory_disposition_quantity=quantity,outbound_tracking_number=btrim(p->>'tracking_number'),outbound_carrier=btrim(p->>'carrier'),updated_at=now() where id=r.id;
 elsif a='close' then
   if r.status<>'received' or r.received_quantity is distinct from r.quantity or r.qc_status='pending' or r.customer_confirmed_at is null or nullif(btrim(r.customer_confirmation),'') is null or r.inventory_disposition_quantity is distinct from r.quantity or not ((r.negotiation_outcome='return_to_customer' and r.inventory_disposition='returned_to_customer' and r.outbound_tracking_number is not null) or (r.negotiation_outcome='scrap_without_refund' and r.inventory_disposition='scrap')) then raise exception 'Customer agreement and completed physical disposition required for closure without refund' using errcode='23514'; end if;
   update public.rma_requests set status='closed',resolution_action='no_fault',closed_at=now(),resolved_at=now(),updated_at=now() where id=r.id;
 end if;
 select * into result from public.rma_requests where id=r.id;
 insert into public.rma_request_events(rma_request_id,actor_id,event_type,from_status,to_status,note,customer_visible,source_action,idempotency_key,rma_action_execution_id,metadata)
 values(r.id,u,case when a='close' then 'closed' else 'note_added' end,r.status,result.status,
 coalesce(nullif(btrim(p->>'customer_visible_note'),''),case a when 'start_negotiation' then 'Awaiting customer agreement' when 'resolve_negotiation' then 'Customer agreement recorded' when 'split_request' then 'Request divided for separate processing' when 'return_to_customer' then 'Original item dispatched to customer' when 'cancel_unreceived' then 'Unreceived return cancelled by customer agreement' when 'close' then 'RMA closed according to customer agreement' else 'RMA processing updated' end),
 a in ('start_negotiation','resolve_negotiation','split_request','return_to_customer','cancel_unreceived','close'),a,k,e.id,
 jsonb_strip_nulls(jsonb_build_object('customer_visible',a in ('start_negotiation','resolve_negotiation','split_request','return_to_customer','cancel_unreceived','close'),'child_request_id',child.id,'outcome',outcome,'reason',case when a='verify_refund_snapshot' then reason else null end)));
 if result.user_id is not null and a in ('start_negotiation','resolve_negotiation','split_request','return_to_customer','close') then
   insert into public.notification_events(recipient_user_id,actor_user_id,audience,event_type,title,body,target_path,source_table,source_id,rma_request_id,source_action,payload)
   values(result.user_id,u,'customer','rma_status_updated','RMA processing updated',
     case a when 'start_negotiation' then 'Your return is awaiting agreement. Please contact customer service.' when 'return_to_customer' then 'Your original item has been dispatched.' when 'close' then 'Your return is closed according to the agreed resolution.' else 'Your return processing has been updated.' end,
     '/rma?requestId='||r.id,'rma_requests',r.id::text,r.id,a,jsonb_build_object('rma_no',result.rma_no,'status',result.status,'negotiation_status',result.negotiation_status));
 end if;
 update public.rma_action_executions set execution_status='succeeded',result=jsonb_strip_nulls(jsonb_build_object('rma_request_id',r.id,'child_request_id',child.id,'replacement_order_id',oid)),updated_at=now() where id=e.id;
 return result;
end $$;
revoke all on function public.admin_perform_rma_action_v4(uuid,text,jsonb,text) from public,anon;
grant execute on function public.admin_perform_rma_action_v4(uuid,text,jsonb,text) to authenticated;

create function public.rma_workflow_v4_capabilities() returns table(ready boolean,contract_version text)
language sql stable security definer set search_path=pg_catalog,public,private,pg_temp as $$ select true,'rma-workflow-v4'::text $$;
revoke all on function public.rma_workflow_v4_capabilities() from public,anon;
grant execute on function public.rma_workflow_v4_capabilities() to authenticated;

create function public.admin_rma_refund_preview_v4(p_request_id uuid)
returns table(available boolean,blocked_reason text,currency text,max_refund_amount numeric,quantity integer,net_amount numeric,tax_amount numeric,tax_included boolean,shipping_included boolean,amount_basis text)
language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
declare base record; r public.rma_requests%rowtype; money record; used numeric; cap numeric;
begin
 -- Reuse the established authentication, permission, canonical-source and
 -- active commercial/receipt checks, but compute a new gross cap below.
 select * into base from public.admin_rma_refund_preview(p_request_id);
 select * into r from public.rma_requests where id=p_request_id;
 if not base.available or r.negotiation_status='pending' or (r.negotiation_status='agreed' and r.negotiation_outcome<>'refund_wallet') then
  return query select false,coalesce(base.blocked_reason,'negotiation_pending'),'EUR',0::numeric,r.quantity,0::numeric,0::numeric,true,false,null::text; return;
 end if;
 begin select * into money from private.rma_v4_amounts(r.id);
 exception when check_violation then
  return query select false,'missing_pricing_snapshot','EUR',0::numeric,r.quantity,0::numeric,0::numeric,true,false,null::text; return;
 end;
 select coalesce(sum(coalesce(x.refund_gross_amount,x.refund_amount,0)),0) into used from public.rma_requests x
 where x.order_line_id=r.order_line_id and x.id<>r.id and x.status in ('refunded','closed');
 cap:=greatest(least(money.gross_amount,(r.refund_pricing_snapshot->>'line_net_amount')::numeric+(r.refund_pricing_snapshot->>'line_tax_amount')::numeric-used,private.order_wallet_refundable_amount(r.order_id)),0);
 return query select cap>0,case when cap>0 then null::text else 'wallet_balance_exhausted' end,'EUR',cap,r.quantity,money.net_amount,money.tax_amount,true,false,r.refund_pricing_snapshot->>'amount_basis';
end $$;
revoke all on function public.admin_rma_refund_preview_v4(uuid) from public,anon;
grant execute on function public.admin_rma_refund_preview_v4(uuid) to authenticated;

-- Old candidate consumers must not suggest unrelated ordinary orders.
do $$ declare d text; needle text; begin
 d:=pg_get_functiondef('public.admin_rma_replacement_candidates(uuid)'::regprocedure);
 needle:='o.customer_id = v_customer_id';
 if position(needle in d)=0 then raise exception 'Replacement candidate patch precondition failed'; end if;
 d:=replace(d,needle,needle||' and o.replacement_rma_request_id=p_request_id and o.total_net=0 and o.vat=0 and o.shipping=0');
 execute d;
end $$;
commit;
