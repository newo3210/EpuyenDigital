# Merge conflicts report — `reconcile-foundation-to-main`

**Base:** `cursor/reconcile-foundation-to-main-c2b5` (main + OpenSpec plan)  
**Merged:** `origin/feature/foundation-workspace-auth`  
**Date:** 2026-11-04

## Strategy

Merge (not cherry-pick). Prefer foundation for auth/panel/app shell; prefer pets for webhook/worker/registration; union env, package workspaces, and docs.

## Conflicts and resolutions

| Path | Resolution |
|---|---|
| `.env.example` | Union: foundation `NEXT_PUBLIC_*` / seed / cloud + pet webhook/Evolution/vision/worker vars |
| `.planning/REQUIREMENTS.md` | Keep both histories; footer dated 2026-11-04 |
| `.planning/STATE.md` | Reconciled focus: foundation on mainline; next `areas-operators-admin` then `mesa-entrada-inbox` |
| `ARCHITECTURE_SDD.md` | Integrated baseline (foundation + pets) + deferred dual-coords / shared WA line / real inbox |
| `STUDENT_DECISION_LOG.md` | ES log covering merge rationale + schema superset |
| `README.md` | Monorepo overview covering panel + webhook/worker |
| `package.json` / `package-lock.json` | Workspaces: `apps/web`, `worker`, `packages/shared`; foundation tooling + pet scripts; regenerated lockfile |
| `apps/web/package.json` | Foundation Next/auth deps; keep `test` script; port 3000 |
| `apps/web/next.config.ts` | Foundation (env fail-fast, authInterrupts, avatar body limit) |
| `apps/web/src/app/layout.tsx` | Foundation (globals.css, metadata) |
| `apps/web/src/app/page.tsx` | Foundation `redirect('/inbox')`; webhook stays under `/api` |
| `apps/web/tsconfig.json` | Extends base + Next plugins/paths |
| `apps/web/vitest.config.ts` | Foundation jsdom + React plugin; alias shared + dedupe react |
| `packages/shared/package.json` | Keep dist build for worker; foundation + pet exports |
| `packages/shared/src/index.ts` | Union foundation helpers + pet registration/contracts |
| `packages/shared/src/contracts/database.types.ts` | Foundation generated shape + org timezone/updated_at + pet tables/RPCs |
| `packages/shared/src/contracts/contracts.test.ts` | Concatenated foundation + pet Zod suites |
| `packages/shared/tsconfig.json` / `vitest.config.ts` | Build to dist; exclude `*.test.ts` from emit |
| `tsconfig.base.json` | Strict shared base (noEmit left to packages) |
| `supabase/config.toml` | Foundation full config (auth signup off, password length 10); `project_id = epuyendigital` |
| `vitest.workspace.ts` | Removed; root `vitest.config.ts` lists web/shared/worker projects |

## Auto-merged / taken from foundation without content conflict

- Foundation migrations `20260930*` / `20261005*`
- Panel routes, auth/profile/errors features, middleware
- OpenSpec archive `2026-10-05-foundation-workspace-auth` and specs under `openspec/specs/`
- SQL tests under `supabase/tests/`
- Pet migrations `20261012*` and webhook/worker trees retained from HEAD

## Follow-up migration (not a merge conflict)

Added `supabase/migrations/20261104120000_reconcile_organizations_superset.sql` — see `schema-reconcile.md`.
