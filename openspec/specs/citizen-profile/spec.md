# citizen-profile Specification

## Purpose
Citizen ficha editing, manual-source protection, register, missing fields, party kind, and timeline. Landed by archiving `pobladores-ficha` (2026-11-08).

## Requirements

### Requirement: Operator edits the ficha
An operator, area lead, or admin who belongs to the citizen's organization SHALL edit `full_name`, `document_id`, `address_line`, `neighborhood`, `email`, `tags`, `observations`, `party_kind`, and home `latitude` / `longitude` from the citizen page and from the open conversation thread. Each saved field SHALL be stored with `field_sources` value `manual`. Support SHALL see the ficha and SHALL NOT see mutating controls. The save SHALL NOT read coordinates from messages.

#### Scenario: Operator saves a name from the thread
- **WHEN** an operator opens a conversation and saves a new full name on that citizen
- **THEN** `full_name` is the new value and `field_sources.full_name` is `manual`

#### Scenario: Support cannot save
- **WHEN** a support user submits a profile update
- **THEN** the database rejects the call and the row is unchanged

### Requirement: Manual values survive later writers
A profile column whose `field_sources` entry is `manual` SHALL keep its current value when any writer other than `update_citizen_profile` updates the row. `whatsapp_push_name` SHALL NOT be copied into `full_name`. An empty column MAY be filled by the pet registration writer.

#### Scenario: Pet write does not replace a manual name
- **WHEN** the pet worker updates `full_name` on a citizen whose `field_sources.full_name` is `manual`
- **THEN** `full_name` remains the manual value

#### Scenario: Push name stays on its own column
- **WHEN** an inbound message includes a pushName for a citizen who already has a manual full name
- **THEN** `whatsapp_push_name` may change and `full_name` stays the manual value

### Requirement: Register when the minimum data exists
`register_citizen` SHALL set `registration_status` to `registered`, `registered_at`, and `registered_by` for a person only when `full_name`, `document_id`, and at least one phone are non-empty. For `party_kind` `organization` it SHALL require `full_name` and at least one phone, and SHALL allow a null `document_id`. A citizen who does not meet the rule SHALL stay `unregistered`. The queue card SHALL show the registered label from `registration_status`.

#### Scenario: Person with name, DNI, and phone
- **WHEN** an operator registers a person who has a name, a document id, and a phone
- **THEN** `registration_status` is `registered` and the queue card shows the registered label

#### Scenario: Person missing DNI
- **WHEN** an operator registers a person whose `document_id` is null
- **THEN** the call is rejected and `registration_status` stays `unregistered`

#### Scenario: Organization without DNI
- **WHEN** an operator registers an organization that has a name and a phone and a null document id
- **THEN** `registration_status` is `registered`

### Requirement: Missing data is listed
The ficha SHALL list the fields still required for the citizen's party kind. For a person those are name, DNI, and phone. For an organization those are name and phone. Optional empty fields (address, neighborhood, email) SHALL be listed separately as optional.

#### Scenario: Unregistered person missing DNI
- **WHEN** an operator opens a person with a name and a phone and a null document id
- **THEN** the ficha lists DNI as required and does not list the name or the phone as required

### Requirement: Person or organization
The operator SHALL set `party_kind` to `person` or `organization`. The default for a channel stub SHALL remain `person`.

#### Scenario: Switch to organization
- **WHEN** an operator sets the party kind to organization and saves
- **THEN** `party_kind` is `organization` and `field_sources.party_kind` is `manual`

### Requirement: Timeline of existing history
The ficha SHALL list, newest first, messages of the citizen's conversations, `conversation_events` of those conversations, and animals linked to the citizen. It SHALL NOT query notes or tasks. A citizen with no messages SHALL show an empty timeline, not an error.

#### Scenario: Message and animal both appear
- **WHEN** a citizen has one conversation message and one animal
- **THEN** the timeline shows both records

#### Scenario: No notes table
- **WHEN** the operator opens any ficha
- **THEN** the page does not read or write a notes or tasks table
