## Why

WhatsApp channel core now persists conversations and a minimal composer, but operators still lack a real triage queue: claim, soft-handoff delegation, events, realtime, filters, SLA, and inquiry map. Without this, Mesa de Entrada cannot be the derivation hub on the shared line.

Roadmap: **Phase 3 — Panel de mensajería** · Requirements: **INB-01..INB-15**, **FND-06** (area-level RLS on conversations/messages), dual inquiry coords + map (reconcile follow-up).

## What Changes

- SQL transition functions: claim, delegate (user/area), accept/reject, ensure_owner_for_reply, move, resolve, reopen, set_conversation_area (manual routing).
- `conversation_events` timeline; bot_state paused on claim; CLAIM_CONFLICT on races.
- Inbox UI: FIFO unowned-first queue, kanban/columns, thread with delivery ticks, filters, read/unread, quick replies, badges/optional sound, realtime.
- Area SLA: compute warning/critical using area minutes + org business hours (INB-15).
- Inquiry location: store/read message (or conversation) inquiry coords separately from pet GPS; map on card.
- RLS: `current_area_ids()` on conversations/messages (admin sees all org).
- Shared-line routing: operators/admins manually set area; document pet `process_inbound` coexistence (optional gate: only enqueue pet when area is Inspectoría or session exists — product default: keep pet enqueue until explicit gate task).
- Root docs update.

## Capabilities

### New Capabilities
- `triage-queue`: INB-01, INB-10, INB-11 — ordered queue, card flags, filters
- `conversation-ownership`: INB-02..05 — claim, auto-claim on reply, delegate, accept/reject
- `conversation-lifecycle`: INB-06..08 — columns, resolve, reopen, events
- `inbox-realtime`: INB-09, INB-14 — live updates, badges/sound
- `inbox-read-state`: INB-12
- `quick-replies`: INB-13
- `area-sla`: INB-15
- `inquiry-map`: dual coords + map on card

### Modified Capabilities
- `org-tenancy`: area-scoped RLS for conversations/messages via `current_area_ids()`
- `whatsapp-outbound`: ensure_owner_for_reply before send; delivery ticks in thread UI

## Impact

- Migrations + RPCs under `supabase/`
- Panel inbox rewrite; Realtime subscriptions
- Worker/webhook reopen path for resolved conversations
- Follow-up: Phase 4 pobladores full; Phase 5 tasks; optional pet enqueue gate

## Deferred

- LLM classification / auto area suggestion (Phase 6)
- WA-08 multimedia composer
- Full citizen CRUD (POB beyond card flags)
