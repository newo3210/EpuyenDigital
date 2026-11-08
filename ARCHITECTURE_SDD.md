# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-11-08  
**Related OpenSpec change:** `openspec/changes/pobladores-ficha/`

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. Citizens write through WhatsApp (Evolution API). Operators claim, delegate, and resolve threads in `/inbox`. Verticals such as Inspectoría run area workflows on the **same** WhatsApp line initially (`+5492944216586`), with line `default_area_id` → Mesa de Entrada. A manual area change is a human label only: every non-fromMe inbound still enqueues `process_inbound`.

**Integrated baseline:**

- **Foundation** (archived): operator auth, org tenancy helpers, profiles, error tracking, panel shell.
- **Inspectoría pet registry** (main): Evolution webhook, worker jobs, registration state machine, animal tables.
- **Areas + operators admin** (archived): `areas` / `area_members`, profile email/deactivation, admin UI.
- **WhatsApp channel core** (archived): `conversations`, encrypted line secrets, inbound hardenings, delivery ACK persistence, admin `/settings/lines`, text composer with `send_mode` guard.
- **Mesa de entrada inbox**: claim/delegate/accept/reject/move/resolve/reopen, area-scoped reads, business-hours SLA, queue filters, ticks, OpenStreetMap links, quick replies.
- **Pobladores ficha** (this change): org-wide citizen search, profile edit, register, merge, and a manual-source guard. Notes and tasks stay deferred.

**Deferred follow-ups:**

- Panel media send (WA-08) and a `send_mode` admin chooser (WA-11).
- Do **not** overload `citizens.latitude/longitude` (pet registration GPS) with mesa inquiry pins (inquiry coords live on `messages`).
- Do **not** gate `process_inbound` on the conversation area.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `(panel)/inbox/**`, `(panel)/citizens/**`, `(panel)/settings/{lines,quick-replies,hours}`, `presentation/inbox/**`, `presentation/citizens/**`, `presentation/whatsapp/**` | No Supabase imports in presentation. Support renders no mutating controls. |
| Application / services | `features/inbox/**`, `features/citizens/**`, `features/outbound/**`, worker jobs | User-scoped RPCs. Composer calls `ensure_owner_for_reply` before persist or Evolution. |
| Infrastructure / repositories | `infrastructure/repositories/{inbox,citizens}.ts`, `supabase-inbound-store.ts`, migrations | Service role for webhook reopen and the pet worker. The citizen guard trigger lives in SQL. |
| Contracts / schemas | `contracts/inbox.ts`, `contracts/citizens.ts`, `packages/shared` (`business-minutes`, `inbox-side-effects`, `citizen-fields`) | Zod at filter, delegate, profile, and merge boundaries. |

## 3. Data & control flow

### 3.1 Inbound WhatsApp

```text
Citizen (WhatsApp) → Evolution → POST /api/webhooks/evolution
  → normalize (ignore group/broadcast/newsletter; resolve @lid; fromMe; media/location)
  → verify line webhook secret (fail closed if missing)
  → upsert citizen stub + conversation (default_area_id)
  → idempotent message upsert (line_id, external_id)
  → if the thread was resolved and the message is from the citizen, service-role reopen_conversation (idempotent per message id)
  → enqueue process_inbound (+ download_media for media kinds)
Worker → pet state machine unchanged; download_media idempotent on storage_path
messages.update → delivery_ack → update outbound delivery_status
```

### 3.2 Operator outbound

```text
Inbox thread → sendComposerTextAction
  → ensure_owner_for_reply (claim, accept, or NOT_OWNER with the other name)
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
| `/inbox` | Queue from `list_inbox_queue` (unowned FIFO, then owned by latest inbound). Filters. |
| `/inbox/[conversationId]` | Thread, ticks, OSM links, events, claim/delegate/move/resolve, text composer, link and edit of the citizen ficha |
| `/settings/quick-replies` | Admin quick replies |
| `/settings/hours` | Admin business hours and holidays |
| `/citizens` | Search by name, DNI (`document_id`), or phone. Empty query lists nothing. |
| `/citizens/[id]` | Ficha, missing fields, register, timeline, merge into this record. A merged row redirects to the keeper. |
| `/tasks` | Placeholder |
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
- `conversations`: unique `(org_id, line_id, phone_normalized)`; preview columns; `sla_due_at` from a BEFORE trigger using area critical minutes and `org_settings` business hours
- `conversation_events`, `conversation_reads`, `quick_replies`
- Transitions are `SECURITY DEFINER`, `search_path = ''`, `auth.uid()` checks. Authenticated clients cannot write conversations, messages, or events directly
- Reads: admin and support see the org; area roles see `area_id` or `pending_area_id` in `current_area_ids()`, or they are owner or delegator
- `messages.conversation_id`, delivery timestamps; location stays on message
- `citizens`: `registration_status`, `whatsapp_push_name` / avatar fields (POB-01 stub). Ficha migration adds `email`, `tags`, `observations`, `field_sources`, `merged_into_id`, `registered_at`, `registered_by`. DNI stays in `document_id`.
- Citizen mutations are `update_citizen_profile`, `register_citizen`, `search_citizens`, and `merge_citizens` (`SECURITY DEFINER`, `search_path = ''`). Authenticated can SELECT the caller's organization and cannot UPDATE `citizens`. A BEFORE UPDATE trigger restores any column whose `field_sources` value is `manual` unless the session flag `app.citizen_field_write` is `operator`.
- Search is the RPC (limit 20, skips merged rows). The page does not download the citizen table.
- Timeline reads messages, `conversation_events`, and animals through the user client, so area message RLS still applies. It does not read notes or tasks.
- Seed: Inspectoría line `default_area_id` → Mesa de Entrada
- Bucket `whatsapp-media` (private)

Encryption: AES-256-GCM via `CREDENTIALS_ENCRYPTION_KEY` (no service-role fallback).

## 6. AI / LLM boundaries

- Pet vision only in worker; webhook/panel channel paths have no LLM.

## 7. Error handling

- Webhook: 503 if secret not configured; 401 on mismatch; ignore groups without persistence.
- Composer: ownership failure returns before Evolution; validation + send_mode outcomes; Evolution failures persist `failed` without leaking secrets.
- Transition functions raise `P0001` with a hint code (`CLAIM_CONFLICT`, `NOT_OWNER`, `FORBIDDEN`, `NOTE_REQUIRED`, and the rest in the design).
- Connection test: non-secret status detail only.

## 8. Local environment

- `.env.example` documents Evolution URL/instance/key, webhook secret, `CREDENTIALS_ENCRYPTION_KEY`, `SEND_MODE=dry_run`.
- Seed remains runnable in dry_run without live Evolution.
- Agent/CI without Docker: Vitest + static SQL tests; live `db reset` / curl / E2E documented as gaps.

## 9. Non-goals / out of scope (this change)

Panel media upload (WA-08), `send_mode` settings screen (WA-11), Meta Cloud API, pet-area gating, notes, tasks, and the bot questionnaire. Realtime refreshes the router; it does not patch the client cache in place. Home coordinates edited on the ficha are `citizens.latitude` / `longitude`. Message pins stay on `messages`.

## 10. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-05 | Foundation auth/tenancy/profile/errors archived | `foundation-workspace-auth` |
| 2026-10-12 | Inspectoría pet registry MVP + UX v2 | `inspectoria-pet-registry-bot`, `inspectoria-pet-registry-ux-v2` |
| 2026-11-04 | Reconcile foundation into main + organizations superset | `reconcile-foundation-to-main` |
| 2026-11-06 | Areas, operators admin, `current_area_ids()`, last-admin | `areas-operators-admin` |
| 2026-11-06 | Conversations, line admin, inbound/outbound channel core | `whatsapp-channel-core` |
| 2026-11-08 | Inbox triage, business-hours SLA, area reads, reopen | `mesa-entrada-inbox` |
| 2026-11-08 | Citizen ficha, manual-source guard, search, merge | `pobladores-ficha` |
