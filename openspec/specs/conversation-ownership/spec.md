# conversation-ownership Specification

## Purpose
Claim, delegate, accept, reject, move, resolve, reopen, area routing, and area visibility. Archived from `mesa-entrada-inbox` on 2026-11-08.

## Requirements

### Requirement: Claim with conflict
An operator who can see an unowned, non-resolved conversation SHALL claim it. The claim SHALL set `owner_user_id` to that operator, `queue_column` to `claimed`, `bot_state` to `paused`, and SHALL insert a `CLAIMED` event and a `BOT_PAUSED` event in the same transaction. If another operator already owns it, the claim SHALL fail with `CLAIM_CONFLICT`, leave the row unchanged, and the UI SHALL name the current owner. Support SHALL NOT claim.

#### Scenario: First claim wins
- **WHEN** two operators claim the same unowned conversation and the first commit succeeds
- **THEN** the second receives `CLAIM_CONFLICT` and the owner stays the first operator

#### Scenario: Claim pauses the bot
- **WHEN** an operator claims a conversation whose `bot_state` is `active`
- **THEN** `bot_state` becomes `paused` and a `BOT_PAUSED` event exists

### Requirement: Reply claims or accepts
Sending an operator text reply SHALL call ensure-owner before any Evolution send. If the conversation is unowned, the reply SHALL claim it. If it is awaiting acceptance by this operator (they are `owner_user_id`, or they are a member of `pending_area_id`), the reply SHALL accept the delegation. If another operator owns it, the reply SHALL be rejected and SHALL NOT persist an outbound message or call Evolution. The error SHALL include the current owner's name.

#### Scenario: Reply on unowned thread
- **WHEN** an operator sends text on a visible unowned conversation
- **THEN** they become the owner, `bot_state` is `paused`, and only then is the outbound message persisted

#### Scenario: Reply blocked for other owner
- **WHEN** an operator sends text on a conversation owned by someone else
- **THEN** no outbound message is stored and the UI reports that the other person has the conversation

### Requirement: Delegate with acceptance
The current owner SHALL delegate to another active operator in the organization or to an active area, with a non-empty note. User delegation SHALL set `owner_user_id` to the target, `delegated_from_user_id` to the current owner, and `awaiting_acceptance` true. Area delegation SHALL set `owner_user_id` null, `pending_area_id` to the target area, `delegated_from_user_id` to the current owner, and `awaiting_acceptance` true. Both SHALL insert a `DELEGATED` event with the note. The delegator SHALL still be able to read the conversation while acceptance is pending. An empty note SHALL be rejected.

#### Scenario: Delegate to a person
- **WHEN** the owner delegates to another operator with a note
- **THEN** the target is owner, acceptance is pending, the delegator is stored, and a `DELEGATED` event contains the note

#### Scenario: Delegate to an area
- **WHEN** the owner delegates to an area with a note
- **THEN** the owner is cleared, `pending_area_id` is that area, and members of that area can see the thread as awaiting acceptance

### Requirement: Accept and reject delegation
The pending user owner, or a member of the pending area, SHALL accept. Accept SHALL set `owner_user_id` to the acceptor, clear `awaiting_acceptance` and `pending_area_id`, set `queue_column` to `claimed` and `bot_state` to `paused`, and insert an `ACCEPTED` event. The pending user, or an `area_lead` of the pending area, SHALL reject only with a non-empty note. Reject SHALL return `owner_user_id` to `delegated_from_user_id`, clear acceptance and `pending_area_id`, and insert a `REJECTED` event with the note. Other operators SHALL NOT accept or reject.

#### Scenario: Area member accepts by taking it
- **WHEN** a member of the pending area accepts an area delegation
- **THEN** that member is the owner and `awaiting_acceptance` is false

#### Scenario: Reject returns to delegator
- **WHEN** the pending owner rejects with a note
- **THEN** the delegator is owner again and a `REJECTED` event stores the note

#### Scenario: Reject without note fails
- **WHEN** a recipient rejects with an empty note
- **THEN** the delegation stays pending and no `REJECTED` event is written

### Requirement: Column moves and resolve
The owner or an admin SHALL move a non-resolved conversation among `claimed`, `in_progress`, and `waiting_external`. The move SHALL insert a `MOVED` event with from and to columns. Resolve SHALL be a separate action: set `queue_column` to `resolved`, `resolved_at` and `resolved_by`, `bot_state` to `active`, clear `awaiting_acceptance`, and insert `RESOLVED` and `BOT_RESUMED` events. Moving SHALL NOT set `resolved`. A non-owner operator SHALL NOT move or resolve.

#### Scenario: Owner moves to waiting
- **WHEN** the owner moves a claimed conversation to `waiting_external`
- **THEN** the column is `waiting_external` and a `MOVED` event records both columns

#### Scenario: Resolve resumes the bot flag
- **WHEN** the owner resolves a conversation
- **THEN** the column is `resolved`, `bot_state` is `active`, and the thread leaves the default queue

### Requirement: Reopen on citizen reply
When a new inbound citizen message is stored on a conversation whose `queue_column` is `resolved`, the system SHALL reopen it in the same transaction as the message insert: `queue_column` `new`, `owner_user_id` null, `awaiting_acceptance` false, `entered_queue_at` set to the message time, `bot_state` `active`, and a `REOPENED` event. The message SHALL still be stored once. This SHALL NOT stop the existing pet `process_inbound` enqueue.

#### Scenario: Resolved thread returns to the queue
- **WHEN** a citizen sends a new message on a resolved conversation
- **THEN** the conversation is `new`, unowned, and a `REOPENED` event exists

### Requirement: Manual area routing
The owner or an admin SHALL set `area_id` to another active area of the same organization. The change SHALL insert an `AREA_CHANGED` event with from and to area. It SHALL NOT write message coordinates onto `citizens.latitude` or `citizens.longitude`. It SHALL NOT change who receives the pet registration job.

#### Scenario: Owner moves the thread to Inspectoría
- **WHEN** the owner sets the area to Inspectoría
- **THEN** `area_id` is Inspectoría and an `AREA_CHANGED` event records the previous area

### Requirement: Append-only event timeline
The thread SHALL list `conversation_events` for that conversation in chronological order, showing event type, actor, and timestamp. Authenticated clients SHALL NOT update or delete event rows. Direct authenticated inserts into `conversations`, `messages`, or `conversation_events` SHALL be denied. Mutations SHALL happen only through the transition functions, which enforce organization and area visibility.

#### Scenario: Client cannot delete history
- **WHEN** an authenticated operator deletes or updates a `conversation_events` row
- **THEN** the database denies the statement and the row remains

### Requirement: Area visibility
An admin or support user SHALL read every conversation and message in their organization. An `area_lead` or `operator` SHALL read a conversation only when its `area_id` or `pending_area_id` is in `current_area_ids()`, or they are `owner_user_id`, or they are `delegated_from_user_id`. Messages SHALL follow the parent conversation. A user in another organization SHALL read nothing. Support SHALL NOT execute mutating transition functions.

#### Scenario: Operator does not see another area
- **WHEN** an operator belongs only to Mesa de Entrada and a conversation is in Inspectoría with another owner
- **THEN** that operator cannot read the conversation or its messages

#### Scenario: Delegator keeps access
- **WHEN** an operator delegates a conversation to an area they do not belong to
- **THEN** the delegator can still read the conversation until it is accepted or rejected
