-- Reply, unread state, assignment and events commit together. Reusing the
-- message UUID acknowledges the original send without repeating its effects.
create function public.admin_send_support_message_atomic(
  p_conversation_id uuid,
  p_body text,
  p_message_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_conversation public.support_conversations%rowtype;
  v_message public.support_messages%rowtype;
  v_body text := btrim(p_body);
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_permission('support.reply');
  if p_message_id is null or v_body is null or length(v_body) not between 1 and 2000 then
    raise exception 'Valid send identifier and message required' using errcode='23514';
  end if;
  select * into v_conversation from public.support_conversations where id=p_conversation_id for update;
  if not found then raise exception 'Conversation not found' using errcode='P0002'; end if;
  select * into v_message from public.support_messages where id=p_message_id;
  if found then
    if v_message.conversation_id is distinct from p_conversation_id or v_message.sender_id is distinct from v_actor
      or v_message.sender_type is distinct from 'staff' or v_message.body is distinct from v_body then
      raise exception 'Send identifier conflict' using errcode='23505';
    end if;
    return jsonb_build_object('messageId',p_message_id,'conversationId',p_conversation_id,'created',false,'saved',true);
  end if;
  if v_conversation.status <> 'open' then raise exception 'Conversation is not open' using errcode='23514'; end if;
  insert into public.support_messages(id,conversation_id,sender_id,sender_type,body,created_at)
  values(p_message_id,p_conversation_id,v_actor,'staff',v_body,v_now);
  update public.support_conversations set
    customer_unread_count=customer_unread_count+1,
    last_message_at=greatest(coalesce(last_message_at,v_now),v_now),
    last_staff_message_at=v_now,staff_last_read_at=v_now,staff_unread_count=0,
    assigned_to=coalesce(assigned_to,v_actor),
    assigned_by=case when assigned_to is null then v_actor else assigned_by end,
    assigned_at=case when assigned_to is null then v_now else assigned_at end
  where id=p_conversation_id;
  if v_conversation.assigned_to is null then
    insert into public.support_conversation_events(conversation_id,actor_id,event_type,to_assignee,metadata)
    values(p_conversation_id,v_actor,'claimed',v_actor,jsonb_build_object('source','staff_reply','messageId',p_message_id));
  end if;
  insert into public.support_conversation_events(id,conversation_id,actor_id,event_type,metadata)
  values(p_message_id,p_conversation_id,v_actor,'staff_message',jsonb_build_object('messageId',p_message_id));
  return jsonb_build_object('messageId',p_message_id,'conversationId',p_conversation_id,'created',true,'saved',true);
end;
$$;
revoke all on function public.admin_send_support_message_atomic(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.admin_send_support_message_atomic(uuid,text,uuid) to authenticated;
comment on function public.admin_send_support_message_atomic(uuid,text,uuid) is 'Permission-checked atomic staff support reply with message UUID deduplication';

-- Administrative conversation state and its event have the same commit point.
create function public.admin_update_support_conversation_atomic(
  p_conversation_id uuid, p_action text, p_assigned_to uuid, p_note text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row public.support_conversations%rowtype;
  v_target uuid;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_permission('support.read');
  if p_action is null or p_action not in ('claim','assign','mark_read','resolve','reopen') then
    raise exception 'Unsupported action' using errcode='23514';
  end if;
  if p_action in ('claim','assign') then perform private.partspro_assert_permission('support.assign');
  elsif p_action in ('resolve','reopen') then perform private.partspro_assert_permission('support.resolve');
  elsif p_action <> 'mark_read' then raise exception 'Unsupported action' using errcode='23514'; end if;
  if length(coalesce(p_note,'')) > 1000 then raise exception 'Note too long' using errcode='23514'; end if;
  select * into v_row from public.support_conversations where id=p_conversation_id for update;
  if not found then raise exception 'Conversation not found' using errcode='P0002'; end if;
  if p_action in ('claim','assign') then
    v_target := case when p_action='claim' then v_actor else p_assigned_to end;
    if v_target is not null and not exists(select 1 from public.profiles p where p.id=v_target and p.account_type='employee') then
      raise exception 'Assignee must be an employee' using errcode='23514';
    end if;
    update public.support_conversations set assigned_to=v_target,
      assigned_by=case when v_target is null then null else v_actor end,
      assigned_at=case when v_target is null then null else v_now end where id=p_conversation_id;
    insert into public.support_conversation_events(conversation_id,actor_id,event_type,from_assignee,to_assignee,note)
    values(p_conversation_id,v_actor,case when p_action='claim' and v_row.assigned_to is null then 'claimed' else 'assigned' end,v_row.assigned_to,v_target,p_note);
  elsif p_action='mark_read' then
    update public.support_conversations set staff_last_read_at=v_now,staff_unread_count=0 where id=p_conversation_id;
    insert into public.support_conversation_events(conversation_id,actor_id,event_type,metadata)
    values(p_conversation_id,v_actor,'read',jsonb_build_object('side','staff'));
  elsif p_action='resolve' then
    if v_row.status <> 'open' then raise exception 'Conversation is not open' using errcode='23514'; end if;
    update public.support_conversations set resolved_at=v_now,resolved_by=v_actor,status='resolved' where id=p_conversation_id;
    insert into public.support_conversation_events(conversation_id,actor_id,event_type,from_status,to_status,note)
    values(p_conversation_id,v_actor,'resolved',v_row.status,'resolved',p_note);
  elsif p_action='reopen' then
    if v_row.status <> 'resolved' then raise exception 'Conversation is not resolved' using errcode='23514'; end if;
    update public.support_conversations set reopened_at=v_now,resolved_at=null,resolved_by=null,status='open' where id=p_conversation_id;
    insert into public.support_conversation_events(conversation_id,actor_id,event_type,from_status,to_status,note)
    values(p_conversation_id,v_actor,'reopened',v_row.status,'open',p_note);
  end if;
  return jsonb_build_object('saved',true,'conversationId',p_conversation_id);
end;
$$;
revoke all on function public.admin_update_support_conversation_atomic(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_update_support_conversation_atomic(uuid,text,uuid,text) to authenticated;

-- Finance-only employees may select payment batches without catalog access.
-- Aggregates run in SQL over every matching line/payment; no API row cap applies.
create function public.admin_finance_supplier_batch_options(
  p_q text default null, p_supplier text default null, p_limit integer default 20, p_offset integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_data jsonb; v_total bigint;
  v_limit integer := least(greatest(coalesce(p_limit,20),1),50);
  v_offset integer := greatest(coalesce(p_offset,0),0);
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform private.partspro_assert_permission('finance.read');
  if length(coalesce(p_q,'')) > 120 or length(coalesce(p_supplier,'')) > 120 or v_offset > 5000 then
    raise exception 'Invalid batch query' using errcode='23514';
  end if;
  with filtered as (
    select b.*,coalesce(nullif(s.display_label,''),s.name) as supplier_name
    from public.supplier_batches b join public.suppliers s on s.id=b.supplier_id
    where (nullif(btrim(p_supplier),'') is null or concat_ws(' ',s.name,s.display_label,s.code) ilike '%'||btrim(p_supplier)||'%')
      and (nullif(btrim(p_q),'') is null or concat_ws(' ',b.batch_code,b.invoice_no,s.name,s.display_label) ilike '%'||btrim(p_q)||'%')
  ), page as (select * from filtered order by updated_at desc,id offset v_offset limit v_limit), totals as (
    select p.*,l.line_count,l.net_cost,coalesce(pay.paid_net,0) as paid_net,coalesce(pay.same_currency,true) as same_currency,pay.latest_paid_at
    from page p
    cross join lateral (select count(*) as line_count,coalesce(sum(line_total),0) as net_cost from public.supplier_batch_lines l where l.batch_id=p.id) l
    cross join lateral (select sum(amount_net) as paid_net,bool_and(currency=p.currency) as same_currency,max(coalesce(paid_at,created_at)) as latest_paid_at from public.supplier_batch_payments pay where pay.batch_id=p.id and status='paid') pay
  )
  select (select count(*) from filtered),coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'batchCode',batch_code,'supplierName',supplier_name,'currency',currency,
    'paidNet',case when same_currency then paid_net else null end,
    'outstandingNet',case when same_currency and line_count>0 and (lower(vat_mode) like '%esclus%' or lower(vat_mode) like '%excluded%') then greatest(round(net_cost-paid_net,2),0) else null end,
    'latestPaidAt',latest_paid_at,
    'costBasis',case when same_currency and line_count>0 and (lower(vat_mode) like '%esclus%' or lower(vat_mode) like '%excluded%') then 'confirmed_net' when same_currency then 'estimated' else 'unknown' end
  ) order by updated_at desc,id),'[]'::jsonb) into v_total,v_data from totals;
  return jsonb_build_object('batches',v_data,'total',v_total);
end;
$$;
revoke all on function public.admin_finance_supplier_batch_options(text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_finance_supplier_batch_options(text,text,integer,integer) to authenticated;
