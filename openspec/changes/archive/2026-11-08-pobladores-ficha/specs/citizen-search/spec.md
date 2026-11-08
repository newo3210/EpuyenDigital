## ADDED Requirements

### Requirement: Search by name, DNI, or phone
An operator of the organization SHALL search citizens by a single text query matched against `full_name`, `document_id`, and `phone_normalized`. The match SHALL be case-insensitive contains. The result SHALL be at most 20 rows and SHALL be produced by the database. The page SHALL NOT download the full citizen table to filter it in the browser. An empty query SHALL show the search prompt, not every citizen.

#### Scenario: DNI fragment
- **WHEN** an operator searches a digit sequence that is contained in one citizen's `document_id`
- **THEN** that citizen is in the results

#### Scenario: Phone fragment
- **WHEN** an operator searches a fragment of a normalized phone on `citizen_phones`
- **THEN** the citizen who owns that phone is in the results

#### Scenario: Empty query
- **WHEN** the operator opens `/citizens` with an empty query
- **THEN** no citizen rows are listed

### Requirement: Search stays in the organization
The search SHALL return only citizens whose `org_id` is the caller's organization and whose `merged_into_id` is null. A user in another organization SHALL receive no rows. Support SHALL be able to search and SHALL NOT be able to edit from the results.

#### Scenario: Other organization
- **WHEN** an operator of organization B searches a name that exists only in organization A
- **THEN** the result is empty

#### Scenario: Merged row hidden
- **WHEN** a citizen has `merged_into_id` set and the operator searches that citizen's name
- **THEN** that dropped row is not in the results
