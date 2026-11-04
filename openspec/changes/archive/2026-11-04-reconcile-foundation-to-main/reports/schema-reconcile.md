# Schema reconcile (D2) — organizations superset

## Decision

**Path chosen:** forward-only reconcile migration (do **not** rewrite published pet migrations on `main`) **plus** idempotent foundation DDL so pet-only databases can apply foundation migrations without wiping.

## Why

1. Foundation `20260930000100_foundation.sql` creates `organizations (id, name, slug, created_at)` first in timestamp order.
2. Pet `20261012010000_pet_registry_core.sql` uses `create table if not exists` for `organizations` with extra columns `timezone`, `updated_at`. On a fresh reset after foundation, that `CREATE` is a no-op, so those columns would be missing.
3. Rewriting `20261012*` history is unsafe for any environment that already applied pet migrations.
4. Bare `create table public.organizations` in foundation would fail on pet-only DBs that already have the table — fixed in adversarial round 1 (see below).

## Migration added

`supabase/migrations/20261104120000_reconcile_organizations_superset.sql`:

- `add column if not exists timezone … default 'America/Argentina/Buenos_Aires'`
- `add column if not exists updated_at … default now()`
- Ensure `organizations_set_updated_at` trigger exists
- Restore `set_updated_at()` with `search_path = ''` (pet migration overwrites the foundation helper earlier)

## Upgrade path for existing pet-only DBs (adversarial fix 8.2)

This branch has **not** shipped foundation migrations to production. Editing `20260930000100_foundation.sql` (and later foundation migrations) for idempotency is acceptable.

Foundation DDL is now safe when overlapping objects already exist:

- Enums: `DO $$ … exception when duplicate_object`
- Tables: `create table if not exists` (`organizations`, `profiles`, `error_logs`)
- Functions: `create or replace` (`set_updated_at`, RLS helpers, guards, purge)
- Triggers / policies: `drop … if exists` then create
- Indexes: `create index if not exists`
- Hardening constraints / rate-limit column: duplicate_object / `add column if not exists`

**Expected apply order on a pet-only DB:** pending foundation `20260930*` / `20261005*` succeed without colliding on `organizations` / `set_updated_at`, then `20261104120000_reconcile_organizations_superset.sql` ensures timezone/updated_at + secure `set_updated_at`.

Fresh reset remains the preferred local path; wipe-only is **not** required for upgrade.

## Expected fresh-reset shape

- `organizations`: `id, name, slug, timezone, created_at, updated_at`
- Foundation: `profiles`, `error_logs`, enums, RLS helpers, avatars bucket
- Pets: `org_settings`, citizens/animals/sessions/messages/jobs/… + RPCs (`complete_animal_registration`, session locks, `claim_next_job`, …)

## SQL / pgTAP tests

Foundation suites are present under `supabase/tests/` (`001_org_isolation`, profiles, error_logs, avatars, hardening, rate limit).  
**Gap (honest):** this environment has no Docker/Podman socket, so `npm run test:db` / `supabase db reset` could not be executed here. Column expectations are documented in `scripts/assert-org-superset-columns.mjs` for a local run after reset. Re-run locally when the container runtime is available. Task **2.1 remains unchecked** until that proof exists.

## Types

`packages/shared/src/contracts/database.types.ts` uses the foundation supabase-js shape, patched with org superset columns and pet tables/RPCs (regenerate via `npm run db:types` after a local reset when possible).
