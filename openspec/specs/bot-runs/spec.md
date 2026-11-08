# bot-runs Specification

## Purpose
TBD - created by archiving change chatbot-llm. Update Purpose after archive.

## Requirements

### Requirement: Every decision is logged
Every `bot_reply` execution SHALL insert exactly one `bot_runs` row for that attempt with decision, sources, confidence, model, latency, and token counts when available. Authenticated clients SHALL NOT insert, update, or delete `bot_runs`.

#### Scenario: Answer creates a run
- **WHEN** the bot answers a question
- **THEN** a `bot_runs` row exists with `decision = answered` and non-empty sources when chunks were used

### Requirement: Operators can read runs on the thread
Operators, area leads, admins, and support who can see the conversation SHALL read that conversation's bot runs in the panel. Support SHALL NOT mutate bot settings or knowledge.

#### Scenario: Support reads runs
- **WHEN** support opens a conversation that has bot runs
- **THEN** the runs are visible and no pause/knowledge controls are shown
