# Step 11 — Manual endpoint testing with curl

**Date:** 2026-10-12  
**Stack:** Next.js `apps/web` on `:3000` with `WEBHOOK_SECRET=dev-webhook-secret-change-me`, memory inbound store (no live Supabase). Worker not required for webhook HTTP checks.

## Start

```bash
WEBHOOK_SECRET=dev-webhook-secret-change-me SEND_MODE=dry_run npm run dev
```

## Results

| Case | Expected | Actual |
|---|---|---|
| `GET /api/health` | 200 ok | `{"ok":true,"service":"epuyen-web","feature":"inspectoria-pet-registry-bot"}` |
| `POST /api/webhooks/evolution` without secret | 401 | `401 {"ok":false,"code":"UNAUTHORIZED"}` |
| Wrong secret | 401 | `401 {"ok":false,"code":"UNAUTHORIZED"}` |
| Valid text inbound | 200 + messageId | `200 {"ok":true,"duplicate":false,"messageId":"94540d8b-…"}` |
| Duplicate external id | 200 + duplicate true, same id | `200 {"ok":true,"duplicate":true,"messageId":"94540d8b-…"}` |
| Location fixture | 200 persisted | `200 {"ok":true,"duplicate":false,"messageId":"73307a73-…"}` |
| Group payload | 200 ignored | `200 {"ok":true,"ignored":true,"reason":"group"}` |

Artifact: `/opt/cursor/artifacts/curl-webhook-manual.log`

## Notes

- Confirmation / `dry_run` outbound persistence is covered by worker Vitest (`handlers.test.ts`, `flow.test.ts`) because the HTTP webhook only enqueues jobs; without a shared Supabase/job bus in this environment, the memory store is process-local to the Next server.
- Secret-not-configured → 503 covered by unit test `webhook-secret.test.ts`.
