# Backend Standards

Applies to: Supabase (Postgres, Auth, Storage, Realtime), SQL migrations and functions, Next.js route handlers and server actions (server side), the `worker/` job consumer, Evolution API integration, and LLM services.

## 1. Technology Stack

| Concern | Choice |
|---|---|
| Runtime | Node >= 20 (local v24), TypeScript strict |
| Database | Supabase Postgres 15+ with `pg_trgm`, `vector` (pgvector), `pg_cron` |
| Auth | Supabase Auth (email + password), `@supabase/ssr` in Next.js |
| Storage | Supabase Storage, private buckets `whatsapp-media`, `task-files`, `knowledge-docs`; public `avatars` |
| Realtime | Supabase Realtime on `conversations`, `messages`, `tasks`, `conversation_events` |
| Validation | Zod at every boundary |
| WhatsApp | Evolution API v2 (self-hosted, Podman locally) |
| LLM | Provider-agnostic interface (`chat`, `embed`, `transcribe`, `vision`); provider decided in roadmap Phase 6 |
| Tests | Vitest (unit/integration), SQL tests in `supabase/tests/` (pgTAP via `supabase test db`) |

## 2. Layering (see base-standards §9)

```text
route handler / server action (thin)  →  features/<feature>/service  →  infrastructure/repositories  →  Supabase / Evolution / LLM
                     ↑ Zod contracts in contracts/ at each boundary
```

- Route handlers and server actions: parse input with Zod, resolve auth context, call one service function, map typed errors to responses. Max ~30 lines.
- Services: orchestrate; contain business rules and AI logic; depend on repository interfaces, not on Supabase clients directly.
- Repositories: one per aggregate (`conversationRepository`, `taskRepository`, `citizenRepository`…); only I/O and row ↔ domain mapping.
- Pure logic (phone normalization, SLA computation, queue ordering, command parsing for external contacts) lives in `packages/shared` and is unit-tested without I/O.

## 3. Database Conventions

- Tables `snake_case` plural; columns `snake_case`; enums `snake_case` type names with lowercase values (event enums in UPPER_CASE as in `docs/data-model.md`).
- Every business table: `id uuid primary key default gen_random_uuid()`, `org_id uuid not null`, `created_at timestamptz default now()`, `updated_at` maintained by trigger.
- One migration per logical change, timestamped (`YYYYMMDDHHMMSS_description.sql`), idempotent where possible (`if not exists`). Never edit an applied migration; add a new one.
- Indexes declared in the same migration as the query they support (queue ordering, trigram search, open-task horizons).
- Generate types after each migration (`supabase gen types typescript`) into `packages/shared/src/contracts/database.types.ts`.

## 4. State Transitions (SQL functions)

All conversation, task, and citizen-merge transitions follow this template:

1. `security invoker` (except audit sealing, which is `security definer` executable only by service role).
2. Filter by `current_org_id()`; verify caller permissions (role/area) explicitly.
3. `select ... for update` on the target row.
4. Validate expected state; raise typed errors (`raise exception 'CLAIM_CONFLICT'` etc.).
5. Update the row, insert the history/event row, update `last_activity_at` — same transaction.
6. `returns table(...)` with explicit, non-ambiguous column names (avoid the CRM bug where `RETURNS TABLE` shadowed `kanban_column`).

Error codes are stable English identifiers, mapped to es-AR copy in the frontend i18n module.

## 5. Row Level Security

- RLS enabled on every table, no exceptions.
- Helpers: `current_org_id()`, `current_user_role()`, `current_area_ids()` — `security definer`, `stable`, `set search_path = ''` (fully qualified names). Never name a helper `current_role()`: `CURRENT_ROLE` is a reserved SQL keyword.
- History/event/activity tables: `select` by entity visibility; `insert` only through functions; **no update/delete policies**. Sealed audit notes: trigger blocks update and delete.
- Secrets tables (`whatsapp_line_secrets`): RLS enabled with **no policies** (service role only).
- Every migration that adds a table adds its policies and a test in `supabase/tests/` proving cross-org and cross-area isolation.

## 6. Webhook (Evolution → panel)

- Route `POST /api/webhooks/evolution`, excluded from auth middleware.
- Resolve line by `instance`; missing/ambiguous instance → 404/503 fail closed.
- Secret mandatory: missing configured secret → 503; mismatch → 401; constant-time comparison.
- Normalize payload (Zod) → persist citizen/conversation/message idempotently (unique `(line_id, external_id)`) → enqueue jobs → respond 200. **No LLM calls, no media downloads, no outbound sends inside the webhook.**
- Ignore groups, broadcasts, newsletters. Resolve `@lid` JIDs. Persist `fromMe` as outbound `sender_kind = phone`.

## 7. Worker and Jobs

- `jobs` table consumed with `for update skip locked`; one handler per `job_type` in `worker/src/jobs/`.
- Handlers are idempotent (safe to re-run) and bounded by timeouts.
- Retries with exponential backoff up to `max_attempts`; final failure → `status = failed` + `error_logs` row with trace id.
- Service role credentials only in the worker and webhook; never exposed to the browser.

## 8. Outbound Messaging

- Single entry point `sendOutbound(...)` in the messaging service: normalize phone (`549…`) → send-mode guard (`dry_run` / `allowlist` / `production`) → owner check for operators (`ensure_owner_for_reply`) → Evolution adapter → persist message with `external_id`.
- Correct Evolution `mediatype` per content (`image`, `document`, `audio`); validate size/MIME before upload.
- Blocked sends persist `delivery_status = blocked` and an activity log entry.

## 9. LLM Services

- Prompts live in `worker/src/features/bot/prompts/` (or `packages/shared` if reused), versioned, in Spanish for the citizen-facing voice; system instructions may be English.
- Every call has: timeout, retry-once policy, Zod output schema, token/latency logging into `bot_runs`.
- RAG answers must cite chunk ids; if no chunk exceeds the confidence threshold → handoff (`low_confidence`), never free-form answers about municipal procedures.
- Data extracted from chat (name, DNI, address) is saved only after explicit citizen confirmation, with `field_sources = 'bot'`; `manual` values are never overwritten.
- Never send full citizen records to the LLM; send only the minimum context needed.

## 10. Security

- Secrets encrypted with AES-256-GCM using a dedicated `CREDENTIALS_ENCRYPTION_KEY` (no fallback).
- Logs and `error_logs` pass through a redaction function (DNI, CUIT, phone, email, tokens, cookies).
- Signed URLs for private media expire in <= 5 minutes; storage paths prefixed by `org_id`.
- Input size limits on webhook bodies, uploads, and text messages (4096 chars).

## 11. Testing

- **TDD**: failing test first for every service, repository contract, and SQL function.
- Unit (Vitest): pure logic in `packages/shared`, services with in-memory repository fakes.
- SQL tests: every transition function (happy path + each error code) and every RLS policy (cross-org, cross-area, append-only).
- Integration: webhook route with recorded Evolution payload fixtures (`text`, `image`, `audio`, `document`, `location`, `fromMe`, `@lid`, group).
- Manual verification per `docs/openspec-tasks-mandatory-steps.md` (curl against local dev server, DB state checks).
