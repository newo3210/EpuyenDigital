# whatsapp-inbound Specification

## Purpose
Inbound WhatsApp persistence, including reopen of a resolved thread and the citizen stub that respects manual field sources. Updated by archiving `mesa-entrada-inbox` and `pobladores-ficha` (2026-11-08).

## Requirements

### Requirement: Webhook secret mandatory
The Evolution webhook SHALL reject requests that lack a valid webhook secret for the target line. A missing or wrong secret SHALL NOT persist messages or enqueue jobs.

#### Scenario: Missing secret rejected
- **WHEN** a webhook request arrives without a valid secret header/query matching the line
- **THEN** the response is unauthorized/forbidden and no message row is created

#### Scenario: Valid secret accepted
- **WHEN** a webhook request arrives with the correct secret for the line
- **THEN** processing continues (normalize → persist → enqueue as applicable)

### Requirement: Idempotent inbound text
Inbound citizen text messages SHALL be stored once per `(line_id, external_id)`. Group, broadcast, and newsletter messages SHALL be ignored. Phones SHALL be normalized to Argentine canonical `549…` before persistence.

#### Scenario: Duplicate webhook delivery
- **WHEN** the same Evolution message id is posted twice
- **THEN** only one message row exists and the second call does not create a duplicate

#### Scenario: Group message ignored
- **WHEN** a group chat message is received
- **THEN** it is ignored and no conversation is created for that group jid

### Requirement: Conversations upsert
Each inbound (and outbound) citizen thread SHALL map to exactly one `conversations` row per `(org_id, line_id, phone_normalized)`. New conversations SHALL set `area_id` from the line’s `default_area_id` (fallback: org default area). Messages SHALL reference `conversation_id`.

#### Scenario: First message creates conversation
- **WHEN** a new phone writes to the line for the first time
- **THEN** a conversation is created with the line default area and the message is linked to it

### Requirement: Media and location inbound
Inbound image, audio, video, document, sticker, and location payloads SHALL be accepted. Media SHALL be downloaded asynchronously to private storage and linked on the message (`storage_path` / mime / kind). Location SHALL store latitude/longitude on the message (inquiry coords for later inbox map — not written to pet `citizens.latitude/longitude`).

#### Scenario: Image inbound
- **WHEN** a citizen sends an image with a valid secret
- **THEN** a message row of image kind is created and a media download job is enqueued

#### Scenario: Location inbound
- **WHEN** a citizen shares a WhatsApp location
- **THEN** the message stores latitude and longitude without overwriting citizen pet GPS columns

### Requirement: LID resolution and profile capture
The system SHALL resolve real phones for `@lid` JIDs when Evolution provides a mapping or lookup path. The system SHALL capture `pushName` and profile avatar URL onto the citizen stub when available.

#### Scenario: pushName captured
- **WHEN** an inbound message includes pushName for a new phone
- **THEN** the linked citizen (or unregistered stub) stores that pushName

### Requirement: fromMe as outbound
Messages written from the line handset (`fromMe`) SHALL be persisted as outbound on the same conversation thread, not as inbound citizen messages.

#### Scenario: fromMe mirrored
- **WHEN** Evolution reports a fromMe text for the line
- **THEN** an outbound message appears on the conversation for that phone

### Requirement: Citizen stub on first contact
A new phone SHALL create or link an unregistered citizen with phone and available WhatsApp profile fields (POB-01 subset needed for channel). The stub SHALL write `whatsapp_push_name` and SHALL NOT assign that value to `full_name`. A later inbound SHALL NOT change a profile column whose `field_sources` entry is `manual`. Full ficha editing is specified in `citizen-profile`.

#### Scenario: New phone creates unregistered citizen
- **WHEN** an unknown normalized phone messages the line
- **THEN** an unregistered citizen and citizen_phones row exist linked to the conversation

#### Scenario: Repeat inbound keeps a manual name
- **WHEN** a known citizen with a manual `full_name` sends another message that includes a different pushName
- **THEN** `whatsapp_push_name` may update and `full_name` is unchanged

### Requirement: Reopen resolved conversation on citizen inbound
When an inbound citizen message is persisted for a conversation in `queue_column` `resolved`, the system SHALL reopen that conversation as specified in `conversation-ownership` (unowned, column `new`, `REOPENED` event) in the same persistence flow as the message. Duplicate external ids SHALL still persist only one message and SHALL NOT reopen twice. Group, broadcast, and newsletter ignores SHALL NOT reopen anything. The pet `process_inbound` job SHALL still be enqueued for a non-fromMe inbound on the shared line, whether or not the conversation was reopened.

#### Scenario: Citizen writes after resolve
- **WHEN** a valid inbound text webhook arrives for a resolved conversation
- **THEN** the message is stored once and the conversation is unowned in column `new` with a `REOPENED` event

#### Scenario: Duplicate delivery does not reopen twice
- **WHEN** the same external id is delivered again after a reopen
- **THEN** there is still one message and one `REOPENED` event for that message

#### Scenario: Pet job still enqueued
- **WHEN** a non-fromMe inbound is accepted on the shared line
- **THEN** a `process_inbound` job is still enqueued

### Requirement: External contact inbound bypasses citizen path
When the inbound phone matches an active `external_contacts` row for the line's organization, the webhook SHALL route the message to the task external protocol. It SHALL NOT create or update a citizen stub, SHALL NOT create a citizen conversation, and SHALL NOT enqueue `process_inbound`.

#### Scenario: External phone skips stub
- **WHEN** an active external contact messages the line
- **THEN** no citizen insert runs for that phone and no `process_inbound` job is enqueued
