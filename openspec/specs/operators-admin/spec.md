# operators-admin Specification

## Purpose
TBD - created by archiving change areas-operators-admin. Update Purpose after archive.

## Requirements

### Requirement: Admin creates operators
An active `admin` SHALL create operators for their organization with email, full name (same validation rules as profile self-service), role (`admin`, `area_lead`, `operator`, or `support`), a temporary password returned once to the admin UI, and zero or more area memberships. The system SHALL create the Auth user and a matching `profiles` row with replicated `email`, `is_active = true`, and `deactivated_at` null. Non-admins SHALL NOT create operators.

#### Scenario: Admin creates operator with memberships
- **WHEN** an admin creates an operator with email, name, role `operator`, temporary password, and membership in Mesa de Entrada
- **THEN** the Auth user and profile exist, the temporary password is shown once in the admin UI, and `area_members` contains that membership

#### Scenario: Non-admin cannot create operator
- **WHEN** an `area_lead` attempts to create an operator
- **THEN** the operation is denied and no Auth user is created

#### Scenario: Duplicate email rejected
- **WHEN** an admin creates an operator whose email already exists in Auth
- **THEN** the create fails with a clear error and no orphan profile is left

### Requirement: Admin edits role and memberships
An admin SHALL update an operator's role and area memberships (`area_id`, `is_lead`) within the same organization. Membership changes SHALL replace the operator's membership set atomically for the submitted list.

#### Scenario: Change role and areas
- **WHEN** an admin changes an operator from `operator` to `area_lead` and sets memberships to Inspectoría with `is_lead = true`
- **THEN** the profile role is `area_lead` and the only membership is Inspectoría with `is_lead = true`

### Requirement: Deactivate without deleting history
An admin SHALL deactivate an operator by setting `is_active = false` and `deactivated_at` to the deactivation timestamp. The profile row and related history SHALL remain. Reactivation MAY set `is_active = true` and clear `deactivated_at`. Hard delete of operators is out of scope.

#### Scenario: Deactivated operator loses org context
- **WHEN** an admin deactivates an operator
- **THEN** `is_active` is false, `deactivated_at` is set, and subsequent `current_org_id()` for that user returns null

### Requirement: Last active admin protection
The system SHALL reject any operation that would leave the organization with zero active profiles whose role is `admin`. This includes deactivating the last active admin and changing the last active admin's role to a non-admin role.

#### Scenario: Cannot deactivate last admin
- **WHEN** an admin attempts to deactivate the only active admin of the organization
- **THEN** the update is rejected and that profile remains active with role `admin`

#### Scenario: Cannot demote last admin
- **WHEN** an admin attempts to change the only active admin's role to `operator`
- **THEN** the update is rejected and the role remains `admin`

#### Scenario: Second admin allows demotion
- **WHEN** two active admins exist and one is demoted to `operator`
- **THEN** the demotion succeeds and at least one active admin remains

### Requirement: Operator directory
Active operators of an organization SHALL list profiles of their organization including `email`, `full_name`, `role`, `is_active`, and area memberships. Only admins SHALL mutate directory entries.

#### Scenario: List shows email and areas
- **WHEN** an admin opens the operators directory
- **THEN** each row shows email, role, active flag, and assigned area names

### Requirement: Area membership model
`area_members` SHALL link `user_id` to `area_id` within the same organization with optional `is_lead`. The primary key SHALL be `(area_id, user_id)`. Members SHALL only reference areas and profiles of the same organization.

#### Scenario: Cross-org membership rejected
- **WHEN** a client attempts to insert an `area_members` row pairing a user from org A with an area from org B
- **THEN** the insert is rejected
