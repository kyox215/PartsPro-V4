-- Keep supplier-management write policies out of SELECT policy evaluation.

drop policy if exists "partspro_suppliers_admin_write" on public.suppliers;
drop policy if exists "partspro_suppliers_admin_insert" on public.suppliers;
drop policy if exists "partspro_suppliers_admin_update" on public.suppliers;
drop policy if exists "partspro_suppliers_admin_delete" on public.suppliers;

drop policy if exists "partspro_supplier_batches_admin_write" on public.supplier_batches;
drop policy if exists "partspro_supplier_batches_admin_insert" on public.supplier_batches;
drop policy if exists "partspro_supplier_batches_admin_update" on public.supplier_batches;
drop policy if exists "partspro_supplier_batches_admin_delete" on public.supplier_batches;

drop policy if exists "partspro_supplier_batch_lines_admin_write" on public.supplier_batch_lines;
drop policy if exists "partspro_supplier_batch_lines_admin_insert" on public.supplier_batch_lines;
drop policy if exists "partspro_supplier_batch_lines_admin_update" on public.supplier_batch_lines;
drop policy if exists "partspro_supplier_batch_lines_admin_delete" on public.supplier_batch_lines;

create policy "partspro_suppliers_admin_insert"
  on public.suppliers
  for insert
  to authenticated
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy "partspro_suppliers_admin_update"
  on public.suppliers
  for update
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')))
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy "partspro_suppliers_admin_delete"
  on public.suppliers
  for delete
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')));

create policy "partspro_supplier_batches_admin_insert"
  on public.supplier_batches
  for insert
  to authenticated
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy "partspro_supplier_batches_admin_update"
  on public.supplier_batches
  for update
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')))
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy "partspro_supplier_batches_admin_delete"
  on public.supplier_batches
  for delete
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')));

create policy "partspro_supplier_batch_lines_admin_insert"
  on public.supplier_batch_lines
  for insert
  to authenticated
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy "partspro_supplier_batch_lines_admin_update"
  on public.supplier_batch_lines
  for update
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')))
  with check ((select private.partspro_has_permission('product.edit_content')));

create policy "partspro_supplier_batch_lines_admin_delete"
  on public.supplier_batch_lines
  for delete
  to authenticated
  using ((select private.partspro_has_permission('product.edit_content')));
