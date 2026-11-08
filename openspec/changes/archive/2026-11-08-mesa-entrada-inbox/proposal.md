## Why

Channel core already stores conversations, messages, and delivery status, but operators still see a flat list with no owner. Neighbors can wait with nobody accountable. Phase 3 turns that list into the triage queue: unowned-first FIFO, claim and delegation with acceptance, reopen, realtime, and the area-scoped access the data model already reserved.

Roadmap: **Phase 3 — Panel de mensajería** · Requirements: **INB-01..INB-15**. Also closes the channel follow-ups that were explicitly deferred here: delivery ticks in the thread, rich inbound media in the thread (WA-05 UI), inquiry-vs-home coordinates on a map, and manual area routing.

## What Changes

- Atomic conversation transitions in Postgres: claim, ensure-owner-on-reply, delegate (user or area), accept, reject, move column, resolve, reopen, set area. Each writes an append-only `conversation_events` row in the same transaction.
- Area-scoped read access for conversations and messages (`current_area_ids()`, owner, delegator, pending area). Admin and support read the org. Support cannot mutate. No authenticated INSERT/UPDATE policies on conversations, messages, or events.
- Queue UI: unowned FIFO, card flags, filters, per-operator read state, nav badge, optional sound.
- SLA clock in business hours from `last_inbound_at` using existing area minute thresholds plus org business hours and holidays.
- Thread: media render, delivery ticks, inquiry pins vs citizen home/pet coordinates, quick replies, realtime updates without a full browser reload.
- Inbound to a resolved thread reopens it. The pet `process_inbound` enqueue on the shared line stays as it is.

## Capabilities

### New Capabilities

- `inbox-queue`: sorted queue, card flags, filters, read/unread, SLA badges, nav badge and optional sound.
- `conversation-ownership`: claim, reply-claim, delegate, accept/reject, column moves, resolve, reopen, manual area change, event timeline, area RLS.
- `inbox-thread`: media and location rendering, delivery ticks, quick replies, realtime thread and queue updates.

### Modified Capabilities

- `municipal-areas`: SLA minute columns gain a business-hours clock (`sla_due_at` and ok/warning/critical). The "store only, do not compute" rule ends.
- `whatsapp-outbound`: composer text send goes through ensure-owner-on-reply; delivery ticks are shown in the thread.
- `whatsapp-inbound`: a citizen message on a resolved conversation reopens the queue row. Pet job enqueue is unchanged.

## Impact

- New migration after `20261107010000_whatsapp_channel_core.sql`: events, reads, quick replies, preview columns, business hours, SQL functions, RLS, realtime publication.
- `packages/shared`: business-minutes algorithm and queue sort contract covered by the same fixtures as SQL.
- `apps/web`: replace the minimal `/inbox` list and thread with triage UI; composer calls the ownership RPC before send.
- `apps/web` inbound store: call `reopen_conversation` when the existing row is `resolved`.
- Root docs updated in the same change: `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`.
- Live `supabase test db` remains blocked when the agent has no Docker; pgTAP file is still added and the gap is recorded honestly.

## Deferred (recorded)

| Topic | Decision |
|---|---|
| WA-08 panel media send | Later follow-up, not this change |
| WA-11 admin send_mode chooser | Later follow-up |
| Pet bot only when area is Inspectoría | Not in this change; default area is Mesa and the registry is live |
| Tasks, citizen edit, LLM handoff | Phases 4–6 |
