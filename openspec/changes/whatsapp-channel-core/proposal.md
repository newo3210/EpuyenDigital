## Why

Phase 3 inbox needs a reliable WhatsApp channel: configured lines, idempotent inbound (text + media), conversation threads, and guarded outbound. The pet vertical only ships a partial webhook/`messages` log. Building the channel now (before full triage UI) unlocks `mesa-entrada-inbox` without coupling Evolution admin work into the queue epic.

Roadmap: **Phase 2 — Canal WhatsApp** · Requirements: **WA-01..WA-12** (delivery **ticks UI** deferred to inbox; statuses **persisted** here).

## What Changes

- Extend `whatsapp_lines` / secrets for Evolution base URL, encrypted API key + webhook secret, `default_area_id`, connection status.
- Admin UI: Configuración → Líneas WhatsApp (CRUD fields + “Probar conexión”).
- Introduce `conversations` (one per org/line/phone) and attach/extend `messages` with `conversation_id`, media storage, delivery status, `fromMe` outbound.
- Webhook + worker: reject missing secret; idempotent inbound; `@lid` resolution; pushName/avatar; media download jobs; ignore groups/broadcasts/newsletters.
- Outbound text path with `send_mode` (`dry_run` / `allowlist` / `production`) and a **minimal panel composer**.
- Persist delivered/read updates from Evolution when present.
- Phone normalization to Argentine `549…` on store and send.
- Seed: line `default_area_id` → Mesa de Entrada; keep Inspectoría pet flow working.
- Root docs: `ARCHITECTURE_SDD.md` (EN), `STUDENT_DECISION_LOG.md` (ES).

## Capabilities

### New Capabilities
- `whatsapp-line-admin`: admin configures Evolution lines, encrypted secrets, default area, connection test/status.
- `whatsapp-inbound`: secure webhook, idempotent persist, conversations upsert, media, `@lid`, pushName/avatar, `fromMe` as outbound.
- `whatsapp-outbound`: send_mode guard, text send via Evolution, message rows, delivery status persistence; minimal composer UI.

### Modified Capabilities
- `local-dev-environment`: document new env vars / seed expectations for line secrets and default area (if needed).

## Impact

- DB migrations under `supabase/migrations/`; Storage bucket for inbound media (may extend existing).
- `apps/web`: settings lines UI, composer, webhook normalize enhancements, features for lines/outbound.
- `worker`: media download + outbound send jobs aligned with conversations.
- `packages/shared`: phone/send_mode/contracts as needed.
- Follow-up change: `mesa-entrada-inbox` (INB-01..15, dual coords/map, manual area routing, delivery ticks UI).

## Deferred (recorded)

| Topic | Decision |
|---|---|
| Inbox epic | After this change; full INB-01..15 |
| Dual coords + map | Inbox |
| Shared-line routing | Manual `area_id` in inbox |
| Delivery ticks in thread UI | Inbox (persist now) |
