## 0. Branch

- [ ] 0.1 Create branch `cursor/whatsapp-channel-core-0e30` from latest `origin/main` (cloud naming); isolate via worktree if practical

## 1. Schema — conversations, lines, messages (TDD)

- [ ] 1.1 Failing tests for conversations uniqueness, message idempotency, line default_area FK, secrets table grants
- [ ] 1.2 Migration: extend `whatsapp_lines` (`evolution_base_url`, `default_area_id`, `status`, `last_status_at` as needed)
- [ ] 1.3 Migration: `whatsapp_line_secrets` ciphertext columns + deny authenticated policies
- [ ] 1.4 Migration: `conversations` table + RLS org (+ prepare area helper usage; full area RLS can tighten in inbox)
- [ ] 1.5 Migration: alter `messages` — `conversation_id`, delivery_status enum/text, kinds; unique `(line_id, external_id)` retained
- [ ] 1.6 Backfill conversations for existing message phones where safe; seed `default_area_id` → Mesa de Entrada
- [ ] 1.7 Document live `db reset` proof or honest Docker gap

## 2. Inbound channel (TDD)

- [ ] 2.1 Harden normalize: groups/broadcast ignore, `@lid`, fromMe → outbound, pushName/avatar, location on message only
- [ ] 2.2 Webhook: missing secret reject (regression tests); upsert conversation + message; enqueue media jobs
- [ ] 2.3 Citizen stub (unregistered) + citizen_phones on first contact
- [ ] 2.4 Worker media download writes `storage_path`; pet `process-inbound` coexistence tests
- [ ] 2.5 Delivery/read ACK handler updates outbound `delivery_status`

## 3. Outbound + send_mode (TDD)

- [ ] 3.1 Shared send_mode guard (dry_run / allowlist / production) with unit tests
- [ ] 3.2 Send-text use case + Evolution client; normalize phone; persist outbound message
- [ ] 3.3 Wire worker/job or server path consistently; no plaintext secret logging

## 4. Admin UI — lines

- [ ] 4.1 Routes `/settings/lines` (admin-only); i18n es-AR; nav item
- [ ] 4.2 Create/edit line form: instance, base URL, display phone, default area, secret fields (write-only)
- [ ] 4.3 “Probar conexión” action updates status; error surfacing without leaking secrets

## 5. Minimal panel composer

- [ ] 5.1 Inbox list of conversations (org-scoped) replacing empty placeholder as needed
- [ ] 5.2 Thread view + text composer calling send-text use case
- [ ] 5.3 Empty/validation errors; dry_run visible feedback in UI copy

## 6. Mandatory verification

- [ ] 6.1 Review/update existing webhook/pet/nav tests
- [ ] 6.2 Unit tests + DB state report under `reports/YYYY-MM-DD-step-6.2-unit-test-and-db-verification.md`
- [ ] 6.3 Curl/manual: webhook reject/accept, send dry_run, admin line save; report + restore DB
- [ ] 6.4 E2E browser admin line + composer if env allows; else documented blocker
- [ ] 6.5 Update `docs/data-model.md`, `.planning/STATE.md`, REQUIREMENTS WA checkboxes as appropriate

## 7. Root documentation

- [ ] 7.1 Update `ARCHITECTURE_SDD.md` (EN) for conversations, line admin, outbound, deferred inbox
- [ ] 7.2 Update `STUDENT_DECISION_LOG.md` (ES) with D1–D8 and WA→inbox sequence

## 8. Close loop (director-owned)

- [ ] 8.1 Mechanical verify → `reports/verify-mechanical.md`
- [ ] 8.2 Acceptance matrix from scenarios
- [ ] 8.3 Adversarial-review subagent; fix loop until PASS / PASS WITH GAPS
- [ ] 8.4 Human OK → archive; open PR to `main`
- [ ] 8.5 After archive: open `/director` for `mesa-entrada-inbox` with stored scope (INB full, dual coords, manual routing)
