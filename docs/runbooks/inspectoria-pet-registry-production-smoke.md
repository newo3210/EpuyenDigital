# Runbook: Inspectoría pet registry — production smoke

English technical steps to smoke-test the WhatsApp registration bot on line `+5492944216586` after UX v2.

## Target topology (Vercel + VPS)

| Piece | Where | Role |
|---|---|---|
| Next.js webhook (`/api/webhooks/evolution`) | Vercel project `epuyendigital` | Ingest Evolution events, enqueue jobs |
| Worker (`npm run start -w @epuyen/worker`) | VPS | Poll jobs, state machine, outbound WhatsApp |
| Evolution API | VPS (Docker/Podman) | WhatsApp link for `inspectoria` |
| Postgres | Supabase `EpuyenDigital` | Sessions, citizens, animals, secrets |

**Help image (citizen location tip):** replace the placeholder file at:

`worker/assets/inspectoria/location-help.png`

Ship that PNG with the VPS worker checkout (or set `LOCATION_HELP_IMAGE_PATH` to an absolute path on the VPS).

Production webhook URL:

`https://epuyendigital-folqgn9do-bosquegracias-projects.vercel.app/api/webhooks/evolution`

### Blocker: Vercel Deployment Protection

If Production has **Vercel Authentication** enabled, Evolution POSTs receive `401` / SSO HTML and never reach the route. Before smoke:

1. Vercel → Project `epuyendigital` → Settings → Deployment Protection
2. For **Production**, disable Vercel Authentication **or** allow a public path for `/api/webhooks/evolution`
3. Optionally create an **Automation Bypass** secret and send header `x-vercel-protection-bypass` from Evolution (only if you keep protection on)

Cursor MCP for team `bosquegracias-projects` may list the project but return `403` on env/deploy APIs until the Vercel connection is re-authorized for that team scope. Until then, set env vars and Protection in the Vercel dashboard.

### Deploy branch

Bot + UX v2 live on `cursor/inspectoria-pet-registry-ux-v2-4cd2` (PR #2). `main` does not include the webhook yet. Deploy that branch (or merge then deploy `main`) with Root Directory / build covering the npm workspaces monorepo (`apps/web` + `packages/shared`).

## Prerequisites

- Supabase project (or local `supabase start`) with migrations applied
- Evolution API instance named `inspectoria` (or matching `EVOLUTION_INSTANCE`)
- Node 20+, repo deps installed (`npm ci`)
- Copy `.env.example` → `.env` (VPS worker) and fill secrets; mirror webhook-related vars on Vercel Production

## 1. Migrate database

```bash
# Local
npm run db:reset

# Remote (example)
supabase db push
# Ensure migration 20261012120000_rabies_status_unknown.sql is applied
```

Confirm `animals.rabies_status` allows `up_to_date | pending | unknown`.

## 2. Environment

Required / documented in `.env.example`:

| Variable | Notes |
|---|---|
| `EVOLUTION_BASE_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | Evolution API |
| `WEBHOOK_SECRET` | Same secret Evolution sends on webhook |
| `SEND_MODE` | Start `allowlist`, then `production` |
| `ALLOWLIST_PHONES` | Must include `5492944216586` for allowlist smoke |
| `LOCATION_HELP_IMAGE_PATH` | Optional; defaults to `worker/assets/inspectoria/location-help.png` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` | Persistence |
| `LLM_VISION_*` | Vision traits after registration (optional for smoke of chat path) |
| `PET_REGISTRY_BOT_ENABLED` | `true` |

**Help image:** ship replaces the placeholder PNG under `worker/assets/inspectoria/location-help.png` with official Inspectoría artwork before going fully public. Until then the 1×1 placeholder is valid but not citizen-ready.

## 3. Start Evolution and link QR

1. Start Evolution (see `infra/evolution/README.md`).
2. Create/open instance `inspectoria`.
3. Scan QR with the phone that owns **+5492944216586** (or the WhatsApp Business number for that line).
4. Confirm instance status is connected.

## 4. Point webhook (production)

Configure Evolution instance `inspectoria` webhook:

`POST https://epuyendigital-folqgn9do-bosquegracias-projects.vercel.app/api/webhooks/evolution`

Header / secret must match `WEBHOOK_SECRET` on Vercel **and** `whatsapp_line_secrets.webhook_secret` in Supabase (e.g. `x-webhook-secret` or Bearer).

Local Podman/Docker to host Next.js (dev only): `http://host.containers.internal:3000/api/webhooks/evolution`.

## 5. Start Vercel web + VPS worker

**Vercel (Production env):** at least

- `PET_REGISTRY_BOT_ENABLED=true`
- `WEBHOOK_SECRET=<same as DB + Evolution>`
- `SUPABASE_URL=https://ornqhujsmwjaegjadjar.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<service role>`
- `SUPABASE_ANON_KEY=<anon>`

**VPS worker:**

```bash
git checkout cursor/inspectoria-pet-registry-ux-v2-4cd2   # or main after merge
# place official PNG at worker/assets/inspectoria/location-help.png
cp .env.example .env   # fill Evolution + Supabase + SEND_MODE=allowlist
npm ci
npm run build -w @epuyen/shared && npm run build -w @epuyen/worker
# process manager (systemd/pm2):
npm run start -w @epuyen/worker
```

Local dual-process (dev):

```bash
npm run build -w @epuyen/shared
# terminal A
npm run dev
# terminal B
npm run dev:worker
```

## 6. Allowlist smoke first

1. Set `SEND_MODE=allowlist` and `ALLOWLIST_PHONES=5492944216586`.
2. From an allowlisted phone, message the Inspectoría line.
3. Walk the UX v2 script:
   - Welcome (no consent)
   - Name → DNI → address
   - Location help `1` (expect help text + image) or `2`
   - Location pin **or** `No puedo ahora`
   - Animal fields; rabies `3 No sé` optional
   - Health card photo or `No`
   - ≥1 pet photo then `Listo`
4. Expect confirmation with **animal name**, **citizen full name**, and municipal ID `EPU-YYYY-SEQ5`.
5. Confirm rows in `citizens`, `animals`, `animal_photos`.

## 7. Production mode

After allowlist success:

1. Set `SEND_MODE=production`.
2. Restart worker.
3. Repeat a short conversation from a non-allowlisted test phone if intended for public use.
4. Monitor worker logs (redacted) and Evolution delivery.

## 8. Rollback / safety

- Set `PET_REGISTRY_BOT_ENABLED=false` to no-op inbound processing.
- Set `SEND_MODE=dry_run` to stop live WhatsApp sends.
- Replace help image path via `LOCATION_HELP_IMAGE_PATH` without redeploying assets if needed.
