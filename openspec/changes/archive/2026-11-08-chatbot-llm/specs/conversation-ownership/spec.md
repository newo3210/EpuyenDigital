## ADDED Requirements

### Requirement: Claim pauses the bot
When a conversation gains a human owner through claim or ensure-owner-for-reply, the system SHALL set `bot_state` to `paused` and append a `BOT_PAUSED` conversation event when the previous state was not already `paused`.

#### Scenario: Claim writes BOT_PAUSED
- **WHEN** an operator claims an unowned conversation with `bot_state = active`
- **THEN** `bot_state` becomes `paused` and a `BOT_PAUSED` event exists

### Requirement: Resolve can resume the bot
When a conversation is resolved and the org bot is not globally paused, the system SHALL set `bot_state` to `active` and append `BOT_RESUMED` when resuming from `paused` or `handoff`.

#### Scenario: Resolve resumes bot
- **WHEN** an operator resolves a claimed conversation and `bot_paused` is false
- **THEN** `bot_state` is `active` and a `BOT_RESUMED` event exists
