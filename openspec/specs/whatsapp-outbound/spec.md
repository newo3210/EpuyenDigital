# whatsapp-outbound Specification

## Purpose
Operator text send with ownership and delivery ticks. Updated by archiving `mesa-entrada-inbox` (2026-11-08).

## Requirements

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
An authenticated operator who can act on the conversation SHALL send plain text from the thread composer. The send SHALL call ensure-owner-on-reply before persisting the outbound row or calling Evolution. A successful send SHALL create an outbound message linked to the conversation and follow the existing `send_mode` guard. If ensure-owner fails, the send SHALL stop with the ownership error and SHALL NOT call Evolution. Empty bodies SHALL still be rejected with a validation error.

#### Scenario: Operator sends text in production
- **WHEN** send_mode is `production` and the operator is allowed to take or already owns the conversation and submits non-empty text
- **THEN** the operator is the owner and an outbound message row exists and Evolution is called with the normalized phone

#### Scenario: Empty body rejected
- **WHEN** an operator submits an empty composer body
- **THEN** the send is rejected with a validation error and no Evolution call occurs

#### Scenario: Ownership failure skips Evolution
- **WHEN** another operator owns the conversation and this operator submits text
- **THEN** Evolution is not called and no outbound message row is created

### Requirement: Delivery status persistence
When Evolution reports delivered or read (or equivalent ACK) for an outbound message, the system SHALL update that message’s `delivery_status` (and timestamps if modeled). The thread SHALL show that status as a tick label as specified in `inbox-thread`.

#### Scenario: Delivered ACK stored
- **WHEN** a delivery update arrives for an existing outbound external id
- **THEN** the message `delivery_status` reflects delivered (or the mapped enum value)

#### Scenario: Thread shows the stored tick
- **WHEN** an operator opens the thread after a message was marked delivered
- **THEN** that outbound message shows a delivered label

### Requirement: Phone normalization on send
Outbound destinations SHALL be normalized to `549…` before allowlist checks and Evolution calls.

#### Scenario: Local format normalized
- **WHEN** an operator send targets a phone stored with spaces or a leading zero local form that normalizes to a known `549…` value
- **THEN** the send path uses the canonical normalized phone

### Requirement: Bot outbound uses send_mode
Bot and system WhatsApp texts SHALL use the existing outbound path and `decideSend` (`dry_run` / `allowlist` / `production`). They SHALL persist with `sender_kind` `bot` or `system` as appropriate and SHALL NOT bypass allowlist or dry_run.

#### Scenario: Dry run simulates bot answer
- **WHEN** `send_mode` is `dry_run` and the bot answers
- **THEN** the outbound row is stored as simulated and Evolution is not called
