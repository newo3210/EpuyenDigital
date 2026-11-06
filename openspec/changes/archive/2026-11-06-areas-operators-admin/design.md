## Context

- `main` has foundation auth (`profiles`, `current_org_id()`, `current_user_role()`) plus Inspectoría pet registry on a shared WhatsApp line.
- `areas` / `area_members` are designed in `docs/data-model.md` but not migrated.
- Seed already creates org `epuyen` and a WhatsApp line named Inspectoría; this change adds real **areas** Mesa de Entrada (default) + Inspectoría.
- Next epic `mesa-entrada-inbox` will apply area RLS to conversations; this change only ships the helper and admin UX.

## Goals / Non-Goals

**Goals:**

- Deliver FND-02..05 and FND-06 area-level foundations (`current_area_ids()`, area tables RLS).
- Admin UI to manage areas and operators with last-admin protection.
- Seed default Mesa de Entrada + Inspectoría.
- Persist SLA minute columns for later use.

**Non-Goals:**

- Inbox queue, claim, delegation, inquiry map / dual coords.
- WhatsApp line settings UI; linking `whatsapp_lines.default_area_id` beyond optional seed alignment.
- `external_contacts`, invite-by-email, password-reset branding.
- Computing SLA due times or business hours.
- Applying `current_area_ids()` policies on conversations/tasks (deferred to inbox).

## Decisions

### D1 — Temp password shown once (no invite email)

Admin submits a temporary password (or server generates one); Auth user is created with service role; UI displays the password once. Invite email flows add template/SMTP scope out of this change.

### D2 — Only admin writes areas/operators

Matches `docs/data-model.md` access matrix. `area_lead` may later manage members of their area in a follow-up; not in this change.

### D3 — Last active admin protection in DB

Enforce with a trigger or constraint function on `profiles` so UI bugs cannot strand the org. Count active rows with `role = 'admin'` in the same `org_id`.

### D4 — Replicate email on profiles

Directory listing needs email without Auth Admin API on every page load. Keep Auth email as source at create/update; store copy on `profiles` with org-scoped unique index when not null.

### D5 — SLA columns only

Store `sla_warning_minutes` / `sla_critical_minutes` (nullable positive ints; critical >= warning when both set). No engine.

### D6 — Single default via unique partial index + swap RPC/trigger

Partial unique index on `(org_id) WHERE is_default` plus a controlled update path that clears the previous default in one transaction.

### D7 — Operator create path

Presentation → application service → (1) Auth admin createUser, (2) profile upsert with email/role, (3) replace memberships. On failure after Auth create, compensate (delete Auth user) or mark failed and surface error — document in tasks; prefer transactional outbox-style compensation in the service.

### D8 — Nav

Add `/settings/areas` and `/settings/operators` visible only to `admin`. Keep `/settings/profile` for all roles.

## Clean Architecture mapping

| Layer | Responsibility in this change | Concrete paths |
|---|---|---|
| Presentation / HTTP thin | Settings pages, forms, admin-only nav | `apps/web/src/app/(panel)/settings/areas/**`, `settings/operators/**`, `presentation/layout/nav-items.ts`, presentational form components |
| Application / services | Create/update area; create/deactivate operator; last-admin checks at app level (DB is source of truth) | `apps/web/src/features/areas/**`, `apps/web/src/features/operators/**` |
| Infrastructure / repositories | Supabase client, Auth admin API | `apps/web/src/infrastructure/supabase/**` |
| Contracts / schemas | Zod for area/operator payloads | `apps/web/src/contracts/areas.ts`, `contracts/operators.ts` (or under `packages/shared` if shared with worker — prefer web contracts unless reused) |

No LLM boundaries.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Orphan Auth user if profile insert fails | Compensating delete in service; integration test |
| Last-admin race with two tabs | DB trigger as final authority |
| Email drift vs Auth | Admin update email path updates both or rejects email change in v1 (prefer reject email change after create in this change) |
| Seed vs existing pet line name "Inspectoría" | Areas are separate entities; document that line name coincidence is intentional labeling, not FK |
| Agent env without Docker | SQL tests may be skipped with documented gap; Vitest covers contracts/services with mocks; live reset when containers available |

## Rollback

- Feature flag not required for local-only; revert migration forward-only with drop migration if needed before production use.
- UI routes can ship behind admin role guard even if empty.

## Follow-ups

1. `mesa-entrada-inbox` — queue + area RLS on conversations using `current_area_ids()`.
2. Optional: `whatsapp_lines.default_area_id` → Mesa de Entrada.
3. Optional: area_lead manages own memberships.
