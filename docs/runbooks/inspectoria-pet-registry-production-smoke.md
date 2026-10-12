# Runbook: Inspectoría pet registry — production smoke

English technical steps to smoke-test the WhatsApp registration bot on line `+5492944216586` after UX v2.

## Prerequisites

- Supabase project (or local `supabase start`) with migrations applied
- Evolution API instance named `inspectoria` (or matching `EVOLUTION_INSTANCE`)
- Node 20+, repo deps installed (`npm ci`)
- Copy `.env.example` → `.env` and fill secrets

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

## 4. Point webhook

Configure Evolution webhook URL to your web app:

`POST https://<host>/api/webhooks/evolution`

Header / secret must match `WEBHOOK_SECRET` (e.g. `x-webhook-secret`).

From Podman/Docker to host Next.js: `http://host.containers.internal:3000/api/webhooks/evolution`.

## 5. Start app + worker

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
