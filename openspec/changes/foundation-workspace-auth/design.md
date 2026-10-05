## Context

Greenfield repository: only `.planning/`, `docs/`, SDD scaffolding (`ai-specs/`, `openspec/`, `.cursor/`) and root docs exist. Local machine is Windows with Podman (no Docker), Node available, git remote `origin` on GitHub (`newo3210/EpuyenDigital`, branch `main`). The reference CRM (`newo3210/seguros`, read-only clone) provides proven pieces for RLS helpers, auth guards, avatars and error logs, with known defects listed in `docs/reuse-from-seguros.md`.

Standards that apply: `docs/base-standards.md` (§9 layers + section comments, §12 local environment), `docs/backend-standards.md` (SQL, RLS, testing), `docs/frontend-standards.md` (structure, UI/UX, accessibility), `docs/data-model.md` (tables `organizations`, `profiles`, `error_logs`).

## Goals / Non-Goals

**Goals:**
- Bootable monorepo with one-command local stack on Podman and a documented cloud fallback.
- Organization-level multi-tenancy enforced by RLS, proven by SQL tests.
- Operator login/session/logout, route and role guards, inactive-profile lockout.
- Own-profile editing (name, avatar).
- Redacted error logging with trace ids and a support screen.
- Panel shell ready to host Phase 2–7 features.

**Non-Goals:**
- Areas, area membership, area-level RLS, operator CRUD/role editing/deactivation UI (change `areas-operators-admin`).
- Worker process, jobs table, WhatsApp/Evolution (Phase 2).
- Password reset by email, SSO, MFA (not in v1 requirements).
- Deployment/hosting, CI pipeline (Phase 7, OPS-04).

## Layer mapping (base-standards §9)

| Conceptual layer | Paths in this change |
|---|---|
| Presentation | `apps/web/src/app/(auth)/login/**`, `apps/web/src/app/(panel)/**` (layout, `error.tsx`, `inbox`, `citizens`, `tasks`, `settings/profile`, `support/errors`), `apps/web/src/app/{forbidden,global-error}.tsx`, `apps/web/src/app/api/errors/report/route.ts`, `apps/web/src/presentation/{auth,layout,profile,support,errors,ui}/**` (login form, shell, sidebar, top bar, avatar, error fallback, support table/filters/detail) |
| Application / services | `apps/web/src/features/auth/**` (sign-in, sign-out, `requireOperator`, `requireRole`, safe-next), `apps/web/src/features/profile/**` (update name, upload avatar), `apps/web/src/features/errors/**` (log, report, list, change status), `packages/shared/src/redact.ts`, `packages/shared/src/initials.ts`, `packages/shared/src/trace.ts` |
| Infrastructure / repositories | `apps/web/src/infrastructure/supabase/{server,browser,admin,middleware}.ts`, `apps/web/src/infrastructure/repositories/{profiles,error-logs}.ts`, `apps/web/src/infrastructure/env.ts`, `apps/web/src/middleware.ts`, `supabase/migrations/*.sql`, `supabase/seed/seed.ts`, `supabase/config.toml` |
| Contracts | `packages/shared/src/contracts/{roles,profile,error-log}.ts`, `apps/web/src/contracts/{auth,profile,errors}.ts` (form and route-handler Zod schemas) |

Presentation calls only `features/*` (server actions / route handlers delegate immediately). `features/*` call repositories; repositories are the only code touching Supabase clients. `packages/shared` has no runtime dependency on Next.js or Supabase.

## Decisions

### D1 — Monorepo with npm workspaces
Root `package.json` with workspaces `apps/web`, `packages/shared`. `worker/` is **not** created here (YAGNI; Phase 2). `tsconfig.base.json` strict + `noUncheckedIndexedAccess`. Vitest at root with projects for `apps/web` and `packages/shared`.
*Alternative:* pnpm/turborepo — rejected for now; npm is already installed and the workspace count is small.

### D2 — Stack versions
Next.js 15 (App Router) + React 19, Tailwind CSS v4 (CSS-first `@theme` tokens), Radix primitives, `lucide-react`, `react-hook-form` + `@hookform/resolvers/zod`, Zod 3, `@supabase/ssr`. Exact versions pinned at install time after checking current stable releases.
*Alternative:* Tailwind v3 as in the reference CRM — rejected; v4 is current and tokens port easily. (Open question for the user.)

### D3 — Local Supabase on Podman with timeboxed spike
Supabase CLI as a devDependency (`npx supabase`). Scripts set `DOCKER_HOST` to the Podman machine named pipe (`npipe:////./pipe/podman-machine-default`). Task 1 is a **spike (timebox 2 h)**: `supabase start` + `supabase db reset` + `supabase test db`. If it fails, switch to the fallback: a dedicated Supabase cloud project for development, `.env.local` pointing to it, migrations via `supabase db push`, SQL tests via `psql` against that project. The decision and evidence go to `STUDENT_DECISION_LOG.md`.

### D4 — Database schema (migration `20260930000100_foundation.sql`)
- Extensions: `pgcrypto`, `pg_cron` (if unavailable locally, the purge is exposed as function `purge_error_logs()` and scheduled only where `pg_cron` exists).
- Enums: `user_role ('admin','area_lead','operator','support')`, `error_level ('error','warn','info')`, `error_status ('open','acknowledged','resolved')`.
- `organizations (id uuid pk, name text not null, slug text unique not null, created_at timestamptz default now())`.
- `profiles (id uuid pk references auth.users on delete cascade, org_id uuid not null references organizations, full_name text not null check (char_length between 2 and 80), avatar_path text, role user_role not null default 'operator', is_active boolean not null default true, created_at, updated_at)`.
- `error_logs (id uuid pk, org_id uuid null references organizations, source text not null check in ('web','api','worker','db'), level error_level not null, message text not null, details jsonb not null default '{}', trace_id text not null, user_id uuid null, status error_status not null default 'open', resolved_by uuid null references profiles, resolved_at timestamptz null, created_at timestamptz default now())` + index `(org_id, status, created_at desc)`.
- `updated_at` trigger on `profiles`.

### D5 — RLS helpers and policies
- `current_org_id()` and `current_user_role()`: `security definer`, `stable`, `set search_path = ''`, return values only when `profiles.is_active` is true; otherwise null. Every policy compares against these helpers, so an inactive user matches nothing. (Named `current_user_role` because `current_role()` is a syntax error: `CURRENT_ROLE` is a reserved SQL keyword — verified on the local stack during apply.)
- `organizations`: select where `id = current_org_id()`; no client writes.
- `profiles`: select where `org_id = current_org_id()`; update self (`id = auth.uid()`) guarded by trigger `profiles_guard_privileged_columns` that raises `P0001 'forbidden_column'` if a non-admin changes `role`, `org_id`, or `is_active`, and if anyone (admins included) changes `id` or `created_at` (added in D11); admins update rows of their org. Insert/delete: service role only.
- `error_logs`: select/update for `current_user_role() in ('admin','support')` and `org_id = current_org_id()` (rows with null `org_id` visible to `support` only); insert service role only; trigger `error_logs_guard_update` allows changing only `status`, sets `resolved_by = auth.uid()` / `resolved_at = now()` when status becomes `resolved`, clears them otherwise.
- Storage bucket `avatars` (public read); insert/update/delete only where `(storage.foldername(name))[1] = current_org_id()::text and [2] = auth.uid()::text`.
- Port: `seguros/supabase/migrations/*rls_helpers*` + `*error_logs*` with corrections from `docs/reuse-from-seguros.md` (inactive check inside helpers; no permissive fallback).

### D6 — Auth flow
- `middleware.ts`: refreshes the session via `@supabase/ssr`, sets/propagates `x-trace-id`, redirects anonymous users on `(panel)` paths to `/login?next=<path>`.
- `(panel)/layout.tsx` calls `requireOperator()` (features/auth): loads the profile; missing → sign out + redirect `/login?reason=no_profile`; inactive → sign out + `/login?reason=inactive`.
- `requireRole(roles)` used by pages; failure calls Next's `forbidden()` and renders `app/forbidden.tsx` with HTTP 403. Decision (2026-10-01, user approved): `forbidden()` is still behind `experimental.authInterrupts` in Next 15.5, and we enable that flag in `next.config.ts` instead of a middleware role lookup or a 200 redirect.
- Login is a server action validated with `loginSchema` (Zod); Supabase error → generic message (no enumeration). `safeNext()` accepts only relative paths starting with `/` and not `//`.
- Port: `seguros/apps/web/src/lib/auth/*` (guards) adapted to the layer mapping.

### D7 — Profile editing
Server action `updateProfileName` (Zod 2–80 chars, trimmed). Avatar upload: client validates type/size for UX, server action re-validates (MIME sniff by magic bytes, ≤ 2 MB), uploads to `avatars/{org_id}/{user_id}/{uuid}.{ext}`, updates `avatar_path`, deletes the previous object. Top bar refreshes via `revalidatePath('/', 'layout')`. Initials from `packages/shared/src/initials.ts`. Server Actions body limit raised to `3mb` (`experimental.serverActions.bodySizeLimit`; Next default is 1 MB) so a valid 2 MB image reaches the action and oversized files get the spec message instead of a framework error. Upload, link and delete use the user-scoped client so the storage policy (own folder) applies; a failed `avatar_path` update removes the freshly uploaded object.

### D8 — Error tracking
- `packages/shared/src/redact.ts`: masks DNI (7–8 digits), CUIT (`\d{2}-?\d{8}-?\d`), AR phones (10–13 digits, optional `+54 9`), emails, `token=|apikey=|authorization:|bearer ` values; applied recursively to `details` (max depth 5, max 8 KB serialized, truncated beyond).
- `features/errors/log-error.ts`: server-only; uses admin client (service role) to insert; never throws (falls back to `console.error`).
- `POST /api/errors/report`: authenticated; body `{ traceId, message, stack?, url, note?, digest? }` validated by Zod (note ≤ 500); rejects if `traceId !== x-trace-id` (400); inserts with source `web`.
- `apps/web/src/instrumentation.ts` `onRequestError` (Next 15 hook, Node runtime only) captures unhandled server errors (render, server action, route handler) and calls `logError` with the request's `x-trace-id`; source `api` for route handlers, `web` otherwise; the route path goes to `details`.
- Digest correlation: Next digests are numeric strings that redaction masks as phones/DNIs, so neither row stores the raw digest. Both the server row and the client report store `details.digestRef` — the first 16 hex characters of `sha256(digest)` re-encoded as letters `a`–`p` (no digits, so redaction never alters it) — letting support match the two rows.
- `app/(panel)/error.tsx` and `global-error.tsx` generate a client trace id, send it both as `x-trace-id` header and body `traceId` (middleware keeps a valid incoming id), and show the 8-char code; the Next error digest is sent in the report and stored as `digestRef` so it can be matched with the server-side row.
- Support screen: filters live in the query string (`status`, `source`, `level`, `from`, `to` as `YYYY-MM-DD`, interpreted in America/Argentina/Buenos_Aires) and are parsed with Zod; `?id=<uuid>` opens the detail panel (server-rendered); status changes go through a server action validated by `errorStatusChangeSchema` using the user-scoped client so RLS and the guard trigger apply.
- Purge: `purge_error_logs()` deletes `created_at < now() - interval '30 days'`; `pg_cron` schedule daily 03:00 America/Argentina/Buenos_Aires (06:00 UTC).

### D9 — Seed
`supabase/seed/seed.ts` (run with `tsx`): upserts organization `slug = 'epuyen'`; creates the auth user from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` via `auth.admin.createUser` only if absent; upserts profile role `admin`. Idempotent by design. Areas seeding belongs to change 2.

### D10 — Section comments and UI language
All hand-written TS/TSX follow the section-comment rule (`// <Block> - <what it does>`). UI copy in es-AR; code, specs and comments in English.

### D11 — Hardening after adversarial review (2026-10-05)
Source: `reports/2026-10-05-adversarial-review.md` (verdict FAIL, 3 majors). Scope approved by the user: majors + cheap hardening; Q-1 resolved as "attach org/user".
- **Login without JS (J-1):** the `<form>` gets `action={formAction}` (server action → SSR renders `method="POST"` with React's action fields), and `next` travels in a hidden input. After hydration, react-hook-form still validates first and calls the action in a transition. Credentials can never be sent as a GET query.
- **Redaction coverage (J-2):** `redact.ts` rules are rewritten around Argentine formats. Phones are structured matches (optional `+54`, `9`, `0`-prefixed area code in optional parentheses, optional `15`, separators space/dot/hyphen) masked when they have ≥ 10 digits. DNI uses a 2-3-3 grouping with one consistent separator (none, dot, space, or hyphen), so dates (`2026-10-05`) and IPs are not masked. Secrets: JSON `"key": "value"`, `key=value` / `key: value` for keys containing `token|secret|passw` or ending in `key`, bare `sb_secret_…`, and JWT.
- **Linear-time redaction (J-3a/b):** every quantifier in `redact.ts` is bounded (email local part ≤ 64, labels ≤ 63, secret key prefix ≤ 40). `redactText` truncates its input to 16 384 characters before matching, and `logError` slices the message to 2 000 characters before redacting. A performance test redacts 200 KB adversarial inputs within 200 ms.
- **Report endpoint limits (J-3c/d):** `reportError` checks session and active profile first. It then checks a per-user limit (≥ 10 stored client reports in the last 60 s → 429), and only then reads the body through an injected `readBody` port. The route rejects `content-length` > 16 384 or a longer text with 413. Client reports carry `details.origin = 'client'` so the limit counts only them (index `error_logs (user_id, created_at desc)`). This is not a distributed rate limiter; it is enough for one municipality, and Phase 7 revisits it.
- **Server errors attach the operator (Q-1):** `instrumentation.ts` enriches the log input through `attachRequestOperator`, which builds a read-only Supabase client from the request's cookie header (`parseCookieHeader`), resolves the user and active profile, and sets `orgId`/`userId`. It never throws; without an active operator the row keeps a null org, visible to support only.
- **Filters (M-1):** `from`/`to` must be real calendar dates (round-trip through `Date`); otherwise they are dropped.
- **Database hardening (M-3..M-7, M-10)**, new migration `20261005000100_foundation_hardening.sql`:
  - Revoke `insert, delete, truncate, trigger, references` on the three tables from `authenticated`, and `execute` on the trigger functions from `public, anon, authenticated`.
  - `profiles_guard_privileged_columns` also rejects changes to `id` and `created_at` by any `authenticated` caller.
  - Check constraints: `char_length(btrim(full_name)) between 2 and 80`, and `avatar_path is null or avatar_path like org_id || '/' || id || '/%'` with no `..`.
  - `avatars_select` restricted to the caller's org folder (public URLs are unaffected because the bucket is public).
  - pgTAP covers the cron job, privileges, guards, constraints, cross-user avatar delete, and listing.
  - `avatarPublicUrl` URL-encodes path segments.
- **Auth config (M-5):** `[auth] enable_signup = false` (GoTrue `DISABLE_SIGNUP`), `minimum_password_length = 10`. `[auth.email] enable_signup` stays `true` because it toggles the whole email provider (`EXTERNAL_EMAIL_ENABLED`); turning it off breaks password sign-in (`email_provider_disabled`). Signup is still blocked by the global flag (`signup_disabled`); the seed validates `SEED_ADMIN_PASSWORD` with the same minimum. The cloud project must mirror these settings (README).
- **Deferred with user approval:**
  - M-2 (one malformed row breaks the list), M-8 (lockout only in the layout), M-9 (direct Storage uploads bypass sniffing), M-11 (trace ids are client hints), M-12 (Auth errors collapsed into "wrong credentials").
  - Q-2 (stale cookies after a layout sign-out; lockout still enforced server-side).
  - Q-3 (last-admin protection) goes to `areas-operators-admin`. The other deferred items go to the backlog in `.planning/STATE.md`.

### D12 — Fixes after the adversarial re-review (2026-10-05)
Source: `reports/2026-10-05-adversarial-rereview.md` (verdict FAIL: N-1 Blocker, N-2/N-3/N-4 Major). User-approved scope: N-1..N-4 plus cheap minors N-8, N-9, N-11, N-12, N-14. Rate limit enforced atomically in SQL. Redaction must be a superset of `65eb994`.
- **Rate limit on a column, enforced atomically (N-1, N-2):**
  - New migration `20261005000200_report_rate_limit.sql` adds `error_logs.origin text not null default 'server' check (origin in ('server','client'))`. It replaces `error_logs_user_created_idx` with a partial index `(user_id, created_at desc) where origin = 'client'`.
  - Function `public.insert_client_error_report(p_org_id uuid, p_user_id uuid, p_trace_id text, p_message text, p_details jsonb, p_limit int, p_window_seconds int) returns uuid`: `security invoker`, `search_path = ''`, executable only by `service_role`.
  - In one transaction it takes `pg_advisory_xact_lock(hashtextextended('client_error_report:' || p_user_id, 0))`, counts that user's `origin = 'client'` rows inside the window, returns null when the count is ≥ `p_limit`, and otherwise inserts with `source 'web'`, `level 'error'`, `origin 'client'` and returns the id.
  - The count no longer depends on `details`, so truncated details still count.
- **Report flow:** auth (401), then a cheap advisory pre-check of the count (429, sheds floods before any body read or redaction), then `readBody` (413), then schema (400), then trace (400), then redaction through the shared `buildErrorLogRow`, then the atomic store port.
  - The atomic store returns `stored` (201), `rate_limited` (429) or `failed` (500).
  - The body is read before the authoritative check, so the race window no longer depends on how slowly the client sends it.
  - `details.origin` is dropped; the column replaces it.
- **Redaction superset (N-3, N-4):**
  - Secret values may be double- or single-quoted with escapes (`"(?:[^"\\\n]|\\.){0,4096}"`), so `password="x"`, `{ password: 'x' }` (Node inspect) and `token: "x"` are masked.
  - JSON values accept escaped quotes, so `{"password":"hun\"ter2"}` is masked entirely.
  - DNI boundaries are digit-based: not preceded by a digit or `digit.`, not followed by a digit or `.digit`, and not the first segment of a UUID (`-hhhh-`); superseded by D13 (digit-only boundaries plus a UUID-token exemption). So `dni_30123456.pdf`, `30123456_frente.jpg`, `nro.30123456`, `Doc.30.123.456` and `id30123456` are masked, while dates, IPs and UUIDs stay intact.
  - Regression tests reproduce every reviewer case and also pass against `65eb994`. Linear time is kept: every quantifier stays bounded.
- **Filters (N-8):** calendar dates must also have a year between 2000 and 2100.
- **Database (N-9, N-11):**
  - Revoke `maintain` (PG 17) from `authenticated` on the three tables.
  - The name check trims Unicode blanks (`[[:space:]]`, NBSP, zero-width space/joiners, BOM) before measuring length (extended by D13).
  - pgTAP covers `MAINTAIN`, tab/NBSP/ZWSP names, the `origin` column, the function grants and the limit.
- **Login SSR test (N-12):** `renderToString(<LoginForm/>)` with a server-reference-shaped action asserts `method="POST"` in the server markup.
- **Traceability (N-14):** fix the ID labels in the step-15 report; README/ARCHITECTURE describe the limit as atomic per user.
- **Deferred to backlog:** N-5 (truncation splits a value), N-6 (more phone shapes), N-7 (email/DSN/object-key gaps), N-10 (resolver tests and timeout), N-13 (guards rely on `current_user`; documented rule).

### D13 — Fixes after the second re-review (2026-10-05)
Source: `reports/2026-10-05-adversarial-rereview-2.md` (verdict FAIL: R-1 Major). User decisions: **strict superset** for R-1 (privacy over keeping IPs and decimals intact); scope R-1 plus cheap R-2, R-4, R-5, R-8, R-9. Deferred to backlog: R-3, R-6, R-7, R-10. R-3 is the one known exception to the superset rule (tails of secret values over 4 096 characters, and `password=""x`); the spec names it explicitly.
- **Strict DNI superset (R-1):**
  - `DNI_RE` keeps only digit boundaries: not preceded by a digit, not followed by a digit. The `digit.` / `.digit` exceptions and the `-hhhh-` lookahead are removed.
  - So `30123456.1.pdf`, `dni_30123456.2024.pdf`, `v2.30123456`, `0.30123456`, `1.30.123.456`, `30.123.456.789` and `x 1234567.89` are masked.
  - Accepted trade-off: dotted IPv4 addresses and decimals that contain a DNI-shaped run (`10.168.100.200`, `1.30123456`) are partially masked.
  - **Proof of superset:** a frozen copy of the `65eb994` `redactText` lives in a test fixture (`packages/shared/src/redact.legacy.fixture.ts`). A property test builds a corpus of PII tokens (DNI in every format, phones, CUIT, emails, secrets) × contexts (letters, `_`, `.`, `digit.`, `.digit`, `-`, spaces, file-name prefixes and suffixes, JSON and `key=` wrappers). For every case where the legacy output no longer contains the token, the current output must not contain it either.
- **UUID tokens exempt from personal-data passes (R-2):**
  - After the secret and email passes, the text is split on canonical UUID tokens (`\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b`, case-insensitive). CUIT, phone and DNI passes run only on the segments between them.
  - UUIDs are system identifiers (trace ids, row ids), never personal data, so exempting the exact token shape does not weaken privacy. The superset property is defined over text outside UUID tokens.
  - Emails run before the split, so `<uuid>@domain` is still masked as an email.
  - Test: 20 000 random `crypto.randomUUID()` values, alone and inside `/support/errors?id=<uuid>`, stay unchanged.
- **Visible profile names (R-4):**
  - The invisible set becomes: `[[:space:]]`, U+00A0, U+00AD, U+034F, U+061C, U+115F, U+1160, U+1680, U+180E, U+2000–U+200F, U+2028–U+202F, U+205F–U+2064, U+2066–U+206F, U+2800, U+3000, U+3164, U+FE00–U+FE0F, U+FEFF, U+FFA0, U+E0000–U+E007F.
  - The check measures 2–80 characters after trimming that set from both ends, **and** requires at least one letter or number after removing that set everywhere. Hangul fillers count as letters in the `en_US.UTF-8` ctype, so they must be removed before the letter check. Combining marks alone are not letters, so they are rejected.
  - `profileNameSchema` mirrors the same rule with a shared JS regex, so the form reports the error instead of a generic database failure.
- **Function arguments (R-5):** `insert_client_error_report` raises `22023 invalid_argument` when `p_user_id`, `p_limit` or `p_window_seconds` is null, or when `p_limit` or `p_window_seconds` is below 1.
- **SSR test honesty (R-8):** the test asserts that React called the bound reference's `$$FORM_ACTION` (proving the form is wired to the server action) and that the action-id field is rendered. The real `method="POST"` stays an HTTP smoke check: `GET /login` on the dev server in the verification step.
- **Docs (R-9):** correct the superset claim (now proven by the property test), the UUID claim (exempt by design), the `MAINTAIN`/`LOCK` claim (`UPDATE` already allows `LOCK TABLE`; `MAINTAIN` adds VACUUM, ANALYZE, REINDEX, REFRESH MATERIALIZED VIEW and CLUSTER), and the zero-width claim (now covered).

### D14 — Fixes after the third re-review (2026-10-05, partial)
Source: `reports/2026-10-05-adversarial-rereview-3.md` (verdict FAIL: S-1, S-2 Major). The redaction strategy (S-1, S-2, S-3, S-6) is **blocked on a team decision**: `reports/2026-10-05-redaction-superset-decision-brief.md`. User-approved now, independent of that decision: S-4, S-5, S-7.
- **Profile rows never stricter than the database (S-4 a):** `profileSchema.fullName` (repository row validation) only requires a non-empty string. The database checks are the source of truth, so a name the database accepted can always be read; an operator can no longer lock themselves out with a REST update.
- **Form counts code points (S-4 a):** `fullNameSchema` / `profileNameSchema` measure the raw and the visible length in code points (`[...value].length`), like `char_length`, instead of UTF-16 units.
- **ICU character classes (S-4 b, c):** the database uses the ICU provider, so `[[:alnum:]]` is `\p{Alphabetic}` plus decimal digits, and `[[:space:]]` also covers U+001C–U+001F and U+0085. The JS mirror uses `[\p{Alphabetic}\p{Nd}]` and adds those blanks. Node's Unicode tables are newer than the database's ICU, so the form may accept a few recent letters the database rejects (generic save error); it can never reject a name the database accepts on read, because row validation no longer applies the rule. D13's attribution to the `en_US.UTF-8` ctype was wrong; the conclusion (Hangul fillers count as letters) still holds.
- **Invisible set completed (S-5):** add U+17B4–U+17B5, U+180B–U+180D, U+180F, U+FFF0–U+FFF8, U+1BCA0–U+1BCA3, U+1D173–U+1D17A and U+E0100–U+E01EF to the database and JS sets. New migration replaces the check again.
- **Function tests (S-7):** pgTAP adds a zero window and a negative limit.

## Contracts (Zod)

- `loginSchema { email: string().email(), password: string().min(1) }`
- `profileNameSchema { fullName: string().trim().min(2).max(80) }`
- `avatarFileSchema { type: enum(['image/jpeg','image/png','image/webp']), size: number().max(2_097_152) }`
- `errorReportSchema { traceId: string().min(8).max(64), message: string().max(2000), stack: string().max(8000).optional(), url: string().max(500), note: string().max(500).optional(), digest: string().max(200).optional() }`
- `errorFiltersSchema { status?, source?, level?, from?: YYYY-MM-DD, to?: YYYY-MM-DD, id?: uuid }` (invalid values, including impossible calendar dates, are dropped, not rejected)
- `errorStatusChangeSchema { id: uuid(), status: enum(['acknowledged','resolved','open']) }`
- `roleSchema = enum(['admin','area_lead','operator','support'])` (shared)

No LLM boundary in this change.

## Risks / Trade-offs

- **Supabase CLI on Podman may not work** (named pipe, volume mounts) → timeboxed spike + cloud dev fallback (D3).
- **Repository lives inside OneDrive** (`...\cursor\Epuyen Bot`, accepted by the user) → `node_modules` sync load, file locks, and bind-mount issues with Podman → keep Supabase data in Podman named volumes (not bind mounts) and watch for EBUSY/EPERM errors during install.
- **Next 15 `forbidden()` API stability** → accepted: `experimental.authInterrupts` enabled; revisit when upgrading Next (flag may become stable or change shape). `requireRole` takes `forbidden` as an injected port, so swapping the mechanism touches only the server wiring.
- **`pg_cron` locally** → purge function testable without the scheduler; schedule applied conditionally.
- **Redaction false positives** (e.g. long numeric ids masked) → accepted; errors lose some detail but never leak personal data.
