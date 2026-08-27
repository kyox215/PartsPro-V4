-- P1 least-privilege remediation for existing supplier-batch tables.
--
-- Keep the scope deliberately narrow: remove only the direct TRUNCATE
-- privileges that are not required by the public application roles.  Do not
-- touch SELECT/INSERT/UPDATE/DELETE, and do not revoke service_role or owner
-- (postgres) privileges.  REVOKE is repeatable when a grant is already absent.
revoke truncate on table public.supplier_batches from anon, authenticated;
revoke truncate on table public.finance_cost_layers from authenticated;
