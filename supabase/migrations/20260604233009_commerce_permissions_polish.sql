insert into public.admin_permissions (id, label, group_name, description)
values
  ('panel.marketplace', 'Commerce panel', 'commerce', 'Can open the commerce automation panel.'),
  ('ebay.connect', 'Connect eBay', 'commerce', 'Can start eBay OAuth and manage the eBay account connection.'),
  ('ebay.publish', 'Publish eBay listings', 'commerce', 'Can queue and publish eligible products to eBay.'),
  ('ebay.sync_inventory', 'Sync eBay price and inventory', 'commerce', 'Can queue price and inventory updates for eBay listings.'),
  ('ebay.orders', 'Manage eBay orders', 'commerce', 'Can import eBay orders and write marketplace order links.'),
  ('ebay.settings', 'Manage eBay settings', 'commerce', 'Can edit eBay marketplace settings, policies, and category mappings.'),
  ('ebay.jobs', 'Run eBay queue', 'commerce', 'Can execute and retry eBay marketplace sync jobs.')
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_templates (id, label, description)
values
  (
    'commerce_manager',
    'Commerce manager',
    'Commerce and eBay marketplace operations without employee permission management.'
  )
on conflict (id) do update
set label = excluded.label,
    description = excluded.description,
    updated_at = now();

insert into public.admin_role_template_permissions (role_template_id, permission_id)
select 'admin', id
from public.admin_permissions
where id in (
  'panel.marketplace',
  'ebay.connect',
  'ebay.publish',
  'ebay.sync_inventory',
  'ebay.orders',
  'ebay.settings',
  'ebay.jobs'
)
on conflict do nothing;

delete from public.admin_role_template_permissions
where role_template_id = 'commerce_manager';

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values
  ('commerce_manager', 'panel.marketplace'),
  ('commerce_manager', 'ebay.connect'),
  ('commerce_manager', 'ebay.publish'),
  ('commerce_manager', 'ebay.sync_inventory'),
  ('commerce_manager', 'ebay.orders'),
  ('commerce_manager', 'ebay.settings'),
  ('commerce_manager', 'ebay.jobs'),
  ('commerce_manager', 'products.read_admin'),
  ('commerce_manager', 'product.read_admin'),
  ('commerce_manager', 'orders.read')
on conflict do nothing;

drop policy if exists "partspro_marketplace_sync_jobs_write"
  on public.marketplace_sync_jobs;

create policy "partspro_marketplace_sync_jobs_write"
  on public.marketplace_sync_jobs
  for all
  to authenticated
  using (
    (select private.partspro_has_permission('ebay.publish'))
    or (select private.partspro_has_permission('ebay.sync_inventory'))
    or (select private.partspro_has_permission('ebay.orders'))
    or (select private.partspro_has_permission('ebay.connect'))
    or (select private.partspro_has_permission('ebay.jobs'))
  )
  with check (
    (select private.partspro_has_permission('ebay.publish'))
    or (select private.partspro_has_permission('ebay.sync_inventory'))
    or (select private.partspro_has_permission('ebay.orders'))
    or (select private.partspro_has_permission('ebay.connect'))
    or (select private.partspro_has_permission('ebay.jobs'))
  );
