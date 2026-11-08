# citizen-merge Specification

## Purpose
Merge duplicate citizens while keeping the dropped row. Landed by archiving `pobladores-ficha` (2026-11-08).

## Requirements

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

### Requirement: Merge is idempotent and same-org
Merging a citizen into itself SHALL be rejected. Merging a citizen that already has `merged_into_id` SHALL be rejected. A phone that the keeper already has SHALL NOT violate the org phone uniqueness: the duplicate phone row is removed and the keeper keeps one row. Citizens of two organizations SHALL NOT be merged.

#### Scenario: Second merge of the same drop
- **WHEN** an operator merges B into A and then tries to merge B into C
- **THEN** the second call is rejected and B still points at A

#### Scenario: Shared phone
- **WHEN** A and B both have the same normalized phone and the operator merges B into A
- **THEN** A has that phone once and the merge commits

#### Scenario: Cross-organization pair
- **WHEN** an operator selects a citizen from another organization as the drop
- **THEN** the merge is rejected
