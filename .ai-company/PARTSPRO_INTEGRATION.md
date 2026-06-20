# PartsPro Integration Note

Status: active
Last reviewed: 2026-06-19

## Purpose

This directory contains the full AI Company OS reference package imported from `/Users/kyox215/Downloads/AI_Company_OS/`.

For PartsPro, this package is a governance library, not a replacement for project-specific rules. Agents should use it to improve task intake, role routing, decision records, risk handling, quality gates, release discipline, and retrospectives.

## Rule Priority

When instructions conflict, use this order:

1. Law, safety, platform policy, and the user's current explicit instruction.
2. Root `AGENTS.md` and PartsPro-specific documents under `docs/`.
3. Approved PartsPro project charter, decisions, runbooks, and task cards.
4. Relevant files in `.ai-company/`.
5. Generic preferences from any individual role or template.

The root `AGENTS.md` remains the repository truth source.

## How To Use

- Start with `AGENTS.md`, `docs/project-charter.md`, and the current task card.
- Read `.ai-company/PROJECT_RULES.md` and `.ai-company/TASK_FLOW.md` for non-trivial work.
- Read only task-relevant domain files, such as `.ai-company/QA_QUALITY_GATES.md`, `.ai-company/RELEASE_OPERATIONS.md`, `.ai-company/DATA_API_STANDARDS.md`, or `.ai-company/SECURITY_POLICY.md`.
- Use `.ai-company/templates/` as source templates, then adapt them into PartsPro documents or task records.
- Do not paste generic AI Company OS language into runtime rules without checking PartsPro-specific Supabase, Next.js, business-contract, and Vercel constraints.

## PartsPro Execution Layer

The project-specific execution layer lives in:

- `docs/project-charter.md`
- `docs/roadmap.md`
- `docs/risks/risk-register.md`
- `docs/decisions/decision-log.md`
- `docs/adr/`
- `docs/runbooks/`
- `docs/tasks/`
- `docs/agents/`

## Non-Negotiable PartsPro Overrides

- Supabase linked project `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4` is production-sensitive.
- Vercel release and Supabase migration application are separate approval paths.
- Price, order, inventory, customer, permission, RMA, and payment behavior require PartsPro business-contract validation.
- Next.js 16 work requires reading relevant local docs under `node_modules/next/dist/docs/` before coding.
- No agent may raise autonomy to L3/L4 without explicit approval.
