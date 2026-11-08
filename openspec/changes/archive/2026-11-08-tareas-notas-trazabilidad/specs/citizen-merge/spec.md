## MODIFIED Requirements

### Requirement: Merge keeps history on the chosen row
An operator, area lead, or admin SHALL merge two citizens of the same organization with a non-empty note. The dropped citizen's phones, conversations, animals, tasks, and notes SHALL reference the kept citizen. The dropped row SHALL remain and SHALL have `merged_into_id` set to the kept id. The function SHALL NOT delete the dropped row. Support SHALL NOT merge.

#### Scenario: Phone and conversation move
- **WHEN** an operator merges citizen B into citizen A with a note
- **THEN** B's phone and B's conversations reference A, and B's `merged_into_id` is A

#### Scenario: Task and note move
- **WHEN** citizen B has a task and a note and an operator merges B into A
- **THEN** those rows reference A after the merge

#### Scenario: Empty note rejected
- **WHEN** an operator merges with an empty note
- **THEN** both rows are unchanged

#### Scenario: Support cannot merge
- **WHEN** a support user calls merge
- **THEN** the database rejects the call and both rows are unchanged
