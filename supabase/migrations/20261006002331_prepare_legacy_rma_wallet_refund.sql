-- Prepare a received return for an explicitly directed wallet refund.
-- No funds, inventory disposition, receipt/QC, or customer agreement are changed here.
create or replace function public.admin_prepare_rma_wallet_refund_v1(
  p_request_id uuid, p_reason text, p_idempotency_key text
) returns public.rma_requests
language plpgsql security definer
set search_path=pg_catalog,public,private,pg_temp
as $function$
declare
  actor uuid:=auth.uid();
  reason text:=nullif(btrim(p_reason),'');
  key text:=nullif(btrim(p_idempotency_key),'');
  fingerprint text;
  request public.rma_requests%rowtype;
  result public.rma_requests%rowtype;
  line public.order_lines%rowtype;
  original public.orders%rowtype;
  execution public.rma_action_executions%rowtype;
  pricing jsonb;
  unit_amount numeric;
  old_resolution text;
  cap numeric;
  evidence_key text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not coalesce(private.is_staff(),false)
    or not coalesce(private.partspro_has_permission('rma.manage'),false)
    or not coalesce(private.partspro_has_permission('wallet_refunds.approve'),false)
    or not (coalesce(private.partspro_has_permission('rma.refund'),false)
      or coalesce(private.partspro_has_permission('wallet_refunds.request'),false)) then
    raise exception 'RMA management, wallet request and wallet approval permissions are required' using errcode='42501';
  end if;
  if p_request_id is null or key is null or length(key) not between 8 and 160
    or reason is null or length(reason) not between 8 and 1000 then
    raise exception 'Explicit refund direction, reason and stable key are required' using errcode='22023';
  end if;
  select * into request from public.rma_requests r where r.id=p_request_id for update;
  if request.id is null then raise exception 'RMA not found' using errcode='P0002'; end if;
  fingerprint:=md5(jsonb_build_object('reason',reason)::text);
  select * into execution from public.rma_action_executions e
    where e.rma_request_id=request.id and e.action='prepare_wallet_refund' and e.idempotency_key=key for update;
  if execution.id is not null then
    if execution.actor_id is distinct from actor or execution.payload_fingerprint is distinct from fingerprint then
      raise exception 'RMA preparation key conflicts with another operation' using errcode='23514';
    end if;
    if execution.execution_status='succeeded' then return request; end if;
    raise exception 'RMA preparation is already executing' using errcode='55P03';
  end if;
  if request.status is distinct from 'received' or request.received_at is null
    or request.quantity is null or request.quantity<1 or request.received_quantity is distinct from request.quantity
    or request.qc_status is null or request.qc_status not in ('passed','failed','not_required')
    or request.requested_resolution is null or request.requested_resolution not in ('replacement','refund','wallet_credit','credit_note')
    or request.resolution_action is not null or request.wallet_refund_request_id is not null
    or request.replacement_order_id is not null or request.replacement_reserved_order_id is not null
    or exists(select 1 from public.wallet_refund_requests w where w.rma_request_id=request.id)
    or exists(select 1 from public.rma_action_executions e where e.rma_request_id=request.id
      and e.action in ('request_wallet_refund','mark_replacement_sent','create_replacement_order','bind_replacement_order')
      and e.execution_status='succeeded') then
    raise exception 'Complete receipt and inspection without commercial processing are required' using errcode='23514';
  end if;
  if not coalesce(request.negotiation_status='none' or
    (request.negotiation_status='agreed' and request.negotiation_outcome='refund_wallet'),false) then
    raise exception 'Resolve the existing customer agreement before changing the refund direction' using errcode='23514';
  end if;
  if request.inventory_disposition is null or request.inventory_disposition not in ('quarantine','restock','scrap','supplier_return')
    or (request.inventory_disposition<>'quarantine' and request.inventory_disposition_quantity is distinct from request.quantity) then
    raise exception 'Inventory disposition must be complete or quarantined' using errcode='23514';
  end if;
  if request.refund_currency is not null and request.refund_currency<>'EUR' then
    raise exception 'Only EUR wallet refunds are supported' using errcode='23514';
  end if;
  select * into line from public.order_lines l where l.id=request.order_line_id for update;
  select * into original from public.orders o where o.id=request.order_id for update;
  if line.id is null or original.id is null or request.customer_id is null or request.user_id is null
    or line.order_id is distinct from original.id or line.sku_code is distinct from request.sku_code
    or original.customer_id is distinct from request.customer_id or original.user_id is distinct from request.user_id
    or original.order_no is distinct from request.order_no or original.payment_status is distinct from 'paid'
    or line.unit_price is null or line.unit_price<=0 then
    raise exception 'The original paid order line and customer could not be verified' using errcode='23514';
  end if;
  if request.unit_price_snapshot is null and
    (request.refund_pricing_snapshot is not null or coalesce(request.order_line_snapshot,'{}'::jsonb)<>'{}'::jsonb) then
    raise exception 'Conflicting historical pricing evidence requires manual financial review' using errcode='23514';
  end if;
  unit_amount:=coalesce(request.unit_price_snapshot,line.unit_price);
  -- Validates original order subtotal, tax, line quantity and immutable unit price.
  pricing:=private.rma_v4_pricing_snapshot(line.id,unit_amount);
  if request.refund_pricing_snapshot is not null then
    foreach evidence_key in array array['version','order_id','order_line_id','unit_amount',
      'line_quantity','line_net_amount','line_tax_amount','amount_basis'] loop
      if request.refund_pricing_snapshot->evidence_key is distinct from pricing->evidence_key then
        raise exception 'Historical financial snapshot conflicts with the original paid order' using errcode='23514';
      end if;
    end loop;
  end if;
  if coalesce(request.order_line_snapshot,'{}'::jsonb)<>'{}'::jsonb then
    if jsonb_typeof(request.order_line_snapshot) is distinct from 'object'
      or (request.order_line_snapshot ? 'id' and request.order_line_snapshot->>'id' is distinct from line.id::text)
      or (request.order_line_snapshot ? 'order_line_id' and request.order_line_snapshot->>'order_line_id' is distinct from line.id::text)
      or (request.order_line_snapshot ? 'order_id' and request.order_line_snapshot->>'order_id' is distinct from original.id::text)
      or (request.order_line_snapshot ? 'order_no' and request.order_line_snapshot->>'order_no' is distinct from original.order_no)
      or (request.order_line_snapshot ? 'sku_code' and request.order_line_snapshot->>'sku_code' is distinct from line.sku_code)
      or (request.order_line_snapshot ? 'quantity' and (request.order_line_snapshot->>'quantity')::numeric is distinct from line.quantity::numeric)
      or (request.order_line_snapshot ? 'unit_price' and (request.order_line_snapshot->>'unit_price')::numeric is distinct from line.unit_price) then
      raise exception 'Historical order line snapshot conflicts with the original paid order' using errcode='23514';
    end if;
  end if;
  old_resolution:=request.requested_resolution;
  insert into public.rma_action_executions(rma_request_id,action,idempotency_key,payload_fingerprint,actor_id)
    values(request.id,'prepare_wallet_refund',key,fingerprint,actor) returning * into execution;
  update public.rma_requests r set
    unit_price_snapshot=coalesce(r.unit_price_snapshot,unit_amount),
    order_line_snapshot=case when coalesce(r.order_line_snapshot,'{}'::jsonb)='{}'::jsonb then
      jsonb_build_object('order_id',original.id,'order_line_id',line.id,'order_no',original.order_no,
        'sku_code',line.sku_code,'quantity',line.quantity,'unit_price',line.unit_price,
        'source','original_paid_order_line') else r.order_line_snapshot end,
    refund_pricing_snapshot=coalesce(r.refund_pricing_snapshot,pricing||jsonb_build_object(
      'verification_reason',reason,'verification_source','admin_prepare_rma_wallet_refund_v1')),
    requested_resolution='wallet_credit',updated_at=now()
    where r.id=request.id returning * into result;
  select max_refund_amount into cap from public.admin_rma_refund_preview_v4(result.id) where available and currency='EUR';
  if cap is null or cap<=0 then
    raise exception 'Original order has no verified refundable wallet amount' using errcode='23514';
  end if;
  insert into public.rma_request_events(rma_request_id,actor_id,event_type,from_status,to_status,
    note,metadata,customer_visible,source_action,idempotency_key,rma_action_execution_id)
  values(result.id,actor,'note_added',request.status,result.status,reason,
    jsonb_build_object('source','staff_directed_wallet_refund','previous_resolution',old_resolution,
      'new_resolution','wallet_credit','price_source','original_paid_order_line','max_refund_amount',cap,
      'stock_disposition_preserved',request.inventory_disposition,'customer_agreement_recorded',false),
    false,'prepare_wallet_refund',key,execution.id);
  update public.rma_action_executions e set execution_status='succeeded',
    result=jsonb_build_object('rma_request_id',result.id,'requested_resolution','wallet_credit','max_refund_amount',cap),
    updated_at=now() where e.id=execution.id;
  return result;
end;
$function$;
revoke all on function public.admin_prepare_rma_wallet_refund_v1(uuid,text,text) from public,anon;
grant execute on function public.admin_prepare_rma_wallet_refund_v1(uuid,text,text) to authenticated;
comment on function public.admin_prepare_rma_wallet_refund_v1(uuid,text,text)
  is 'Authorized financial preparation only: canonical original pricing and explicit staff wallet direction; approval and credit stay separate.';
