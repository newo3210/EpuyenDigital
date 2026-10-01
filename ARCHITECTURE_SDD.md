# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-09-30
**Related OpenSpec change:** none yet — design baseline at SDD bootstrap (no application code exists)

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. Citizens write through WhatsApp (Evolution API). An LLM chatbot answers from official documents (RAG) and hands off to humans when unsure. Operators work a triage queue (unassigned-first FIFO, claim, delegation with acceptance, soft handoff), create tasks and notes delegable to municipal areas or external WhatsApp contacts, and every state change is recorded append-only. A citizens database starts with the phone number and grows with use.

Status: **design only**. Detailed product design lives in `docs/architecture.md`, `docs/data-model.md`, `docs/flows.md` (Spanish). Roadmap: `.planning/ROADMAP.md`.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo (planned) | Notes |
|---|---|---|
| Presentation / HTTP thin | `apps/web/src/app/**`, `apps/web/src/presentation/**` | Pages, route handlers (incl. `api/webhooks/evolution`), components. Zod parse → service call. |
| Application / services | `apps/web/src/features/**`, `worker/src/features/**`, `worker/src/jobs/**`, `packages/shared/src/**` | Business rules, bot/RAG orchestration, queue ordering, SLA, phone normalization |
| Infrastructure / repositories | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**`, `supabase/migrations/**` | Supabase clients, Evolution client, Storage, crypto, LLM adapters; SQL transition functions |
| Contracts / schemas | `apps/web/src/contracts/**`, `packages/shared/src/contracts/**` | Zod schemas for webhook, jobs, server actions, LLM outputs; generated DB types |

Deliberate deviation: atomic state transitions are SQL functions (transaction boundary), called by services via repositories.

## 3. Data & control flow

```text
Citizen (WhatsApp) → Evolution API → POST /api/webhooks/evolution (thin: secret check, Zod normalize)
  → messaging service: upsert citizen + conversation + message (idempotent), reopen if resolved
    → jobs table: media.download, bot.reply
  ← 200 OK
Worker → jobs (FOR UPDATE SKIP LOCKED)
  → media service: download → Storage → transcribe / read
  → bot service: guards (global pause, human owner, hours) → RAG (pgvector) → LLM (Zod output)
      → answer via outbound service (send-mode guard → Evolution)  OR  handoff → queue (SQL function)
Operator (panel) → server actions → services → SQL functions (claim / delegate / accept / reject / resolve)
  → Realtime → queue and thread update in every open panel
```

## 4. API routes (planned)

| Method | Path | Auth | Request schema | Response | Service |
|---|---|---|---|---|---|
| POST | `/api/webhooks/evolution` | Line webhook secret (mandatory) | `evolutionWebhookSchema` | 200 / 401 / 404 / 503 | `messaging/ingestInbound` |
| — | Server actions (inbox, citizens, tasks, notes, settings) | Supabase session + role/area | per-action Zod schemas | typed result / error code | feature services |

## 5. Data schemas & models

### 5.1 Contracts
Planned Zod contracts: webhook payload, job payloads per `job_type`, server action inputs, LLM outputs (`botDecisionSchema`, `classificationSchema`, `extractedFieldsSchema`).

### 5.2 Persistence
See `docs/data-model.md`. Core tables: `organizations`, `profiles`, `areas`, `area_members`, `external_contacts`, `whatsapp_lines`, `citizens`, `citizen_phones`, `conversations`, `messages`, `conversation_events`, `tasks`, `task_history`, `notes`, `entity_mentions`, `knowledge_documents`, `knowledge_chunks`, `bot_runs`, `jobs`, `activity_log`, `error_logs`.

## 6. AI / LLM boundaries

- Provider/model: to be decided (roadmap Phase 6) behind `contracts/llm.ts` (`chat`, `embed`, `transcribe`, `vision`).
- Prompt ownership: `worker/src/features/bot/**`.
- Output: strict Zod schemas; invalid → retry once → handoff with reason `error`.
- Guardrails: answers only from retrieved official chunks with citations; low confidence → handoff; extracted personal data saved only after citizen confirmation.

## 7. Error handling

- SQL functions raise stable error codes (`CLAIM_CONFLICT`, `OWNER_REQUIRED`, `NOT_AWAITING_ACCEPTANCE`, …) mapped to es-AR messages in presentation.
- Webhook fails closed (unknown instance, missing secret). Worker retries with backoff; exhausted jobs → `error_logs` with trace id and redacted details.

## 8. Non-goals / out of scope

Fine-tuning, digital case files/e-signature, native mobile app, WhatsApp groups, Meta Cloud API (v2), anything insurance-specific from the reference CRM.

## 9. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
