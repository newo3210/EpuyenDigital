## ADDED Requirements

### Requirement: Send mode guard
Every outbound send (operator composer and automated/bot paths that use the shared sender) SHALL respect organization `send_mode`:
- `dry_run`: persist intent / message as appropriate but MUST NOT call Evolution
- `allowlist`: only phones in `allowlist_phones` may be sent; others blocked and logged
- `production`: send to the destination phone

#### Scenario: dry_run blocks Evolution
- **WHEN** send_mode is `dry_run` and an operator sends text
- **THEN** no Evolution HTTP send is invoked and the attempt is recorded safely

#### Scenario: allowlist blocks unknown phone
- **WHEN** send_mode is `allowlist` and the destination phone is not listed
- **THEN** the send is blocked and no Evolution call is made

### Requirement: Operator text composer
Authenticated operators with access to the conversation’s organization SHALL send plain text from a minimal panel composer on a conversation thread. The send SHALL create an outbound message row linked to the conversation and enqueue or perform the guarded Evolution send. Full triage claim rules are out of scope (inbox); this change only requires org-authenticated access consistent with RLS once conversations are readable.

#### Scenario: Operator sends text in production
- **WHEN** send_mode is `production` and an operator submits non-empty text on a conversation
- **THEN** an outbound message row exists and Evolution is called with the normalized phone

#### Scenario: Empty body rejected
- **WHEN** an operator submits an empty composer body
- **THEN** the send is rejected with a validation error and no Evolution call occurs

### Requirement: Delivery status persistence
When Evolution reports delivered or read (or equivalent ACK) for an outbound message, the system SHALL update that message’s `delivery_status` (and timestamps if modeled). Thread tick UI polish is deferred to `mesa-entrada-inbox`.

#### Scenario: Delivered ACK stored
- **WHEN** a delivery update arrives for an existing outbound external id
- **THEN** the message `delivery_status` reflects delivered (or the mapped enum value)

### Requirement: Phone normalization on send
Outbound destinations SHALL be normalized to `549…` before allowlist checks and Evolution calls.

#### Scenario: Local format normalized
- **WHEN** an operator send targets a phone stored with spaces or a leading zero local form that normalizes to a known `549…` value
- **THEN** the send path uses the canonical normalized phone
