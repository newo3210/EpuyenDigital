## ADDED Requirements

### Requirement: Realtime queue and thread
The queue and open thread SHALL update without a full page reload when conversations or messages change (Supabase Realtime or equivalent).

#### Scenario: New inbound appears live
- **WHEN** a new inbound message arrives for an open queue conversation while the operator views `/inbox`
- **THEN** the queue/thread reflects the message without a manual browser refresh

### Requirement: Notifications badge and optional sound
Operators SHALL receive an in-panel badge (and optional sound) when a new inbound arrives or a delegation targets them.

#### Scenario: Delegation badge
- **WHEN** a conversation is delegated to the signed-in operator
- **THEN** a badge (or dock count) increments without requiring navigation away and back
