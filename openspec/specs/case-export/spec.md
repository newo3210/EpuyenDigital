# case-export Specification

## Purpose
TBD - created by archiving change tareas-notas-trazabilidad. Update Purpose after archive.

## Requirements

### Requirement: Export a case
An operator who can see a conversation, and support, SHALL export that case as a structured report containing the conversation summary, message metadata, conversation events, related tasks with history, and notes. The export SHALL NOT include storage media bytes. Another organization SHALL receive nothing.

#### Scenario: Operator exports own area case
- **WHEN** an operator exports a conversation visible to them
- **THEN** the report includes events and any tasks linked to that conversation

#### Scenario: Cross-org export rejected
- **WHEN** an operator exports a conversation id from another organization
- **THEN** the call is rejected with NOT_FOUND
