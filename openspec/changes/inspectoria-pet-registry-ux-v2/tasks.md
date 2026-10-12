## 0. Setup

- [ ] 0.1 Branch `cursor/inspectoria-pet-registry-ux-v2-4cd2` (or continue current) tracking origin
- [ ] 0.2 Confirm base MVP code present from archived pet-registry change

## 1. Shared domain + copy (TDD)

- [ ] 1.1 Update steps: remove `consent`/`neighborhood`; add `welcome`, `location_help_offer`, `location_help`
- [ ] 1.2 Rewrite `registration.ts` es-AR copy to product script (incl. confirmation with citizen name)
- [ ] 1.3 Menus: rabies `3 No sé` → `unknown`; health skip `No`; location skip `No puedo ahora`; photo finish Listo/OK/non-image
- [ ] 1.4 State-machine tests for new path, help branch, skip GPS, multi-photo+Listo, no consent
- [ ] 1.5 Municipal ID tests: empty neighborhood → `EPU-…`

## 2. Worker / outbound image

- [ ] 2.1 Add placeholder `worker/assets/inspectoria/location-help.png` + env `LOCATION_HELP_IMAGE_PATH`
- [ ] 2.2 Extend `send_outbound` to send image (Evolution + dry_run simulate)
- [ ] 2.3 `process_inbound`: on `location_help` enqueue text + image outbound
- [ ] 2.4 Finalize/hydrate without requiring lat/lng; confirmation params include citizen name
- [ ] 2.5 Flow + adversarial-fix tests updated for new script

## 3. Database

- [ ] 3.1 Migration: widen `animals.rabies_status` check to include `unknown` if constrained
- [ ] 3.2 Update shared `database.types` / contracts enums

## 4. Docs + verify

- [ ] 4.1 Update `ARCHITECTURE_SDD.md` + `STUDENT_DECISION_LOG.md` for UX v2 decisions
- [ ] 4.2 `npm run test` / typecheck / lint green
- [ ] 4.3 Short report under `openspec/changes/inspectoria-pet-registry-ux-v2/reports/`

## 5. Review gates

- [ ] 5.1 Mechanical verify
- [ ] 5.2 Acceptance matrix for new scenarios
- [ ] 5.3 Adversarial review subagent (new session)
