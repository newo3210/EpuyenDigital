# Adversarial fixes round 2 — 2026-10-12

Addresses FAIL from `reports/adversarial-review-reaudit.md`.

| Finding | Severity | Status | Notes |
|---|---|---|---|
| Supabase session lock no-op across JS | Blocker | **Fixed (design + code)** | PostgREST cannot hold `FOR UPDATE` across JS. Session writes use `upsert_registration_session` (advisory xact lock + row lock in one TX). Completion uses `finalize_registration_completion` (single TX). Design D4 updated. |
| Non-idempotent / crash strand on `completing` | Blocker | **Fixed** | Finalize is atomic. State machine resumes `completing` without `completedAnimalId`. Vitest: “resumes stranded completing session”. |
| Live SQL/pgTAP | Major | **Still open** | Migrations shipped; environment lacks Supabase CLI/Podman. Archive gate: run `supabase test db` when available. |

## Verification

- `npm run test` → 70 passed
- `npm run typecheck` / `lint` green (run with commit)
