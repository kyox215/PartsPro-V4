-- Allow customer-ops staff to maintain customer status/type and level from
-- the unified account management panel.

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('sales', 'customers.read'),
  ('sales', 'customers.classify'),
  ('sales', 'customers.manage_level'),
  ('sales_support', 'customers.read'),
  ('sales_support', 'customers.classify'),
  ('sales_support', 'customers.manage_level')
on conflict do nothing;

update public.admin_permissions
set
  label = 'Manage customer status/type',
  description = 'Can update customer active/pending/suspended status and retail/wholesale type from account management.'
where id = 'customers.classify';

update public.admin_permissions
set
  label = 'Manage customer level',
  description = 'Can update customer pricing level from account management.'
where id = 'customers.manage_level';

update public.admin_role_templates
set
  description = 'Customer status, type, level, product, and order support.'
where id = 'sales_support';
