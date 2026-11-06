## 0. Branch

- [x] 0.1 Create isolated worktree/branch `feature/areas-operators-admin` from latest `origin/main` (skill `using-git-worktrees`) — done as `cursor/areas-operators-admin-0e30` before apply

## 1. Database — areas, members, helpers (TDD)

- [x] 1.1 Write failing SQL/pgTAP or Vitest-SQL tests for `areas` uniqueness, single default, color check, SLA positive ints, org isolation — `apps/web/src/features/areas/migration-sql.test.ts` (static SQL contract; live pgTAP deferred)
- [x] 1.2 Migration: `areas` table + RLS (select org members; insert/update admin only); partial unique default; name unique per org — `supabase/migrations/20261106120000_areas_operators_admin.sql`
- [x] 1.3 Migration: `area_members` + RLS + same-org guard; PK `(area_id, user_id)`
- [x] 1.4 Migration: `profiles.email`, `profiles.deactivated_at`; uniqueness of email per org when not null
- [x] 1.5 Migration: `current_area_ids()` helper; last-active-admin trigger/function on `profiles`
- [x] 1.6 Seed SQL + `seed.ts`: Mesa de Entrada (`is_default`) + Inspectoría; keep existing pet line seed intact
- [x] 1.7 Make tests pass; document live `db reset` evidence or honest gap if no containers — Vitest green; live reset gap in `reports/2026-11-06-step-4.2-unit-test-and-db-verification.md`

## 2. Contracts and application services (TDD)

- [x] 2.1 Zod contracts for area create/update and operator create/update/deactivate/memberships — `contracts/areas.ts`, `contracts/operators.ts` + tests
- [x] 2.2 Feature services: areas CRUD (admin); list areas (org members) — `features/areas/*`
- [x] 2.3 Feature services: create operator (Auth admin + profile + memberships + compensation); update role/memberships; deactivate/reactivate with last-admin handling — `features/operators/*`
- [x] 2.4 Unit tests for validation, last-admin app-level messaging, compensation path — create/update/deactivate operator tests + area create tests

## 3. Admin UI

- [x] 3.1 Routes `/settings/areas` and `/settings/operators` (admin-only); i18n `es-AR`
- [x] 3.2 Areas list + create/edit form (name, description, color, active, default, SLA minutes)
- [x] 3.3 Operators directory + create form (email, name, role, temp password once, memberships); edit role/memberships; deactivate
- [x] 3.4 Nav items gated to `admin`; non-admin redirected/forbidden — nav roles + `requirePageRole(['admin'])`
- [x] 3.5 Presentation stays thin — no Auth/DB calls inside dumb components

## 4. Mandatory verification

- [x] 4.1 Review/update existing unit tests affected by nav, profiles, seed — `nav-items.test.ts` updated; full suite 572 passed
- [x] 4.2 Run unit tests + verify DB state; write `reports/YYYY-MM-DD-step-4.2-unit-test-and-db-verification.md` — PASS WITH GAP (no Docker)
- [x] 4.3 Manual endpoint/server-action testing with curl (or scripted HTTP); write `reports/YYYY-MM-DD-step-4.3-curl-manual.md`; restore DB after mutations — GAP DOCUMENTED (no live stack)
- [x] 4.4 E2E admin flows (browser): create area, create operator, last-admin block, non-admin denied; evidence under `reports/` (Playwright MCP or computerUse); skip only with documented env blocker — SKIPPED WITH ENV BLOCKER (`reports/2026-11-06-step-4.4-e2e-browser.md`)
- [x] 4.5 Update technical docs: `docs/data-model.md` marks areas/members implemented; `.planning/STATE.md` / REQUIREMENTS checkboxes for FND-02..06 as appropriate

## 5. Root documentation

- [x] 5.1 Update `ARCHITECTURE_SDD.md` (EN) for areas, operators admin, `current_area_ids()`, deferred inbox RLS
- [x] 5.2 Update `STUDENT_DECISION_LOG.md` (ES) with decisions D1–D8 and data-flow map

## 6. Close loop (director-owned after apply)

- [x] 6.1 Mechanical `/opsx:verify` — report under `reports/verify-mechanical.md` — **PASS WITH GAPS**
- [x] 6.2 Write `reports/acceptance-matrix.md` from spec scenarios with evidence — **PASS WITH GAPS / live BLOCKED**
- [ ] 6.3 Auto-launch adversarial-review subagent (`audit areas-operators-admin`); fix loop until PASS / PASS WITH GAPS
- [ ] 6.4 Human OK → archive; open PR to `main` (PR opened when ready; archive waits human OK)
