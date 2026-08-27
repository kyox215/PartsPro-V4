-- Adds a read-only website analytics permission without exposing analytics data
-- through Supabase. Traffic data remains in Vercel Web Analytics.

insert into public.admin_permissions (id, label, group_name, description)
values (
  'analytics.read',
  'Read website analytics',
  'analytics',
  'Can open the website analytics panel and read aggregated traffic reports.'
)
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('admin', 'analytics.read'),
  ('auditor', 'analytics.read')
on conflict (role_template_id, permission_id) do nothing;
