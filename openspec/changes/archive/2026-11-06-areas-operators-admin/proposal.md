## Why

Foundation auth and org-level RLS are on `main`, but municipal areas and operator provisioning are still missing. Without them Mesa de Entrada cannot be the default home area, Inspectoría cannot be an area vertical, and area-scoped access helpers cannot exist for the inbox change.

Roadmap: **Phase 1 — Fundación** · Requirements: **FND-02, FND-03, FND-04, FND-05, FND-06 (area level)**.

## What Changes

- New tables `areas` and `area_members` with RLS, uniqueness, single-default-area constraint, and SLA minute columns (no SLA engine yet).
- Profile directory fields: replicated `email`, `deactivated_at`; admin create/update/deactivate operators (no hard delete).
- Temporary password shown once in the admin UI when creating an operator (Auth user created via service role).
- Last-active-admin protection on deactivate and role demotion.
- SQL helper `current_area_ids()` for area-scoped access (foundation for inbox RLS).
- Admin UI under Configuración: Áreas and Operadores; nav gated to `admin`.
- Seed: default area **Mesa de Entrada** + **Inspectoría** for org `epuyen`.
- Root docs: `ARCHITECTURE_SDD.md` (EN) and `STUDENT_DECISION_LOG.md` (ES) updated for this change.

## Capabilities

### New Capabilities
- `municipal-areas`: create/list/update municipal areas (name, description, color, active, default, SLA minutes); membership listing; seed Mesa + Inspectoría.
- `operators-admin`: admin creates operators with temp password, edits role/memberships, deactivates with last-admin protection; directory lists email and areas.

### Modified Capabilities
- `org-tenancy`: add `current_area_ids()`, profile `email` / `deactivated_at`, and area-aware tenancy expectations for admin writes.

## Impact

- DB: new migration(s) under `supabase/migrations/`; seed SQL + `supabase/seed/seed.ts`; SQL/pgTAP or Vitest isolation tests.
- Web: `apps/web` settings routes, features for areas/operators, Zod contracts, i18n `es-AR`, nav items.
- Shared: optional pure helpers in `packages/shared` (color/name validation, last-admin rules) if reused by tests.
- No Evolution/worker changes required.
- Follow-up (out of scope): `mesa-entrada-inbox` applies `current_area_ids()` to conversations/tasks RLS.
