## 1. Branch and merge prep

- [x] 1.1 Create worktree/branch `feature/reconcile-foundation-to-main` from latest `origin/main` (skill `using-git-worktrees`)
- [x] 1.2 Merge `origin/feature/foundation-workspace-auth` into that branch; record conflict list under `reports/merge-conflicts.md`
- [x] 1.3 Decide and document D2 path (alter vs rewrite migration order) in `reports/schema-reconcile.md`

## 2. Schema reconciliation (TDD / SQL first)

- [x] 2.1 Add or adjust migrations so fresh reset yields organizations superset + `org_settings` + foundation tables + pet tables
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

- [ ] 7.1 Mechanical `/opsx:verify` — no CRITICAL for missing root docs or unchecked required tasks
- [ ] 7.2 Write `reports/acceptance-matrix.md` from this change’s scenarios
- [ ] 7.3 Adversarial-review subagent (`audit reconcile-foundation-to-main`) in separate session; fix loop until PASS / PASS WITH GAPS
- [ ] 7.4 Human OK → archive; open PR to `main` if not already open
