# bot-decision Specification

## Purpose
TBD - created by archiving change chatbot-llm. Update Purpose after archive.

## Requirements

### Requirement: Bot answers from knowledge with citations
When eligible, `bot_reply` SHALL answer using retrieved knowledge chunks and SHALL include source citations in the outbound text and in `bot_runs.sources`. It SHALL NOT invent municipal policy outside retrieved content. Empty retrieval or confidence below threshold SHALL hand off with reason `low_confidence`.

#### Scenario: Answer cites a document
- **WHEN** a neighbor asks a question covered by an indexed FAQ
- **THEN** the outbound reply cites that document and `bot_runs.decision` is `answered`

#### Scenario: Low confidence hands off
- **WHEN** retrieval confidence is below the configured threshold
- **THEN** the bot sends at most one clarification or hands off with `low_confidence`, and does not invent an answer

### Requirement: Human ownership silences the bot
While a conversation has a human owner or `bot_state` is `paused` or `handoff`, `bot_reply` SHALL record `silent` and SHALL NOT send a citizen-facing answer. Global `bot_paused` or `BOT_KILL_SWITCH` SHALL likewise force silent (and SHALL leave or place the conversation in queue without a new answer).

#### Scenario: Claimed thread is silent
- **WHEN** an operator has claimed the conversation and the neighbor writes again
- **THEN** `bot_runs.decision` is `silent` and no bot WhatsApp text is sent

### Requirement: Privacy notice on first contact
On the first eligible inbound for a conversation, before other Q&A, the bot SHALL send the privacy notice (Ley 25.326) once and record that fact so it is not repeated for that conversation.

#### Scenario: First message gets privacy
- **WHEN** a new conversation receives its first citizen text and the bot is eligible
- **THEN** the privacy notice is sent once and subsequent turns do not resend it

### Requirement: Out of hours informs and hands off
Outside business hours the bot SHALL send the out-of-hours message, hand off with reason `out_of_hours`, and leave the case in queue.

#### Scenario: Message after hours
- **WHEN** a citizen writes outside configured business hours and the bot is eligible
- **THEN** they receive the hours message and the conversation is queued for humans

### Requirement: Handoff ack is once per episode
When handing off, the bot SHALL send a single citizen acknowledgement for that queue episode. Additional citizen messages during the same handoff episode SHALL NOT send another ack.

#### Scenario: Second message during handoff
- **WHEN** the bot already handed off and the citizen writes again before a human claims
- **THEN** no second handoff ack is sent and `bot_runs.decision` is `silent` or equivalent non-ack
