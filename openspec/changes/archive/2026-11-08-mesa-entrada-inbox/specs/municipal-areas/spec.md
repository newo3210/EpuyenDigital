## REMOVED Requirements

### Requirement: SLA minute columns without engine
**Reason**: Phase 3 computes a business-hours SLA from these columns. Storing minutes without a clock no longer matches the product.
**Migration**: Keep the columns and the admin form. Inbox writes `conversations.sla_due_at` and shows ok / warning / critical as specified in `inbox-queue`.

## ADDED Requirements

### Requirement: SLA minutes drive the inbox clock
Areas SHALL keep optional positive integers `sla_warning_minutes` and `sla_critical_minutes` with critical greater than or equal to warning when both are set. When a conversation `needs_response` and the area has `sla_critical_minutes`, the inbox SHALL set `sla_due_at` to `last_inbound_at` plus that many business minutes. When critical minutes are null, `sla_due_at` SHALL be null. Admins SHALL still edit the minute values on the existing area form. This requirement does not add a second SLA configuration screen.

#### Scenario: Critical minutes set the due time
- **WHEN** an area has `sla_critical_minutes` 120 and a conversation starts needing a response at Monday 08:00 inside business hours
- **THEN** `sla_due_at` is 120 business minutes after that instant

#### Scenario: Null critical leaves no due time
- **WHEN** an area has null `sla_critical_minutes`
- **THEN** conversations in that area have null `sla_due_at`
