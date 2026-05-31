alter table public.customers
  add column if not exists profile_kind text not null default 'customer';

alter table public.customers
  drop constraint if exists customers_profile_kind_check;
alter table public.customers
  add constraint customers_profile_kind_check
  check (profile_kind in ('customer', 'employee_self', 'archived_customer'));

create index if not exists customers_profile_kind_idx
  on public.customers (profile_kind);

create or replace function public.ensure_employee_self_customer()
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_customer public.customers%rowtype;
  v_display_name text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if v_profile.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if coalesce(v_profile.account_type, 'customer') <> 'employee' then
    raise exception 'Only employee accounts can create employee self checkout profiles'
      using errcode = '42501';
  end if;

  select *
  into v_customer
  from public.customers
  where user_id = v_user_id
  order by
    case when profile_kind = 'employee_self' then 0 else 1 end,
    created_at desc
  limit 1
  for update;

  v_display_name := coalesce(nullif(v_profile.display_name, ''), nullif(v_profile.email, ''), 'Dipendente PartsPro');

  if v_customer.id is null then
    insert into public.customers (
      user_id,
      company_name,
      contact_name,
      email,
      tier,
      level,
      status,
      customer_type,
      assignment_status,
      profile_kind
    )
    values (
      v_user_id,
      v_display_name,
      v_display_name,
      coalesce(v_profile.email, ''),
      'bronze',
      'bronze',
      'active',
      'wholesale',
      'assigned',
      'employee_self'
    )
    returning * into v_customer;
  else
    update public.customers
    set profile_kind = 'employee_self',
        status = 'active',
        customer_type = 'wholesale',
        assignment_status = 'assigned',
        company_name = coalesce(nullif(company_name, ''), v_display_name),
        contact_name = coalesce(nullif(contact_name, ''), v_display_name),
        email = coalesce(nullif(email, ''), coalesce(v_profile.email, '')),
        updated_at = now()
    where id = v_customer.id
    returning * into v_customer;
  end if;

  update public.profiles
  set customer_id = v_customer.id,
      updated_at = now()
  where id = v_user_id
    and customer_id is distinct from v_customer.id;

  update public.customer_memberships
  set status = 'disabled',
      updated_at = now()
  where user_id = v_user_id
    and status = 'active';

  return v_customer.id;
end;
$$;

grant execute on function public.ensure_employee_self_customer() to authenticated;

update public.customers as c
set profile_kind = 'employee_self',
    status = 'active',
    customer_type = 'wholesale',
    assignment_status = 'assigned',
    updated_at = now()
from public.profiles as p
where p.id = c.user_id
  and coalesce(p.account_type, 'customer') = 'employee'
  and c.profile_kind = 'customer';

update public.profiles as p
set customer_id = c.id,
    updated_at = now()
from public.customers as c
where p.id = c.user_id
  and coalesce(p.account_type, 'customer') = 'employee'
  and c.profile_kind = 'employee_self'
  and p.customer_id is distinct from c.id;

update public.customer_memberships as cm
set status = 'disabled',
    updated_at = now()
from public.profiles as p
where p.id = cm.user_id
  and coalesce(p.account_type, 'customer') = 'employee'
  and cm.status = 'active';

comment on column public.customers.profile_kind is
  'Distinguishes normal customer profiles from employee self-purchase profiles and archived customer applications.';
