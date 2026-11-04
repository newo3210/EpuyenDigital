# Adversarial fixes — round 1

**Change:** `areas-operators-admin`  
**Branch:** `cursor/areas-operators-admin-c2b5`  
**Date:** 2026-11-04  
**Source:** `reports/adversarial-review.md` (FAIL)

## Summary

Addressed the Blocker (service-role membership IDOR) and the cheap Major items (default clear, last-admin lock, Auth rollback). pgTAP remains unexecuted (no Docker) and is **not** claimed green.

## Fixes

| ID | Severity | Fix | Evidence |
|---|---|---|---|
| B1 | Blocker | `assertAreaIdsInOrg(admin, actor.orgId, ids)` before Auth create; wired in `createOperatorAction`; use case calls `assertAreasInOrg` before `createAuthUser` / membership upsert. No other elevated membership assign path. | `areas.ts`, `create-operator.ts`, `actions.ts`; tests: wrong-org rejected, Auth not created |
| B2 | Major | BEFORE UPDATE trigger `areas_guard_default_clear`: authenticated cannot set `is_default` true→false; must use `set_default_area` (SECURITY DEFINER bypasses). | `20261104140000_areas_operators_hardening.sql`; pgTAP `cannot_clear_default` authored |
| B3 | Major | `pg_advisory_xact_lock(hashtext(old.org_id::text))` before counting other active admins in `profiles_guard_last_admin`. | Same migration |
| B4 | Major | On `insertProfile` failure after `createAuthUser`, best-effort `auth.admin.deleteUser`. | `create-operator.ts` + rollback unit tests |
| B5 | Major | Honest: pgTAP still **not run** (no Docker in this environment). SQL file updated; do not treat as green. | `007_areas_operators.test.sql` `plan(26)`; this note |

## Residual gaps (for re-review / archive gate)

- **pgTAP / live RLS proof** still BLOCKED until `npm run test:db` (or equivalent) runs with Docker and evidence is attached.
- **Minors** from review not addressed this round: temp-password input type/UX, support-role edit footgun, `whatsapp_lines.default_area_id` same-org check.
- **Zero-default on first area create:** app still inserts `is_default=false`; forbid-clear only protects existing defaults. Seed always provides Mesa; empty-org bootstrap may still need a product decision.
- Concurrent last-admin demotion is locked in SQL but not proven by a concurrent pgTAP/CI case yet.

## Quality gate

- `npm run typecheck` — pass
- `npm test` — pass (569 tests)
- `npm run test:db` — **not run** (no Docker)

## Process

- Do **not** re-run full adversarial in this session; director schedules independent re-review after push.
