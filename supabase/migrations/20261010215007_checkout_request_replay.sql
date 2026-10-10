-- Additive checkout receipts. The existing authoritative stock/preorder RPCs
-- continue to enforce prices, availability, profile, wallet and membership.
create table private.checkout_submissions (
  actor_user_id uuid not null references auth.users(id),
  request_id uuid not null,
  customer_id uuid not null references public.customers(id),
  intent_hash text not null,
  order_id uuid not null references public.orders(id),
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_user_id,request_id)
);
alter table private.checkout_submissions enable row level security;
revoke all on private.checkout_submissions from public,anon,authenticated;

create table private.checkout_cancellations (
  actor_user_id uuid not null references auth.users(id), request_id uuid not null,
  customer_id uuid not null references public.customers(id), intent_hash text not null,
  created_at timestamptz not null default now(), primary key(actor_user_id,request_id)
);
alter table private.checkout_cancellations enable row level security;
revoke all on private.checkout_cancellations from public,anon,authenticated;

create function private.checkout_assert_customer(p_customer_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists (
    select 1 from public.customers c where c.id=p_customer_id and (
      c.user_id=auth.uid() or exists(select 1 from public.customer_memberships cm where cm.customer_id=c.id and cm.user_id=auth.uid() and cm.status='active')
      or (private.partspro_has_permission('orders.manage') and private.partspro_has_permission('customers.read'))
    )
  ) then raise exception 'Customer access denied' using errcode='42501'; end if;
end; $$;
revoke all on function private.checkout_assert_customer(uuid) from public,anon,authenticated;

create function public.checkout_submission_result(p_request_id uuid,p_intent jsonb default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_saved private.checkout_submissions%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_saved from private.checkout_submissions where actor_user_id=v_actor and request_id=p_request_id;
  if found then
    perform private.checkout_assert_customer(v_saved.customer_id);
    if p_intent is not null and v_saved.intent_hash <> pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_intent::text,'UTF8')),'hex') then
      raise exception 'Request details conflict' using errcode='22023';
    end if;
    return jsonb_build_object('state','created','data',v_saved.receipt,'replayed',true);
  end if;
  -- Absence alone is not proof of failure: another transaction may still run.
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_request_id::text,0)) then
    return jsonb_build_object('state','pending');
  end if;
  if exists(select 1 from private.checkout_cancellations where actor_user_id=v_actor and request_id=p_request_id) then return jsonb_build_object('state','cancelled'); end if;
  return jsonb_build_object('state','not_found');
end; $$;
revoke all on function public.checkout_submission_result(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.checkout_submission_result(uuid,jsonb) to authenticated;

create function public.create_checkout_order_once(p_request_id uuid,p_intent jsonb,p_kind text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=auth.uid(); v_customer uuid; v_hash text; v_saved private.checkout_submissions%rowtype;
  v_order_id uuid; v_order public.orders%rowtype; v_receipt jsonb; v_total numeric;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_request_id is null or jsonb_typeof(p_intent) is distinct from 'object' or jsonb_typeof(p_payload) is distinct from 'object' or p_kind is null or p_kind not in ('stock','preorder') then
    raise exception 'Invalid request' using errcode='22023';
  end if;
  v_customer:=(p_payload->>'p_customer_id')::uuid;
  if v_customer::text is distinct from p_intent->>'companyId' then raise exception 'Customer mismatch' using errcode='22023'; end if;
  perform private.checkout_assert_customer(v_customer);
  v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_intent::text,'UTF8')),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_request_id::text,0));
  select * into v_saved from private.checkout_submissions where actor_user_id=v_actor and request_id=p_request_id;
  if found then
    if v_saved.customer_id is distinct from v_customer or v_saved.intent_hash is distinct from v_hash then raise exception 'Request details conflict' using errcode='22023'; end if;
    return jsonb_build_object('state','created','data',v_saved.receipt,'replayed',true);
  end if;
  if exists(select 1 from private.checkout_cancellations where actor_user_id=v_actor and request_id=p_request_id) then raise exception 'Submission cancelled' using errcode='P0002'; end if;
  if jsonb_typeof(p_intent->'items') is distinct from 'array' or jsonb_typeof(p_payload->'p_lines') is distinct from 'array' then raise exception 'Invalid lines' using errcode='22023'; end if;
  if (select jsonb_agg(jsonb_build_object('sku',x->>'sku','qty',x->>'quantity') order by x->>'sku',x->>'quantity') from jsonb_array_elements(p_intent->'items') x)
    is distinct from (select jsonb_agg(jsonb_build_object('sku',x->>'sku_code','qty',x->>'quantity') order by x->>'sku_code',x->>'quantity') from jsonb_array_elements(p_payload->'p_lines') x) then
    raise exception 'Lines mismatch' using errcode='22023';
  end if;
  if p_kind='preorder' then
    if coalesce((p_intent->>'preorderTermsAccepted')::boolean,false) is not true then raise exception 'Terms required' using errcode='22023'; end if;
    v_order_id:=public.create_preorder_transaction(p_payload->'p_lines',v_customer,p_payload->>'p_delivery_address',p_payload->>'p_customer_note',p_payload->>'p_shipping_method',(p_payload->>'p_shipping')::numeric,p_payload->'p_fiscal',true);
  else
    v_order_id:=public.create_order_transaction(p_payload->'p_lines',v_customer,p_payload->>'p_delivery_address',p_payload->>'p_customer_note',p_payload->>'p_shipping_method',(p_payload->>'p_shipping')::numeric,p_payload->'p_fiscal',0);
  end if;
  select * into strict v_order from public.orders where id=v_order_id;
  v_total:=v_order.total_net+v_order.vat+v_order.shipping;
  v_receipt:=jsonb_build_object('id',v_order.order_no,'orderNo',v_order.order_no,'status',v_order.status,'createdAt',v_order.created_at,
    'orderKind',p_kind,'walletAppliedAmount',coalesce(v_order.wallet_applied_amount,0),'payableAmount',greatest(0,v_total-coalesce(v_order.wallet_applied_amount,0)),
    'lines',(select coalesce(jsonb_agg(jsonb_build_object('sku',l.sku_code,'quantity',l.quantity,'lineGross',jsonb_build_object('amount',round(l.unit_price*l.quantity,2)::text,'cents',round(l.unit_price*l.quantity*100)::bigint,'currency','EUR')) order by l.id),'[]'::jsonb) from public.order_lines l where l.order_id=v_order_id),'totals',jsonb_build_object(
      'subtotal',jsonb_build_object('amount',v_order.total_net::text,'cents',round(v_order.total_net*100)::bigint,'currency','EUR'),
      'vat',jsonb_build_object('amount',v_order.vat::text,'cents',round(v_order.vat*100)::bigint,'currency','EUR'),
      'shipping',jsonb_build_object('amount',v_order.shipping::text,'cents',round(v_order.shipping*100)::bigint,'currency','EUR'),
      'total',jsonb_build_object('amount',v_total::text,'cents',round(v_total*100)::bigint,'currency','EUR')));
  insert into private.checkout_submissions(actor_user_id,request_id,customer_id,intent_hash,order_id,receipt) values(v_actor,p_request_id,v_customer,v_hash,v_order_id,v_receipt);
  return jsonb_build_object('state','created','data',v_receipt,'replayed',false);
end; $$;
revoke all on function public.create_checkout_order_once(uuid,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_checkout_order_once(uuid,jsonb,text,jsonb) to authenticated;
comment on table private.checkout_submissions is 'Actor-scoped atomic order receipts; no raw checkout intent or address stored';

-- A terminal stop marker is committed under the same actor/request lock.
-- This also blocks an original HTTP request still in its API preflight.
create function public.cancel_checkout_submission(p_request_id uuid,p_intent jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid();v_customer uuid;v_hash text;v_saved private.checkout_submissions%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='42501';end if;
  if p_request_id is null or jsonb_typeof(p_intent) is distinct from 'object' then raise exception 'Invalid intent' using errcode='22023';end if;
  v_customer:=(p_intent->>'companyId')::uuid;perform private.checkout_assert_customer(v_customer);
  v_hash:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_intent::text,'UTF8')),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_request_id::text,0));
  select * into v_saved from private.checkout_submissions where actor_user_id=v_actor and request_id=p_request_id;
  if found then
    if v_saved.intent_hash is distinct from v_hash then raise exception 'Request details conflict' using errcode='22023';end if;
    return jsonb_build_object('state','created','data',v_saved.receipt,'replayed',true);
  end if;
  insert into private.checkout_cancellations(actor_user_id,request_id,customer_id,intent_hash) values(v_actor,p_request_id,v_customer,v_hash) on conflict(actor_user_id,request_id) do nothing;
  return jsonb_build_object('state','cancelled');
end; $$;
revoke all on function public.cancel_checkout_submission(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.cancel_checkout_submission(uuid,jsonb) to authenticated;
