## 0. Branch

- [x] 0.1 Branch `cursor/mesa-entrada-inbox-3654` from latest `origin/main` (this plan commit). No production code before this artifact is approved.

## 1. Database — transitions, RLS, SLA (TDD)

- [x] 1.1 Failing Vitest contract on the migration SQL plus failing `packages/shared` business-minutes fixtures (Friday 13:00 ART + 120 → Monday 09:00 ART; Monday 08:00 + 120 → 10:00; holiday skip; null minutes).
- [x] 1.2 Migration: `conversation_events`, `conversation_reads`, `quick_replies`; conversation preview columns; `organizations.timezone`; `org_settings.business_hours` and `holidays`; seed Mon–Fri 08:00–14:00.
- [x] 1.3 Migration: `add_business_minutes` / `business_minutes_between` and `sla_due_at` maintenance when `needs_response` changes.
- [x] 1.4 Migration: definer functions in design D1 with hint codes and prefixed return columns. `reopen_conversation` idempotent per message.
- [x] 1.5 Migration: SELECT policies in design D4. Revoke authenticated writes on conversations, messages, events. Reads self-update. Quick replies admin write.
- [x] 1.6 Migration: `list_inbox_queue` ordered in SQL. Realtime publication for conversations, messages, events.
- [x] 1.7 `supabase/tests/007_inbox_triage.test.sql`: claim conflict, cross-org deny, cross-area deny, delegator still sees the row, reject without note, reopen single event, client cannot update events.
- [x] 1.8 Make unit tests pass. Record live `supabase test db` or an honest `NO_DOCKER` gap.

## 2. Application services (TDD)

- [x] 2.1 Zod contracts for filters, delegate, move, area change, quick reply.
- [x] 2.2 Inbox use cases call the SQL functions with the user-scoped server client. Map hint codes to es-AR messages, including the other owner's name.
- [x] 2.3 Composer: `ensure_owner_for_reply` before persist/send. Tests: unowned claims then sends; other owner does not call Evolution.
- [x] 2.4 Inbound store calls `reopen_conversation` for `resolved` rows. Tests: one reopen per external id; `process_inbound` still enqueued.
- [x] 2.5 Quick-reply and read-marker use cases. Opening a thread advances only the current operator.

## 3. Inbox UI

- [x] 3.1 `/inbox` queue with D2 order, card flags (text plus color), filters, empty state. Tablet layout: list and thread.
- [x] 3.2 Thread actions: claim, delegate (user or area, note required), accept, reject (note required), move column, resolve, set area. Support sees no mutating controls.
- [x] 3.3 Event timeline. Media, delivery tick labels, inquiry OSM links, home/pet coordinates labeled separately.
- [x] 3.4 Quick replies in the composer (insert only) and `/settings/quick-replies` for admin. Business-hours editor for admin.
- [x] 3.5 Realtime hook updates the open thread and queue without a browser reload. Nav badge. Sound off until enabled.
- [x] 3.6 Presentation components do not import Supabase. Copy in `es-AR`.

## 4. Root docs

- [x] 4.1 Update `ARCHITECTURE_SDD.md` (English): functions, RLS, SLA, routes, deferred pet routing.
- [x] 4.2 Update `STUDENT_DECISION_LOG.md` (Spanish): data-flow, why definer functions, why the pet job stays, glossary.
- [x] 4.3 Update `docs/data-model.md` marks for events, reads, quick replies, timezone, business hours.

## 5. Mandatory verification

- [x] 5.1 Review existing inbound, outbound, and area tests; adjust expectations that still describe org-wide writes or "ticks deferred".
- [x] 5.2 Run unit tests and record database notes in `reports/YYYY-MM-DD-step-5.2-unit-test-and-db-verification.md`.
- [x] 5.3 Curl the transition and composer paths (or the documented blocker) in `reports/YYYY-MM-DD-step-5.3-curl-manual.md`.
- [x] 5.4 Browser pass for claim conflict, delegate reject, reopen appearing on the queue, ticks and both coordinate labels, in `reports/YYYY-MM-DD-step-5.4-e2e-browser.md`.
- [x] 5.5 Acceptance matrix from the specs. Do not archive in this task list; archive waits for adversarial review and human OK.

## 6. Explicitly not in this change

Respected during apply: no panel media upload and no send_mode chooser. `process_inbound` is still enqueued for every non-fromMe inbound.


- [ ] 6.1 Do not add panel media upload (WA-08) or a send_mode settings screen (WA-11).
- [ ] 6.2 Do not skip `process_inbound` based on area.
