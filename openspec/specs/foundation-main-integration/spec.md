# foundation-main-integration Specification

## Purpose
Coexistence of foundation auth/panel and Inspectoría pet registry on mainline. Introduced by change `reconcile-foundation-to-main` (archived 2026-11-04).

## Requirements

### Requirement: Foundation and pet registry coexist on mainline
The delivery branch based on `main` SHALL include operator authentication, organization tenancy helpers, operator profile editing, error tracking UI/API, and the panel shell from foundation, while preserving the Inspectoría pet-registry webhook, worker, and animal registration behavior already shipped on `main`.

#### Scenario: Operator reaches protected panel
- **WHEN** a seeded active operator signs in with valid email and password on the reconciled app
- **THEN** the session persists across reload and the operator can open the panel shell routes (`/inbox`, `/citizens`, `/tasks`, profile, support as role allows)

#### Scenario: Unauthenticated user is blocked
- **WHEN** an unauthenticated client requests a protected panel route
- **THEN** the app redirects to login and does not render operator data

#### Scenario: Pet webhook still accepts valid secret
- **WHEN** Evolution posts a messages upsert with a valid webhook secret for the Inspectoría line
- **THEN** the webhook accepts the request and persists or enqueues work without requiring the panel inbox feature

#### Scenario: Pet webhook rejects invalid secret
- **WHEN** Evolution posts without a valid webhook secret
- **THEN** the webhook rejects the request and does not enqueue pet registration work

### Requirement: Coherent organizations schema
The database schema reachable from an empty reset SHALL define a single `organizations` table that supports both foundation profiles/error_logs and pet-registry `org_settings`, citizens, and animal tables without conflicting column definitions.

#### Scenario: Fresh database reset succeeds
- **WHEN** migrations are applied from empty state on the delivery branch
- **THEN** `organizations` includes at least `id`, `name`, `slug`, `timezone`, `created_at`, and `updated_at`, and `org_settings` exists referencing `organizations`

#### Scenario: Cross-org isolation helpers remain
- **WHEN** RLS helper functions from foundation are present
- **THEN** SQL tests (or equivalent) still demonstrate that organization A cannot read organization B profile/error data

### Requirement: OpenSpec and docs reflect integration
The delivery branch SHALL expose foundation capabilities under `openspec/specs/` and update root architecture docs so agents do not treat foundation as unimplemented on mainline.

#### Scenario: Foundation specs present
- **WHEN** a reader lists `openspec/specs/` on the delivery branch after this change
- **THEN** the foundation capability folders exist alongside pet-registry specs

#### Scenario: Root docs mention dual baseline
- **WHEN** `ARCHITECTURE_SDD.md` and `STUDENT_DECISION_LOG.md` are read after this change
- **THEN** they describe both operator foundation and Inspectoría pet vertical, and note that real Mesa inbox / dual inquiry coords are follow-ups

### Requirement: No fake inbox completion
Empty-state panel routes MAY exist, but this change SHALL NOT claim triage queue, area distribution, or inquiry map requirements as satisfied.

#### Scenario: Inbox remains non-triage
- **WHEN** an operator opens `/inbox` after reconcile
- **THEN** the page may show a placeholder or empty state and MUST NOT present a working claim/distribute queue unless a later change’s specs are also implemented
