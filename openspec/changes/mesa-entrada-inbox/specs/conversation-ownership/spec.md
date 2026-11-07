## ADDED Requirements

### Requirement: Claim unowned conversation
An operator with access to the conversation’s area SHALL claim an unowned conversation. Claim SHALL set `owner_user_id`, pause bot (`bot_state = paused`), set queue column to claimed (or equivalent), and append a CLAIMED event. Concurrent claims SHALL yield CLAIM_CONFLICT for losers.

#### Scenario: Successful claim
- **WHEN** an operator claims an unowned conversation in their area
- **THEN** they become owner, bot is paused, and a CLAIMED event exists

#### Scenario: Claim conflict
- **WHEN** two operators claim the same unowned conversation concurrently
- **THEN** exactly one succeeds and the other receives a CLAIM_CONFLICT error

### Requirement: Reply claims or accepts
Sending a reply on an unowned conversation SHALL claim it. Sending a reply while the operator is the pending delegation target SHALL accept the delegation. Replying when another operator owns the conversation SHALL be blocked with a clear conflict message.

#### Scenario: Reply on unowned claims
- **WHEN** an operator sends text on an unowned conversation
- **THEN** they become owner before/with the outbound send and a CLAIMED (or equivalent) event is recorded

#### Scenario: Reply blocked for other owner
- **WHEN** operator B tries to reply while operator A owns the conversation without pending acceptance for B
- **THEN** the send is rejected naming the current owner

### Requirement: Delegate to user or area
The owner SHALL delegate to another operator or to an area with a note. User delegation sets awaiting acceptance on the target. Area delegation clears owner, sets `pending_area_id`, and awaits claim-as-accept by an area member (area_lead may reject).

#### Scenario: Delegate to user
- **WHEN** owner A delegates to operator B with a note
- **THEN** B sees awaiting acceptance, A remains visible as delegator, and a DELEGATED event stores the note

#### Scenario: Accept and reject user delegation
- **WHEN** B accepts, B becomes owner with ACCEPTED event; **WHEN** B rejects with a reason, ownership returns to A with REJECTED event
