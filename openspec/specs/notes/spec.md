# notes Specification

## Purpose
TBD - created by archiving change tareas-notas-trazabilidad. Update Purpose after archive.

## Requirements

### Requirement: Internal notes
An operator, area lead, or admin SHALL create a note on a conversation, a citizen, a task, or a combination of those. A note SHALL allow one level of reply. Support SHALL read notes and SHALL NOT create them.

#### Scenario: Note on a conversation
- **WHEN** an operator posts a note on an open conversation
- **THEN** the note is stored with the author and the conversation id

#### Scenario: Reply depth
- **WHEN** an operator replies to a reply
- **THEN** the call is rejected

### Requirement: Mentions and convert to task
A note MAY mention users, areas, citizens, conversations, or tasks through `entity_mentions` written in the same transaction. An operator SHALL convert a note into a task that keeps a link to the source note.

#### Scenario: Convert note
- **WHEN** an operator converts a conversation note into a task
- **THEN** a task exists linked to that conversation and the note remains readable

### Requirement: Sealed audit notes
Closes, cancels, and external completions SHALL create an audit note that is sealed with a correlation id and content hash. Authenticated clients SHALL NOT update or delete a sealed note.

#### Scenario: Sealed note immutable
- **WHEN** an authenticated client updates a sealed audit note
- **THEN** the database rejects the change and the row is unchanged

### Requirement: Bot summary notes are service-authored
The worker SHALL create `bot_summary` notes for media summaries using a service-role or definer path. Panel operators SHALL NOT forge `kind = bot_summary` through `create_note` (existing kind restriction remains).

#### Scenario: Summarize creates bot_summary
- **WHEN** summarize_media finishes for a conversation PDF
- **THEN** a note with `kind = bot_summary` exists on that conversation
