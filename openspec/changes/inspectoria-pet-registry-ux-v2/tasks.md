## 0. Setup

- [x] 0.1 Branch `cursor/inspectoria-pet-registry-ux-v2-4cd2` (or continue current) tracking origin
  - Evidence: `git branch` shows `cursor/inspectoria-pet-registry-ux-v2-4cd2`
- [x] 0.2 Confirm base MVP code present from archived pet-registry change
  - Evidence: `packages/shared/src/registration/**`, `worker/src/jobs/**`, archived `openspec/changes/archive/2026-10-12-inspectoria-pet-registry-bot`

## 1. Shared domain + copy (TDD)

- [x] 1.1 Update steps: remove `consent`/`neighborhood`; add `welcome`, `location_help_offer`, `location_help`
  - Evidence: `packages/shared/src/registration/steps.ts`, `registration-session.ts`
- [x] 1.2 Rewrite `registration.ts` es-AR copy to product script (incl. confirmation with citizen name)
  - Evidence: `packages/shared/src/i18n/es-AR/registration.ts` + unit tests
- [x] 1.3 Menus: rabies `3 No sé` → `unknown`; health skip `No`; location skip `No puedo ahora`; photo finish Listo/OK/non-image
  - Evidence: `menus.ts` / `menus.test.ts` / `state-machine.ts`
- [x] 1.4 State-machine tests for new path, help branch, skip GPS, multi-photo+Listo, no consent
  - Evidence: `state-machine.test.ts`
- [x] 1.5 Municipal ID tests: empty neighborhood → `EPU-…`
  - Evidence: `municipal-id.test.ts`; worker forces `p_neighborhood: null`

## 2. Worker / outbound image

- [x] 2.1 Add placeholder `worker/assets/inspectoria/location-help.png` + env `LOCATION_HELP_IMAGE_PATH`
  - Evidence: asset file; `env.ts`; `.env.example`
- [x] 2.2 Extend `send_outbound` to send image (Evolution + dry_run simulate)
  - Evidence: `evolution/client.ts` `sendImage`; `send-outbound.ts`; handlers test
- [x] 2.3 `process_inbound`: on `location_help` enqueue text + image outbound
  - Evidence: `process-inbound.ts` `enqueueEffect` + auto-advance to `location`
- [x] 2.4 Finalize/hydrate without requiring lat/lng; confirmation params include citizen name
  - Evidence: `citizen.ts` nullable GPS; confirmation format; flow tests
- [x] 2.5 Flow + adversarial-fix tests updated for new script
  - Evidence: `flow.test.ts`, `adversarial-fixes.test.ts`

## 3. Database

- [x] 3.1 Migration: widen `animals.rabies_status` check to include `unknown` if constrained
  - Evidence: `supabase/migrations/20261012120000_rabies_status_unknown.sql`
- [x] 3.2 Update shared `database.types` / contracts enums
  - Evidence: `animal.ts`, `menus.ts`, session payload `unknown` rabies

## 4. Docs + verify

- [x] 4.1 Update `ARCHITECTURE_SDD.md` + `STUDENT_DECISION_LOG.md` for UX v2 decisions
  - Evidence: root docs updated; runbook + `.env.example`
- [x] 4.2 `npm run test` / typecheck / lint green
  - Evidence: see report under `reports/`
- [x] 4.3 Short report under `openspec/changes/inspectoria-pet-registry-ux-v2/reports/`
  - Evidence: `reports/implementation-notes.md`

## 5. Review gates

- [x] 5.1 Mechanical verify
  - Evidence: tasks marked; specs present under change `specs/`
- [x] 5.2 Acceptance matrix for new scenarios
  - Evidence: `reports/acceptance-matrix.md`
- [ ] 5.3 Adversarial review subagent (new session)
  - Deferred: writer ≠ reviewer rule — run in a separate chat before archive
