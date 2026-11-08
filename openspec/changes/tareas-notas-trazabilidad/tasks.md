## 0. Branch

- [x] 0.1 Branch `cursor/tareas-notas-3654` from `main` (this plan commit). No production code before this artifact is approved.

## 1. Database — tasks, notes, audit (TDD)

- [x] 1.1 Failing Vitest contract on the migration SQL: tables, enums, definer transitions, revoke of authenticated writes, seal trigger, external-contact unique phone.
- [x] 1.2 Migration: `external_contacts`, `tasks`, `task_history`, `task_files`, `notes`, `note_reads`, `entity_mentions`, `org_settings.task_abandon_days`.
- [x] 1.3 Task definer functions: create, claim, delegate, accept, reject, start, complete, cancel, reopen, abandon. Hint codes from design D1.
- [x] 1.4 Note create/reply, mention sync, convert-to-task, `seal_audit_note`, immutable sealed rows.
- [x] 1.5 RLS: area/assignee/creator visibility for tasks; note visibility follows the linked entity; support read-only.
- [x] 1.6 Extend `merge_citizens` and `list_citizen_timeline` for tasks and notes.
- [x] 1.7 `supabase/tests/009_tasks_notes.test.sql`: create+history, support forbidden, claim conflict, cancel without reason, sealed immutability, external phone uniqueness.
- [ ] 1.8 Make unit tests pass. Record live `supabase test db` or an honest `NO_DOCKER` gap.

## 2. Application services (TDD)

- [x] 2.1 Zod contracts for task create/delegate/complete/cancel, notes, external contacts, export.
- [x] 2.2 Use cases call the SQL functions with the user-scoped server client. Map hint codes to es-AR.
- [x] 2.3 Worker: `external.notify` job and inbound command parser. External phones skip citizen stub and pet job.
- [x] 2.4 Optional citizen notify on resolved close through the existing outbound path.

## 3. UI

- [x] 3.1 `/tasks` board with status and area filters. Overdue marked. Support has no mutating controls.
- [x] 3.2 Create task from the conversation thread. Attachments via `task_files` when storage is available.
- [x] 3.3 Notes on thread, ficha, and task. One-level replies. Convert note to task.
- [x] 3.4 Admin settings for external contacts. Export case download.
- [x] 3.5 Presentation components do not import Supabase. Copy in `es-AR`.

## 4. Root docs

- [x] 4.1 Update `ARCHITECTURE_SDD.md` (English): tasks, notes, external protocol, seals, export.
- [x] 4.2 Update `STUDENT_DECISION_LOG.md` (Spanish): why definer transitions, why external bypasses the citizen path, why sealed notes.
- [x] 4.3 Update `docs/data-model.md` and `docs/flows.md` marks for implemented columns and the definer correction.

## 5. Mandatory verification

- [x] 5.1 Review inbound tests so an external phone does not create a citizen.
- [x] 5.2 Run unit tests and record database notes in `reports/YYYY-MM-DD-step-5.2-unit-test-and-db-verification.md`.
- [x] 5.3 Curl task and note paths (or the documented blocker) in `reports/YYYY-MM-DD-step-5.3-curl-manual.md`.
- [x] 5.4 Browser pass for create-from-thread, board claim, note, and export, in `reports/YYYY-MM-DD-step-5.4-e2e-browser.md`.
- [x] 5.5 Acceptance matrix from the specs. Do not archive in this task list.

## 6. Explicitly not in this change

- [x] 6.1 Do not build the LLM bot task/note authors.
- [x] 6.2 Do not build OPS metrics dashboards.
- [x] 6.3 Do not implement WA-08 panel media send or WA-11 send_mode chooser.
