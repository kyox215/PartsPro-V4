-- Synthetic transaction-only integration cases. Run only through the isolated
-- scripts/rma-v4-db-test.mjs harness. All test data rolls back.
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'ASSERT FAILED: %',label; end if; end $$;
create function pg_temp.expect_error(command text,label text) returns void language plpgsql as $$ declare failed boolean:=false; begin begin execute command; exception when others then failed:=true; end; if not failed then raise exception 'EXPECTED FAILURE: %',label; end if; end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into auth.users(id,email) values('10000000-0000-4000-8000-000000000001','staff@example.invalid'),('10000000-0000-4000-8000-000000000002','customer@example.invalid');
update public.profiles set role='admin',account_type='employee',role_template='admin' where id=auth.uid();
insert into public.customers(id,company_name,status,customer_type,assignment_status) values('20000000-0000-4000-8000-000000000001','Synthetic RMA customer','active','wholesale','assigned');
insert into public.products(sku_code,name,category,status,stock_status,stock_qty,retail_price,b2b_price) values('RMA-V4-SYNTHETIC','Synthetic item','screen','active','in_stock',100,10,10);
create function pg_temp.make_rma(q integer default 1,qc text default 'passed',resolution text default 'wallet_credit',state text default 'received',tax numeric default 0)
returns uuid language plpgsql as $$ declare oid uuid; lid uuid; rid uuid; begin
 insert into public.orders(order_no,customer_id,customer_name,status,payment_status,total_net,vat,shipping,payment_received_amount,delivery_address)
 values('TEST-'||gen_random_uuid(),'20000000-0000-4000-8000-000000000001','Synthetic RMA customer','shipped','paid',q*10,tax,0,q*10+tax,'Synthetic address') returning id into oid;
 insert into public.order_lines(order_id,sku_code,product_name,quantity,unit_price,fulfilled_qty) values(oid,'RMA-V4-SYNTHETIC','Synthetic item',q,10,q) returning id into lid;
 insert into public.rma_requests(rma_no,user_id,customer_id,order_id,order_no,order_line_id,sku_code,quantity,status,requested_resolution,unit_price_snapshot,order_line_snapshot,qc_status,received_at,received_quantity,inventory_disposition)
 values('TEST-RMA-'||gen_random_uuid(),'10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',oid,(select order_no from public.orders where id=oid),lid,'RMA-V4-SYNTHETIC',q,state,resolution,10,jsonb_build_object('id',lid,'unit_price',10,'quantity',q),qc,case when state='received' then now() end,case when state='received' then q end,case when state='received' then 'quarantine' else 'pending' end) returning id into rid;
 return rid;
end $$;
do $$ declare r uuid; c uuid; o uuid; result public.rma_requests%rowtype; preview record; before_qty integer; ids uuid[]; x uuid; reverse_approval boolean; begin
 perform pg_temp.assert_true(not has_function_privilege('anon','public.admin_perform_rma_action_v4(uuid,text,jsonb,text)','EXECUTE'),'anonymous v4 RPC revoked');
 perform pg_temp.assert_true(not has_function_privilege('authenticated','private.rma_v4_pricing_snapshot(uuid,numeric)','EXECUTE'),'private money helper revoked');
 perform set_config('request.jwt.claim.sub','',true);
 perform pg_temp.expect_error('select public.admin_perform_rma_action_v4(gen_random_uuid(),''split_request'',''{"quantity":1}'',''unauthenticated'')','RPC requires authenticated user');
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
 r:=pg_temp.make_rma(1,'failed');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v3(%L,''restock_return'',p_batch_code=>''TEST'',p_location=>''TEST'',p_idempotency_key=>''bad-qc-restock'')',r),'legacy RPC rejects failed QC restock');
 r:=pg_temp.make_rma(1,'not_required');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v4(%L,''restock_return'',''{"batch_code":"TEST","location":"TEST"}'',''skip-qc-restock'')',r),'QC exemption cannot enter saleable stock');
 r:=pg_temp.make_rma(3,'pending','wallet_credit','approved');
 perform public.admin_perform_rma_action_v4(r,'split_request','{"quantity":2}','split-before-receipt');
 select id into c from public.rma_requests where parent_request_id=r;
 perform pg_temp.assert_true((select quantity from public.rma_requests where id=r)=2 and (select quantity from public.rma_requests where id=c)=1,'split conserves requested quantity');
 perform public.admin_perform_rma_action_v4(r,'split_request','{"quantity":2}','split-before-receipt');
 perform pg_temp.assert_true((select count(*) from public.rma_requests where parent_request_id=r)=1,'split retry creates no duplicate child');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v4(%L,''split_request'',''{"quantity":1}'',''split-before-receipt'')',r),'idempotency conflicts rejected');
 perform public.admin_perform_rma_action_v4(c,'cancel_unreceived','{"reason":"Customer cannot return remaining item","customer_confirmation":"Customer confirmed cancellation via ticket TEST"}','cancel-child');
 perform pg_temp.assert_true((select status from public.rma_requests where id=c)='rejected','unreceived remainder can be cancelled');
 r:=pg_temp.make_rma(3,'pending');
 perform public.admin_perform_rma_action_v4(r,'split_request','{"quantity":1}','split-after-receipt');
 perform pg_temp.assert_true((select sum(received_quantity) from public.rma_requests where id=r or parent_request_id=r)=3,'received split preserves receipt quantity');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v4(%L,''cancel_unreceived'',''{"reason":"test","customer_confirmation":"customer agreed"}'',''cancel-received'')',r),'received goods cannot be cancelled');
 r:=pg_temp.make_rma(1,'failed','replacement');
 perform public.admin_perform_rma_action_v4(r,'start_negotiation','{"reason":"Warranty damage disputed"}','negotiate-return');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v3(%L,''mark_scrapped'',p_batch_code=>''TEST'',p_location=>''TEST'',p_idempotency_key=>''scrap-during-negotiation'')',r),'pending negotiation blocks legacy disposition');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v4(%L,''resolve_negotiation'',''{"outcome":"return_to_customer","customer_confirmation":"yes"}'',''bad-agreement'')',r),'short confirmation rejected');
 perform public.admin_perform_rma_action_v4(r,'resolve_negotiation','{"outcome":"return_to_customer","customer_confirmation":"Customer agreed in ticket TEST"}','agree-return');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v4(%L,''create_replacement_order'',''{}'',''wrong-agreed-replacement'')',r),'agreed original return cannot create a replacement order');
 insert into public.admin_user_permission_overrides(user_id,permission_id,effect) values(auth.uid(),'rma.manage','deny'),(auth.uid(),'orders.manage','deny');
 perform pg_temp.assert_true(not private.partspro_has_permission('rma.manage') and private.partspro_has_permission('rma.inventory'),'warehouse-only permission fixture');
 perform public.admin_perform_rma_action_v4(r,'return_to_customer','{"tracking_number":"TEST-TRACK","carrier":"TEST","location":"TEST","reason":"Dispatch receipt TEST"}','dispatch-return');
 delete from public.admin_user_permission_overrides where user_id=auth.uid();
 perform public.admin_perform_rma_action_v4(r,'close','{}','close-return');
 perform public.admin_perform_rma_action_v4(r,'close','{}','close-return-new-key');
 perform pg_temp.assert_true((select count(*) from public.notification_events where rma_request_id=r and source_action='return_to_customer')=1,'dispatch notifies the customer once');
 perform pg_temp.assert_true((select status='closed' and inventory_disposition='returned_to_customer' and refund_amount=0 from public.rma_requests where id=r),'return without refund closes');
 r:=pg_temp.make_rma(1,'failed');
 perform public.admin_perform_rma_action_v4(r,'start_negotiation','{"reason":"No warranty coverage"}','negotiate-scrap');
 perform public.admin_perform_rma_action_v4(r,'resolve_negotiation','{"outcome":"scrap_without_refund","customer_confirmation":"Customer authorised disposal in ticket TEST"}','agree-scrap');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v4(%L,''close'',''{}'',''close-before-scrap'')',r),'agreement alone cannot close');
 perform public.admin_perform_rma_action_v4(r,'mark_scrapped','{"batch_code":"TEST","location":"TEST"}','scrap-agreed');
 perform public.admin_perform_rma_action_v4(r,'close','{}','close-scrapped');
 perform pg_temp.assert_true((select exists(select 1 from public.rma_request_events where rma_request_id=r and source_action='resolve_negotiation' and customer_visible and metadata->>'customer_visible'='true')),'negotiation timeline has safe visibility marker');
 perform pg_temp.assert_true((select status='closed' and inventory_disposition='scrap' from public.rma_requests where id=r),'scrap without refund closes after disposal');
 r:=pg_temp.make_rma(3,'passed','wallet_credit','received',6.60);
 select * into preview from public.admin_rma_refund_preview_v4(r);
 perform pg_temp.assert_true(preview.available and preview.max_refund_amount=36.60 and preview.net_amount=30 and preview.tax_amount=6.60,'original recorded tax included exactly once');
 perform public.admin_perform_rma_action_v4(r,'request_wallet_refund','{"refund_amount":36.6,"quantity":null,"assigned_to":null,"replacement_order_id":null,"qc_status":null,"customer_visible_note":null}','request-tax-refund');
 perform pg_temp.assert_true((select refund_gross_amount=36.60 and refund_net_amount=30 and refund_tax_amount=6.60 from public.rma_requests where id=r),'gross request preserves net and tax');
 perform public.admin_approve_wallet_refund_request((select wallet_refund_request_id from public.rma_requests where id=r),'Synthetic approval');
 perform public.admin_approve_wallet_refund_request((select wallet_refund_request_id from public.rma_requests where id=r),'Synthetic approval retry');
 perform pg_temp.assert_true((select status='refunded' and refund_gross_amount=36.60 and refund_net_amount=30 and refund_tax_amount=6.60 from public.rma_requests where id=r),'real wallet approval preserves split amounts');
 perform pg_temp.assert_true((select count(*) from public.customer_wallet_transactions where order_id=(select order_id from public.rma_requests where id=r) and direction='credit')=1,'wallet approval retry credits once');
 select stock_qty into before_qty from public.products where sku_code='RMA-V4-SYNTHETIC';
 perform public.admin_perform_rma_action_v4(r,'restock_return','{"batch_code":"RMA-TEST","location":"TEST-SHELF"}','restock-approved-refund');
 perform public.admin_perform_rma_action_v4(r,'close','{}','close-approved-refund');
 perform pg_temp.assert_true((select status='closed' and inventory_disposition='restock' from public.rma_requests where id=r),'refund and passed inventory complete closure');
 perform pg_temp.assert_true((select stock_qty from public.products where sku_code='RMA-V4-SYNTHETIC')=before_qty+3,'restock adds approved quantity exactly once');
 perform public.admin_perform_rma_action_v4(r,'restock_return','{"batch_code":"RMA-TEST","location":"TEST-SHELF"}','restock-approved-refund');
 perform pg_temp.assert_true((select stock_qty from public.products where sku_code='RMA-V4-SYNTHETIC')=before_qty+3,'restock retry does not add stock');
 r:=pg_temp.make_rma();
 select * into preview from public.admin_rma_refund_preview_v4(r);
 perform pg_temp.assert_true(preview.max_refund_amount=10 and preview.tax_amount=0,'tax-included checkout does not gain invented VAT');
 update public.rma_requests set refund_pricing_snapshot=null where id=r;
 select * into preview from public.admin_rma_refund_preview_v4(r);
 perform pg_temp.assert_true(not preview.available and preview.blocked_reason='missing_pricing_snapshot','missing snapshot fails closed');
 perform public.admin_perform_rma_action_v4(r,'verify_refund_snapshot','{"reason":"Original invoice TEST compared with frozen line snapshot"}','verify-historical');
 select * into preview from public.admin_rma_refund_preview_v4(r);
 perform pg_temp.assert_true(preview.available,'verified historical financial evidence reopens preview');
 r:=pg_temp.make_rma(1,'passed','wallet_credit','received',2.20);
 perform public.admin_perform_rma_action_v4(r,'request_wallet_refund','{"refund_amount":10}','legacy-pending-refund');
 update public.rma_requests set refund_pricing_snapshot=null,refund_gross_amount=null,refund_tax_amount=null,refund_net_amount=10 where id=r;
 perform public.admin_approve_wallet_refund_request((select wallet_refund_request_id from public.rma_requests where id=r),'Approve pre-migration net request');
 perform pg_temp.assert_true((select status='refunded' and refund_amount=10 and refund_net_amount=10 and refund_tax_amount=0 from public.rma_requests where id=r),'pre-migration pending requests retain their old approved amount and cap');
 r:=pg_temp.make_rma(3,'pending','wallet_credit','received',0.01);
 perform public.admin_perform_rma_action_v4(r,'split_request','{"quantity":1}','rounding-split-one');
 select id into c from public.rma_requests where parent_request_id=r;
 perform public.admin_perform_rma_action_v4(c,'split_request','{"quantity":1}','rounding-split-two');
 select array_agg(id order by created_at,id) into ids from public.rma_requests where order_line_id=(select order_line_id from public.rma_requests where id=r);
 foreach x in array ids loop
   perform public.admin_perform_rma_action_v4(x,'record_qc','{"qc_status":"passed","qc_note":"Synthetic inspection"}','qc-'||x);
   select * into preview from public.admin_rma_refund_preview_v4(x);
   perform public.admin_perform_rma_action_v4(x,'request_wallet_refund',jsonb_build_object('refund_amount',preview.max_refund_amount),'rounding-refund-'||x);
 end loop;
 perform pg_temp.assert_true((select sum(refund_gross_amount) from public.rma_requests where id=any(ids))=30.01,'pending split requests allocate the final tax cent exactly once');
 for x in select unnest(ids) order by 1 desc loop
   perform public.admin_approve_wallet_refund_request((select wallet_refund_request_id from public.rma_requests where id=x),'Out-of-order approval');
 end loop;
 perform pg_temp.assert_true((select sum(refund_tax_amount)=0.01 and sum(refund_gross_amount)=30.01 from public.rma_requests where id=any(ids)),'out-of-order approvals preserve total tax and gross');
 -- Negotiated reductions consume their original allocation, never donate
 -- unrefunded tax to another item. Approval order cannot change the basis.
 foreach reverse_approval in array array[false,true] loop
   r:=pg_temp.make_rma(2,'pending','wallet_credit','received',4.40);
   perform public.admin_perform_rma_action_v4(r,'split_request','{"quantity":1}','partial-price-split');
   select id into c from public.rma_requests where parent_request_id=r;
   foreach x in array array[r,c] loop
     perform public.admin_perform_rma_action_v4(x,'record_qc','{"qc_status":"passed","qc_note":"Synthetic inspection"}','partial-qc-'||x);
   end loop;
   perform public.admin_perform_rma_action_v4(r,'request_wallet_refund','{"refund_amount":6.10}','partial-first-refund');
   select * into preview from public.admin_rma_refund_preview_v4(c);
   perform pg_temp.assert_true(preview.max_refund_amount=12.20 and preview.tax_amount=2.20,'partial refund cannot inflate next item gross or tax');
   perform public.admin_perform_rma_action_v4(c,'request_wallet_refund','{"refund_amount":12.20}','full-second-refund');
   perform pg_temp.assert_true((select refund_allocated_tax_amount=2.20 and refund_net_amount=5 and refund_tax_amount=1.10 from public.rma_requests where id=r),'partial refund freezes full original tax basis');
   ids:=case when reverse_approval then array[c,r] else array[r,c] end;
   foreach x in array ids loop
     perform public.admin_approve_wallet_refund_request((select wallet_refund_request_id from public.rma_requests where id=x),'Partial/full ordered approval');
   end loop;
   perform pg_temp.assert_true((select refund_gross_amount=6.10 and refund_net_amount=5 and refund_tax_amount=1.10 and refund_allocated_tax_amount=2.20 from public.rma_requests where id=r),'partial net and tax remain stable for either approval order');
   perform pg_temp.assert_true((select refund_gross_amount=12.20 and refund_net_amount=10 and refund_tax_amount=2.20 and refund_allocated_tax_amount=2.20 from public.rma_requests where id=c),'full net and tax remain stable for either approval order');
 end loop;
 -- A rejected wallet attempt retains its quantity allocation; retrying it
 -- must neither steal nor lose the cent reserved by another split request.
 r:=pg_temp.make_rma(3,'pending','wallet_credit','received',0.01);
 perform public.admin_perform_rma_action_v4(r,'split_request','{"quantity":1}','rejected-rounding-split-one');
 select id into c from public.rma_requests where parent_request_id=r;
 perform public.admin_perform_rma_action_v4(c,'split_request','{"quantity":1}','rejected-rounding-split-two');
 select array_agg(id order by case when id=r then 0 else 1 end,id) into ids from public.rma_requests where order_line_id=(select order_line_id from public.rma_requests where id=r);
 foreach x in array ids loop
   perform public.admin_perform_rma_action_v4(x,'record_qc','{"qc_status":"passed","qc_note":"Synthetic inspection"}','rejected-qc-'||x);
   select * into preview from public.admin_rma_refund_preview_v4(x);
   perform public.admin_perform_rma_action_v4(x,'request_wallet_refund',jsonb_build_object('refund_amount',preview.max_refund_amount),'rejected-rounding-'||x);
   if x=r then update public.wallet_refund_requests set status='rejected' where id=(select wallet_refund_request_id from public.rma_requests where id=r); end if;
 end loop;
 select * into preview from public.admin_rma_refund_preview_v4(r);
 perform public.admin_perform_rma_action_v4(r,'request_wallet_refund',jsonb_build_object('refund_amount',preview.max_refund_amount),'rejected-rounding-retry');
 foreach x in array ids loop
   perform public.admin_approve_wallet_refund_request((select wallet_refund_request_id from public.rma_requests where id=x),'Rejected retry approval');
 end loop;
 perform pg_temp.assert_true((select sum(refund_allocated_tax_amount)=0.01 and sum(refund_tax_amount)=0.01 and sum(refund_gross_amount)=30.01 from public.rma_requests where id=any(ids)),'rejected retry preserves one final tax cent exactly once');
 r:=pg_temp.make_rma(1,'passed','replacement');
 select order_id into o from public.rma_requests where id=r;
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v3(%L,''mark_replacement_sent'',p_replacement_order_id=>%L,p_idempotency_key=>''old-normal-order'')',r,o),'ordinary shipped order cannot prove replacement');
 select stock_qty into before_qty from public.products where sku_code='RMA-V4-SYNTHETIC';
 result:=public.admin_perform_rma_action_v4(r,'create_replacement_order','{}','create-dedicated-order');
 perform pg_temp.assert_true(result.replacement_reserved_order_id is not null,'replacement order created');
 perform pg_temp.assert_true((select total_net=0 and vat=0 and shipping=0 and replacement_rma_request_id=r from public.orders where id=result.replacement_reserved_order_id),'replacement has zero payable amount and provenance');
 perform pg_temp.assert_true((select sum(reserved_qty) from public.order_lines where order_id=result.replacement_reserved_order_id)=1,'replacement reserves real stock');
 result:=public.admin_perform_rma_action_v4(r,'create_replacement_order','{}','create-dedicated-order');
 perform pg_temp.assert_true((select count(*) from public.orders where replacement_rma_request_id=r)=1,'retry creates no duplicate order');
 perform pg_temp.expect_error(format('select public.admin_perform_rma_action_v4(%L,''release_cancelled_replacement'',''{}'',''release-active-order'')',r),'active reserved replacement cannot be released');
 o:=result.replacement_reserved_order_id;
 perform public.admin_transition_order_status(o,'cancelled','Synthetic replacement cancellation');
 perform public.admin_perform_rma_action_v4(r,'release_cancelled_replacement','{}','release-cancelled-order');
 perform pg_temp.assert_true((select replacement_reserved_order_id is null from public.rma_requests where id=r),'cancelled replacement releases RMA reservation');
 result:=public.admin_perform_rma_action_v4(r,'create_replacement_order','{}','create-second-dedicated-order');
 perform pg_temp.assert_true(result.replacement_reserved_order_id<>o,'new dedicated replacement created after cancelled one');
 perform public.admin_perform_rma_action_v4(r,'release_cancelled_replacement','{}','release-cancelled-order');
 perform pg_temp.assert_true((select replacement_reserved_order_id=result.replacement_reserved_order_id from public.rma_requests where id=r),'old release retry cannot clear the new replacement');
 perform pg_temp.assert_true((select replacement_rma_request_id=r and status='cancelled' from public.orders where id=o),'cancelled original retains audit provenance');
 perform pg_temp.assert_true((select sum(reserved_qty) from public.order_lines where order_id=result.replacement_reserved_order_id)=1,'reopened replacement reserves its own stock once');
 raise notice 'RMA v4 integration assertions passed';
end $$;
rollback;
