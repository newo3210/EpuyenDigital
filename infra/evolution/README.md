# Evolution API (local)

Inspectoría display phone: `+5492944216586`.

## Start (Podman or Docker)

```bash
export EVOLUTION_API_KEY=change-me-evolution-key
podman compose -f infra/evolution/docker-compose.yml up -d
# or: docker compose -f infra/evolution/docker-compose.yml up -d
```

## Webhook to host Next.js

From the container network, the host is typically `host.containers.internal` (Podman) or `host.docker.internal` (Docker Desktop):

`http://host.containers.internal:3000/api/webhooks/evolution`

Configure the Evolution instance webhook with header/secret matching `WEBHOOK_SECRET` in `.env`.

## Send mode

Keep `SEND_MODE=dry_run` until QR pairing is done; switch to `allowlist` with `ALLOWLIST_PHONES=5492944216586,...` for live tests.
