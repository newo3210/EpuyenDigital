# Adversarial fixes — round 1 (`areas-operators-admin`)

**Date**: 2026-11-06  
**Branch**: `cursor/areas-operators-admin-0e30`  
**Source FAIL**: `reports/adversarial-review.md`

## What changed

| Task | Severity | Fix |
|------|----------|-----|
| **7.1** | Blocker | `areas_guard_default`: skip `org_requires_default_area` when `pg_trigger_depth() > 1` so nested peer-clear during promote succeeds. Behavioral unit models Mesa ↔ Inspectoría. Documented SQL proof under `reports/default-area-swap-sql-proof.sql` (not executed live — no Docker). |
| **7.2** | Major | `profiles_guard_last_active_admin`: `pg_advisory_xact_lock(hashtextextended(source_org))`; treat `org_id` change away from source org while active admin like demotion/deactivation (count remaining in **OLD** org). |
| **7.3** | Major | New `replace_area_memberships(p_user_id, p_memberships jsonb)` SECURITY INVOKER RPC (admin + org checks); delete+insert in one function/transaction. App repository calls RPC only (fail closed). |
| **7.4** | Major | `createOperator` no longer swallows `deleteAuthUser` errors; returns composed `compensationFailed` message. Unit test where delete throws. |
| **7.5** | Minor | Create-area `readBoolean(..., true)` when `isActive` absent; form always sends `'true'/'false'`; `callerRole: 'admin'` assert inside use case. |

## Migration

Edited in place (unmerged feature branch, not applied to prod):  
`supabase/migrations/20261106120000_areas_operators_admin.sql`

## Evidence

- Root `npm test`: **586 passed** (64 files) after fixes.
- Live DB / Docker: **unavailable** — default-swap SQL proof not executed against Postgres; unit behavioral model + static SQL contract used instead.
- Tasks 7.1–7.5 marked `[x]` in `tasks.md`.

## Remaining (out of this fix pass)

- **7.6** Refresh acceptance-matrix + re-run adversarial review.
- Live `db reset` / pgTAP / E2E still env-blocked without Docker/Podman.
