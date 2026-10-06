# Acceptance Matrix (independent verification)

Scenarios are copied **literally** from `openspec/changes/foundation-workspace-auth/specs/**/spec.md`.

**Change:** `foundation-workspace-auth`
**Date:** 2026-10-05
**Author:** independent acceptance verifier (NOT the apply session)
**Code under test:** branch `feature/foundation-workspace-auth` at `75eaf44`
**Environment:** Windows 11, PowerShell, Node v24.13.1, Podman machine `podman-machine-default`, local Supabase stack (`supabase_db_Epuyen_Bot`, API `http://127.0.0.1:54321`), Next.js dev server (`npm run dev`, Turbopack) on `http://localhost:3000`. All 7 migrations (`20260930000100` … `20261005000600`) were already applied; none were re-applied.

## Method and harness

Every scenario below has evidence gathered in this session, independent of the implementer's suites. `npm test` / `npm run test:db` are cited only as supporting evidence.

- **HTTP (node fetch):** a throwaway script `scripts/.tmp-http.mjs`, run as `node --env-file=.env.local scripts/.tmp-http.mjs <phase>` with the local test password in `ACC_PW`. It signed in with `@supabase/ssr` `createServerClient` (cookie jar) + `signInWithPassword`, or submitted the SSR login form **without JavaScript** (multipart POST of the hidden `$ACTION_*` fields + `email`/`password`/`next`, `redirect: 'manual'`). It called the app, PostgREST (`/rest/v1`), Storage (`/storage/v1`) and GoTrue (`/auth/v1`) with the user's JWT or the anon key. Phases: `trace`, `nojs`, `dates`, `forbidden`, `report`, `maxsize`, `rest`, `storage`, `signup`, `lockout`.
- **Browser MCP:** `cursor-ide-browser` (one dedicated tab), with snapshots, screenshots, `Runtime.evaluate` probes (fetch interception, `performance` entries, reload markers) and script-disabled checks.
- **DB (rolled back):** `Get-Content scripts/.tmp-db.sql | podman exec -i supabase_db_Epuyen_Bot psql -U postgres -d postgres`. Every mutating test (T02–T13) runs inside `begin; … rollback;`; RLS tests use `set local role authenticated; set local request.jwt.claims = '{"sub":"<user>","role":"authenticated"}'`. Fixed ids: test operator `3f23c5b0-…-391f0ca102e7` (E2E), org A `1b52044c-…-47a34db9c3ee` (`epuyen`), admin `0f53c755-…-481f`; org B / user B / user C are created **inside** the transaction.
- **Redaction probe:** `npx tsx scripts/.tmp-redact.ts`, importing `../packages/shared/src/redact` and `../apps/web/src/features/errors/log-error` directly, with the spec's literal inputs plus my own corpus. Secret-like fixtures (base64 cookies, `sb_secret_…`, JWTs) were built at runtime.
- **Manual:** npm scripts run from the repo root.

All temp scripts were deleted before the commit. Test account: `e2e.operator@epuyen.local` (local only). The seed admin password was never typed, printed or used to sign in.

## Scenarios

### operator-auth

### Scenario: Valid credentials

- **WHEN** an active operator submits correct email and password
- **THEN** the operator is redirected to the panel home (`/inbox`) and sees their name in the top bar

**Evidence (required):**
- Tool used: browser MCP
- Command / steps: open `/login`, fill the test account's email and password, click "Ingresar"; read the URL and the top-bar snapshot.
- Result: PASS
- Notes: Landed on `/inbox`; the top bar shows "E2E Operator · Operador" (`reports/assets/2026-10-05-acceptance-inbox-topbar.png`).

---

### Scenario: Invalid credentials

- **WHEN** the submitted email or password is wrong
- **THEN** the login page shows "Email o contraseña incorrectos." without revealing which field failed

**Evidence (required):**
- Tool used: browser MCP
- Command / steps: (a) valid email + wrong password; (b) a nonexistent `@epuyen.local` email + some password.
- Result: PASS
- Notes: Both cases show the same alert, "Email o contraseña incorrectos.", with no per-field hint (`reports/assets/2026-10-05-acceptance-login-invalid-credentials.png`).

---

### Scenario: Invalid input

- **WHEN** the email is not a valid address or the password is empty
- **THEN** the form shows field-level validation errors and no request is sent

**Evidence (required):**
- Tool used: browser MCP
- Command / steps: patch `window.fetch` with a counter and clear `performance` resource entries via `Runtime.evaluate`; submit a malformed email with an empty password; read the counters.
- Result: PASS
- Notes: The fields show "Ingresá un email válido." and "Ingresá tu contraseña."; 0 POSTs and 0 new resource entries were recorded (`reports/assets/2026-10-05-acceptance-login-invalid-input.png`).

---

### Scenario: Submit before JavaScript loads

- **WHEN** the login form is submitted before the page's JavaScript has loaded
- **THEN** the browser sends the credentials in a POST body to the server and the email and password never appear in the URL

**Evidence (required):**
- Tool used: curl-equivalent HTTP (node fetch, phase `nojs`) + browser MCP with scripts disabled
- Command / steps: (1) GET `/login` and inspect the SSR `<form>`; send a multipart POST of the SSR fields to `/login` (`redirect: 'manual'`). (2) In the browser, disable scripts, load `/login`, check that there are no React fiber keys, fill the fields and call native `form.requestSubmit()`.
- Result: PASS
- Notes: The SSR form is `<form action="" encType="multipart/form-data" method="POST">`. The POST got 303 → `/inbox` and set the `sb-127-auth-token` cookie. The password never appeared in any `location`. In the browser: 0 fiber keys, the native submit landed signed in, and the URL had no query credentials. Scripts were re-enabled afterwards.

---

### Scenario: Reload keeps session

- **WHEN** a signed-in operator reloads any panel page
- **THEN** the page renders without redirecting to `/login`

**Evidence (required):**
- Tool used: browser MCP
- Command / steps: signed in on `/inbox`, run `location.reload()`; read `performance.getEntriesByType('navigation')[0].type` and the URL.
- Result: PASS
- Notes: The navigation type is `reload`, the URL stays `/inbox`, and the top bar is rendered.

---

### Scenario: Anonymous access

- **WHEN** an anonymous user opens `/inbox`
- **THEN** they are redirected to `/login?next=/inbox`

**Evidence (required):**
- Tool used: HTTP (node fetch, phase `trace`) + browser MCP
- Command / steps: `fetch('http://localhost:3000/inbox', { redirect: 'manual' })` with no cookies; in a signed-out browser, navigate to `/inbox`.
- Result: PASS
- Notes: 307 with `location: /login?next=/inbox`; the browser ended on `/login?next=%2Finbox`.

---

### Scenario: Return after login

- **WHEN** the user logs in from `/login?next=/support/errors` with a role allowed to see that page
- **THEN** they land on `/support/errors`

**Evidence (required):**
- Tool used: HTTP (phase `nojs`) + DB (temporary role change)
- Command / steps: `update profiles set role='support'` for E2E; no-JS POST of the form served at `/login?next=/support/errors`; GET the returned location with the session cookie.
- Result: PASS
- Notes: 303 → `/support/errors`, and the follow-up GET returned 200 with "Errores del sistema". Afterwards the role was restored to `operator` and verified.

---

### Scenario: Unsafe next parameter

- **WHEN** `next` points to an external URL
- **THEN** it is ignored and the user lands on `/inbox`

**Evidence (required):**
- Tool used: HTTP (phase `nojs`)
- Command / steps: (a) no-JS login from `/login?next=https://evil.example/steal`; (b) the same login with a forged hidden field `next=//evil.example/x`.
- Result: PASS
- Notes: The SSR hidden `next` already renders as `/inbox`. Both POSTs answered 303 → `/inbox`.

---

### Scenario: Inactive profile

- **WHEN** a user with `is_active = false` signs in with valid credentials
- **THEN** the session is terminated and the login page shows "Tu usuario está desactivado. Consultá con un administrador."

**Evidence (required):**
- Tool used: HTTP (phase `lockout`) + DB read
- Command / steps: set `is_active=false` for E2E; no-JS login; GET `/inbox` with the new cookie; GET the redirect target; count `auth.sessions` before and after; GET `/inbox` again with the same cookies.
- Result: PASS
- Notes: Login 303 → `/inbox`, then 307 → `/login?reason=inactive`. The page contains the exact message. `auth.sessions` for the user went 15 → 14, so the session row was deleted. Reusing the cookies gives 307 → `/login`. Afterwards `is_active` was restored to `true` and verified.

---

### Scenario: Missing profile

- **WHEN** a Supabase Auth user without a profile row signs in
- **THEN** the session is terminated and the login page shows "Tu usuario no tiene un perfil asignado."

**Evidence (required):**
- Tool used: HTTP (phase `lockout`) + DB read
- Command / steps: create a temp auth user `acc.noprofile.<random-hex>@epuyen.local` with the admin API and a random password (0 profile rows); no-JS login; GET `/inbox`; count sessions.
- Result: PASS
- Notes: 307 → `/login?reason=no_profile`; the page shows the exact message; the user's sessions went 1 → 0. The temp user was deleted and `auth.users` is back to 2.

---

### Scenario: Operator opens support screen

- **WHEN** a user with role `operator` opens `/support/errors`
- **THEN** a "No tenés permiso para ver esta sección." page is shown with HTTP status 403

**Evidence (required):**
- Tool used: HTTP (phase `forbidden`) + browser MCP
- Command / steps: GET `/support/errors` with the operator's session cookie; navigate there in the browser.
- Result: PASS
- Notes: Status 403 and the body contains "No tenés permiso para ver esta sección."; the browser shows the same page.

---

### Scenario: Logout

- **WHEN** the operator selects "Cerrar sesión"
- **THEN** the session is cleared and the user is redirected to `/login`

**Evidence (required):**
- Tool used: browser MCP
- Command / steps: open the user menu and click "Cerrar sesión"; then `fetch('/inbox', { redirect: 'manual' })` from the page.
- Result: PASS
- Notes: The URL becomes `/login`, and the fetch returns `opaqueredirect`, so the cookie is gone. This was also the final step of the session (browser left signed out).

---

### org-tenancy

### Scenario: Profile linked to auth user

- **WHEN** an admin profile is seeded
- **THEN** the profile id equals the Supabase Auth user id, `org_id` references the seeded organization, `role` is `admin`, and `is_active` is true

**Evidence (required):**
- Tool used: DB read-only (T01) + manual
- Command / steps: `select p.id = u.id, o.slug, p.role, p.is_active from profiles p join auth.users u on u.id = p.id join organizations o on o.id = p.org_id where p.role = 'admin';`, then `npm run db:seed` (see "Seed is idempotent").
- Result: PASS
- Notes: `id_matches_auth = t`, slug `epuyen`, `admin`, `true`. The seed reports org `1b52044c-…` and "admin profile updated".

---

### Scenario: Active operator

- **WHEN** an authenticated active operator calls `current_org_id()`
- **THEN** it returns the operator's organization id

**Evidence (required):**
- Tool used: DB rolled back (T02)
- Command / steps: `begin; set local role authenticated; set local request.jwt.claims = '{"sub":"<E2E>","role":"authenticated"}'; select current_org_id(), current_user_role(); rollback;`
- Result: PASS
- Notes: Returns org A and `operator`.

---

### Scenario: Inactive operator

- **WHEN** an authenticated operator whose profile has `is_active = false` calls `current_org_id()`
- **THEN** it returns null

**Evidence (required):**
- Tool used: DB rolled back (T03)
- Command / steps: `begin; update profiles set is_active=false where id=<E2E>; set local role authenticated; set local request.jwt.claims=…; select current_org_id(), current_user_role(); rollback;`
- Result: PASS
- Notes: Both return `null`.

---

### Scenario: Read isolation

- **WHEN** an operator of organization A selects from `profiles`
- **THEN** only profiles of organization A are returned

**Evidence (required):**
- Tool used: DB rolled back (T04)
- Command / steps: inside the transaction, insert org B, auth user B and profile B; as E2E run `select org_id, count(*) from profiles group by org_id`, `… where org_id = <orgB>`, and `select id from organizations`.
- Result: PASS
- Notes: Only org A is returned (2 profiles), 0 org-B profiles, and only org A in `organizations`.

---

### Scenario: Write isolation

- **WHEN** an operator of organization A attempts to update a profile of organization B
- **THEN** zero rows are affected

**Evidence (required):**
- Tool used: DB rolled back (T05)
- Command / steps: `with u as (update profiles set full_name='Hacked by A' where id=<userB> returning 1) select count(*) from u;`, first as operator and then with E2E promoted to admin of org A (also trying `is_active=false`); then read profile B as postgres.
- Result: PASS
- Notes: 0 rows as operator and 0 rows as admin of A; profile B is unchanged ("Usuario B", active).

---

### Scenario: Inactive operator sees nothing

- **WHEN** an inactive operator selects from any business table
- **THEN** zero rows are returned

**Evidence (required):**
- Tool used: DB rolled back (T03)
- Command / steps: seed one `error_logs` row; promote E2E to admin (worst case); count `profiles`, `organizations`, `error_logs` and `storage.objects` while active (control), then again after `is_active=false`.
- Result: PASS
- Notes: Active control: 2 / 1 / 1 / 0. Inactive: 0 / 0 / 0 / 0.

---

### Scenario: Operator tries to escalate role

- **WHEN** an operator updates their own profile setting `role = 'admin'`
- **THEN** the update is rejected and the role remains unchanged

**Evidence (required):**
- Tool used: DB rolled back (T06) + HTTP REST (phase `rest`)
- Command / steps: SQL `update profiles set role='admin' where id=<E2E>` as authenticated; REST `PATCH /rest/v1/profiles?id=eq.<E2E>` with `{"role":"admin"}` and the user's JWT; then read the role.
- Result: PASS
- Notes: SQL raises P0001 `forbidden_column`; REST returns 400 P0001. The role stays `operator`.

---

### Scenario: Admin tries to re-key a profile

- **WHEN** an admin updates a profile setting `id` to another auth user id
- **THEN** the update is rejected

**Evidence (required):**
- Tool used: DB rolled back (T07)
- Command / steps: with E2E promoted to admin, `update profiles set id=<userC auth id> where id=<E2E>` and `… where id=<admin>`.
- Result: PASS
- Notes: Raises `forbidden_column`: "id and created_at cannot be changed."

---

### Scenario: Foreign avatar path or blank name

- **WHEN** an operator updates their own profile through the REST API with another user's avatar path or a name of only spaces, tabs, NBSP, or zero-width characters
- **THEN** the update is rejected

**Evidence (required):**
- Tool used: HTTP REST (phase `rest`)
- Command / steps: `PATCH /rest/v1/profiles?id=eq.<E2E>` with the user's JWT and `avatar_path` = `<orgA>/<admin>/x.png`, `<orgB>/<E2E>/x.png`, `<orgA>/<E2E>/../<admin>/x.png`; and `full_name` = spaces, tabs, NBSP, ZWSP, or a mix of them.
- Result: PASS
- Notes: Every foreign path returns 400 23514 `profiles_avatar_path_own_folder`, while the own-folder control returns 200. Every blank name returns 400 23514. The profile was restored afterwards.

---

### Scenario: Visually blank name

- **WHEN** an operator sets a name made only of Hangul fillers, LRM/RLM marks, soft hyphens, or combining marks
- **THEN** the update is rejected, while names such as `José Pérez`, `李明` or `Ana María` are accepted

**Evidence (required):**
- Tool used: HTTP REST (phase `rest`)
- Command / steps: PATCH `full_name` with U+3164 ×3, U+115F+U+1160, U+200E/U+200F, U+00AD ×3, combining marks only, and a mix of these; then `José Pérez`, `李明`, `Ana María`.
- Result: PASS
- Notes: Every blank variant returns 400 23514; the three valid names return 200. The name was restored to "E2E Operator".

---

### Scenario: Name with emoji or astral letters

- **WHEN** an operator saves `Ana` followed by 40 emoji, or 41 mathematical bold letters, through the REST API (accepted by the database: at most 80 code points)
- **THEN** their profile still loads and the panel keeps working

**Evidence (required):**
- Tool used: HTTP REST + HTTP app (phase `rest`)
- Command / steps: PATCH `full_name = 'Ana' + 40×U+1F600` (43 code points), then `41×U+1D400`; after each, GET `/inbox` and `/settings/profile` with the session cookie.
- Result: PASS
- Notes: Both PATCHes return 200; `/inbox` returns 200 with the name in the header and `/settings/profile` returns 200. The name was restored.

---

### Scenario: Truncate attempt

- **WHEN** an authenticated operator runs `truncate public.error_logs`
- **THEN** it fails with a permission error

**Evidence (required):**
- Tool used: DB rolled back (T08) + DB read-only
- Command / steps: `begin; set local role authenticated; …; truncate public.error_logs; rollback;`, then `information_schema.role_table_grants` for `authenticated` and `has_table_privilege('authenticated', …, 'MAINTAIN')`.
- Result: PASS
- Notes: "permission denied for table error_logs". The only grants are SELECT/UPDATE on `organizations`, `profiles` and `error_logs`, and MAINTAIN is `false` on all three.

---

### operator-profile

### Scenario: Valid name

- **WHEN** the operator saves a name between 2 and 80 characters
- **THEN** the profile is updated and the top bar shows the new name without a full reload

**Evidence (required):**
- Tool used: browser MCP + DB read
- Command / steps: on `/settings/profile`, set `window.__noReloadMarker = 1`, save "Ana Pérez", then read the marker, the top bar and the DB row.
- Result: PASS
- Notes: "Nombre actualizado." appears, the top bar shows "Ana Pérez", the marker survived (no full reload), and the DB is updated (`reports/assets/2026-10-05-acceptance-profile-valid-name.png`). Restored to "E2E Operator".

---

### Scenario: Invalid name

- **WHEN** the operator saves an empty or 1-character name
- **THEN** a validation error is shown and the profile is unchanged

**Evidence (required):**
- Tool used: browser MCP + DB read
- Command / steps: save "A", then save "".
- Result: PASS
- Notes: Both show "El nombre debe tener entre 2 y 80 caracteres." The DB `full_name` and `updated_at` are unchanged (`reports/assets/2026-10-05-acceptance-profile-invalid-name.png`).

---

### Scenario: Valid image

- **WHEN** the operator uploads a 500 KB PNG
- **THEN** the avatar is stored, `avatar_path` is updated, and the new avatar appears in the top bar

**Evidence (required):**
- Tool used: browser MCP + DB read
- Command / steps: generate a canvas PNG of 500,051 bytes in the page, attach it to `#profile-avatar` via `DataTransfer`, and submit; then query `storage.objects` and `profiles.avatar_path`, and inspect the header `<img>`.
- Result: PASS
- Notes: "Foto actualizada." appears. The object is stored at `<orgA>/<E2E>/82cf84fd-….png` (500051 bytes, image/png), `avatar_path` matches, and the header `<img>` loaded (`naturalWidth` 381) (`reports/assets/2026-10-05-acceptance-profile-avatar.png`). The object was removed and `avatar_path` reset to null afterwards.

---

### Scenario: Invalid file

- **WHEN** the operator uploads a 3 MB image or a PDF
- **THEN** the upload is rejected with "La imagen debe ser JPG, PNG o WebP de hasta 2 MB." and nothing is stored

**Evidence (required):**
- Tool used: browser MCP + DB read
- Command / steps: upload a 3,441,458-byte PNG, a PDF (`application/pdf`), and PDF bytes declared as `image/png`; then count objects and read `avatar_path`.
- Result: PASS
- Notes: All three show the exact message. The object count and `avatar_path` are unchanged; the spoofed MIME type was rejected by the server sniff (`reports/assets/2026-10-05-acceptance-profile-invalid-file.png`).

---

### Scenario: Writing another user's folder

- **WHEN** a request tries to write to `avatars/{org_id}/{other_user_id}/`
- **THEN** the storage policy rejects it

**Evidence (required):**
- Tool used: HTTP Storage API (phase `storage`)
- Command / steps: as the operator, `supabase.storage.from('avatars').upload()` to `<orgA>/<admin>/…`, `<orgB>/<userB>/…` and `<orgB>/<E2E>/…`; control upload to `<orgA>/<E2E>/…`.
- Result: PASS
- Notes: All three foreign uploads fail with "new row violates row-level security policy"; the control upload is stored. The control object was deleted.

---

### Scenario: Deleting another user's avatar

- **WHEN** an operator deletes an object under another user's or another organization's avatar folder
- **THEN** zero objects are deleted

**Evidence (required):**
- Tool used: HTTP Storage API (phase `storage`)
- Command / steps: the service role plants victim objects under `<orgA>/<admin>/` and `<orgB>/<userB>/`; the operator calls `remove([...])`; the service role re-lists.
- Result: PASS
- Notes: `remove` returns 0 deleted and both victims are still present. The victims were deleted by the service role afterwards.

---

### Scenario: Listing other organizations' avatars

- **WHEN** an operator lists objects of the `avatars` bucket
- **THEN** only objects under their own organization's folder are returned (public image URLs keep working)

**Evidence (required):**
- Tool used: HTTP Storage API (phase `storage`)
- Command / steps: the operator lists the root, `<orgB>` and `<orgA>`; anonymous GET `/storage/v1/object/public/avatars/<orgB victim>`.
- Result: PASS
- Notes: The root lists only the org A folder, `<orgB>` lists `[]`, and `<orgA>` lists its user folders. The public URL returns 200 `image/png`.

---

### Scenario: No avatar

- **WHEN** an operator named "Ana Pérez" has no avatar
- **THEN** the UI shows "AP"

**Evidence (required):**
- Tool used: browser MCP
- Command / steps: with `full_name` "Ana Pérez" and `avatar_path` null, read the header avatar and the profile preview.
- Result: PASS
- Notes: Both show "AP" (`reports/assets/2026-10-05-acceptance-profile-valid-name.png`).

---

### error-tracking

### Scenario: Trace id generated

- **WHEN** a request arrives without `x-trace-id`
- **THEN** a new id is generated and returned in the response header `x-trace-id`

**Evidence (required):**
- Tool used: HTTP (phase `trace`)
- Command / steps: two GETs to `/login`, POST `/api/errors/report` and GET `/inbox`, all without the header; read the `x-trace-id` response header.
- Result: PASS
- Notes: Every response carries a UUID (200, 401 and 307 alike), and the two `/login` ids differ.

---

### Scenario: Error with personal data

- **WHEN** a server error message contains "DNI 30123456, tel 2945123456, token=abc"
- **THEN** the stored message and details contain masked values and never the raw DNI, phone, or token

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`) + HTTP (phase `report`) + DB read
- Command / steps: `redactText()` and `buildErrorLogRow()` on the literal string; a valid authenticated report with a similar message and note; read the stored row.
- Result: PASS
- Notes: Output is "DNI [dni], tel [phone], token=[redacted]". The stored row has message "Fallo DNI [dni] tel [phone] token=[redacted]" and note "escribir a [email]", with none of the raw values in message or details. The rows were deleted.

---

### Scenario: Argentine formats and JSON secrets

- **WHEN** a logged text contains `02945-15-123456`, `(02945) 451234`, `+54 (2945) 451234`, `2945.451234`, DNI `30 123 456` or `30-123-456`, and `{"refresh_token":"abc123xyzSECRET"}`
- **THEN** every phone, DNI, and secret value is masked

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: each literal through `redactText`; assert the raw token is absent and the expected placeholder is present.
- Result: PASS
- Notes: 8/8 inputs masked.

---

### Scenario: Quoted secrets and glued DNIs

- **WHEN** a logged text contains `password="hunter2pass"`, `{ password: 'hunter2pass' }`, `token: "abc"`, `{"password":"hun\"ter2"}`, `dni_30123456.pdf`, `30123456_frente.jpg`, `nro.30123456`, or `Doc.30.123.456`
- **THEN** every secret value and DNI is masked

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: each literal through `redactText`.
- Result: PASS
- Notes: 9/9 inputs masked, including the escaped-quote value.

---

### Scenario: DNIs next to digits and dots

- **WHEN** a logged text contains `30123456.1.pdf`, `dni_30123456.2024.pdf`, `v2.30123456`, `0.30123456`, `1.30.123.456`, or `x 1234567.89`
- **THEN** every DNI is masked

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: each literal through `redactText`.
- Result: PASS
- Notes: 6/6 inputs masked.

---

### Scenario: Phones next to other numbers

- **WHEN** a logged text contains `calle 123 2945 451234`, `123 294 445 1234`, `2026 011 4555-6677`, `dni 30123456 11 4567 8901`, `30123456` and `011 4567 8901` on consecutive lines, `+54 9 294 445-1234`, `nro 12 294 445 1234`, `2026-10-05 294 445-1234`, `2945 451 234`, `+54-9-294-445-7788`, `+54.9.294.445.7788`, or `DNI 30 123 456 1830hs`
- **THEN** every phone is masked whole as a phone and every DNI is masked

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: each literal through `redactText`; assert the whole phone is replaced by a single `[phone]` and no digit group of the phone survives.
- Result: PASS
- Notes: 12/12 inputs; every phone is masked whole and every DNI becomes `[dni]`.

---

### Scenario: Secrets with quotes or after a key word

- **WHEN** a logged text contains `password=Abc'123!xyz`, `token=ab"cdefgh`, `missing key: token: abc123secret`, `config key: secret = s3cr3tvalue`, `password=monkey:Zx91`, `password: Turkey=2024!`, `missing key: service_key: abc123secret`, `missing key: session: abc123secret`, `password_confirmation=hunter2pass`, `{"passwordHash":"h4shvalue"}`, or `{ refresh_token_hash: 'abc123hash' }`
- **THEN** every secret value is masked whole

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: each literal through `redactText`; assert no fragment of the value remains.
- Result: PASS
- Notes: 11/11 inputs masked whole.

---

### Scenario: Serialized headers and inspected objects

- **WHEN** a logged text contains `{"authorization":"Basic dXNlcjpwYXNz"}`, `{"Authorization": "Token abc123opaque"}`, `authorization=Basic dXNlcjpwYXNz`, `{"cookie":"sid=abc123def"}`, `{ 'x-api-key': 'sk_live_abc123' }`, `missing key: 'token': abc123secret`, `{"set-cookie":["sid=abc123def; Path=/"]}`, `{ 'set-cookie': [ 'sid=abc123def' ] }`, `Map(1) { 'cookie' => 'sid=abc123def' }`, `{"authorization":"Bearer abc","cookie":"sid=abc123def"}`, a `set-cookie` array printed over several lines, or `sb-<ref>-auth-token.0=base64-…` (raw, JSON, or inspected)
- **THEN** every credential is masked

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: each literal; a multi-line `util.inspect` of a `set-cookie` array; `sb-127-auth-token.0` in raw, JSON and inspected forms with a runtime-built base64 value.
- Result: PASS
- Notes: 15/15 inputs; no credential survives, and the Bearer case still masks the following cookie pair.

---

### Scenario: Redaction contract corpus

- **WHEN** any personal-data or secret token of the contract corpus appears in any separated context, next to other numbers, or paired with another token (DNIs also in glued contexts)
- **THEN** the redacted text does not contain that token

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: my own corpus, independent of the implementer's: 31 in-contract tokens (emails, CUITs, phone variants, DNI variants, key=value / JSON / single-quoted secrets, `sb_secret_…`, JWTs) × separated contexts (blanks, punctuation, quotes, brackets, URL, JSON, newlines) × numeric neighbours × glued contexts (DNIs only) + all token pairs. Shapes listed as out of contract in the spec were skipped.
- Result: PASS
- Notes: 3,349 cases, 0 failures. `npm test` (469 tests) is supporting evidence only.

---

### Scenario: UUIDs stay intact

- **WHEN** a logged text contains a random UUID, alone, inside a URL such as `/support/errors?id=<uuid>`, or glued to `_`, letters, or digits such as `avatar_<uuid>.png`, `id<uuid>`, or `<uuid>abc`
- **THEN** the UUID is unchanged

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: 5,000 `crypto.randomUUID()` values × 8 contexts: `<uuid>`, `/support/errors?id=<uuid>`, `avatar_<uuid>.png`, `id<uuid>`, `<uuid>abc`, `<uuid>_v2`, `7<uuid>`, `<uuid>9`.
- Result: PASS
- Notes: 40,000/40,000 unchanged.

---

### Scenario: Oversized input

- **WHEN** a 200 KB message or stack is logged
- **THEN** it is truncated before redaction and logging completes in under 200 ms

**Evidence (required):**
- Tool used: redaction probe (`npx tsx`)
- Command / steps: 200 KB adversarial messages and stacks (digits, dotted groups, repeated `"password":"\` units, separators) through `buildErrorLogRow()`, timed with `performance.now()`; `redactText()` on 200 KB.
- Result: PASS
- Notes: 0.3–38.7 ms per row; message ≤ 2000 chars and details capped. Direct `redactText` takes about 3 ms and the output ends with `[truncated]`. The 8192-char details cap applies before JSON re-escaping (one escape-heavy case serialized to 10,952 chars); this is consistent with the implementation and not a spec violation.

---

### Scenario: Server error with signed-in operator

- **WHEN** an unhandled server error happens during a request of an active operator
- **THEN** the stored row has that operator's `org_id` and `user_id`, so admins of the organization can see it

**Evidence (required):**
- Tool used: HTTP (phase `dates`) + DB rolled back (`.tmp-db2.sql`)
- Command / steps: with E2E temporarily `support`, trigger a server render error on `/support/errors` using a malformed filter fixture; read the newest row; then `begin; set local role authenticated; set local request.jwt.claims='{"sub":"<admin>",…}'; select count(*) from error_logs where id='d4d3cc9a-…'; rollback;`
- Result: PASS
- Notes: Row `d4d3cc9a…` has source `web`, origin `server` (onRequestError, routeType render), `org_id` = org A and `user_id` = E2E. The org A admin sees it (count 1). Role restored; row deleted.

---

### Scenario: Insert only by server

- **WHEN** an authenticated operator tries to insert into `error_logs` from the browser
- **THEN** the insert is rejected (service role only)

**Evidence (required):**
- Tool used: DB rolled back (T09) + HTTP REST (phase `rest`)
- Command / steps: SQL insert as authenticated (E2E promoted to admin); REST `POST /rest/v1/error_logs` and `POST /rest/v1/rpc/insert_client_error_report` with the user's JWT.
- Result: PASS
- Notes: SQL gives "permission denied"; REST insert and REST RPC both return 403 42501.

---

### Scenario: Anonymous report

- **WHEN** a request without a valid session posts a report
- **THEN** the endpoint responds 401 without parsing the body and stores nothing

**Evidence (required):**
- Tool used: HTTP (phase `report`) + DB read
- Command / steps: POST `/api/errors/report` with no cookie: (a) a 20 KB malformed (non-JSON) body; (b) a valid body. Count `error_logs`.
- Result: PASS
- Notes: Both return 401 `unauthenticated`; the malformed body did not produce 400 or 413, so it was not parsed. Stored 0.

---

### Scenario: Oversized report

- **WHEN** an authenticated operator posts a body larger than 16 KB
- **THEN** the endpoint responds 413 and stores nothing

**Evidence (required):**
- Tool used: HTTP (phase `report`) + DB read
- Command / steps: a 17 KB body with `content-length`; the same body chunked (`ReadableStream`, `duplex: 'half'`, no content-length).
- Result: PASS
- Notes: Both return 413 `too_large`; stored 0.

---

### Scenario: Report flood

- **WHEN** an authenticated operator posts an 11th report within one minute
- **THEN** the endpoint responds 429 and stores nothing

**Evidence (required):**
- Tool used: HTTP (phase `report`) + DB read
- Command / steps: 11 sequential valid reports, each with `x-trace-id` equal to `body.traceId`.
- Result: PASS
- Notes: Ten 201s, then 429; exactly 10 rows stored, so the 11th stored nothing. Rows deleted.

---

### Scenario: Maximum-size reports still count

- **WHEN** an authenticated operator posts 11 valid reports of about 9.5 KB each (details truncated on storage) within one minute
- **THEN** the 11th responds 429

**Evidence (required):**
- Tool used: HTTP (phase `maxsize`) + DB read
- Command / steps: 11 bodies of 9,420 bytes each (large note/stack); then inspect the stored details.
- Result: PASS
- Notes: Ten 201s, then 429; 10 rows, all with truncated details. Rows deleted.

---

### Scenario: Concurrent flood

- **WHEN** an authenticated operator sends 50 reports concurrently
- **THEN** at most 10 are stored and the rest respond 429

**Evidence (required):**
- Tool used: HTTP (phase `report`) + DB read
- Command / steps: `Promise.all` of 50 valid reports, starting from an empty 60 s window.
- Result: PASS
- Notes: Status counts `{201: 10, 429: 40}`; 10 rows stored. Rows deleted.

---

### Scenario: Invalid limit arguments

- **WHEN** the report function is called with a null user, a null or zero limit, or a null or zero window
- **THEN** it raises `invalid_argument` and stores nothing

**Evidence (required):**
- Tool used: DB rolled back (T12)
- Command / steps: as `service_role`, a `do $$ … $$` loop calling `insert_client_error_report(<orgA>, uid, 'acc-t12', 'probe', '{}', lim, win)` for the 5 cases; count `error_logs` before and after.
- Result: PASS
- Notes: All 5 cases raise `22023 invalid_argument`; `error_logs` is 0 before and after.

---

### Scenario: UI crash

- **WHEN** a panel page throws during render
- **THEN** the error boundary shows "Ocurrió un error. Código: XXXXXXXX" (first 8 characters of the trace id) and an `error_logs` row with source `web` is created

**Evidence (required):**
- Tool used: browser MCP + DB read
- Command / steps: with E2E temporarily `support`, open the `/support/errors` URL that throws during render; read the boundary text; query `error_logs`.
- Result: PASS
- Notes: The boundary shows "Ocurrió un error. Código: 96876A1A". The client row has source `web`, origin `client` and trace `96876a1a…`, and its `digestRef` matches the server row (`reports/assets/2026-10-05-acceptance-error-boundary.png`). Role restored; rows deleted.

---

### Scenario: Mismatched trace id

- **WHEN** the report body trace id differs from the request header trace id
- **THEN** the endpoint responds 400 and stores nothing

**Evidence (required):**
- Tool used: HTTP (phase `report`) + DB read
- Command / steps: an authenticated report with `x-trace-id: <uuid A>` and `body.traceId: <uuid B>`.
- Result: PASS
- Notes: 400 `trace_mismatch`; stored 0.

---

### Scenario: Resolve an error

- **WHEN** a support user marks an open error as resolved
- **THEN** status becomes `resolved`, `resolved_by` and `resolved_at` are set automatically, and no other field changes

**Evidence (required):**
- Tool used: DB rolled back (T10) + browser MCP + DB read (`.tmp-db2.sql`)
- Command / steps: (1) SQL: insert an open row, snapshot it, then as E2E `support` run `update error_logs set status='resolved'` and compare all other columns. (2) UI: as support, open error 96876A1A and click "Marcar resuelto"; diff `row_to_json(e) - 'status' - 'resolved_by' - 'resolved_at'` before and after.
- Result: PASS
- Notes: SQL: 1 row, `resolved`, `resolved_by` = caller, `resolved_at` set, other fields unchanged. UI: `resolved`, `resolved_by` = E2E, `resolved_at` 19:17:31 UTC, empty diff (`reports/assets/2026-10-05-acceptance-support-resolved.png`). Role restored; rows deleted.

---

### Scenario: Immutable fields

- **WHEN** an update tries to change the message of an error
- **THEN** the update is rejected

**Evidence (required):**
- Tool used: DB rolled back (T11)
- Command / steps: as E2E `support`, `update error_logs set message='tampered' where id=<T10 row>`.
- Result: PASS
- Notes: Raises `forbidden_column`: "Only status can be changed on error_logs."

---

### Scenario: Impossible filter date

- **WHEN** a support user opens `/support/errors?from=2026-02-31` or `?to=0000-01-01` (year outside 2000–2100)
- **THEN** the invalid date is ignored and the list renders without that filter

**Evidence (required):**
- Tool used: HTTP (phase `dates`)
- Command / steps: with E2E `support` and two rows planted by the service role (2026-01-15 and now), GET `?from=2026-02-31` and `?to=0000-01-01`; controls `?from=2026-03-03` and `?to=2026-02-01`.
- Result: PASS
- Notes: Both invalid URLs return 200 with both rows listed and the date inputs empty. Control `from` hides the January row and keeps the input value; control `to` hides the "now" row. Rows deleted; role restored.

---

### Scenario: Old errors purged

- **WHEN** the purge job runs
- **THEN** rows with `created_at` older than 30 days are deleted and newer rows remain

**Evidence (required):**
- Tool used: DB rolled back (T13)
- Command / steps: insert rows at 31 d, 30 d + 1 min, 29 d and now; `select public.purge_error_logs();` then list the remaining trace ids; rollback.
- Result: PASS
- Notes: Returns 2; only `acc-t13-new` (29 d) and `acc-t13-now` remain.

---

### Scenario: Purge scheduled

- **WHEN** the migrations are applied on a database with `pg_cron`
- **THEN** a job `purge-error-logs` runs `purge_error_logs()` daily at 06:00 UTC

**Evidence (required):**
- Tool used: DB read-only (T14)
- Command / steps: `select jobname, schedule, command, active from cron.job where jobname='purge-error-logs'; select extname from pg_extension where extname='pg_cron';`
- Result: PASS
- Notes: `purge-error-logs` | `0 6 * * *` | `select public.purge_error_logs()` | active; `pg_cron` is installed.

---

### local-dev-environment

### Scenario: Fresh start

- **WHEN** a developer with Node >= 20 and a running Podman machine runs `npm install`, `npm run db:start`, and `npm run dev`
- **THEN** Supabase services respond locally and the web app serves the login page at `http://localhost:3000/login`

**Evidence (required):**
- Tool used: manual + HTTP
- Command / steps: stop the dev server; `node --version`; `podman machine list`; `npm install --no-audit --no-fund`; `npm run db:start`; `npm run dev`; once "Ready", fetch `<API>/auth/v1/health`, `<API>/rest/v1/` (anon key) and `http://localhost:3000/login`.
- Result: PASS
- Notes: Node v24.13.1, Podman machine running. `npm install` exit 0 ("up to date"); `db:start` exit 0 (API_URL printed); dev "Ready". Auth health 200, REST 200, `/login` 200 with the password input. Caveats: run on an existing checkout with the stack already up (not a pristine machine). `npm install` rewrote 6 `"dev": true` → `"devOptional": true` flags in `package-lock.json` (npm-version metadata noise); the file was reverted with `git checkout`.

---

### Scenario: Supabase CLI cannot run on Podman

- **WHEN** `npm run db:start` fails because the container runtime is incompatible
- **THEN** the README documents the fallback: pointing `.env.local` to a dedicated Supabase cloud project for development and applying migrations with `npm run db:push`

**Evidence (required):**
- Tool used: manual (document review)
- Command / steps: read `README.md` § "Fallback: Supabase cloud project for development" and the scripts table.
- Result: PASS
- Notes: The README documents a dedicated dev-only cloud project; pointing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (+ `SUPABASE_PROJECT_REF`, `SUPABASE_CLOUD_DB_PASSWORD`) in `.env.local`; `npx supabase link` + `npm run db:push`; mirroring the auth settings in the dashboard. The scripts table lists `db:push`. The failure itself was not induced (Podman works here); this scenario's THEN is documentation-only.

---

### Scenario: Reset and seed

- **WHEN** a developer runs `npm run db:reset` followed by `npm run db:seed`
- **THEN** all migrations apply without errors, the organization "Municipalidad de Epuyén" exists, and one admin profile exists with the email from `SEED_ADMIN_EMAIL`

**Evidence (required):**
- Tool used: manual + DB read-only (partial)
- Command / steps: NOT run: `npm run db:reset` wipes local users and data, which this verification is forbidden to do. Partial evidence: migration list (7/7 applied); `select count(*) from organizations where slug='epuyen' and name='Municipalidad de Epuyén'` → 1; admin profiles → 1; a node one-liner compared the admin's auth email with `SEED_ADMIN_EMAIL` and printed only a boolean.
- Result: BLOCKED (reviewer pass) → **PASS (follow-up, 2026-10-05, user-authorized reset)**
- Notes: Missing env: a disposable database where a reset is allowed. On the current DB the end state matches the THEN: org exists, exactly 1 admin profile, email equals `SEED_ADMIN_EMAIL` → `true`. The reset path itself is unverified here; `npm run test:db` (136 tests on the migrated schema) is supporting evidence only. To close it, run on a throwaway stack or the CI database.
- **Follow-up evidence (executed by the apply session after explicit user authorization to run the reset once; recorded here for traceability):**
  - `npm run db:reset` → exit 0; output "Applying migration" for all 7 files (`20260930000100_foundation.sql` … `20261005000600_complete_invisible_name_set.sql`) and "Finished supabase db reset".
  - `npm run db:seed` → exit 0; "Seed OK - organization "epuyen" (…); admin user created; admin profile created." The admin password came from `.env.local` and was never typed or printed.
  - Service-role check script: organizations `['Municipalidad de Epuyén']`; admin profiles `1`; admin auth email equals `SEED_ADMIN_EMAIL` → `true` (boolean only); auth users after seed `1`.
  - The reset wiped the local-only test operator; it was recreated (`e2e.operator@epuyen.local`, "E2E Operator", role `operator`, active) and signs in. `npm run test:db` after the reset: Files=7, Tests=136, PASS.

---

### Scenario: Seed is idempotent

- **WHEN** `npm run db:seed` runs twice
- **THEN** no duplicate organization or admin is created and the command exits successfully

**Evidence (required):**
- Tool used: manual + DB read-only
- Command / steps: counts before; `npm run db:seed` twice, recording `$LASTEXITCODE`; counts after.
- Result: PASS
- Notes: Both runs exit 0 with "Seed OK - organization "epuyen" (1b52044c-…); admin user already existed; admin profile updated." Counts before = after: 1 org, 1 `epuyen`, 1 admin profile, 2 auth users. The seed reads `SEED_ADMIN_PASSWORD` from `.env.local` only to validate its env; it never changes an existing user's password, and the value was never typed or printed.

---

### Scenario: Missing variable

- **WHEN** the web app starts without `NEXT_PUBLIC_SUPABASE_URL`
- **THEN** startup fails with an error naming the missing variable

**Evidence (required):**
- Tool used: manual (`scripts/.tmp-missing-env.mjs`)
- Command / steps: spawn `npx next dev --turbopack -p 3105` in `apps/web` with `NEXT_PUBLIC_SUPABASE_URL=''` (overriding `.env.local`); capture the exit code and stderr.
- Result: PASS
- Notes: Exit code 1: "Failed to load next.config.ts … MissingEnvError: Missing or invalid environment variables: NEXT_PUBLIC_SUPABASE_URL".

---

### Scenario: Self sign-up attempt

- **WHEN** an anonymous client calls the Supabase sign-up endpoint with the public anon key
- **THEN** the request is rejected and no auth user is created

**Evidence (required):**
- Tool used: HTTP (phase `signup`) + DB read
- Command / steps: `POST <API>/auth/v1/signup` with `apikey: <anon>` and a random email/password; count `auth.users` before and after, and rows with that email.
- Result: PASS
- Notes: 422 `signup_disabled`; `auth.users` 2 → 2; 0 rows with that email.

---

### Scenario: Clean checkout passes checks

- **WHEN** a developer runs the four quality scripts on a clean checkout with the local stack running
- **THEN** all four exit with code 0

**Evidence (required):**
- Tool used: manual
- Command / steps: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:db` from the repo root with the stack running, recording each `$LASTEXITCODE`.
- Result: PASS
- Notes: typecheck 0, lint 0, test 0 (39 files / 469 tests), test:db 0 (Files=7, Tests=136, Result: PASS; a PowerShell `NativeCommandError` banner came from a psql NOTICE on stderr, not a failure). Run on the current working tree (committed state, no local edits), not on a fresh clone.

---

## Summary

| Capability | Total | Pass | Fail | Blocked |
|---|---|---|---|---|
| operator-auth | 12 | 12 | 0 | 0 |
| org-tenancy | 12 | 12 | 0 | 0 |
| operator-profile | 8 | 8 | 0 | 0 |
| error-tracking | 26 | 26 | 0 | 0 |
| local-dev-environment | 7 | 7 | 0 | 0 |
| **Total** | **65** | **65** | **0** | **0** |

**Verdict:** PASS. The independent reviewer pass ended BLOCKED (missing env) with 64/65 PASS and no functional failures. The only open item, `local-dev-environment` / "Reset and seed", was then run once with explicit user authorization (follow-up evidence in that scenario) and passes.

### Restoration and cleanup

- Test operator `e2e.operator@epuyen.local` restored and verified: `full_name` "E2E Operator", `avatar_path` null, role `operator`, `is_active` true. Every temporary role/`is_active`/name change was reverted right after its scenario.
- Data back to the baseline: `storage.objects` 0, `error_logs` 0, `auth.users` 2, `organizations` 1, `profiles` 2. The temp no-profile auth user was deleted. The 10 `auth.sessions` rows created by my sign-ins (≥ 2026-10-05 19:07 UTC) were deleted; the 5 earlier sessions are untouched.
- `package-lock.json` change from `npm install` reverted; dev server stopped; browser left signed out; temp scripts `scripts/.tmp-*` deleted.

**Rule:** This matrix was executed by a reviewer who did **not** run `/opsx:apply` for this change. The implementer's `npm test` / `npm run test:db` were used only as supporting evidence.
