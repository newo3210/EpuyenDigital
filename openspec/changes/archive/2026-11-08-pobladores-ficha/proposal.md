## Why

Every new WhatsApp number already becomes an unregistered citizen stub (phone, pushName, avatar). Operators still cannot complete that record, search it, or join two numbers that belong to the same neighbor. The queue flag "registrado / no registrado" has nothing an operator can change. Phase 4 is the ficha that grows from the chat.

Roadmap: **Phase 4 — Pobladores** · Requirements: **POB-01..POB-09**.

## What Changes

- Operator ficha from the thread and from `/citizens`: name, DNI (`document_id`), address, neighborhood, email, tags, observations, home coordinates, and person vs organization.
- `field_sources` so a value an operator typed is not overwritten by the pet bot or by a later WhatsApp profile capture.
- `register_citizen` when a person has name + DNI + phone, or an organization has name + phone. The queue flag reads `registration_status`.
- Search by name, DNI, or phone inside the organization.
- Explicit merge of two citizens: phones, conversations, and animals move to the kept row; the dropped row stays with `merged_into_id`.
- Timeline on the ficha: messages, conversation events, and animal registrations. Notes and tasks stay out until Phase 5.

## Capabilities

### New Capabilities

- `citizen-profile`: ficha fields, manual-source protection, register, missing-data list, party kind, timeline, thread entry.
- `citizen-search`: org-scoped search by name, DNI, or phone, hiding merged rows.
- `citizen-merge`: explicit merge that keeps history and does not delete the dropped row.

### Modified Capabilities

- `whatsapp-inbound`: the first-contact stub still creates an unregistered citizen, and it SHALL NOT overwrite a profile field whose source is `manual`.

## Impact

- New migration after `20261107120000_mesa_entrada_inbox.sql`: profile columns, `field_sources`, `merged_into_id`, definer functions, a guard trigger, search index.
- Pet registry writes in `worker/src/infrastructure/supabase-store.ts` keep working for empty fields and stop replacing manual ones.
- `apps/web`: replace the `/citizens` placeholder, add `/citizens/[id]`, and link the open thread to the same ficha.
- Root docs in the same change: `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`, `docs/data-model.md`.
- Live `supabase test db` stays an honest gap when Docker is absent. pgTAP is still added.

## Deferred (recorded)

- The bot asking for missing fields and confirming a DNI before save (Phase 6, BOT).
- Notes and tasks on the timeline (Phase 5). This change does not create those tables.
- Automatic duplicate detection. The operator chooses both records.
- Panel media send (WA-08) and the send_mode chooser (WA-11).
