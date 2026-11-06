# Adversarial re-audit — areas-operators-admin (after fix round 1)

**Scope:** OpenSpec change `areas-operators-admin` (FND-02..06 area level)  
**Branch:** `cursor/areas-operators-admin-0e30`  
**Base:** `origin/main`  
**Date:** 2026-11-06  
**Reviewer role:** Independent adversarial reviewer (did **not** implement the change or round-1 fixes)  
**Prior FAIL:** `reports/adversarial-review.md`  
**Fix report:** `reports/adversarial-fixes-round1.md` + `tasks.md` §7.1–7.5  
**Refreshed matrix:** `reports/acceptance-matrix.md`  
**Focus commits:** after `5b98342` — especially `b3f944b` (DB), `1a77bff` (web), `cb3a991` (tests/report)

**Sources:**
- Specs: `specs/municipal-areas/spec.md`, `specs/operators-admin/spec.md`, `specs/org-tenancy/spec.md`
- `proposal.md`, `design.md`, `tasks.md`
- Migration: `supabase/migrations/20261106120000_areas_operators_admin.sql`
- App: `features/areas/**`, `features/operators/**`, `infrastructure/repositories/operators.ts`
- Proof artifacts: `areas-guard-default.logic.test.ts`, `default-area-swap-sql-proof.sql`, membership/compensation unit tests
- Targeted re-run: 5 Vitest files / **23 passed** (guard model, migration SQL contract, readBoolean, create-operator, memberships RPC)
- No Docker/Podman/psql in this environment — live Postgres still unexecuted (honest Gap)

---

## Spec and task alignment (re-check)

| Prior finding | Round-1 claim | Re-audit |
|---|---|---|
| **Blocker** default-area swap / `pg_trigger_depth` | Skip `org_requires_default_area` when `pg_trigger_depth() > 1`; Mesa ↔ Inspectoría unit model + SQL proof script | **Cleared** in SQL + behavioral model (live still Gap) |
| **Major** last-admin race (TOCTOU) | `pg_advisory_xact_lock(hashtextextended(org))` before count | **Cleared** by inspection (concurrent stress Gap) |
| **Major** last-admin via `org_id` leave | Treat `new.org_id is distinct from old.org_id`; count remaining in **OLD** org | **Cleared** |
| **Major** membership replace not atomic | `replace_area_memberships` RPC; repo calls RPC only | **Cleared** |
| **Major** Auth compensation swallow | Composed `compensationFailed` when `deleteAuthUser` throws; unit test | **Cleared** (orphan Auth residual only if delete fails — now visible) |
| **Major** verification theater | Behavioral model + SQL proof + RPC/compensation tests; matrix still marks live BLOCKED | **Demoted to Gap** (honest; no fake green) |
| **Minor** `callerRole` / `isActive` default | Assert admin in use case; `readBoolean(..., true)` on create; form always sends booleans | **Cleared** for stated Minors |

Non-goals (inbox RLS, WhatsApp FK, invite email, SLA engine) still respected — no false claims in the fix commits.

---

## Break attempts (prior five + fix-introduced risk)

### 1. Default-area promote / nested clear

| Attack | Result |
|---|---|
| Promote B while A is default → nested clear of A raises `org_requires_default_area`? | **Fixed.** Nested path returns early when `pg_trigger_depth() > 1` before the sole-default `NOT EXISTS` check. Outer NEW with `is_default` still applied after peers clear. |
| Promote Inspectoría then Mesa again? | **Modeled PASS** in `areas-guard-default.logic.test.ts` (depth 1 promote ↔ peer clear at depth 2). Live script `default-area-swap-sql-proof.sql` present but **not executed** (no Docker). |
| Clear sole default at depth 1 still rejected? | **Yes** — depth skip only when `> 1`; unit asserts raise at depth 1. |
| `pg_trigger_depth` skip lets an unrelated nested UPDATE wipe the sole default? | **No current call path** — only nested peer-clear from this same function issues `UPDATE … is_default = false`. Residual defense-in-depth Question (swap RPC would be tighter). |
| Partial unique `areas_one_default_per_org` violated mid-promote? | **No** — nested clear commits peer rows before outer NEW is written; zero defaults allowed mid-statement; one default after outer write. |

### 2. Last-admin advisory lock + `org_id` leave

| Attack | Result |
|---|---|
| Two concurrent demotions of the last two admins both see `remaining ≥ 1`? | **Mitigated.** Both take the same `pg_advisory_xact_lock` on source org; waiter re-counts after lock under READ COMMITTED and should see 0. Same pattern as foundation rate-limit fix. **Not stress-proven live.** |
| Move last admin’s `org_id` to another org? | **Blocked.** Condition includes `new.org_id is distinct from old.org_id`; count uses `source_org := old.org_id` (pre-fix counted `new.org_id`, which missed this hole). |
| DELETE last active admin? | **Still guarded** + now locks. |
| Count includes the row being updated (always remaining ≥ 1)? | **No** — excludes `old.id`. |

### 3. Atomic `replace_area_memberships`

| Attack | Result |
|---|---|
| Client delete-then-insert leaves zero memberships on insert failure? | **Gone.** Repository only RPCs; unit asserts no direct `area_members` wipe on error. |
| Insert failure after delete inside RPC? | **Rolls back** — single plpgsql function = one transaction. |
| Non-admin RPC? | Raises `forbidden` via `current_user_role()`. |
| Cross-org target user / area? | Raises `operator_not_found` / `area_member_org_mismatch` before or on insert. |
| Empty memberships array? | Spec allows zero memberships; RPC deletes all and inserts none — intentional. |

### 4. Auth compensation failure surfaced

| Attack | Result |
|---|---|
| `deleteAuthUser` throws → empty catch hides orphan? | **Fixed.** Returns `failed` with `compensationFailed` + original + compensation messages; unit covers throw path. |
| Successful compensation still maps createFailed? | **Yes** — only compensation throw takes the composed path; successful delete still returns original createFailed/duplicate mapping. |

### 5. Minor bundle (`isActive` + `callerRole`)

| Attack | Result |
|---|---|
| Create FormData omits `isActive` → inactive area? | **Fixed** — `readBoolean(..., true)` on create; form always sets `'true'/'false'`. |
| Non-admin calls `createOperator` with deps? | **Rejected** before Auth (`callerRole !== 'admin'`). Action passes session role from `requirePageRole`. |

### Fix-introduced risks checked (no new Blocker/Major)

| Risk | Disposition |
|---|---|
| Advisory lock key bare `org_id::text` (no namespace prefix unlike `client_error_report:…`) | **Minor** collision/style nit only (~2^64 hash space; different string domains) |
| `updateAreaAction` still defaults absent `isActive` → false | **Minor** — UI always sends; create path fixed; non-UI update omit can deactivate |
| `callerRole: 'admin'` is trust-at-boundary (not re-read from JWT inside use case) | Acceptable for stated Minor; action still `requirePageRole` |
| Grant `replace_area_memberships` to `service_role` | Fail-closed: `current_user_role()` null ≠ admin; app uses user-scoped client |
| Live promote / concurrent last-admin / RLS still unproven | **Gap** (env), not re-raised as Major theater — matrix + fix report stay honest |

---

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| **Gap** | Live default-swap | Promote Mesa ↔ Inspectoría still **BLOCKED** on live Postgres; SQL proof script not run. | `default-area-swap-sql-proof.sql`; acceptance-matrix; no Docker | **tests** — run proof (or pgTAP) when containers available |
| **Gap** | Live last-admin concurrency | Advisory lock correct by inspection; dual-tab / concurrent demotion stress not executed. | Trigger SQL; matrix “BLOCKED (live concurrent stress)” | **tests** |
| **Gap** | Live RLS / Auth / E2E | Non-admin denial, cross-org membership, browser admin flows remain env-blocked. | step 4.3/4.4; acceptance-matrix | **tests** / human accept |
| **Minor** | Advisory lock namespacing | `hashtextextended(org_id::text, 0)` lacks a purpose prefix (foundation uses `client_error_report:`…). | migration L79/L104 vs `20261005000200` | optional **code** — prefix `last_active_admin:` |
| **Minor** | Update `isActive` absent | Update action uses `readBoolean(formData, 'isActive')` default false if field omitted. | `areas/actions.ts` update path | **code** — pass `true` only if product wants create-like default, or require explicit boolean |
| **Minor** | No `update-area` unit tests | Still only create-area + guard model; update default-required mapping uncovered in Vitest. | prior review; feature tree | **tests** |
| **Minor** | REQUIREMENTS “Done” vs live | `.planning/REQUIREMENTS.md` FND-02..05 Done while live proof gaps remain. | REQUIREMENTS vs matrix | **docs** annotate code-complete / live blocked |
| **Question** | Depth-skip vs swap RPC | Depth skip is sufficient for current call graph; a dedicated swap RPC would remove the nested-bypass class entirely. | design D6; migration comment | product/engineering preference |
| **Question** | Inactive areas in membership UI | Unchanged; spec silent. | `OperatorForm` / `listAreas` | product |

### Prior Blockers / Majors — disposition

| ID | Disposition |
|---|---|
| Blocker default-area swap | **Fixed** (SQL + unit model; live Gap) |
| Major last-admin race | **Fixed** (advisory xact lock; stress Gap) |
| Major last-admin `org_id` leave | **Fixed** |
| Major non-atomic membership replace | **Fixed** (RPC) |
| Major compensation swallow | **Fixed** (surfaced) |
| Major verification theater | **Addressed via honesty + stronger static/behavioral proof** → Gap |

### Strengths that mitigate risk (only where they do)

- Nested default clear + sole-default reject are both covered by the behavioral unit model.
- Membership path fail-closed: no client-side delete left in repository.
- Compensation failure is distinguishable in the admin-facing error string (`compensationFailed`).
- Fix report and acceptance matrix do **not** claim live Postgres green.

---

## Verdict

**PASS WITH GAPS**

No remaining **Blocker** or **Major**. Round-1 fixes address the FAIL findings in code with matching unit/contract coverage. Residual items are **Gaps** (live DB / concurrent stress / E2E env blockers) and **Minors**/Questions. Archiving is **conditionally advisable** after human OK that explicitly accepts the live-proof Gaps — same bar as the refreshed acceptance matrix.

## Recommended next steps (before archive)

1. Human OK on Gaps (or run `default-area-swap-sql-proof.sql` + last-admin stress + RLS smoke when Docker/Podman is available).
2. Optional: namespace the last-admin advisory key; add `update-area` unit cases.
3. Proceed to archive only with human sign-off; keep PR #5 open until then.
