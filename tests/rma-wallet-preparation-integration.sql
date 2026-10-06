-- Run via RMA_V4_FIXTURE=tests/rma-v4-database-integration.sql and
-- RMA_V4_EXTRA_FIXTURE=tests/rma-wallet-preparation-integration.sql with scripts/rma-v4-db-test.mjs.
-- Synthetic cases only. Use the customer automatically linked by the auth trigger.
-- Keep the existing shared fixture unchanged; canonical order/user identity is required here.
create function pg_temp.make_preparable_rma(qc text default 'passed')
returns uuid language plpgsql as $f$
declare cid uuid; oid uuid; lid uuid; rid uuid; ono text:='PREP-'||gen_random_uuid();
begin
 select id into strict cid from public.customers where user_id='10000000-0000-4000-8000-000000000002';
 insert into public.orders(order_no,customer_id,user_id,customer_name,status,payment_status,total_net,vat,shipping,payment_received_amount,delivery_address)
 values(ono,cid,'10000000-0000-4000-8000-000000000002','Synthetic canonical customer','shipped','paid',10,0,0,10,'Synthetic address') returning id into oid;
 insert into public.order_lines(order_id,sku_code,product_name,quantity,unit_price,fulfilled_qty)
 values(oid,'RMA-V4-SYNTHETIC','Synthetic item',1,10,1) returning id into lid;
 insert into public.rma_requests(rma_no,user_id,customer_id,order_id,order_no,order_line_id,sku_code,quantity,status,requested_resolution,unit_price_snapshot,order_line_snapshot,qc_status,received_at,received_quantity,inventory_disposition)
 values('PREP-RMA-'||gen_random_uuid(),'10000000-0000-4000-8000-000000000002',cid,oid,ono,lid,'RMA-V4-SYNTHETIC',1,'received','replacement',10,jsonb_build_object('id',lid,'unit_price',10,'quantity',1),qc,now(),1,'quarantine') returning id into rid;
 return rid;
end;
$f$;
create function pg_temp.expect_forbidden(command text,label text) returns void language plpgsql as $f$
begin
  begin execute command;
  exception when insufficient_privilege then return;
  end;
  raise exception 'EXPECTED 42501: %',label;
end;
$f$;
do $test$
declare rid uuid; rr public.rma_requests%rowtype; prepared public.rma_requests%rowtype;
  wid uuid; credit_count bigint; stock_count bigint; disposition text; source_price numeric;
begin
  perform pg_temp.assert_true(not has_function_privilege('anon',
    'public.admin_prepare_rma_wallet_refund_v1(uuid,text,text)','EXECUTE'),'anon cannot execute preparation');
  perform pg_temp.assert_true(has_function_privilege('authenticated',
    'public.admin_prepare_rma_wallet_refund_v1(uuid,text,text)','EXECUTE'),'authenticated capability available');
  foreach disposition in array array['restock','scrap','quarantine'] loop
    rid:=pg_temp.make_preparable_rma();
    update public.rma_requests set unit_price_snapshot=null,order_line_snapshot='{}',refund_pricing_snapshot=null,
      inventory_disposition=disposition,inventory_disposition_quantity=case when disposition='quarantine' then null else 1 end where id=rid;
    select * into rr from public.rma_requests where id=rid;
    select count(*) into credit_count from public.customer_wallet_transactions;
    select count(*) into stock_count from public.stock_movements;
    prepared:=public.admin_prepare_rma_wallet_refund_v1(rid,'Manager chooses a wallet refund',disposition||'-prepare-key');
    perform pg_temp.assert_true(prepared.requested_resolution='wallet_credit'
      and prepared.unit_price_snapshot=10 and prepared.refund_pricing_snapshot->>'version'='4','legacy original pricing and direction prepared');
    perform pg_temp.assert_true(prepared.inventory_disposition=disposition
      and prepared.inventory_disposition_quantity is not distinct from rr.inventory_disposition_quantity
      and prepared.received_at is not distinct from rr.received_at and prepared.qc_status=rr.qc_status
      and prepared.customer_confirmation is not distinct from rr.customer_confirmation,'physical and customer evidence preserved');
    perform pg_temp.assert_true((select count(*) from public.customer_wallet_transactions)=credit_count
      and (select count(*) from public.stock_movements)=stock_count,'preparation moves no money or stock');
    prepared:=public.admin_prepare_rma_wallet_refund_v1(rid,'Manager chooses a wallet refund',disposition||'-prepare-key');
    perform pg_temp.assert_true((select count(*) from public.rma_action_executions
      where rma_request_id=rid and action='prepare_wallet_refund')=1,'same key exactly once');
    perform pg_temp.expect_error(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
      rid,'Changed refund direction reason',disposition||'-prepare-key'),'different payload cannot reuse key');
    prepared:=public.admin_perform_rma_action_v4(rid,'request_wallet_refund','{"refund_amount":10}',disposition||'-request-key');
    wid:=prepared.wallet_refund_request_id;
    perform public.admin_approve_wallet_refund_request(wid,'Synthetic approval');
    if disposition<>'quarantine' then
      prepared:=public.admin_perform_rma_action_v4(rid,'close','{}',disposition||'-close-key');
      perform pg_temp.assert_true(prepared.status='closed' and prepared.inventory_disposition=disposition,'disposed return closes after exact credit');
    end if;
    perform pg_temp.assert_true((select count(*) from public.customer_wallet_transactions
      where metadata->>'wallet_refund_request_id'=wid::text)=1,'one real synthetic ledger credit');
    perform pg_temp.expect_error(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
      rid,'New preparation after commercial settlement',disposition||'-new-key'),'settled return cannot be prepared again');
  end loop;
  foreach disposition in array array['line_tax_amount','line_quantity'] loop
    rid:=pg_temp.make_preparable_rma();
    update public.rma_requests set refund_pricing_snapshot=jsonb_set(refund_pricing_snapshot,
      array[disposition],'999'::jsonb) where id=rid;
    select * into rr from public.rma_requests where id=rid;
    perform pg_temp.expect_error(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
      rid,'Conflicting historical financial snapshot',disposition||'-conflict'),'financial evidence conflict denied');
    perform pg_temp.assert_true((select requested_resolution=rr.requested_resolution
      and refund_pricing_snapshot=rr.refund_pricing_snapshot from public.rma_requests where id=rid)
      and not exists(select 1 from public.rma_action_executions where rma_request_id=rid),'conflicting preparation rolls back');
  end loop;
  rid:=pg_temp.make_preparable_rma();
  update public.rma_requests set order_line_snapshot=order_line_snapshot||'{"sku_code":"WRONG"}' where id=rid;
  perform pg_temp.expect_error(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
    rid,'Conflicting historical original line identity','line-conflict'),'historical line conflict denied');
  rid:=pg_temp.make_preparable_rma('pending');
  perform pg_temp.expect_error(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
    rid,'Receipt does not prove QC completion','pending-qc-prepare'),'QC required');
  update public.rma_requests set qc_status='passed',negotiation_status='pending' where id=rid;
  perform pg_temp.expect_error(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
    rid,'Cannot bypass customer negotiation','pending-agreement-prepare'),'agreement cannot be bypassed');
  update public.rma_requests set negotiation_status='none',unit_price_snapshot=11,refund_pricing_snapshot=null where id=rid;
  perform pg_temp.expect_error(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
    rid,'Cannot substitute a different original price','wrong-price-prepare'),'wrong immutable unit price denied');
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
  perform pg_temp.expect_forbidden(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
    rid,'Customer cannot prepare own wallet refund','customer-prepare'),'customer denied despite direct SQL access');
  perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
  update public.profiles set role='sales',role_template='sales' where id=auth.uid();
  perform pg_temp.expect_forbidden(format('select public.admin_prepare_rma_wallet_refund_v1(%L,%L,%L)',
    rid,'Staff without financial permissions cannot prepare','sales-prepare'),'financial manager permission required');
  update public.profiles set role='admin',role_template='admin' where id=auth.uid();
end;
$test$;
rollback;
