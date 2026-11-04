# Adversarial re-audit — areas-operators-admin

**Scope:** OpenSpec change `areas-operators-admin` · branch `cursor/areas-operators-admin-c2b5` vs `origin/main`  
**Date:** 2026-11-04  
**Reviewer:** Independent adversarial session (not the apply implementer; not the round-1 fix author session)  
**Prior:** `reports/adversarial-review.md` (FAIL) · `reports/adversarial-fixes-round1.md`  
**Sources:**
- Specs: `proposal.md`, `design.md`, `tasks.md`, `specs/{municipal-areas,operator-admin,area-membership,org-tenancy}/spec.md`
- Fix commits: `18f7332` (B1/B4 app), `1ea4366` (B2/B3 SQL)
- Code: `features/admin/create-operator.ts`, `actions.ts`, `repositories/areas.ts`, `20261104140000_areas_operators_hardening.sql`, `007_areas_operators.test.sql`
- Unit evidence: vitest admin + `areas-assert-org` (23 tests pass this session)

## Spec and task alignment

| Prior ID | Claim after round 1 | Re-audit observation |
|---|---|---|
| B1 Blocker | `assertAreaIdsInOrg` before Auth create; no other elevated membership path | **Fixed.** Wired in use case + `createOperatorAction`; `assignMembershipAction` remains user-scoped + RLS. Unit: wrong-org rejected, Auth not created. |
| B2 Major | `areas_guard_default_clear` blocks authenticated `is_default` true→false | **Fixed** for the reported abuse path. `set_default_area` (SECURITY DEFINER) still moves default (`current_user` ≠ `authenticated`, same pattern as foundation guards). pgTAP assertion authored, not executed. |
| B3 Major | `pg_advisory_xact_lock(hashtext(org_id))` before last-admin count | **Fixed** in SQL. Concurrent demotion case still not live-proven (Gap). |
| B4 Major | Best-effort `deleteAuthUser` on profile insert failure | **Fixed.** Unit covers rollback success and rollback-failure swallow. |
| B5 Major | Live pgTAP / RLS proof | **Downgraded to Gap** (Docker absent; not claimed green). No longer archive-blocking once B1–B4 hold. |

Acceptance matrix still lists 4 SQL/E2E BLOCKED rows; that is consistent with Gap, not a revived Blocker, given the app/SQL hardening above.

## Prior finding disposition

| ID | Prior severity | Disposition | Evidence |
|---|---|---|---|
| B1 | Blocker | **Resolved** | `assertAreasInOrg` runs before `createAuthUser`; `assertAreaIdsInOrg(admin, actor.orgId, ids)` filters by `org_id` + requires full id coverage; foreign id → `areas.foreign_org` → UI `invalidAreas`; `assignMemberships` only after assert. No second service-role membership writer found. |
| B2 | Major | **Resolved** (clear-last-default) | Trigger raises `cannot_clear_default` when `current_user = 'authenticated'` and `is_default` true→false/NULL. App `updateAreaRow` never touches `is_default`. Residual: empty-org can still create areas with `is_default=false` only (see Gaps). |
| B3 | Major | **Resolved** (race class) | Lock taken inside `profiles_guard_last_admin` before count; serializes demote/deactivate per org under read committed. |
| B4 | Major | **Resolved** | Nested try/catch deletes Auth user on `insertProfile` failure; membership assign not reached. |
| B5 | Major | **Gap** (not Blocker/Major) | `007_areas_operators.test.sql` `plan(26)` includes clear-default + prior RLS cases; `npm run test:db` not runnable here (`docker` missing). |

## Findings (remaining)

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| Gap | Verification | Live pgTAP / RLS / concurrent last-admin still unexecuted | Docker absent this env; acceptance matrix SQL rows BLOCKED; round-1 note honest | Run `npm run test:db` in CI or local Docker; attach log before archive preference |
| Gap / Question | Default invariant (bootstrap) | Forbid-clear protects existing defaults; app inserts `is_default=false`; empty org can have zero defaults until `set_default_area` | `insertArea` always false; seed supplies Mesa for Epuyén | Product: auto-default first area, or require `set_default_area` on create; or document seed-only guarantee in spec |
| Minor | Temp password UX | Input remains `type="text"`; success state re-echoes password | `operator-create-form.tsx` | password + reveal/copy; clear field on success |
| Minor | Support role edit | Unknown roles coerce to `operator` on save | `operator-edit-form.tsx` `defaultValue` fallback | Preserve / disable non-UI roles |
| Minor | Line→area tenancy | `whatsapp_lines.default_area_id` FK without same-org check | Migration column add only | Same-org trigger when a line UI lands |
| Minor | Membership partial failure | If elevated `assignMemberships` fails mid-loop after profile insert, Auth+profile remain (manageable; not orphan Auth) | `actions.ts` loop upsert | Optional compensate or transactional RPC later |

### Adversarial probes that did not revive Blocker/Major

| Probe | Result |
|---|---|
| Create-operator IDOR via foreign `areaIds` | Rejected before Auth create (unit) |
| Other elevated membership path | Only create-operator uses admin client for upsert; assign/remove use RLS client |
| Authenticated clear last default | Blocked by trigger design; RPC path uses SECURITY DEFINER bypass (foundation-consistent `current_user` check) |
| Concurrent last-admin demotion | Lock present; not live-raced (Gap only) |
| Profile insert failure orphan Auth | `deleteAuthUser` invoked (unit) |
| Non-admin create / area write | Still forbidden in unit tests |
| Fake inbox completion | Still empty placeholder; non-goal honored |
| Temp password application logging | No `console`/logger leak of password found on create path |

## Verdict

**PASS WITH GAPS**

No remaining **Blocker** or **Major**. Prior FAIL items B1–B4 are addressed in code/SQL with unit coverage for the app fixes. Live pgTAP absence is tracked as a **Gap** only (per re-audit rule once Blocker/Major are cleared). Minors and bootstrap-default Question remain follow-ups.

Archive is **conditionally advisable** after human OK: prefer attaching `test:db` evidence when Docker/CI is available, but absence alone should not re-FAIL this change given the resolved authz and invariant fixes.

## Recommended next steps (before archive)

1. Human sign-off on PASS WITH GAPS (accept pgTAP Gap + minors).
2. Optional: run `npm run test:db` when Docker exists; refresh acceptance-matrix SQL rows.
3. Optional follow-ups: temp-password UX, support-role edit, line `default_area_id` same-org check, empty-org default policy.
4. Proceed to `/opsx:archive` only after human OK (writer ≠ this reviewer).
