-- Run after fixture + migration in isolated Postgres only.
begin;
insert into public.customers(id,user_id,company_name,email,phone,fiscal_code,billing_address,shipping_address)
values('00000000-0000-0000-0000-000000000081',null,'Unclaimed','test@example.invalid','123','123','Test','Test');
select set_config('test.uid','00000000-0000-0000-0000-000000000082',true);
select set_config('test.permissions','',true);
select set_config('test.staff','false',true);
do $$ begin
 begin
  perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000081','[]');
  raise exception 'Unowned customer accepted without membership';
 exception when insufficient_privilege then null;
 end;
end $$;
insert into public.customer_memberships(customer_id,user_id,status) values('00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','active');
do $$ begin
 perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000081','[]');
end $$;
update public.customers set status=null where id='00000000-0000-0000-0000-000000000081';
do $$ begin
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000081','[]'); raise exception 'Null customer status accepted'; exception when insufficient_privilege then null; end;
end $$;
update public.customers set status='active',assignment_status=null where id='00000000-0000-0000-0000-000000000081';
do $$ begin
 begin perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000081','[]'); raise exception 'Null assignment status accepted'; exception when insufficient_privilege then null; end;
end $$;
update public.customers set assignment_status='assigned' where id='00000000-0000-0000-0000-000000000081';
update public.customer_memberships set status='inactive' where customer_id='00000000-0000-0000-0000-000000000081';
do $$ begin
 begin
  perform public.resolve_customer_product_quotes('00000000-0000-0000-0000-000000000081','[]');
  raise exception 'Inactive membership accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
