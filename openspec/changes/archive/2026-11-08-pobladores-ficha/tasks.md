## 0. Branch

- [x] 0.1 Branch `cursor/pobladores-ficha-3654` from `cursor/mesa-entrada-inbox-3654` (this plan commit). No production code before this artifact is approved.

## 1. Database — profile, guard, search, merge (TDD)

- [x] 1.1 Failing Vitest contract on the migration SQL: columns, `field_sources`, guard trigger, `register_citizen`, `merge_citizens`, `search_citizens`, revoke of authenticated UPDATE.
- [x] 1.2 Migration: `email`, `tags`, `observations`, `field_sources`, `merged_into_id`, `registered_at`, `registered_by`. Partial unique `document_id` per org when not null.
- [x] 1.3 Guard trigger: a non-operator writer cannot change a column whose source is `manual`.
- [x] 1.4 `update_citizen_profile`, `register_citizen` (person vs organization rules), `search_citizens`, `merge_citizens` as definer functions with the hint codes in design D3.
- [x] 1.5 Org-wide SELECT for the caller's organization. No authenticated UPDATE/DELETE on `citizens`. Support cannot execute mutating functions.
- [x] 1.6 `supabase/tests/008_citizens_ficha.test.sql`: manual name survives a service-role overwrite, cross-org search empty, merge moves a phone and a conversation, second merge of the same drop fails, support update forbidden.
- [x] 1.7 Make unit tests pass. Record live `supabase test db` or an honest `NO_DOCKER` gap.

## 2. Application services (TDD)

- [x] 2.1 Zod contracts for profile edit, register, search query, and merge (two ids, note).
- [x] 2.2 Use cases call the SQL functions with the user-scoped server client. Map hint codes to es-AR.
- [x] 2.3 Pet store writes still set empty `full_name` / `document_id`. A test proves a manual `full_name` is unchanged when that path runs against the guard (SQL test or a store test with the trigger rule mirrored).
- [x] 2.4 Channel stub keeps writing `whatsapp_push_name` and does not assign `full_name`.

## 3. Ficha UI

- [x] 3.1 `/citizens` search with empty state and no full-table load. `/citizens/[id]` shows the ficha.
- [x] 3.2 Thread links to the same ficha. Edit, party kind, missing-field list, and register. Support sees no mutating controls.
- [x] 3.3 Timeline: messages, conversation events, animals. Home coordinates labeled apart from inquiry pins.
- [x] 3.4 Merge form: pick the kept record, require a note, show the result on the kept ficha.
- [x] 3.5 Presentation components do not import Supabase. Copy in `es-AR`.

## 4. Root docs

- [x] 4.1 Update `ARCHITECTURE_SDD.md` (English): ficha, guard, search, merge, deferred notes/tasks.
- [x] 4.2 Update `STUDENT_DECISION_LOG.md` (Spanish): why `document_id`, why the guard trigger, why merge keeps the row.
- [x] 4.3 Update `docs/data-model.md` marks for the new citizen columns.

## 5. Mandatory verification

- [x] 5.1 Review pet registration tests that write `full_name` and adjust them if the guard changes an expectation.
- [x] 5.2 Run unit tests and record database notes in `reports/YYYY-MM-DD-step-5.2-unit-test-and-db-verification.md`.
- [x] 5.3 Curl the profile, register, search, and merge paths (or the documented blocker) in `reports/YYYY-MM-DD-step-5.3-curl-manual.md`.
- [x] 5.4 Browser pass for edit, register flag on the queue card, search, and merge, in `reports/YYYY-MM-DD-step-5.4-e2e-browser.md`.
- [x] 5.5 Acceptance matrix from the specs. Do not archive in this task list.

## 6. Explicitly not in this change

- [ ] 6.1 Do not build the bot questionnaire or confirmed DNI extraction.
- [ ] 6.2 Do not create notes or tasks tables.
- [ ] 6.3 Do not copy message coordinates onto the citizen.
