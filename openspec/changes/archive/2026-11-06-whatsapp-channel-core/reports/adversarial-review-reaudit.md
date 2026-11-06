# Adversarial re-audit — whatsapp-channel-core (after fix round 1)

**Scope:** OpenSpec change `whatsapp-channel-core` (WA-01..12 channel layer)  
**Branch:** `cursor/whatsapp-channel-core-0e30`  
**Base:** `origin/main`  
**Date:** 2026-11-06  
**Reviewer role:** Independent adversarial reviewer (did **not** implement the change or round-1 fixes)  
**Prior FAIL:** `reports/adversarial-review.md`  
**Fix report:** `reports/adversarial-fixes-round1.md` + `tasks.md` §9.1–9.6  
**Refreshed matrix:** `reports/acceptance-matrix.md`  
**Focus commits:** `2b6e39d`, `2dfd882`, `99b4950`, `8d7765d` (+ matrix refresh `c05454b`)

**Sources:**
- Specs: `specs/whatsapp-line-admin`, `whatsapp-inbound`, `whatsapp-outbound`, `local-dev-environment`
- `proposal.md`, `design.md`, `tasks.md`, `.planning/REQUIREMENTS.md`
- Migration: `supabase/migrations/20261107010000_whatsapp_channel_core.sql`
- App: webhook route, inbound store, whatsapp-lines repo/actions, outbound composer, worker download-media
- Proof: focused Vitest **26/26** on fix suites; full suite **620/620**
- No Docker/Podman — live 6.3/6.4 still **BLOCKED** (honest Gap)

---

## Spec and task alignment (re-check)

| Prior finding | Round-1 claim | Re-audit |
|---|---|---|
| **Blocker** `secretFlags` under REVOKE | Service-role `secretsClient`; page passes `createAdminSupabase()`; user JWT never selects secrets | **Cleared** — code + unit |
| **Blocker** cross-org decrypt IDOR | `loadDecryptedLineCredentials(..., orgId)` + ownership before secrets upsert; connection test RLS-loads line first | **Cleared** — code + unit denies foreign org before secrets table |
| **Major** webhook ignore before auth | `authenticateWebhook` before `{ ignored: true }` | **Cleared** — route-auth tests: group w/o secret → 401; unset → 503; valid → ignored 200 |
| **Major** decrypt/key missing → 500 | Map ciphertext/key errors → 503 `SECRET_NOT_CONFIGURED`; no persist | **Cleared** — ingest + route catch; unit covers throw path |
| **Major** citizen race / send-before-persist / messages write RLS | 23505 re-select; persist pending → Evolution → update; drop authenticated INSERT/UPDATE | **Cleared** by code/migration review (+ persist order unit); **no dedicated citizen-race unit** (Minor evidence gap) |
| **Major** WA-05/WA-11 honesty | REQUIREMENTS `[~]` PARTIAL | **Cleared** |
| Optional Minors media folder + ACK rank | `whatsapp-media/` without `sessionId`; monotonic ACK | **Cleared** |

---

## Break attempts (prior six + fix-introduced risk)

### 1. secretFlags / REVOKE

| Attack | Result |
|---|---|
| List lines with authenticated client after `REVOKE ALL` on secrets? | **Fixed.** `listWhatsappLines(client, secretsClient)`; page uses user JWT for lines + admin only for flags. Unit throws if user client touches `whatsapp_line_secrets`. |
| Flags return ciphertext to UI? | **No** — `secretFlags` returns booleans only. |
| REVOKE removed to “fix” list? | **No** — migration still revokes; migration-sql test asserts revoke. |

### 2. Cross-org connection-test decrypt

| Attack | Result |
|---|---|
| Admin A passes org B `lineId` to `testConnectionAction`? | **Blocked twice:** RLS `findWhatsappLineById` → not found; `loadDecryptedLineCredentials` filters `eq('org_id', orgId)` and never opens secrets on miss (unit). |
| Secret upsert for foreign `lineId`? | **Blocked** — `assertLineOwnedByOrg` before encrypt/upsert. |
| Composer decrypt foreign line via guessed id? | **Blocked** — same `orgId` bind; conversation load is RLS-scoped. |

### 3. Webhook auth before ignore

| Attack | Result |
|---|---|
| Group/broadcast payload without secret → 200 + reason probe? | **Fixed.** Auth runs first; missing secret → 401; unset secret → 503. |
| Valid secret + group? | 200 `{ ignored: true, reason: 'group' }` only after verify. |
| Normalize without `instance`? | Defaults to `inspectoria` then authenticates that line — still fail-closed without secret. |

### 4. Encryption key / decrypt fail-closed

| Attack | Result |
|---|---|
| Ciphertext present, `CREDENTIALS_ENCRYPTION_KEY` missing during webhook? | **503** via `resolveWebhookSecret` throw → route/ingest map; no persist (unit). |
| Seed TS with key present? | Writes ciphertext and clears plaintext. |
| `seed.sql` plaintext? | **Documented legacy Gap** — local SQL seed without key; not a reopen of the HTTP 500 Major. |

### 5. Citizen race, persist-then-send, RLS writes

| Attack | Result |
|---|---|
| Concurrent first contact → unique `(org_id, phone_normalized)` → 500? | **Mitigated** — on `23505`, re-select winner (conversation pattern). Orphan loser `citizens` row possible → **Minor** hygiene. |
| Production composer Evolution ok + DB fail → WhatsApp without row? | **Fixed order** — persist `pending` → Evolution → update `sent`/`failed` (unit asserts order + failure marks failed). |
| Operator JWT INSERT/UPDATE forge on `messages` / `conversations`? | **Dropped** in migration; SELECT org-scoped retained; composer/inbound use service role. Static SQL test asserts no authenticated insert policy recreate. |

### 6. WA-05 / WA-11 honesty

| Attack | Result |
|---|---|
| Archive claiming full media thread UI / admin send_mode chooser? | **Blocked by docs** — REQUIREMENTS `[~]` PARTIAL; matrix lists deferred UI. |

### Fix-introduced risks checked (no new Blocker/Major)

| Risk | Disposition |
|---|---|
| Auth-before-ignore enables instance existence probe (404 vs 401/503) | **Minor** — accepted cost of WA-03; no secret bypass |
| `download_media` job still `kind: "animal"` without `sessionId` | **Minor** naming; folder uses `whatsapp-media/` when no session; no animal link without `sessionId` |
| Worker `send_outbound` still Evolution-then-persist | **Minor residual** — prior Major targeted **composer**; bot worker path unchanged |
| No dedicated unit for citizen 23505 path | **Minor** evidence gap — code present; matrix slightly overstates “unit race path” |
| Persist succeeds then crash before `enqueueJob` | **Minor** pre-existing (duplicate webhook skips bot drive) |
| Live Docker curl/E2E/db reset | **Gap** — not re-raised as Major theater; matrix stays BLOCKED |
| Shared Mesa line still enqueues `process_inbound` (pet) | **Question** for product — unchanged by §9 |

---

## Findings

| Severity | Area | Finding | Evidence | Suggested fix |
|----------|------|---------|----------|---------------|
| Minor | inbound / races | Citizen unique race no longer 500s, but loser insert can leave orphan `citizens` rows | `upsertCitizenStub` 23505 branch returns winner without deleting loser | Code: delete orphan on 23505 or use upsert/RPC |
| Minor | tests | No unit asserting citizen 23505 re-select | Grep of `*.test.ts` — no 23505/citizen-race case | Tests: mock unique violation → winner id |
| Minor | worker outbound | Bot `send_outbound` still sends then persists | `worker/src/jobs/send-outbound.ts` | Code follow-up: align with composer persist-then-send |
| Minor | media job | Channel enqueue still uses `kind: "animal"` | `inbound-repository.ts` enqueue | Neutral kind for channel jobs |
| Minor | webhook | Instance existence distinguishable via status codes after auth-first | route `LINE_NOT_FOUND` 404 vs 401/503 | Optional: uniform 401 for unknown/unauthorized |
| Minor | idempotency | Persist-then-crash before enqueue still loses bot drive on duplicate retry | Prior review; unchanged | Outbox / enqueue-if-missing |
| Question | product | Non-`fromMe` Mesa inbound still drives pet `process_inbound` | design D8 / ingest | Confirm before archive |
| Gap | live verify | 6.3/6.4 Docker proofs still BLOCKED | step reports + matrix | Host re-verify or human waiver |

**Blockers:** none  
**Majors:** none  

---

## Verdict

**PASS WITH GAPS**

All prior **Blockers** and **Majors** from `adversarial-review.md` are addressed in code and (where claimed) unit evidence. Remaining items are **Minors**, honest **Gaps** (no live Docker), and one **product Question** — none should stop the adversarial gate by themselves.

**Archiving is advisable** only after **human OK**, with explicit acceptance of: NO_DOCKER live residual, WA-08 still open, WA-05/WA-11 UI deferred, and the product Question on shared-line pet drive.

---

## Recommended next steps (before archive)

1. Human sign-off on Gaps + Question (or schedule inbox routing change).  
2. Optional cheap follow-ups: citizen-race unit, orphan cleanup, worker persist-then-send, neutral media `kind`.  
3. Re-run 6.3/6.4 on a container host when available.  
4. Do **not** treat WA-08 / rich media UI / send_mode admin chooser as done.
