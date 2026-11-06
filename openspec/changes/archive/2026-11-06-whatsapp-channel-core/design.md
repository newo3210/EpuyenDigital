## Context

- Pet vertical already: Evolution webhook (secret header), `messages`, `jobs`, media download job, `org_settings.send_mode`, phone normalize helpers, Inspectoría line seed.
- Missing: `conversations`, line admin UI, encrypted API key storage as designed, `@lid` / `fromMe` completeness, operator composer, delivery ACK persistence, `default_area_id` wired to Mesa.
- Next epic `mesa-entrada-inbox` consumes conversations + messages for triage (INB-01..15, dual coords UI, manual area routing).

## Goals / Non-Goals

**Goals:**

- Ship WA-01..12 channel core so inbox can focus on queue UX.
- Conversations as the thread backbone; keep pet registration working on the same line.
- Admin line configuration with secrets never echoed.
- Minimal composer + send_mode enforcement.

**Non-Goals:**

- Claim/delegate/realtime/SLA/filters/quick replies (inbox).
- Inquiry map UI (inbox); only store location on messages here.
- Full poblador CRUD (Phase 4).
- Meta Cloud API provider.
- Adversarial close of `inspectoria-pet-registry-ux-v2`.

## Decisions

### D1 — Conversations now, triage later

Create `conversations` with columns needed by inbox (`area_id`, `queue_column`, `bot_state`, owner/delegation fields nullable/defaults) so inbound can upsert threads. Do **not** implement claim RPCs in this change beyond schema defaults (`queue_column = new`, `bot_state = active` unless product requires handoff hooks for pets — pets may keep session machine; conversation row still created for visibility).

### D2 — Evolve messages table forward-only

Add `conversation_id`, strengthen kinds/status; migrate existing pet messages where possible (backfill conversation by phone/line) or leave historical rows with nullable conversation_id only if backfill is unsafe — prefer backfill via SQL for same `(line_id, phone_normalized)`.

### D3 — Secrets

Store API key + webhook secret ciphertext in `whatsapp_line_secrets`; server-only decrypt for Evolution client and webhook compare. Prefer pgcrypto or app-level encryption with key from env (`LINE_SECRETS_KEY`); document choice in implementation report. Webhook continues to compare using stored secret.

### D4 — Shared line default area = Mesa de Entrada

Product: same phone for Mesa + Inspectoría. Line `default_area_id` → Mesa; pet flow does not require changing area automatically (inbox will allow manual redistribute).

### D5 — Dual coords

Message location → message lat/lng only. Never write inquiry pins into `citizens.latitude/longitude` (pet GPS).

### D6 — Composer placement

Minimal thread view under panel (e.g. `/inbox/[conversationId]` or settings-adjacent debug/thread route). Prefer extending `/inbox` placeholder with a simple list + thread + composer rather than a throwaway page — still **without** claim/delegate UI.

### D7 — Port from seguros

Use `docs/reuse-from-seguros.md` § webhook normalize, secret match (reject if missing), outbound router, send_mode guard — apply listed corrections (media inbound, `@lid`, fromMe).

### D8 — Pet coexistence

`process-inbound` pet state machine remains; channel layer persists conversation/message before or beside pet handling without double-sending. Idempotency key remains `(line_id, external_id)`.

## Clean Architecture mapping

| Layer | Responsibility | Concrete paths |
|---|---|---|
| Presentation | Line admin pages, minimal inbox list/thread/composer | `apps/web/src/app/(panel)/settings/lines/**`, `(panel)/inbox/**`, `presentation/whatsapp/**` |
| Application | Configure line, test connection, send text, ingest webhook use-cases | `apps/web/src/features/whatsapp-lines/**`, `features/conversations/**`, `features/outbound/**`; `worker/src/jobs/**` |
| Infrastructure | Evolution client, secret crypto, inbound store, storage | `apps/web/src/infrastructure/**`, `worker/src/infrastructure/**` |
| Contracts | Zod webhook, line admin, send text, delivery ACK | `apps/web/src/contracts/**`, `packages/shared/**` |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Breaking pet webhook | Contract tests + dry_run smoke; keep thin route |
| Secret key management in local/prod | Env documented; refuse plaintext logs |
| Large change | Tasks grouped; no INB claim scope creep |
| Composer without claim confuses operators | Copy: “Canal / hilo” empty-state notes; inbox epic adds ownership |
| No Docker in agent env | Honest gaps; Vitest + static SQL |

## Rollback

- Forward-only migrations; feature branch until verify + adversarial + human OK.
- Disable composer route via role/flag if needed; webhook can stay.

## Follow-ups

1. `mesa-entrada-inbox` — INB-01..15, dual coords map UI, manual area routing, delivery ticks.
2. Optional second WhatsApp number / split lines.
3. WA connection webhook auto-status beyond manual test.
