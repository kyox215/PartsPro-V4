-- Consolidate legacy customer management into Settings > Account Management.
-- The customer data model stays intact; this removes only obsolete admin-panel permissions.

update public.admin_permissions
set
  label = 'Read customer accounts',
  description = 'Can read customer account profiles and select customers for assisted orders.'
where id = 'customers.read';

update public.admin_permissions
set
  label = 'Manage customer status',
  description = 'Can update customer active/pending/suspended status from account management.'
where id = 'customers.classify';

update public.admin_permissions
set
  label = 'Manage customer level',
  description = 'Can update customer pricing level from account management.'
where id = 'customers.manage_level';

delete from public.admin_user_permission_overrides
where permission_id in (
  'panel.customers',
  'customers.manage',
  'customers.manage_terms'
);

delete from public.admin_role_template_permissions
where permission_id in (
  'panel.customers',
  'customers.manage',
  'customers.manage_terms'
);

delete from public.admin_permissions
where id in (
  'panel.customers',
  'customers.manage',
  'customers.manage_terms'
);
