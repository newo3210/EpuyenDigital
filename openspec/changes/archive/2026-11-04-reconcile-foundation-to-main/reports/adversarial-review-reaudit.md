# Adversarial re-audit — reconcile-foundation-to-main (after fix round 1)

**Scope:** OpenSpec change `reconcile-foundation-to-main` on branch `cursor/reconcile-foundation-to-main-c2b5` vs `origin/main`  
**Date:** 2026-11-04  
**Reviewer role:** Independent adversarial reviewer (did **not** implement round-1 fixes)  
**Prior FAIL:** `reports/adversarial-review.md`  
**Fix report:** `reports/adversarial-fixes-round1.md`  
**Focus commits:** `7b8cbfe` (seed), `9916ec4` (idempotent migrations), `1ae314c` (proof/acceptance docs)

**Sources:**
- `openspec/changes/reconcile-foundation-to-main/{proposal,design,tasks}.md`
- Specs: `specs/foundation-main-integration/spec.md`, delta `specs/local-dev-environment/spec.md`
- Reports: prior adversarial review, round-1 fixes, acceptance-matrix, schema-reconcile, smoke
- Code: `supabase/config.toml`, `supabase/seed.sql`, `supabase/seed/seed.ts`, foundation migrations `20260930*` / `20261005*`, `20261104120000_reconcile_organizations_superset.sql`, `scripts/assert-org-superset-columns.{mjs,sql}`
- Targeted re-run: Vitest `inbound-repository.test.ts` + `webhook-secret.test.ts` → **7/7 PASS**
- No Docker/Podman in this environment — live `db reset` / pgTAP still unexecuted (honest Gap)

---

## Spec and task alignment (re-check)

| Prior finding | Round-1 claim | Re-audit |
|---|---|---|
| **Blocker** seed / coexistence | config seed re-enabled; `seed.ts` upserts pet rows; docs + delta | **Cleared** — see Break attempts |
| **Blocker** non-idempotent foundation DDL | IF NOT EXISTS / duplicate_object / DROP IF EXISTS | **Cleared** — static scan + file read |
| **Major** schema proof theater (2.1 checked, reset BLOCKED) | 2.1 unchecked; assert scripts; no fake green | **Demoted to Gap** under honest process |
| **Major** isolation / pet RPC unproven | 2.2 / 2.3 remain open | **Demoted to Gap** (honest, still required before claiming SQL SHALL green) |
| **Major** webhook evidence cites `route.test.ts` | acceptance-matrix points at inbound/webhook-secret | **Cleared** in matrix; smoke.md still stale (Minor) |
| **Major** local-dev / seed docs drift | README + ARCHITECTURE + change delta | **Mostly cleared**; main `openspec/specs/local-dev-environment` still pre-delta (Minor until archive sync) |

Non-goals (no fake triage / areas / inquiry map) still respected.

---

## Break attempts (focus)

### Seed coexistence

| Attack | Result |
|---|---|
| `db reset` skips pet SQL seed? | **No.** `[db.seed] enabled = true`, `sql_paths = ["./seed.sql"]`. |
| `db:seed` still admin-only → `LINE_NOT_FOUND`? | **No.** `seed.ts` upserts `org_settings`, Inspectoría line (`+5492944216586` / `inspectoria`), `whatsapp_line_secrets`, neighborhoods after org. |
| SQL vs TS identity skew (second org / orphan line)? | **No.** Shared fixed UUIDs `…0001` / `…0002`, slug `epuyen`, instance `inspectoria`; TS resolves org by slug and line by instance before insert. |
| Secret default mismatch SQL vs TS? | **Aligned** on `dev-webhook-secret-change-me`; optional `SEED_WEBHOOK_SECRET` documented in `.env.example`. |
| Documented path still incomplete? | **No.** README + `ARCHITECTURE_SDD.md` describe reset (SQL) + `db:seed` (admin + pet upsert). Change delta adds coexistence SHALL scenarios. |

### Pet-only upgrade path

| Attack | Result |
|---|---|
| Re-apply bare `create table public.organizations` on pet DB? | **Fixed.** `create table if not exists` for orgs/profiles/error_logs. Pre-fix file at `218d1f3` had bare create; current does not. |
| Enum / constraint collisions? | **Guarded** with `duplicate_object` DO blocks (enums, name/avatar constraints, origin check). |
| Policy / trigger re-create fails? | **Guarded** with `drop … if exists` then create (foundation + hardening avatars_select). |
| Index / column re-add fails? | **Guarded** (`create index if not exists`, `add column if not exists`). |
| Later foundation files `202610050003`–`006` block upgrade? | **Static OK** — no bare CREATE TABLE/POLICY/TRIGGER/INDEX smells in those files. |
| Fresh reset still missing timezone/updated_at? | **Still covered on paper** by `20261104120000_reconcile_organizations_superset.sql` after pet `IF NOT EXISTS` no-op — **unproven live** → Gap. |
| `cron.schedule('purge-error-logs')` on environments where job exists? | Wrapped in `exception when others` → notice, migration continues. Residual **Minor** noise risk only. |

Design Rollback / `schema-reconcile.md` now match the code claim (idempotent forward apply; wipe-only not required). Editing unshipped foundation SQL in place is explicitly scoped to this branch’s non-prod history — acceptable for stated risk.

---

## Findings

| Severity | Area | Finding | Evidence | Fix owner |
|----------|------|---------|----------|-----------|
| **Gap** | Schema proof | SHALL “Fresh database reset succeeds” remains **BLOCKED**; task **2.1 unchecked** with assert scripts ready. Not completion theater anymore; still unexecuted. | `acceptance-matrix.md`; `tasks.md` 2.1; `scripts/assert-org-superset-columns.*`; no container runtime | **tests** (local `db reset` + assert) before treating schema as proven |
| **Gap** | SQL isolation / pet RPC | Tasks **2.2 / 2.3** open; pgTAP / RPC smoke not run on reconciled chain. | `tasks.md`; acceptance “Cross-org isolation” BLOCKED | **tests** |
| **Gap** | Operator login E2E | Matrix BLOCKED; unit guards only. Acceptable residual if human OK after Blockers cleared. | `acceptance-matrix.md`; `reports/smoke.md` | **tests** / human accept |
| **Minor** | Smoke report drift | `reports/smoke.md` still claims `route.test.ts` covers secret accept/reject; file is normalize/thinness only. Matrix was corrected; smoke was not. | `smoke.md` L18–19 vs `route.test.ts` | **docs** |
| **Minor** | Main spec lag | Canonical `openspec/specs/local-dev-environment/spec.md` still describes admin-only reset/seed; coexistence delta lives under the change folder (sync-on-archive). | main spec L19–28 vs change delta | **OpenSpec** on archive |
| **Minor** | Types / data-model | Hand-merged `database.types.ts`; `docs/data-model.md` still says `webhook_secret_ciphertext`. Unchanged from prior Minor list. | prior review; fix report residual | **code/docs** follow-up |
| **Minor** | cron job name | `cron.schedule('purge-error-logs')` may notice-fail if re-scheduled; migration does not abort. | `20260930000100_foundation.sql` ~L277–289 | optional **code** hardening |
| **Question** | Archive bar | Human OK still required while Gaps remain. Adversarial OK to archive **only if** human explicitly accepts live-SQL + login Gaps; otherwise close Gaps first. | `tasks.md` 7.4 | **process** / human |

### Prior Blockers / Majors — disposition

| ID | Disposition |
|---|---|
| Blocker seed regression | **Fixed** (not papered over) |
| Blocker pet-only `organizations` create | **Fixed** (not papered over) |
| Major schema proof theater | **Addressed via honesty** → Gap |
| Major isolation/RPC unproven | **Still open honestly** → Gap |
| Major webhook matrix evidence | **Fixed** |
| Major local-dev/seed contract | **Fixed in code/docs/delta**; main spec sync deferred → Minor |

### What was checked and did **not** rise to Blocker/Major

- Fixed UUID / phone / instance / secret alignment between `seed.sql` and `seed.ts`.
- Idempotency patterns across foundation + hardening + rate-limit migrations (static).
- Webhook unit proof paths cited by acceptance matrix (7/7 re-run PASS).
- Inbox still EmptyState; OpenSpec foundation folders present; dual-baseline root docs intact.
- Round-1 did **not** fake green live SQL.

---

## Verdict

**PASS WITH GAPS**

No remaining **Blockers** or **Majors**. Prior FAIL items are fixed or honestly demoted. Residual live SQL / login items are tracked **Gaps** (and a few **Minors**). Archiving is **conditionally advisable** only with explicit human acceptance of those Gaps (or after a local reset + `test:db` closes them).

---

## Recommended next steps (before archive)

1. On a machine with Podman/Docker: `npm run db:reset` → `node scripts/assert-org-superset-columns.mjs` → `npm run test:db` → pet RPC smoke; then check tasks 2.1–2.3.
2. Optionally fix `reports/smoke.md` webhook evidence to match the corrected acceptance matrix.
3. On archive: sync main `local-dev-environment` from the change delta; regenerate `database.types.ts` after green reset.
4. Human OK on Gaps (or close Gaps) → task 7.4 / `/opsx:archive`.
