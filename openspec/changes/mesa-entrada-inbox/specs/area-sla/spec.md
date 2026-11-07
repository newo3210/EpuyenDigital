## ADDED Requirements

### Requirement: SLA from area minutes and business hours
The system SHALL compute conversation SLA due times using the area’s `sla_warning_minutes` and `sla_critical_minutes` counting only organization business hours (and holidays when configured). Cards SHALL show ok / warning / critical.

#### Scenario: Critical after elapsed business minutes
- **WHEN** an unowned conversation has waited beyond the area’s critical minutes in business hours
- **THEN** its card SLA status is critical
