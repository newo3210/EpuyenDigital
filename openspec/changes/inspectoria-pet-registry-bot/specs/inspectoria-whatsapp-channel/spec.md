## ADDED Requirements

### Requirement: Secure Evolution webhook for Inspectoría line
The system SHALL accept inbound WhatsApp events only for the configured Inspectoría Evolution instance and SHALL reject requests without a valid webhook secret.

#### Scenario: Valid secret accepted
- **WHEN** Evolution POSTs a message with the correct webhook secret for the Inspectoría line
- **THEN** the handler returns HTTP 200 and persists or enqueues the event for processing

#### Scenario: Missing or wrong secret rejected
- **WHEN** the webhook secret is missing or does not match
- **THEN** the handler returns HTTP 401 and does not persist the message

#### Scenario: Misconfigured secret fails closed
- **WHEN** the line has no webhook secret configured
- **THEN** the handler returns HTTP 503 and does not process the payload

### Requirement: Idempotent inbound text and media
Inbound messages SHALL be stored at most once per `(line_id, external_id)` and groups, broadcasts, and newsletters SHALL be ignored. Payloads without a stable Evolution message id SHALL NOT invent an `external_id`.

#### Scenario: Duplicate delivery
- **WHEN** the same Evolution message id is delivered twice
- **THEN** only one message row exists and the second call still returns 200

#### Scenario: Group ignored
- **WHEN** the payload is from a WhatsApp group
- **THEN** the system returns 200 and creates no citizen or registration session

#### Scenario: Missing message id ignored
- **WHEN** the Evolution payload has no `key.id` (and no alternate stable message id)
- **THEN** the handler returns HTTP 200 with `ignored` and does not persist a message

#### Scenario: fromMe does not drive the bot
- **WHEN** the payload has `fromMe: true` (typed on the linked handset)
- **THEN** the system may persist it as outbound phone echo but SHALL NOT enqueue `process_inbound`

### Requirement: Phone normalization and automatic capture
Citizen phone numbers SHALL be normalized to Argentine canonical `549…` form and captured from the webhook (not typed by the citizen).

#### Scenario: New contact phone stored
- **WHEN** a first-time citizen messages the line
- **THEN** their normalized phone is stored and used as the registration key

#### Scenario: LID resolution
- **WHEN** Evolution sends a `@lid` JID that resolves to a real phone
- **THEN** the system stores the resolved `549…` phone

### Requirement: Native location messages
The system SHALL accept WhatsApp native location messages and persist latitude and longitude with the registration session / citizen record.

#### Scenario: Location shared
- **WHEN** the citizen sends a WhatsApp location pin during the location step
- **THEN** `latitude` and `longitude` are stored and the conversation advances

#### Scenario: Non-location while waiting for GPS
- **WHEN** the citizen sends text instead of a location at the location step
- **THEN** the bot re-prompts in es-AR explaining how to share current location and does not complete registration

### Requirement: Media download to private storage
Inbound images SHALL be downloaded outside the webhook (worker job), stored in a private bucket, and linked to the message / animal photo row.

#### Scenario: Animal photo stored
- **WHEN** the citizen sends an image during the photo step
- **THEN** the worker stores the object in private storage and links it to the in-progress animal registration

#### Scenario: Non-image rejected at photo step
- **WHEN** the citizen sends a PDF or audio during the animal photo step
- **THEN** the bot asks for a photo (image) again

### Requirement: Outbound send-mode guard
All bot outbound messages SHALL pass through a single send entry point that honors `dry_run`, `allowlist`, and `production`.

#### Scenario: Dry run
- **WHEN** send mode is `dry_run`
- **THEN** the outbound text is persisted as blocked/simulated and Evolution is not called

#### Scenario: Allowlist blocks unknown phone
- **WHEN** send mode is `allowlist` and the destination phone is not listed
- **THEN** the send is blocked and recorded; no Evolution call is made

### Requirement: Webhook stays thin
The webhook handler SHALL validate secret + Zod payload, persist/enqueue, and return quickly without calling the LLM, downloading media, or sending outbound WhatsApp messages.

#### Scenario: No LLM in webhook
- **WHEN** an inbound message arrives
- **THEN** the HTTP response completes without invoking the vision or chat LLM adapters
