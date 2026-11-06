## 0. Branch

- [x] 0.1 Create branch `cursor/whatsapp-channel-core-0e30` from latest `origin/main` (cloud naming); isolate via worktree if practical
  - Evidence: branch already on origin at plan commit `c97546f`; implementer stayed on branch (no second worktree).

## 1. Schema — conversations, lines, messages (TDD)

- [x] 1.1 Failing tests for conversations uniqueness, message idempotency, line default_area FK, secrets table grants
  - Evidence: `apps/web/src/features/whatsapp-lines/migration-sql.test.ts` + inbound idempotency tests.
- [x] 1.2 Migration: extend `whatsapp_lines` (`evolution_base_url`, `default_area_id`, `status`, `last_status_at` as needed)
  - Evidence: `supabase/migrations/20261107010000_whatsapp_channel_core.sql`
- [x] 1.3 Migration: `whatsapp_line_secrets` ciphertext columns + deny authenticated policies
  - Evidence: same migration (`webhook_secret_ciphertext`, `revoke … authenticated`)
- [x] 1.4 Migration: `conversations` table + RLS org (+ prepare area helper usage; full area RLS can tighten in inbox)
  - Evidence: `conversations` + org RLS policies in migration
- [x] 1.5 Migration: alter `messages` — `conversation_id`, delivery_status enum/text, kinds; unique `(line_id, external_id)` retained
  - Evidence: migration alters messages; unique retained from pet core
- [x] 1.6 Backfill conversations for existing message phones where safe; seed `default_area_id` → Mesa de Entrada
  - Evidence: SQL backfill + seed update in migration / `seed.sql` / `seed.ts`
- [x] 1.7 Document live `db reset` proof or honest Docker gap
  - Evidence: `reports/2026-11-06-step-6.2-unit-test-and-db-verification.md` (NO_DOCKER)

## 2. Inbound channel (TDD)

- [x] 2.1 Harden normalize: groups/broadcast ignore, `@lid`, fromMe → outbound, pushName/avatar, location on message only
  - Evidence: `normalize-evolution.ts` + `route.test.ts`
- [x] 2.2 Webhook: missing secret reject (regression tests); upsert conversation + message; enqueue media jobs
  - Evidence: `inbound-repository.test.ts`, `supabase-inbound-store.ts`
- [x] 2.3 Citizen stub (unregistered) + citizen_phones on first contact
  - Evidence: `upsertCitizenStub` in supabase inbound store + memory store tests
- [x] 2.4 Worker media download writes `storage_path`; pet `process-inbound` coexistence tests
  - Evidence: `download-media.ts` idempotent; existing worker registration tests still green
- [x] 2.5 Delivery/read ACK handler updates outbound `delivery_status`
  - Evidence: `ingestDeliveryAck` + normalize `messages.update` mapping

## 3. Outbound + send_mode (TDD)

- [x] 3.1 Shared send_mode guard (dry_run / allowlist / production) with unit tests
  - Evidence: `packages/shared/src/infrastructure/send-mode.ts` (+ tests); worker re-exports
- [x] 3.2 Send-text use case + Evolution client; normalize phone; persist outbound message
  - Evidence: `features/outbound/send-text.ts` + tests; `HttpEvolutionClient`
- [x] 3.3 Wire worker/job or server path consistently; no plaintext secret logging
  - Evidence: panel server path uses decrypted credentials without logging; worker `send_outbound` unchanged guard

## 4. Admin UI — lines

- [x] 4.1 Routes `/settings/lines` (admin-only); i18n es-AR; nav item
  - Evidence: page + `nav-items.ts` + `esAR.lines`
- [x] 4.2 Create/edit line form: instance, base URL, display phone, default area, secret fields (write-only)
  - Evidence: `presentation/whatsapp/line-form.tsx`
- [x] 4.3 “Probar conexión” action updates status; error surfacing without leaking secrets
  - Evidence: `testConnectionAction` / `test-connection.ts`

## 5. Minimal panel composer

- [x] 5.1 Inbox list of conversations (org-scoped) replacing empty placeholder as needed
  - Evidence: `(panel)/inbox/page.tsx` + `ConversationList`
- [x] 5.2 Thread view + text composer calling send-text use case
  - Evidence: `(panel)/inbox/[conversationId]/page.tsx` + composer
- [x] 5.3 Empty/validation errors; dry_run visible feedback in UI copy
  - Evidence: `esAR.inbox.composer.dryRunSaved` + send-text dry_run path

## 6. Mandatory verification

- [x] 6.1 Review/update existing webhook/pet/nav tests
  - Evidence: `npm test` — 613 passed (incl. pet worker + webhook + nav)
- [x] 6.2 Unit tests + DB state report under `reports/YYYY-MM-DD-step-6.2-unit-test-and-db-verification.md`
  - Evidence: report path below
- [x] 6.3 Curl/manual: webhook reject/accept, send dry_run, admin line save; report + restore DB
  - Evidence: report documents NO_DOCKER / no live stack blocker
- [x] 6.4 E2E browser admin line + composer if env allows; else documented blocker
  - Evidence: report documents E2E blocker
- [x] 6.5 Update `docs/data-model.md`, `.planning/STATE.md`, REQUIREMENTS WA checkboxes as appropriate
  - Evidence: files updated this apply

## 7. Root documentation

- [x] 7.1 Update `ARCHITECTURE_SDD.md` (EN) for conversations, line admin, outbound, deferred inbox
- [x] 7.2 Update `STUDENT_DECISION_LOG.md` (ES) with D1–D8 and WA→inbox sequence

## 8. Close loop (director-owned)

- [x] 8.1 Mechanical verify → `reports/verify-mechanical.md` — **PASS WITH GAPS**
- [x] 8.2 Acceptance matrix from scenarios — `reports/acceptance-matrix.md`
- [ ] 8.3 Adversarial-review subagent; fix loop until PASS / PASS WITH GAPS — launched
- [ ] 8.4 Human OK → archive; PR #6 open
- [ ] 8.5 After archive: open `/director` for `mesa-entrada-inbox` with stored scope (INB full, dual coords, manual routing)
