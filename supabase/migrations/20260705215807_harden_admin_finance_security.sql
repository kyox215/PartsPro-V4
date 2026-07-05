-- Harden the admin finance ledger objects created by
-- 20260701210603_admin_finance_ledger.
--
-- The export audit is now written server-side with the service role, so this
-- public SECURITY DEFINER RPC is no longer needed. Dropping it also avoids
-- exposing an admin-only RPC surface to anon/authenticated roles.
drop function if exists public.admin_audit_finance_export(jsonb);

do $$
begin
  drop policy if exists "partspro_finance_cost_layers_reconcile"
    on public.finance_cost_layers;
  drop policy if exists "partspro_finance_allocations_reconcile"
    on public.finance_order_line_cost_allocations;
  drop policy if exists "partspro_finance_expenses_manage"
    on public.finance_expense_entries;
  drop policy if exists "partspro_supplier_batch_payments_manage"
    on public.supplier_batch_payments;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_cost_layers'
      and policyname = 'partspro_finance_cost_layers_reconcile_insert'
  ) then
    create policy "partspro_finance_cost_layers_reconcile_insert"
      on public.finance_cost_layers
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_cost_layers'
      and policyname = 'partspro_finance_cost_layers_reconcile_update'
  ) then
    create policy "partspro_finance_cost_layers_reconcile_update"
      on public.finance_cost_layers
      for update
      to authenticated
      using ((select private.partspro_has_permission('finance.cost_reconcile')))
      with check ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_cost_layers'
      and policyname = 'partspro_finance_cost_layers_reconcile_delete'
  ) then
    create policy "partspro_finance_cost_layers_reconcile_delete"
      on public.finance_cost_layers
      for delete
      to authenticated
      using ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_order_line_cost_allocations'
      and policyname = 'partspro_finance_allocations_reconcile_insert'
  ) then
    create policy "partspro_finance_allocations_reconcile_insert"
      on public.finance_order_line_cost_allocations
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_order_line_cost_allocations'
      and policyname = 'partspro_finance_allocations_reconcile_update'
  ) then
    create policy "partspro_finance_allocations_reconcile_update"
      on public.finance_order_line_cost_allocations
      for update
      to authenticated
      using ((select private.partspro_has_permission('finance.cost_reconcile')))
      with check ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_order_line_cost_allocations'
      and policyname = 'partspro_finance_allocations_reconcile_delete'
  ) then
    create policy "partspro_finance_allocations_reconcile_delete"
      on public.finance_order_line_cost_allocations
      for delete
      to authenticated
      using ((select private.partspro_has_permission('finance.cost_reconcile')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_expense_entries'
      and policyname = 'partspro_finance_expenses_manage_insert'
  ) then
    create policy "partspro_finance_expenses_manage_insert"
      on public.finance_expense_entries
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_expense_entries'
      and policyname = 'partspro_finance_expenses_manage_update'
  ) then
    create policy "partspro_finance_expenses_manage_update"
      on public.finance_expense_entries
      for update
      to authenticated
      using ((select private.partspro_has_permission('finance.manage')))
      with check ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'finance_expense_entries'
      and policyname = 'partspro_finance_expenses_manage_delete'
  ) then
    create policy "partspro_finance_expenses_manage_delete"
      on public.finance_expense_entries
      for delete
      to authenticated
      using ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_payments'
      and policyname = 'partspro_supplier_batch_payments_manage_insert'
  ) then
    create policy "partspro_supplier_batch_payments_manage_insert"
      on public.supplier_batch_payments
      for insert
      to authenticated
      with check ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_payments'
      and policyname = 'partspro_supplier_batch_payments_manage_update'
  ) then
    create policy "partspro_supplier_batch_payments_manage_update"
      on public.supplier_batch_payments
      for update
      to authenticated
      using ((select private.partspro_has_permission('finance.manage')))
      with check ((select private.partspro_has_permission('finance.manage')));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_batch_payments'
      and policyname = 'partspro_supplier_batch_payments_manage_delete'
  ) then
    create policy "partspro_supplier_batch_payments_manage_delete"
      on public.supplier_batch_payments
      for delete
      to authenticated
      using ((select private.partspro_has_permission('finance.manage')));
  end if;
end
$$;
