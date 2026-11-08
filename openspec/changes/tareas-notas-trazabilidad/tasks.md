## 0. Branch

- [ ] 0.1 Branch `cursor/tareas-notas-3654` from `main` (this plan commit). No production code before this artifact is approved.

## 1. Database — tasks, notes, audit (TDD)

- [ ] 1.1 Failing Vitest contract on the migration SQL: tables, enums, definer transitions, revoke of authenticated writes, seal trigger, external-contact unique phone.
- [ ] 1.2 Migration: `external_contacts`, `tasks`, `task_history`, `task_files`, `notes`, `note_reads`, `entity_mentions`, `org_settings.task_abandon_days`.
- [ ] 1.3 Task definer functions: create, claim, delegate, accept, reject, start, complete, cancel, reopen, abandon. Hint codes from design D1.
- [ ] 1.4 Note create/reply, mention sync, convert-to-task, `seal_audit_note`, immutable sealed rows.
- [ ] 1.5 RLS: area/assignee/creator visibility for tasks; note visibility follows the linked entity; support read-only.
- [ ] 1.6 Extend `merge_citizens` and `list_citizen_timeline` for tasks and notes.
- [ ] 1.7 `supabase/tests/009_tasks_notes.test.sql`: create+history, support forbidden, claim conflict, cancel without reason, sealed immutability, external phone uniqueness.
- [ ] 1.8 Make unit tests pass. Record live `supabase test db` or an honest `NO_DOCKER` gap.

## 2. Application services (TDD)

- [ ] 2.1 Zod contracts for task create/delegate/complete/cancel, notes, external contacts, export.
- [ ] 2.2 Use cases call the SQL functions with the user-scoped server client. Map hint codes to es-AR.
- [ ] 2.3 Worker: `external.notify` job and inbound command parser. External phones skip citizen stub and pet job.
- [ ] 2.4 Optional citizen notify on resolved close through the existing outbound path.

## 3. UI

- [ ] 3.1 `/tasks` board with status and area filters. Overdue marked. Support has no mutating controls.
- [ ] 3.2 Create task from the conversation thread. Attachments via `task_files` when storage is available.
- [ ] 3.3 Notes on thread, ficha, and task. One-level replies. Convert note to task.
- [ ] 3.4 Admin settings for external contacts. Export case download.
- [ ] 3.5 Presentation components do not import Supabase. Copy in `es-AR`.

## 4. Root docs

- [ ] 4.1 Update `ARCHITECTURE_SDD.md` (English): tasks, notes, external protocol, seals, export.
- [ ] 4.2 Update `STUDENT_DECISION_LOG.md` (Spanish): why definer transitions, why external bypasses the citizen path, why sealed notes.
- [ ] 4.3 Update `docs/data-model.md` and `docs/flows.md` marks for implemented columns and the definer correction.

## 5. Mandatory verification

- [ ] 5.1 Review inbound tests so an external phone does not create a citizen.
- [ ] 5.2 Run unit tests and record database notes in `reports/YYYY-MM-DD-step-5.2-unit-test-and-db-verification.md`.
- [ ] 5.3 Curl task and note paths (or the documented blocker) in `reports/YYYY-MM-DD-step-5.3-curl-manual.md`.
- [ ] 5.4 Browser pass for create-from-thread, board claim, note, and export, in `reports/YYYY-MM-DD-step-5.4-e2e-browser.md`.
- [ ] 5.5 Acceptance matrix from the specs. Do not archive in this task list.

## 6. Explicitly not in this change

- [ ] 6.1 Do not build the LLM bot task/note authors.
- [ ] 6.2 Do not build OPS metrics dashboards.
- [ ] 6.3 Do not implement WA-08 panel media send or WA-11 send_mode chooser.
