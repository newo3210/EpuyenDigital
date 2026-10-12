## Context

Mesa de Entrada Digital is planned (Phases 1–7) but **not implemented** (`apps/`, `worker/`, `supabase/` absent). Inspectoría has WhatsApp line `+5492944216586` without Evolution wiring. Product decision: ship a **standalone vertical MVP** for pet registration that later integrates into the panel (citizens + Inspectoría area).

Standards: `docs/base-standards.md` (§9 layers, §12 local env), `docs/backend-standards.md` (webhook thin, worker jobs, Evolution, Zod LLM boundaries), `docs/data-model.md` (reuse naming for `citizens` / phones where practical).

Enriched US: `tmp/inspectoria-pet-registry-bot-enriched-us.md`.

## Goals / Non-Goals

**Goals:**
- End-to-end WhatsApp registration: consent → citizen (+ GPS) → animal → photos → auto-active record + confirmation with municipal ID.
- Geolocated citizen + animal registry with vision traits.
- Minimal monorepo scaffold reusable by later Mesa de Entrada changes.
- Local Evolution on Podman + send-mode guard; line number configured for `+5492944216586`.

**Non-Goals:**
- Operator web panel, triage queue, RAG mesa bot, areas UI.
- Horse / livestock plantels.
- Human approval, PDF/QR certificates, duplicate-animal matching.
- Meta Cloud API.
- Full foundation auth/panel from `foundation-workspace-auth` (not a dependency of this MVP).

## Layer mapping (base-standards §9)

| Conceptual layer | Paths in this change |
|---|---|
| Presentation / HTTP thin | `apps/web/src/app/api/webhooks/evolution/route.ts`, `apps/web/src/app/api/health/route.ts` |
| Application / services | `worker/src/features/registration/**` (state machine, steps, confirmation), `worker/src/features/vision/**`, `worker/src/jobs/**`, `packages/shared/src/registration/**` (pure step transitions, ID formatting, phone normalize, i18n message keys) |
| Infrastructure / repositories | `worker/src/infrastructure/{supabase,evolution,llm,storage}/**`, `apps/web/src/infrastructure/**` (webhook secret check, enqueue), `supabase/migrations/**`, `infra/evolution/**` |
| Contracts | `packages/shared/src/contracts/{evolution-webhook,registration-session,citizen,animal,vision-traits,outbound}.ts` |

Webhook: Zod parse → secret verify → persist inbound → enqueue job → 200. No LLM/media/outbound in the route. Worker owns conversation logic and vision.

## Decisions

### D1 — Standalone MVP inside future monorepo layout
Create `apps/web`, `worker/`, `packages/shared`, `supabase/`, `infra/evolution` now, but **only** routes/services needed for this flow. No panel UI. Later Mesa changes expand the same folders.
*Alternative:* separate repo — rejected; integration cost higher.

### D2 — Minimal org tenancy without operator auth
Single seeded organization `epuyen`. Service-role worker/webhook access for writes. RLS enabled with service-role bypass for automation; optional read policies deferred until panel integration. SQL tests still prove unique constraints and ID sequence correctness.
*Alternative:* full `foundation-workspace-auth` first — rejected by product (vertical-only MVP).

### D3 — Evolution API v2 for the Inspectoría line
`infra/evolution/docker-compose.yml` on Podman; env `INSPECTORIA_DISPLAY_PHONE=+5492944216586`. Admin links the QR once. Webhook URL `http://host.containers.internal:3000/api/webhooks/evolution`.
*Alternative:* Meta Cloud API — out of project v1 strategy.

### D4 — Registration session state machine (DB-backed)
Table `registration_sessions` with `phone_normalized`, `line_id`, `step`, `payload jsonb`, `expires_at`, `lock_version`. Pure transition helpers in `packages/shared` (input → next step / effects).

**Concurrency (PostgREST reality):** a JS `FOR UPDATE` RPC cannot hold a lock across later JS calls. Therefore:
- Session writes go through `upsert_registration_session` (advisory xact lock + row `FOR UPDATE` in one SQL transaction).
- Completion goes through `finalize_registration_completion` (session `FOR UPDATE` + animal insert + photo links + mark `done` in one SQL transaction).
- Memory store uses a per-phone async mutex for Vitest.
- Crash resume: step `completing` without `completedAnimalId` re-triggers finalize (state machine).
Steps (new citizen): `consent` → `full_name` → `document_id` → `address_line` → `neighborhood` → `location` → `animal_name` → `species` → `sex` → `breed_color` → `size` → `age_stage` → `sterilized` → `rabies_status` → `health_card_photo_optional` → `animal_photos` → `completing` → `done`.
Returning citizen: `returning_menu` → (optional `confirm_citizen`) → animal steps…

TTL default 24h (`REGISTRATION_SESSION_TTL_HOURS`).

### D5 — Interactive buttons via Evolution
Use Evolution interactive buttons / list messages when available; fallback to numbered text menu (`1 Perro`, `2 Gato`, `3 Otro`) parsed by shared helpers so local dry tests work without button support.

### D6 — Municipal ID format
`{BARRIO3}-{YYYY}-{SEQ5}`:
- `BARRIO3`: lookup table `neighborhood_codes(org_id, neighborhood_normalized, code)`; else `EPU`.
- `YYYY`: `America/Argentina/Buenos_Aires`.
- `SEQ5`: from `animal_id_counters(org_id, year)` incremented in the same transaction as animal insert (`FOR UPDATE`).
Species is **not** embedded in the ID (stored on row); avoids collisions with barrio codes. Example: `CENT-2026-00482`.

### D7 — Vision provider adapter
Interface `VisionClient.analyzeAnimalPhotos(images): Promise<VisionTraits>`. Default implementation: OpenAI-compatible Chat Completions with image URLs/base64 (`LLM_VISION_PROVIDER=openai`, model env `LLM_VISION_MODEL`, default `gpt-4o-mini`). Zod schema `visionTraitsSchema` — on parse failure retry once; then `traits_status = pending_manual`. Registration completion does **not** wait on blocking UX beyond the worker job; confirmation can say traits are being processed if still pending, or include short summary when ready (worker may send a follow-up short message only if traits arrive after first confirmation — **MVP: single confirmation**; traits filled async without second message if not ready).

### D8 — Geospatial storage
Store `latitude numeric(9,6)`, `longitude numeric(9,6)` on `citizens` (and copy onto `animals` at registration time for historical accuracy). Add PostGIS **only if** local Supabase image includes it easily; otherwise numeric columns + index is enough for MVP maps later. Decision in spike task: prefer `extensions: postgis` when available; fallback numerics.

### D9 — Privacy notice copy
Centralize es-AR strings in `packages/shared/src/i18n/es-AR/registration.ts`. Consent requires explicit accept keywords / button `Acepto`. Store `privacy_consent_at` and notice version string `privacy_notice_version`.

### D10 — Send mode
Org setting `send_mode`: default `dry_run` locally; `allowlist` for real tests including `5492944216586` and team phones; `production` only when explicitly set.

### D11 — Schema (core tables)
- `organizations`, `org_settings` (send_mode, allowlist, ttl, privacy_notice_version)
- `whatsapp_lines`, `whatsapp_line_secrets` (service role only)
- `citizens` (document_id, full_name, address_line, neighborhood, lat/lng, privacy_consent_at, …)
- `citizen_phones` unique `(org_id, phone_normalized)`
- `animals` (citizen_id, species check in dog/cat/other, sex, breed_color, size, age_stage, sterilized, rabies_status, microchip, municipal_id unique, distinctive_traits jsonb, traits_status, location snapshot, status active)
- `animal_photos` (animal_id, kind animal|health_card, storage_path, …)
- `neighborhood_codes`
- `animal_id_counters`
- `registration_sessions`
- `messages` (minimal inbound/outbound log)
- `jobs`
- Storage bucket `animal-media` private

SQL function `complete_animal_registration(...)` assigns ID + inserts animal + increments counter atomically.

### D12 — Section comments
All new hand-written TS/TSX use `// <Block> - <what it does>` section comments.

## Contracts (Zod)

- `evolutionWebhookSchema` — normalized inbound (text | image | location | button_reply | unknown)
- `registrationSessionSchema` — step + payload partials
- `citizenUpsertSchema` — full_name, document_id, address_line, neighborhood, lat, lng, privacy_consent_at
- `animalDraftSchema` — name, species enum, sex, breed_color, size, age_stage, sterilized, rabies_status, microchip optional
- `visionTraitsSchema` — `{ summary: string, colors: string[], markings: string[], notableFeatures: string[] }`
- `outboundTextSchema` — phone, text, lineId
- `jobPayloadSchema` per job type: `process_inbound`, `download_media`, `analyze_traits`, `send_outbound`

## Risks / Trade-offs

- **No Evolution linked yet** — local QR pairing required; until then tests use fixtures + dry_run.
- **Standalone schema may diverge** from future Mesa `citizens` — mitigate by aligning column names with `docs/data-model.md` now.
- **Vision cost/latency** — async job; failure must not block ID issuance.
- **WhatsApp button support variance in Evolution/Baileys** — numbered fallback mandatory.
- **Skipping full operator auth** — DB is service-role heavy until integration; acceptable for single-org MVP with private network/local.
- **foundation-workspace-auth overlap** — this change scaffolds monorepo pieces; when foundation applies later, merge carefully (prefer one scaffold owner — document in STUDENT_DECISION_LOG).

## Migration / rollback

- Forward-only SQL migrations. Rollback = disable Evolution webhook + stop worker; data retained.
- Feature flag env `PET_REGISTRY_BOT_ENABLED=true` to no-op job handlers quickly.
