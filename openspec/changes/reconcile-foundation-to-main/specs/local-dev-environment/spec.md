## MODIFIED Requirements

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
