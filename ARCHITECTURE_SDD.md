# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-11-06  
**Related OpenSpec change:** `openspec/changes/areas-operators-admin/`

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. Citizens write through WhatsApp (Evolution API). Operators will work a triage queue (Mesa de Entrada); verticals such as Inspectoría run area workflows on the **same** WhatsApp line initially (`+5492944216586`).

**Integrated baseline:**

- **Foundation** (archived `2026-10-05-foundation-workspace-auth`): operator auth, org tenancy helpers, profiles, error tracking, panel shell.
- **Inspectoría pet registry** (main): Evolution webhook, worker jobs, registration state machine, animal tables.
- **Areas + operators admin** (this change): `areas` / `area_members`, profile `email` + `deactivated_at`, `current_area_ids()`, last-active-admin protection, admin UI under Configuración, seed Mesa de Entrada (default) + Inspectoría.

**Deferred follow-ups:**

- `mesa-entrada-inbox` — real triage queue; apply `current_area_ids()` to conversations/tasks RLS; inquiry coordinates separate from pet GPS.
- Do **not** overload `citizens.latitude/longitude` (pet registration GPS) with mesa inquiry pins.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `apps/web/src/app/(auth)/**`, `(panel)/**` incl. `settings/areas`, `settings/operators`, `api/webhooks/evolution/**`, `middleware.ts`, `presentation/{areas,operators,layout}/**` | Thin pages/forms; admin-only nav. |
| Application / services | `apps/web/src/features/{auth,profile,errors,areas,operators}/**`, `worker/src/features/registration/**`, `packages/shared/src/{registration,redact,trace,initials}/**` | Area CRUD; operator create with Auth compensation; last-admin messaging. |
| Infrastructure / repositories | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**`, `supabase/migrations/**`, `supabase/seed/**` | Supabase clients, Auth admin API, areas/operators repos. |
| Contracts / schemas | `apps/web/src/contracts/**`, `packages/shared/src/contracts/**` | Zod for area/operator payloads + shared profile/roles. |

Deliberate deviations:

- Authorization invariants live in Postgres (RLS helpers + guard triggers including last-admin and single default area).
- Operator Auth user creation uses service role; profile insert uses service role; memberships use the admin's user-scoped client under RLS.

## 3. Data & control flow

### 3.1 Panel request pipeline

```text
Browser → middleware.ts
  → resolveTraceId → updateSession → resolveRouteAccess
  → anonymous on panel path → 307 /login?next=…
Public prefixes: /login, /api
Root `/` redirects to `/inbox`.
```

### 3.2 Admin operator create (D1 / D7)

```text
Admin UI → createOperatorAction (requirePageRole admin)
  → createOperator use case
    → Auth admin createUser (service role)
    → profiles insert (service role, email replicated)
    → area_members replace (user-scoped RLS)
    → on failure after Auth create: deleteAuthUser compensation
  → UI shows temporary password once (no invite email)
```

### 3.3 Pet inbound (unchanged)

```text
Citizen (WhatsApp) → Evolution → POST /api/webhooks/evolution
  → verify line webhook secret → normalize → persist → enqueue process_inbound
Worker → claim_next_job → registration state machine → outbound / media / traits
```

## 4. Routes

### 4.1 Pages

| Path | Notes |
|---|---|
| `/login` | Email/password operator sign-in |
| `/inbox`, `/citizens`, `/tasks` | Panel shell placeholders (not real triage) |
| `/settings/profile` | Name + avatar (all roles) |
| `/settings/areas` | Admin-only municipal areas |
| `/settings/operators` | Admin-only operator directory / create / deactivate |
| `/support/errors` | Support/admin error list |

### 4.2 API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | none |
| POST | `/api/webhooks/evolution` | webhook secret |
| POST | `/api/errors/report` | session (client reports) |

## 5. Data schemas & models

### 5.1 Areas & memberships

Migration `20261106120000_areas_operators_admin.sql`:

- `areas`: name (unique per org, case-insensitive trim), `#RRGGBB` color, `is_active`, single `is_default` via partial unique index + `areas_guard_default` trigger, optional positive SLA minutes with critical ≥ warning
- `area_members`: PK `(area_id, user_id)`, same-org trigger, admin-only writes
- `profiles.email` (unique per org when not null), `profiles.deactivated_at` (synced with `is_active`)
- `current_area_ids()` → set of membership area ids for the active caller (empty when inactive)
- `profiles_guard_last_active_admin` rejects demotion/deactivation that would leave zero active admins
- Email change after create: **rejected in application layer** for this change (D4 mitigation)

### 5.2 Seed

- SQL + `seed.ts`: Mesa de Entrada (`is_default`) + Inspectoría for org `epuyen`; existing pet WhatsApp line seed unchanged (name coincidence is labeling, not FK)

### 5.3 Contracts

- Web: `contracts/areas.ts`, `contracts/operators.ts`
- Shared: roles, profile, error-log, pet contracts; `Database` types include `areas` / `area_members` / `current_area_ids`

## 6. AI / LLM boundaries

- Pet vision only: `VisionClient` in worker; output `visionTraitsSchema`; no LLM in webhook or panel foundation/admin.

## 7. Error handling

- Foundation: redacted `error_logs`, client report rate limit, support UI.
- Pets: webhook fail-closed on secret; worker retries with redacted logs.
- Operators: last-admin and duplicate-email mapped to es-AR messages; Auth compensation on create failure.

## 8. Local environment

- Supabase CLI via `scripts/supabase.mjs` (Podman/Docker).
- `.env.example` unions panel and pet variables.
- **Seed path:** `npm run db:reset` runs SQL seed (org, settings, Inspectoría line, neighborhoods, **areas**). `npm run db:seed` upserts the same bootstrap and admin profile with email.

## 9. Non-goals / out of scope (this change)

Real triage inbox, applying `current_area_ids()` to conversations/tasks RLS, invite-by-email, WhatsApp line settings UI, SLA due-time engine, area_lead managing own memberships.

## 10. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-05 | Foundation auth/tenancy/profile/errors archived | `foundation-workspace-auth` |
| 2026-10-12 | Inspectoría pet registry MVP + UX v2 | `inspectoria-pet-registry-bot`, `inspectoria-pet-registry-ux-v2` |
| 2026-11-04 | Reconcile foundation into main + organizations superset | `reconcile-foundation-to-main` |
| 2026-11-06 | Areas, operators admin, `current_area_ids()`, last-admin | `areas-operators-admin` |
