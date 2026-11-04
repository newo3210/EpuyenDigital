## Context

- `main` @ pet UX v2: webhook host + pet migrations (`20261012*`), no operator auth UI.
- `origin/feature/foundation-workspace-auth`: full foundation (archived OpenSpec 2026-10-05), migrations `20260930*` / `20261005*`, panel routes with empty states.
- Merge-base divergence: foundation ≈82 commits ahead; `main` ≈1 commit ahead with the entire pet vertical — high conflict density in shared roots (`organizations`, app entry, package manifests).
- Product north star after this change: Mesa de Entrada home as derivation hub; Inspectoría remains an area vertical on the **same** WhatsApp line initially.

## Goals / Non-Goals

**Goals:**

- One branch based on `main` that includes foundation behavior and pet registry.
- One Postgres schema creatable from empty via ordered migrations (local reset works).
- Auth session + protected panel shell usable.
- Pet inbound processing still green under `dry_run`.
- OpenSpec specs for foundation capabilities visible on the delivery branch’s `openspec/specs/`.
- Root docs describe the integrated baseline and the deferred inbox decisions (shared line, dual coords, map on card).

**Non-Goals:**

- Implementing real triage queue, claim, or area distribution UI.
- Creating `areas` / `area_members` (next change).
- Inquiry location columns, map component, or citizen-card map UX (next inbox change).
- Automatic classification / RAG.
- Rewriting pet conversation state machine.
- Completing adversarial review for `inspectoria-pet-registry-ux-v2` (optional parallel).

## Decisions

### D1 — Integration strategy

Prefer **merge `origin/feature/foundation-workspace-auth` into a branch cut from `main`**, resolve conflicts deliberately, then add a **forward-only reconciliation migration** if history cannot express the superset cleanly.

Alternative considered: cherry-pick foundation onto `main` — rejected (82 commits, higher miss risk).  
Alternative: reset `main` to foundation and replay pet — rejected (rewrites published pet history on `main`).

### D2 — `organizations` superset

Canonical columns after reconcile:

- From foundation: `id`, `name`, `slug`, `created_at`
- From pets: `timezone` (default `America/Argentina/Buenos_Aires`), `updated_at` + trigger
- Keep pet `org_settings` (send_mode, allowlist, TTL, privacy version)

If foundation migration creates a narrower table first in replay order, the pet migration must use `alter table … add column if not exists` **or** a new `20261104*_reconcile_organizations.sql` applies the alters idempotently. Choose the path that keeps `supabase db reset` green; document the chosen path in the implementation report.

### D3 — App composition

- Foundation owns: `(auth)/login`, `(panel)/*` shell, error reporting, profile.
- Pets own: `/api/webhooks/evolution`, inbound infrastructure, worker registration jobs.
- Root `/` : prefer foundation redirect-to-panel/login over pet “webhook host” placeholder; keep health + webhook routes.

### D4 — OpenSpec hygiene on `main`

- Ensure `openspec/specs/{operator-auth,org-tenancy,operator-profile,error-tracking,local-dev-environment}/` exist (copy from feature-branch archive if missing).
- After merge verification, remove or archive the **stale active** `openspec/changes/foundation-workspace-auth` on `main` so directors do not re-implement it.
- Keep this change folder until human archive OK.

### D5 — Dual locations (document only)

Do **not** overload `citizens.latitude/longitude` (pet registration GPS) with mesa inquiry pins. Future inbox change stores inquiry coords separately (message location payload and/or conversation fields) for later enrich comparison. Recorded here so implementers do not “reuse” pet columns for the home map.

### D6 — Shared WhatsApp line (document only)

Until a second line exists, Mesa and Inspectoría share `+5492944216586`. Routing will be by conversation/area purpose in later changes, not by phone number.

## Clean Architecture mapping

| Layer | Responsibility in this change | Concrete paths |
|---|---|---|
| Presentation / HTTP thin | Login pages, panel layouts, error support UI; webhook route stays thin | `apps/web/src/app/(auth)/**`, `apps/web/src/app/(panel)/**`, `apps/web/src/app/api/webhooks/evolution/**`, `apps/web/src/app/api/errors/**` |
| Application / services | Auth guards, profile/error use-cases; pet process-inbound unchanged | `apps/web/src/features/auth/**`, `features/profile/**`, `features/errors/**`; `worker/src/jobs/**` |
| Infrastructure / repositories | Supabase clients, storage avatars, inbound store | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**` |
| Contracts / schemas | Zod auth/profile/errors + pet citizen/animal contracts | `apps/web/src/contracts/**`, `packages/shared/src/contracts/**` |

No new LLM boundaries in this change.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Migration order breaks fresh reset | Prove with `supabase db reset` (or equivalent SQL test bootstrap) on the delivery branch |
| Accidental pet webhook regression | Run pet unit/contract suite + smoke dry_run path after merge |
| Duplicate OpenSpec / stale foundation change confuses agents | Explicit hygiene tasks + STATE note |
| Large merge PR hard to review | Keep change scoped to reconcile; no inbox features in the same PR |
| Auth secrets / env drift | Align `.env.example` from both trees; document required vars |

## Rollback

- Do not merge to `main` until verify + acceptance matrix + adversarial review for **this** change.
- If production/dev DB already has pet-only schema, apply only forward migrations (never rewrite applied pet migrations in place on shared environments).

## Follow-ups (explicit)

1. `areas-operators-admin` — Mesa de Entrada default area + Inspectoría area + FND-02..05.
2. `mesa-entrada-inbox` — real queue, shared line routing, manual distribute, citizen card + inquiry map, dual coords.
3. Optional: finish adversarial review for `inspectoria-pet-registry-ux-v2`.
