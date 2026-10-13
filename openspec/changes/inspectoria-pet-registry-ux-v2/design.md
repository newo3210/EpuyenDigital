## Context

Archived MVP `inspectoria-pet-registry-bot` shipped a consent → barrio → required GPS → photo listo/otra flow. Product script v2 simplifies citizen UX and makes GPS optional with an in-chat help image.

## Goals / Non-Goals

**Goals:**
- Match product copy and options exactly (es-AR).
- Optional location with help image + skip.
- Multi-photo then finish with Listo/text.
- Municipal ID always `EPU-{YYYY}-{SEQ5}` until barrio index exists.
- No privacy consent step for now.

**Non-Goals:**
- Restoring Ley 25.326 consent UI.
- Reverse-geocoding barrio from GPS.
- Changing Evolution/webhook architecture.

## Layer mapping

| Layer | Paths |
|---|---|
| Presentation | unchanged webhook |
| Application | `packages/shared/src/registration/**`, `packages/shared/src/i18n/es-AR/registration.ts`, `worker/src/jobs/process-inbound.ts`, `worker/src/jobs/send-outbound.ts` (image outbound) |
| Infrastructure | static asset `worker/assets/inspectoria/location-help.png` (placeholder OK until real art), Evolution send image |
| Contracts | `RabiesStatus` includes `unknown`; session steps rename/remove consent/neighborhood |

## Decisions

### D1 — No consent step
`privacy_consent_at` may remain null. Document as temporary product decision; restore later without schema break (nullable column already).

### D2 — No neighborhood step; ID always EPU
`complete_animal_registration` / formatter: when neighborhood null/empty, code `EPU` (already fallback). Stop asking barrio; do not map free text.

### D3 — Location subflow
Steps: `location_help_offer` → (`location_help` send text+image) → `location` (pin | `No puedo ahora` → continue without coords).

### D4 — Help image
Ship placeholder PNG in repo; env `LOCATION_HELP_IMAGE_PATH` overrides. Worker `send_outbound` gains optional `mediaPath` / image send through Evolution (dry_run simulates).

### D5 — Photos finish rule (option A)
In `animal_photos`: each image increments count and acks; `Listo`/`OK`/`listo`/any non-empty non-image text after ≥1 photo → complete. Empty/invalid without photos → re-prompt.

### D6 — Rabies `unknown`
Enum/check: `up_to_date` | `pending` | `unknown`. SQL migration to widen check if needed.

### D7 — Confirmation copy
Single outbound (or thanks then confirm): include `animalName`, `citizenFullName`, `municipalId`.

## Contracts

- Update `vision`/animal draft rabies enum.
- Session steps list without `consent`, `neighborhood`; add `location_help_offer`, `location_help`.

## Risks

- Skipping consent is a compliance gap — accepted temporarily by product.
- Null geo reduces map usefulness until location is re-required.
- Placeholder help image must be replaced with official artwork before production.
