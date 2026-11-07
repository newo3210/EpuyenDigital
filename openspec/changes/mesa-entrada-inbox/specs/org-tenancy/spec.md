## ADDED Requirements

### Requirement: Area-scoped conversation access
Row Level Security on `conversations` and `messages` SHALL restrict non-admin operators to rows whose `area_id` is in `current_area_ids()` (plus pending delegations targeting them where applicable). Admins SHALL read/write all conversations of their organization. Inactive operators SHALL see nothing.

#### Scenario: Operator cannot read other area
- **WHEN** an operator belonging only to Mesa de Entrada selects conversations
- **THEN** conversations whose area is only Inspectoría are not returned

#### Scenario: Admin reads all org areas
- **WHEN** an admin lists conversations
- **THEN** conversations from Mesa de Entrada and Inspectoría in their org are visible
