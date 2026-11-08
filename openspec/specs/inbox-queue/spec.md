# inbox-queue Specification

## Purpose
Operator queue order, card flags, filters, read state, SLA badges, and the panel attention badge. Archived from `mesa-entrada-inbox` on 2026-11-08.

## Requirements

### Requirement: Unowned-first queue order
The inbox queue SHALL list non-resolved conversations visible to the operator with unowned threads first (`owner_user_id` null, including area delegations waiting to be taken), ordered by `entered_queue_at` ascending. Owned threads SHALL follow, ordered by `last_inbound_at` descending. Within each of those two groups, threads with `needs_response` SHALL appear before threads that do not, and threads whose SLA is critical SHALL appear before threads that are not critical. The order SHALL be produced by the database query, not by sorting the full message history in the browser. The default queue SHALL omit `queue_column = resolved`.

#### Scenario: Oldest unowned thread is first
- **WHEN** two non-resolved conversations have no owner and the second has an earlier `entered_queue_at`
- **THEN** the earlier thread appears above the later one, and both appear above any owned thread

#### Scenario: Owned threads sort by latest inbound
- **WHEN** two owned conversations are visible and one has a later `last_inbound_at`
- **THEN** the later inbound appears first among owned threads and still below every unowned thread

### Requirement: Queue card flags
Each queue card SHALL show, with text as well as color: last message date and time in `America/Argentina/Buenos_Aires`, citizen registered or unregistered, owner name or unowned, area name, pending delegation when `awaiting_acceptance` is true, needs-response when `needs_response` is true, SLA state (ok, warning, critical, or hidden when the area has no thresholds), bot state (active, handoff, or paused), and whether the thread has attachments. The card SHALL use denormalized preview fields and SHALL NOT load every message to render the list.

#### Scenario: Unregistered neighbor with attachment
- **WHEN** a card is rendered for an unregistered citizen whose conversation `has_attachments` is true
- **THEN** the card shows an unregistered label and an attachments label

#### Scenario: SLA hidden without thresholds
- **WHEN** the conversation area has null `sla_warning_minutes` and null `sla_critical_minutes`
- **THEN** the card does not show a warning or critical SLA badge

### Requirement: Queue filters
An operator SHALL filter the queue by area, line, owner (me, unowned, or a specific user), awaiting my acceptance, unanswered (`needs_response`), and with attachments. Filters SHALL combine with AND. An empty result SHALL show an empty state, not an error.

#### Scenario: Awaiting my acceptance
- **WHEN** the operator enables "awaiting my acceptance"
- **THEN** the list contains only conversations they can see where `awaiting_acceptance` is true and (`owner_user_id` is them or `pending_area_id` is one of their areas)

#### Scenario: Combined filters
- **WHEN** the operator filters by one line and "with attachments"
- **THEN** every returned card belongs to that line and has attachments

### Requirement: Per-operator read state
The system SHALL store, per conversation and operator, the last read message. A conversation SHALL show as unread for that operator when the latest inbound message is newer than their read marker. Opening the thread SHALL advance that operator's marker to the latest message. One operator's read SHALL NOT mark the thread read for anyone else.

#### Scenario: Second operator still unread
- **WHEN** operator A opens a thread with a new inbound message and operator B has never opened it
- **THEN** the thread is read for A and unread for B

### Requirement: Business-hours SLA badge
While `needs_response` is true and the area has SLA minutes, the system SHALL compute elapsed time only inside the organization business hours and outside holiday dates, using timezone `America/Argentina/Buenos_Aires` unless `organizations.timezone` is set. The badge SHALL be warning when elapsed business minutes reach `sla_warning_minutes` and critical when they reach `sla_critical_minutes` or `sla_due_at` is in the past. Outside `needs_response`, the active SLA badge SHALL be ok or hidden, not warning or critical. Seeded business hours SHALL be Monday to Friday 08:00–14:00 with no holidays, and an admin SHALL be able to change the weekly ranges and holiday dates.

#### Scenario: Weekend does not consume SLA
- **WHEN** a response becomes due on Friday after 14:00 and the next window is Monday 08:00, and warning is 60 minutes
- **THEN** the badge is not warning on Saturday

#### Scenario: Critical when due
- **WHEN** `needs_response` is true and `sla_due_at` is earlier than now
- **THEN** the card SLA state is critical

### Requirement: Panel badge and optional sound
The panel navigation SHALL show a badge count of visible conversations that are unread for the current operator or awaiting their acceptance. The count SHALL update when realtime events arrive. A sound SHALL play only after the operator enables sound in the browser, and only when that count increases. Sound SHALL default to off.

#### Scenario: Sound stays off
- **WHEN** a new unread conversation arrives and the operator has not enabled sound
- **THEN** the badge count increases and no sound plays

#### Scenario: Delegation counts
- **WHEN** a conversation enters awaiting acceptance for the operator
- **THEN** the badge count includes that conversation
