# Step 11: Unit Tests and Database Verification

- **Change:** `foundation-workspace-auth` — tasks 11.1–11.6
- **Date executed:** 2026-10-01
- **Commit under test:** `c2034ea` (branch `feature/foundation-workspace-auth`)
- **Result:** **PASS** — all unit, database, type and lint checks green; database state equals baseline.

## Environment

| Item | Value |
|---|---|
| OS | Windows 10.0.26200 |
| Node / npm | v24.13.1 / 11.11.0 |
| Local stack | Supabase CLI on Podman (`supabase_db_Epuyen_Bot` healthy) |
| Test runners | Vitest 5 (web: jsdom, shared: node), pgTAP via `supabase test db` |

## 11.1 Baseline (before tests)

```sql
select 'organizations', count(*) from public.organizations
union all select 'profiles', count(*) from public.profiles
union all select 'error_logs', count(*) from public.error_logs
union all select 'avatars_objects', count(*) from storage.objects where bucket_id = 'avatars'
union all select 'auth_users', count(*) from auth.users;
```

| Table | Rows |
|---|---|
| `organizations` | 1 |
| `profiles` | 2 (seeded admin + local e2e operator) |
| `error_logs` | 0 |
| `storage.objects` (`avatars`) | 0 |
| `auth.users` | 2 |

## 11.2 Tests

### Targeted (during development)

Each section ran its own files first (e.g. `npx vitest run apps/web/src/features/errors`, `apps/web/src/presentation/support`, `apps/web/src/middleware.test.ts`) before the full suite.

### Full unit suite — `npm run test`

```
Test Files  36 passed (36)
     Tests  248 passed (248)
```

| Area | Files |
|---|---|
| `packages/shared` | contracts, trace, initials, redact |
| `apps/web` features | auth (safe-next, login-url, sign-in, require-operator, require-role, route-access, sign-out), profile (update-name, upload-avatar), errors (log-error, report-error, request-error, list-errors, change-status) |
| `apps/web` infrastructure | env, session, profiles, error-logs, avatars, avatar-url |
| `apps/web` presentation | login-form, nav-items, user-menu, avatar, profile-name-form, avatar-uploader, error-fallback, error-filters, error-status-actions, error-table, error-detail |
| `apps/web` middleware | trace id generation/reuse, `x-pathname`, anonymous redirect with cookies, public paths |

### Database suite — `npm run test:db`

```
000_smoke.test.sql ............ ok
001_org_isolation.test.sql .... ok
002_profiles_guard.test.sql ... ok
003_error_logs.test.sql ....... ok
004_avatars_storage.test.sql .. ok
All tests successful.
Files=5, Tests=69
Result: PASS
```

Each pgTAP file runs inside a transaction that is rolled back, so fixtures never persist.

## 11.3 Static checks

| Command | Exit code |
|---|---|
| `npm run typecheck` (web `next typegen && tsc`, shared `tsc`, `tsc -p supabase`) | 0 |
| `npm run lint` (web + shared ESLint) | 0 |

## Seed idempotency (spec: local-dev-environment › Seed is idempotent)

`npm run db:seed` executed twice in a row:

```
Seed OK - organization "epuyen" (960a2111-…); admin user already existed; admin profile updated.
Seed OK - organization "epuyen" (960a2111-…); admin user already existed; admin profile updated.
```

Same organization id both times; no new users or profiles (see counts below).

## 11.4 Post-test state

| Table | Before | After |
|---|---|---|
| `organizations` | 1 | 1 |
| `profiles` | 2 | 2 |
| `error_logs` | 0 | 0 |
| `storage.objects` (`avatars`) | 0 | 0 |
| `auth.users` | 2 | 2 |

State equals baseline; no restore needed.

## Spec scenario coverage

| Spec | Scenario | Covered by |
|---|---|---|
| operator-auth | Valid / invalid credentials, invalid input | `sign-in.test.ts`, `login-form.test.tsx` |
| operator-auth | Anonymous access, return after login, unsafe next | `route-access.test.ts`, `middleware.test.ts`, `safe-next.test.ts`, `login-url.test.ts` |
| operator-auth | Inactive profile, missing profile | `require-operator.test.ts`, `001_org_isolation.test.sql` |
| operator-auth | Operator opens support screen | `require-role.test.ts`, `nav-items.test.ts` (403 page: step 12/13) |
| operator-auth | Logout | `sign-out.test.ts`, `session.test.ts`, `user-menu.test.tsx` |
| operator-auth | Reload keeps session | Step 13 (browser) |
| org-tenancy | All scenarios | `001_org_isolation.test.sql`, `002_profiles_guard.test.sql` |
| operator-profile | Valid / invalid name | `update-name.test.ts`, `profile-name-form.test.tsx` |
| operator-profile | Valid image / invalid file | `upload-avatar.test.ts`, `avatar-uploader.test.tsx`, `avatars.test.ts` |
| operator-profile | Writing another user's folder | `004_avatars_storage.test.sql` |
| operator-profile | No avatar | `avatar.test.tsx`, `initials.test.ts` |
| error-tracking | Trace id generated | `trace.test.ts`, `middleware.test.ts` |
| error-tracking | Error with personal data | `redact.test.ts`, `log-error.test.ts`, `report-error.test.ts` |
| error-tracking | Insert only by server | `003_error_logs.test.sql` |
| error-tracking | UI crash | `error-fallback.test.tsx`, `request-error.test.ts` (live: step 13) |
| error-tracking | Mismatched trace id | `report-error.test.ts` (live: step 12) |
| error-tracking | Resolve an error, immutable fields | `003_error_logs.test.sql`, `change-status.test.ts`, `error-status-actions.test.tsx` |
| error-tracking | Old errors purged | `003_error_logs.test.sql` |
| local-dev-environment | Missing variable | `env.test.ts` |
| local-dev-environment | Seed is idempotent | Double seed run above |
| local-dev-environment | Fresh start, CLI fallback, reset and seed | Spike report `2026-09-30-spike-supabase-podman.md` |
| local-dev-environment | Clean checkout passes checks | This report (test, test:db, typecheck, lint) |
