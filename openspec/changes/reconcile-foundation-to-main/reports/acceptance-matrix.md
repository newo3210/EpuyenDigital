# Acceptance Matrix (independent verification)

Copy scenarios **literally** from `openspec/changes/reconcile-foundation-to-main/specs/foundation-main-integration/spec.md`.

**Change:** `reconcile-foundation-to-main`  
**Date:** 2026-11-04  
**Author:** Project Director verification pass (apply was delegated to a separate implementer session)

## Scenarios

### Scenario: Operator reaches protected panel

- **WHEN** a seeded active operator signs in with valid email and password on the reconciled app
- **THEN** the session persists across reload and the operator can open the panel shell routes (`/inbox`, `/citizens`, `/tasks`, profile, support as role allows)

**Evidence (required):**
- Tool used: code inspection + unit tests (sign-in / require-operator / route-access); no live Supabase
- Command / steps: `npm test` (includes `sign-in.test.ts`, `require-operator.test.ts`, `route-access.test.ts`); confirmed routes exist under `apps/web/src/app/(panel)/`
- Result: **BLOCKED** (full browser login smoke)
- Notes: Foundation auth unit coverage green; E2E login needs local Supabase + seed

---

### Scenario: Unauthenticated user is blocked

- **WHEN** an unauthenticated client requests a protected panel route
- **THEN** the app redirects to login and does not render operator data

**Evidence (required):**
- Tool used: unit tests + code read
- Command / steps: `apps/web/src/features/auth/require-operator.test.ts`, `route-access.test.ts` PASS in director re-run (546 tests)
- Result: **PASS** (unit-level); browser E2E not run
- Notes: Middleware/guards covered by foundation tests retained in merge

---

### Scenario: Pet webhook still accepts valid secret

- **WHEN** Evolution posts a messages upsert with a valid webhook secret for the Inspectoría line
- **THEN** the webhook accepts the request and persists or enqueues work without requiring the panel inbox feature

**Evidence (required):**
- Tool used: unit tests
- Command / steps: `apps/web/src/infrastructure/inbound-repository.test.ts` (valid secret → persist/enqueue) + `apps/web/src/infrastructure/webhook-secret.test.ts` PASS. Note: `route.test.ts` only covers normalize/thinness — not secret accept.
- Result: **PASS**
- Notes: Independent of inbox UI; secret verification lives below the thin route

---

### Scenario: Pet webhook rejects invalid secret

- **WHEN** Evolution posts without a valid webhook secret
- **THEN** the webhook rejects the request and does not enqueue pet registration work

**Evidence (required):**
- Tool used: unit tests
- Command / steps: `apps/web/src/infrastructure/webhook-secret.test.ts` + `apps/web/src/infrastructure/inbound-repository.test.ts` (401 / reject on mismatch or missing secret) PASS
- Result: **PASS**
- Notes: Do not cite `route.test.ts` alone for secret fail-closed behavior

---

### Scenario: Fresh database reset succeeds

- **WHEN** migrations are applied from empty state on the delivery branch
- **THEN** `organizations` includes at least `id`, `name`, `slug`, `timezone`, `created_at`, and `updated_at`, and `org_settings` exists referencing `organizations`

**Evidence (required):**
- Tool used: migration file review
- Command / steps: Read foundation orgs migration + pet core + `20261104120000_reconcile_organizations_superset.sql` (`ADD COLUMN IF NOT EXISTS timezone/updated_at`); `supabase db reset` **not run** (no Docker/Podman)
- Result: **BLOCKED**
- Notes: Design D2 path is coherent on paper; live reset still required

---

### Scenario: Cross-org isolation helpers remain

- **WHEN** RLS helper functions from foundation are present
- **THEN** SQL tests (or equivalent) still demonstrate that organization A cannot read organization B profile/error data

**Evidence (required):**
- Tool used: filesystem check
- Command / steps: Foundation pgTAP files present after merge; `npm run test:db` not executed
- Result: **BLOCKED**
- Notes: Tasks 2.2 / 2.3 remain open

---

### Scenario: Foundation specs present

- **WHEN** a reader lists `openspec/specs/` on the delivery branch after this change
- **THEN** the foundation capability folders exist alongside pet-registry specs

**Evidence (required):**
- Tool used: directory listing
- Command / steps: `ls openspec/specs/` → animal-registry, error-tracking, inspectoria-whatsapp-channel, local-dev-environment, operator-auth, operator-profile, org-tenancy, pet-registration-conversation
- Result: **PASS**
- Notes:

---

### Scenario: Root docs mention dual baseline

- **WHEN** `ARCHITECTURE_SDD.md` and `STUDENT_DECISION_LOG.md` are read after this change
- **THEN** they describe both operator foundation and Inspectoría pet vertical, and note that real Mesa inbox / dual inquiry coords are follow-ups

**Evidence (required):**
- Tool used: file read
- Command / steps: Both files cite `reconcile-foundation-to-main`, dual baseline, deferred inbox/map/dual coords
- Result: **PASS**
- Notes:

---

### Scenario: Inbox remains non-triage

- **WHEN** an operator opens `/inbox` after reconcile
- **THEN** the page may show a placeholder or empty state and MUST NOT present a working claim/distribute queue unless a later change’s specs are also implemented

**Evidence (required):**
- Tool used: code read
- Command / steps: `apps/web/src/app/(panel)/inbox/page.tsx` renders `EmptyState` only; no claim/distribute components
- Result: **PASS**
- Notes:

---

## Summary

| Total | Pass | Fail | Blocked |
|---|---|---|---|
| 9 | 6 | 0 | 3 |

**Verdict:** **PASS WITH GAPS** (blocked: live login E2E, fresh db reset, pgTAP isolation)

**Rule:** Apply implementer did not author this matrix. Live SQL/login gaps must be accepted by human or closed before archive if treated as CRITICAL for production readiness.
