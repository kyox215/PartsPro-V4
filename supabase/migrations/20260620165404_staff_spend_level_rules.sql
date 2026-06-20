-- Staff/manual level campaign rules:
-- 1. Employee self profiles keep their own manually assigned level; they are not
--    auto-promoted to King by staff status.
-- 2. Employee self orders still count toward the original customer profile for
--    spend-based level progression when the account is later returned to customer.
-- 3. kyox120@gmail.com is a permanent manual King exception, not a temporary promo.

create or replace function private.customer_level_spend_order_customer_ids(_customer public.customers)
returns uuid[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  if _customer.id is null then
    return array[]::uuid[];
  end if;

  if coalesce(_customer.profile_kind, 'customer') = 'customer' then
    select array_agg(distinct candidate.id)
    into v_ids
    from public.customers as candidate
    where candidate.id = _customer.id
      or (
        _customer.user_id is not null
        and candidate.user_id = _customer.user_id
        and coalesce(candidate.profile_kind, 'customer') = 'employee_self'
      );
  else
    v_ids := array[_customer.id];
  end if;

  return coalesce(v_ids, array[_customer.id]);
end;
$$;

create or replace function private.recalculate_customer_level(_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_order_customer_ids uuid[];
  v_orders_count integer := 0;
  v_revenue numeric(12, 2) := 0;
  v_lifetime_spend_net numeric(12, 2) := 0;
  v_last_order_at timestamptz;
  v_level text;
begin
  if _customer_id is null then
    return;
  end if;

  select * into v_customer
  from public.customers
  where id = _customer_id;

  if v_customer.id is null then
    return;
  end if;

  perform set_config('partspro.allow_account_admin_update', 'on', true);

  v_order_customer_ids := private.customer_level_spend_order_customer_ids(v_customer);

  select
    count(*)::integer,
    coalesce(sum(total_net), 0)::numeric(12, 2),
    coalesce(sum(total_net) filter (where payment_status = 'paid'), 0)::numeric(12, 2),
    max(created_at)
  into v_orders_count, v_revenue, v_lifetime_spend_net, v_last_order_at
  from public.orders
  where customer_id = any(v_order_customer_ids)
    and status <> 'cancelled';

  v_level := private.customer_level_for_spend(v_lifetime_spend_net);

  if coalesce(v_customer.profile_kind, 'customer') = 'customer' then
    update public.customers
    set orders_count = v_orders_count,
        revenue = v_revenue,
        last_order_at = v_last_order_at,
        lifetime_spend_net = v_lifetime_spend_net,
        level = case when level_source = 'manual' then level else v_level end,
        tier = case when level_source = 'manual' then tier else v_level end,
        updated_at = now()
    where id = _customer_id;
  else
    update public.customers
    set orders_count = v_orders_count,
        revenue = v_revenue,
        last_order_at = v_last_order_at,
        lifetime_spend_net = v_lifetime_spend_net,
        updated_at = now()
    where id = _customer_id;
  end if;
end;
$$;

create or replace function private.recalculate_customer_level_family(_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer public.customers%rowtype;
  v_customer_profile_id uuid;
begin
  if _customer_id is null then
    return;
  end if;

  select * into v_customer
  from public.customers
  where id = _customer_id;

  if v_customer.id is null then
    return;
  end if;

  perform private.recalculate_customer_level(v_customer.id);

  if coalesce(v_customer.profile_kind, 'customer') = 'employee_self'
    and v_customer.user_id is not null then
    for v_customer_profile_id in
      select c.id
      from public.customers as c
      where c.user_id = v_customer.user_id
        and coalesce(c.profile_kind, 'customer') = 'customer'
        and coalesce(c.profile_kind, 'customer') <> 'archived_customer'
    loop
      perform private.recalculate_customer_level(v_customer_profile_id);
    end loop;
  end if;
end;
$$;

create or replace function private.recalculate_customer_level_from_order()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.customer_id is not null then
    perform private.recalculate_customer_level_family(old.customer_id);
    return old;
  end if;

  if tg_op = 'INSERT' and new.customer_id is not null then
    perform private.recalculate_customer_level_family(new.customer_id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.customer_id is not null and old.customer_id is distinct from new.customer_id then
      perform private.recalculate_customer_level_family(old.customer_id);
    end if;

    perform private.recalculate_customer_level_family(new.customer_id);
    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists partspro_orders_recalculate_customer_level on public.orders;
create trigger partspro_orders_recalculate_customer_level
  after insert or update or delete
  on public.orders
  for each row execute function private.recalculate_customer_level_from_order();

create or replace function public.admin_update_account_type(
  p_user_id uuid,
  p_account_type text,
  p_customer_type text default null,
  p_assignment_status text default null,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_before_profile public.profiles%rowtype;
  v_after_profile public.profiles%rowtype;
  v_before_customer public.customers%rowtype;
  v_after_customer public.customers%rowtype;
  v_employee_self_before public.customers%rowtype;
  v_employee_self_after public.customers%rowtype;
  v_customer_id uuid;
  v_display_name text;
  v_company_name text;
  v_contact_name text;
  v_email text;
  v_phone text;
  v_vat_number text;
  v_fiscal_code text;
  v_sdi text;
  v_pec text;
  v_billing_address text;
  v_shipping_address text;
  v_employee_level text;
  v_employee_tier text;
  v_customer_type text;
  v_complete boolean;
begin
  perform set_config('partspro.allow_account_admin_update', 'on', true);

  if p_account_type not in ('customer', 'employee') then
    raise exception 'Invalid account type' using errcode = '23514';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required' using errcode = '23514';
  end if;

  select * into v_before_profile from public.profiles where id = p_user_id for update;
  if v_before_profile.id is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  if p_account_type = 'employee' then
    perform private.partspro_assert_permission('employees.manage_permissions');

    v_customer_id := private.pick_customer_for_account_profile(
      p_user_id,
      v_before_profile.email,
      v_before_profile.customer_id
    );

    if v_customer_id is not null then
      select * into v_before_customer from public.customers where id = v_customer_id for update;
    end if;

    update public.profiles
    set account_type = 'employee',
        role = coalesce(nullif(role_template, ''), 'sales_support'),
        role_template = coalesce(nullif(role_template, ''), 'sales_support'),
        customer_id = null,
        updated_at = now()
    where id = p_user_id
    returning * into v_after_profile;

    if v_customer_id is not null then
      update public.customers
      set user_id = p_user_id,
          profile_kind = 'customer',
          assignment_status = 'converted_to_employee',
          status = 'suspended',
          converted_to_employee_at = now(),
          updated_at = now()
      where id = v_customer_id
      returning * into v_after_customer;
    end if;

    v_display_name := coalesce(
      nullif(v_after_customer.company_name, ''),
      nullif(v_before_profile.display_name, ''),
      nullif(v_before_profile.email, ''),
      'Dipendente PartsPro'
    );
    v_company_name := coalesce(nullif(v_after_customer.company_name, ''), v_display_name);
    v_contact_name := coalesce(nullif(v_after_customer.contact_name, ''), '');
    v_email := coalesce(nullif(v_after_customer.email, ''), coalesce(v_before_profile.email, ''));
    v_phone := nullif(v_after_customer.phone, '');
    v_vat_number := nullif(v_after_customer.vat_number, '');
    v_fiscal_code := nullif(v_after_customer.fiscal_code, '');
    v_sdi := nullif(v_after_customer.sdi, '');
    v_pec := nullif(v_after_customer.pec, '');
    v_billing_address := nullif(v_after_customer.billing_address, '');
    v_shipping_address := nullif(v_after_customer.shipping_address, '');
    v_customer_type := coalesce(nullif(v_after_customer.customer_type, ''), 'wholesale');
    v_complete := private.is_customer_profile_complete_for_checkout(
      v_company_name,
      v_email,
      v_phone,
      v_fiscal_code,
      v_billing_address,
      v_shipping_address
    );

    select *
    into v_employee_self_before
    from public.customers
    where user_id = p_user_id
      and profile_kind = 'employee_self'
    order by created_at desc
    limit 1
    for update;

    v_employee_level := coalesce(
      nullif(v_employee_self_before.level, ''),
      private.customer_level_for_spend(coalesce(v_employee_self_before.lifetime_spend_net, 0)),
      'bronze'
    );
    v_employee_tier := coalesce(
      nullif(v_employee_self_before.tier, ''),
      v_employee_level,
      'bronze'
    );

    if v_employee_self_before.id is null then
      insert into public.customers (
        user_id,
        company_name,
        contact_name,
        email,
        phone,
        vat_number,
        fiscal_code,
        sdi,
        pec,
        billing_address,
        shipping_address,
        tier,
        level,
        status,
        customer_type,
        assignment_status,
        profile_kind,
        profile_completed_at
      )
      values (
        p_user_id,
        v_company_name,
        v_contact_name,
        v_email,
        v_phone,
        v_vat_number,
        v_fiscal_code,
        v_sdi,
        v_pec,
        v_billing_address,
        v_shipping_address,
        'bronze',
        'bronze',
        'active',
        v_customer_type,
        'assigned',
        'employee_self',
        case when v_complete then coalesce(v_after_customer.profile_completed_at, now()) else null end
      )
      returning * into v_employee_self_after;
    else
      update public.customers as self
      set company_name = coalesce(nullif(self.company_name, ''), v_company_name),
          contact_name = coalesce(nullif(self.contact_name, ''), v_contact_name, ''),
          email = coalesce(nullif(self.email, ''), v_email),
          phone = coalesce(nullif(self.phone, ''), v_phone),
          vat_number = coalesce(nullif(self.vat_number, ''), v_vat_number),
          fiscal_code = coalesce(nullif(self.fiscal_code, ''), v_fiscal_code),
          sdi = coalesce(nullif(self.sdi, ''), v_sdi),
          pec = coalesce(nullif(self.pec, ''), v_pec),
          billing_address = coalesce(nullif(self.billing_address, ''), v_billing_address),
          shipping_address = coalesce(nullif(self.shipping_address, ''), v_shipping_address),
          level = v_employee_level,
          tier = v_employee_tier,
          customer_type = coalesce(nullif(self.customer_type, ''), v_customer_type),
          assignment_status = coalesce(nullif(self.assignment_status, ''), 'assigned'),
          status = coalesce(nullif(self.status, ''), 'active'),
          profile_completed_at = case
            when private.is_customer_profile_complete_for_checkout(
              coalesce(nullif(self.company_name, ''), v_company_name),
              coalesce(nullif(self.email, ''), v_email),
              coalesce(nullif(self.phone, ''), v_phone),
              coalesce(nullif(self.fiscal_code, ''), v_fiscal_code),
              coalesce(nullif(self.billing_address, ''), v_billing_address),
              coalesce(nullif(self.shipping_address, ''), v_shipping_address)
            )
              then coalesce(self.profile_completed_at, v_after_customer.profile_completed_at, now())
            else null
          end,
          updated_at = now()
      where self.id = v_employee_self_before.id
        and self.profile_kind = 'employee_self'
      returning * into v_employee_self_after;
    end if;

    update public.profiles
    set customer_id = v_employee_self_after.id,
        updated_at = now()
    where id = p_user_id
    returning * into v_after_profile;

    update public.customer_memberships
    set status = 'disabled',
        updated_at = now()
    where user_id = p_user_id;

    perform private.partspro_audit_admin(
      'account.type_update',
      'profile',
      p_user_id::text,
      to_jsonb(v_before_profile),
      jsonb_build_object(
        'profile', to_jsonb(v_after_profile),
        'customer_before', to_jsonb(v_before_customer),
        'customer', to_jsonb(v_after_customer),
        'employee_self_before', to_jsonb(v_employee_self_before),
        'employee_self', to_jsonb(v_employee_self_after)
      ),
      p_reason,
      jsonb_build_object('account_type', p_account_type)
    );

    perform private.recalculate_customer_level_family(v_employee_self_after.id);

    return jsonb_build_object(
      'account_type', 'employee',
      'profile', to_jsonb(v_after_profile),
      'customer', to_jsonb(v_after_customer),
      'employee_self', to_jsonb(v_employee_self_after)
    );
  end if;

  perform private.partspro_assert_permission('customers.classify');

  v_customer_id := private.pick_customer_for_account_profile(
    p_user_id,
    v_before_profile.email,
    v_before_profile.customer_id
  );

  if v_customer_id is not null then
    select * into v_before_customer from public.customers where id = v_customer_id for update;
  end if;

  v_customer_id := private.ensure_customer_profile_for_account(
    p_user_id,
    v_before_profile.email,
    v_before_profile.display_name,
    v_before_profile.customer_id
  );

  update public.customers
  set customer_type = coalesce(nullif(p_customer_type, ''), nullif(customer_type, ''), 'retail'),
      assignment_status = coalesce(nullif(p_assignment_status, ''), nullif(assignment_status, ''), 'needs_review'),
      status = 'active',
      assigned_by = (select auth.uid()),
      assigned_at = now(),
      last_activity_at = coalesce(last_activity_at, now()),
      updated_at = now()
  where id = v_customer_id
  returning * into v_after_customer;

  select * into v_after_profile from public.profiles where id = p_user_id;

  perform private.recalculate_customer_level(v_after_customer.id);

  perform private.partspro_audit_admin(
    'account.type_update',
    'profile',
    p_user_id::text,
    to_jsonb(v_before_profile),
    jsonb_build_object(
      'profile', to_jsonb(v_after_profile),
      'customer_before', to_jsonb(v_before_customer),
      'customer', to_jsonb(v_after_customer)
    ),
    p_reason,
    jsonb_build_object('account_type', p_account_type)
  );

  return jsonb_build_object(
    'account_type', 'customer',
    'profile', to_jsonb(v_after_profile),
    'customer', to_jsonb(v_after_customer)
  );
end;
$$;

revoke execute on function public.admin_update_account_type(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.admin_update_account_type(uuid, text, text, text, text)
  to authenticated;

select set_config('partspro.allow_account_admin_update', 'on', true);

with latest_promo_audit as (
  select distinct on (entity_id)
    entity_id::uuid as customer_id,
    nullif(before_data ->> 'effective_level', '') as before_effective_level
  from public.admin_audit_events
  where action = 'customer.king_promo_apply'
    and entity_type = 'customer'
    and entity_id ~* '^[0-9a-f-]{36}$'
  order by entity_id, created_at desc
),
restored as (
  update public.customers as c
  set level = private.normalize_customer_tier(a.before_effective_level),
      tier = private.normalize_customer_tier(a.before_effective_level),
      updated_at = now()
  from latest_promo_audit as a
  where c.id = a.customer_id
    and c.promo_level = 'king'
    and a.before_effective_level is not null
    and private.normalize_customer_tier(a.before_effective_level) is not null
    and coalesce(c.profile_kind, 'customer') = 'customer'
    and not (
      lower(coalesce(c.email, '')) = lower('kyox120@gmail.com')
      or exists (
        select 1
        from public.profiles as p
        where p.id = c.user_id
          and lower(coalesce(p.email, '')) = lower('kyox120@gmail.com')
      )
    )
  returning c.id, a.before_effective_level
)
insert into public.admin_audit_events (
  action,
  actor_email,
  actor_id,
  actor_role,
  after_data,
  before_data,
  entity_id,
  entity_type,
  reason,
  request_metadata,
  result
)
select
  'customer.promo_base_level_restore',
  null,
  null,
  'system',
  jsonb_build_object('base_level', r.before_effective_level),
  '{}'::jsonb,
  r.id::text,
  'customer',
  'Restore stored customer level under active temporary King promotion',
  jsonb_build_object('migration', '20260620165404_staff_spend_level_rules'),
  'success'
from restored as r;

do $$
declare
  v_customer_id uuid;
begin
  for v_customer_id in
    select id
    from public.customers
    where coalesce(profile_kind, 'customer') in ('customer', 'employee_self')
  loop
    perform private.recalculate_customer_level_family(v_customer_id);
  end loop;
end $$;

with kyox_users as (
  select id
  from public.profiles
  where lower(coalesce(email, '')) = lower('kyox120@gmail.com')
),
kyox_customers as (
  select c.*
  from public.customers as c
  where coalesce(c.profile_kind, 'customer') <> 'archived_customer'
    and (
      lower(coalesce(c.email, '')) = lower('kyox120@gmail.com')
      or c.user_id in (select id from kyox_users)
    )
),
updated as (
  update public.customers as c
  set level = 'king',
      tier = 'king',
      level_source = 'manual',
      manual_level_set_by = coalesce(c.manual_level_set_by, (select auth.uid())),
      manual_level_set_at = coalesce(c.manual_level_set_at, now()),
      manual_level_reason = coalesce(nullif(c.manual_level_reason, ''), 'permanent_highest_level_for_owner_account'),
      promo_level = null,
      promo_level_starts_at = null,
      promo_level_expires_at = null,
      promo_level_reason = null,
      updated_at = now()
  from kyox_customers as k
  where c.id = k.id
  returning c.id, to_jsonb(k) as before_data, to_jsonb(c) as after_data
)
insert into public.admin_audit_events (
  action,
  actor_email,
  actor_id,
  actor_role,
  after_data,
  before_data,
  entity_id,
  entity_type,
  reason,
  request_metadata,
  result
)
select
  'customer.owner_permanent_king_apply',
  'kyox120@gmail.com',
  null,
  'system',
  u.after_data,
  u.before_data,
  u.id::text,
  'customer',
  'Owner account keeps permanent manual King level outside temporary campaigns',
  jsonb_build_object('migration', '20260620165404_staff_spend_level_rules'),
  'success'
from updated as u;

with normalized as (
  update public.customers as c
  set level = private.customer_level_for_spend(coalesce(c.lifetime_spend_net, 0)),
      tier = private.customer_level_for_spend(coalesce(c.lifetime_spend_net, 0)),
      promo_level = null,
      promo_level_starts_at = null,
      promo_level_expires_at = null,
      promo_level_reason = null,
      updated_at = now()
  where coalesce(c.profile_kind, 'customer') = 'employee_self'
    and coalesce(c.level_source, 'automatic') = 'automatic'
    and not (
      lower(coalesce(c.email, '')) = lower('kyox120@gmail.com')
      or exists (
        select 1
        from public.profiles as p
        where p.id = c.user_id
          and lower(coalesce(p.email, '')) = lower('kyox120@gmail.com')
      )
    )
  returning c.id, c.lifetime_spend_net, c.level
)
insert into public.admin_audit_events (
  action,
  actor_email,
  actor_id,
  actor_role,
  after_data,
  before_data,
  entity_id,
  entity_type,
  reason,
  request_metadata,
  result
)
select
  'customer.employee_self_auto_level_normalize',
  null,
  null,
  'system',
  jsonb_build_object(
    'level', n.level,
    'lifetime_spend_net', n.lifetime_spend_net
  ),
  '{}'::jsonb,
  n.id::text,
  'customer',
  'Employee self profile automatic levels are spend based; staff status does not auto-promote',
  jsonb_build_object('migration', '20260620165404_staff_spend_level_rules'),
  'success'
from normalized as n;

do $$
declare
  v_customer_id uuid;
begin
  for v_customer_id in
    select id
    from public.customers
    where lower(coalesce(email, '')) = lower('kyox120@gmail.com')
       or user_id in (
        select id
        from public.profiles
        where lower(coalesce(email, '')) = lower('kyox120@gmail.com')
      )
  loop
    perform private.recalculate_customer_level_family(v_customer_id);
  end loop;
end $$;
