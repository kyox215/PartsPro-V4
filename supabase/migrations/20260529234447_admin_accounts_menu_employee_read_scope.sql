-- Move account management to its own admin panel and make employee account
-- visibility opt-in for non-admin roles.

insert into public.admin_permissions (id, label, group_name, description)
values (
  'panel.accounts',
  'Accounts panel',
  'panel',
  'Can open the unified account management panel.'
)
on conflict (id) do update
set label = excluded.label,
    group_name = excluded.group_name,
    description = excluded.description;

insert into public.admin_role_template_permissions (role_template_id, permission_id)
values ('admin', 'panel.accounts')
on conflict do nothing;

delete from public.admin_role_template_permissions
where permission_id = 'employees.read'
  and role_template_id in ('sales', 'sales_support', 'auditor');

update public.admin_permissions
set
  label = 'Read employee accounts',
  description = 'Can read employee accounts when explicitly granted; permission managers can always read employees.'
where id = 'employees.read';

update public.admin_permissions
set
  label = 'Manage employee permissions',
  description = 'Can manage employee role templates, permission overrides, and employee account operations.'
where id = 'employees.manage_permissions';

do $$
begin
  drop policy if exists "partspro_customer_memberships_read" on public.customer_memberships;
  create policy "partspro_customer_memberships_read"
    on public.customer_memberships
    for select
    to authenticated
    using (
      user_id = (select auth.uid())
      or (select private.partspro_has_permission('customers.read'))
      or (select private.partspro_has_permission('employees.read'))
      or (select private.partspro_has_permission('employees.manage_permissions'))
    );

  drop policy if exists "partspro_profiles_self_or_staff_read" on public.profiles;
  create policy "partspro_profiles_self_or_staff_read"
    on public.profiles
    for select
    to authenticated
    using (
      id = (select auth.uid())
      or (select private.partspro_has_permission('customers.read'))
      or (select private.partspro_has_permission('employees.read'))
      or (select private.partspro_has_permission('employees.manage_permissions'))
    );
end $$;
