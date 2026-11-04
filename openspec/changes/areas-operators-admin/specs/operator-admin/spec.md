## ADDED Requirements

### Requirement: Admin creates operators
An organization admin SHALL create an operator with email, display name, role (`admin`, `area_lead`, or `operator`), and a temporary password. The auth user and profile SHALL belong to the admin’s organization.

#### Scenario: Create operator with temporary password
- **WHEN** an admin creates an operator with valid email, name, role, and temporary password meeting minimum length
- **THEN** the operator can sign in with that password and sees only their organization data

#### Scenario: Duplicate email rejected
- **WHEN** an admin tries to create an operator whose email already exists
- **THEN** creation fails with a clear error and no duplicate profile is created

### Requirement: Admin edits role and deactivates
An admin SHALL change an operator’s role and deactivate or reactivate them without deleting auth history. Deactivated operators SHALL NOT sign in to the panel.

#### Scenario: Deactivate operator
- **WHEN** an admin deactivates an active non-last-admin operator
- **THEN** `is_active` is false, `deactivated_at` is set, and subsequent sign-in attempts are rejected

#### Scenario: Last admin protected
- **WHEN** an admin attempts to deactivate or demote the only remaining active admin in the organization
- **THEN** the change is rejected and that profile remains an active admin

### Requirement: Only admin mutates operators
Non-admin roles SHALL NOT create operators, change roles, or deactivate users.

#### Scenario: Operator cannot create peers
- **WHEN** an operator role calls create-operator
- **THEN** the action is forbidden
