# ADR-0001: AI Company OS Governance Integration

- Status: accepted
- Date: 2026-06-19
- Decision owners: 总调度/项目经理, 文档审计部
- Related task: `docs/tasks/done/P2-2026-06-19-ai-company-os-adoption.md`
- Supersedes: none

## Context

PartsPro already has a root `AGENTS.md` with project-specific rules for Next.js 16, Supabase, business contracts, migration safety, Vercel release separation, and AI department routing. The owner asked to fully integrate `/Users/kyox215/Downloads/AI_Company_OS/`.

## Decision Drivers

- Keep the full AI Company OS searchable and reusable inside the repo.
- Avoid replacing production-sensitive PartsPro rules with generic rules.
- Give future agents concrete files for charter, roadmap, risks, decisions, runbooks, and task flow.
- Preserve low-friction execution for low-risk tasks.

## Considered Options

### Option A: Copy AI Company OS over root rules

Rejected. This would likely conflict with Supabase and Next.js project-specific safety rules.

### Option B: Only keep the prior adoption plan

Rejected. The owner explicitly requested full integration.

### Option C: Import the full package under `.ai-company/` and add a PartsPro execution layer

Accepted. This gives full access to the OS while keeping `AGENTS.md` authoritative.

## Decision

The full AI Company OS package is stored under `.ai-company/`. PartsPro-specific execution files live under `docs/`, and `AGENTS.md` defines precedence and required routing.

## Consequences

### Positive

- Future agents can read the full governance package without relying on Downloads.
- PartsPro keeps its Supabase, Vercel, business-contract, and Next.js safety gates.
- The project gains a charter, roadmap, risk register, decision log, ADR folder, runbook entry, and upgraded task templates.

### Negative / Trade-offs

- There are now two layers of rules, so precedence must be explicit.
- Generic templates may still need adaptation before use.
- More documentation exists, so stale-document risk increases.

## Risks And Mitigations

- Risk: Agent follows `.ai-company/MASTER_PROMPT.md` over `AGENTS.md`.
  Mitigation: Root `AGENTS.md` and `.ai-company/PARTSPRO_INTEGRATION.md` state priority.
- Risk: Task overhead grows.
  Mitigation: Low-risk tasks can use simplified task cards; R2+ tasks use full work packages.
- Risk: Release or migration actions become too automated.
  Mitigation: `docs/runbooks/release-checklist.md` keeps migration and release approval separate.

## Validation Plan

- Run `git diff --check`.
- Confirm no business code, migration, secret, linked database, or Vercel deployment is modified by this governance integration.
- Use the new workflow on at least one future doc task and one low-to-medium risk product task.

## Revisit Conditions

- The rule layers confuse agents in real work.
- The workflow causes excessive overhead.
- Supabase, Vercel, or Next.js project constraints materially change.
