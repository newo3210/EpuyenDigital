# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-10-12
**Related OpenSpec change:** `inspectoria-pet-registry-ux-v2`

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. The Inspectoría vertical registers pets on WhatsApp line `+5492944216586` via Evolution API.

**UX v2** guided chat (no privacy consent step, no barrio question): welcome → citizen name/DNI/address → optional location help (static image) → optional GPS (`No puedo ahora` skips) → animal fields (rabies may be `unknown`) → optional health-card photo (`No` skips) → ≥1 animal photo then Listo/text → confirmation with animal name, citizen full name, and municipal ID always `EPU-{YYYY}-{SEQ5}`.

Vision traits still run asynchronously after activation.

Status: **MVP + UX v2** under `apps/web`, `worker/`, `packages/shared`, `supabase/`, `infra/evolution/`.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `apps/web/src/app/api/webhooks/evolution/route.ts`, `apps/web/src/app/api/health/route.ts` | Secret check + Zod normalize + persist/enqueue only. No LLM/media/outbound. |
| Application / services | `worker/src/features/registration/**`, `worker/src/jobs/**`, `packages/shared/src/registration/**` | State machine, confirmation, vision orchestration, job handlers |
| Infrastructure / repositories | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**`, `supabase/migrations/**`, `infra/evolution/**`, `worker/assets/inspectoria/` | Supabase, Evolution (text + image), storage, LLM vision, static help PNG |
| Contracts / schemas | `packages/shared/src/contracts/**` | Webhook, session, citizen (nullable GPS/consent), animal (`rabies unknown`), jobs (`mediaPath`) |

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
      → enqueue send_outbound (text and/or mediaPath help image)
      → enqueue download_media for inbound images
      → on complete: upsert citizen (lat/lng/consent may be null), finalizeRegistrationCompletion
         (p_neighborhood forced null → EPU id), analyze_traits, confirmation with citizen name
  → download_media: Evolution fetch → private bucket animal-media
  → send_outbound: send-mode guard → Evolution text/buttons or sendImage, or dry_run simulate
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
- `registrationSessionSchema` / `sessionPayloadSchema` — steps include `welcome`, `location_help_offer`, `location_help` (no `consent` / `neighborhood`)
- `citizenUpsertSchema` — neighborhood, lat/lng, `privacyConsentAt` optional/nullable
- `animalDraftSchema` — `rabiesStatus`: `up_to_date` | `pending` | `unknown`
- `jobPayloadSchema` — `send_outbound` may include `mediaPath`
- Env: `LOCATION_HELP_IMAGE_PATH` optional override for help PNG

### 5.2 Persistence

Tables unchanged structurally; migration `20261012120000_rabies_status_unknown.sql` widens `animals.rabies_status` check. Seed org `epuyen`, line `+5492944216586`. Municipal ID generation still supports barrio codes in SQL, but worker always passes `p_neighborhood = null` in this slice → `EPU`.

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

Operator panel, triage/RAG mesa bot, horse/livestock plantels, human approval, PDF/QR certificates, Meta Cloud API, Ley 25.326 consent UI (deferred), barrio-indexed municipal IDs (deferred).

## 9. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-12 | Inspectoria pet registry WhatsApp MVP (webhook, worker, SQL, vision) | `inspectoria-pet-registry-bot` |
| 2026-10-12 | UX v2: no consent/barrio, optional GPS + help image, rabies unknown, EPU id, confirmation with citizen name | `inspectoria-pet-registry-ux-v2` |
