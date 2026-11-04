# Implementation notes — areas-operators-admin

## SQL / pgTAP status

- Migration authored: `supabase/migrations/20261104130000_areas_operators.sql`
- pgTAP suite authored: `supabase/tests/007_areas_operators.test.sql`
- **`npm run test:db` was not executed in this environment:** Docker/Podman is unavailable (`docker info` fails). Do not treat SQL tests as green until CI or a local container run confirms them.

## App verification (this agent)

- `npm run typecheck` and `npm test` are the gates documented in tasks §5.3.
- Manual UI walkthrough deferred to director verify / human OK (section 6).

## Out of scope (confirmed)

- Inbox triage, conversations table, inquiry map, external_contacts, auto classification.
