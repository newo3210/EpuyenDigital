# Mesa de Entrada Digital — Epuyén

Municipal WhatsApp messaging panel for the Municipalidad de Epuyén. npm-workspaces monorepo: Next.js 15 web panel + shared TypeScript package + Supabase (Postgres, Auth, Storage).

```text
apps/web/          Next.js 15 App Router panel (presentation, features, infrastructure, contracts)
packages/shared/   Framework-free domain logic and Zod contracts
supabase/          config.toml, migrations, SQL tests (pgTAP), seed
scripts/           Tooling helpers (Supabase CLI wrapper)
openspec/          Spec-driven changes (proposal, specs, design, tasks)
```

## Prerequisites

- Node.js **>= 20.12** (`.nvmrc` pins 24)
- **Podman** with a running machine (Docker is not required)
- Git

## Podman setup (Windows)

```powershell
podman machine init      # first time only
podman machine start
podman machine inspect --format '{{.ConnectionInfo.PodmanPipe.Path}}'
# \\.\pipe\podman-machine-default
```

The npm `db:*` scripts set `DOCKER_HOST=npipe:////./pipe/podman-machine-default` automatically on Windows when it is not already defined (see `scripts/supabase.mjs`). If `podman` is not found right after installing, open a new terminal so PATH refreshes.

The full stack needs about 2 GiB of RAM in the Podman machine. If containers get killed, raise it: `podman machine stop; podman machine set --memory 4096; podman machine start`.

## Local start

```powershell
npm install
copy .env.example .env.local   # then fill the values below
npm run db:start               # first run pulls images (~6 min)
npm run dev                    # http://localhost:3000
```

`npm run db:start` prints `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY`; copy them into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Local Studio: http://127.0.0.1:54323 · Mailpit: http://127.0.0.1:54324.

The web app refuses to start if a required variable is missing and names it in the error.

## Fallback: Supabase cloud project for development

If `npm run db:start` cannot run on Podman:

1. Create a dedicated Supabase cloud project for **development only** (never production data).
2. In `.env.local`, point `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to that project, and set `SUPABASE_PROJECT_REF` and `SUPABASE_CLOUD_DB_PASSWORD`.
3. Link and apply migrations:

   ```powershell
   npx supabase link --project-ref <ref>
   npm run db:push
   ```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build of the web app |
| `npm run typecheck` | Route type generation + `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint in every workspace |
| `npm run test` | Vitest (projects `web` and `shared`) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:db` | pgTAP SQL tests in `supabase/tests` (local stack running) |
| `npm run db:start` / `db:stop` | Start / stop the local Supabase stack |
| `npm run db:reset` | Recreate the local database from migrations (run `db:seed` afterwards) |
| `npm run db:push` | Apply migrations to the linked cloud project |
| `npm run db:types` | Regenerate `packages/shared/src/contracts/database.types.ts` from the local schema |
| `npm run db:seed` | Idempotent seed: organization `epuyen` + admin operator from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` |

## Seeding and first login

1. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env.local` (never commit them).
2. `npm run db:seed` (safe to run again; it does not duplicate rows or reset the password).
3. Open http://localhost:3000/login and sign in with those credentials.

Inactive accounts or users without a profile are signed out and sent back to `/login` with a notice. Operators, areas and role editing arrive with the next change (`areas-operators-admin`); until then, extra local users are created with the Supabase admin API or Studio plus a `profiles` row.

## Error tracking and support screen

- Every request gets an `x-trace-id` header (middleware). Server errors are captured by `apps/web/src/instrumentation.ts` (`onRequestError`); UI crashes show "Ocurrió un error. Código: XXXXXXXX" and report to `POST /api/errors/report`.
- Messages and details are redacted before storage (emails, DNI, CUIT, phones, tokens, passwords). Rows live in `error_logs` and are purged after 30 days.
- Users with role `admin` or `support` open **`/support/errors`**: filter by status, source, level and date (Argentina time), open the detail, and mark incidents acknowledged, resolved or reopened. Other roles get HTTP 403.
- To find a reported incident, match the code the user dictates with the first 8 characters of `trace_id`.

## Testing notes

- `npm run test` runs unit and component tests with no database; features receive fake ports.
- `npm run test:db` needs the local stack (`npm run db:start`); it checks RLS isolation between organizations, inactive-user lockout, guard triggers, storage policies and error-log purge.
- Before a change is closed, run `npm run typecheck`, `npm run lint`, `npm run test` and `npm run test:db`; all must exit 0.
- Verification evidence (curl, E2E screenshots) lives in `openspec/changes/<change>/reports/`.
- After editing modules imported by `instrumentation.ts`, restart `npm run dev`; Turbopack HMR may keep the old version.

## Documentation

- Development rules: [`docs/base-standards.md`](docs/base-standards.md)
- Architecture: [`ARCHITECTURE_SDD.md`](ARCHITECTURE_SDD.md)
- Decision log (es-AR): [`STUDENT_DECISION_LOG.md`](STUDENT_DECISION_LOG.md)
- Data model (es-AR): [`docs/data-model.md`](docs/data-model.md)
- Requirements and roadmap: [`.planning/REQUIREMENTS.md`](.planning/REQUIREMENTS.md), [`.planning/ROADMAP.md`](.planning/ROADMAP.md)
