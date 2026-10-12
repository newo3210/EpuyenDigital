## Why

Inspectoría needs a WhatsApp channel where neighbors register household pets (dog, cat, other) with identity, GPS, and photos of distinctive traits. The municipality already has line `+5492944216586` but no guided flow or geolocated animal registry. Mesa de Entrada Digital is planned but not implemented; Inspectoría needs a **standalone vertical MVP** that can later integrate into that platform.

Roadmap: **Phase 2.1 INSERTED — Inspectoría pet registry MVP** · Requirements: **INSP-PET-01 … INSP-PET-08** (new IDs; see `.planning/REQUIREMENTS.md` update in this change).

## What Changes

- Standalone MVP stack (thin slice of the future monorepo): Next.js webhook app, Node worker, Supabase schema focused on pet registration, Evolution API compose for one WhatsApp line.
- Guided WhatsApp conversation: privacy consent → citizen data + native location share → animal data → freeform photos → automatic registration + confirmation message with municipal animal ID.
- Returning citizens greeted by name when the inbound phone is already registered.
- Animal catalog limited to dog / cat / other (horse and livestock plantels out of scope; schema leaves an extension hook).
- Photo storage + vision extraction of distinctive traits (Zod-validated); vision failure does not block registration.
- Municipal animal ID `{BARRIO3}-{YYYY}-{SEQ5}` (fallback barrio `EPU`).
- No operator web panel, no human approval gate, no PDF/QR in this MVP.
- Root docs `ARCHITECTURE_SDD.md` and `STUDENT_DECISION_LOG.md` updated for this slice.

## Capabilities

### New Capabilities
- `inspectoria-whatsapp-channel`: Evolution webhook ingest/outbound for the Inspectoría line, send-mode guard, media download to private storage, location message capture.
- `pet-registration-conversation`: stateful guided flow (consent → citizen → animal → photos → confirm) with interactive buttons and resume/TTL.
- `animal-registry`: persistence of citizens, animals, photos, geo, vision traits, and municipal ID generation.

### Modified Capabilities
- None (no archived main specs for this domain yet).

## Impact

- New code: `apps/web` (webhook + health only), `worker/`, `packages/shared`, `supabase/`, `infra/evolution/`.
- New domain tables: `citizens`, `citizen_phones`, `animals`, `animal_photos`, `registration_sessions`, `whatsapp_lines` (+ secrets), `jobs`, minimal `organizations`.
- Dependencies: Next.js 15, Zod, Supabase, Evolution API v2, LLM vision provider (env-selected; default OpenAI-compatible vision via adapter).
- Planning: insert Phase 2.1 and INSP-PET requirements into `.planning/`.
- Later integration: map citizens/phones/conversations into Mesa de Entrada; keep `animals` as area-specific extension under Inspectoría.
