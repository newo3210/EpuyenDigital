## ADDED Requirements

### Requirement: Admin manages municipal areas
An organization admin SHALL create and update municipal areas with name, description, color, and active flag. Exactly one area per organization SHALL be marked default (Mesa de Entrada).

#### Scenario: Create area
- **WHEN** an admin submits a new area with a unique name in the organization
- **THEN** the area is persisted as active (unless specified inactive) and appears in the areas list

#### Scenario: Single default area
- **WHEN** an admin marks an area as default
- **THEN** that area has `is_default = true` and any previous default in the same organization becomes non-default

#### Scenario: Seeded baseline areas
- **WHEN** a developer runs the documented reset and seed commands
- **THEN** areas named Mesa de Entrada (`is_default`) and Inspectoría exist for the Epuyén organization

### Requirement: Non-admin cannot mutate areas
Operators without the admin role SHALL NOT create or update areas.

#### Scenario: Operator blocked from area write
- **WHEN** a non-admin calls an area create or update action
- **THEN** the action is rejected with a forbidden outcome and no row changes
