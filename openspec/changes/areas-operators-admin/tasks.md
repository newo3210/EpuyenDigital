## 1. Schema and RLS

- [x] 1.1 Migration: `areas`, `area_members`, `profiles.deactivated_at`, `whatsapp_lines.default_area_id` (if missing), unique default-area index, updated_at triggers — `supabase/migrations/20261104130000_areas_operators.sql`
- [x] 1.2 RLS policies on areas/area_members; `operator_area_ids()` helper; last-admin protection trigger/function — same migration (`profiles_guard_last_admin`, `set_default_area`)
- [x] 1.3 pgTAP: cross-org area isolation, last-admin reject, default-area uniqueness, operator_area_ids — `supabase/tests/007_areas_operators.test.sql` (authored; not executed here — no Docker; see `reports/implementation-notes.md`)

## 2. Seed

- [x] 2.1 Seed Mesa de Entrada (`is_default`) + Inspectoría; set line `default_area_id`; membership for seed admin — `supabase/seed.sql`
- [x] 2.2 Extend `seed.ts` mirrors for areas/memberships/line default (idempotent with fixed UUIDs) — `supabase/seed/seed.ts`
- [x] 2.3 Update README / `.env.example` if new seed vars appear (none expected) — no new vars

## 3. Contracts and application services (TDD)

- [x] 3.1 Zod contracts for create/update area, create operator, update role/active, memberships — `apps/web/src/contracts/admin-*.ts` + `packages/shared/src/contracts/area.ts`
- [x] 3.2 Features: create-operator, update-operator, list-operators (admin); unit tests including last-admin error mapping — `features/admin/*` + `*.test.ts`
- [x] 3.3 Features: create/update area, set-default, list areas; assign/remove membership; unit tests — `features/admin/areas.test.ts`
- [x] 3.4 `require-role('admin')` on all mutating admin actions — enforced in use cases + `requirePageRole` on pages

## 4. Presentation (es-AR)

- [x] 4.1 Settings nav links: Áreas, Operadores — `nav-items.ts` (admin-only)
- [x] 4.2 Areas admin pages (list + create/edit) — `app/(panel)/settings/areas/**`
- [x] 4.3 Operators admin pages (list + create + edit role/active + memberships) — `app/(panel)/settings/operators/**`
- [x] 4.4 i18n strings in `es-AR.ts` — `settings.areas` / `settings.operators`

## 5. Docs and quality

- [x] 5.1 Update `ARCHITECTURE_SDD.md` + `STUDENT_DECISION_LOG.md`
- [x] 5.2 Update `docs/data-model.md` marks for implemented areas columns
- [x] 5.3 `npm run typecheck` + `npm test` green; note SQL test status honestly — typecheck/test green; SQL gap in `reports/implementation-notes.md`

## 6. Director close loop

- [ ] 6.1 Mechanical verify + acceptance-matrix
- [ ] 6.2 Adversarial review (new session) + fix loop
- [ ] 6.3 Human OK → archive → next `mesa-entrada-inbox`
