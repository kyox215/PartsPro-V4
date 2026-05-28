-- Keep the application-level bootstrap admin in sync with Postgres RLS.
--
-- The Next app allows PARTSPRO_ADMIN_EMAILS (default: kyox120@gmail.com) to
-- open the admin UI. Customer management still reads through authenticated
-- Supabase clients, so RLS must recognize the same bootstrap admin or the API
-- can pass app auth and then return an empty customer list from the database.

create or replace function private.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when lower(coalesce((auth.jwt() ->> 'email'), '')) in ('kyox120@gmail.com') then 'admin'
    else (
      select p.role
      from public.profiles as p
      where p.id = (select auth.uid())
      limit 1
    )
  end
$$;

create or replace function private.partspro_effective_permissions(_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with jwt_context as (
    select
      (select auth.uid()) as actor_id,
      lower(coalesce((auth.jwt() ->> 'email'), '')) in ('kyox120@gmail.com') as is_bootstrap_admin
  ),
  profile as (
    select
      _user_id as id,
      'admin'::text as template_id,
      'admin'::text as role,
      'employee'::text as account_type
    from jwt_context
    where _user_id = actor_id
      and is_bootstrap_admin

    union all

    select
      p.id,
      coalesce(nullif(p.role_template, ''), nullif(p.role, ''), 'customer') as template_id,
      p.role,
      coalesce(p.account_type, 'customer') as account_type
    from public.profiles as p
    cross join jwt_context
    where p.id = _user_id
      and not (_user_id = jwt_context.actor_id and jwt_context.is_bootstrap_admin)
      and (
        coalesce(p.account_type, 'customer') = 'employee'
        or coalesce(p.role, '') in (
          'admin',
          'auditor',
          'catalog_manager',
          'inventory_manager',
          'pricing_manager',
          'purchasing',
          'sales',
          'sales_support',
          'warehouse'
        )
      )
    limit 1
  ),
  base_permissions as (
    select arp.permission_id
    from profile as p
    join public.admin_role_template_permissions as arp
      on arp.role_template_id = p.template_id
    union
    select ap.id
    from profile as p
    cross join public.admin_permissions as ap
    where p.role = 'admin'
  ),
  denied as (
    select permission_override.permission_id
    from public.admin_user_permission_overrides as permission_override
    join profile as p on p.id = permission_override.user_id
    where permission_override.user_id = _user_id
      and permission_override.effect = 'deny'
  ),
  granted as (
    select permission_override.permission_id
    from public.admin_user_permission_overrides as permission_override
    join profile as p on p.id = permission_override.user_id
    where permission_override.user_id = _user_id
      and permission_override.effect = 'grant'
  )
  select coalesce(array_agg(permission_id order by permission_id), '{}'::text[])
  from (
    select permission_id from base_permissions
    except
    select permission_id from denied
    union
    select permission_id from granted
  ) as permissions
$$;

grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.partspro_effective_permissions(uuid) to authenticated;
