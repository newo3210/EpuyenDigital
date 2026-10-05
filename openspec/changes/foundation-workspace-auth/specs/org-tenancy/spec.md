## ADDED Requirements

### Requirement: Organizations and profiles
The system SHALL store organizations and operator profiles, where each profile belongs to exactly one organization and has a role (`admin`, `area_lead`, `operator`, `support`) and an active flag.

#### Scenario: Profile linked to auth user
- **WHEN** an admin profile is seeded
- **THEN** the profile id equals the Supabase Auth user id, `org_id` references the seeded organization, `role` is `admin`, and `is_active` is true

### Requirement: RLS helper functions
The database SHALL expose `current_org_id()` and `current_user_role()` (not `current_role()`, which collides with the reserved SQL keyword `CURRENT_ROLE`) returning the caller's organization and role, and returning null when the caller has no profile or the profile is inactive.

#### Scenario: Active operator
- **WHEN** an authenticated active operator calls `current_org_id()`
- **THEN** it returns the operator's organization id

#### Scenario: Inactive operator
- **WHEN** an authenticated operator whose profile has `is_active = false` calls `current_org_id()`
- **THEN** it returns null

### Requirement: Cross-organization isolation
Row Level Security SHALL be enabled on every business table, and no operator SHALL read or modify rows of another organization.

#### Scenario: Read isolation
- **WHEN** an operator of organization A selects from `profiles`
- **THEN** only profiles of organization A are returned

#### Scenario: Write isolation
- **WHEN** an operator of organization A attempts to update a profile of organization B
- **THEN** zero rows are affected

#### Scenario: Inactive operator sees nothing
- **WHEN** an inactive operator selects from any business table
- **THEN** zero rows are returned

### Requirement: Profile self-service limits
An operator SHALL be able to update only their own `full_name` and `avatar_path`; `role`, `org_id`, and `is_active` SHALL be changeable only by an admin of the same organization; `id` and `created_at` SHALL be changeable by no client. The database SHALL enforce `full_name` as 2–80 characters after trimming and `avatar_path` as null or a path under `{org_id}/{id}/` of the same profile.

#### Scenario: Operator tries to escalate role
- **WHEN** an operator updates their own profile setting `role = 'admin'`
- **THEN** the update is rejected and the role remains unchanged

#### Scenario: Admin tries to re-key a profile
- **WHEN** an admin updates a profile setting `id` to another auth user id
- **THEN** the update is rejected

#### Scenario: Foreign avatar path or blank name
- **WHEN** an operator updates their own profile through the REST API with another user's avatar path or a name of only spaces
- **THEN** the update is rejected

### Requirement: Least-privilege table grants
The `authenticated` role SHALL hold no `INSERT`, `DELETE`, `TRUNCATE`, `TRIGGER`, or `REFERENCES` privilege on `organizations`, `profiles`, or `error_logs`; writes it needs are limited to the `UPDATE` paths governed by RLS.

#### Scenario: Truncate attempt
- **WHEN** an authenticated operator runs `truncate public.error_logs`
- **THEN** it fails with a permission error
