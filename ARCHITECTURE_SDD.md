# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-11-04  
**Related OpenSpec change:** `openspec/changes/reconcile-foundation-to-main/`

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. Citizens write through WhatsApp (Evolution API). Operators will work a triage queue (Mesa de Entrada); verticals such as Inspectoría run area workflows on the **same** WhatsApp line initially (`+5492944216586`).

**Integrated baseline (this change):**

- **Foundation** (archived `2026-10-05-foundation-workspace-auth`): operator auth, org tenancy helpers, profiles, error tracking, panel shell (empty Inbox/Citizens/Tasks).
- **Inspectoría pet registry** (main): Evolution webhook, worker jobs, registration state machine, animal tables, UX v2 guided chat.

**Deferred follow-ups (not implemented here):**

- `areas-operators-admin` — Mesa + Inspectoría areas, FND-02..05.
- `mesa-entrada-inbox` — real triage queue, shared-line routing, manual distribute, **inquiry** coordinates separate from pet GPS, map on home citizen card.
- Do **not** overload `citizens.latitude/longitude` (pet registration GPS) with mesa inquiry pins.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `apps/web/src/app/(auth)/**`, `(panel)/**`, `api/webhooks/evolution/**`, `api/health/**`, `api/errors/**`, `middleware.ts` | Auth pages, panel shell, thin webhook/health/error report. |
| Application / services | `apps/web/src/features/{auth,profile,errors}/**`, `worker/src/features/registration/**`, `worker/src/jobs/**`, `packages/shared/src/{registration,redact,trace,initials}/**` | Operator use-cases + pet state machine / jobs. |
| Infrastructure / repositories | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**`, `supabase/migrations/**`, `supabase/seed/**` | Supabase clients, storage, Evolution, vision LLM. |
| Contracts / schemas | `apps/web/src/contracts/**`, `packages/shared/src/contracts/**` | Zod at API, form, webhook, job, and LLM boundaries. |

Deliberate deviations:

- Authorization invariants live in Postgres (RLS helpers + guard triggers).
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

### 3.2 Pet inbound (unchanged behavior)

```text
Citizen (WhatsApp) → Evolution → POST /api/webhooks/evolution
  → verify line webhook secret → normalize → persist → enqueue process_inbound
Worker → claim_next_job → registration state machine → outbound / media / traits
```

## 4. Routes

### 4.1 Pages (foundation)

| Path | Notes |
|---|---|
| `/login` | Email/password operator sign-in |
| `/inbox`, `/citizens`, `/tasks` | Panel shell placeholders (not real triage) |
| `/settings/profile` | Name + avatar |
| `/support/errors` | Support/admin error list |

### 4.2 API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | none |
| POST | `/api/webhooks/evolution` | webhook secret |
| POST | `/api/errors/report` | session (client reports) |

## 5. Data schemas & models

### 5.1 Organizations superset (D2)

Canonical `organizations` columns after reconcile migration `20261104120000_reconcile_organizations_superset.sql`:

- Foundation: `id`, `name`, `slug`, `created_at`
- Pets: `timezone` (default `America/Argentina/Buenos_Aires`), `updated_at` + trigger
- Keep pet `org_settings` and all pet tables; keep foundation `profiles`, `error_logs`, RLS helpers, avatars bucket

Path chosen: **forward-only reconcile migration** (do not rewrite published pet migration history).

### 5.2 Contracts

- Foundation: roles, profile, error-log (+ web contracts for auth/profile/errors)
- Pets: evolution webhook, registration session, citizen, animal, jobs, outbound, vision traits

## 6. AI / LLM boundaries

- Pet vision only: `VisionClient` in worker; output `visionTraitsSchema`; no LLM in webhook or panel foundation.

## 7. Error handling

- Foundation: redacted `error_logs`, client report rate limit, support UI.
- Pets: webhook fail-closed on secret; worker retries with redacted logs.

## 8. Local environment

- Supabase CLI via `scripts/supabase.mjs` (Podman/Docker).
- `.env.example` unions panel (`NEXT_PUBLIC_SUPABASE_*`) and pet (`SUPABASE_URL`, `WEBHOOK_SECRET`, Evolution, vision) variables.
- **Seed path:** `npm run db:reset` runs SQL seed (`supabase/seed.sql`: org `00000000-0000-4000-8000-000000000001` / slug `epuyen`, `org_settings`, Inspectoría line + secret, neighborhoods). `npm run db:seed` (`supabase/seed/seed.ts`) creates the admin operator **and** upserts the same pet bootstrap idempotently (shared fixed org/line UUIDs). Optional `SEED_WEBHOOK_SECRET` defaults to `dev-webhook-secret-change-me`.

## 9. Non-goals / out of scope (this change)

Real triage inbox, areas tables, inquiry map UI, automatic classification, rewriting pet conversation machine, completing adversarial review for `inspectoria-pet-registry-ux-v2`.

## 10. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-05 | Foundation auth/tenancy/profile/errors archived | `foundation-workspace-auth` |
| 2026-10-12 | Inspectoría pet registry MVP + UX v2 | `inspectoria-pet-registry-bot`, `inspectoria-pet-registry-ux-v2` |
| 2026-11-04 | Reconcile foundation into main + organizations superset | `reconcile-foundation-to-main` |
