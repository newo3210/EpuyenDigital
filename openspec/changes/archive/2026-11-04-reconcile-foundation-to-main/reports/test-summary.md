# Test summary — reconcile-foundation-to-main

**Date:** 2026-11-04  
**Branch:** `cursor/reconcile-foundation-to-main-c2b5`

## Commands

```bash
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
export SUPABASE_SERVICE_ROLE_KEY=test-service-role-key

npm run typecheck
# → shared + web + worker + supabase tsc: PASS

npm test
# → Vitest projects: web, shared, worker
```

## Results

| Suite | Result |
|---|---|
| `npm run typecheck` | PASS |
| Vitest unit/contract | **54 files, 546 tests PASS** |
| `npm run test:db` (pgTAP) | **NOT RUN** — no Docker/Podman socket in this environment |

## Coverage notes

- Foundation: auth, profile, errors, redact, route access, presentation forms
- Pets: webhook route tests, inbound repository, registration state machine / contracts, worker jobs
- React UI tests required single React 19.3.0 via `overrides` + vitest `dedupe`/aliases (avoid nested `apps/web/node_modules/react`)
