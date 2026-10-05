## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [x] 0.1 Confirm `main` is up to date with `origin/main` and the working tree is clean
- [x] 0.2 Create branch `feature/foundation-workspace-auth` from `main` and push it with upstream tracking
- [x] 0.3 Verify current branch with `git branch --show-current`

## 1. Spike: Local Supabase on Podman (timebox 2 h)

- [x] 1.1 Verify Podman machine is running and resolve the `DOCKER_HOST` named pipe
- [x] 1.2 Run `npx supabase init` and `npx supabase start` with `DOCKER_HOST` set; capture output
- [x] 1.3 Run an empty `supabase db reset` and `supabase test db` (sample pgTAP test) to prove migrations and SQL tests work
- [x] 1.4 Decide: local (PASS) or cloud fallback (FAIL); if fallback, create the dev cloud project with the user, fill `.env.local`, verify `supabase db push` and `psql` connectivity
- [x] 1.5 Write `openspec/changes/foundation-workspace-auth/reports/2026-09-30-spike-supabase-podman.md` with commands, outputs and decision

## 2. Monorepo scaffold

- [x] 2.1 Root `package.json` (workspaces `apps/web`, `packages/shared`; scripts `dev`, `build`, `typecheck`, `lint`, `test`, `test:db`, `db:start`, `db:stop`, `db:reset`, `db:push`, `db:seed`), `tsconfig.base.json` strict, `.nvmrc`, `.editorconfig`
- [x] 2.2 `packages/shared` package (TypeScript, no runtime deps besides `zod`) with `src/index.ts` and `src/contracts/`
- [x] 2.3 `apps/web` Next.js 15 + React 19 + Tailwind v4 + ESLint, `src/` layout per design layer mapping (`app`, `presentation`, `features`, `infrastructure`, `contracts`)
- [x] 2.4 Vitest root config with projects for `apps/web` (jsdom) and `packages/shared` (node); Testing Library setup
- [x] 2.5 `.env.example` documenting every variable (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `DOCKER_HOST`)
- [x] 2.6 Write failing test for `infrastructure/env.ts` (missing variable → error naming it), then implement
- [x] 2.7 Root `README.md`: prerequisites, Podman setup, local start, fallback, scripts
- [x] 2.8 Verify `npm run typecheck`, `npm run lint`, `npm run test` pass on the empty scaffold

## 3. Shared logic (TDD)

- [x] 3.1 Write failing tests for `redact.ts` (DNI, CUIT, AR phones incl. `+54 9`, emails, tokens/bearer/apikey, nested objects, depth/size truncation)
- [x] 3.2 Implement `packages/shared/src/redact.ts` until green
- [x] 3.3 Write failing tests for `initials.ts` ("Ana Pérez" → "AP", single name, extra spaces, empty) then implement
- [x] 3.4 Write failing tests for `trace.ts` (generate id, short code = first 8 chars) then implement
- [x] 3.5 Contracts: `roles.ts`, `profile.ts`, `error-log.ts` with Zod schemas from design; schema tests for valid/invalid samples

## 4. Database foundation (SQL tests first)

- [x] 4.1 Write pgTAP tests `supabase/tests/001_org_isolation.test.sql`: two orgs, operators in each; read/write isolation on `profiles`; inactive operator sees zero rows; helpers return null for inactive/no profile
- [x] 4.2 Write pgTAP tests `supabase/tests/002_profiles_guard.test.sql`: operator cannot change own `role`/`org_id`/`is_active` (`forbidden_column`); admin can within org; operator can change own name
- [x] 4.3 Write pgTAP tests `supabase/tests/003_error_logs.test.sql`: authenticated insert rejected; operator cannot select; support/admin select own org; only `status` updatable; `resolved_by`/`resolved_at` set on resolve; `purge_error_logs()` deletes > 30 days only
- [x] 4.4 Write pgTAP tests `supabase/tests/004_avatars_storage.test.sql`: write own folder allowed; other user's folder rejected
- [x] 4.5 Implement migration `supabase/migrations/20260930000100_foundation.sql` (extensions, enums, tables, triggers, helpers, RLS, bucket + storage policies, purge function, conditional `pg_cron` schedule) until all SQL tests pass
- [x] 4.6 Implement `supabase/seed/seed.ts` (idempotent org + admin); test by running twice and asserting counts

## 5. Infrastructure: Supabase clients and repositories

- [x] 5.1 `infrastructure/supabase/{server,browser,admin,middleware}.ts` using `@supabase/ssr`; admin client guarded as server-only
- [x] 5.2 Write failing tests for `repositories/profiles.ts` (get current profile, update name, update avatar path) with a mocked client, then implement
- [x] 5.3 Write failing tests for `repositories/error-logs.ts` (insert via admin, list with filters, change status) then implement

## 6. Auth feature (TDD)

- [x] 6.1 Write failing tests for `features/auth/safe-next.ts` (relative ok; `//evil`, `https://evil`, empty → `/inbox`) then implement
- [x] 6.2 Write failing tests for `features/auth/sign-in.ts` (valid → ok; Supabase error → generic message; invalid input → field errors) then implement
- [x] 6.3 Write failing tests for `requireOperator` (no session → redirect login with next; no profile → sign out + `reason=no_profile`; inactive → sign out + `reason=inactive`; active → profile) then implement
- [x] 6.4 Write failing tests for `requireRole` (allowed → pass; not allowed → forbidden) then implement
- [x] 6.5 `middleware.ts`: session refresh, `x-trace-id` generation/propagation, anonymous redirect on panel paths
- [x] 6.6 `features/auth/sign-out.ts` server action

## 7. Presentation: login and panel shell

- [x] 7.1 `(auth)/login/page.tsx` + form (react-hook-form + `loginSchema`), messages for `reason=inactive|no_profile`, accessible labels and error announcements
- [x] 7.2 `(panel)/layout.tsx` with `requireOperator`, sidebar (Mensajería, Pobladores, Tareas, Configuración, Soporte — role-filtered) and top bar (name, avatar/initials, user menu with "Cerrar sesión")
- [x] 7.3 Placeholder pages `inbox`, `citizens`, `tasks` with empty states; `forbidden` page with 403
- [x] 7.4 Component tests: login form validation, user menu logout, initials avatar fallback

## 8. Operator profile feature

- [x] 8.1 Write failing tests for `features/profile/update-name.ts` (valid, too short, too long, trims) then implement
- [x] 8.2 Write failing tests for `features/profile/upload-avatar.ts` (valid PNG; >2 MB rejected; PDF rejected by magic bytes; previous object deleted) then implement
- [x] 8.3 `(panel)/settings/profile/page.tsx` with name form and avatar uploader; top bar updates after save

## 9. Error tracking feature

- [x] 9.1 Write failing tests for `features/errors/log-error.ts` (redacts before insert; never throws when insert fails) then implement
- [x] 9.2 Write failing tests for `POST /api/errors/report` handler logic (unauthenticated 401; invalid body 400; trace mismatch 400; valid 201 with redacted content) then implement route handler delegating to feature
- [x] 9.3 `(panel)/error.tsx` and `global-error.tsx` reporting and showing the 8-char code
- [x] 9.4 `(panel)/support/errors/page.tsx` (roles `admin`, `support`): list with filters (status, source, level, date), detail drawer, status change actions
- [x] 9.5 Component tests for the support list filters and status change

## 10. Review and Update Existing Unit Tests (MANDATORY)

- [x] 10.1 Review all tests added in this change for coverage of every spec scenario; add missing ones
- [x] 10.2 Remove duplicated or brittle tests; ensure section comments in all new TS/TSX files

## 11. Run Unit Tests and Verify Database State (MANDATORY)

- [x] 11.1 Capture pre-test database baseline (row counts of `organizations`, `profiles`, `error_logs`, `storage.objects` in `avatars`)
- [x] 11.2 Run `npm run test` (targeted, then full) and `npm run test:db`
- [x] 11.3 Run `npm run typecheck` and `npm run lint`
- [x] 11.4 Verify post-test database state matches baseline; restore if needed
- [x] 11.5 Create report `openspec/changes/foundation-workspace-auth/reports/YYYY-MM-DD-step-11-unit-test-and-db-verification.md`
- [x] 11.6 Mark step complete only after tests pass and report exists

## 12. Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [x] 12.1 Ensure local stack and web app are running
- [x] 12.2 `POST /api/errors/report` without session → 401
- [x] 12.3 `POST /api/errors/report` with session and invalid body → 400; with mismatched trace id → 400
- [x] 12.4 `POST /api/errors/report` valid with personal data in message → 201; verify stored row is redacted; delete the row to restore state
- [x] 12.5 `GET /inbox` without session → 307 to `/login?next=/inbox`; response carries `x-trace-id`
- [x] 12.6 Supabase REST as operator: select `error_logs` → empty; update own `role` → rejected
- [x] 12.7 Document all commands and responses in `reports/YYYY-MM-DD-step-12-curl.md`; verify database state equals baseline

## 13. E2E Testing with browser MCP (MANDATORY - AGENT MUST EXECUTE)

- [x] 13.1 Ensure local stack and web app are running; database seeded
- [x] 13.2 Login with wrong password → generic error; with seeded admin → lands on `/inbox` with name in top bar
- [x] 13.3 Reload keeps session; logout returns to `/login`
- [x] 13.4 Deactivate a test operator via SQL, attempt login → inactive message; restore
- [x] 13.5 Operator opens `/support/errors` → forbidden page
- [x] 13.6 Edit name and upload avatar → top bar updates; invalid file → error message; restore original name/avatar
- [x] 13.7 Trigger a test UI error → code shown; support user sees and resolves it; delete test rows
- [x] 13.8 Document scenarios and outcomes in `reports/YYYY-MM-DD-step-13-e2e.md`

## 14. Update Technical Documentation (MANDATORY)

- [x] 14.1 Update `ARCHITECTURE_SDD.md` (EN): real paths, auth flow, RLS helpers, error tracking, local environment decision
- [x] 14.2 Update `STUDENT_DECISION_LOG.md` (ES): flujo de datos del login, por qué RLS con helpers, redacción de datos personales, decisión Podman vs cloud, glosario
- [x] 14.3 Update `docs/data-model.md` if the implemented schema diverged from the design
- [x] 14.4 Update `.planning/REQUIREMENTS.md` traceability (FND-01, FND-06 org, FND-07, FND-08 → implemented) and `.planning/STATE.md`
- [x] 14.5 Update root `README.md` with final commands

## 15. Adversarial Review Fixes (2026-10-05, design D11)

- [x] 15.1 Update specs (error-tracking, operator-auth, org-tenancy, operator-profile, local-dev-environment), `design.md` D11 and layer table, and this section before code
- [x] 15.2 J-1 (TDD): login form posts via `action={formAction}` with a hidden `next` input; test that the form has an action and carries `next`
- [x] 15.3 J-2 (TDD): redaction rules for Argentine phone/DNI formats, JSON/`key=` secrets, `sb_secret_`; one test per format; dates, IPs and UUIDs stay intact
- [x] 15.4 J-3a/b (TDD): bounded quantifiers, `redactText` input cap, message slice before redaction in `logError`; performance test on 200 KB adversarial inputs (< 200 ms)
- [x] 15.5 J-3c/d (TDD): `reportError` auth → rate limit (429) → `readBody` (413 over 16 KB) → schema → trace; `countRecentClientReports` repository; route adapter with content-length and text-length checks
- [x] 15.6 Q-1 (TDD): `attachRequestOperator` resolves org/user from the request cookie header for `onRequestError` rows; never throws
- [x] 15.7 M-1 (TDD): calendar-date refine in `errorFiltersSchema`
- [x] 15.8 Migration `20261005000100_foundation_hardening.sql` + pgTAP `005_hardening.test.sql`: grants, trigger-function execute, id/created_at guard, name/avatar_path checks, org-scoped `avatars_select`, user index, cron job, cross-user avatar delete and listing
- [x] 15.9 M-5/M-7: `config.toml` signup disabled + min password 10, seed minimum 10; `avatarPublicUrl` encodes segments (TDD)
- [x] 15.10 Re-run verification: typecheck, lint, test, test:db, `db:reset` + seed; curl (login form method, report 401/413/429, signup rejected); browser smoke (login, support screen); report `reports/2026-10-05-step-15-hardening.md`; restore DB state
- [x] 15.11 Update `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`, `README.md`, `docs/data-model.md`, `.planning/STATE.md` (deferred findings backlog)

## 16. Adversarial Re-review Fixes (2026-10-05, design D12)

- [x] 16.1 Update specs (error-tracking, org-tenancy), `design.md` D12, and this section before code
- [x] 16.2 N-3/N-4 (TDD): regression tests for quoted/single-quoted/inspect/escaped secrets and DNIs glued to `_`, `.`, letters (confirmed green against `65eb994`); fix `redact.ts` keeping bounded quantifiers and the 200 KB performance test
- [x] 16.3 N-1/N-2 DB (TDD, pgTAP): migration `20261005000200_report_rate_limit.sql` with `error_logs.origin`, partial index, `insert_client_error_report` (advisory lock, count, insert; service role only)
- [x] 16.4 N-1/N-2 app (TDD): `reportError` auth → pre-check (429) → `readBody` (413) → schema → trace → `storeClientReport` (`stored`/`rate_limited`/`failed`); repository `insertClientErrorReport` (rpc) and `countRecentClientReports` on the column; route wiring; regenerate DB types
- [x] 16.5 N-8 (TDD): year range 2000–2100 in the calendar-date refine
- [x] 16.6 N-9/N-11 (pgTAP first): revoke `maintain`; Unicode-blank-aware name check; tests for MAINTAIN and tab/NBSP/ZWSP names
- [x] 16.7 N-12: SSR `renderToString` test asserting `method="POST"` on the login form
- [x] 16.8 Re-run verification: typecheck, lint, test, test:db; concurrent flood probe (50 parallel → ≤ 10 stored) and max-size reports probe against the dev server; report `reports/2026-10-05-step-16-rereview-fixes.md`; restore DB state
- [x] 16.9 N-14 + docs: fix ID labels in the step-15 report; update `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`, `README.md`, `docs/data-model.md`, `.planning/STATE.md` (backlog N-5, N-6, N-7, N-10, N-13)

## 17. Second Re-review Fixes (2026-10-05, design D13)

- [x] 17.1 Update specs (error-tracking, org-tenancy), `design.md` D13, and this section before code
- [x] 17.2 R-1 (TDD): legacy `65eb994` fixture + superset property test over PII tokens × contexts, plus the digit-dot DNI scenario (red first); relax `DNI_RE` to digit-only boundaries; update IP/decimal controls to the accepted trade-off
- [x] 17.3 R-2 (TDD): 20 000 random UUIDs alone and inside URLs stay unchanged (red first); exempt canonical UUID tokens from the CUIT/phone/DNI passes, emails before the split; keep the performance tests green
- [x] 17.4 R-4 (pgTAP + Vitest first): Hangul filler, LRM/RLM, soft hyphen and combining-mark names rejected, `José Pérez` / `李明` accepted; new migration with the extended invisible set and the letter-or-number rule; mirror it in `profileNameSchema`
- [x] 17.5 R-5 (pgTAP first): `insert_client_error_report` raises `22023` on null user, null/zero limit, null/zero window
- [x] 17.6 R-8: SSR test asserts the bound reference's `$$FORM_ACTION` was called and the action-id field is rendered; `GET /login` HTTP smoke for `method="POST"` in 17.7
- [x] 17.7 Re-run verification (typecheck, lint, test, test:db, `GET /login` smoke, report probe); report `reports/2026-10-05-step-17-rereview-2-fixes.md`
- [x] 17.8 R-9 + docs: correct the superset, UUID, `MAINTAIN`/`LOCK` and zero-width claims; update `ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`, `docs/data-model.md`, `.planning/STATE.md` (backlog R-3, R-6, R-7, R-10)

## 18. Third Re-review Fixes (2026-10-05, design D14)

- [x] 18.1 Decision brief for the team (`reports/2026-10-05-redaction-superset-decision-brief.md`); update specs (org-tenancy), `design.md` D14, and this section before code
- [x] 18.2 S-4 (TDD): rows with 40 emoji / 41 astral letters parse; form counts code points; `[\p{L}\p{Nd}]` and ICU blanks U+001C–U+001F, U+0085 in the JS set
- [x] 18.3 S-5 (pgTAP + Vitest first): `A` + U+E0100 / U+180B / U+17B4 rejected; new migration with the completed invisible set; same set in JS
- [x] 18.4 S-7: pgTAP zero window and negative limit
- [ ] 18.5 BLOCKED on the team decision (brief): S-1, S-2, S-3, S-6 redaction work
- [ ] 18.6 Re-run verification and docs (`ARCHITECTURE_SDD.md`, `STUDENT_DECISION_LOG.md`, `docs/data-model.md`, `.planning/STATE.md`); report `reports/2026-10-05-step-18-rereview-3-fixes.md`
