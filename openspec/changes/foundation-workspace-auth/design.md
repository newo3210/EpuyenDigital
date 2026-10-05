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
- `profiles`: select where `org_id = current_org_id()`; update self (`id = auth.uid()`) guarded by trigger `profiles_guard_privileged_columns` that raises `P0001 'forbidden_column'` if a non-admin changes `role`, `org_id`, or `is_active`; admins update rows of their org. Insert/delete: service role only.
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
