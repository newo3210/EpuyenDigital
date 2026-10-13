# Epuyén Digital — Inspectoría pet registry bot (MVP)

WhatsApp registration bot for municipal pets (dog/cat/other) on the Inspectoría line `+5492944216586`.

## Monorepo

| Path | Role |
|---|---|
| `apps/web` | Thin Evolution webhook + health |
| `worker` | Jobs: inbound, media, outbound, vision traits |
| `packages/shared` | Zod contracts, state machine, i18n es-AR, phone/ID helpers |
| `supabase` | Migrations, seed, pgTAP |
| `infra/evolution` | Local Evolution API compose |

## Quick start

```bash
cp .env.example .env
npm install
npm run test
npm run typecheck
npm run dev          # web on :3000
npm run dev:worker   # job consumer
```

Send mode defaults to `dry_run` (outbound persisted, Evolution not called).

### Database

```bash
# Requires Supabase CLI + Docker/Podman
npm run db:start
npm run db:reset   # migrations + seed.sql
npm run test:db    # pgTAP
```

If Supabase CLI is unavailable, Vitest covers domain + mocked webhook/worker paths. Migration SQL still ships under `supabase/migrations/`.

### Evolution (optional live WhatsApp)

See `infra/evolution/README.md`. Webhook URL from container:

`http://host.containers.internal:3000/api/webhooks/evolution`

Header: `x-webhook-secret: $WEBHOOK_SECRET`

## Scripts

- `npm run test` — Vitest (shared, web, worker)
- `npm run test:db` — pgTAP via Supabase CLI (soft fallback if missing)
- `npm run typecheck` / `npm run lint`
