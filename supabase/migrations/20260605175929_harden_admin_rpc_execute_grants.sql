-- Tighten exposed SECURITY DEFINER RPCs after account/marketplace migrations.
-- Keep authenticated access for app flows that already perform in-function
-- permission checks, but remove anonymous/default PUBLIC execution.

revoke execute on function public.admin_customer_order_ledger(uuid, integer)
  from public, anon;
grant execute on function public.admin_customer_order_ledger(uuid, integer)
  to authenticated;

revoke execute on function public.admin_review_b2b_application(uuid, text, jsonb, text)
  from public, anon;
grant execute on function public.admin_review_b2b_application(uuid, text, jsonb, text)
  to authenticated;

revoke execute on function public.admin_update_account(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.admin_update_account(uuid, text, text, text, text)
  to authenticated;

revoke execute on function public.admin_update_account_type(uuid, text, text, text, text)
  from public, anon;
grant execute on function public.admin_update_account_type(uuid, text, text, text, text)
  to authenticated;

revoke execute on function public.admin_update_customer_classification(uuid, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_customer_classification(uuid, jsonb, text)
  to authenticated;

revoke execute on function public.admin_update_customer_level(uuid, text, text)
  from public, anon;
grant execute on function public.admin_update_customer_level(uuid, text, text)
  to authenticated;

revoke execute on function public.admin_update_customer_profile(uuid, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_customer_profile(uuid, jsonb, text)
  to authenticated;

revoke execute on function public.admin_update_customer_terms(uuid, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_customer_terms(uuid, jsonb, text)
  to authenticated;

revoke execute on function public.admin_update_employee_role(uuid, text, text)
  from public, anon;
grant execute on function public.admin_update_employee_role(uuid, text, text)
  to authenticated;

revoke execute on function public.admin_update_permission_overrides(uuid, text, jsonb, text)
  from public, anon;
grant execute on function public.admin_update_permission_overrides(uuid, text, jsonb, text)
  to authenticated;

revoke execute on function public.ensure_current_user_account()
  from public, anon;
grant execute on function public.ensure_current_user_account()
  to authenticated;

revoke execute on function public.ensure_employee_self_customer()
  from public, anon;
grant execute on function public.ensure_employee_self_customer()
  to authenticated;

revoke execute on function public.import_marketplace_order(text, text, text, jsonb, jsonb, text)
  from public, anon;
grant execute on function public.import_marketplace_order(text, text, text, jsonb, jsonb, text)
  to authenticated, service_role;

revoke execute on function public.partspro_my_permissions()
  from public, anon;
grant execute on function public.partspro_my_permissions()
  to authenticated;

revoke execute on function public.resolve_customer_catalog_prices(uuid, text[])
  from public, anon;
grant execute on function public.resolve_customer_catalog_prices(uuid, text[])
  to authenticated;

revoke execute on function public.update_current_customer_profile(jsonb)
  from public, anon;
grant execute on function public.update_current_customer_profile(jsonb)
  to authenticated;

alter function private.customer_level_discount_amount(text)
  set search_path = private, public, pg_temp;

alter function private.is_customer_profile_complete_for_checkout(text, text, text, text, text, text)
  set search_path = private, public, pg_temp;
