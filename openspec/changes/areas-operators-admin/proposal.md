## Why

Foundation auth and org tenancy are on `main`, but operators cannot manage municipal **areas** or provision colleagues. Mesa de Entrada must exist as the default area (hub) and Inspectoría as the example vertical before the real inbox can route and manually distribute work.

Roadmap: **Phase 1 — Fundación (change 2 of 2)** · Requirements: **FND-02, FND-03, FND-04, FND-05, FND-06 (area level)**.

## What Changes

- Schema: `areas`, `area_members`; optional `profiles.deactivated_at`; `whatsapp_lines.default_area_id` FK when missing; RLS + SQL helpers (`operator_area_ids`, default-area uniqueness).
- Admin-only APIs/actions: create operator (temp password), change role, deactivate/reactivate; create/update areas; assign/remove memberships.
- Hard rule: cannot deactivate or demote the last active `admin` in the organization.
- Seed: areas **Mesa de Entrada** (`is_default=true`) and **Inspectoría**; link Inspectoria WhatsApp line to Inspectoría area; seed admin remains org admin (optionally member of both areas).
- UI (es-AR): Settings → Áreas, Settings → Operadores (list/create/edit/membership).
- SQL tests for area isolation helpers and last-admin protection; unit tests for admin actions.
- Update root `ARCHITECTURE_SDD.md` + `STUDENT_DECISION_LOG.md`.

## Capabilities

### New Capabilities

- `municipal-areas`: CRUD areas, single default area per org, active flag, seed Mesa + Inspectoría.
- `operator-admin`: admin creates operators with role + temp password; edits role; deactivates without deleting history; last-admin protection.
- `area-membership`: assign operators to one or more areas; list memberships; RLS so non-admins only see their areas’ metadata as needed for future inbox.

### Modified Capabilities

- `org-tenancy`: extend with area-scoped helper functions (FND-06 area level scaffolding).
- `local-dev-environment`: seed includes default areas + line `default_area_id`.

## Impact

- `supabase/migrations/*_areas_operators.sql`, seed SQL/TS, pgTAP
- `apps/web` settings routes + features/admin + contracts
- `packages/shared` types/contracts
- Unlocks `mesa-entrada-inbox` next
- Does **not** implement inbox triage, map, or conversations tables
