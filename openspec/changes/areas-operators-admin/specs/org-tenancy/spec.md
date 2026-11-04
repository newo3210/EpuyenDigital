## MODIFIED Requirements

### Requirement: Organization isolation with area scaffolding
Business tables remain isolated by organization (RLS). This change ADDS area membership helpers and RLS on `areas` / `area_members`. Conversation and task area isolation SHALL wait until those tables exist (inbox change); helpers MUST be present so that change can attach policies without redesigning membership.

#### Scenario: Cross-org area isolation
- **WHEN** an operator of organization A queries areas
- **THEN** no areas belonging to organization B are returned

#### Scenario: Area helper ready without conversations table
- **WHEN** migrations for this change are applied
- **THEN** `operator_area_ids` exists and `conversations` table is still absent (or unchanged if already absent)
