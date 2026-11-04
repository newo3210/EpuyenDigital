## Context

- `main` after PR #3: auth, profiles, error_logs, pet registry, empty panel sections.
- Product: Mesa de Entrada = default hub area; Inspectoría = example area; shared WA line for now.
- Data model: `docs/data-model.md` §2 (`areas`, `area_members`); `profiles.deactivated_at` pending.

## Goals / Non-Goals

**Goals:**

- Admins manage areas and operators end-to-end for Phase 1.
- Exactly one `is_default` area per org (Mesa de Entrada).
- Last active admin cannot be removed from admin role or deactivated.
- Seeded baseline ready for inbox routing by `default_area_id` / area membership.
- `operator_area_ids(uid)` helper ready for future conversations RLS.

**Non-Goals:**

- Conversations, messages thread model, triage UI, inquiry map.
- `external_contacts` WhatsApp task recipients.
- Automatic bot classification / distribution.
- Changing pet registration flow (except optional `default_area_id` on line).

## Decisions

### D1 — Schema

```text
areas (
  id, org_id, name, description, color,
  is_active bool default true,
  is_default bool default false,
  sla_warning_minutes int null,
  sla_critical_minutes int null,
  created_at, updated_at
)
unique (org_id, name)
partial unique (org_id) where is_default
area_members (area_id, user_id, is_lead bool default false, created_at)
  pk (area_id, user_id)
```

Add `profiles.deactivated_at timestamptz null` set when `is_active` becomes false (trigger or app).

Add `whatsapp_lines.default_area_id uuid null references areas(id)` if column absent.

### D2 — Last admin protection

SQL function / trigger: before update on `profiles`, if changing `role` away from `admin` or `is_active` to false, count other active admins in org; if zero → raise `P0001 last_admin`.

### D3 — Operator create

Server action with service role: `auth.admin.createUser` + insert profile + optional area memberships. Temp password returned once to admin UI (not logged). Roles: `admin` | `area_lead` | `operator` (`support` optional, not required in UI v1).

### D4 — Authorization

- Only `admin` role: operator-admin and area CRUD / membership write.
- `area_lead` / `operator`: read areas they belong to (for future inbox filters); no write.
- Reuse `require-role('admin')`.

### D5 — Seed

- Mesa de Entrada: `is_default=true`, color e.g. municipal primary.
- Inspectoría: `is_active=true`, not default.
- Set Inspectoria line `default_area_id` → Inspectoría.
- Admin profile: member of both areas (lead on Mesa optional).

### D6 — Conversations RLS deferred

Implement `public.operator_area_ids()` returning setof uuid for the caller’s memberships. Do **not** invent `conversations` table in this change. Document in ARCHITECTURE that FND-06 area isolation for conversations lands with inbox.

## Clean Architecture mapping

| Layer | Paths |
|---|---|
| Presentation | `apps/web/src/app/(panel)/settings/areas/**`, `settings/operators/**`, presentation forms |
| Application | `apps/web/src/features/admin/**` (create-operator, update-operator, areas, memberships) |
| Infrastructure | repositories for areas/members/profiles admin; supabase admin client |
| Contracts | Zod for area + operator admin inputs in `apps/web/src/contracts/` + shared types |
| DB | migrations, RLS, triggers, seed |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Admin lockout | last_admin trigger + tests |
| Two default areas | partial unique index + RPC to set default |
| Seed UUID clash | reuse fixed org UUID from existing seed |
| Scope creep into inbox | explicit non-goals; empty inbox remains |

## Follow-up

`mesa-entrada-inbox` — real queue, shared line, manual distribute to areas, citizen card + inquiry map.
