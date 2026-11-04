## 1. Schema and RLS

- [ ] 1.1 Migration: `areas`, `area_members`, `profiles.deactivated_at`, `whatsapp_lines.default_area_id` (if missing), unique default-area index, updated_at triggers
- [ ] 1.2 RLS policies on areas/area_members; `operator_area_ids()` helper; last-admin protection trigger/function
- [ ] 1.3 pgTAP: cross-org area isolation, last-admin reject, default-area uniqueness, operator_area_ids

## 2. Seed

- [ ] 2.1 Seed Mesa de Entrada (`is_default`) + Inspectoría; set line `default_area_id`; membership for seed admin
- [ ] 2.2 Extend `seed.ts` mirrors for areas/memberships/line default (idempotent with fixed UUIDs)
- [ ] 2.3 Update README / `.env.example` if new seed vars appear (none expected)

## 3. Contracts and application services (TDD)

- [ ] 3.1 Zod contracts for create/update area, create operator, update role/active, memberships
- [ ] 3.2 Features: create-operator, update-operator, list-operators (admin); unit tests including last-admin error mapping
- [ ] 3.3 Features: create/update area, set-default, list areas; assign/remove membership; unit tests
- [ ] 3.4 `require-role('admin')` on all mutating admin actions

## 4. Presentation (es-AR)

- [ ] 4.1 Settings nav links: Áreas, Operadores
- [ ] 4.2 Areas admin pages (list + create/edit)
- [ ] 4.3 Operators admin pages (list + create + edit role/active + memberships)
- [ ] 4.4 i18n strings in `es-AR.ts`

## 5. Docs and quality

- [ ] 5.1 Update `ARCHITECTURE_SDD.md` + `STUDENT_DECISION_LOG.md`
- [ ] 5.2 Update `docs/data-model.md` marks for implemented areas columns
- [ ] 5.3 `npm run typecheck` + `npm test` green; note SQL test status honestly

## 6. Director close loop

- [ ] 6.1 Mechanical verify + acceptance-matrix
- [ ] 6.2 Adversarial review (new session) + fix loop
- [ ] 6.3 Human OK → archive → next `mesa-entrada-inbox`
