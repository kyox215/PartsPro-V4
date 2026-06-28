revoke all privileges on table public.notification_events
  from anon, authenticated;
revoke all privileges on table public.notification_subscriptions
  from anon, authenticated;

grant select, update on table public.notification_events
  to authenticated;
grant select, insert, update, delete on table public.notification_subscriptions
  to authenticated;

grant select, insert, update, delete on table public.notification_events
  to service_role;
grant select, insert, update, delete on table public.notification_subscriptions
  to service_role;

comment on table public.notification_events is
  'PartsPro in-app notification ledger for orders, support, and customer follow-up. Authenticated users can only read/update their own rows via RLS; inserts are server-side.';
