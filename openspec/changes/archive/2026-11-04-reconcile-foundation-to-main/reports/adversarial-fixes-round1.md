# Adversarial fixes — round 1

**Change:** `reconcile-foundation-to-main`  
**Date:** 2026-11-04  
**Source FAIL:** `reports/adversarial-review.md`  
**Tasks:** 8.1–8.4 (8.5 re-audit is director-owned)

## 8.1 Seed coexistence — DONE

| Item | Change |
|---|---|
| `supabase/config.toml` | `[db.seed] enabled = true`, `sql_paths = ["./seed.sql"]` so `db reset` applies pet bootstrap |
| `supabase/seed/seed.ts` | After org: upserts `org_settings`, Inspectoría `whatsapp_lines` (+5492944216586 / `inspectoria`), `whatsapp_line_secrets` (`SEED_WEBHOOK_SECRET` → default `dev-webhook-secret-change-me`), neighborhood codes; fixed org UUID `00000000-0000-4000-8000-000000000001` / slug `epuyen` aligned with `seed.sql` |
| README / ARCHITECTURE_SDD / `.env.example` | Document reset (SQL) + `db:seed` (admin + pet upsert) coexistence |
| Delta spec | `openspec/changes/reconcile-foundation-to-main/specs/local-dev-environment/spec.md` — Reset/seed + TS-alone pet bootstrap scenarios |

## 8.2 Migration upgrade safety — DONE

| Item | Change |
|---|---|
| `20260930000100_foundation.sql` | Idempotent enums/tables/functions/triggers/policies/indexes (`IF NOT EXISTS`, `duplicate_object`, `CREATE OR REPLACE`, `DROP IF EXISTS`) |
| `20261005000100_foundation_hardening.sql` | Constraint adds wrapped in `duplicate_object`; index `IF NOT EXISTS` |
| `20261005000200_report_rate_limit.sql` | `ADD COLUMN IF NOT EXISTS`, constraint DO-block, index `IF NOT EXISTS`, `CREATE OR REPLACE` for RPC |
| Reports / design | `reports/schema-reconcile.md` + `design.md` Rollback: pet-only upgrade = idempotent foundation DDL + reconcile migration; **editing foundation SQL in place is OK — not shipped to prod** |

## 8.3 Honest schema proof — DONE (still blocked live)

- Task **2.1 unchecked** with explicit note (migrations written; no live reset).
- Added `scripts/assert-org-superset-columns.{sql,mjs}` documenting expected columns; runnable when containers exist.
- No Docker/Podman in this agent environment — did **not** fake green.
- Tasks 2.2 / 2.3 remain open.

## 8.4 Acceptance matrix evidence — DONE

Webhook accept/reject rows now cite `inbound-repository.test.ts` + `webhook-secret.test.ts`, and explicitly note `route.test.ts` is normalize-only.

## Residual gaps (for 8.5 / archive)

1. Live `supabase db reset` + `assert-org-superset-columns` + `npm run test:db` still unproven.
2. Operator login E2E still BLOCKED in acceptance matrix.
3. Main `openspec/specs/local-dev-environment/spec.md` not rewritten yet — delta under the change folder; sync on archive.
4. Minor review items (types regenerate, `docs/data-model.md` ciphertext wording) untouched this round.

## Not done (by instruction)

- Task 7.4 / archive — left open.
- Task 8.5 re-audit — director.
