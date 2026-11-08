## Context

`whatsapp-channel-core` (archived, PR #6) created `conversations` and org-wide SELECT on conversations and messages. Writes go through the service role. Columns for owner, delegation, queue, and `sla_due_at` exist and are unused. Areas already store `sla_warning_minutes` and `sla_critical_minutes` (`municipal-areas`: store only). `/inbox` is a flat list plus a text composer.

Product design to follow: `docs/flows.md` §3–4, `docs/data-model.md` §5 and §10–11, `docs/reuse-from-seguros.md` §2. Port the claim/delegate shape from the reference CRM migrations named there, with area delegation and unambiguous return columns from the start. Do not port in-memory queue sort or "delete conversation".

## Goals / Non-Goals

**Goals:**

- INB-01..INB-15 on the existing conversation rows.
- Manual area change, delivery ticks, thread media, inquiry vs home coordinates.
- Area RLS without reopening direct client writes.
- Business-hours SLA using the area minute columns.

**Non-Goals:**

- WA-08 media send from the panel. WA-11 send_mode admin screen.
- Gating pet `process_inbound` on area. The shared line's default area is Mesa de Entrada; stopping the pet job unless the area is Inspectoría would silence the live registry. Manual area change is a human label only.
- Tasks, citizen edit, LLM classification, drag-and-drop kanban, a map tile SDK.

## Decisions

### D1 — Security definer transitions, no client writes

Data-model text says security invoker. Invoker plus an UPDATE policy lets any visible operator forge `owner_user_id`. Invoker plus no UPDATE policy cannot write. This change uses `SECURITY DEFINER` functions with `search_path = ''`, `auth.uid()` checks, and explicit org/area rules. Authenticated role gets `EXECUTE` and no INSERT/UPDATE/DELETE on `conversations`, `messages`, or `conversation_events`.

Functions (all raise `P0001` with a stable `hint` code):

| Function | Who | Hint codes |
|---|---|---|
| `claim_conversation(id)` | visible operator, row unowned, not resolved | `CLAIM_CONFLICT`, `FORBIDDEN`, `NOT_FOUND` |
| `ensure_owner_for_reply(id)` | same visibility; unowned → claim; pending for caller → accept; self owner → no-op; other owner → fail | `CLAIM_CONFLICT`, `NOT_OWNER`, `FORBIDDEN` |
| `delegate_conversation(id, target_user, target_area, note)` | owner; exactly one target; note trimmed non-empty | `NOT_OWNER`, `INVALID_TARGET`, `NOTE_REQUIRED` |
| `accept_conversation_delegation(id)` | pending user owner, or member of `pending_area_id` | `NOT_ASSIGNEE`, `FORBIDDEN` |
| `reject_conversation_delegation(id, note)` | pending user, or `area_lead` of pending area; note required | `NOT_ASSIGNEE`, `NOTE_REQUIRED` |
| `move_conversation(id, column)` | owner or admin; column in `claimed`, `in_progress`, `waiting_external`; source not resolved | `NOT_OWNER`, `INVALID_COLUMN` |
| `resolve_conversation(id)` | owner or admin | `NOT_OWNER` |
| `reopen_conversation(id, at timestamptz)` | service role (webhook) or the function owner; used only from inbound persist | `NOT_FOUND` |
| `set_conversation_area(id, area_id)` | owner or admin; area active, same org | `NOT_OWNER`, `INVALID_AREA` |

`RETURNS TABLE` columns are prefixed (`result_conversation_id`, `result_owner_user_id`, `result_queue_column`) so PL/pgSQL does not collide with table columns (CRM bug cited in the reuse map).

Claim sets `bot_state = paused` and writes `CLAIMED` then `BOT_PAUSED`. Resolve sets `bot_state = active`, `resolved_at`, `resolved_by`, clears `awaiting_acceptance`, writes `RESOLVED` then `BOT_RESUMED`. Reopen sets column `new`, owner null, `entered_queue_at = at`, `bot_state = active`, writes `REOPENED`. Area change writes `AREA_CHANGED` and does not touch citizen coordinates.

### D2 — Queue read model in SQL

Add on `conversations`: `last_message_preview text`, `last_message_kind text`, `has_attachments boolean not null default false`. Inbound and outbound persist paths update them (preview capped at 140 characters, no phone or DNI pasted into logs).

`list_inbox_queue(...)` returns visible non-resolved rows already ordered:

1. `owner_user_id is null` first
2. unowned: `entered_queue_at` ascending
3. owned: `last_inbound_at` descending
4. `needs_response` desc
5. critical (`sla_due_at <= now()`) desc

Filters are parameters, AND-combined. Default excludes `resolved`.

### D3 — SLA clock

Add `organizations.timezone text not null default 'America/Argentina/Buenos_Aires'`.
Add `org_settings.business_hours jsonb` and `org_settings.holidays date[] not null default '{}'`.

Seed shape: Mon–Fri `[["08:00","14:00"]]`, Sat/Sun `[]`. Admin edits this on a small settings form (not a new area screen).

Anchor is `last_inbound_at` while `needs_response` is true. `sla_due_at = add_business_minutes(last_inbound_at, sla_critical_minutes, hours, holidays, timezone)`. Null critical → null due. Warning and critical badges compare elapsed business minutes to the area thresholds. FIFO stays on `entered_queue_at`.

SQL `public.add_business_minutes` and `public.business_minutes_between` are the source of truth. `packages/shared` mirrors them for Vitest with the same fixtures:

- Friday 13:00 ART + 120 minutes, hours 08:00–14:00, weekend closed → Monday 09:00 ART (60 minutes left on Friday, 60 on Monday)
- A holiday date is skipped like a weekend
- Null minutes → null due

Webhook/inbound TS calls the SQL function (or writes the timestamp the SQL function returns) so there is one clock.

### D4 — RLS

SELECT conversations for `authenticated`:

- role `admin` or `support`: `org_id = current_org_id()`
- else: org matches AND (`area_id` in `current_area_ids()` OR `pending_area_id` in `current_area_ids()` OR `owner_user_id = auth.uid()` OR `delegated_from_user_id = auth.uid()`)

SELECT messages: parent conversation visible.
SELECT events and reads: parent conversation visible.
`conversation_reads`: operator may insert/update only their own `(conversation_id, user_id)` row when they can see the conversation. No delete.
`quick_replies`: org read for active members; insert/update admin only.
`conversation_events`: no policies for insert/update/delete to `authenticated`.

Support check inside mutators: `current_user_role() = 'support'` → `FORBIDDEN`.

### D5 — Composer

`apps/web/src/features/outbound/actions.ts` calls `ensure_owner_for_reply` with the user-scoped server client before the service-role persist/send. Failure returns before Evolution. Copy in `es-AR` uses the owner name from the function result.

### D6 — Reopen hook

`apps/web/src/infrastructure/supabase-inbound-store.ts`: after identifying an existing conversation in `resolved`, call `reopen_conversation` as part of the same service-role flow that inserts the message. Idempotent replay of the same `external_id` must not insert a second `REOPENED`. Keep `process_inbound` enqueue.

### D7 — Thread UI

Presentation stays dumb. Server page loads the queue, thread, events, quick replies, and signed URLs.

- Media: signed URL from `whatsapp-media` (short TTL). Image/sticker `<img>`, audio `<audio controls>`, document link. Sign failure → kind label.
- Ticks: text label from `delivery_status`, plus time when `delivered_at` / `read_at` exist. Not color-only.
- Coordinates: inquiry rows link to `https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=16/{lat}/{lng}`. Citizen lat/lng rendered once as "Domicilio / mascota". No Leaflet dependency.
- Quick replies: `/settings/quick-replies` admin CRUD. Composer inserts body only.
- Layout: list plus thread, usable at tablet width. Column changes are buttons, not a kanban.

Realtime: add `conversations`, `messages`, and `conversation_events` to `supabase_realtime`. A client hook on the inbox layout applies inserts to the open thread and refreshes the queue list query without `location.reload`. Badge count is unread inbound for me plus awaiting my acceptance. Sound is a local preference defaulting to off; play only after a user gesture enables it.

### D8 — Events

`conversation_events` append-only: `event_type` in `QUEUED`, `CLAIMED`, `MOVED`, `DELEGATED`, `ACCEPTED`, `REJECTED`, `RESOLVED`, `REOPENED`, `BOT_PAUSED`, `BOT_RESUMED`, `AREA_CHANGED`. Actor kind `operator` or `system`. Store `from_column`, `to_column`, `from_area_id`, `to_area_id`, `note`.

`conversation_reads` PK `(conversation_id, user_id)`.

`quick_replies`: `org_id`, `area_id` null, `shortcut`, `title`, `body`, `is_active`.

### D9 — Layer map

| Layer | Responsibility | Paths |
|---|---|---|
| Presentation | Queue, thread, badges, forms. No Supabase in components. | `apps/web/src/presentation/inbox/**`, `apps/web/src/app/(panel)/inbox/**`, `apps/web/src/app/(panel)/settings/quick-replies/**` |
| Application | Claim/delegate/move/resolve/area/read/quick-reply use cases; composer orchestration | `apps/web/src/features/inbox/**`, changes in `apps/web/src/features/outbound/actions.ts` |
| Infrastructure | Repositories, realtime client, inbound reopen, signed URLs | `apps/web/src/infrastructure/repositories/inbox*.ts`, `supabase-inbound-store.ts` |
| Contracts | Zod for delegate, move, quick reply, filters | `apps/web/src/contracts/inbox.ts` or `packages/shared` if the worker must share them (worker does not) |
| Database | Functions, RLS, SLA | `supabase/migrations/20261107120000_mesa_entrada_inbox.sql`, `supabase/tests/007_inbox_triage.test.sql` |
| Shared algorithm | Business minutes mirror for unit fixtures | `packages/shared/src/domain/business-minutes.ts` |

Zod boundaries: server actions parse delegate/move/area/quick-reply payloads before calling SQL. No LLM output in this change.

## Risks / Trade-offs

- [No Docker in the agent] → pgTAP is committed; the verification report states `NO_DOCKER` if `supabase test db` cannot run. Vitest covers the TS clock and SQL text contracts the way areas did.
- [Definer functions are a wide door if checks are sloppy] → every function checks `auth.uid()`, role, and visibility before `FOR UPDATE`. SQL tests cover cross-org and cross-area.
- [Two SLA implementations drift] → SQL is authoritative; TS tests use the published fixtures; inbound writes due time via SQL.
- [Pet bot still answers Mesa traffic] → explicit non-goal, recorded again in the student log. Area routing does not fix it.
- [Realtime publication missing in some local setups] → UI still loads on request; the report says so if the publication cannot be proven.

## Rollback

The migration is additive (new tables, columns, functions, tighter SELECT). Rolling back means a down migration that restores org-wide conversation SELECT and drops the functions. Do not drop `conversations`.
