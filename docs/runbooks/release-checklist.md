# PartsPro Release Checklist

Release ID / Version:
Release owner:
Approver:
Risk level:
Window:
Related task:
Related migrations:

## Release Principles

- Vercel release and Supabase migration application are separate actions.
- Production release must not be used to hide failed lint, build, migration, or smoke checks.
- Any release that depends on unapplied migration must stop until migration state is verified.
- If linked project target is unclear, stop and ask the owner.

## Before Release

- [ ] Scope and version fixed.
- [ ] `git status --short` reviewed; unrelated user changes are not included.
- [ ] Required task card exists under `docs/tasks/`.
- [ ] `npm run lint` passed or failure is documented and accepted.
- [ ] `npm run build` passed or failure is documented and accepted.
- [ ] QA conclusion recorded for affected pages/APIs.
- [ ] PartsPro business-contract validation completed for price, order, inventory, customer, permission, payment or after-sales request changes.
- [ ] Security/RLS review completed where required.
- [ ] Supabase migration list checked if schema changed.
- [ ] Supabase dry-run includes only this task's migration if applying linked migration.
- [ ] No destructive SQL, broad data update, permission rewrite, auth/storage change, or production backfill is present without explicit approval.
- [ ] Config and secrets validated without exposing secret values.
- [ ] Rollback or compensation path documented.
- [ ] Stakeholders informed when customer-facing behavior changes.

## During Release

- [ ] Correct Vercel project/environment confirmed.
- [ ] Correct Supabase project ref/name confirmed if database work is involved.
- [ ] Deployment steps recorded.
- [ ] Migration steps recorded separately from deployment steps.
- [ ] Smoke tests run against the intended environment.
- [ ] Error logs and key metrics checked.

## After Release

- [ ] Storefront home/catalog/product/cart/checkout path smoke tested when affected.
- [ ] Admin/order/inventory/after-sales request path smoke tested when affected.
- [ ] Data consistency checks run when database behavior changed.
- [ ] Customer/support signals checked when customer-facing.
- [ ] Temporary flags, access, debug logs and test data cleaned up.
- [ ] Release notes or task result updated.
- [ ] Observation period completed.

## Rollback Decision

- Trigger:
- Decision owner:
- Rollback action:
- Data compensation needed:
- Result:
