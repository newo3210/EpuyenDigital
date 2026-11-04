## Why

`main` ships the Inspectoría pet-registry vertical but never received `foundation-workspace-auth` (auth, org tenancy, profiles, error tracking, panel shell). That work lives only on `origin/feature/foundation-workspace-auth` (archived there 2026-10-05). Schema definitions for `organizations` already diverge. Without reconciliation, Mesa de Entrada home (real triage queue that derives to areas) cannot land on a coherent base.

Roadmap: **Phase 1 — Fundación (unblock / merge)** · Requirements preserved: **FND-01, FND-06, FND-07, FND-08**.  
Product direction locked 2026-11-04: next epic is real inbox on the **same** WhatsApp line as Inspectoría, manual distribution first, dual location storage (pet vs inquiry) with map on the home citizen card — **out of this change**, documented as follow-ups.

## What Changes

- Integrate foundation commits into a branch based on current `main` (worktree/branch `feature/reconcile-foundation-to-main`).
- Reconcile Postgres migrations so one history creates: foundation tables (`profiles`, `error_logs`, RLS helpers, avatars) **and** pet-registry tables (`org_settings`, `citizens`, `animals`, `messages`, `jobs`, …) without conflicting `organizations` shapes.
- Prefer the **superset** `organizations` model: keep pet columns (`timezone`, `updated_at`) plus foundation expectations; keep `org_settings` from pets.
- Bring panel app code from foundation (login, layout, empty inbox/citizens/tasks, profile, support errors) while keeping pet webhook/worker paths on `main`.
- Sync OpenSpec: copy foundation capabilities into `openspec/specs/` if missing on `main`; archive/remove the stale active `openspec/changes/foundation-workspace-auth` folder on `main` after specs are present (canonical archive already on feature branch as `2026-10-05-foundation-workspace-auth`).
- Update root `ARCHITECTURE_SDD.md` and `STUDENT_DECISION_LOG.md` for the integrated baseline.
- Prove: auth happy path + pet registry unit/contract tests + SQL tests that still apply.

## Capabilities

### New Capabilities

- `foundation-main-integration`: coherent `main`-line codebase where foundation auth/tenancy/panel shell and Inspectoría pet registry coexist; documented migration reconciliation and regression gates.

### Modified Capabilities

- None at requirement text level for pet specs (`animal-registry`, `inspectoria-whatsapp-channel`, `pet-registration-conversation`) — behavior must remain; only shared infra (`organizations`) is extended carefully.
- Foundation capabilities (`operator-auth`, `org-tenancy`, `operator-profile`, `error-tracking`, `local-dev-environment`) are **restored onto main specs** from the archived change (not rewritten unless merge forces a documented delta).

## Impact

- Git: merge/rebase from `origin/feature/foundation-workspace-auth` onto latest `main`; expect conflicts in `supabase/migrations`, `apps/web`, `package.json`, OpenSpec trees, root docs.
- DB: single migration chain; possible additive migration if replay-from-scratch is cleaner than rewriting history (decision in `design.md`).
- Apps: `apps/web` gains auth/panel; webhook routes from pets remain.
- Worker / packages: keep pet registry; ensure shared types do not clash with foundation contracts.
- Follow-up changes (not this PR): `areas-operators-admin`, then `mesa-entrada-inbox` (real queue, shared line, manual distribute, inquiry coords + map on card).
