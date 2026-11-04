# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-11-04  
**Related OpenSpec change:** `openspec/changes/areas-operators-admin/`

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. Citizens write through WhatsApp (Evolution API). Operators will work a triage queue (Mesa de Entrada); verticals such as Inspectoría run area workflows on the **same** WhatsApp line initially (`+5492944216586`).

**Integrated baseline:**

- **Foundation**: operator auth, org tenancy helpers, profiles, error tracking, panel shell.
- **Inspectoría pet registry**: Evolution webhook, worker jobs, registration state machine, animal tables.
- **Areas & operators admin** (this change): municipal `areas` / `area_members`, last-admin protection, admin UI for Áreas and Operadores, seed Mesa + Inspectoría.

**Deferred follow-ups (not implemented here):**

- `mesa-entrada-inbox` — real triage queue, shared-line routing, manual distribute, inquiry map.
- Do **not** overload `citizens.latitude/longitude` (pet registration GPS) with mesa inquiry pins.
- Conversation/task RLS by area attaches later using `operator_area_ids()`.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `apps/web/src/app/(auth)/**`, `(panel)/**`, `api/webhooks/evolution/**`, `api/health/**`, `api/errors/**`, `middleware.ts`, `presentation/admin/**` | Auth pages, panel shell, settings admin UI, thin webhook/health/error report. |
| Application / services | `apps/web/src/features/{auth,profile,errors,admin}/**`, `worker/src/features/registration/**`, `worker/src/jobs/**`, `packages/shared/src/{registration,redact,trace,initials,contracts}/**` | Operator use-cases + admin area/operator services + pet state machine / jobs. |
| Infrastructure / repositories | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**`, `supabase/migrations/**`, `supabase/seed/**` | Supabase clients, storage, Evolution, vision LLM, areas/operators repos. |
| Contracts / schemas | `apps/web/src/contracts/**`, `packages/shared/src/contracts/**` | Zod at API, form, webhook, job, and LLM boundaries. |

Deliberate deviations:

- Authorization invariants live in Postgres (RLS helpers + guard triggers, including `last_admin` and `set_default_area`).
- Pet state transitions that must be atomic live in SQL (`complete_animal_registration`, `claim_next_job`, session locks).

## 3. Data & control flow

### 3.1 Panel request pipeline

```text
Browser → middleware.ts
  → resolveTraceId → updateSession → resolveRouteAccess
  → anonymous on panel path → 307 /login?next=…
Public prefixes: /login, /api (webhook + health + error report stay reachable).
Root `/` redirects to `/inbox` (guards send anonymous users to login).
```

### 3.2 Admin areas / operators

```text
Admin → /settings/areas|operators
  → requirePageRole(['admin']) / requireRole in use-cases
  → create/update area (RLS) | set_default_area RPC
  → create operator: service-role auth.admin.createUser + profile insert + area_members
  → update operator: admin RLS; last_admin trigger rejects sole-admin demote/deactivate
  → deactivated_at synced when is_active flips; requireOperator still blocks inactive sign-in
```

### 3.3 Pet inbound (unchanged behavior)

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
| `/settings/profile` | Name + avatar |
| `/settings/areas`, `/settings/areas/new`, `/settings/areas/[id]` | Admin-only municipal areas |
| `/settings/operators`, `/settings/operators/new`, `/settings/operators/[id]` | Admin-only operators + memberships |
| `/support/errors` | Support/admin error list |

### 4.2 API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | none |
| POST | `/api/webhooks/evolution` | webhook secret |
| POST | `/api/errors/report` | session (client reports) |

## 5. Data schemas & models

### 5.1 Organizations superset

Canonical `organizations` columns after reconcile migration `20261104120000_reconcile_organizations_superset.sql` plus areas migration `20261104130000_areas_operators.sql`:

- Foundation: `id`, `name`, `slug`, `created_at`
- Pets: `timezone`, `updated_at` + trigger; pet tables retained
- Areas: `areas`, `area_members`; `profiles.deactivated_at`; `whatsapp_lines.default_area_id`
- Helpers: `operator_area_ids()`, `set_default_area(uuid)`; triggers `profiles_guard_last_admin`, `profiles_sync_deactivated_at`

### 5.2 Contracts

- Foundation: roles, profile, error-log, **area / areaMembership**
- Web admin: `contracts/admin-areas.ts`, `contracts/admin-operators.ts`
- Pets: evolution webhook, registration session, citizen, animal, jobs, outbound, vision traits

### 5.3 Seed

- Fixed UUIDs: org `…0001`, line `…0002`, Mesa area `…0010` (`is_default`), Inspectoría area `…0011`
- Line `default_area_id` → Inspectoría; seed admin member of both areas (lead on Mesa)

## 6. AI / LLM boundaries

- Pet vision only: `VisionClient` in worker; output `visionTraitsSchema`; no LLM in webhook or panel foundation/admin.

## 7. Error handling

- Foundation: redacted `error_logs`, client report rate limit, support UI.
- Admin: `last_admin` / duplicate email mapped in `features/admin/map-admin-error.ts`.
- Pets: webhook fail-closed on secret; worker retries with redacted logs.

## 8. Local environment

- Supabase CLI via `scripts/supabase.mjs` (Podman/Docker).
- `.env.example` unions panel and pet variables (no new seed vars for this change).
- **Seed path:** `npm run db:reset` runs SQL seed (org, line, neighborhoods, **areas**). `npm run db:seed` upserts the same bootstrap + admin user/profile/memberships.

## 9. Non-goals / out of scope (this change)

Real triage inbox, conversations table, inquiry map UI, `external_contacts`, automatic classification, rewriting pet conversation machine.

## 10. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-05 | Foundation auth/tenancy/profile/errors archived | `foundation-workspace-auth` |
| 2026-10-12 | Inspectoría pet registry MVP + UX v2 | `inspectoria-pet-registry-bot`, `inspectoria-pet-registry-ux-v2` |
| 2026-11-04 | Reconcile foundation into main + organizations superset | `reconcile-foundation-to-main` |
| 2026-11-04 | Municipal areas, operator admin UI, last_admin, seed Mesa+Inspectoría | `areas-operators-admin` |
