# Adversarial review — reconcile-foundation-to-main

**Scope:** OpenSpec change `reconcile-foundation-to-main` on branch `cursor/reconcile-foundation-to-main-c2b5` vs `origin/main`  
**Date:** 2026-11-04  
**Reviewer role:** Independent adversarial reviewer (did **not** implement the merge)  
**Sources:**
- `openspec/changes/reconcile-foundation-to-main/{proposal,design,tasks}.md`
- `openspec/changes/reconcile-foundation-to-main/specs/foundation-main-integration/spec.md`
- `openspec/changes/reconcile-foundation-to-main/reports/{acceptance-matrix,verify-mechanical,schema-reconcile,merge-conflicts,smoke,test-summary}.md`
- Diff: `git diff origin/main...HEAD` (focus: `supabase/migrations`, `apps/web`, package manifests, `openspec/specs`, root docs, seed/config)
- Targeted re-run: `npm run typecheck` PASS; Vitest webhook/auth subset 18/18 PASS
- No Docker/Podman in this environment — live `db reset` / pgTAP still unproven (same gap as author reports)

---

## Spec and task alignment

| Claim / criterion | Author status | Adversarial read |
|---|---|---|
| Foundation panel + pet webhook coexist | tasks 3.x done; matrix mostly PASS | App routes coexist on disk; **data bootstrap does not** — pet line seed disabled |
| Organizations superset on fresh reset | task 2.1 checked; matrix **BLOCKED** | Forward migration looks coherent on paper; **not executed**; upgrade path for existing pet DBs is unsafe |
| Cross-org isolation SQL | tasks 2.2 / 2.3 open; matrix **BLOCKED** | Honest gap; still a SHALL scenario — cannot archive as proven |
| Operator login E2E | matrix **BLOCKED** | Unit guards exist; live session unproven |
| No fake inbox triage | matrix PASS | Confirmed: `/inbox` is `EmptyState` only |
| OpenSpec hygiene (foundation specs + retire active change) | verify PASS | Confirmed: specs under `openspec/specs/`; `RETIRED-foundation-workspace-auth.md`; archive `2026-10-05-foundation-workspace-auth` |
| Webhook secret fail-closed | matrix PASS | Unit proof is real in `inbound-repository` / `webhook-secret`; **not** in `route.test.ts` (evidence path wrong) |

**Non-goals** (real triage, areas, inquiry map) are respected in code and root docs — no fake product completion there.

**Underspecified / process risk:** Design Rollback says existing pet-only DBs should get “forward-only” migrations, but the merge **introduces earlier-timestamped foundation DDL** that is not additive on an already-pet schema. Acceptance marks core schema scenarios BLOCKED yet tasks mark 2.1 complete — completion theater.

---

## Findings

| Severity | Area | Finding | Evidence | Fix owner |
|----------|------|---------|----------|-----------|
| **Blocker** | Seed / coexistence | After reconcile, `[db.seed] enabled = false` (foundation config) and `npm run db:seed` only runs `supabase/seed/seed.ts` (org + admin profile). Pet `supabase/seed.sql` (org_settings, whatsapp_lines, line secrets, neighborhood codes) is **never applied** on the documented reset+seed path. `origin/main` had a minimal `config.toml` **without** disabling seed, so `seed.sql` ran on reset — this is a **regression**. Result: panel login can work while live Evolution webhook against Supabase returns `LINE_NOT_FOUND` / has no org_settings. | `supabase/config.toml` L67–73 (`enabled = false`); `supabase/seed/seed.ts` (no whatsapp/org_settings); `supabase/seed.sql` (pet bootstrap); `README.md` documents `db:seed` as foundation admin only; main `supabase/config.toml` was 14 lines with no `[db.seed]` disable | **code** (+ **docs**): re-enable SQL seed and/or extend `seed.ts` to upsert pet line/settings/secrets; document one command path that yields **both** admin and Inspectoría line |
| **Blocker** | Schema / upgrade | Foundation migration uses bare `create table public.organizations (...)` (no `IF NOT EXISTS`). On any environment that already applied pet `20261012*` (mainline), pending apply of `20260930000100_foundation.sql` **fails** because `organizations` already exists. Design/rollback claim that pet-only DBs can take forward migrations is false for this history. Fresh-reset-only would need to be an explicit supported limitation — it is not. | `supabase/migrations/20260930000100_foundation.sql` L14–19; pet `20261012010000_pet_registry_core.sql` L17–24 (`create table if not exists`); `design.md` Rollback / D2; `reports/schema-reconcile.md` | **code** (make foundation org/table creates conditional / move foundation objects into a true forward migration that assumes pet orgs may exist) + **spec/docs** if “fresh reset only” is the real contract |
| **Major** | Schema proof | Scenario “Fresh database reset succeeds” is a SHALL and remains **BLOCKED**; task **2.1 is checked** without `supabase db reset`. Reconcile SQL (`ADD COLUMN IF NOT EXISTS timezone/updated_at`, trigger guard, `set_updated_at` search_path restore) is plausible but unproven. Archiving while the central reconcile scenario is unexecuted is unsafe. | `tasks.md` 2.1 `[x]`; `reports/acceptance-matrix.md` Fresh reset → BLOCKED; `reports/schema-reconcile.md` Gap; no Docker/Podman here | **tests** (run reset + column assertions) before archive; keep task open until green |
| **Major** | SQL isolation / pet RPC | Scenarios and tasks for org-isolation pgTAP and pet RPC smoke (`2.2`, `2.3`) are open/BLOCKED. Foundation suites exist under `supabase/tests/` and `pet_registry_pgtap.sql` is present, but **nothing proves** they still pass on the reconciled chain (including org inserts that omit `timezone` relying on defaults). | `tasks.md` 2.2–2.3 `[ ]`; acceptance “Cross-org isolation” BLOCKED; `supabase/tests/001_org_isolation.test.sql`; `supabase/tests/pet_registry_pgtap.sql` | **tests** |
| **Major** | Verification hygiene | Acceptance “Pet webhook still accepts valid secret” cites `apps/web/src/app/api/webhooks/evolution/route.test.ts`, which only covers normalize/thinness — **no secret accept/reject**. Real proof is `inbound-repository.test.ts` + `webhook-secret.test.ts` (re-confirmed 18/18). Overstates route-level coverage. | `route.test.ts` (no `ingestInboundEvent`/401); `inbound-repository.test.ts`; `acceptance-matrix.md` webhook accept row | **docs/tests** (fix matrix evidence; optionally add route-level secret tests) |
| **Major** | Env / local-dev contract | `local-dev-environment` still says reset+seed yields org + admin; it does **not** require Inspectoría line, but **this change’s** purpose is coexistence. README/`config.toml` comment claim seed.ts replaces SQL seeding is incomplete — seed.ts is not a functional substitute for pet `seed.sql`. Spec/docs drift after merge. | `openspec/specs/local-dev-environment/spec.md` Reset and seed; `supabase/config.toml` comment L69; `README.md` | **spec** and/or **docs** + **code** (unified seed) |
| **Minor** | Types drift | `database.types.ts` is hand-merged (foundation shape + org superset + pet tables/RPCs). Mechanical verify already suggests regenerate after local reset. Risk of silent column/RPC skew until `npm run db:types`. | `reports/schema-reconcile.md` Types; `reports/verify-mechanical.md` SUGGESTION; `packages/shared/src/contracts/database.types.ts` | **code** (regenerate) when DB available |
| **Minor** | Docs drift | `docs/data-model.md` still describes `webhook_secret_ciphertext` while schema/seed use plaintext `webhook_secret`. Pre-existing, but merge did not reconcile docs with live pet schema. | `docs/data-model.md` ~L68; `supabase/migrations/20261012010000_pet_registry_core.sql` L64–66; `supabase/seed.sql` L37–41 | **docs** |
| **Minor** | Naming | Proposal/design refer to branch `feature/reconcile-foundation-to-main`; delivery branch is `cursor/reconcile-foundation-to-main-c2b5`. | `proposal.md` What Changes; git branch | **docs** |
| **Question** | Intentional seed disable? | Was pet `seed.sql` deliberately left disabled expecting operators to run it manually? No report, README step, or task records that procedure. | `reports/merge-conflicts.md` (config.toml → foundation); no seed unification task | needs **human/author** confirmation |
| **Question** | Archive bar | Author acceptance verdict is PASS WITH GAPS with 3/9 BLOCKED including schema SHALL. Is human OK willing to archive without live SQL? Adversarial recommendation: **no**, until Blockers cleared and reset proven. | `acceptance-matrix.md` Summary; `tasks.md` 7.3–7.4 | **process** / human |

### What was checked and did **not** rise to Blocker

- **Webhook secret optional at env parse:** `WEBHOOK_SECRET` optional in `parseEnv` is OK because **line** `webhookSecret` is source of truth; `verifyWebhookSecret` fail-closes with 503 if null (`webhook-secret.ts`, inbound tests).
- **Inbox fake completion:** `apps/web/src/app/(panel)/inbox/page.tsx` is EmptyState only; no claim/distribute UI.
- **Panel shell presence:** `(auth)/login`, `(panel)/{inbox,citizens,tasks,settings/profile,support/errors}`, middleware public `/api` + `/login`, root redirect to `/inbox`.
- **OpenSpec hygiene:** foundation capability folders present beside pet specs; stale active `foundation-workspace-auth` retired; archive pointer OK.
- **Root docs:** `ARCHITECTURE_SDD.md` / `STUDENT_DECISION_LOG.md` describe dual baseline and deferred Mesa/dual-coords/map.
- **Unit/typecheck claims:** typecheck re-run PASS; targeted auth/webhook tests PASS (does not redeem Blockers above).

---

## Verdict

**FAIL**

At least two **Blockers** (pet seed regression breaking live coexistence; non-idempotent foundation `organizations` create breaking pet-only upgrade / `db push` history) plus multiple **Majors** on unproven schema/SQL acceptance and verification overclaim. Archiving is **not advisable** in the current state.

---

## Recommended next steps (before archive)

1. **Unify seed:** ensure one documented path (`db reset` and/or `db:seed`) creates admin **and** Inspectoría `whatsapp_lines` / secrets / `org_settings` / neighborhoods; update README + local-dev spec if needed.
2. **Fix migration upgrade safety:** make foundation DDL safe when `organizations` (and related objects) already exist from pet migrations, *or* explicitly document and tool a “wipe + reset only” upgrade and remove the false forward-only promise.
3. **Prove D2:** run `supabase db reset`, assert organizations superset columns + `org_settings`, run `npm run test:db` (foundation isolation + pet pgTAP) and pet RPC smoke; uncheck/re-check tasks 2.1–2.3 honestly.
4. **Correct acceptance evidence** for webhook scenarios; keep login E2E blocked only if human explicitly accepts residual risk after Blockers are gone.
5. Regenerate `database.types.ts` after a green local reset.
6. Re-run this adversarial review on the fix diff (new session) until PASS or PASS WITH GAPS with **no Blockers/Majors**.
