-- No historical backfill. Approval, exemption, settlement and completion remain transactional.
begin;

create function private.rma_waiver_reason(p_payload jsonb) returns text
language plpgsql immutable set search_path=pg_catalog as $$
declare code text:=p_payload->>'waiver_reason_code'; note text:=nullif(btrim(p_payload->>'reason'),'');
begin
 if code is not null and code not in ('no_recovery_value','return_cost_high','other') then
  raise exception 'Invalid no-return reason' using errcode='22023'; end if;
 if length(coalesce(note,''))>1000 or (code='other' and note is null) or (code is null and note is null) then
  raise exception 'Select a no-return reason; other requires a note' using errcode='23514'; end if;
 return coalesce(note,case code when 'no_recovery_value' then 'No recovery value' when 'return_cost_high' then 'Return cost too high' end);
end $$;
revoke all on function private.rma_waiver_reason(jsonb) from public,anon,authenticated;

create function private.rma_refund_is_settled(r public.rma_requests) returns boolean
language sql stable security definer set search_path=pg_catalog,public,private,pg_temp as $$
 select r.refund_completed_at is not null or (r.resolution_action='refund_wallet' and exists (
  select 1 from public.wallet_refund_requests w join public.customer_wallet_transactions t on t.id=w.wallet_transaction_id
  where w.rma_request_id=r.id and w.id=r.wallet_refund_request_id and w.status='approved' and w.request_type='rma_return'
   and w.customer_id=r.customer_id and w.order_id=r.order_id and w.order_line_id=r.order_line_id
   and t.customer_id=r.customer_id and t.order_id=r.order_id and t.order_line_id=r.order_line_id and w.currency='EUR' and t.direction='credit' and t.amount=w.approved_amount and t.amount>0
 ));
$$;
revoke all on function private.rma_refund_is_settled(public.rma_requests) from public,anon,authenticated;

-- A final authorized money/physical operation completes the case in the same transaction.
-- This changes no operation permissions and never manufactures receipt or stock movements.
create function private.rma_complete_when_ready() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
begin
 if old.return_waived_at is not null and (new.return_waived_at is null or
  (old.received_at is null and new.received_at is not null) or (old.customer_shipped_at is null and new.customer_shipped_at is not null)) then
  raise exception 'No-return goods cannot enter the physical return flow' using errcode='23514';end if;
 if old.return_waived_at is null and new.return_waived_at is not null and
  (old.customer_shipped_at is not null or old.received_at is not null or coalesce(old.received_quantity,0)<>0 or old.inventory_disposition<>'pending') then
  raise exception 'Already shipped or received goods require the return flow' using errcode='23514';end if;
 if old.return_waived_at is not null and old.status='approved' and (new.status not in ('approved','refunded','closed') or (new.status='closed' and not private.rma_refund_is_settled(new))) then
  raise exception 'Approved no-return case must settle its refund before completion' using errcode='23514';end if;
 if old.status<>'closed' and new.status='refunded' and private.rma_refund_is_settled(new) and (
  (new.return_waived_at is not null and new.received_at is null and coalesce(new.received_quantity,0)=0 and new.inventory_disposition='pending')
  or (new.return_waived_at is null and new.received_at is not null and new.received_quantity=new.quantity
   and new.qc_status in ('passed','failed','not_required') and new.inventory_disposition in ('restock','scrap','supplier_return')
   and new.inventory_disposition_quantity=new.quantity)
 ) then new.status:='closed';new.closed_at:=now();new.updated_at:=now(); end if;
 return new;
end $$;
revoke all on function private.rma_complete_when_ready() from public,anon,authenticated;
create trigger z_rma_complete_when_ready before update on public.rma_requests
 for each row execute function private.rma_complete_when_ready();

create function private.rma_record_completion() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
begin
 if new.status='closed' and old.status<>'closed' and private.rma_refund_is_settled(new) then
  insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,before_data,after_data,reason)
   values(auth.uid(),'rma.auto_close','rma_request',new.id::text,to_jsonb(old),to_jsonb(new),'Refund and physical obligations completed');
  insert into public.rma_request_events(rma_request_id,actor_id,event_type,from_status,to_status,note,metadata,customer_visible,source_action)
   values(new.id,auth.uid(),'status_changed',old.status,'closed','After-sales completed',jsonb_build_object('customer_visible',true,'automatic',true),true,'auto_close');
  -- Money and exemption operations emit their own final notification. A final stock operation needs one here.
  if old.refund_completed_at is not distinct from new.refund_completed_at and old.return_waived_at is not distinct from new.return_waived_at and new.user_id is not null then
   insert into public.notification_events(recipient_user_id,actor_user_id,audience,event_type,title,body,target_path,source_table,source_id,rma_request_id,source_action,payload)
    values(new.user_id,auth.uid(),'customer','rma_status_updated','After-sales completed','Your refund and return processing are complete.','/rma','rma_requests',new.id::text,new.id,'auto_close',jsonb_build_object('status','closed'));
  end if;
 end if;
 return new;
end $$;
revoke all on function private.rma_record_completion() from public,anon,authenticated;
create trigger rma_record_completion after update of status on public.rma_requests
 for each row execute function private.rma_record_completion();

create function public.admin_perform_rma_review_action_v2(p_request_id uuid,p_action text,p_payload jsonb,p_idempotency_key text)
returns public.rma_requests language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
declare u uuid:=auth.uid();r public.rma_requests%rowtype;before_row public.rma_requests%rowtype;e public.rma_action_executions%rowtype;
 mode text:=coalesce(p_payload->>'return_mode','return_required');reason text; fp text;next_status text;
begin
 if u is null or not coalesce(private.is_staff(),false) or not (coalesce(private.partspro_has_permission('rma.read'),false) or coalesce(private.partspro_has_permission('orders.read'),false))
  or not (coalesce(private.partspro_has_permission('rma.manage'),false) or coalesce(private.partspro_has_permission('orders.manage'),false)) then
  raise exception 'After-sales review permission required' using errcode='42501';end if;
 if p_action is null or p_action not in ('approve','reject','start_review') or p_payload is null or jsonb_typeof(p_payload)<>'object'
  or mode not in ('return_required','refund_only') or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 128
  or length(coalesce(p_payload->>'customer_visible_note',''))>1000 or length(coalesce(p_payload->>'internal_note',''))>1000 then
  raise exception 'Invalid review payload or retry key' using errcode='22023';end if;
 if mode='refund_only' then
  if p_action<>'approve' then raise exception 'Only approval can select no return' using errcode='23514';end if;
  if not coalesce(private.partspro_has_permission('rma.manage'),false) then raise exception 'No-return management permission required' using errcode='42501';end if;
  reason:=private.rma_waiver_reason(p_payload);
 end if;
 select * into r from public.rma_requests where id=p_request_id for update;
 if r.id is null then raise exception 'Return not found' using errcode='P0002';end if;
 before_row:=r;fp:=md5(p_action||':'||p_payload::text);
 select * into e from public.rma_action_executions where rma_request_id=r.id and action=p_action and idempotency_key=p_idempotency_key for update;
 if e.id is not null then
  if e.actor_id is distinct from u or e.payload_fingerprint is distinct from fp then raise exception 'Idempotency payload conflict' using errcode='23514';end if;
  if e.execution_status='succeeded' then return r;end if;
  raise exception 'Action already executing' using errcode='55P03';
 end if;
 if (p_action='start_review' and r.status<>'submitted') or (p_action in ('approve','reject') and r.status not in ('submitted','under_review')) then
  raise exception 'Return is not awaiting review' using errcode='23514';end if;
 if mode='refund_only' and (r.customer_shipped_at is not null or r.received_at is not null or coalesce(r.received_quantity,0)<>0 or r.inventory_disposition<>'pending'
  or r.replacement_order_id is not null or r.replacement_reserved_order_id is not null or r.negotiation_status='pending') then
  raise exception 'Already shipped or physically processed goods require the return flow' using errcode='23514';end if;
 insert into public.rma_action_executions(rma_request_id,action,idempotency_key,payload_fingerprint,actor_id)
  values(r.id,p_action,p_idempotency_key,fp,u) returning * into e;
 next_status:=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'under_review' end;
 update public.rma_requests set status=next_status,
  customer_visible_note=coalesce(nullif(btrim(p_payload->>'customer_visible_note'),''),customer_visible_note),
  internal_note=coalesce(nullif(btrim(p_payload->>'internal_note'),''),internal_note),
  return_waived_at=case when mode='refund_only' then now() else return_waived_at end,
  return_waived_by=case when mode='refund_only' then u else return_waived_by end,
  return_waived_reason=case when mode='refund_only' then reason else return_waived_reason end,
  reviewed_at=coalesce(reviewed_at,now()),reviewed_by=u,updated_at=now() where id=r.id returning * into r;
 insert into public.rma_request_events(rma_request_id,actor_id,event_type,from_status,to_status,note,metadata,customer_visible,source_action,idempotency_key,rma_action_execution_id)
  values(r.id,u,'status_changed',before_row.status,r.status,case when mode='refund_only' then 'Approved: no return required, refund pending' else coalesce(p_payload->>'customer_visible_note','') end,
   jsonb_build_object('customer_visible',true,'return_mode',mode),true,p_action,p_idempotency_key,e.id);
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(u,'rma.'||p_action,'rma_request',r.id::text,to_jsonb(before_row),to_jsonb(r),coalesce(p_payload->>'waiver_reason_code','')||coalesce(': '||reason,''));
 update public.rma_action_executions set execution_status='succeeded',result=jsonb_build_object('status',r.status,'return_mode',mode),updated_at=now() where id=e.id;
 return r;
end $$;
revoke all on function public.admin_perform_rma_review_action_v2(uuid,text,jsonb,text) from public,anon;
grant execute on function public.admin_perform_rma_review_action_v2(uuid,text,jsonb,text) to authenticated;

create function public.admin_perform_rma_simple_action_v2(p_request_id uuid,p_action text,p_payload jsonb,p_idempotency_key text)
returns public.rma_requests language plpgsql security definer set search_path=pg_catalog,public,private,pg_temp as $$
declare u uuid:=auth.uid();r public.rma_requests%rowtype;before_row public.rma_requests%rowtype;e public.rma_action_executions%rowtype;fp text;reason text;
begin
 if p_action is distinct from 'waive_return' then
  return public.admin_perform_rma_simple_action_v1(p_request_id,p_action,p_payload,p_idempotency_key);
 end if;
 if u is null or not coalesce(private.is_staff(),false) or not coalesce(private.partspro_has_permission('rma.manage'),false)
  or not (coalesce(private.partspro_has_permission('rma.read'),false) or coalesce(private.partspro_has_permission('orders.read'),false)) then
  raise exception 'After-sales management permission required' using errcode='42501';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 8 and 128 then
  raise exception 'Invalid waiver payload or retry key' using errcode='22023';end if;
 reason:=private.rma_waiver_reason(p_payload);fp:=md5(p_action||':'||p_payload::text);
 select * into r from public.rma_requests where id=p_request_id for update;
 if r.id is null then raise exception 'Return not found' using errcode='P0002';end if;
 before_row:=r;
 select * into e from public.rma_action_executions where rma_request_id=r.id and action=p_action and idempotency_key=p_idempotency_key for update;
 if e.id is not null then
  if e.actor_id is distinct from u or e.payload_fingerprint is distinct from fp then raise exception 'Idempotency payload conflict' using errcode='23514';end if;
  if e.execution_status='succeeded' then return r;end if;
  raise exception 'Action already executing' using errcode='55P03';end if;
 if r.status not in ('approved','refunded') or (r.status='refunded' and not private.rma_refund_is_settled(r))
  or r.return_waived_at is not null or r.customer_shipped_at is not null or r.received_at is not null or coalesce(r.received_quantity,0)<>0 or r.inventory_disposition<>'pending'
  or r.replacement_order_id is not null or r.replacement_reserved_order_id is not null or r.negotiation_status='pending'
  or (r.resolution_action is not null and r.resolution_action not in ('refund_wallet','refund_cash')) then
  raise exception 'Only unshipped unreceived goods can change to no return' using errcode='23514';end if;
 insert into public.rma_action_executions(rma_request_id,action,idempotency_key,payload_fingerprint,actor_id) values(r.id,p_action,p_idempotency_key,fp,u) returning * into e;
 update public.rma_requests set return_waived_at=now(),return_waived_by=u,return_waived_reason=reason,updated_at=now() where id=r.id returning * into r;
 insert into public.rma_request_events(rma_request_id,actor_id,event_type,from_status,to_status,note,metadata,customer_visible,source_action,idempotency_key,rma_action_execution_id)
  values(r.id,u,'note_added',before_row.status,r.status,'No return required',jsonb_build_object('customer_visible',true),true,p_action,p_idempotency_key,e.id);
 insert into public.admin_audit_events(actor_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(u,'rma.waive_return','rma_request',r.id::text,to_jsonb(before_row),to_jsonb(r),coalesce(p_payload->>'waiver_reason_code','')||': '||reason);
 insert into public.notification_events(recipient_user_id,actor_user_id,audience,event_type,title,body,target_path,source_table,source_id,rma_request_id,source_action,payload)
  select r.user_id,u,'customer','rma_status_updated','No return required',case when r.status='closed' then 'No return required. Your refund is complete.' else 'No return required. Your refund is pending.' end,
   '/rma','rma_requests',r.id::text,r.id,'waive_return',jsonb_build_object('return_mode','refund_only','status',r.status) where r.user_id is not null;
 update public.rma_action_executions set execution_status='succeeded',result=jsonb_build_object('status',r.status),updated_at=now() where id=e.id;
 return r;
end $$;
revoke all on function public.admin_perform_rma_simple_action_v2(uuid,text,jsonb,text) from public,anon;
grant execute on function public.admin_perform_rma_simple_action_v2(uuid,text,jsonb,text) to authenticated;

-- Keep the established review trigger and compatibility RPC. Correct its mode-specific message.
do $$ declare d text;begin
 d:=pg_get_functiondef('private.notify_rma_review_status_change()'::regprocedure);
 if position('Your RMA was approved. You can now send it back.' in d)=0 then raise exception 'Review notification patch precondition failed';end if;
 d:=replace(d,'''Your RMA was approved. You can now send it back.''','case when new.return_waived_at is not null then ''No return required. Your refund is pending.'' else ''Your RMA was approved. You can now send it back.'' end');
 d:=replace(d,'''status'', new.status','''status'', new.status, ''return_mode'', case when new.return_waived_at is not null then ''refund_only'' else ''return_required'' end');
 execute d;
end $$;
commit;
