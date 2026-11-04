## 1. Branch and merge prep

- [x] 1.1 Create worktree/branch `feature/reconcile-foundation-to-main` from latest `origin/main` (skill `using-git-worktrees`)
- [x] 1.2 Merge `origin/feature/foundation-workspace-auth` into that branch; record conflict list under `reports/merge-conflicts.md`
- [x] 1.3 Decide and document D2 path (alter vs rewrite migration order) in `reports/schema-reconcile.md`

## 2. Schema reconciliation (TDD / SQL first)

- [ ] 2.1 Add or adjust migrations so fresh reset yields organizations superset + `org_settings` + foundation tables + pet tables — **migrations + reconcile SQL written; live `db reset` / column assert NOT run** (no Docker/Podman in agent env). Contract script: `scripts/assert-org-superset-columns.{mjs,sql}`. Keep unchecked until local proof.
- [ ] 2.2 Port/adapt foundation pgTAP (or SQL) org-isolation tests; ensure they run against reconciled schema
- [ ] 2.3 Run pet-related SQL/RPC smoke that still applies (`complete_animal_registration` path) on reconciled DB

## 3. Application integration

- [x] 3.1 Resolve `apps/web` conflicts: keep foundation auth/panel; keep pet webhook + inbound infrastructure
- [x] 3.2 Resolve root `package.json` / lockfile / tsconfig / vitest workspace so both app and worker test scripts work
- [x] 3.3 Align `.env.example` with union of foundation + pet required variables
- [x] 3.4 Ensure `/` and layouts do not break webhook host routes (`/api/webhooks/evolution`, `/api/health`)

## 4. OpenSpec hygiene

- [x] 4.1 Ensure foundation capability specs exist under `openspec/specs/` (copy from feature-branch archive if missing)
- [x] 4.2 Retire stale active `openspec/changes/foundation-workspace-auth` on this branch (move note to archive or delete with pointer to `2026-10-05-foundation-workspace-auth`)
- [x] 4.3 Update `.planning/STATE.md` current focus: foundation reconciled; next `areas-operators-admin` then `mesa-entrada-inbox`

## 5. Verification gates

- [x] 5.1 `npm run typecheck` (or workspace equivalent) green
- [x] 5.2 Unit/contract tests: foundation auth/error suites + pet registry suites green; save summary in `reports/test-summary.md`
- [x] 5.3 Manual or scripted login smoke + webhook dry_run reject/accept smoke; evidence in `reports/smoke.md`

## 6. Root documentation

- [x] 6.1 Update `ARCHITECTURE_SDD.md` (EN) for integrated baseline + follow-ups (shared line, dual coords, map on card deferred)
- [x] 6.2 Update `STUDENT_DECISION_LOG.md` (ES) with merge rationale, schema superset, and deferred home/map decisions

## 7. Close loop (director-owned after apply)

- [x] 7.1 Mechanical `/opsx:verify` — no CRITICAL for missing root docs or unchecked required tasks (`reports/verify-mechanical.md`)
- [x] 7.2 Write `reports/acceptance-matrix.md` from this change’s scenarios
- [x] 7.3 Adversarial-review subagent (`audit reconcile-foundation-to-main`) — first pass **FAIL** (`reports/adversarial-review.md`)
- [x] 7.4 Human OK → archive; open PR to `main` if not already open (human 2026-11-04: merge + continue)

## 8. Adversarial fix loop (post FAIL 2026-11-04)

- [x] 8.1 **Blocker seed:** Re-enable pet SQL seed on reset and/or extend `seed.ts` so one documented path yields admin **and** Inspectoría line/secrets/`org_settings`/neighborhoods; update README + `local-dev-environment` if needed
- [x] 8.2 **Blocker migrations:** Make foundation DDL safe when `organizations` (and overlapping objects) already exist from pet migrations (IF NOT EXISTS / DO blocks), or document wipe-only upgrade and remove false forward-only claim; prefer code fix
- [x] 8.3 **Major proof:** Uncheck or re-prove task 2.1 honestly; run or document `db reset` + column asserts when containers available; keep 2.2/2.3 open until green — **2.1 unchecked**; assertion script added; still no live reset here
- [x] 8.4 Fix acceptance-matrix webhook evidence paths (inbound-repository / webhook-secret, not route.test alone)
- [x] 8.5 Re-audit subagent until PASS / PASS WITH GAPS with no Blocker/Major — **PASS WITH GAPS** (`reports/adversarial-review-reaudit.md`); Gaps: live SQL reset/pgTAP/RPC + login E2E
