## ADDED Requirements

### Requirement: Dual coordinates
Inquiry location for Mesa triage SHALL be stored separately from pet registration GPS on `citizens`. Prefer message location payload and/or conversation inquiry fields; NEVER overwrite `citizens.latitude/longitude` used by Inspectoría pets.

#### Scenario: Location message does not overwrite pet GPS
- **WHEN** a citizen shares a WhatsApp location on a Mesa conversation and the citizen already has pet GPS coordinates
- **THEN** inquiry coords are available for the card map and citizen pet GPS columns remain unchanged

### Requirement: Map on card
The conversation or citizen card in the inbox SHALL show a map (or map link) when inquiry coordinates exist.

#### Scenario: Card shows map when coords present
- **WHEN** the open conversation has inquiry latitude/longitude
- **THEN** the operator sees a map visualization or embedded map for that pin
