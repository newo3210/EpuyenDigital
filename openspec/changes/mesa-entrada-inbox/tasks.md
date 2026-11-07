## 0. Branch

- [ ] 0.1 Create `cursor/mesa-entrada-inbox-0e30` from `origin/main`

## 1. Schema + SQL transitions (TDD)

- [ ] 1.1 `conversation_events`, read-state table, quick_replies; inquiry coords on conversations if needed
- [ ] 1.2 RPCs: claim, delegate, accept, reject, ensure_owner_for_reply, move, resolve, reopen, set_conversation_area
- [ ] 1.3 Area RLS on conversations/messages via `current_area_ids()` (+ admin bypass, delegation visibility)
- [ ] 1.4 SLA helper using area minutes + business hours; indexes for queue ordering
- [ ] 1.5 Webhook/inbound reopen resolved conversations; optional pet enqueue gate task
- [ ] 1.6 Live db proof or honest Docker gap

## 2. Application services (TDD)

- [ ] 2.1 Feature wrappers for each RPC with CLAIM_CONFLICT mapping
- [ ] 2.2 Queue query (FIFO unowned-first) + filters
- [ ] 2.3 ensure_owner integrated into send-text path
- [ ] 2.4 Quick replies list/insert; read-state mark-on-open
- [ ] 2.5 Inquiry coords resolve for card (message → conversation)

## 3. Inbox UI

- [ ] 3.1 Queue list/kanban with flags + filters + SLA colors
- [ ] 3.2 Thread: events timeline, delivery ticks, claim/delegate/accept/reject/move/resolve/set-area actions
- [ ] 3.3 Composer + quick replies + conflict toasts
- [ ] 3.4 Map on card when inquiry coords exist
- [ ] 3.5 Realtime subscriptions + badge/optional sound
- [ ] 3.6 i18n es-AR

## 4. Mandatory verification

- [ ] 4.1 Update existing inbox/outbound/nav tests
- [ ] 4.2 Unit + DB report under `reports/`
- [ ] 4.3 Curl/RPC manual report
- [ ] 4.4 E2E claim/delegate/realtime or documented blocker
- [ ] 4.5 Update data-model, STATE, REQUIREMENTS INB checkboxes

## 5. Root docs

- [ ] 5.1 `ARCHITECTURE_SDD.md` (EN)
- [ ] 5.2 `STUDENT_DECISION_LOG.md` (ES)

## 6. Close loop (director)

- [ ] 6.1 Mechanical verify
- [ ] 6.2 Acceptance matrix
- [ ] 6.3 Adversarial (+ fix loop)
- [ ] 6.4 Human OK → archive + PR merge
