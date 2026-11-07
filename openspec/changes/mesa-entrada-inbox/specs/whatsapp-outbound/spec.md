## ADDED Requirements

### Requirement: Delivery ticks in thread UI
The conversation thread SHALL display delivery/read indicators for outbound messages based on persisted `delivery_status` (from channel ACKs).

#### Scenario: Delivered tick visible
- **WHEN** an outbound message has `delivery_status` delivered
- **THEN** the thread UI shows a delivered indicator on that message

## MODIFIED Requirements

### Requirement: Operator text composer
Authenticated operators with access to the conversation SHALL send plain text from the panel composer on a conversation thread. Before send, the system SHALL run `ensure_owner_for_reply` (claim unowned, accept pending delegation for self, or conflict if another owner). The send SHALL create an outbound message row linked to the conversation and enqueue or perform the guarded Evolution send under organization `send_mode`.

#### Scenario: Operator sends text in production
- **WHEN** send_mode is `production` and an operator submits non-empty text on a conversation they own (or successfully auto-claim)
- **THEN** an outbound message row exists and Evolution is called with the normalized phone

#### Scenario: Empty body rejected
- **WHEN** an operator submits an empty composer body
- **THEN** the send is rejected with a validation error and no Evolution call occurs

#### Scenario: Reply on unowned claims then sends
- **WHEN** an operator submits text on an unowned conversation they can access
- **THEN** ownership is ensured and the outbound message is sent under send_mode rules

### Requirement: Delivery status persistence
When Evolution reports delivered or read (or equivalent ACK) for an outbound message, the system SHALL update that message’s `delivery_status` (and timestamps if modeled). The thread UI SHALL surface these statuses as ticks (see Delivery ticks in thread UI).

#### Scenario: Delivered ACK stored
- **WHEN** a delivery update arrives for an existing outbound external id
- **THEN** the message `delivery_status` reflects delivered (or the mapped enum value)
