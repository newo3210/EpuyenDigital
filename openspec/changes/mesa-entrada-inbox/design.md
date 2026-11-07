## Context

- Channel core on `main`: conversations, messages, composer, send_mode, line admin, shared WA line default Mesa.
- Missing: triage RPCs, events, realtime, filters, read state, quick replies, SLA engine, inquiry map UI, area RLS.
- Confirmed scope: full INB-01..15 + dual coords/map + manual area routing.

## Goals / Non-Goals

**Goals:** Ship operator triage hub for Mesa; harden area RLS; inquiry map without touching pet GPS.

**Non-Goals:** LLM auto-routing; full POB CRUD; tasks/notes; WA media outbound; second phone line.

## Decisions

### D1 — SQL transitions as source of truth
Port claim/delegate/accept/reject/move/resolve/reopen/ensure_owner/set_area from seguros patterns with FOR UPDATE + expected state + event row; typed errors (`CLAIM_CONFLICT`, etc.).

### D2 — Realtime via Supabase
Subscribe to conversations/messages/events for org/area; badge from same channel.

### D3 — Dual coords
Inquiry coords on messages (already) and optional `conversations.inquiry_latitude/longitude` denormalized from latest location message for card map. Never write `citizens.lat/lng`.

### D4 — Manual routing
`set_conversation_area` RPC + UI; shared line keeps pet `process_inbound` unless a follow-up gate is added (document; optional task to skip pet enqueue when area ≠ Inspectoría and no open registration session).

### D5 — SLA
Use `org_settings.business_hours` + holidays; if empty, fall back to calendar elapsed minutes with documented default.

### D6 — Quick replies
Table `quick_replies` + seed few municipal templates; admin CRUD minimal or seed-only if time-boxed — prefer simple admin list under settings.

## Clean Architecture

| Layer | Paths |
|---|---|
| Presentation | `apps/web/src/app/(panel)/inbox/**`, presentation inbox components, map |
| Application | `features/inbox/**`, `features/conversations/**` transitions |
| Infrastructure | Supabase RPC repos, realtime client |
| Contracts | Zod for filters, delegate payloads, events |

## Risks

| Risk | Mitigation |
|---|---|
| Large surface INB-01..15 | Task slices; TDD per RPC; adversarial expected |
| Pet + Mesa on one line | Document; optional enqueue gate task |
| Realtime complexity | Start with postgres_changes; fallback poll only if blocked |
| No Docker | Honest gaps again |

## Follow-ups

Phase 4 pobladores; Phase 5 tasks; Phase 6 bot RAG; pet enqueue gate if product confirms.
