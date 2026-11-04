# Smoke notes — reconcile-foundation-to-main

**Date:** 2026-11-04

## Login path

**Not run end-to-end** in this environment:

- No local Supabase (`http://127.0.0.1:54321` unreachable; no Docker socket)
- Without `NEXT_PUBLIC_SUPABASE_*` + seeded admin, Next refuses to boot (foundation fail-fast in `next.config.ts`)

**Covered by unit tests instead:** sign-in action, requireOperator redirects, route-access public `/api` + `/login`, login form wiring (`apps/web/src/features/auth/*`, `presentation/auth/login-form.test.tsx`).

## Webhook secret reject/accept

**Runnable without Supabase** via Vitest (memory inbound store fallback):

- File: `apps/web/src/app/api/webhooks/evolution/route.test.ts`
- Asserts invalid/missing secret rejection and valid acceptance paths (included in the 546 green unit tests)

Manual curl against a live `npm run dev` was not performed (no Evolution / no DB).

## Database reset

`supabase db reset` / pgTAP: **gap** — container runtime unavailable. Foundation SQL tests are present under `supabase/tests/` for a follow-up local run after `npm run db:start`.
