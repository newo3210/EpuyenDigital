## Context

Inbox transitions and the citizen ficha are live. `/tasks` is an empty state. `docs/data-model.md` and `docs/flows.md` already describe tasks, notes, external contacts, and sealed audit notes. Conversation events already prove the append-only pattern. The data-model text still says `security invoker` for task functions; that pattern failed for inbox and MUST NOT be repeated.

## Goals / Non-Goals

**Goals:**

- An operator creates and advances a task from a conversation without forging history.
- An area bag and a person delegation mirror conversation ownership rules.
- An external WhatsApp contact can accept, reject, or close a task by text.
- Notes and sealed audit notes exist; the citizen timeline and merge include them.
- Support reads; support does not mutate.

**Non-Goals:**

- Bot-authored tasks or RAG summaries (Phase 6).
- Full OPS metrics screens.
- Editing or deleting sealed notes or `task_history` rows from the client.
- Meta Cloud API.

## Decisions

### D1 — SECURITY DEFINER transitions

`create_task`, `claim_task`, `delegate_task`, `accept_task`, `reject_task`, `start_task`, `complete_task`, `cancel_task`, `reopen_task`, and `abandon_stale_tasks` are `SECURITY DEFINER`, `search_path = ''`, check `auth.uid()` (except abandon, which is service/cron). Authenticated has no INSERT/UPDATE/DELETE on `tasks` or `task_history`. Hint codes reuse inbox style via `inbox_raise` or a shared `app_raise`: `FORBIDDEN`, `NOT_FOUND`, `NOTE_REQUIRED`, `CLAIM_CONFLICT`, `NOT_ASSIGNEE`, `INVALID_STATUS`, `INVALID_OUTCOME`, `CANCEL_REASON_REQUIRED`, `INVALID_TARGET`.

### D2 — Audience rules

| Audience | On create / delegate | Who advances |
|---|---|---|
| `self` | Owner is the creator; status can start `in_progress` | Owner |
| `area` | `area_id` set, `assigned_user_id` null | Any member of that area claims |
| `user` | Target user, `awaiting_acceptance` | Target accepts or rejects with a note |
| `external` | `external_contact_id` + `area_id`, enqueue `external.notify` | External commands or an operator reclaim |

Visibility: admin and support see the org. Area lead and operator see tasks in `current_area_ids()`, tasks assigned to them, tasks they created, and tasks they delegated. Same idea as the inbox, with an explicit creator exception so `self` tasks stay visible.

### D3 — Outcomes and cancel reasons

`complete_task` requires `task_outcome`. `cancel_task` requires `cancel_reason`; if `other`, a non-empty text (same whitespace trim as inbox notes). Abandon sets `cancelled` + `outcome = abandoned` and writes `ABANDONED`.

### D4 — External protocol

`external_contacts` are org-scoped, unique on `(org_id, phone_normalized)`, belong to an area. Inbound webhook: if the phone matches an active external contact, route to the task command parser and do not upsert a citizen stub, conversation, or `process_inbound` job. Commands (case/accent insensitive): `ACEPTO <ref>`, `RECHAZO <ref> <motivo>`, `LISTO <ref> <detalle>`, `NO SE PUEDE <ref> <motivo>`. `public_ref` is a short code like `T-0123`. Unknown text gets a help reply once per message.

### D5 — Notes and seals

`notes` attach to at least one of conversation, citizen, or task. Replies are one level (`parent_note_id`). Mentions go through `entity_mentions` written in the same transaction as the note. `seal_audit_note` (service role / definer) sets `correlation_id`, `sealed_at`, `content_hash`, `seal_method`. A sealed row rejects UPDATE/DELETE from every client role. Convert-note-to-task creates a task and links the note.

### D6 — Abandon and notify

`org_settings.task_abandon_days` (positive int, seed a municipal default such as 14). `abandon_stale_tasks()` runs daily (pg_cron when available; otherwise a documented worker tick). If `notify_citizen_on_close` and outcome is `resolved`, enqueue an outbound text on the source conversation after `ensure_owner` rules do not apply to system sends — use the existing outbound path with `sender_kind = system`.

### D7 — Export

`export_case(conversation_id)` returns a structured JSON (and the UI offers download) with conversation summary, messages metadata (not raw media bytes), events, tasks + history, and notes. Read checks conversation visibility. Support may export.

### D8 — Paths

| Layer | Paths |
|---|---|
| Presentation | `presentation/tasks/**`, `presentation/notes/**`, `(panel)/tasks`, thread panels, settings external contacts |
| Application | `features/tasks/**`, `features/notes/**` |
| Infrastructure | `repositories/tasks.ts`, `repositories/notes.ts`, inbound external router |
| Contracts | `contracts/tasks.ts`, `contracts/notes.ts` |
| Database | `supabase/migrations/20261108180000_tareas_notas_trazabilidad.sql`, `supabase/tests/009_tasks_notes.test.sql` |

### D9 — Merge and timeline

Extend `merge_citizens` to reassign `tasks.citizen_id` and `notes.citizen_id`. Extend `list_citizen_timeline` to include notes and tasks. Do not query those until the tables exist in this change.

## Risks / Trade-offs

- External inbound must be detected before the citizen stub path; a missed check creates a fake poblador for a municipal contact.
- pg_cron may be unavailable locally; abandon needs a worker fallback and an honest NO_DOCKER note.
- Sealed notes need a clear operator UX: visible, not editable.
- Task board filters must not download every org task into the browser when the table grows.
