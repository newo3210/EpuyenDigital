## ADDED Requirements

### Requirement: Move queue columns
The owner SHALL move a conversation among claimed, in_progress, and waiting_external columns. Moves SHALL append MOVED events.

#### Scenario: Move to waiting external
- **WHEN** the owner moves a claimed conversation to waiting_external
- **THEN** `queue_column` is waiting_external and a MOVED event exists

### Requirement: Resolve and reopen
The owner SHALL resolve a conversation (RESOLVED event, clear needs_response, optionally resume bot_state to active when global bot is on). When a citizen sends inbound on a resolved conversation, the system SHALL reopen it into the queue (REOPENED / QUEUED as designed) without requiring a full page reload once realtime is wired.

#### Scenario: Resolve conversation
- **WHEN** the owner resolves an in-progress conversation
- **THEN** it leaves the open queue as resolved with a RESOLVED event

#### Scenario: Citizen message reopens resolved
- **WHEN** a citizen sends inbound on a resolved conversation
- **THEN** the conversation is open in the queue again (unowned or bot-active per bot rules) with a reopen/queue event

### Requirement: Event timeline
Each conversation SHALL expose an event timeline including at least: queued/handoff, claimed, moved, delegated, accepted, rejected, resolved, reopened, with actor and timestamp.

#### Scenario: Timeline after claim and resolve
- **WHEN** an operator claims then resolves
- **THEN** the timeline shows CLAIMED then RESOLVED with actor and times

### Requirement: Manual area routing
An authorized operator/admin SHALL set `area_id` on a conversation (shared-line routing) with an AREA_CHANGED event. This does not change the WhatsApp phone number.

#### Scenario: Move conversation to Inspectoría area
- **WHEN** an admin sets the conversation area to Inspectoría
- **THEN** `area_id` is Inspectoría and an AREA_CHANGED event exists
