# Architecture SDD

> **Language:** English (technical contract).
> **Location:** repository root `ARCHITECTURE_SDD.md`.
> Updated on every OpenSpec change that alters flow, schemas, routes, or models.

**Last updated:** 2026-10-05
**Related OpenSpec change:** `openspec/changes/foundation-workspace-auth/` (Phase 1, change 1 of 2)

---

## 1. System overview

"Mesa de Entrada Digital" is a web messaging panel for the Municipality of Epuyén. Citizens write through WhatsApp (Evolution API). An LLM chatbot answers from official documents (RAG) and hands off to humans when unsure. Operators work a triage queue, create tasks and notes delegable to municipal areas or external WhatsApp contacts, and every state change is recorded append-only.

**Implemented (foundation-workspace-auth):** npm-workspaces monorepo, local Supabase on Podman, organization-level multi-tenancy enforced by RLS, operator login/session/logout with route and role guards, inactive/orphan account lockout, own-profile editing (name, avatar), redacted error tracking with trace ids and a support screen, and the panel shell (sidebar, top bar, empty Inbox/Citizens/Tasks pages).

**Planned:** areas and operator administration (next Phase 1 change `areas-operators-admin`), WhatsApp ingestion and worker (Phase 2), queue/tasks/notes (Phases 3–5), bot/RAG (Phase 6), hardening and deploy (Phase 7). Product design: `docs/architecture.md`, `docs/data-model.md`, `docs/flows.md` (Spanish). Roadmap: `.planning/ROADMAP.md`.

## 2. Layer mapping (this project)

| Conceptual layer | Paths in this repo | Notes |
|---|---|---|
| Presentation / HTTP thin | `apps/web/src/app/**` (pages, layouts, error boundaries, route handlers), `apps/web/src/presentation/**` (components), `apps/web/src/middleware.ts` | Parse input (Zod), call a feature, render. Server actions in `features/*/actions.ts` are thin adapters too. |
| Application / services | `apps/web/src/features/{auth,profile,errors}/**`, `packages/shared/src/{redact,trace,initials}.ts` | Use cases with injected ports (functions), so they are unit-tested without Next or Supabase. `features/*/server.ts` and `actions.ts` wire real adapters. |
| Infrastructure / repositories | `apps/web/src/infrastructure/{supabase,repositories,storage,auth,http}/**`, `apps/web/src/infrastructure/env.ts`, `supabase/migrations/**`, `supabase/seed/seed.ts` | Only layer that touches Supabase clients, Storage, `fetch`. Repositories throw `RepositoryError(code)`. |
| Contracts / schemas | `apps/web/src/contracts/{auth,profile,errors}.ts`, `packages/shared/src/contracts/{roles,profile,error-log,database.types}.ts` | Zod at every boundary (forms, route handler body, query string, DB row mapping). |

Deliberate deviations:
- Authorization invariants live in Postgres (RLS helpers + guard triggers); the app checks roles for UX/403 but the database is the final authority.
- `packages/shared` has no runtime dependency on Next.js or Supabase.

## 3. Data & control flow

### 3.1 Request pipeline (every request)

```text
Browser → middleware.ts
  → resolveTraceId(x-trace-id)          reuse a safe incoming id or generate a UUID
  → set request headers x-trace-id, x-pathname
  → updateSession() (@supabase/ssr)     refresh auth cookies, getUser() → userId
  → resolveRouteAccess(path, userId)    anonymous on a panel path → 307 /login?next=<path>
  → response carries x-trace-id
```

Public prefixes: `/login`, `/api`. Static assets are excluded by the matcher.

### 3.2 Login / panel access

```text
/login form (react-hook-form + loginSchema) → signInAction (server action)
  → features/auth/sign-in: loginSchema.safeParse → passwordSignIn (Supabase Auth)
     invalid input → field errors; auth error → generic "Email o contraseña incorrectos."
  → redirect(safeNext(next))            only same-origin relative paths, never /login

(panel)/layout.tsx → getCurrentOperator() (React cache, per request)
  → requireOperator: session user? → findProfileById (admin client, sees inactive rows)
     no session  → redirect /login?next=<x-pathname>
     no profile  → signOut + /login?reason=no_profile
     inactive    → signOut + /login?reason=inactive
  → AppShell (sidebar filtered by role, top bar with name/avatar/user menu)

Role-restricted page → requirePageRole(['admin','support']) → requireRole → forbidden() → app/forbidden.tsx (HTTP 403)
Logout (user menu) → signOutAction → signOut({ scope: 'local' }) → redirect /login
```

### 3.3 Profile editing

```text
ProfileNameForm → updateNameAction → features/profile/update-name (profileNameSchema)
  → updateProfileName (user-scoped client; RLS: own active row) → revalidatePath('/', 'layout')

AvatarUploader (client pre-check type/size) → uploadAvatarAction (body limit 3 MB)
  → size ≤ 2 MB → features/profile/upload-avatar: sniffImage(magic bytes JPEG/PNG/WebP)
  → uploadAvatarObject  avatars/{org_id}/{user_id}/{uuid}.{ext}   (storage policy: own folder)
  → updateProfileAvatarPath  (failure → remove the new object)
  → removeAvatarObject(previous)  best effort → revalidatePath('/', 'layout')
```

### 3.4 Error tracking

```text
Server error (render / action / route) → instrumentation.ts onRequestError (Node runtime)
  → toRequestErrorLog: skip Next control flow (redirect / notFound / forbidden)
     source 'api' for route handlers, 'web' otherwise; traceId from x-trace-id; details.digestRef
  → attachRequestOperator(cookie header): session → active profile → org_id / user_id (never throws; null if anonymous)
  → logServerError → logError (cap raw message, redact message + details) → insertErrorLog (service role)

UI crash → (panel)/error.tsx or global-error.tsx → ErrorFallback
  → generateTraceId(); shows "Ocurrió un error. Código: XXXXXXXX"
  → POST /api/errors/report  header x-trace-id = body.traceId (+ optional note, digest)
  → reportError: active profile? (401) → advisory pre-check: ≥ 10 origin='client' rows in the last 60 s? (429, body unread)
     → readBoundedJson (> 16 KB: 413, stream cancelled) → errorReportSchema (400) → trace match (400)
  → buildErrorLogRow (cap raw message, redact message + details {url, stack, note, digestRef})
  → storeClientReport → rpc insert_client_error_report (service role):
     advisory xact lock per user → count + insert origin 'client' in one transaction
     → id: 201 { code } | null: 429 { rate_limited } | throws: 500 { not_stored }

Support (admin | support) → /support/errors?status&source&level&from&to&id
  → errorFiltersSchema (invalid values and impossible calendar dates dropped) → toLogFilters (Argentina day bounds, UTC-3)
  → listErrorLogs / findErrorLogById (user-scoped client, RLS)
  → ErrorStatusActions → changeErrorStatusAction → errorStatusChangeSchema → changeErrorLogStatus
     DB trigger allows only status; stamps resolved_by/resolved_at on 'resolved', clears otherwise

Retention: purge_error_logs() deletes rows older than 30 days; pg_cron daily 06:00 UTC where available.
```

Redaction (`packages/shared/src/redact.ts`, design D11): input capped at 16 384 chars (`[truncated]`) and every regex quantifier bounded, so worst-case time is linear (200 KB adversarial input < 200 ms). Order: secrets first (authorization/cookie lines, JWT, `sb_secret_…`, bearer, JSON pairs and escaped JSON whose key ends in `token|secret|password|key`, `key=value` / `key: value` including single- or double-quoted values with escapes), then email, CUIT, AR phones (structured match: optional `+54`/`9`, area code with optional parentheses or leading `0`, optional `15`, masked when ≥ 10 digits), DNI (2-3-3 grouping with one consistent separator or none, with digit-only boundaries: also masked when glued to letters, `_`, `.` or digit-dot sequences; dotted IPs and decimals that contain a DNI-shaped run are partially masked by design, D13). Secrets and emails run on the whole text; CUIT, phone and DNI run only between canonical UUID tokens (`8-4-4-4-12` hex), so trace and row ids stay intact. Superset guarantee (D12/D13): a frozen copy of the `65eb994` redaction is a test oracle, and a property test over 27 personal-data/secret tokens × 27 contexts asserts that whatever it removed, the current redaction removes too. Known, user-deferred exception (backlog R-3): the tail of secret values longer than 4 096 characters, and a value glued after an empty quoted pair (`password=""x`). `logError` slices the raw message to 2× the stored limit before redacting. `redactDetails` walks objects (max depth 5, sensitive keys replaced, circular refs marked) and truncates beyond 8 KB serialized. Next digests are numeric, so they are stored as `digestRef` (letters-only SHA-256 prefix) to survive redaction and still correlate the client report with the server row.

## 4. Routes

### 4.1 Pages

| Path | Access | Notes |
|---|---|---|
| `/login` | public | `?next=` (sanitized), `?reason=inactive|no_profile` notice; form is bound to `signInAction` so pre-hydration submits POST (credentials never in a URL) |
| `/inbox`, `/citizens`, `/tasks` | active operator | Empty states (filled in Phases 2–5) |
| `/settings/profile` | active operator | Name and avatar |
| `/support/errors` | `admin`, `support` | Filters + detail panel (`?id=`); others get 403 |

### 4.2 Route handlers

| Method | Path | Auth | Request schema | Response | Feature |
|---|---|---|---|---|---|
| POST | `/api/errors/report` | Supabase session + active profile; at most 10 stored reports / 60 s / user, enforced atomically in the database | header `x-trace-id`; body `errorReportSchema`, ≤ 16 KB (read only after auth and the advisory pre-check) | 201 `{code}` / 400 `{error:'invalid_body'|'trace_mismatch'}` / 401 `{error:'unauthenticated'}` / 413 `{error:'too_large'}` / 429 `{error:'rate_limited'}` / 500 `{error:'not_stored'}` | `features/errors/report-error`, `infrastructure/http/read-bounded-json` |

### 4.3 Server actions

| Action | File | Input schema | Result |
|---|---|---|---|
| `signInAction` | `features/auth/actions.ts` | `loginSchema` (+ `next`) | redirect or `{fieldErrors, message}` |
| `signOutAction` | `features/auth/actions.ts` | — | redirect `/login` |
| `updateNameAction` | `features/profile/actions.ts` | `profileNameSchema` | `{status, message, fieldErrors}` |
| `uploadAvatarAction` | `features/profile/actions.ts` | `FormData.avatar` (≤ 2 MB, magic bytes) | `{status, message}` |
| `changeErrorStatusAction` | `features/errors/actions.ts` | `errorStatusChangeSchema` | `{status, message}`; role guard `admin|support` |

## 5. Data schemas & models

### 5.1 Contracts (Zod)

| Schema | File | Fields |
|---|---|---|
| `loginSchema` | `apps/web/src/contracts/auth.ts` | `email` (trim, lowercase, email), `password` (min 1) |
| `profileNameSchema` | `apps/web/src/contracts/profile.ts` | `fullName` (trim, 2–80) |
| `avatarFileSchema` | `apps/web/src/contracts/profile.ts` | `type` (jpeg/png/webp), `size` (≤ 2 097 152) |
| `errorReportSchema` | `apps/web/src/contracts/errors.ts` | `traceId` (8–64), `message` (≤ 2000), `stack?` (≤ 8000), `url` (≤ 500), `note?` (≤ 500), `digest?` (≤ 200) |
| `errorStatusChangeSchema` | `apps/web/src/contracts/errors.ts` | `id` (uuid), `status` (`open|acknowledged|resolved`) |
| `errorFiltersSchema` | `apps/web/src/contracts/errors.ts` | `status?`, `source?`, `level?`, `from?`/`to?` (`YYYY-MM-DD`, must be a real calendar date in years 2000–2100), `id?` (uuid); invalid values become `undefined` |
| `roleSchema`, `profileSchema`, `errorLogSchema` | `packages/shared/src/contracts/*` | Domain entities used to validate repository rows; `profileSchema.fullName` only requires non-empty so a name the database accepted never fails on read (D14) |
| `Database` types | `packages/shared/src/contracts/database.types.ts` | Generated by `npm run db:types` |

### 5.2 Persistence (migrations `20260930000100_foundation.sql`, `20261005000100_foundation_hardening.sql`, `20261005000200_report_rate_limit.sql`, `20261005000300_maintain_and_blank_names.sql`, `20261005000400_visible_profile_names.sql`, `20261005000500_report_function_arguments.sql`, `20261005000600_complete_invisible_name_set.sql`)

| Table | Key columns | Notes |
|---|---|---|
| `organizations` | `id`, `name`, `slug unique` | Seeded `epuyen` |
| `profiles` | `id = auth.users.id`, `org_id`, `full_name (2–80)`, `avatar_path`, `role user_role`, `is_active`, `created_at`, `updated_at` | Index `org_id`; `updated_at` trigger; checks `profiles_full_name_trimmed_length` (2–80 after trimming invisible characters: whitespace, NBSP, zero-width and bidi marks, soft hyphen, Hangul fillers, braille blank, variation selectors and their supplement, Mongolian free variation selectors, Khmer inherent vowels, U+FFF0–U+FFF8, shorthand and musical format controls, tag characters; plus at least one ICU `[[:alnum:]]` character (letter or decimal digit) once those are removed; lengths in code points; mirrored by `fullNameSchema` / `profileNameSchema` with `[\p{L}\p{Nd}]` and the ICU-only blanks U+001C–U+001F, U+0085) and `profiles_avatar_path_own_folder` (`{org_id}/{id}/…`, no `..`) |
| `error_logs` | `org_id?`, `source (web|api|worker|db)`, `level error_level`, `origin (server|client) default 'server'`, `message`, `details jsonb`, `trace_id`, `user_id?`, `status error_status`, `resolved_by?`, `resolved_at?` | Indexes `(org_id, status, created_at desc)`, `trace_id`, partial `error_logs_client_reports_idx (user_id, created_at desc) where origin = 'client'` (report rate limit) |
| `storage.buckets.avatars` | public, 2 MB, JPEG/PNG/WebP | Objects `{org_id}/{user_id}/{uuid}.{ext}` |

RLS helpers (`security definer`, `stable`, `search_path = ''`, return null without an **active** profile, so every policy matches nothing for inactive/orphan users): `current_org_id()`, `current_user_role()`.

Client report limit: `insert_client_error_report(p_org_id, p_user_id, p_trace_id, p_message, p_details, p_limit, p_window_seconds) returns uuid` (`security invoker`, `search_path = ''`, execute granted to `service_role` only). It raises `22023 invalid_argument` on a null user or a null/non-positive limit or window, then takes `pg_advisory_xact_lock` on the user, counts `origin = 'client'` rows inside the window, and returns null when the limit is reached; otherwise it inserts and returns the id. Concurrent requests for the same user are serialized, so at most `p_limit` rows land per window (probe: 50 parallel requests → 10 stored).

Rule for future functions: the `profiles` and `error_logs` guard triggers trust `current_user`, so a `security definer` function that writes those tables runs as the owner and skips them. Any such function must re-check roles and columns itself (re-review N-13).

| Object | Select | Update | Insert / delete |
|---|---|---|---|
| `organizations` | own org | — | service role |
| `profiles` | own org | self (own row) or admin (own org); trigger `profiles_guard_privileged_columns` rejects any API change to `id`/`created_at` and non-admin changes to `role`, `org_id`, `is_active` (`P0001 forbidden_column`) | service role |
| `error_logs` | `admin`/`support` of the org; null-org rows `support` only | same set; trigger `error_logs_guard_update` allows only `status` (never `origin`) and stamps resolution | service role; `purge_error_logs()` service role only |
| `storage.objects` (`avatars`) | authenticated, own org folder only | own folder | own folder |

Grants: `authenticated` holds only `SELECT`/`UPDATE` on the three business tables (no `INSERT`, `DELETE`, `TRUNCATE`, `TRIGGER`, `REFERENCES`, nor the PG 17 `MAINTAIN` privilege, which covers VACUUM, ANALYZE, REINDEX, CLUSTER and REFRESH MATERIALIZED VIEW; `LOCK TABLE` stays possible through `UPDATE` but is not reachable through PostgREST); trigger functions are not executable by `public`/`anon`/`authenticated`.

Auth server (`supabase/config.toml`): `[auth] enable_signup = false` (operators are provisioned by the seed or the service role), `minimum_password_length = 10`. `[auth.email] enable_signup` stays `true` because it enables the email provider itself; turning it off breaks password sign-in. The cloud project must mirror this (see README).

## 6. AI / LLM boundaries

None in this change. Planned (Phase 6): provider behind `contracts/llm.ts` (`chat`, `embed`, `transcribe`, `vision`), prompts in `worker/src/features/bot/**`, strict Zod output (`botDecisionSchema`, …), invalid output → retry once → handoff with reason `error`.

## 7. Error handling

| Layer | Behavior |
|---|---|
| Repositories | Throw `RepositoryError(code)`: `profiles.read_failed|invalid_row|write_failed|not_updated`, `error_logs.read_failed|write_failed|not_found|invalid_row`, `storage.write_failed|remove_failed` |
| Features | Return discriminated results (`ok` / `invalid` / `failed`); never leak Supabase messages. `logError` never throws (console fallback) |
| Presentation | es-AR messages from `apps/web/src/i18n/es-AR.ts`; `role="alert"` for errors, `role="status"` for confirmations |
| Unhandled | `onRequestError` stores the server row; `error.tsx` / `global-error.tsx` report and show the incident code |
| Env | `readPublicEnv` / `readServerEnv` throw `MissingEnvError` naming missing variables (values never printed) |

## 8. Local environment

- Supabase CLI on **Podman** (Windows, WSL2 machine); `scripts/supabase.mjs` sets `DOCKER_HOST=npipe:////./pipe/podman-machine-default`. Spike evidence: `openspec/changes/foundation-workspace-auth/reports/2026-09-30-spike-supabase-podman.md`.
- Fallback: dedicated Supabase cloud project for development (`npm run db:push`).
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, optional `SUPABASE_PROJECT_REF`, `SUPABASE_CLOUD_*`.
- Next config: `experimental.authInterrupts` (for `forbidden()`), `experimental.serverActions.bodySizeLimit = '3mb'`.

## 9. Non-goals / out of scope

This snapshot: areas, area membership and area-level RLS, operator CRUD/role editing/deactivation UI, worker/jobs, WhatsApp, password reset, SSO/MFA, deploy/CI. Product-wide: fine-tuning, digital case files/e-signature, native mobile app, WhatsApp groups, Meta Cloud API (v2).

## 10. Change log (architecture)

| Date | Change | OpenSpec change |
|---|---|---|
| 2026-09-30 | Design baseline at SDD bootstrap | — |
| 2026-10-01 | Monorepo, local Supabase on Podman, org RLS, auth/session/guards, profile editing, error tracking + support screen, panel shell | `foundation-workspace-auth` |
| 2026-10-05 | Adversarial-review hardening (D11): POST-bound login form, linear-time redaction with AR formats, report endpoint auth → rate limit → 16 KB cap, server errors attach operator org/user, calendar-date filters, least-privilege grants, immutable profile identity, profile checks, org-scoped avatar listing, signup disabled + 10-char passwords | `foundation-workspace-auth` |
| 2026-10-05 | Re-review fixes (D12): atomic per-user report limit (`origin` column + `insert_client_error_report` with advisory lock), redaction superset (quoted secrets, glued DNIs), filter years 2000–2100, `MAINTAIN` revoked, Unicode-blank name check, SSR login-form test | `foundation-workspace-auth` |
| 2026-10-05 | Second re-review fixes (D13): strict DNI superset proven by a property test against the `65eb994` oracle, UUID tokens exempt from numeric redaction, profile names need a visible letter or number (DB + form), report function rejects limit-disabling arguments | `foundation-workspace-auth` |
| 2026-10-05 | Third re-review fixes (D14, partial): profile rows never rejected on read (operator lockout), form counts code points, letter check mirrors ICU, completed default-ignorable set (DB + JS), report-argument tests for zero window / negative limit. Redaction superset (S-1/S-2) awaits a team decision (`reports/2026-10-05-redaction-superset-decision-brief.md`) | `foundation-workspace-auth` |
