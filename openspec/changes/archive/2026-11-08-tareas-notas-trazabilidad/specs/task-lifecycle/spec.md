## ADDED Requirements

### Requirement: Create a task from a conversation
An operator, area lead, or admin SHALL create a task linked to a conversation and its citizen in one action. The task SHALL store `kind`, `priority`, optional `due_at`, optional body, and an audience of `self`, `area`, `user`, or `external`. Support SHALL NOT create tasks. The create SHALL write a `CREATED` row in `task_history` in the same transaction.

#### Scenario: Create for myself
- **WHEN** an operator creates a task with audience `self` from an open conversation
- **THEN** a task exists linked to that conversation and citizen, the creator is the assignee, and a `CREATED` history row exists

#### Scenario: Support cannot create
- **WHEN** a support user calls create task
- **THEN** the database rejects the call and no task row exists

### Requirement: Area bag and person delegation
A task with audience `area` SHALL sit unassigned in that area until a member claims it. A task with audience `user` SHALL await acceptance by the target user. Rejecting SHALL require a non-empty note and return the task to the delegator.

#### Scenario: Claim from area bag
- **WHEN** an operator who belongs to area X claims a pending area task for X
- **THEN** the operator is the assignee, status is `in_progress`, and a `CLAIMED` history row exists

#### Scenario: Reject person delegation
- **WHEN** the target user rejects a pending user-audience task with a note
- **THEN** the task returns to the delegator and a `REJECTED` history row stores the note

### Requirement: Complete, cancel, reopen
`complete_task` SHALL require a `task_outcome` and set `completed_by`. `cancel_task` SHALL require a catalog `cancel_reason` and, when the reason is `other`, a non-empty text. A done or cancelled task SHALL reopen to `pending`. Support SHALL NOT complete, cancel, or reopen.

#### Scenario: Complete with outcome
- **WHEN** the assignee completes a task with outcome `resolved`
- **THEN** status is `done`, `completed_by` is the assignee, and a `COMPLETED` history row exists

#### Scenario: Cancel without reason rejected
- **WHEN** an operator cancels without a cancel reason
- **THEN** the call is rejected and the task status is unchanged

### Requirement: Automatic abandon
Open tasks whose `last_activity_at` is older than `org_settings.task_abandon_days` SHALL be cancelled with outcome `abandoned` by `abandon_stale_tasks`, with an `ABANDONED` history row and actor `system`.

#### Scenario: Stale task abandoned
- **WHEN** abandon runs and a pending task is older than the configured days
- **THEN** the task is `cancelled` with outcome `abandoned`

### Requirement: Task board
Operators SHALL see a board of tasks filtered by status and area without downloading every task of the organization into the browser. Overdue tasks SHALL be marked. Support SHALL see the board read-only.

#### Scenario: Filter by area
- **WHEN** an operator opens `/tasks` with an area filter
- **THEN** only tasks for that area that the operator may see are listed
