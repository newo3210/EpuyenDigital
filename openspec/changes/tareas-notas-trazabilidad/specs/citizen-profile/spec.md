## MODIFIED Requirements

### Requirement: Timeline of existing history
The ficha SHALL list, newest first, messages of the citizen's conversations, `conversation_events` of those conversations, animals linked to the citizen, notes linked to the citizen, and tasks linked to the citizen. A citizen with no history SHALL show an empty timeline, not an error.

#### Scenario: Message and animal both appear
- **WHEN** a citizen has one conversation message and one animal
- **THEN** the timeline shows both records

#### Scenario: Note and task appear
- **WHEN** a citizen has one note and one task
- **THEN** the timeline shows both records
