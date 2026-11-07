## 0. Branch

- [x] 0.1 Create `cursor/mesa-entrada-inbox-0e30` from `origin/main` — **skipped by director; branch already existed at plan commit `9f1ff07`**

## 1. Schema + SQL transitions (TDD)

- [x] 1.1 `conversation_events`, read-state table, quick_replies; inquiry coords on conversations if needed — `supabase/migrations/20261107120000_mesa_entrada_inbox.sql`; static test `features/inbox/migration-sql.test.ts`
- [x] 1.2 RPCs: claim, delegate, accept, reject, ensure_owner_for_reply, move, resolve, reopen, set_conversation_area — same migration; CLAIM_CONFLICT + FOR UPDATE
- [x] 1.3 Area RLS on conversations/messages via `current_area_ids()` (+ admin bypass, delegation visibility) — policies `conversations_select_area` / `messages_select_area`
- [x] 1.4 SLA helper using area minutes + business hours; indexes for queue ordering — `business_minutes_between`, `compute_conversation_sla_status`, FIFO indexes
- [x] 1.5 Webhook/inbound reopen resolved conversations; optional pet enqueue gate task — `reopenIfResolved` + `shouldEnqueuePetProcessInbound` in inbound store/repo
- [x] 1.6 Live db proof or honest Docker gap — **NO_DOCKER**; see `reports/2026-11-07-step-4.2-unit-test-and-db-verification.md`

## 2. Application services (TDD)

- [x] 2.1 Feature wrappers for each RPC with CLAIM_CONFLICT mapping — `features/inbox/transitions.ts` + tests
- [x] 2.2 Queue query (FIFO unowned-first) + filters — `queue-sort.ts`, `inbox-queue.ts`
- [x] 2.3 ensure_owner integrated into send-text path — `features/outbound/send-text.ts`
- [x] 2.4 Quick replies list/insert; read-state mark-on-open — `listQuickReplies`, `markThreadReadAction`
- [x] 2.5 Inquiry coords resolve for card (message → conversation) — `inquiry-coords.ts`

## 3. Inbox UI

- [x] 3.1 Queue list/kanban with flags + filters + SLA colors — `conversation-list`, `queue-card`, `inbox-filters`
- [x] 3.2 Thread: events timeline, delivery ticks, claim/delegate/accept/reject/move/resolve/set-area actions — `conversation-thread`, `thread-actions`, `delivery-ticks`
- [x] 3.3 Composer + quick replies + conflict toasts — `message-composer` + send conflict mapping
- [x] 3.4 Map on card when inquiry coords exist — `inquiry-map.tsx`
- [x] 3.5 Realtime subscriptions + badge/optional sound — `inbox-realtime.tsx` + publication SQL
- [x] 3.6 i18n es-AR — `i18n/es-AR.ts` inbox section expanded

## 4. Mandatory verification

- [x] 4.1 Update existing inbox/outbound/nav tests — send-text ensureOwner tests; inbound pet-gate tests
- [x] 4.2 Unit + DB report under `reports/` — `reports/2026-11-07-step-4.2-unit-test-and-db-verification.md`
- [x] 4.3 Curl/RPC manual report — `reports/2026-11-07-step-4.3-manual-endpoint-curl.md` (NO_DOCKER)
- [x] 4.4 E2E claim/delegate/realtime or documented blocker — `reports/2026-11-07-step-4.4-e2e-browser.md` (NO_DOCKER)
- [x] 4.5 Update data-model, STATE, REQUIREMENTS INB checkboxes — done

## 5. Root docs

- [x] 5.1 `ARCHITECTURE_SDD.md` (EN)
- [x] 5.2 `STUDENT_DECISION_LOG.md` (ES)

## 6. Close loop (director)

- [x] 6.1 Mechanical verify — `reports/verify-mechanical.md` **PASS WITH GAPS**
- [x] 6.2 Acceptance matrix — `reports/acceptance-matrix.md`
- [x] 6.3 Adversarial (+ fix loop) — `reports/adversarial-review.md` **FAIL** (pet gate Blocker + Majors); fix §7 then re-audit
- [ ] 6.4 Human OK → archive + PR merge

## 7. Adversarial fix loop (post FAIL 2026-11-07)

- [x] 7.1 **Blocker:** Fix pet gate chicken-and-egg — first-contact Inspectoría registration on shared Mesa-default line (gate by instance/session/area Inspectoría); scenario + test — `decideShouldEnqueuePetProcessInbound`; ingest test enqueues on `inspectoria` + Mesa area; Mesa-only instance skips
- [x] 7.2 **Major:** Area delegation UI — Claim when awaiting+pending_area and caller in area; Reject for area_lead/admin — `thread-actions.tsx` + thread page memberships
- [x] 7.3 **Major:** Cross-area user delegate — restrict targets to area members OR authorize owner in lock; map FORBIDDEN in send-text — picker filtered by `area_members`; lock allows `owner_user_id`; send-text maps codes
- [x] 7.4 **Major:** Align `sla_due_at` with business minutes; extend SLA tests — SQL `add_business_minutes` + TS `addBusinessMinutes`; lunch/holiday/overnight tests
- [x] 7.5 **Major:** Tighten realtime filters; badge inbound/delegation-to-self; document Realtime RLS — `inbox-realtime.tsx` org_id + inbound/delegation badge; note in `reports/adversarial-fixes-round1.md`
- [x] 7.6 **Major/docs:** Soften INB REQUIREMENTS `[~]` where live-only; minors (set-area visibility, DELEGATED from_area, OwnershipError mapping) — INB-09/14 `[~]`; set-area `isOwner||isAdmin`; `v_from_area` before update
- [ ] 7.7 Refresh acceptance-matrix; re-audit until PASS / PASS WITH GAPS with no Blocker/Major — matrix refreshed; re-audit launched
