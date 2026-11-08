# bot-enrichment Specification

## Purpose
TBD - created by archiving change chatbot-llm. Update Purpose after archive.

## Requirements

### Requirement: Classification is stored on each run
Each non-silent `bot_reply` SHALL store `topic`, `urgency`, and `suggested_area_id` on `bot_runs` when the model produces them. Suggested area SHALL NOT silently overwrite `conversations.area_id` in this change.

#### Scenario: Handoff carries suggested area
- **WHEN** the bot hands off a waste-collection question
- **THEN** `bot_runs.suggested_area_id` points at the suggested area when one was classified

### Requirement: Field extraction requires confirmation
When the bot detects name, document id, or address, it SHALL ask for confirmation. Only an affirmative citizen reply SHALL write the field with source `bot`. Manual field sources SHALL continue to win over bot writes.

#### Scenario: Confirmed DNI is saved
- **WHEN** the bot proposes a DNI and the citizen confirms
- **THEN** `document_id` is stored and `field_sources.document_id` is `bot`

#### Scenario: Manual DNI is preserved
- **WHEN** `field_sources.document_id` is `manual` and the bot proposes another value
- **THEN** the manual document id remains unchanged after any bot write attempt

### Requirement: Media becomes notes or query text
Inbound audio SHALL be transcribed and the text SHALL feed the bot decision. Inbound images and PDFs SHALL produce a `bot_summary` note on the conversation after summarization.

#### Scenario: Audio transcribed
- **WHEN** a citizen sends an audio and the bot is eligible
- **THEN** a transcription exists and is used as the query text for the decision

#### Scenario: PDF summary note
- **WHEN** a citizen sends a PDF document
- **THEN** a note with kind `bot_summary` is attached to the conversation
