# Adversarial review — areas-operators-admin

**Scope**: OpenSpec change `areas-operators-admin` (FND-02..06 area level)  
**Branch**: `cursor/areas-operators-admin-0e30`  
**Base**: `origin/main` (`git diff origin/main...HEAD`)  
**Reviewer**: independent adversarial pass (did **not** implement the change)  
**Date**: 2026-11-06  

**Sources**:
- `proposal.md`, `design.md`, `tasks.md`
- Delta specs: `specs/municipal-areas/spec.md`, `specs/operators-admin/spec.md`, `specs/org-tenancy/spec.md`
- Reports: `verify-mechanical.md`, `acceptance-matrix.md`, step 4.2–4.4
- Migration: `supabase/migrations/20261106120000_areas_operators_admin.sql`
- Features: `apps/web/src/features/areas/**`, `apps/web/src/features/operators/**`
- Settings pages, nav gating, repositories, Auth admin helper, seed SQL/`seed.ts`

## Spec and task alignment

| Must be true for “done” | Evidence posture |
|---|---|
| Areas CRUD + single default + SLA columns + seed Mesa/Inspectoría | Schema + UI + seed present; **default swap logic broken** (see Blocker); live DB unproven |
| Admin-only area writes; org members can list | RLS policy text + `requirePageRole(['admin'])`; live RLS denial **not** executed |
| Operator create (Auth + profile + memberships + temp password once) + compensation | Unit mocks cover happy path + compensation call; live Auth path blocked |
| Last-admin on demote/deactivate | App preflight + DB trigger; concurrent race + `org_id` move hole remain |
| `current_area_ids()` empty when inactive | SQL body review only |
| Nav/settings gated to admin | Unit nav filter + page/`requirePageRole`; E2E skipped |
| Tasks 4.2–4.4 / verify | Honestly documented Docker/Podman gaps — **not** oversold as live PASS |

**Non-goals respected (no false claims in code for)**: inbox RLS, WhatsApp line FK, invite email, SLA engine.

**Underspecified / fragile**:
- “Exactly one default after seed” has no insert-time guarantee when an org has zero defaults.
- Membership “atomic replace” has no transactional requirement spelled as DB RPC.
- Last-admin mitigation claims DB trigger as final authority without locking semantics.

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Blocker** | Single default area (DB) | Promoting another area to default (or inserting a new `is_default = true` while one exists) **fails**: `areas_guard_default` clears peers with a nested `UPDATE … is_default = false`, which re-enters the same trigger; the clear path raises `org_requires_default_area` because the promoting row is not yet visible as default. Spec scenario “Promote Inspectoría then Mesa again” cannot succeed after seed. | `areas_guard_default` in `20261106120000_areas_operators_admin.sql` (promote branch updates peers; clear branch `NOT EXISTS` other default). Acceptance matrix marked this scenario BLOCKED/PARTIAL with no live proof — the static SQL was never exercised. Seed works only because Inspectoría is inserted with `is_default = false`. | **Code (migration)**: skip the “must keep a default” check when `pg_trigger_depth() > 1`, or replace with a single SECURITY DEFINER swap RPC / deferred constraint. **Tests**: live SQL (or pgTAP) for promote A→B→A. |
| **Major** | Last-admin race | App `countActiveAdmins` then update is TOCTOU; DB trigger `SELECT count(*)` without `FOR UPDATE` / advisory lock. Two concurrent demotions/deactivations of the two remaining admins can both observe `remaining ≥ 1` and both commit → zero active admins. Design D3 claimed the trigger closes the two-tab race; it does not under READ COMMITTED. | `profiles_guard_last_active_admin` count query; `update-operator.ts` / `deactivate-operator.ts` preflight; design.md risk row “Last-admin race with two tabs → DB trigger”. | **Code (DB)**: lock org admin rows (`FOR UPDATE`) or serialize with `pg_advisory_xact_lock(org_id)`. **Tests**: concurrent demotion stress. |
| **Major** | Last-admin bypass via `org_id` | Trigger only fires when role leaves `admin` or `is_active` becomes false. Moving the last admin’s `org_id` to another org leaves the source org with zero admins. Privileged-column guard allows admins to change `org_id`. UI does not expose this, but the invariant added in this migration is incomplete. | Trigger condition `new.role is distinct from 'admin' or new.is_active = false`; foundation `profiles_update_admin` + privileged guard includes `org_id`. Spec: reject **any** operation leaving zero active admins. | **Code (DB)**: treat `org_id` change on an active admin like a removal from that org in the last-admin count. |
| **Major** | Membership replace not atomic | `replaceOperatorMemberships` deletes all rows for `user_id` then inserts the new set with no transaction/RPC. Insert failure after delete leaves the operator with **zero** memberships, violating “replace … atomically”. | `operators.ts` `replaceOperatorMemberships`; spec `operators-admin` “Membership changes SHALL replace … atomically”. | **Code**: single Postgres function/`BEGIN` via RPC, or delete+insert in one SQL statement with adequate error handling. **Tests**: forced insert failure after delete. |
| **Major** | Auth compensation hole | On failure after `createUser`, compensation `deleteAuthUser` errors are swallowed; original error is returned and an Auth user can remain with no usable recovery path (“mark failed” from D7 not implemented). Profile cascades on successful Auth delete (`profiles.id → auth.users ON DELETE CASCADE`) — good when delete works; silent fail leaves orphan Auth. | `create-operator.ts` empty `catch` on `deleteAuthUser`; design D7. | **Code**: surface compensation failure distinctly; retry/log/alert; optional outbox. **Tests**: `deleteAuthUser` throws. |
| **Major** | Verification vs behavior | `migration-sql.test.ts` only asserts SQL **substrings** (constraint names, policy text). No behavioral proof of RLS, default swap, same-org membership, or last-admin trigger. Acceptance matrix correctly marks many scenarios BLOCKED, but task 1.1 is checked as done with static contract only — easy to archive with a broken default trigger (this review). | `migration-sql.test.ts`; step 4.2–4.4 gap reports; acceptance-matrix live BLOCKED rows. | **Tests**: live DB/pgTAP before archive, or keep FAIL until default-swap + last-admin are proven. Do not treat static string tests as scenario evidence. |
| **Minor** | Create-operator Auth path only action-gated | `createOperator` / Auth admin API use service role and skip RLS. Authorization is `requirePageRole(['admin'])` on the server action only; the use case has no caller-role port. Future callers that omit the guard can provision users. Membership/profile writes after create are partially RLS-backed (memberships use user client; profile insert is service role). | `actions.ts` `createOperatorAction`; `insertOperatorProfile(admin, …)`; `create-operator.ts` deps without role check. Spec non-admin denial. | **Code**: pass caller role into the use case or assert admin inside the action helper shared by all entry points. |
| **Minor** | `isActive` absent → false | Server `readBoolean` treats missing `isActive` as `false`, so a non-UI FormData post creates an inactive area contrary to “`is_active = true` unless requested otherwise”. UI defaults checkbox on. | `areas/actions.ts` `readBoolean`; municipal-areas scenario “Admin creates an active area”. | **Code**: default `isActive` to `true` when the field is absent. |
| **Minor** | No `update-area` unit tests | Update path (default clear mapping, duplicate name) lacks dedicated tests; only `create-area.test.ts`. | Feature file set under `features/areas/`. | **Tests**: add update-area cases (including default-required mapping). |
| **Minor** | REQUIREMENTS “Done” vs live gaps | `.planning/REQUIREMENTS.md` marks FND-02..05 Done while curl/E2E/RLS live proof is absent. Reports are honest; checkbox language still overstates confidence. | REQUIREMENTS vs step 4.3/4.4 / acceptance-matrix. | **Docs**: keep Done only after live proof, or annotate “code complete / live blocked”. |
| **Question** | Inactive areas in membership UI | Directory/create forms list all org areas, including inactive, for membership assignment. Spec does not forbid; product intent unclear. | `OperatorForm` maps `areas` from `listAreas` with no `is_active` filter. | Confirm with product; optionally filter or warn. |
| **Question** | Archive with known env blocker | Mechanical verify and acceptance matrix already say PASS WITH GAPS for Docker absence. Human must decide whether archive is allowed before live default-swap/RLS proof **after** the Blocker fix. | `verify-mechanical.md`, `acceptance-matrix.md`. | Human OK only after Blocker (+ preferably Majors) fixed and re-verified. |

### Strengths that mitigate documented risks (only where they do)

- Profile insert after Auth create uses service role intentionally; Auth delete cascades profile (and memberships via `area_members.user_id → profiles`), so successful compensation does not leave orphan profiles.
- Area/operator **mutations** for areas and memberships/role/active use the user-scoped Supabase client so RLS admin checks apply (except Auth + profile insert on create).
- Nav + `requirePageRole(['admin'])` on settings pages and server actions; non-admin nav hiding covered by unit tests.
- Docker/E2E gaps are documented rather than silently marked green in step 4.x reports.

## Verdict

**FAIL**

At least one **Blocker** (default-area promote/swap trigger) and multiple **Majors** (last-admin concurrency/`org_id` hole, non-atomic membership replace, compensation swallow, tests that do not prove DB behavior). Archiving is **not advisable** until the Blocker is fixed and re-proven with a live (or containerized) default-swap test; Majors should be fixed or explicitly accepted by the human with updated specs.

## Recommended next steps (before archive)

1. Fix `areas_guard_default` recurse/`pg_trigger_depth` (or swap RPC); add live SQL test for Mesa ↔ Inspectoría promote.
2. Harden last-admin with row/advisory locks; extend trigger for `org_id` removal from org.
3. Make membership replace transactional; fail closed without wiping on insert error.
4. Surface compensation failures; add test when `deleteAuthUser` throws.
5. Re-run step 4.2 DB reset + 4.3/4.4 on a host with Docker/Podman; refresh acceptance-matrix evidence.
6. Re-run adversarial review; target **PASS** or **PASS WITH GAPS** only for residual env limits after Blocker/Majors are closed.
