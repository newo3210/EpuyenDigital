## ADDED Requirements

### Requirement: External contact inbound bypasses citizen path
When the inbound phone matches an active `external_contacts` row for the line's organization, the webhook SHALL route the message to the task external protocol. It SHALL NOT create or update a citizen stub, SHALL NOT create a citizen conversation, and SHALL NOT enqueue `process_inbound`.

#### Scenario: External phone skips stub
- **WHEN** an active external contact messages the line
- **THEN** no citizen insert runs for that phone and no `process_inbound` job is enqueued
