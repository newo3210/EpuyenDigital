## ADDED Requirements

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
