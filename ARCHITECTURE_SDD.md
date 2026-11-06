# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-11-06  
**Related OpenSpec change:** `openspec/changes/whatsapp-channel-core/`

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. Citizens write through WhatsApp (Evolution API). Operators work a **channel thread list + composer** now; full triage (claim/delegate/SLA/realtime) remains `mesa-entrada-inbox`. Verticals such as Inspectoría run area workflows on the **same** WhatsApp line initially (`+5492944216586`), with line `default_area_id` → Mesa de Entrada.

**Integrated baseline:**

- **Foundation** (archived): operator auth, org tenancy helpers, profiles, error tracking, panel shell.
- **Inspectoría pet registry** (main): Evolution webhook, worker jobs, registration state machine, animal tables.
- **Areas + operators admin** (archived): `areas` / `area_members`, profile email/deactivation, admin UI.
- **WhatsApp channel core** (this change): `conversations`, encrypted line secrets, inbound hardenings, delivery ACK persistence, admin `/settings/lines`, minimal inbox list/thread/composer with `send_mode` guard.

**Deferred follow-ups:**

- `mesa-entrada-inbox` — claim/delegate/realtime/SLA filters, delivery ticks UI polish, dual coords map UI, `current_area_ids()` on conversations RLS.
- Do **not** overload `citizens.latitude/longitude` (pet registration GPS) with mesa inquiry pins (inquiry coords live on `messages`).

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `(panel)/settings/lines`, `(panel)/inbox/**`, `api/webhooks/evolution/**`, `presentation/whatsapp/**` | Thin pages/forms; admin-only lines nav. |
| Application / services | `features/whatsapp-lines/**`, `features/outbound/**`, `features/conversations/**` (repos), worker jobs | Line CRUD/test; send-text; ingest + ACK. |
| Infrastructure / repositories | `infrastructure/{normalize-evolution,supabase-inbound-store,evolution,repositories}/**`, `worker/src/infrastructure/**`, migrations | Evolution client, AES secrets, inbound store. |
| Contracts / schemas | `contracts/{whatsapp-lines,conversations}.ts`, `packages/shared` (`send-mode`, `credentials`, `delivery-ack`, webhook) | Zod at API/LLM/webhook boundaries. |

## 3. Data & control flow

### 3.1 Inbound WhatsApp

```text
Citizen (WhatsApp) → Evolution → POST /api/webhooks/evolution
  → normalize (ignore group/broadcast/newsletter; resolve @lid; fromMe; media/location)
  → verify line webhook secret (fail closed if missing)
  → upsert citizen stub + conversation (default_area_id)
  → idempotent message upsert (line_id, external_id)
  → enqueue process_inbound (+ download_media for media kinds)
Worker → pet state machine unchanged; download_media idempotent on storage_path
messages.update → delivery_ack → update outbound delivery_status
```

### 3.2 Operator outbound

```text
Inbox thread → sendComposerTextAction
  → normalize phone → decideSend(org send_mode)
  → dry_run/allowlist-block: persist simulated/blocked, no Evolution
  → production/allowlisted: Evolution sendText + persist outbound
```

### 3.3 Line admin

```text
Admin → /settings/lines → create/update (RLS) + upsert ciphertext secrets (service role)
  → Probar conexión → Evolution connectionState → status/last_status_at
```

## 4. Routes

### 4.1 Pages

| Path | Notes |
|---|---|
| `/login` | Email/password operator sign-in |
| `/inbox` | Conversation list (channel; no claim UI) |
| `/inbox/[conversationId]` | Thread + text composer |
| `/citizens`, `/tasks` | Placeholders |
| `/settings/profile` | Name + avatar |
| `/settings/areas` | Admin areas |
| `/settings/operators` | Admin operators |
| `/settings/lines` | Admin WhatsApp lines + connection test |
| `/support/errors` | Support/admin error list |

### 4.2 API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/health` | none |
| POST | `/api/webhooks/evolution` | per-line webhook secret |
| POST | `/api/errors/report` | session |

## 5. Data schemas & models

Migration `20261107010000_whatsapp_channel_core.sql`:

- `whatsapp_lines`: `default_area_id`, `last_status_at`, status ∈ `connected|disconnected|error`
- `whatsapp_line_secrets`: `webhook_secret_ciphertext` (+ existing `api_key_ciphertext`); revoke authenticated; legacy `webhook_secret` for local seed
- `conversations`: unique `(org_id, line_id, phone_normalized)`; queue/bot defaults for inbox prep
- `messages.conversation_id`, delivery timestamps; location stays on message
- `citizens`: `registration_status`, `whatsapp_push_name` / avatar fields (POB-01 stub)
- Seed: Inspectoría line `default_area_id` → Mesa de Entrada
- Bucket `whatsapp-media` (private)

Encryption: AES-256-GCM via `CREDENTIALS_ENCRYPTION_KEY` (no service-role fallback).

## 6. AI / LLM boundaries

- Pet vision only in worker; webhook/panel channel paths have no LLM.

## 7. Error handling

- Webhook: 503 if secret not configured; 401 on mismatch; ignore groups without persistence.
- Composer: validation + send_mode outcomes; Evolution failures persist `failed` without leaking secrets.
- Connection test: non-secret status detail only.

## 8. Local environment

- `.env.example` documents Evolution URL/instance/key, webhook secret, `CREDENTIALS_ENCRYPTION_KEY`, `SEND_MODE=dry_run`.
- Seed remains runnable in dry_run without live Evolution.
- Agent/CI without Docker: Vitest + static SQL tests; live `db reset` / curl / E2E documented as gaps.

## 9. Non-goals / out of scope (this change)

Claim/delegate/realtime/SLA filters, inquiry map UI, Meta Cloud API, full WA-08 media send from panel (text only), delivery tick polish UI.

## 10. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-05 | Foundation auth/tenancy/profile/errors archived | `foundation-workspace-auth` |
| 2026-10-12 | Inspectoría pet registry MVP + UX v2 | `inspectoria-pet-registry-bot`, `inspectoria-pet-registry-ux-v2` |
| 2026-11-04 | Reconcile foundation into main + organizations superset | `reconcile-foundation-to-main` |
| 2026-11-06 | Areas, operators admin, `current_area_ids()`, last-admin | `areas-operators-admin` |
| 2026-11-06 | Conversations, line admin, inbound/outbound channel core | `whatsapp-channel-core` |
