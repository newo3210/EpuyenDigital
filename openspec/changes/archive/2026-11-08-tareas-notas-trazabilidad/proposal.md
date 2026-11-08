## Why

Conversations and citizens already exist. Operators still cannot turn a chat into a follow-up that another area or an external WhatsApp contact owns, leave an internal note, or export a sealed history of what happened. Phase 5 is the work that makes every movement of a case durable.

Roadmap: **Phase 5 — Tareas, notas y trazabilidad** · Requirements: **TSK-01..TSK-12**, **AUD-01..AUD-04**.

## What Changes

- Tasks linked to a conversation and a citizen: kind, priority, due date, attachments, audience (`self` / `area` / `user` / `external`).
- Atomic task transitions with append-only `task_history`, cancel reasons, outcomes, reopen, and automatic abandon after `task_abandon_days`.
- External WhatsApp contacts per area and a command protocol (`ACEPTO` / `RECHAZO` / `LISTO` / `NO SE PUEDE`) on the shared line.
- Internal notes on a conversation, citizen, or task, with one-level replies, mentions, and convert-note-to-task.
- Sealed audit notes (hash + correlation id) for closes, cancels, and external closures. Case export for an operator.
- Citizen ficha timeline and citizen merge grow to include tasks and notes.
- Task board at `/tasks` and create-from-thread controls.

## Capabilities

### New Capabilities

- `task-lifecycle`: create, claim, delegate, accept, reject, start, complete, cancel, reopen, abandon; board and attachments.
- `task-external`: area external contacts and WhatsApp command protocol for external audience.
- `notes`: create notes, one-level replies, mentions, convert to task, sealed audit notes.
- `case-export`: export conversation + tasks + events + notes for one case.

### Modified Capabilities

- `citizen-profile`: timeline SHALL include notes and tasks once those tables exist.
- `citizen-merge`: merge SHALL move tasks and notes to the kept citizen.
- `whatsapp-inbound`: an inbound from a known external contact phone SHALL route to the task protocol and SHALL NOT create a citizen conversation or enqueue the pet bot.

## Impact

- Migration after `20261108120000_pobladores_ficha.sql`: enums, `external_contacts`, `tasks`, `task_history`, `task_files`, `notes`, `note_reads`, `entity_mentions`, `task_abandon_days` on `org_settings`, definer functions, RLS, optional pg_cron for abandon.
- Worker: parse external commands; notify job; optional citizen close message.
- `apps/web`: replace `/tasks` placeholder, thread create/list, notes UI, admin external contacts, export action.
- Root docs: `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`, `docs/data-model.md`, `docs/flows.md`.
- Live `supabase test db` stays an honest gap when Docker is absent.

## Deferred (recorded)

- LLM bot creating tasks or notes (Phase 6, BOT).
- Panel media send for arbitrary files outside task attachments (WA-08) and the send_mode chooser (WA-11).
- Metrics dashboards (OPS).
