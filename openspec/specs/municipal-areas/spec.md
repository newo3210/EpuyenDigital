# municipal-areas Specification

## Purpose
TBD - created by archiving change areas-operators-admin. Update Purpose after archive.

## Requirements

### Requirement: Areas entity
The system SHALL store municipal areas per organization with `name`, optional `description`, `color` (`#RRGGBB`), `is_active`, `is_default`, `sla_warning_minutes`, and `sla_critical_minutes`. Area names SHALL be unique per organization after trim and case-insensitive comparison. Exactly one area per organization SHALL have `is_default = true` at all times after seed.

#### Scenario: Admin creates an active area
- **WHEN** an admin of the organization creates an area with a unique name and valid color
- **THEN** the area is persisted with `is_active = true` (unless requested otherwise) and appears in the organization's area list

#### Scenario: Duplicate area name rejected
- **WHEN** an admin creates an area whose trimmed name matches an existing area of the same organization ignoring case
- **THEN** the create is rejected and no new row is written

#### Scenario: Invalid color rejected
- **WHEN** an admin submits a color that is not `#` followed by six hex digits
- **THEN** the create or update is rejected

### Requirement: Single default area
The organization SHALL always have exactly one default area. Promoting an area to default SHALL clear `is_default` on any previous default of the same organization in the same transaction. Clearing the default flag without promoting another area SHALL be rejected.

#### Scenario: Promote Inspectoría then Mesa again
- **WHEN** an admin sets area B as default while area A was default
- **THEN** area B has `is_default = true` and area A has `is_default = false`

#### Scenario: Cannot leave org without default
- **WHEN** an admin attempts to set `is_default = false` on the only default area without promoting another
- **THEN** the update is rejected

### Requirement: SLA minute columns without engine
Areas SHALL store optional positive integer `sla_warning_minutes` and `sla_critical_minutes` for later inbox use. This change SHALL NOT compute `sla_due_at` or enforce business hours.

#### Scenario: Persist SLA minutes
- **WHEN** an admin sets warning 30 and critical 120 on an area
- **THEN** those integers are stored and returned on subsequent reads

### Requirement: Admin-only area writes
Only an active operator with role `admin` in the same organization SHALL create or update areas. `area_lead`, `operator`, and `support` SHALL read areas of their organization and SHALL NOT mutate them.

#### Scenario: Non-admin cannot create area
- **WHEN** an authenticated `operator` attempts to create an area
- **THEN** the operation is denied and no row is inserted

#### Scenario: Operators can list areas
- **WHEN** an active `operator` of the organization lists areas
- **THEN** they receive the areas of their organization only

### Requirement: Seed Mesa de Entrada and Inspectoría
After database seed for organization `epuyen`, the system SHALL include area **Mesa de Entrada** with `is_default = true` and area **Inspectoría** with `is_default = false`, both active.

#### Scenario: Fresh seed areas
- **WHEN** seed runs for organization slug `epuyen`
- **THEN** both areas exist, Mesa de Entrada is the sole default, and Inspectoría is not default
