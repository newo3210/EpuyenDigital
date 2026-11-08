## ADDED Requirements

### Requirement: Bot summary notes are service-authored
The worker SHALL create `bot_summary` notes for media summaries using a service-role or definer path. Panel operators SHALL NOT forge `kind = bot_summary` through `create_note` (existing kind restriction remains).

#### Scenario: Summarize creates bot_summary
- **WHEN** summarize_media finishes for a conversation PDF
- **THEN** a note with `kind = bot_summary` exists on that conversation
