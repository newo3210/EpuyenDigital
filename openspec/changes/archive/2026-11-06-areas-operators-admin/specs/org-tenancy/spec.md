## ADDED Requirements

### Requirement: Area membership helper
The database SHALL expose `current_area_ids()` returning the set of `area_id` values for the caller's active profile memberships in their organization, and returning an empty set when the caller has no profile, is inactive, or has no memberships.

#### Scenario: Member of two areas
- **WHEN** an active operator belongs to Mesa de Entrada and Inspectoría
- **THEN** `current_area_ids()` returns both area ids

#### Scenario: Inactive operator
- **WHEN** an inactive operator calls `current_area_ids()`
- **THEN** it returns an empty set

### Requirement: Profile email and deactivation timestamp
`profiles` SHALL store a replicated `email` (unique per organization when present) for directory listing and a nullable `deactivated_at` timestamptz set when `is_active` becomes false and cleared when reactivated. Clients SHALL NOT escalate privileges by writing `email` outside admin provisioning paths enforced by the database or service-role admin APIs.

#### Scenario: Email visible on profile row
- **WHEN** an admin creates an operator with email `op@epuyen.gob.ar`
- **THEN** `profiles.email` equals that address for directory queries

#### Scenario: Deactivation stamps time
- **WHEN** an admin deactivates an operator
- **THEN** `deactivated_at` is non-null

## MODIFIED Requirements

### Requirement: Cross-organization isolation
Row Level Security SHALL be enabled on every business table including `areas` and `area_members`, and no operator SHALL read or modify rows of another organization. Area and membership writes SHALL additionally require role `admin` of the caller's organization (except service role / seed).

#### Scenario: Read isolation
- **WHEN** an operator of organization A selects from `profiles`
- **THEN** only profiles of organization A are returned

#### Scenario: Write isolation
- **WHEN** an operator of organization A attempts to update a profile of organization B
- **THEN** zero rows are affected

#### Scenario: Inactive operator sees nothing
- **WHEN** an inactive operator selects from any business table
- **THEN** zero rows are returned

#### Scenario: Read isolation for areas
- **WHEN** an operator of organization A selects from `areas`
- **THEN** only areas of organization A are returned

#### Scenario: Write isolation for area_members
- **WHEN** an admin of organization A attempts to insert a membership for a profile of organization B
- **THEN** zero rows are inserted
