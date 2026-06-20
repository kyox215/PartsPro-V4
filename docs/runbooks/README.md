# PartsPro Runbooks

Runbooks are executable operating instructions for repeatable or risky workflows. They must stay aligned with `AGENTS.md`, the current codebase, and actual linked service state.

## Current Runbooks

- `release-checklist.md`: Vercel release readiness, Supabase migration separation, smoke tests, rollback and observation.

## Required Evidence

- Exact command run and result.
- Environment or target confirmed.
- Migration, release, smoke test, or rollback evidence when relevant.
- Residual risk and owner.

## Forbidden

- Do not use runbooks to bypass approval.
- Do not paste secrets, service role keys, production tokens, or sensitive customer data.
- Do not mark a production step complete without evidence.
