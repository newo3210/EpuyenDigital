# local-dev-environment Specification

## Purpose
Local Supabase on Podman, migrations, seed, environment validation, and the quality scripts every checkout must pass. Introduced by change `foundation-workspace-auth` (archived 2026-10-05).

## Requirements

### Requirement: One-command local stack
The repository SHALL provide npm scripts that start the local Supabase stack and the web app on a Windows machine with Podman (no Docker), documented in the root README.

#### Scenario: Fresh start
- **WHEN** a developer with Node >= 20 and a running Podman machine runs `npm install`, `npm run db:start`, and `npm run dev`
- **THEN** Supabase services respond locally and the web app serves the login page at `http://localhost:3000/login`

#### Scenario: Supabase CLI cannot run on Podman
- **WHEN** `npm run db:start` fails because the container runtime is incompatible
- **THEN** the README documents the fallback: pointing `.env.local` to a dedicated Supabase cloud project for development and applying migrations with `npm run db:push`

### Requirement: Reproducible database
The database schema SHALL be defined only by versioned migrations and a seed, so that a reset produces an identical state. After foundation/pet reconcile, SQL seed and TypeScript seed SHALL coexist on one org identity and SHALL leave both an admin operator path and a working Inspectoría WhatsApp line when the documented commands are run.

#### Scenario: Reset and seed
- **WHEN** a developer runs `npm run db:reset` followed by `npm run db:seed`
- **THEN** all migrations apply without errors, the organization "Municipalidad de Epuyén" exists with fixed slug `epuyen`, one admin profile exists with the email from `SEED_ADMIN_EMAIL`, and the Inspectoría `whatsapp_lines` row (`+5492944216586` / instance `inspectoria`) plus `whatsapp_line_secrets` and `org_settings` exist so webhook ingest does not fail with `LINE_NOT_FOUND`

#### Scenario: Seed is idempotent
- **WHEN** `npm run db:seed` runs twice
- **THEN** no duplicate organization, admin, WhatsApp line, or neighborhood code is created and the command exits successfully

#### Scenario: TypeScript seed covers pet bootstrap alone
- **WHEN** SQL seed was skipped and a developer runs only `npm run db:seed` against a migrated database
- **THEN** `org_settings`, Inspectoría line/secrets, and neighborhood codes are upserted using the same fixed org/line UUIDs as `supabase/seed.sql`

### Requirement: Documented environment variables
Every environment variable used by the code SHALL be listed in `.env.example` with a description, and the app SHALL fail fast with a clear message when a required variable is missing.

#### Scenario: Missing variable
- **WHEN** the web app starts without `NEXT_PUBLIC_SUPABASE_URL`
- **THEN** startup fails with an error naming the missing variable

### Requirement: Hardened auth configuration
Self sign-up SHALL be disabled (operators are created only with the service role) and the minimum password length SHALL be 10 characters, in `supabase/config.toml` and documented for the cloud project.

#### Scenario: Self sign-up attempt
- **WHEN** an anonymous client calls the Supabase sign-up endpoint with the public anon key
- **THEN** the request is rejected and no auth user is created

### Requirement: Quality scripts
The repository SHALL expose `npm run typecheck`, `npm run lint`, `npm run test` (Vitest), and `npm run test:db` (SQL tests) from the root.

#### Scenario: Clean checkout passes checks
- **WHEN** a developer runs the four quality scripts on a clean checkout with the local stack running
- **THEN** all four exit with code 0

### Requirement: Line secrets and Evolution env documented
`.env.example` and local-dev docs SHALL list variables needed for Evolution base URL, instance, webhook secret, and service-role paths used by line admin and outbound, without committing real secrets. Seed SHALL remain runnable in `dry_run` without a live Evolution instance.

#### Scenario: dry_run local seed
- **WHEN** a developer resets and seeds the local database with documented defaults
- **THEN** the Inspectoría line exists with Mesa de Entrada as default area and send_mode `dry_run` so outbound tests do not require Evolution
