## ADDED Requirements

### Requirement: Per-operator read state
The system SHALL track read/unread per conversation and operator. Opening a thread SHALL mark it read for that operator. Unread state SHALL be visible on queue cards.

#### Scenario: Open thread marks read
- **WHEN** an operator opens a conversation that had unread inbound for them
- **THEN** that conversation is marked read for that operator
