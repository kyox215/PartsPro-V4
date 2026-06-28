create extension if not exists "pgcrypto";
create schema if not exists private;

insert into public.admin_permissions (id, label, group_name, description)
values
  ('panel.support', 'Support panel', 'panel', 'Can open the admin customer support panel.'),
  ('support.read', 'Read support conversations', 'support', 'Can read customer support conversations and messages.'),
  ('support.reply', 'Reply to support conversations', 'support', 'Can reply to customer support conversations.'),
  ('support.assign', 'Assign support conversations', 'support', 'Can claim and assign support conversations.'),
  ('support.resolve', 'Resolve support conversations', 'support', 'Can resolve and reopen support conversations.')
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'panel.support'),
  ('admin', 'support.read'),
  ('admin', 'support.reply'),
  ('admin', 'support.assign'),
  ('admin', 'support.resolve'),
  ('sales', 'panel.support'),
  ('sales', 'support.read'),
  ('sales', 'support.reply'),
  ('sales', 'support.assign'),
  ('sales', 'support.resolve'),
  ('sales_support', 'panel.support'),
  ('sales_support', 'support.read'),
  ('sales_support', 'support.reply'),
  ('sales_support', 'support.assign'),
  ('sales_support', 'support.resolve')
on conflict do nothing;

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  status text not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  last_message_at timestamptz,
  last_customer_message_at timestamptz,
  last_staff_message_at timestamptz,
  customer_last_read_at timestamptz,
  staff_last_read_at timestamptz,
  customer_unread_count integer not null default 0,
  staff_unread_count integer not null default 0,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_conversations_status_check
    check (status in ('open', 'resolved', 'archived')),
  constraint support_conversations_unread_nonnegative
    check (customer_unread_count >= 0 and staff_unread_count >= 0),
  constraint support_conversations_subject_length
    check (subject is null or length(subject) <= 160),
  constraint support_conversations_assignment_consistency
    check (
      (assigned_to is null and assigned_by is null and assigned_at is null)
      or (assigned_to is not null and assigned_at is not null)
    )
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  sender_type text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_sender_type_check
    check (sender_type in ('customer', 'staff', 'system')),
  constraint support_messages_body_length
    check (length(btrim(body)) between 1 and 2000)
);

create table if not exists public.support_conversation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  from_assignee uuid references auth.users(id) on delete set null,
  to_assignee uuid references auth.users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint support_conversation_events_type_check
    check (event_type in ('created', 'customer_message', 'staff_message', 'claimed', 'assigned', 'resolved', 'reopened', 'read', 'system_note')),
  constraint support_conversation_events_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint support_conversation_events_note_length
    check (note is null or length(note) <= 1000)
);

create index if not exists support_conversations_customer_updated_idx
  on public.support_conversations (customer_id, updated_at desc);

create index if not exists support_conversations_user_updated_idx
  on public.support_conversations (user_id, updated_at desc);

create index if not exists support_conversations_staff_queue_idx
  on public.support_conversations (status, assigned_to, last_message_at desc nulls last, created_at desc);

create index if not exists support_messages_conversation_created_idx
  on public.support_messages (conversation_id, created_at asc);

create index if not exists support_conversation_events_conversation_created_idx
  on public.support_conversation_events (conversation_id, created_at asc);

drop trigger if exists support_conversations_set_updated_at
  on public.support_conversations;
create trigger support_conversations_set_updated_at
  before update on public.support_conversations
  for each row execute function public.set_updated_at();

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_conversation_events enable row level security;

alter table public.support_conversations replica identity full;
alter table public.support_messages replica identity full;
alter table public.support_conversation_events replica identity full;

grant usage on schema public to authenticated, service_role;
grant select on public.support_conversations to authenticated;
grant select on public.support_messages to authenticated;
grant select on public.support_conversation_events to authenticated;
grant select, insert, update, delete on public.support_conversations to service_role;
grant select, insert, update, delete on public.support_messages to service_role;
grant select, insert, update, delete on public.support_conversation_events to service_role;

create or replace function private.support_can_read_conversation(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(
    exists (
      select 1
      from public.support_conversations as conversation
      where conversation.id = _conversation_id
        and (
          conversation.user_id = (select auth.uid())
          or (select private.partspro_has_permission('support.read'))
        )
    ),
    false
  )
$$;

revoke all on function private.support_can_read_conversation(uuid) from public;
grant execute on function private.support_can_read_conversation(uuid) to authenticated;

do $$
begin
  drop policy if exists "partspro_support_conversations_select" on public.support_conversations;
  drop policy if exists "partspro_support_messages_select" on public.support_messages;
  drop policy if exists "partspro_support_conversation_events_select" on public.support_conversation_events;

  create policy "partspro_support_conversations_select"
    on public.support_conversations
    for select
    to authenticated
    using (
      user_id = (select auth.uid())
      or (select private.partspro_has_permission('support.read'))
    );

  create policy "partspro_support_messages_select"
    on public.support_messages
    for select
    to authenticated
    using ((select private.support_can_read_conversation(conversation_id)));

  create policy "partspro_support_conversation_events_select"
    on public.support_conversation_events
    for select
    to authenticated
    using ((select private.support_can_read_conversation(conversation_id)));
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    alter publication supabase_realtime
      add table public.support_conversations;
    alter publication supabase_realtime
      add table public.support_messages;
    alter publication supabase_realtime
      add table public.support_conversation_events;
  end if;
exception
  when duplicate_object then null;
end $$;

comment on table public.support_conversations is
  'Customer-facing PartsPro support conversations with staff assignment state.';
comment on table public.support_messages is
  'Plain-text messages for PartsPro support conversations.';
comment on table public.support_conversation_events is
  'Audit trail for PartsPro support conversation assignment and status changes.';
