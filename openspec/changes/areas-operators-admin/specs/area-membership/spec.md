## ADDED Requirements

### Requirement: Admin assigns operators to areas
An admin SHALL add and remove operators as members of one or more areas, optionally marking `is_lead`.

#### Scenario: Assign membership
- **WHEN** an admin assigns an operator to Mesa de Entrada and Inspectoría
- **THEN** both membership rows exist and listing that operator shows both areas

#### Scenario: Remove membership
- **WHEN** an admin removes an operator from an area
- **THEN** that membership row is deleted and the operator no longer lists that area

### Requirement: Membership reads for future inbox
The database SHALL expose a helper listing the caller’s area ids so later conversation RLS can scope by area.

#### Scenario: operator_area_ids helper
- **WHEN** an authenticated operator with two memberships calls `operator_area_ids()`
- **THEN** the function returns exactly those two area ids for their organization
