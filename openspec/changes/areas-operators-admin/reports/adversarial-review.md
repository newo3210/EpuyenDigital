# Adversarial review — areas-operators-admin

**Scope:** OpenSpec change `areas-operators-admin` · branch `cursor/areas-operators-admin-c2b5` vs `origin/main`  
**Date:** 2026-11-04  
**Reviewer:** Independent adversarial session (not the apply implementer)  
**Sources:**
- Specs: `proposal.md`, `design.md`, `tasks.md`, `specs/{municipal-areas,operator-admin,area-membership,org-tenancy}/spec.md`
- Reports: `reports/acceptance-matrix.md`, `reports/verify-mechanical.md`, `reports/implementation-notes.md`
- Diff: `origin/main...HEAD` (migration, seed, `features/admin/**`, settings routes, docs)

## Spec and task alignment

| Claim | Spec / task | Implementation observation |
|---|---|---|
| Admin CRUD areas + single default | municipal-areas | App path uses RLS insert/update + `set_default_area` RPC; **DB allows clearing all defaults** (see Finding B2) |
| Last active admin protected | operator-admin / design D2 | Trigger `profiles_guard_last_admin` present; unit mapping tested; **pgTAP not run**; **TOCTOU race** (B3) |
| Create operator + temp password once, not logged | design D3 | Returned in action state to UI; **no app `console` logging of password found**; orphan-user risk on partial failure (B4) |
| Only admin mutates operators/areas/memberships | D4 / tasks 3.4 | `requireRole` / `requirePageRole` on pages + use cases; areas/members write RLS admin-only — **except service-role membership assign on create** (B1) |
| Seed Mesa + Inspectoría + line `default_area_id` | tasks 2.x | Present in `seed.sql` + `seed.ts` with fixed UUIDs |
| `operator_area_ids` without conversations table | org-tenancy | Helper present; no `conversations` in this migration — OK |
| Inbox / triage out of scope | design non-goals | `/inbox` remains empty placeholder — **not fake-completed** |
| SQL proof | tasks 1.3 / 5.3 | pgTAP authored; **not executed** (no Docker) — residual (B5) |

Acceptance matrix marks several security scenarios PASS (unit) while SQL is BLOCKED. Unit tests prove use-case role gates with mocks; they do **not** prove RLS, last-admin SQL, or default uniqueness under a live database.

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Blocker** | Authz / IDOR | `createOperatorAction` assigns memberships with the **service-role** client and never checks that `areaIds` belong to `actor.orgId`. A caller who passes foreign-org area UUIDs gets `area_members` rows that RLS would have rejected. Org-B admins can then see a foreign `user_id` on their area; tenancy invariant is broken on the privileged path. | `actions.ts` `assignMemberships` → `upsertMembership(admin, …)`; `create-operator.ts` has no org/area ownership validation; contrast with `area_members_insert_admin` RLS which requires area+user same org | **Code:** resolve/validate each `areaId` under the user-scoped client (or `org_id = actor.orgId`) before upsert; prefer authenticated client for memberships after profile insert. **Tests:** unit + pgTAP cross-org membership reject via create path |
| **Major** | Default area invariant | Spec/design require **exactly one** `is_default` per org. Migration only has a partial unique index (**at most one**). Authenticated admins may `UPDATE areas SET is_default = false` (column not restricted; update policy allows any column). Org can end with **zero** defaults; future hub routing then has no Mesa. App `updateAreaRow` does not flip `is_default`, but PostgREST/SQL clients can. | `municipal-areas` “Exactly one”; `areas_one_default_per_org_uidx`; `areas_update_admin` without column guard; no trigger forcing default writes through `set_default_area` | **SQL:** BEFORE UPDATE/INSERT trigger (or revoke direct updates of `is_default` / route solely via RPC) so clearing the last default raises; optionally assert ≥1 default per org on write. **Tests:** pgTAP “cannot clear last default” |
| **Major** | Last-admin concurrency | `profiles_guard_last_admin` counts other active admins then allows demote/deactivate without locking that set. Two concurrent updates demoting the only two admins can both observe `other_active_admins = 1` and both succeed → **zero active admins**. | Trigger body in `20261104130000_areas_operators.sql` (count then raise); no `FOR UPDATE` / advisory lock | **SQL:** `PERFORM pg_advisory_xact_lock(hashtext(org_id::text))` or `SELECT id FROM profiles … FOR UPDATE` before count. **Tests:** concurrent demotion case in pgTAP/CI |
| **Major** | Operator create reliability / abuse surface | Create order is `auth.admin.createUser` → profile insert → memberships. On profile failure, Auth user remains with no profile: panel cannot manage them; retry hits “duplicate email”. Compensating delete is absent. | `create-operator.ts` try/catch maps failure but does not roll back Auth user; `actions.ts` create path | **Code:** on profile failure, `auth.admin.deleteUser(id)` (best-effort) or create profile before confirming login; document manual recovery. **Tests:** simulate insertProfile throw → assert deleteUser called |
| **Major** | Verification gap (RLS / SQL) | Security-critical claims (cross-org area isolation, last_admin reject, default uniqueness, `operator_area_ids`) rest on unexecuted `007_areas_operators.test.sql`. Mechanical verify and acceptance already WARNING/BLOCKED; no CI log on this branch proves green SQL. Archiving would accept authz by code reading alone. | `reports/implementation-notes.md`, `verify-mechanical.md`, `acceptance-matrix.md` (4 BLOCKED); Docker absent in review env | **Tests/CI:** run `npm run test:db` (or equivalent) and attach evidence before archive; do not treat unit mocks as RLS proof |
| Minor | Temp password UX / exposure | Design: return once, not logged. No application log of `temporaryPassword` found (good). Input is `type="text"` and remains populated after success while action state also echoes the secret into the flight payload — broader exposure than “show once” implies (DOM, screenshots, browser assist). | `operator-create-form.tsx` (`type="text"`); `createOperatorAction` returns `temporaryPassword` | **Code:** `type="password"` with explicit reveal/copy; clear input on success; avoid re-sending password in state if already known to admin who typed it |
| Minor | Support role edit footgun | Edit form coerces unknown roles (e.g. `support`) to select value `operator` and always submits `role`, so saving a support user silently demotes them. | `operator-edit-form.tsx` `defaultValue` fallback | **Code:** disable role select for non-UI roles or include `support` / preserve original when not in `OPERATOR_ADMIN_ROLES` |
| Minor | `default_area_id` cross-org FK | `whatsapp_lines.default_area_id` references `areas(id)` with no same-org check. Seed is correct; a service-role or future UI update could point a line at another org’s area. | Migration column add; no composite/org trigger | **SQL:** check trigger that `areas.org_id = whatsapp_lines.org_id` |
| Question | Zero-default during admin ops | Is a transient org with no default considered acceptable, or must Mesa always exist once seeded? | Spec “SHALL” vs partial unique only | Confirm product rule; if absolute, Finding B2 becomes archive-blocking even for trusted admins |

### Focus checklist (requested)

| Focus | Result |
|---|---|
| Migration RLS / last_admin / default area | RLS shape for areas/members looks coherent on read; last_admin trigger present but racy; default uniqueness incomplete (≤1 not =1) |
| Seed | Mesa + Inspectoría + line link + admin memberships look correct in SQL/TS |
| Admin features | Pages gated; use cases gated; create-operator service-role membership path unsafe |
| Authz gaps / IDOR | **Blocker** on create membership areaIds; other mutating actions use user client + RLS |
| Temp password in logs | **No log leakage found** in admin/seed paths reviewed |
| Non-admin bypass | App + RLS write denial for non-admin looks sound for user-scoped paths (unit-covered); not a bypass finding |
| Fake inbox completion | **Not faked** — empty inbox remains; docs list inbox as follow-up |

## Verdict

**FAIL**

Archive is **not advisable** until the Blocker (service-role membership IDOR) is fixed and the Major items are addressed or explicitly accepted with updated OpenSpec (especially default-area invariant and live SQL proof).

## Recommended next steps (before archive)

1. **Fix B1 (Blocker):** validate `areaIds` against actor org (or use RLS-bound client) on create-operator; add regression tests.
2. **Fix or spec-downgrade B2:** enforce “exactly one default” in SQL, or change the spec to “at most one” and document how hub routing handles zero.
3. **Harden B3:** serialize last-admin checks under a lock.
4. **Compensate B4:** delete Auth user on profile insert failure (or equivalent).
5. **Execute B5:** run pgTAP/`test:db` and refresh acceptance-matrix evidence.
6. Re-run adversarial review (or targeted delta review) after fixes; then human OK → archive.
