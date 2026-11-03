## MODIFIED Requirements

### Requirement: Persist citizen with geolocation
The system SHALL persist a citizen with full name, document id, normalized phone, and address. Latitude/longitude MAY be null when the citizen skipped location. `privacy_consent_at` MAY be null while consent is deferred.

#### Scenario: New citizen without GPS
- **WHEN** a new phone completes citizen steps and skips location
- **THEN** one citizen row exists with non-null `document_id` and null `latitude`/`longitude`

#### Scenario: New citizen with GPS
- **WHEN** a new phone completes citizen steps including a location pin
- **THEN** latitude and longitude are non-null

### Requirement: Municipal animal ID generation
On completion the system SHALL assign `{BARRIO}-{YYYY}-{SEQ5}` using prefix **`EPU`** while neighborhood indexing is deferred (empty/null neighborhood → `EPU`).

#### Scenario: EPU prefix
- **WHEN** an animal completes registration in this version
- **THEN** `municipal_id` matches `EPU-{YYYY}-{SEQ5}`

### Requirement: Persist animal linked to citizen
Unchanged linkage rules; `rabies_status` MAY be `unknown`.

#### Scenario: Rabies unknown stored
- **WHEN** the citizen selects No sé for antirrábica
- **THEN** the animal row stores `rabies_status = unknown`
