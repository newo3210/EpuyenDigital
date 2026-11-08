# Acceptance Matrix (implementer draft)

Scenarios are copied from `openspec/changes/pobladores-ficha/specs/**/spec.md`.

**Change:** pobladores-ficha
**Date:** 2026-11-08
**Author:** apply session. This is not the independent review. Live SQL and the signed-in browser are BLOCKED (NO_DOCKER).

## Scenarios

### Scenario: Operator saves a name from the thread

- **WHEN** an operator opens a conversation and saves a new full name on that citizen
- **THEN** `full_name` is the new value and `field_sources.full_name` is `manual`

**Evidence:** The thread page renders `CitizenFicha` with `updateCitizenProfileAction`, which calls `update_citizen_profile`. That function sets `app.citizen_field_write = operator` and writes `field_sources.full_name = manual` when the name is non-empty. Not executed against Postgres. Result: BLOCKED.

### Scenario: Support cannot save

- **WHEN** a support user submits a profile update
- **THEN** the database rejects the call and the row is unchanged

**Evidence:** `update_citizen_profile` calls `citizen_assert_editor`, which raises `FORBIDDEN` when `current_user_role()` is `support`. pgTAP asserts `throws_ok` P0001 / FORBIDDEN. Render test hides the save button. pgTAP not executed. Result: BLOCKED.

### Scenario: Pet write does not replace a manual name

- **WHEN** the pet worker updates `full_name` on a citizen whose `field_sources.full_name` is `manual`
- **THEN** `full_name` remains the manual value

**Evidence:** Trigger restores `new.full_name := old.full_name` unless the session flag is `operator`. pgTAP updates the row without that flag and expects `Ana`. Shared unit test mirrors the same rule. pgTAP not executed. Result: BLOCKED for the database, unit mirror PASS.

### Scenario: Push name stays on its own column

- **WHEN** an inbound message includes a pushName for a citizen who already has a manual full name
- **THEN** `whatsapp_push_name` may change and `full_name` stays the manual value

**Evidence:** `upsertCitizenStub` assigns `whatsapp_push_name` and the function body has no `full_name` assignment. Memory inbound test asserts the stub object has no `fullName`. The trigger also restores a manual `full_name` if a writer sends one. Result: PASS for the stub source. Live row BLOCKED.

### Scenario: Person with name, DNI, and phone

- **WHEN** an operator registers a person who has a name, a document id, and a phone
- **THEN** `registration_status` is `registered` and the queue card shows the registered label

**Evidence:** `register_citizen` sets `registration_status`, `registered_at`, and `registered_by` when name, document, and a phone exist. The queue already selects `registration_status`. Register revalidates `/inbox`. Not executed. Result: BLOCKED.

### Scenario: Person missing DNI

- **WHEN** an operator registers a person whose `document_id` is null
- **THEN** the call is rejected and `registration_status` stays `unregistered`

**Evidence:** SQL raises `MISSING_FIELDS` before the update when `party_kind` is not `organization` and `document_id` is blank. Not executed. Result: BLOCKED.

### Scenario: Organization without DNI

- **WHEN** an operator registers an organization that has a name and a phone and a null document id
- **THEN** `registration_status` is `registered`

**Evidence:** The DNI check is skipped when `party_kind` is `organization`. Not executed. Result: BLOCKED.

### Scenario: Unregistered person missing DNI

- **WHEN** an operator opens a person with a name and a phone and a null document id
- **THEN** the ficha lists DNI as required and does not list the name or the phone as required

**Evidence:** `citizenFieldGaps` unit test and `CitizenFicha` render. Result: PASS.

### Scenario: Switch to organization

- **WHEN** an operator sets the party kind to organization and saves
- **THEN** `party_kind` is `organization` and `field_sources.party_kind` is `manual`

**Evidence:** The profile form posts `partyKind`. The function rejects values other than `person` or `organization` and always sets `party_kind` source to `manual`. Not executed. Result: BLOCKED.

### Scenario: Message and animal both appear

- **WHEN** a citizen has one conversation message and one animal
- **THEN** the timeline shows both records

**Evidence:** `CitizenFicha` render shows `hola` and `Lola`. The repository selects `messages`, `conversation_events`, and `animals`. Live query BLOCKED. Render: PASS.

### Scenario: No notes table

- **WHEN** the operator opens any ficha
- **THEN** the page does not read or write a notes or tasks table

**Evidence:** `migration-sql.test.ts` reads `repositories/citizens.ts` and asserts it does not call `from('notes')` or `from('tasks')`. Result: PASS.

### Scenario: DNI fragment

- **WHEN** an operator searches a digit sequence that is contained in one citizen's `document_id`
- **THEN** that citizen is in the results

**Evidence:** `search_citizens` uses `document_id ilike` with escaped `%`, `_`, and `\`, limit 20. The page calls the RPC only when `q` is non-empty. Not executed. Result: BLOCKED.

### Scenario: Phone fragment

- **WHEN** an operator searches a fragment of a normalized phone on `citizen_phones`
- **THEN** the citizen who owns that phone is in the results

**Evidence:** The same function matches `citizen_phones.phone_normalized`. Not executed. Result: BLOCKED.

### Scenario: Empty query

- **WHEN** the operator opens `/citizens` with an empty query
- **THEN** no citizen rows are listed

**Evidence:** The page skips `search_citizens` when `q` is blank and renders the prompt. The SQL function returns immediately on a blank query. Page branch not rendered in jsdom. Result: BLOCKED for the route, SQL source PASS.

### Scenario: Other organization

- **WHEN** an operator of organization B searches a name that exists only in organization A
- **THEN** the result is empty

**Evidence:** pgTAP signs in as org B and expects `search_citizens('Ana')` to return 0. Org B's fixture citizen is named Carla. Not executed. Result: BLOCKED.

### Scenario: Merged row hidden

- **WHEN** a citizen has `merged_into_id` set and the operator searches that citizen's name
- **THEN** that dropped row is not in the results

**Evidence:** SQL filters `merged_into_id is null`. Not executed. Result: BLOCKED.

### Scenario: Phone and conversation move

- **WHEN** an operator merges citizen B into citizen A with a note
- **THEN** B's phone and B's conversations reference A, and B's `merged_into_id` is A

**Evidence:** pgTAP expects the phone and the conversation to point at A after `merge_citizens`. The update sets `merged_into_id`. Not executed. Result: BLOCKED.

### Scenario: Empty note rejected

- **WHEN** an operator merges with an empty note
- **THEN** both rows are unchanged

**Evidence:** SQL raises `NOTE_REQUIRED` when `regexp_replace` of the note is empty, before any update. Zod also requires a non-empty note. Not executed. Result: BLOCKED.

### Scenario: Support cannot merge

- **WHEN** a support user calls merge
- **THEN** the database rejects the call and both rows are unchanged

**Evidence:** `merge_citizens` calls `citizen_assert_editor` first. The ficha hides the merge form when `canMutate` is false. Live call not executed. Result: BLOCKED.

### Scenario: Second merge of the same drop

- **WHEN** an operator merges B into A and then tries to merge B into C
- **THEN** the second call is rejected and B still points at A

**Evidence:** pgTAP `throws_ok` NOT_FOUND on the second merge. Not executed. Result: BLOCKED.

### Scenario: Shared phone

- **WHEN** A and B both have the same normalized phone and the operator merges B into A
- **THEN** A has that phone once and the merge commits

**Evidence:** SQL deletes the drop phone that matches a keeper phone before reassigning the rest. The unique `(org_id, phone_normalized)` would otherwise abort the transaction. Not executed. Result: BLOCKED.

### Scenario: Cross-organization pair

- **WHEN** an operator selects a citizen from another organization as the drop
- **THEN** the merge is rejected

**Evidence:** `citizen_visible` raises `NOT_FOUND` when `org_id` is not `current_org_id()`. Not executed. Result: BLOCKED.

### Scenario: New phone creates unregistered citizen

- **WHEN** an unknown normalized phone messages the line
- **THEN** an unregistered citizen and citizen_phones row exist linked to the conversation

**Evidence:** Existing channel behavior. `upsertCitizenStub` inserts `registration_status = unregistered` and `party_kind = person`. Not re-run against Postgres. Result: BLOCKED.

### Scenario: Repeat inbound keeps a manual name

- **WHEN** a known citizen with a manual `full_name` sends another message that includes a different pushName
- **THEN** `whatsapp_push_name` may update and `full_name` is unchanged

**Evidence:** Same as the push-name scenario. Stub source PASS. Live row BLOCKED.

## Summary

| Total | Pass | Fail | Blocked |
|---|---|---|---|
| 24 | 4 | 0 | 20 |

Pass rows are the render and source checks (missing DNI list, timeline render, no notes table, stub does not assign `full_name`). The other 20 need a database or a signed-in browser.

**Verdict:** BLOCKED (NO_DOCKER). No failing scenario was observed in the checks that could run.
