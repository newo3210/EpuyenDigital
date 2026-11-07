# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-11-07  
**Related OpenSpec change:** `openspec/changes/mesa-entrada-inbox/`

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. Citizens write through WhatsApp (Evolution API). Operators triage a **FIFO unowned-first queue** with claim/delegate, SLA colors, realtime badges, quick replies, delivery ticks, and inquiry map pins.

**Integrated baseline:**

- Foundation, areas/operators admin, WhatsApp channel core (conversations, encrypted secrets, composer).
- **Mesa de Entrada inbox (this change):** SQL transition RPCs, `conversation_events`, read state, quick replies, area RLS via `current_area_ids()`, SLA helpers, queue UI, realtime, dual inquiry coords, optional pet `process_inbound` gate.

**Deferred follow-ups:**

- LLM auto-routing / RAG bot (Phase 6)
- Full POB CRUD; tasks epic; WA media outbound composer
- Live Docker DB proof when containers available

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `(panel)/inbox/**`, `presentation/whatsapp/**` | Queue/kanban, thread actions, map, realtime badge |
| Application / services | `features/inbox/**`, `features/outbound/**` | Transitions wrappers, SLA, queue sort, ensure_owner on send |
| Infrastructure / repositories | `infrastructure/repositories/{inbox-queue,conversations}.ts`, inbound store, migrations | RPC repos, reopen + pet gate |
| Contracts / schemas | `contracts/{inbox,conversations}.ts`, shared `database.types` | Zod filters/cards/events |

## 3. Data & control flow

### 3.1 Inbound WhatsApp

```text
Citizen → Evolution → POST /api/webhooks/evolution
  → persist message + conversation
  → denorm inquiry lat/lng on conversation (never citizens GPS)
  → reopen_conversation if resolved
  → pet process_inbound only if area is Inspectoría OR open registration session
  → realtime notifies panel
```

### 3.2 Operator triage / outbound

```text
/inbox → listInboxQueue (FIFO unowned-first + filters + SLA)
/inbox/[id] → claim/delegate/accept/reject/move/resolve/set_area RPCs
Composer → ensure_owner_for_reply → decideSend(send_mode) → Evolution
```

## 4. Routes

| Path | Notes |
|---|---|
| `/inbox` | Triage queue (kanban columns), filters, realtime badge/sound |
| `/inbox/[conversationId]` | Thread, events, delivery ticks, actions, quick replies, map |
| `/settings/lines` | WhatsApp line admin (unchanged) |

## 5. Data schemas & models

Migration `20261107120000_mesa_entrada_inbox.sql`:

- Tables: `conversation_events`, `conversation_reads`, `quick_replies` (+ municipal seed)
- Columns: `conversations.inquiry_*`, `last_message_preview`, `has_attachments`; `org_settings.business_hours/holidays/bot_paused`
- RPCs: `claim_conversation`, `delegate_conversation`, `accept/reject_conversation_delegation`, `ensure_owner_for_reply`, `move_conversation`, `resolve_conversation`, `reopen_conversation`, `set_conversation_area`, `mark_conversation_read`
- Helpers: `business_minutes_between`, `compute_conversation_sla_status`
- RLS: conversations/messages via `current_area_ids()` + admin + delegation visibility
- Realtime publication: conversations, messages, conversation_events

## 6. AI / LLM boundaries

- No LLM in inbox triage paths.

## 7. Error handling

- Ownership races → `CLAIM_CONFLICT` (mapped to es-AR toast with owner name).
- Webhook secret fail-closed unchanged.
- Pet gate skips `process_inbound` on Mesa without registration session (documented product rule).

## 8. Local environment

- Agent/CI without Docker: Vitest + static SQL contract tests; live `db reset` / curl RPC / E2E → **NO_DOCKER** gap reports under change `reports/`.

## 9. Non-goals / out of scope (this change)

LLM routing, full POB CRUD, tasks epic, WA media outbound.

## 10. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-05 | Foundation auth/tenancy/profile/errors archived | `foundation-workspace-auth` |
| 2026-10-12 | Inspectoría pet registry MVP + UX v2 | `inspectoria-pet-registry-*` |
| 2026-11-04 | Reconcile foundation into main | `reconcile-foundation-to-main` |
| 2026-11-06 | Areas, operators admin, `current_area_ids()` | `areas-operators-admin` |
| 2026-11-06 | Conversations, line admin, channel core | `whatsapp-channel-core` |
| 2026-11-07 | Mesa triage inbox INB-01..15 + dual coords + area RLS | `mesa-entrada-inbox` |
