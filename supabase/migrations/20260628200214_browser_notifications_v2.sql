create extension if not exists "pgcrypto";

create table if not exists public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  browser text,
  platform text,
  scope text not null default '/',
  permission text not null default 'granted',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  failure_count integer not null default 0,
  last_error text,
  constraint notification_subscriptions_endpoint_key unique (endpoint),
  constraint notification_subscriptions_keys_present
    check (length(btrim(p256dh)) > 0 and length(btrim(auth)) > 0),
  constraint notification_subscriptions_endpoint_length
    check (length(endpoint) between 20 and 2048),
  constraint notification_subscriptions_permission_check
    check (permission in ('granted', 'denied', 'default')),
  constraint notification_subscriptions_failure_nonnegative
    check (failure_count >= 0)
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  audience text not null,
  event_type text not null,
  title text not null,
  body text not null,
  target_path text not null,
  source_table text,
  source_id text,
  payload jsonb not null default '{}'::jsonb,
  push_attempted_at timestamptz,
  push_delivered_count integer not null default 0,
  push_failed_count integer not null default 0,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notification_events_audience_check
    check (audience in ('customer', 'staff')),
  constraint notification_events_type_check
    check (
      event_type in (
        'admin_test',
        'customer_test',
        'new_order',
        'order_status_updated',
        'order_shipping_updated',
        'support_customer_message',
        'support_staff_reply',
        'support_assigned'
      )
    ),
  constraint notification_events_title_length
    check (length(btrim(title)) between 1 and 120),
  constraint notification_events_body_length
    check (length(btrim(body)) between 1 and 240),
  constraint notification_events_target_path_length
    check (target_path ~ '^/' and length(target_path) <= 512),
  constraint notification_events_payload_object
    check (jsonb_typeof(payload) = 'object'),
  constraint notification_events_push_counts_nonnegative
    check (push_delivered_count >= 0 and push_failed_count >= 0)
);

create index if not exists notification_subscriptions_user_active_idx
  on public.notification_subscriptions (user_id, revoked_at, last_seen_at desc);

create index if not exists notification_events_recipient_created_idx
  on public.notification_events (recipient_user_id, created_at desc);

create index if not exists notification_events_recipient_unread_idx
  on public.notification_events (recipient_user_id, created_at desc)
  where read_at is null;

alter table public.notification_subscriptions enable row level security;
alter table public.notification_events enable row level security;

grant select, insert, update, delete on public.notification_subscriptions to authenticated;
grant select, insert, update on public.notification_events to authenticated;
grant select, insert, update, delete on public.notification_subscriptions to service_role;
grant select, insert, update, delete on public.notification_events to service_role;

do $$
begin
  drop policy if exists "partspro_notification_subscriptions_self_select"
    on public.notification_subscriptions;
  drop policy if exists "partspro_notification_subscriptions_self_insert"
    on public.notification_subscriptions;
  drop policy if exists "partspro_notification_subscriptions_self_update"
    on public.notification_subscriptions;
  drop policy if exists "partspro_notification_subscriptions_self_delete"
    on public.notification_subscriptions;
  drop policy if exists "partspro_notification_events_self_select"
    on public.notification_events;
  drop policy if exists "partspro_notification_events_self_update"
    on public.notification_events;

  create policy "partspro_notification_subscriptions_self_select"
    on public.notification_subscriptions
    for select
    to authenticated
    using (user_id = (select auth.uid()));

  create policy "partspro_notification_subscriptions_self_insert"
    on public.notification_subscriptions
    for insert
    to authenticated
    with check (user_id = (select auth.uid()));

  create policy "partspro_notification_subscriptions_self_update"
    on public.notification_subscriptions
    for update
    to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

  create policy "partspro_notification_subscriptions_self_delete"
    on public.notification_subscriptions
    for delete
    to authenticated
    using (user_id = (select auth.uid()));

  create policy "partspro_notification_events_self_select"
    on public.notification_events
    for select
    to authenticated
    using (recipient_user_id = (select auth.uid()));

  create policy "partspro_notification_events_self_update"
    on public.notification_events
    for update
    to authenticated
    using (recipient_user_id = (select auth.uid()))
    with check (recipient_user_id = (select auth.uid()));
end
$$;

comment on table public.notification_subscriptions is
  'Browser Web Push subscriptions for PartsPro users and devices.';
comment on table public.notification_events is
  'PartsPro in-app notification ledger for orders, support, and customer follow-up.';
