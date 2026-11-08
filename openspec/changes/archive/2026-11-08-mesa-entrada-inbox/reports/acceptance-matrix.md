# Acceptance Matrix (implementer draft — live execution blocked)

Scenarios copied from `openspec/changes/mesa-entrada-inbox/specs/**/spec.md`.

**Change:** `mesa-entrada-inbox`
**Date:** 2026-11-08
**Author:** apply session (not the adversarial reviewer). The template asks a different person to re-execute this matrix. This draft records what the implementer could prove on a VM without Docker.

## Scenarios

### Scenario: First claim wins

- **WHEN** two operators claim the same unowned conversation and the first commit succeeds
- **THEN** the second receives `CLAIM_CONFLICT` and the owner stays the first operator

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Claim pauses the bot

- **WHEN** an operator claims a conversation whose `bot_state` is `active`
- **THEN** `bot_state` becomes `paused` and a `BOT_PAUSED` event exists

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Reply on unowned thread

- **WHEN** an operator sends text on a visible unowned conversation
- **THEN** they become the owner, `bot_state` is `paused`, and only then is the outbound message persisted

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Reply blocked for other owner

- **WHEN** an operator sends text on a conversation owned by someone else
- **THEN** no outbound message is stored and the UI reports that the other person has the conversation

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Delegate to a person

- **WHEN** the owner delegates to another operator with a note
- **THEN** the target is owner, acceptance is pending, the delegator is stored, and a `DELEGATED` event contains the note

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Delegate to an area

- **WHEN** the owner delegates to an area with a note
- **THEN** the owner is cleared, `pending_area_id` is that area, and members of that area can see the thread as awaiting acceptance

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Area member accepts by taking it

- **WHEN** a member of the pending area accepts an area delegation
- **THEN** that member is the owner and `awaiting_acceptance` is false

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Reject returns to delegator

- **WHEN** the pending owner rejects with a note
- **THEN** the delegator is owner again and a `REJECTED` event stores the note

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Reject without note fails

- **WHEN** a recipient rejects with an empty note
- **THEN** the delegation stays pending and no `REJECTED` event is written

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Owner moves to waiting

- **WHEN** the owner moves a claimed conversation to `waiting_external`
- **THEN** the column is `waiting_external` and a `MOVED` event records both columns

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Resolve resumes the bot flag

- **WHEN** the owner resolves a conversation
- **THEN** the column is `resolved`, `bot_state` is `active`, and the thread leaves the default queue

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Resolved thread returns to the queue

- **WHEN** a citizen sends a new message on a resolved conversation
- **THEN** the conversation is `new`, unowned, and a `REOPENED` event exists

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Owner moves the thread to Inspectoría

- **WHEN** the owner sets the area to Inspectoría
- **THEN** `area_id` is Inspectoría and an `AREA_CHANGED` event records the previous area

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Client cannot delete history

- **WHEN** an authenticated operator deletes or updates a `conversation_events` row
- **THEN** the database denies the statement and the row remains

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Operator does not see another area

- **WHEN** an operator belongs only to Mesa de Entrada and a conversation is in Inspectoría with another owner
- **THEN** that operator cannot read the conversation or its messages

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Delegator keeps access

- **WHEN** an operator delegates a conversation to an area they do not belong to
- **THEN** the delegator can still read the conversation until it is accepted or rejected

**Evidence (required):**
- Source spec: `conversation-ownership/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Oldest unowned thread is first

- **WHEN** two non-resolved conversations have no owner and the second has an earlier `entered_queue_at`
- **THEN** the earlier thread appears above the later one, and both appear above any owned thread

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Owned threads sort by latest inbound

- **WHEN** two owned conversations are visible and one has a later `last_inbound_at`
- **THEN** the later inbound appears first among owned threads and still below every unowned thread

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Unregistered neighbor with attachment

- **WHEN** a card is rendered for an unregistered citizen whose conversation `has_attachments` is true
- **THEN** the card shows an unregistered label and an attachments label

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: SLA hidden without thresholds

- **WHEN** the conversation area has null `sla_warning_minutes` and null `sla_critical_minutes`
- **THEN** the card does not show a warning or critical SLA badge

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Awaiting my acceptance

- **WHEN** the operator enables "awaiting my acceptance"
- **THEN** the list contains only conversations they can see where `awaiting_acceptance` is true and (`owner_user_id` is them or `pending_area_id` is one of their areas)

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Combined filters

- **WHEN** the operator filters by one line and "with attachments"
- **THEN** every returned card belongs to that line and has attachments

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Second operator still unread

- **WHEN** operator A opens a thread with a new inbound message and operator B has never opened it
- **THEN** the thread is read for A and unread for B

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Weekend does not consume SLA

- **WHEN** a response becomes due on Friday after 14:00 and the next window is Monday 08:00, and warning is 60 minutes
- **THEN** the badge is not warning on Saturday

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Critical when due

- **WHEN** `needs_response` is true and `sla_due_at` is earlier than now
- **THEN** the card SLA state is critical

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Sound stays off

- **WHEN** a new unread conversation arrives and the operator has not enabled sound
- **THEN** the badge count increases and no sound plays

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Delegation counts

- **WHEN** a conversation enters awaiting acceptance for the operator
- **THEN** the badge count includes that conversation

**Evidence (required):**
- Source spec: `inbox-queue/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Image renders

- **WHEN** an operator opens a thread that contains an image message with `storage_path`
- **THEN** the thread shows that image

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Missing file degrades

- **WHEN** a media message has a `storage_path` that cannot be signed
- **THEN** the thread shows the kind label and still shows neighboring text messages

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Read status visible

- **WHEN** an outbound message has `delivery_status` `read`
- **THEN** the thread shows a read label on that message

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Both coordinate kinds visible

- **WHEN** a message has inquiry coordinates and the citizen has different home coordinates
- **THEN** the thread shows both points with different labels and both values stay on their original rows

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: No coordinates

- **WHEN** the thread has no message coordinates and the citizen has null latitude
- **THEN** no map or coordinate block is shown

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Area-scoped reply hidden

- **WHEN** an operator composes on a Mesa de Entrada conversation
- **THEN** they see active org-wide replies and Mesa replies, and they do not see an active Inspectoría-only reply

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Insert does not send

- **WHEN** the operator inserts a quick reply
- **THEN** the composer contains that body and no outbound message is created until they submit

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Open thread receives a message

- **WHEN** a citizen message is inserted on the conversation the operator is viewing
- **THEN** the message appears in the thread without a browser reload

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Queue shows a new claim

- **WHEN** another operator claims a visible unowned conversation
- **THEN** the queue card shows the new owner without a browser reload

**Evidence (required):**
- Source spec: `inbox-thread/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Critical minutes set the due time

- **WHEN** an area has `sla_critical_minutes` 120 and a conversation starts needing a response at Monday 08:00 inside business hours
- **THEN** `sla_due_at` is 120 business minutes after that instant

**Evidence (required):**
- Source spec: `municipal-areas/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Null critical leaves no due time

- **WHEN** an area has null `sla_critical_minutes`
- **THEN** conversations in that area have null `sla_due_at`

**Evidence (required):**
- Source spec: `municipal-areas/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Citizen writes after resolve

- **WHEN** a valid inbound text webhook arrives for a resolved conversation
- **THEN** the message is stored once and the conversation is unowned in column `new` with a `REOPENED` event

**Evidence (required):**
- Source spec: `whatsapp-inbound/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Duplicate delivery does not reopen twice

- **WHEN** the same external id is delivered again after a reopen
- **THEN** there is still one message and one `REOPENED` event for that message

**Evidence (required):**
- Source spec: `whatsapp-inbound/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Pet job still enqueued

- **WHEN** a non-fromMe inbound is accepted on the shared line
- **THEN** a `process_inbound` job is still enqueued

**Evidence (required):**
- Source spec: `whatsapp-inbound/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Operator sends text in production

- **WHEN** send_mode is `production` and the operator is allowed to take or already owns the conversation and submits non-empty text
- **THEN** the operator is the owner and an outbound message row exists and Evolution is called with the normalized phone

**Evidence (required):**
- Source spec: `whatsapp-outbound/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Empty body rejected

- **WHEN** an operator submits an empty composer body
- **THEN** the send is rejected with a validation error and no Evolution call occurs

**Evidence (required):**
- Source spec: `whatsapp-outbound/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Ownership failure skips Evolution

- **WHEN** another operator owns the conversation and this operator submits text
- **THEN** Evolution is not called and no outbound message row is created

**Evidence (required):**
- Source spec: `whatsapp-outbound/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Delivered ACK stored

- **WHEN** a delivery update arrives for an existing outbound external id
- **THEN** the message `delivery_status` reflects delivered (or the mapped enum value)

**Evidence (required):**
- Source spec: `whatsapp-outbound/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

### Scenario: Thread shows the stored tick

- **WHEN** an operator opens the thread after a message was marked delivered
- **THEN** that outbound message shows a delivered label

**Evidence (required):**
- Source spec: `whatsapp-outbound/spec.md`
- Tool used: unit test or static SQL (no live DB, no browser session)
- Command / steps: `npm test`; pgTAP `supabase/tests/007_inbox_triage.test.sql` not executed
- Result: BLOCKED
- Notes: Live Postgres and a signed-in browser are unavailable (NO_DOCKER). See `reports/2026-11-08-step-5.2-unit-test-and-db-verification.md`.

---

## Summary

| Total | Pass | Fail | Blocked |
|---|---|---|---|
| 46 | 0 | 0 | 46 |

**Verdict:** BLOCKED (missing Docker / local Supabase / signed-in browser). No scenario was marked PASS from `npm test` alone, per the matrix rule.
