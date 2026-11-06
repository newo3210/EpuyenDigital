# whatsapp-inbound Specification

## Purpose
TBD - created by archiving change whatsapp-channel-core. Update Purpose after archive.

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
A new phone SHALL create or link an unregistered citizen with phone and available WhatsApp profile fields (POB-01 subset needed for channel). Full poblador editing remains out of scope.

#### Scenario: New phone creates unregistered citizen
- **WHEN** an unknown normalized phone messages the line
- **THEN** an unregistered citizen and citizen_phones row exist linked to the conversation
