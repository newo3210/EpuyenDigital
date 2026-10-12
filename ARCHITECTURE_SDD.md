# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-10-12
**Related OpenSpec change:** `inspectoria-pet-registry-bot`

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. This change ships a **standalone MVP vertical**: WhatsApp pet registration on the Inspectoría line (`+5492944216586`) via Evolution API, without the operator panel.

Citizens register dog/cat/other pets through a guided chat (consent → citizen + GPS → animal fields → photos). The worker activates the animal immediately, assigns a municipal ID `{BARRIO3}-{YYYY}-{SEQ5}` (fallback `EPU`), and sends a confirmation. Vision traits run asynchronously.

Status: **MVP code present** under `apps/web`, `worker/`, `packages/shared`, `supabase/`, `infra/evolution/`. Broader panel design remains in `docs/architecture.md`.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `apps/web/src/app/api/webhooks/evolution/route.ts`, `apps/web/src/app/api/health/route.ts` | Secret check + Zod normalize + persist/enqueue only. No LLM/media/outbound. |
| Application / services | `worker/src/features/registration/**`, `worker/src/jobs/**`, `packages/shared/src/registration/**` | State machine, confirmation, vision orchestration, job handlers |
| Infrastructure / repositories | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**`, `supabase/migrations/**`, `infra/evolution/**` | Supabase, Evolution, storage, LLM vision adapter |
| Contracts / schemas | `packages/shared/src/contracts/**` | Webhook, session, citizen, animal, vision traits, outbound, jobs; `database.types.ts` |

Deliberate deviation: `complete_animal_registration` and `claim_next_job` are SQL functions (transaction / SKIP LOCKED boundary).

## 3. Data & control flow

```text
Citizen (WhatsApp) → Evolution API → POST /api/webhooks/evolution
  → verify webhook secret (401/503 fail closed)
  → normalizeEvolutionPayload (Zod evolutionWebhookSchema)
  → persist messages idempotent (line_id, external_id)
  → enqueue jobs.process_inbound
  ← 200 OK

Worker → claim_next_job (FOR UPDATE SKIP LOCKED) / in-memory claim in tests
  → process_inbound: load/create registration_sessions, apply shared transitions
      → enqueue send_outbound / download_media
      → on complete: upsert citizen, complete_animal_registration, analyze_traits, confirmation
  → download_media: Evolution fetch → private bucket animal-media
  → send_outbound: send-mode guard (dry_run|allowlist|production) → Evolution or simulate
  → analyze_traits: VisionClient + visionTraitsSchema → traits_status ready|pending_manual
```

## 4. API routes

| Method | Path | Auth | Request schema | Response | Service |
|---|---|---|---|---|---|
| GET | `/api/health` | none | — | `{ ok, service, feature }` | liveness |
| POST | `/api/webhooks/evolution` | `x-webhook-secret` (or Bearer) vs `WEBHOOK_SECRET` | raw Evolution → `evolutionWebhookSchema` | 200 / 401 / 400 / 404 / 503 | `ingestInboundEvent` |

## 5. Data schemas & models

### 5.1 Contracts (Zod)

- `evolutionWebhookSchema` — text | image | location | button_reply | unknown
- `registrationSessionSchema` / `sessionPayloadSchema`
- `citizenUpsertSchema`, `animalDraftSchema` (species: dog|cat|other)
- `visionTraitsSchema` — summary, colors, markings, notableFeatures
- `outboundTextSchema`, `jobPayloadSchema` (`process_inbound`, `download_media`, `send_outbound`, `analyze_traits`)

### 5.2 Persistence

Tables: `organizations`, `org_settings`, `whatsapp_lines`, `whatsapp_line_secrets`, `citizens`, `citizen_phones`, `animals`, `animal_photos`, `neighborhood_codes`, `animal_id_counters`, `registration_sessions`, `messages`, `jobs`. Seed org `epuyen`, line display phone `+5492944216586`, codes `CENT`/`EPU`.

## 6. AI / LLM boundaries

- Interface: `VisionClient.analyzeAnimalPhotos` in `worker/src/infrastructure/llm/vision-client.ts`
- Default adapter: OpenAI-compatible Chat Completions (`LLM_VISION_*` env)
- Output: `visionTraitsSchema`; invalid/error → retry once → `traits_status = pending_manual`
- Registration confirmation does **not** wait on vision success

## 7. Error handling

- Webhook fails closed: missing secret → 503; mismatch → 401; unknown instance → 404
- Groups/broadcasts ignored with 200
- Worker retries with backoff up to `max_attempts`; errors redacted (phone/DNI) via `redactForLogs`
- Species check and municipal ID uniqueness enforced in SQL

## 8. Non-goals / out of scope

Operator panel, triage/RAG mesa bot, horse/livestock plantels, human approval, PDF/QR certificates, Meta Cloud API, full foundation auth.

## 9. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-12 | Inspectoria pet registry WhatsApp MVP (webhook, worker, SQL, vision) | `inspectoria-pet-registry-bot` |
