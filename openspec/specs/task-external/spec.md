# task-external Specification

## Purpose
TBD - created by archiving change tareas-notas-trazabilidad. Update Purpose after archive.

## Requirements

### Requirement: External contacts per area
An admin SHALL register active external contacts with a name, normalized phone, and area. Phones SHALL be unique per organization. Operators SHALL pick an active contact when creating or delegating a task with audience `external`.

#### Scenario: Unique phone
- **WHEN** an admin saves a second contact with the same normalized phone in the same organization
- **THEN** the save is rejected

### Requirement: External WhatsApp protocol
Delegating or creating a task with audience `external` SHALL enqueue a notify job that sends the public ref and accepted commands. An inbound message from an active external contact phone SHALL be handled by the task protocol and SHALL NOT create a citizen stub, citizen conversation, or pet `process_inbound` job.

#### Scenario: External accepts
- **WHEN** the contact replies `ACEPTO T-0123` for a pending external task with that public ref
- **THEN** the task is accepted for that contact and history records `EXTERNAL_REPLIED` and `ACCEPTED`

#### Scenario: External phone does not create a poblador
- **WHEN** an active external contact sends a text that is not a task command
- **THEN** no new citizen row is created for that phone and a help reply may be sent

#### Scenario: External completes
- **WHEN** the contact replies `LISTO T-0123` with detail on an in-progress external task
- **THEN** the task is completed with outcome `resolved` and a sealed audit note stores the detail
