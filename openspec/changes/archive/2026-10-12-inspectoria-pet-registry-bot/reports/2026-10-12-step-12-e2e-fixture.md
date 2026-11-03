# Step 12 — E2E fixture conversation

**Date:** 2026-10-12  
**Change:** `inspectoria-pet-registry-bot`

## Approach

Full live Evolution + Supabase stack unavailable (no Podman/Docker/Supabase CLI). E2E covered by scripted fixture in Vitest:

`worker/src/features/registration/flow.test.ts` → `runs consent→citizen→location→animal→photo→complete`

## Assertions (passing)

- Citizen row created with GPS
- Animal `status = active`
- `municipalId` matches `/^CENT-\d{4}-\d{5}$/`
- ≥1 photo linked
- Outbound confirmation body contains municipal ID (`dry_run` → `deliveryStatus = simulated`, Evolution not called)
- Returning citizen greeting uses stored name
- TTL expiry starts fresh without stale animal payload

## Command

```bash
npm run test -w @epuyen/worker -- src/features/registration/flow.test.ts
```

(Also included in root `npm run test` — 57 green.)

## Optional real WhatsApp

QR pairing against `infra/evolution` not executed here; not required to mark E2E complete per tasks.md 12.4.
