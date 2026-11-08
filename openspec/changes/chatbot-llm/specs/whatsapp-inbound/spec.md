## ADDED Requirements

### Requirement: Eligible inbound also enqueues bot_reply
After a citizen inbound message is persisted, the system SHALL enqueue `bot_reply` for that message when the mesa bot feature is enabled for the organization, in addition to the existing `process_inbound` job. External-contact bypass SHALL still skip both jobs. fromMe echoes SHALL enqueue neither.

#### Scenario: Citizen text enqueues both jobs
- **WHEN** a citizen text is inserted on the shared line and the org has the mesa bot enabled
- **THEN** both `process_inbound` and `bot_reply` jobs are enqueued once for that message

#### Scenario: External still skips both
- **WHEN** an active external contact writes
- **THEN** neither `process_inbound` nor `bot_reply` is enqueued
