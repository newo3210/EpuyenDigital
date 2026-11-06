# Acceptance Matrix (independent verification)

Copy scenarios **literally** from `openspec/changes/areas-operators-admin/specs/**/spec.md`.

**Change:** `areas-operators-admin`  
**Date:** 2026-11-05 (America/Buenos_Aires); refreshed 2026-11-05 after adversarial fix round 1  
**Author:** Project Director (did **not** run apply; apply by [Apply areas-operators-admin](bc-9d795dd3-364a-581c-abcc-72e8fe57bc9e); fixes by [Fix adversarial FAIL findings](bc-cf0471bf-ec46-5d2f-b556-710b21bd5c12))

## Scenarios — municipal-areas

### Scenario: Admin creates an active area

- **WHEN** an admin of the organization creates an area with a unique name and valid color
- **THEN** the area is persisted with `is_active = true` (unless requested otherwise) and appears in the organization's area list

**Evidence:**
- Tool used: Vitest (mocked repo) + code review of `create-area.ts`
- Command / steps: `npm test` → `create-area.test.ts` “persists a valid area”
- Result: PASS (unit) | BLOCKED (live DB)
- Notes: No authenticated server-action against Supabase in this env

---

### Scenario: Duplicate area name rejected

- **WHEN** an admin creates an area whose trimmed name matches an existing area of the same organization ignoring case
- **THEN** the create is rejected and no new row is written

**Evidence:**
- Tool used: Vitest + static SQL (`areas_org_name_unique`, `lower(btrim(name))`)
- Result: PASS (unit/static) | BLOCKED (live unique constraint)
- Notes: App maps duplicate failures; DB uniqueness not live-proven

---

### Scenario: Invalid color rejected

- **WHEN** an admin submits a color that is not `#` followed by six hex digits
- **THEN** the create or update is rejected

**Evidence:**
- Tool used: Vitest contracts + `create-area.test.ts`
- Result: PASS
- Notes: Zod + DB check present in migration SQL (static)

---

### Scenario: Promote Inspectoría then Mesa again

- **WHEN** an admin sets area B as default while area A was default
- **THEN** area B has `is_default = true` and area A has `is_default = false`

**Evidence:**
- Tool used: behavioral unit `areas-guard-default.logic.test.ts` (Mesa ↔ Inspectoría) + migration `pg_trigger_depth() > 1` + `reports/default-area-swap-sql-proof.sql`
- Result: PASS (behavioral unit / static) | BLOCKED (live Postgres)
- Notes: Adversarial Blocker addressed in fix round 1; live promote still env-blocked

---

### Scenario: Cannot leave org without default

- **WHEN** an admin attempts to set `is_default = false` on the only default area without promoting another
- **THEN** the update is rejected

**Evidence:**
- Tool used: static SQL (`org_requires_default_area`, `areas_one_default_per_org`) + depth skip only for nested clear
- Result: PASS (static/unit model) | BLOCKED (live)
- Notes: Sole-default clear still enforced at depth 1

---

### Scenario: Persist SLA minutes

- **WHEN** an admin sets warning 30 and critical 120 on an area
- **THEN** those integers are stored and returned on subsequent reads

**Evidence:**
- Tool used: Zod contracts (`areas.test.ts`) + migration SLA checks
- Result: PASS (contracts) | BLOCKED (live round-trip)
- Notes: No SLA engine (by design)

---

### Scenario: Non-admin cannot create area

- **WHEN** an authenticated `operator` attempts to create an area
- **THEN** the operation is denied and no row is inserted

**Evidence:**
- Tool used: code review RLS policy text + `requirePageRole(['admin'])` + nav roles test
- Result: PARTIAL | BLOCKED (live RLS insert denial)
- Notes: UI/nav gate proven; RLS admin-write string in migration; live denial not executed

---

### Scenario: Operators can list areas

- **WHEN** an active `operator` of the organization lists areas
- **THEN** they receive the areas of their organization only

**Evidence:**
- Tool used: code review list service + RLS select org_id policy (static)
- Result: BLOCKED (live) / PARTIAL (static)
- Notes: Cross-org isolation not live-proven in this change env

---

### Scenario: Fresh seed areas

- **WHEN** seed runs for organization slug `epuyen`
- **THEN** both areas exist, Mesa de Entrada is the sole default, and Inspectoría is not default

**Evidence:**
- Tool used: read-only review of `supabase/seed.sql` + `supabase/seed/seed.ts`
- Result: PASS (source review) | BLOCKED (live reset)
- Notes: Insert statements present for both areas with default flags

---

## Scenarios — operators-admin

### Scenario: Admin creates operator with memberships

- **WHEN** an admin creates an operator with email, name, role `operator`, temporary password, and membership in Mesa de Entrada
- **THEN** the Auth user and profile exist, the temporary password is shown once in the admin UI, and `area_members` contains that membership

**Evidence:**
- Tool used: Vitest `create-operator.test.ts`
- Result: PASS (unit mocks)
- Notes: Live Auth admin path blocked without Supabase

---

### Scenario: Non-admin cannot create operator

- **WHEN** an `area_lead` attempts to create an operator
- **THEN** the operation is denied and no Auth user is created

**Evidence:**
- Tool used: page guard + nav roles; service assumes admin caller from page
- Result: PARTIAL | BLOCKED (live)
- Notes: Defense-in-depth relies on `requirePageRole` + intended RLS; confirm adversarial on service-level role check

---

### Scenario: Duplicate email rejected

- **WHEN** an admin creates an operator whose email already exists in Auth
- **THEN** the create fails with a clear error and no orphan profile is left

**Evidence:**
- Tool used: Vitest “maps duplicate Auth email without compensation” + compensation-failure test when `deleteAuthUser` throws
- Result: PASS (unit)
- Notes: Fix round 1 Major 7.4 — compensation failure is surfaced (`compensationFailed`)

---

### Scenario: Change role and areas

- **WHEN** an admin changes an operator from `operator` to `area_lead` and sets memberships to Inspectoría with `is_lead = true`
- **THEN** the profile role is `area_lead` and the only membership is Inspectoría with `is_lead = true`

**Evidence:**
- Tool used: Vitest update-operator + `operators-memberships.test.ts` + RPC `replace_area_memberships`
- Result: PASS (unit / RPC contract) | BLOCKED (live RPC)
- Notes: Fix round 1 Major 7.3 — replace is transactional via RPC

---

### Scenario: Deactivated operator loses org context

- **WHEN** an admin deactivates an operator
- **THEN** `is_active` is false, `deactivated_at` is set, and subsequent `current_org_id()` for that user returns null

**Evidence:**
- Tool used: Vitest deactivate + foundation `current_org_id` inactive behavior (existing spec) + SQL sync trigger static
- Result: PASS (unit deactivate) | BLOCKED (live current_org_id after deactivate)
- Notes: Foundation already returns null for inactive; deactivated_at sync in migration

---

### Scenario: Cannot deactivate last admin

- **WHEN** an admin attempts to deactivate the only active admin of the organization
- **THEN** the update is rejected and that profile remains active with role `admin`

**Evidence:**
- Tool used: Vitest `deactivate-operator.test.ts` + SQL `profiles_guard_last_active_admin` with `pg_advisory_xact_lock` + `org_id` leave path (static)
- Result: PASS (app-level + hardened trigger text) | BLOCKED (live concurrent stress)
- Notes: Fix round 1 Major 7.2; dual layer remains

---

### Scenario: Cannot demote last admin

- **WHEN** an admin attempts to change the only active admin's role to `operator`
- **THEN** the update is rejected and the role remains `admin`

**Evidence:**
- Tool used: Vitest `update-operator.test.ts` + SQL advisory lock static
- Result: PASS (app-level + hardened trigger text) | BLOCKED (live concurrent stress)

---

### Scenario: Second admin allows demotion

- **WHEN** two active admins exist and one is demoted to `operator`
- **THEN** the demotion succeeds and at least one active admin remains

**Evidence:**
- Tool used: Vitest update/deactivate “another admin remains”
- Result: PASS (unit)

---

### Scenario: List shows email and areas

- **WHEN** an admin opens the operators directory
- **THEN** each row shows email, role, active flag, and assigned area names

**Evidence:**
- Tool used: code review of operators settings page / list query
- Result: PARTIAL | BLOCKED (browser E2E)
- Notes: E2E skipped — step 4.4 env blocker

---

### Scenario: Cross-org membership rejected

- **WHEN** a client attempts to insert an `area_members` row pairing a user from org A with an area from org B
- **THEN** the insert is rejected

**Evidence:**
- Tool used: static SQL `area_members_same_org` / `area_member_org_mismatch`
- Result: BLOCKED (live) / PARTIAL (static)
- Notes: No live cross-org insert attempt

---

## Scenarios — org-tenancy (delta)

### Scenario: Member of two areas

- **WHEN** an active operator belongs to Mesa de Entrada and Inspectoría
- **THEN** `current_area_ids()` returns both area ids

**Evidence:**
- Tool used: static SQL function body review
- Result: BLOCKED (live) / PARTIAL (static)

---

### Scenario: Inactive operator

- **WHEN** an inactive operator calls `current_area_ids()`
- **THEN** it returns an empty set

**Evidence:**
- Tool used: static SQL (joins active profile)
- Result: BLOCKED (live) / PARTIAL (static)

---

### Scenario: Email visible on profile row

- **WHEN** an admin creates an operator with email `op@epuyen.gob.ar`
- **THEN** `profiles.email` equals that address for directory queries

**Evidence:**
- Tool used: Vitest create-operator sets email on profile
- Result: PASS (unit)

---

### Scenario: Deactivation stamps time

- **WHEN** an admin deactivates an operator
- **THEN** `deactivated_at` is non-null

**Evidence:**
- Tool used: Vitest + SQL sync trigger static
- Result: PASS (unit) | BLOCKED (live trigger)

---

### Scenario: Read isolation

- **WHEN** an operator of organization A selects from `profiles`
- **THEN** only profiles of organization A are returned

**Evidence:**
- Tool used: foundation prior proof + unchanged profiles select policy (assumed retained)
- Result: PASS (prior foundation) — not re-proven live here

---

### Scenario: Write isolation

- **WHEN** an operator of organization A attempts to update a profile of organization B
- **THEN** zero rows are affected

**Evidence:**
- Tool used: foundation prior
- Result: PASS (prior) — not re-proven live here

---

### Scenario: Inactive operator sees nothing

- **WHEN** an inactive operator selects from any business table
- **THEN** zero rows are returned

**Evidence:**
- Tool used: foundation helpers return null when inactive
- Result: PASS (prior) — not re-proven live here

---

### Scenario: Read isolation for areas

- **WHEN** an operator of organization A selects from `areas`
- **THEN** only areas of organization A are returned

**Evidence:**
- Tool used: static RLS policy
- Result: BLOCKED (live) / PARTIAL (static)

---

### Scenario: Write isolation for area_members

- **WHEN** an admin of organization A attempts to insert a membership for a profile of organization B
- **THEN** zero rows are inserted

**Evidence:**
- Tool used: static same-org guard + RLS
- Result: BLOCKED (live) / PARTIAL (static)

---

## Summary

| Total | Pass (unit/static/prior) | Fail | Blocked (live/E2E) |
|---|---|---|---|
| 28 | ~20 after fix round 1 | 0 | remaining live Postgres / E2E / concurrent stress |

**Verdict (pre re-audit):** Prior adversarial **FAIL** Blocker/Majors addressed in code (see `adversarial-fixes-round1.md`). Live Docker/E2E still **BLOCKED**. Archive readiness depends on re-audit **PASS / PASS WITH GAPS** with no Blocker/Major + human OK.

**Rule:** Implementer unit suite alone is not sole evidence — director refreshed this matrix after fixes; suite after fixes reported **586** passed by fix agent.
