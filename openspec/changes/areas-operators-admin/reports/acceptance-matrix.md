# Acceptance Matrix — areas-operators-admin

**Change:** `areas-operators-admin`  
**Date:** 2026-11-04  
**Author:** Project Director (independent of apply implementer)

Scenarios copied from change specs.

## municipal-areas

### Scenario: Create area
- **WHEN** an admin submits a new area with a unique name in the organization
- **THEN** the area is persisted as active (unless specified inactive) and appears in the areas list  
**Evidence:** `features/admin/areas.test.ts` admin create path PASS; pages under `settings/areas`  
**Result:** PASS (unit)

### Scenario: Single default area
- **WHEN** an admin marks an area as default
- **THEN** that area has `is_default = true` and any previous default in the same organization becomes non-default  
**Evidence:** migration `set_default_area` + partial unique index; `areas.test.ts` set-default call  
**Result:** PASS (code + unit); live SQL BLOCKED without Docker

### Scenario: Seeded baseline areas
- **WHEN** a developer runs the documented reset and seed commands
- **THEN** areas named Mesa de Entrada (`is_default`) and Inspectoría exist for the Epuyén organization  
**Evidence:** `supabase/seed.sql` inserts both; `seed.ts` mirrors  
**Result:** PASS (seed review); live reset BLOCKED

### Scenario: Operator blocked from area write
- **WHEN** a non-admin calls an area create or update action
- **THEN** the action is rejected with a forbidden outcome and no row changes  
**Evidence:** `areas.test.ts` operator → forbidden  
**Result:** PASS

## operator-admin

### Scenario: Create operator with temporary password
- **WHEN** an admin creates an operator with valid email, name, role, and temporary password meeting minimum length
- **THEN** the operator can sign in with that password and sees only their organization data  
**Evidence:** `create-operator.test.ts` happy path; E2E sign-in of new user BLOCKED (no live Auth)  
**Result:** PASS (unit) / E2E BLOCKED

### Scenario: Duplicate email rejected
- **WHEN** an admin tries to create an operator whose email already exists
- **THEN** creation fails with a clear error and no duplicate profile is created  
**Evidence:** `create-operator.test.ts` duplicate path  
**Result:** PASS

### Scenario: Deactivate operator
- **WHEN** an admin deactivates an active non-last-admin operator
- **THEN** `is_active` is false, `deactivated_at` is set, and subsequent sign-in attempts are rejected  
**Evidence:** `update-operator.test.ts` deactivate; migration sets deactivated_at; sign-in inactive covered by foundation auth tests  
**Result:** PASS (unit)

### Scenario: Last admin protected
- **WHEN** an admin attempts to deactivate or demote the only remaining active admin in the organization
- **THEN** the change is rejected and that profile remains an active admin  
**Evidence:** `update-operator.test.ts` + `map-admin-error.test.ts` last_admin; trigger in migration; pgTAP authored not run  
**Result:** PASS (unit) / SQL BLOCKED

### Scenario: Operator cannot create peers
- **WHEN** an operator role calls create-operator
- **THEN** the action is forbidden  
**Evidence:** `create-operator.test.ts`  
**Result:** PASS

## area-membership

### Scenario: Assign membership
- **WHEN** an admin assigns an operator to Mesa de Entrada and Inspectoría
- **THEN** both membership rows exist and listing that operator shows both areas  
**Evidence:** `areas.test.ts` upsertMembership  
**Result:** PASS (unit)

### Scenario: Remove membership
- **WHEN** an admin removes an operator from an area
- **THEN** that membership row is deleted and the operator no longer lists that area  
**Evidence:** `areas.test.ts` deleteMembership  
**Result:** PASS (unit)

### Scenario: operator_area_ids helper
- **WHEN** an authenticated operator with two memberships calls `operator_area_ids()`
- **THEN** the function returns exactly those two area ids for their organization  
**Evidence:** function defined in migration; pgTAP `007_areas_operators.test.sql` not executed  
**Result:** BLOCKED (SQL)

## org-tenancy (modified)

### Scenario: Cross-org area isolation
- **WHEN** an operator of organization A queries areas
- **THEN** no areas belonging to organization B are returned  
**Evidence:** RLS in migration; pgTAP not run  
**Result:** BLOCKED (SQL)

### Scenario: Area helper ready without conversations table
- **WHEN** migrations for this change are applied
- **THEN** `operator_area_ids` exists and `conversations` table is still absent  
**Evidence:** migration defines helper; no conversations migration in this change; `rg conversations` in new migration = absent  
**Result:** PASS (code inspection)

## Summary

| Total | Pass | Fail | Blocked |
|---|---|---|---|
| 14 | 10 | 0 | 4 |

**Verdict:** PASS WITH GAPS (live SQL/E2E residual)
