## ADDED Requirements

### Requirement: Persist citizen with geolocation
The system SHALL persist a citizen record with full name, document id, normalized phone, address, neighborhood, GPS coordinates, privacy consent timestamp, and registration timestamps.

#### Scenario: New citizen created
- **WHEN** a new phone completes the citizen steps including location
- **THEN** one citizen row exists with non-null `latitude`, `longitude`, `privacy_consent_at`, and `document_id`

#### Scenario: Phone uniqueness
- **WHEN** the same normalized phone registers again
- **THEN** no second citizen is created for that phone; the existing citizen is reused

### Requirement: Persist animal linked to citizen
Each completed registration SHALL create an animal row linked to the citizen with all required animal fields and status `active`.

#### Scenario: Animal linked
- **WHEN** registration completes for citizen C
- **THEN** an animal row exists with `citizen_id = C`, species in (`dog`,`cat`,`other`), and required attributes populated

#### Scenario: Multiple animals per citizen
- **WHEN** a returning citizen registers a second pet
- **THEN** two animal rows exist for the same citizen with distinct municipal IDs

### Requirement: Municipal animal ID generation
On completion the system SHALL assign a unique municipal ID with format `{BARRIO3}-{YYYY}-{SEQ5}` where `BARRIO3` is a normalized 3–4 letter code from the citizen neighborhood (fallback `EPU`), `YYYY` is the registration year in America/Argentina/Buenos_Aires, and `SEQ5` is a zero-padded per-org yearly sequence.

#### Scenario: ID with known barrio code
- **WHEN** the neighborhood maps to code `CENT` and the animal is the 482nd of 2026 for the org
- **THEN** `municipal_id` is `CENT-2026-00482`

#### Scenario: Fallback barrio code
- **WHEN** the neighborhood has no mapped code
- **THEN** `municipal_id` uses prefix `EPU` (e.g. `EPU-2026-00001`)

#### Scenario: Uniqueness
- **WHEN** two animals complete in the same year
- **THEN** their municipal IDs differ and both are unique within the organization

### Requirement: Animal photos and optional health card
The system SHALL store one or more animal photos and MAY store an optional health-card / booklet photo linked to the animal.

#### Scenario: Photos linked
- **WHEN** registration completes with two animal images
- **THEN** two `animal_photos` rows of kind `animal` exist for that animal

#### Scenario: Health card optional
- **WHEN** the citizen skips the health-card photo
- **THEN** registration still completes without a `health_card` photo row

### Requirement: Vision distinctive traits
After animal photos are stored, the system SHALL call a vision LLM through a provider-agnostic adapter, parse the result with a strict Zod schema (traits summary, colors, markings, notable features), and store it on the animal. On failure after one retry, registration still completes with `traits_status = pending_manual`.

#### Scenario: Vision success
- **WHEN** vision returns valid structured traits
- **THEN** `distinctive_traits` is stored and `traits_status = ready`

#### Scenario: Vision failure
- **WHEN** the vision provider errors twice or returns invalid schema after retry
- **THEN** the animal remains `active` with photos stored, `traits_status = pending_manual`, and the confirmation message still includes the municipal ID

### Requirement: Extension hook for future species
The data model SHALL store species as an enum/check that can be extended later for horse and livestock plantels without renaming the `animals` table.

#### Scenario: MVP species only
- **WHEN** an animal is inserted in this MVP
- **THEN** species is one of `dog`, `cat`, `other`

### Requirement: Privacy of media and PII
Animal and health-card objects SHALL live in a private storage bucket; application logs SHALL redact document ids and phone numbers.

#### Scenario: Private bucket
- **WHEN** an animal photo is stored
- **THEN** the bucket is not publicly listable/readable without a signed URL or service role

#### Scenario: Redacted logs
- **WHEN** an error is logged during registration containing a phone or DNI
- **THEN** the persisted error message does not contain the raw phone or DNI
