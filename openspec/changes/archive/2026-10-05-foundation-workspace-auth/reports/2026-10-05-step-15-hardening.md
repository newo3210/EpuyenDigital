# Step 15 — Adversarial-review hardening: verification report

- **Change:** `foundation-workspace-auth`
- **Branch:** `feature/foundation-workspace-auth`
- **Date:** 2026-10-05
- **Scope (user-approved):** majors J-1, J-2, J-3 plus cheap minors M-1, M-3, M-4, M-5, M-6, M-7, M-10, M-13. Server errors attach the operator's org (`attach_org`). Last-admin protection deferred to `areas-operators-admin`. Signup disabled.
- **Source findings:** `reports/2026-10-05-adversarial-review.md`

## Commits

| Commit | Task | Summary |
|---|---|---|
| `c53bded` | 15.2 (J-1) | Login form bound to the server action; native submits POST, credentials never land in a URL |
| `93da9b0` | 15.3 / 15.4 (J-2, J-3 a-b) | Linear-time redaction (bounded quantifiers, 16 KB input cap), Argentine phone/DNI formats, JSON / key=value / JWT / `sb_secret_` secrets |
| `e3e9dcd` | 15.5 (J-3 c-d) | Report endpoint: auth, then advisory rate limit (10/min/user), then bounded body (16 KB), then schema |
| `fc11af9` | 15.6 (Q-1) | Server errors attach the signed-in operator's org and user |
| `0c9c171` | 15.7 (M-1) | Impossible calendar dates dropped from error filters |
| `eae008b` | 15.8 (M-3, M-4, M-6, M-10) | Purge cron job asserted, least-privilege grants, immutable `id`/`created_at`, profile check constraints, org-scoped avatar listing, rate-limit index |
| `a677b0f` | 15.9 (M-5, M-7) | Signup disabled, min password 10 (auth + seed), avatar URL segments encoded |
| `ef7b4cf` | 15.10 fix | `[auth.email] enable_signup` restored to `true` (see finding below) |
| `93ced81` | 15.11 (M-13) | Design layer table and test counts realigned with the code |

ID labels follow `reports/2026-10-05-adversarial-review.md` (corrected in step 16, finding N-14). The rate limit shipped here was advisory: the re-review showed it could be bypassed (N-1, N-2), and step 16 made it atomic.

## Automated checks

| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 problems |
| `npm test` | 39 files, **306 tests passed** (was 253 at verify) |
| `npm run db:reset` | OK (2 migrations) |
| `npm run test:db` | 6 files, **89 tests passed** (was 69 at verify) |
| `npm run db:seed` | OK with signup disabled (Admin API is unaffected) |

## HTTP checks (local dev server + local Supabase)

| Check | Expected | Observed |
|---|---|---|
| `GET /login` form markup | `method="POST"`, no GET fallback | `<form ... action="" encType="multipart/form-data" method="POST">` |
| `POST /auth/v1/signup` (anon key) | rejected | `422 signup_disabled` |
| `POST /api/errors/report` anonymous | 401 | 401 |
| Authenticated, 20 KB body | 413 | `413 {"error":"too_large"}` |
| Authenticated, malformed small body | 400 | `400 {"error":"invalid_body"}` |
| Authenticated, 11th report in window (10 client rows pre-inserted) | 429 | `429 {"error":"rate_limited"}` |

Authenticated requests used real `@supabase/ssr` cookies from a password sign-in with the local e2e operator. The 10 rate-limit rows were removed afterwards.

## Browser smoke

| Step | Result |
|---|---|
| Login as the local operator (temporarily `support`) with `next=/support/errors` | Server action `POST /login 303`, then redirect to `/support/errors` |
| Support screen | Filters and an empty table render ("No hay errores con estos filtros.") |
| `?from=2026-02-31&to=2026-13-01&status=open` | Invalid dates dropped (empty date inputs); valid `status=open` kept; no crash |
| Role restored to `operator`, reload `/support/errors` | 403 page "No tenés permiso para ver esta sección."; "Soporte" link hidden |

Tooling note: the browser automation's click and Enter are synthetic DOM events, so they did not trigger the native form submit. `form.requestSubmit()` (the same path as a real click) worked.

## Finding during verification (fixed)

`[auth.email] enable_signup = false` turns off the **whole email provider** in GoTrue (`EXTERNAL_EMAIL_ENABLED`). Password sign-in then fails with `email_provider_disabled`. Only `[auth] enable_signup = false` (`DISABLE_SIGNUP`) is needed to block signups. Fixed in `ef7b4cf`, and `design.md` was updated first. The cloud project must mirror this: **Authentication → Sign In / Providers → "Allow new users to sign up" off, Email provider enabled.**

## Final DB state

- `profiles`: 1 admin (seed) + 1 operator (`e2e.operator@epuyen.local`, local-only test user).
- `error_logs`: 0 rows.

## Remaining before archive

- 15.11 documentation updates.
- New adversarial review **in a new chat**, scoped to diff `65eb994..HEAD` (writer ≠ reviewer).
- `acceptance-matrix.md`, then human OK, then `/opsx:archive`.
