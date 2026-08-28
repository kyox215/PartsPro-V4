-- Retire the legacy supplier-batch cost/product RPC entry points after the
-- V2 application has been deployed and verified in production. Keep each
-- function and its owner intact so this is an execute-privilege cleanup only.
revoke execute on function public.admin_preview_supplier_batch_charge(text, jsonb)
  from public, anon, authenticated, service_role;

revoke execute on function public.admin_save_supplier_batch_charge_estimate(text, jsonb, text)
  from public, anon, authenticated, service_role;

revoke execute on function public.admin_confirm_supplier_batch_charge(text, jsonb, text, text)
  from public, anon, authenticated, service_role;

revoke execute on function public.admin_get_supplier_batch_products(text[])
  from public, anon, authenticated, service_role;

revoke execute on function public.admin_list_supplier_batch_cost_summaries(uuid[])
  from public, anon, authenticated, service_role;
