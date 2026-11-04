# Mesa de Entrada Digital — Epuyén

Municipal WhatsApp messaging panel for the Municipalidad de Epuyén. npm-workspaces monorepo: Next.js 15 web panel (operator auth + shell) + Inspectoría pet-registry webhook/worker + shared TypeScript package + Supabase (Postgres, Auth, Storage).

```text
apps/web/          Next.js 15 App Router — auth/panel shell + Evolution webhook + health
worker/            Jobs: inbound, media, outbound, vision traits (Inspectoría pets)
packages/shared/   Framework-free domain logic and Zod contracts (foundation + pets)
supabase/          config.toml, migrations, SQL tests (pgTAP), seed
scripts/           Tooling helpers (Supabase CLI wrapper, local bot)
openspec/          Spec-driven changes (proposal, specs, design, tasks)
```

## Prerequisites

- Node.js **>= 20.12** (`.nvmrc` pins 24 when present)
- **Podman** or Docker (for local Supabase)
- Git

## Local start

```bash
npm install
cp .env.example .env.local   # fill panel + webhook/worker values
npm run db:start             # first run pulls images
npm run db:reset             # migrations + SQL seed (org, Inspectoría line/secrets, neighborhoods)
npm run db:seed              # admin operator + same pet bootstrap upserted (needs SEED_* in .env.local)
npm run dev                  # http://localhost:3000 → redirects to /inbox (login if anonymous)
npm run dev:worker           # pet job consumer
```

**Seed coexistence:** `db:reset` applies `supabase/seed.sql` (fixed org `epuyen` / Inspectoría line `+5492944216586`). `npm run db:seed` creates the admin auth user/profile and **also** upserts `org_settings`, the Inspectoría line, `whatsapp_line_secrets` (`SEED_WEBHOOK_SECRET` or `dev-webhook-secret-change-me`), and neighborhood codes — so a working webhook line exists even if SQL seed was skipped.

`npm run db:start` prints `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY`; copy them into `.env.local` as:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (panel)
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` (worker + webhook; same local values)

Local Studio: http://127.0.0.1:54323 · Mailpit: http://127.0.0.1:54324.

The web app refuses to start if public Supabase variables are missing.

## Inspectoría pet registry

WhatsApp registration bot for municipal pets on the Inspectoría line `+5492944216586` (shared with Mesa until a second line exists).

| Path | Role |
|---|---|
| `POST /api/webhooks/evolution` | Thin Evolution webhook |
| `GET /api/health` | Health check |
| `worker/` | Registration jobs |

Send mode defaults via env (`dry_run` / `allowlist` / `production`). See `.env.example`.

```bash
npm run test
npm run typecheck
npm run test:db    # pgTAP when Supabase CLI is available
```

## Foundation panel (reconciled)

- Login: `/login`
- Panel shell: `/inbox`, `/citizens`, `/tasks`, `/settings/profile`, `/support/errors` (empty/placeholder inbox — real triage is a later change)
- Error report API: `/api/errors/report`

Canonical OpenSpec archive: `openspec/changes/archive/2026-10-05-foundation-workspace-auth`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js panel + webhook host |
| `npm run dev:worker` | Pet job worker |
| `npm run db:start` / `db:reset` / `db:seed` | Local Supabase |
| `npm run test` / `typecheck` | Unit/contract tests + TypeScript |
| `npm run test:db` | SQL/pgTAP via `scripts/supabase.mjs` |
